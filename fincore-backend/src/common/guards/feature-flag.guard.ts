// src/common/guards/feature-flag.guard.ts
//
// FIX: This file was completely empty — no app access enforcement existed.
//      Any user could hit any app endpoint regardless of plan or org settings.
//
// NOW: Reads the @RequireApp(AppKey.X) decorator and validates:
//      1. The org has that app enabled (OrgAppAccess) — from JWT payload.apps[]
//      2. The user's plan includes that app — from JWT payload.plan + PlanLimit.
//
//      Zero DB hits — all data is in the JWT OrgJwtPayload.
//      For hard enforcement on plan limits (invoice count etc.) use UsageService.
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

    if (!isOrgPayload(user)) {
      throw new ForbiddenException('Org-scoped token required. POST /auth/select-org first.');
    }

    // Check if the app is enabled for this org (toggled by Owner/Admin)
    if (!user.apps.includes(requiredApp)) {
      throw new ForbiddenException(
        `The '${requiredApp}' app is not enabled for your organization. ` +
          `Contact your admin or upgrade your plan.`,
      );
    }

    return true;
  }
}
