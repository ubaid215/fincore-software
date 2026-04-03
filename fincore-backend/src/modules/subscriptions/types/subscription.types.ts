/**
 * src/modules/subscriptions/types/subscription.types.ts
 *
 * Shared TypeScript interfaces and constants for the Subscriptions domain.
 *
 * State machine:
 *   TRIALING  → ACTIVE | SUSPENDED | CANCELED
 *   ACTIVE    → PAST_DUE | SUSPENDED | CANCELED
 *   PAST_DUE  → ACTIVE (payment received) | SUSPENDED (auto-cron after grace period)
 *   SUSPENDED → ACTIVE (payment received) | CANCELED
 *   CANCELED  → (terminal)
 *
 * Sprint: S4 · Week 9–10
 */

import type { SubscriptionStatus } from '@prisma/client';

// ─── State machine ─────────────────────────────────────────────────────────

export const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionStatus, SubscriptionStatus[]>> =
  {
    TRIALING: ['ACTIVE', 'SUSPENDED', 'CANCELED'],
    ACTIVE: ['PAST_DUE', 'SUSPENDED', 'CANCELED'],
    PAST_DUE: ['ACTIVE', 'SUSPENDED'],
    SUSPENDED: ['ACTIVE', 'CANCELED'],
    CANCELED: [],
  } as const;

// ─── Grace period for PAST_DUE before auto-suspension ─────────────────────
/** Days after currentPeriodEnd before auto-suspension runs */
export const PAST_DUE_GRACE_DAYS = 7;

/** Days after currentPeriodEnd before a TRIALING org is auto-suspended */
export const TRIAL_GRACE_DAYS = 0;

// ─── Entitlement cache ─────────────────────────────────────────────────────

/** Redis key for an org's feature entitlements */
export const entitlementCacheKey = (organizationId: string): string =>
  `entitlements:${organizationId}`;

/** Redis key for an org's seat count cache */
export const seatCacheKey = (organizationId: string): string => `seats:${organizationId}`;

/** TTL for entitlement cache entries (seconds) */
export const ENTITLEMENT_TTL_SECS = 60;

// ─── Plan feature keys (sync with features.constants.ts) ──────────────────

export type PlanFeatureKey =
  | 'invoicing'
  | 'expenses'
  | 'bank_reconciliation'
  | 'financial_reports'
  | 'multi_currency'
  | 'api_access'
  | 'priority_support'
  | 'custom_branding';

// ─── Service return shapes ────────────────────────────────────────────────

export interface SubscriptionWithPlan {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  seatCount: number;
  createdAt: Date;
  updatedAt: Date;
  plan: {
    id: string;
    name: string;
    displayName: string;
    priceMonthly: object; // Prisma Decimal
    currency: string;
    maxSeats: number;
    features: unknown; // JSON — cast to string[] in service
    isActive: boolean;
  };
}

export interface SeatCheckResult {
  currentCount: number;
  maxSeats: number;
  available: number;
  hasCapacity: boolean;
}

export interface SuspensionResult {
  suspended: boolean;
  organizationId: string;
  reason: SuspensionReason;
  suspendedAt: Date;
}

export type SuspensionReason =
  | 'PAST_DUE'
  | 'TRIAL_EXPIRED'
  | 'MANUAL'
  | 'GRACE_PERIOD_EXPIRED';

export interface AutoSuspensionSummary {
  checkedAt: Date;
  suspended: number;
  organizations: Array<{ orgId: string; reason: SuspensionReason }>;
}

/*
 * Sprint S4 · Subscriptions & Feature Flags · Week 9–10
 * Owned by: Billing team
 */
