/**
 * src/modules/feature-flags/services/feature-flags.service.ts
 *
 * FIXES:
 *  11. checkAccess now delegates to subscriptionsService.checkFeatureAccess
 *      which checks BOTH OrgAppAccess AND Plan.features[] (aligned with new arch)
 *  12. FEATURES values are now AppKey enum (uppercase "INVOICING" not "invoicing")
 *
 * Two-layer flag resolution:
 *   Layer 1: Global Redis override  (kill-switch, set by super-admin)
 *   Layer 2: Org entitlement check  (OrgAppAccess + Plan.features via SubscriptionsService)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { FEATURES } from '../../../common/constants/features.constants';
import type { AppKey } from '@prisma/client';

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

  /**
   * FIX 11 & 12: featureKey is an AppKey value e.g. "INVOICING"
   * Resolution order:
   *   1. Global Redis override (kill-switch)
   *   2. OrgAppAccess + Plan.features via SubscriptionsService
   */
  async checkAccess(organizationId: string, featureKey: string): Promise<FeatureFlagStatus> {
    // Layer 1: Global override
    try {
      const globalVal = await this.redis.get(`${GLOBAL_FLAG_PREFIX}${featureKey}`);
      if (globalVal !== null) {
        const globalOverride = globalVal === 'true';
        return {
          featureKey,
          hasAccess: globalOverride,
          source: 'global_override',
          globalOverride,
        };
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis unavailable for global flag: ${(err as Error).message}`);
    }

    // Layer 2: Org entitlement (OrgAppAccess + Plan)
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

    const needsCheck: string[] = [];
    featureKeys.forEach((key, i) => {
      const [, value] = globalResults[i] ?? [null, null];
      if (value !== null) {
        results[key] = value === 'true';
      } else {
        needsCheck.push(key);
      }
    });

    for (const key of needsCheck) {
      try {
        results[key] = await this.subscriptionsService.checkFeatureAccess(organizationId, key);
      } catch {
        results[key] = false;
      }
    }

    return results;
  }

  // ── Global override management (super-admin only) ─────────────────────────

  async setGlobalOverride(featureKey: string, enabled: boolean): Promise<void> {
    await this.redis.setex(
      `${GLOBAL_FLAG_PREFIX}${featureKey}`,
      GLOBAL_FLAG_TTL,
      enabled ? 'true' : 'false',
    );
    this.logger.warn(`Global flag SET: ${featureKey} = ${enabled} (TTL: ${GLOBAL_FLAG_TTL}s)`);
  }

  async removeGlobalOverride(featureKey: string): Promise<void> {
    await this.redis.del(`${GLOBAL_FLAG_PREFIX}${featureKey}`);
    this.logger.log(`Global flag REMOVED: ${featureKey}`);
  }

  async getAllGlobalOverrides(): Promise<Record<string, boolean | null>> {
    const result = {} as Record<string, boolean | null>;
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
