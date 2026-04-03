// src/modules/workspace/services/organizations.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UserRole } from '@prisma/client';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slugTaken = await this.prisma.organization.findUnique({ where: { slug: dto.slug } });
    if (slugTaken) {
      throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
    }

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          email: dto.email,
          timezone: dto.timezone ?? 'UTC',
          currency: dto.currency ?? 'PKR',
          fiscalYearEnd: dto.fiscalYearEnd ?? 12,
        },
      });

      // Creator is always OWNER
      await tx.userOrganization.create({
        data: { userId, organizationId: org.id, role: UserRole.OWNER },
      });

      return org;
    });
  }

  async findOne(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!org) throw new NotFoundException(`Organization ${orgId} not found`);
    return org;
  }

  async findAllForUser(userId: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    await this.findOne(orgId); // throws 404 if not found
    return this.prisma.organization.update({ where: { id: orgId }, data: dto });
  }

  async getMembers(orgId: string) {
    return this.prisma.userOrganization.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(
    orgId: string,
    targetUserId: string,
    newRole: UserRole,
    requestorId: string,
  ) {
    // Prevent self-role-change for owner
    const requestorMembership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: requestorId, organizationId: orgId } },
    });
    if (!requestorMembership) throw new ForbiddenException('Not a member of this organization');

    // Only owner can assign/remove OWNER role
    if (newRole === UserRole.OWNER && requestorMembership.role !== UserRole.OWNER) {
      throw new ForbiddenException('Only the Owner can assign the Owner role');
    }

    const target = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!target) throw new NotFoundException('Member not found in this organization');

    return this.prisma.userOrganization.update({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
      data: { role: newRole },
    });
  }

  async removeMember(orgId: string, targetUserId: string, requestorId: string) {
    if (targetUserId === requestorId) {
      throw new ForbiddenException('You cannot remove yourself from the organization');
    }

    const target = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('The owner cannot be removed');
    }

    await this.prisma.userOrganization.delete({
      where: { userId_organizationId: { userId: targetUserId, organizationId: orgId } },
    });

    return { removed: true };
  }
}
