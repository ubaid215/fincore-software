// src/modules/workspace/services/invites.service.ts
//
// FIXES applied:
//  10. Token stored raw in Invite (correct — Invite.token ≠ MagicLink.tokenHash)
//  11. revokeInvite uses revokedAt soft-delete not hard delete
//  12. acceptInvite checks revokedAt
//  13. listPendingInvites filters revokedAt: null
//  14. EmailService injected — sends invite email
//  15. appAccess field set on invite creation
//

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EmailService } from '../../auth/services/email.service';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { AppKey } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';

const INVITE_EXPIRY_HOURS = 72;

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async createInvite(orgId: string, invitedById: string, dto: InviteMemberDto) {
    // 1. Seat check
    await this.assertSeatAvailable(orgId);

    // 2. Not already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });
    if (existingUser) {
      const alreadyMember = await this.prisma.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId: existingUser.id, organizationId: orgId },
        },
      });
      if (alreadyMember && !alreadyMember.removedAt) {
        throw new ConflictException(`${dto.email} is already a member of this organization`);
      }
    }

    // 3. No active pending invite (@@unique([organizationId, email]) handles duplicates,
    //    but we give a better error message)
    const pending = await this.prisma.invite.findFirst({
      where: {
        organizationId: orgId,
        email: dto.email.toLowerCase(),
        acceptedAt: null,
        revokedAt: null, // FIX 12/13: include revokedAt check
        expiresAt: { gt: new Date() },
      },
    });
    if (pending) {
      throw new ConflictException(`A pending invite already exists for ${dto.email}`);
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 3_600_000);
    const frontendUrl = this.config.get<string>('auth.frontendUrl', 'http://localhost:3001');

    const invite = await this.prisma.invite.create({
      data: {
        organizationId: orgId,
        invitedById,
        email: dto.email.toLowerCase(),
        role: dto.role,
        appAccess: dto.appAccess ?? [], // FIX 15: set appAccess
        token,
        expiresAt,
      },
    });

    const inviteUrl = `${frontendUrl}/invite/accept?token=${token}`;

    // FIX 14: Send invite email via EmailService
    await this.email.sendInviteEmail(
      dto.email,
      org?.name ?? 'Your Organization',
      dto.role,
      inviteUrl,
    );

    this.logger.log(`Invite created for ${dto.email} in org ${orgId}`);

    return { invite, inviteUrl };
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });

    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.acceptedAt) throw new ConflictException('Invite already accepted');
    if (invite.revokedAt) throw new BadRequestException('This invite has been revoked'); // FIX 12
    if (invite.expiresAt < new Date()) throw new BadRequestException('Invite has expired');

    // Re-check seat (plan may have changed since invite was sent)
    await this.assertSeatAvailable(invite.organizationId);

    return this.prisma.$transaction(async (tx) => {
      // Check if already a member (edge case: re-invited after removal)
      const existing = await tx.userOrganization.findUnique({
        where: {
          userId_organizationId: { userId, organizationId: invite.organizationId },
        },
      });

      if (existing && !existing.removedAt) {
        throw new ConflictException('You are already a member of this organization');
      }

      if (existing && existing.removedAt) {
        // Re-activate soft-deleted membership
        await tx.userOrganization.update({
          where: { userId_organizationId: { userId, organizationId: invite.organizationId } },
          data: { role: invite.role, removedAt: null, appAccess: invite.appAccess as AppKey[] },
        });
      } else {
        await tx.userOrganization.create({
          data: {
            userId,
            organizationId: invite.organizationId,
            role: invite.role,
            appAccess: invite.appAccess as AppKey[],
          },
        });
      }

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return {
        joined: true,
        organizationId: invite.organizationId,
        role: invite.role,
      };
    });
  }

  async listPendingInvites(orgId: string) {
    return this.prisma.invite.findMany({
      where: {
        organizationId: orgId,
        acceptedAt: null,
        revokedAt: null, // FIX 13
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeInvite(inviteId: string, orgId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.organizationId !== orgId) {
      throw new NotFoundException('Invite not found');
    }
    if (invite.acceptedAt) {
      throw new ConflictException('Cannot revoke an already accepted invite');
    }

    // FIX 11: Soft-delete using revokedAt — keeps audit trail
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });

    return { revoked: true };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async assertSeatAvailable(orgId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: { include: { limits: true } } },
    });

    const maxSeats = subscription?.plan?.limits?.maxUsers ?? subscription?.plan?.maxSeats ?? 3;

    // -1 = unlimited (ENTERPRISE plan)
    if (maxSeats === -1) return;

    const currentCount = await this.prisma.userOrganization.count({
      where: { organizationId: orgId, removedAt: null },
    });

    if (currentCount >= maxSeats) {
      throw new BadRequestException({
        statusCode: 402,
        message: `Seat limit reached (${maxSeats}). Upgrade your plan to invite more members.`,
        code: 'SEAT_LIMIT_REACHED',
      });
    }
  }
}
