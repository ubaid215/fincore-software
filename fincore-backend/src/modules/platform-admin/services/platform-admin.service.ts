import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AppKey } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { UpsertOrgEntitlementOverrideDto } from '../dto/platform-admin.dto';

@Injectable()
export class PlatformAdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSuperAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    });
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException('Only Fincore super admin can access this endpoint');
    }
  }

  async listOrganizations(userId: string) {
    await this.assertSuperAdmin(userId);
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        subscription: { include: { plan: { include: { limits: true } } } },
        appAccess: true,
        entitlementOverride: true,
      },
    });
  }

  async upsertOverride(userId: string, organizationId: string, dto: UpsertOrgEntitlementOverrideDto) {
    await this.assertSuperAdmin(userId);

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    return this.prisma.orgEntitlementOverride.upsert({
      where: { organizationId },
      create: {
        organizationId,
        updatedById: userId,
        maxUsersOverride: dto.maxUsersOverride,
        maxConcurrentSessionsOverride: dto.maxConcurrentSessionsOverride,
        maxAppsOverride: dto.maxAppsOverride,
        allowedAppsOverride: dto.allowedAppsOverride ?? [],
        reason: dto.reason,
      },
      update: {
        updatedById: userId,
        maxUsersOverride: dto.maxUsersOverride,
        maxConcurrentSessionsOverride: dto.maxConcurrentSessionsOverride,
        maxAppsOverride: dto.maxAppsOverride,
        allowedAppsOverride: dto.allowedAppsOverride,
        reason: dto.reason,
      },
    });
  }

  async clearOverride(userId: string, organizationId: string) {
    await this.assertSuperAdmin(userId);
    await this.prisma.orgEntitlementOverride.deleteMany({ where: { organizationId } });
    return { deleted: true };
  }

  async setAppAccess(userId: string, organizationId: string, app: AppKey, enabled: boolean) {
    await this.assertSuperAdmin(userId);
    return this.prisma.orgAppAccess.upsert({
      where: { organizationId_app: { organizationId, app } },
      create: { organizationId, app, isEnabled: enabled, enabledById: userId },
      update: { isEnabled: enabled, enabledById: userId, enabledAt: new Date() },
    });
  }
}
