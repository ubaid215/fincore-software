// src/common/guards/feature-flag.guard.ts
//
// Validates @RequireApp(AppKey.X) decorator against the JWT claims:
//   1. Org has the app enabled (OrgAppAccess) — from payload.apps[]
//   2. Plan includes the app — already intersected in selectOrg, so apps[] is always plan-filtered
//
// Super-admin (isSuperAdmin: true) bypasses all app access restrictions.
// Zero DB hits — all data is in the OrgJwtPayload.
//
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppKey } from '@prisma/client';
import { REQUIRE_APP_KEY } from '../decorators/organization.decorator';
import { OrgJwtPayload, isOrgPayload } from '../types/jwt-payload.type';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredApp = this.reflector.getAllAndOverride<AppKey>(REQUIRE_APP_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @RequireApp() decorator → no app restriction on this route
    if (!requiredApp) return true;

    const request = ctx.switchToHttp().getRequest();
    const user = request.user as OrgJwtPayload | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // CEO / platform-owner bypasses all app access restrictions
    if (user.isSuperAdmin) return true;

    if (!isOrgPayload(user)) {
      throw new ForbiddenException('Org-scoped token required. POST /auth/select-org first.');
    }

    // apps[] is already the intersection of org-enabled apps and plan-allowed features
    if (!user.apps.includes(requiredApp)) {
      throw new ForbiddenException(
        `The '${requiredApp}' app is not available in your current plan or is disabled for your organization. ` +
          `Contact your admin or upgrade your plan.`,
      );
    }

    return true;
  }
}
