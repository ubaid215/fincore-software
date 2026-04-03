// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtPayload } from '../types/jwt-payload.type';
import { PrismaService } from '../../database/prisma.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  userRole?: UserRole;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user: JwtPayload = request.user;
    const orgId: string | undefined = request.headers['x-organization-id'] as string | undefined;

    if (!orgId) {
      throw new ForbiddenException('Missing X-Organization-Id header');
    }

    const membership = await this.prisma.userOrganization.findUnique({
      where: { userId_organizationId: { userId: user.sub, organizationId: orgId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.OWNER]: 5,
      [UserRole.ADMIN]: 4,
      [UserRole.ACCOUNTANT]: 3,
      [UserRole.MANAGER]: 2,
      [UserRole.VIEWER]: 1,
    };

    const userLevel = roleHierarchy[membership.role];
    const requiredLevel = Math.min(...requiredRoles.map((r) => roleHierarchy[r]));

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `Role '${membership.role}' is insufficient. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    request.userRole = membership.role;
    return true;
  }
}
