/**
 * src/modules/feature-flags/guards/feature-flag.guard.ts
 *
 * NestJS guard that enforces feature entitlements.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
 *   @RequiresFeature(FEATURES.INVOICING)
 *   @Get()
 *   listInvoices() { ... }
 *
 * Returns HTTP 402 Payment Required when:
 *   - The organization has no subscription
 *   - The subscription is SUSPENDED or PAST_DUE
 *   - The feature is not included in the current plan
 *   - A global kill-switch has disabled the feature
 *
 * Sprint: S4 · Week 9–10
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
import type { FeatureKey } from '../../../common/constants/features.constants';

/** Metadata key used to store the required feature on a route handler */
export const FEATURE_KEY = 'requiredFeature';

/**
 * Decorator — marks which feature a route requires.
 * Must be combined with FeatureFlagGuard.
 *
 * @example
 * @RequiresFeature(FEATURES.INVOICING)
 * @UseGuards(JwtAuthGuard, FeatureFlagGuard)
 * @Get()
 * listInvoices() {}
 */
export const RequiresFeature = (feature: FeatureKey): MethodDecorator & ClassDecorator =>
  SetMetadata(FEATURE_KEY, feature);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<FeatureKey | undefined>(FEATURE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // No @RequiresFeature() — allow through unconditionally
    if (!requiredFeature) return true;

    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();

    const orgId = request.headers['x-organization-id'];

    if (!orgId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: 'X-Organization-Id header is required for feature-gated endpoints',
          code: 'MISSING_ORG_HEADER',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const result = await this.featureFlags.checkAccess(orgId, requiredFeature);

    if (!result.hasAccess) {
      const reasonMessages: Record<string, string> = {
        global_override: `Feature '${requiredFeature}' is currently disabled globally.`,
        no_subscription: `Your organization does not have an active subscription. Subscribe to access '${requiredFeature}'.`,
        entitlement: `Feature '${requiredFeature}' is not included in your current plan. Upgrade to enable it.`,
      };

      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message:
            reasonMessages[result.source] ?? `Feature '${requiredFeature}' is not available.`,
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

/*
 * Sprint S4 · FeatureFlagGuard · Week 9–10
 * HTTP 402 on: no subscription, suspended, past-due, feature not in plan, global kill-switch
 * Decorator: @RequiresFeature(FEATURES.INVOICING)
 * Owned by: Billing team
 */
