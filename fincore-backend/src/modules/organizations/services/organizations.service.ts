// src/modules/organizations/services/organizations.service.ts
import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';

// ── Prisma payload types ───────────────────────────────────────────────────────
// Schema model: UserOrganization  →  Prisma accessor: userOrganization
// Confirmed from workspace.prisma

type UserOrgWithOrganization = Prisma.UserOrganizationGetPayload<{
  include: { organization: true };
}>;

// ── Response shapes ────────────────────────────────────────────────────────────

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
}

export interface OrganizationWithRoleResponse extends OrganizationResponse {
  role: string;
  isDefault: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationResponse> {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: dto.name, slug: dto.slug },
      });

      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: organization.id,
          role: UserRole.OWNER,
          isDefault: false,
        },
      });

      return organization;
    });

    this.logger.log(`Organization created: ${org.id} (${org.slug}) by user ${userId}`);

    return { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt };
  }

  // ── List all orgs for a user ────────────────────────────────────────────────

  async findAllForUser(userId: string): Promise<OrganizationWithRoleResponse[]> {
    const memberships: UserOrgWithOrganization[] = await this.prisma.userOrganization.findMany({
      where: { userId },
      include: { organization: true },
    });

    return memberships.map(
      (m: UserOrgWithOrganization): OrganizationWithRoleResponse => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        createdAt: m.organization.createdAt,
        role: m.role,
        isDefault: m.isDefault,
      }),
    );
  }

  // ── Get single org (membership required) ───────────────────────────────────

  async findOne(userId: string, orgId: string): Promise<OrganizationWithRoleResponse> {
    const membership: UserOrgWithOrganization | null = await this.prisma.userOrganization.findFirst(
      {
        where: { userId, organizationId: orgId },
        include: { organization: true },
      },
    );

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      createdAt: membership.organization.createdAt,
      role: membership.role,
      isDefault: membership.isDefault,
    };
  }
}
