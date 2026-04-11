/**
 * src/modules/subscriptions/types/subscription.types.ts
 *
 * FIXES:
 *  9.  PlanFeatureKey replaced with AppKey import (was lowercase old strings)
 *  10. Single canonical SUBSCRIPTION_TRANSITIONS — removed duplicate in feature-flags.types.ts
 *      ACTIVE now correctly allows SUSPENDED (manual suspension by admin)
 *
 * State machine:
 *   TRIALING  → ACTIVE | SUSPENDED | CANCELED
 *   ACTIVE    → PAST_DUE | SUSPENDED | CANCELED
 *   PAST_DUE  → ACTIVE | SUSPENDED | CANCELED
 *   SUSPENDED → ACTIVE | CANCELED
 *   CANCELED  → (terminal)
 */

import type { SubscriptionStatus } from '@prisma/client';
import type { AppKey } from '@prisma/client';

// ─── Canonical state machine (single source of truth) ─────────────────────
export const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionStatus, SubscriptionStatus[]>> =
  {
    TRIALING: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
    ACTIVE: ['PAST_DUE', 'SUSPENDED', 'CANCELED'], // FIX 10: SUSPENDED added back
    PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
    SUSPENDED: ['ACTIVE', 'CANCELED'],
    CANCELED: [],
  } as const;

// ─── Grace periods ────────────────────────────────────────────────────────
export const PAST_DUE_GRACE_DAYS = 7;
export const TRIAL_GRACE_DAYS = 0;
export const TRIAL_DURATION_DAYS = 14;

// ─── Redis cache keys ─────────────────────────────────────────────────────
export const entitlementCacheKey = (orgId: string): string => `entitlements:${orgId}`;
export const seatCacheKey = (orgId: string): string => `seats:${orgId}`;
export const ENTITLEMENT_TTL_SECS = 60;

// ─── Service return shapes ────────────────────────────────────────────────
export interface SeatCheckResult {
  currentCount: number;
  maxSeats: number; // -1 = unlimited
  available: number; // -1 = unlimited
  hasCapacity: boolean;
}

export interface SuspensionResult {
  suspended: boolean;
  organizationId: string;
  reason: SuspensionReason;
  suspendedAt: Date;
}

export type SuspensionReason = 'PAST_DUE' | 'TRIAL_EXPIRED' | 'MANUAL' | 'GRACE_PERIOD_EXPIRED';

export interface AutoSuspensionSummary {
  checkedAt: Date;
  suspended: number;
  organizations: Array<{ orgId: string; reason: SuspensionReason }>;
}

// ─── Usage limit keys (for UsageRecord enforcement) ──────────────────────
export type UsageLimitKey = 'invoiceCount' | 'userCount' | 'contactCount' | 'storageBytes';
