// src/common/guards/roles.guard.ts
//
// Reads role/orgId/plan claims directly from the OrgJwtPayload (zero DB hits).
// Super-admin (isSuperAdmin: true) bypasses all role and MFA requirements.
//
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OrgJwtPayload, isOrgPayload } from '../types/jwt-payload.type';
import { ROLE_HIERARCHY, MFA_REQUIRED_ROLES } from '../constants/roles.constants';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @Roles() decorator → route is accessible to any authenticated user
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as OrgJwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException('No authentication context');
    }

    // CEO / platform-owner bypasses all role restrictions
    if (user.isSuperAdmin) return true;

    // Route requires role-check → must have org-scoped token
    if (!isOrgPayload(user)) {
      throw new ForbiddenException('Org-scoped token required. POST /auth/select-org first.');
    }

    // Check role hierarchy — OWNER(6) satisfies ADMIN(5) requirement etc.
    const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
    const requiredLevel = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(
        `Insufficient role. Have: '${user.role}'. Required: ${requiredRoles.join(' or ')}.`,
      );
    }

    // Enforce 2FA requirement for elevated roles (OWNER, ADMIN)
    if (MFA_REQUIRED_ROLES.includes(user.role)) {
      if (!user.mfaVerified) {
        throw new ForbiddenException(
          `Role '${user.role}' requires MFA verification. Please login with your 2FA code.`,
        );
      }
    }

    return true;
  }
}
