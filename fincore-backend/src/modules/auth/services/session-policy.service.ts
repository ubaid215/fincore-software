import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class SessionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePerUserLimit(userId: string, organizationId?: string): Promise<number> {
    const orgId = organizationId ?? (await this.getDefaultOrganizationId(userId));
    if (!orgId) return 10;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        subscription: {
          select: {
            plan: {
              select: {
                limits: { select: { maxConcurrentSessionsPerUser: true } },
              },
            },
          },
        },
      },
    });

    const override = await this.prisma.orgEntitlementOverride.findUnique({
      where: { organizationId: orgId },
      select: { maxConcurrentSessionsOverride: true },
    });

    return (
      override?.maxConcurrentSessionsOverride ??
      org?.subscription?.plan?.limits?.maxConcurrentSessionsPerUser ??
      10
    );
  }

  async resolveMaxUsersForOrg(organizationId: string): Promise<number | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscription: { select: { plan: { select: { limits: { select: { maxUsers: true } } } } } },
      },
    });
    const override = await this.prisma.orgEntitlementOverride.findUnique({
      where: { organizationId },
      select: { maxUsersOverride: true },
    });
    return override?.maxUsersOverride ?? org?.subscription?.plan?.limits?.maxUsers ?? null;
  }

  private async getDefaultOrganizationId(userId: string): Promise<string | null> {
    const membership = await this.prisma.userOrganization.findFirst({
      where: { userId, removedAt: null },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
      select: { organizationId: true },
    });
    return membership?.organizationId ?? null;
  }
}
