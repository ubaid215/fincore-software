/**
 * src/modules/feature-flags/types/feature-flags.types.ts
 *
 * FIX 10: SUBSCRIPTION_TRANSITIONS removed — single source of truth is
 *         now subscription.types.ts. Import from there.
 * FIX 9:  FeatureKey is now AppKey enum (not old lowercase strings)
 */

import type { SubscriptionStatus } from '@prisma/client';
import type { AppKey } from '@prisma/client';

// Re-export canonical state machine — DO NOT duplicate
export { SUBSCRIPTION_TRANSITIONS } from '../../subscriptions/types/subscription.types';

// ─── Entitlement cache shape (stored in Redis) ─────────────────────────────
export interface EntitlementCache {
  readonly features: string[]; // AppKey values e.g. ["INVOICING","EXPENSES"]
  readonly status: SubscriptionStatus;
  readonly maxSeats: number; // -1 = unlimited
  readonly planName: string;
  readonly cachedAt: number; // epoch ms
}

// ─── Feature check result ─────────────────────────────────────────────────
export interface FeatureCheckResult {
  readonly organizationId: string;
  readonly feature: AppKey;
  readonly allowed: boolean;
  readonly reason:
    | 'FEATURE_ENABLED'
    | 'NO_SUBSCRIPTION'
    | 'SUSPENDED'
    | 'PAST_DUE'
    | 'FEATURE_NOT_IN_PLAN'
    | 'APP_NOT_ENABLED';
}
