/**
 * src/modules/feature-flags/types/feature-flags.types.ts
 *
 * Shared TypeScript interfaces for Feature Flags + Subscription domains.
 *
 * Feature flags are stored in Redis as a JSON array of feature key strings.
 * The source of truth is the Plan.features JSON column.
 * Redis is the hot cache (TTL = 60 s) that every HTTP request reads from.
 *
 * Sprint: S4 · Week 9–10
 */

import type { SubscriptionStatus } from '@prisma/client';
import type { FeatureKey } from '../../../common/constants/features.constants';

// ─── Entitlement cache ─────────────────────────────────────────────────────

export interface EntitlementCache {
  readonly features: FeatureKey[];
  readonly status: SubscriptionStatus;
  readonly maxSeats: number;
  readonly planName: string;
  readonly cachedAt: number; // epoch ms — for observability
}

// ─── Feature check result ──────────────────────────────────────────────────

export interface FeatureCheckResult {
  readonly organizationId: string;
  readonly feature: FeatureKey;
  readonly allowed: boolean;
  readonly reason:
    | 'FEATURE_ENABLED'
    | 'NO_SUBSCRIPTION'
    | 'SUSPENDED'
    | 'PAST_DUE'
    | 'FEATURE_NOT_IN_PLAN';
}

// ─── Subscription state machine ───────────────────────────────────────────

/**
 * Allowed status transitions for a Subscription.
 *
 * TRIALING  → ACTIVE (payment confirmed)
 * TRIALING  → SUSPENDED (trial expired, no payment)
 * ACTIVE    → PAST_DUE (payment failed)
 * ACTIVE    → CANCELED (user cancels)
 * PAST_DUE  → ACTIVE (payment recovered)
 * PAST_DUE  → SUSPENDED (grace period expired)
 * SUSPENDED → ACTIVE (payment made, admin re-activates)
 * SUSPENDED → CANCELED (admin cancels)
 * CANCELED  → (terminal)
 */
export const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionStatus, SubscriptionStatus[]>> =
  {
    TRIALING: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
    ACTIVE: ['PAST_DUE', 'CANCELED'],
    PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
    SUSPENDED: ['ACTIVE', 'CANCELED'],
    CANCELED: [],
  } as const;

// ─── Plan upgrade / downgrade ──────────────────────────────────────────────

export interface PlanChangeRequest {
  readonly organizationId: string;
  readonly newPlanId: string;
  readonly reason?: string;
}

// ─── Seat check ────────────────────────────────────────────────────────────

export interface SeatCheckResult {
  readonly currentCount: number;
  readonly maxSeats: number;
  readonly available: number;
  readonly atLimit: boolean;
}

// ─── Suspension reason ─────────────────────────────────────────────────────

export type SuspensionReason =
  | 'TRIAL_EXPIRED'
  | 'PAYMENT_FAILED'
  | 'GRACE_PERIOD_EXPIRED'
  | 'MANUAL';

/*
 * Sprint S4 · Feature Flags & Subscriptions · Week 9–10
 * Owned by: Billing team
 */
