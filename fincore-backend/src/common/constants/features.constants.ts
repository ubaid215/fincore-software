// src/common/constants/features.constants.ts
//
// FIX: Original had lowercase strings that didn't match the AppKey enum
//      in the schema (e.g. 'invoicing' vs 'INVOICING'). Also missing all
//      new apps: CALENDAR, APPOINTMENTS, DOCUMENTS, SIGN, REPORTS.
//      Now aligned 1:1 with the AppKey enum so values can be compared
//      directly against OrgAppAccess.app and Plan.features[] columns.
//
import { AppKey } from '@prisma/client';

/**
 * FEATURES maps a human-readable key to the AppKey enum value.
 * Use these constants everywhere in the codebase instead of raw strings.
 *
 * Plan.features[]      → stores AppKey values (e.g. "INVOICING")
 * OrgAppAccess.app     → stores AppKey values
 * OrgJwtPayload.apps[] → stores AppKey values
 * FeatureFlagGuard     → compares against these values
 */
export const FEATURES = {
  // ── Finance core ───────────────────────────────────────────
  INVOICING:       AppKey.INVOICING,
  EXPENSES:        AppKey.EXPENSES,
  PAYROLL:         AppKey.PAYROLL,
  INVENTORY:       AppKey.INVENTORY,
  ACCOUNTING:      AppKey.ACCOUNTING,
  BANK_RECON:      AppKey.BANK_RECON,
  REPORTS:         AppKey.REPORTS,

  // ── Productivity apps ──────────────────────────────────────
  CONTACTS:        AppKey.CONTACTS,
  CALENDAR:        AppKey.CALENDAR,
  APPOINTMENTS:    AppKey.APPOINTMENTS,
  DOCUMENTS:       AppKey.DOCUMENTS,
  SIGN:            AppKey.SIGN,
} as const satisfies Record<string, AppKey>;

export type FeatureKey = AppKey;

/**
 * Apps included in the FREE plan (1 app of owner's choice from this set).
 * Enforced by PlanLimit.maxApps = 1.
 */
export const FREE_PLAN_ELIGIBLE_APPS: AppKey[] = [
  AppKey.INVOICING,
  AppKey.EXPENSES,
  AppKey.CONTACTS,
  AppKey.CALENDAR,
  AppKey.DOCUMENTS,
];

/**
 * Apps that are always available regardless of plan
 * (e.g. profile, notifications — not billed as "apps").
 */
export const ALWAYS_AVAILABLE: AppKey[] = [];