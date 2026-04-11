// src/modules/workspace/services/organizations.service.ts
//
// FIXES applied:
//  4. orderBy changed from createdAt → joinedAt (new schema field)
//  5. removeMember uses soft-delete (removedAt) not hard delete
//  6. getMembers filters removedAt: null
//  7. updateMemberRole blocks OWNER role change via API entirely
//  8. create() includes all new schema fields
//

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OrgStatus, UserRole, AppKey, BusinessType } from '@prisma/client';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateOrganizationDto) {
    const slugTaken = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (slugTaken) {
      throw new ConflictException(`Slug '${dto.slug}' is already taken`);
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          email: dto.email,
          businessType: dto.businessType ?? BusinessType.SME,
          country: dto.country ?? 'PK',
          currency: dto.currency ?? 'PKR',
          timezone: dto.timezone ?? 'UTC',
          fiscalYearStart: dto.fiscalYearStart ?? 1,
          fiscalYearEnd: dto.fiscalYearEnd ?? 12,
          taxId: dto.taxId,
          industry: dto.industry,
          status: OrgStatus.ACTIVE,
          onboardingStep: 2,
        },
      });

      // Creator is always OWNER
      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: org.id,
          role: UserRole.OWNER,
          isDefault: true,
        },
      });

      // Enable requested apps (default: INVOICING)
      const appsToEnable = dto.enabledApps?.length ? dto.enabledApps : [AppKey.INVOICING];
      await tx.orgAppAccess.createMany({
        data: appsToEnable.map((app) => ({
          organizationId: org.id,
          app,
          isEnabled: true,
          enabledById: userId,
        })),
      });

      this.logger.log(`Org created: ${org.id} (${org.slug}) by user ${userId}`);
      return org;
    });
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async findOne(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          where: { removedAt: null }, // FIX 6: exclude soft-removed
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        appAccess: { where: { isEnabled: true } },
        subscription: { include: { plan: true } },
      },
    });

    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return org;
  }

  async findAllForUser(userId: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId, removedAt: null }, // FIX 6: only active memberships
      include: {
        organization: {
          include: {
            subscription: { include: { plan: { select: { name: true, displayName: true } } } },
            appAccess: { where: { isEnabled: true }, select: { app: true } },
          },
        },
      },
      orderBy: { joinedAt: 'asc' }, // FIX 4: joinedAt not createdAt
    });
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    await this.findOne(orgId);
    return this.prisma.organization.update({ where: { id: orgId }, data: dto });
  }

  // ── Members ───────────────────────────────────────────────────────────────

  async getMembers(orgId: string) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId: orgId, removedAt: null }, // FIX 6
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    newRole: UserRole,
    requestorId: string,
  ) {
    // FIX 7: OWNER role is immutable — cannot be assigned or removed via API
    if (newRole === UserRole.OWNER) {
      throw new ForbiddenException(
        'The OWNER role cannot be assigned via API. Use the seed script.',
      );
    }

    const requestor = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: requestorId, organizationId: orgId } },
    });
    if (!requestor || requestor.removedAt) {
      throw new ForbiddenException('Not a member of this organization');
    }

    const target = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!target || target.removedAt) {
      throw new NotFoundException('Member not found in this organization');
    }

    // FIX 7: Cannot demote the OWNER
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('The Owner role cannot be changed');
    }

    // Cannot self-demote if you are the last admin/owner
    if (requestorId === targetUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }

    return this.prisma.userOrganization.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { role: newRole },
    });
  }

  async removeMember(orgId: string, targetUserId: string, requestorId: string) {
    if (targetUserId === requestorId) {
      throw new ForbiddenException('You cannot remove yourself');
    }

    const target = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!target || target.removedAt) throw new NotFoundException('Member not found');

    // FIX 7: OWNER cannot be removed
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('The Owner cannot be removed from the organization');
    }

    // FIX 5: Soft-delete — set removedAt instead of hard delete
    await this.prisma.userOrganization.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { removedAt: new Date() },
    });

    return { removed: true, userId: targetUserId };
  }

  // ── App access management ─────────────────────────────────────────────────

  async getAppAccess(orgId: string) {
    return this.prisma.orgAppAccess.findMany({
      where: { organizationId: orgId },
      orderBy: { app: 'asc' },
    });
  }

  async toggleApp(orgId: string, app: AppKey, enable: boolean, enabledById: string) {
    return this.prisma.orgAppAccess.upsert({
      where: { organizationId_app: { organizationId: orgId, app } },
      create: { organizationId: orgId, app, isEnabled: enable, enabledById },
      update: { isEnabled: enable },
    });
  }
}
