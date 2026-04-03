/**
 * src/modules/feature-flags/services/feature-flags.service.ts
 *
 * Feature flag service — two layers of flag resolution:
 *
 *   Layer 1: Global overrides (stored in Redis, set by super-admin)
 *     Key: `flag:global:{featureKey}` → 'true' | 'false'
 *     Use case: kill-switch a feature globally without a deploy.
 *
 *   Layer 2: Org entitlements (from subscription plan, cached in Redis)
 *     Key: `entitlements:{orgId}` → JSON string[] of feature keys
 *     TTL: 60 seconds
 *     Use case: per-org plan-based feature gating.
 *
 * Resolution order (first match wins):
 *   1. Global flag override present → use it
 *   2. Org entitlements from subscription → use plan features
 *   3. No subscription / SUSPENDED → deny
 *
 * Sprint: S4 · Week 9–10
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { FEATURES, type FeatureKey } from '../../../common/constants/features.constants';

const GLOBAL_FLAG_PREFIX = 'flag:global:';
const GLOBAL_FLAG_TTL = 3600; // 1 hour

export interface FeatureFlagStatus {
  featureKey: string;
  hasAccess: boolean;
  source: 'global_override' | 'entitlement' | 'no_subscription';
  globalOverride: boolean | null;
}

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async checkAccess(organizationId: string, featureKey: string): Promise<FeatureFlagStatus> {
    // Layer 1: Global override
    let globalOverride: boolean | null = null;
    try {
      const globalVal = await this.redis.get(`${GLOBAL_FLAG_PREFIX}${featureKey}`);
      if (globalVal !== null) {
        globalOverride = globalVal === 'true';
        return { featureKey, hasAccess: globalOverride, source: 'global_override', globalOverride };
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis unavailable for global flag check: ${(err as Error).message}`);
    }

    // Layer 2: Org entitlement
    try {
      const hasAccess = await this.subscriptionsService.checkFeatureAccess(
        organizationId,
        featureKey,
      );
      return {
        featureKey,
        hasAccess,
        source: hasAccess ? 'entitlement' : 'no_subscription',
        globalOverride: null,
      };
    } catch {
      return { featureKey, hasAccess: false, source: 'no_subscription', globalOverride: null };
    }
  }

  async checkMultiple(
    organizationId: string,
    featureKeys: string[],
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const pipeline = this.redis.pipeline();
    featureKeys.forEach((key) => pipeline.get(`${GLOBAL_FLAG_PREFIX}${key}`));

    let globalResults: Array<[Error | null, string | null]> = [];
    try {
      globalResults = (await pipeline.exec()) as Array<[Error | null, string | null]>;
    } catch {
      globalResults = featureKeys.map(() => [null, null]);
    }

    const needsEntitlementCheck: string[] = [];
    featureKeys.forEach((key, i) => {
      const [, value] = globalResults[i] ?? [null, null];
      if (value !== null) {
        results[key] = value === 'true';
      } else {
        needsEntitlementCheck.push(key);
      }
    });

    for (const key of needsEntitlementCheck) {
      try {
        results[key] = await this.subscriptionsService.checkFeatureAccess(organizationId, key);
      } catch {
        results[key] = false;
      }
    }

    return results;
  }

  async setGlobalOverride(featureKey: string, enabled: boolean): Promise<void> {
    await this.redis.setex(
      `${GLOBAL_FLAG_PREFIX}${featureKey}`,
      GLOBAL_FLAG_TTL,
      enabled ? 'true' : 'false',
    );
    this.logger.warn(
      `Global flag override SET: ${featureKey} = ${enabled} (TTL: ${GLOBAL_FLAG_TTL}s)`,
    );
  }

  async removeGlobalOverride(featureKey: string): Promise<void> {
    await this.redis.del(`${GLOBAL_FLAG_PREFIX}${featureKey}`);
    this.logger.log(`Global flag override REMOVED: ${featureKey}`);
  }

  async getAllGlobalOverrides(): Promise<Record<string, boolean | null>> {
    const result: Record<string, boolean | null> = {};
    const pipeline = this.redis.pipeline();
    Object.values(FEATURES).forEach((key) => pipeline.get(`${GLOBAL_FLAG_PREFIX}${key}`));

    let values: Array<[Error | null, string | null]> = [];
    try {
      values = (await pipeline.exec()) as Array<[Error | null, string | null]>;
    } catch {
      values = Object.values(FEATURES).map(() => [null, null]);
    }

    Object.values(FEATURES).forEach((key, i) => {
      const [, val] = values[i] ?? [null, null];
      result[key] = val === null ? null : val === 'true';
    });

    return result;
  }
}

/*
 * Sprint S4 · FeatureFlagsService · Week 9–10
 * Two-layer resolution: global Redis override → org subscription entitlements
 * Owned by: Billing team
 */
