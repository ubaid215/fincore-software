// src/common/constants/roles.constants.ts
//
// FIX: Added CLIENT role (was missing from original — exists in schema UserRole enum).
//      CLIENT sits below VIEWER in hierarchy — portal-only access.
//
import { UserRole } from '@prisma/client';

/**
 * Numeric hierarchy — higher = more permissions.
 * RolesGuard compares userLevel >= requiredLevel — no DB hit needed
 * because role is now embedded in the JWT payload (OrgJwtPayload).
 *
 *   OWNER(6)  → god-mode, seeded, cannot be removed
 *   ADMIN(5)  → full ops, requires 2FA
 *   ACCOUNTANT(4) → finance ops, no billing
 *   MANAGER(3) → dept-level approvals
 *   VIEWER(2) → read-only
 *   CLIENT(1) → external portal only
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.OWNER]:      6,
  [UserRole.ADMIN]:      5,
  [UserRole.ACCOUNTANT]: 4,
  [UserRole.MANAGER]:    3,
  [UserRole.VIEWER]:     2,
  [UserRole.CLIENT]:     1,
};

/** Roles that can manage members (invite, change roles, remove). */
export const MEMBER_MANAGEMENT_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

/** Roles that can approve financial documents (expenses, purchase orders). */
export const APPROVER_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER];

/** Roles that can post to the General Ledger. */
export const GL_POSTER_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN, UserRole.ACCOUNTANT];

/** Roles that can view financial data (not modify). */
export const READ_ONLY_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.MANAGER,
  UserRole.VIEWER,
];

/** Roles that can manage billing and subscriptions. */
export const BILLING_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

/** Roles that require 2FA to be enabled (enforced at login). */
export const MFA_REQUIRED_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];

/** Roles that have access to API key management. */
export const API_KEY_ROLES: UserRole[] = [UserRole.OWNER, UserRole.ADMIN];