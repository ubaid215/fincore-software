// src/common/guards/roles.guard.ts
//
// FIX (was): Did a DB query (userOrganization.findUnique) on EVERY authenticated
//            request to fetch the user's role — expensive on high-traffic routes.
//
// NOW: Role, orgId, plan, and apps are embedded in the OrgJwtPayload (JWT claims).
//      This guard reads them directly from request.user — zero DB hits on hot path.
//      The token has a 15-min TTL; role changes take effect on next token refresh.
//      For immediate revocation (e.g. remove member): call logoutAll → forces re-login.
//
//      FALLBACK: If the route is hit with a bare JwtPayload (no org context),
//      the guard falls through to the org-scoped token flow check.
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
    // The MFA check happens at login; this is a belt-and-suspenders safeguard
    // in case the token was issued through a non-standard path.
    if (MFA_REQUIRED_ROLES.includes(user.role)) {
      // mfaVerified is set by AuthService.login() when MFA code was validated
      if (!(user as any).mfaVerified) {
        throw new ForbiddenException(
          `Role '${user.role}' requires MFA verification. Please login with your 2FA code.`,
        );
      }
    }

    return true;
  }
}
