/**
 * src/modules/feature-flags/guards/feature-flag.guard.ts
 *
 * FIX 13: Architecture clarification — two distinct guards, two distinct roles:
 *
 *   ┌─ src/common/guards/feature-flag.guard.ts  (@RequireApp)
 *   │   → App-level access gate (JWT-based, zero DB hits)
 *   │   → Reads OrgJwtPayload.apps[] from the access token
 *   │   → Use for: routing users to correct app pages, API app-level protection
 *   │   → Registered globally via APP_GUARD in AppModule
 *   │
 *   └─ THIS FILE  (@RequiresFeature — plan-level)
 *       → Plan-level feature gate (Redis + DB, async)
 *       → Calls FeatureFlagsService which checks OrgAppAccess + Plan.features[]
 *       → Use for: premium features within an app (e.g. multi-currency, reports)
 *       → Returns HTTP 402 Payment Required
 *       → NOT registered globally — add explicitly: @UseGuards(FeatureFlagGuard)
 *
 * Use @RequireApp for app-level gates. Use @RequiresFeature for plan-feature gates.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../services/feature-flags.service';
import type { AppKey } from '@prisma/client';

export const FEATURE_KEY = 'requiredFeature';
export const RequiresFeature = (feature: AppKey): MethodDecorator & ClassDecorator =>
  SetMetadata(FEATURE_KEY, feature);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<AppKey | undefined>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredFeature) return true;

    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();

    const orgId = request.headers['x-organization-id'];
    if (!orgId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'X-Organization-Id required',
          code: 'MISSING_ORG_HEADER',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const result = await this.featureFlags.checkAccess(orgId, requiredFeature);
    if (!result.hasAccess) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `Feature '${requiredFeature}' is not available on your plan. Upgrade to unlock it.`,
          code: 'FEATURE_ACCESS_DENIED',
          feature: requiredFeature,
          source: result.source,
          globalOverride: result.globalOverride,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
