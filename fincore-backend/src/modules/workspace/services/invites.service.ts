// src/modules/workspace/services/invites.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InviteMemberDto } from '../dto/invite-member.dto';
import { v4 as uuidv4 } from 'uuid';

const INVITE_EXPIRY_HOURS = 72;

@Injectable()
export class InvitesService {
  constructor(private prisma: PrismaService) {}

  async createInvite(orgId: string, invitedById: string, dto: InviteMemberDto) {
    // 1. Check seat availability
    await this.assertSeatAvailable(orgId);

    // 2. Check not already a member
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      const alreadyMember = await this.prisma.userOrganization.findUnique({
        where: { userId_organizationId: { userId: existingUser.id, organizationId: orgId } },
      });
      if (alreadyMember) {
        throw new ConflictException(`${dto.email} is already a member of this organization`);
      }
    }

    // 3. Check no pending invite
    const pendingInvite = await this.prisma.invite.findFirst({
      where: { organizationId: orgId, email: dto.email, acceptedAt: null },
    });
    if (pendingInvite && pendingInvite.expiresAt > new Date()) {
      throw new ConflictException(`A pending invite already exists for ${dto.email}`);
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    const invite = await this.prisma.invite.create({
      data: {
        organizationId: orgId,
        invitedById,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    return {
      invite,
      inviteUrl: `${process.env.APP_URL ?? 'http://localhost:5173'}/invite/accept?token=${token}`,
    };
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.invite.findUnique({ where: { token } });

    if (!invite) throw new NotFoundException('Invite not found or already used');
    if (invite.acceptedAt) throw new ConflictException('This invite has already been accepted');
    if (invite.expiresAt < new Date()) throw new BadRequestException('This invite has expired');

    // Check seat again (plan may have changed since invite was sent)
    await this.assertSeatAvailable(invite.organizationId);

    return this.prisma.$transaction(async (tx) => {
      await tx.userOrganization.create({
        data: { userId, organizationId: invite.organizationId, role: invite.role },
      });

      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return { joined: true, organizationId: invite.organizationId, role: invite.role };
    });
  }

  async listPendingInvites(orgId: string) {
    return this.prisma.invite.findMany({
      where: {
        organizationId: orgId,
        acceptedAt: null,
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
    await this.prisma.invite.delete({ where: { id: inviteId } });
    return { revoked: true };
  }

  // ── private ─────────────────────────────────────────────────────────────

  private async assertSeatAvailable(orgId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
      include: { plan: true },
    });

    // No subscription = trial / grace period — allow up to 3 members
    const maxSeats = subscription?.plan.maxSeats ?? 3;

    const currentCount = await this.prisma.userOrganization.count({
      where: { organizationId: orgId },
    });

    if (currentCount >= maxSeats) {
      throw new BadRequestException({
        statusCode: 402,
        message: `Seat limit reached (${maxSeats} seats). Upgrade your plan to invite more members.`,
        code: 'SEAT_LIMIT_REACHED',
      });
    }
  }
}
