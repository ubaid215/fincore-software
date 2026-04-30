// src/types/auth.ts

// ── API response shapes ───────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
}

export interface OrgTokenResponse {
  accessToken: string;
}

export interface RegisterResponse {
  message: string;
  userId:  string;
}

export interface MfaRequiredResponse {
  requiresMfa: true;
  userId:      string;
}

export type LoginResponse = TokenPair | MfaRequiredResponse;

export function isMfaRequired(r: LoginResponse): r is MfaRequiredResponse {
  return 'requiresMfa' in r && r.requiresMfa === true;
}

// ── User ─────────────────────────────────────────────────────────────────────

export type UserStatus = 'UNVERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface User {
  id:              string;
  email:           string;
  firstName:       string;
  lastName:        string;
  phone?:          string;
  avatarUrl?:      string;
  status:          UserStatus;
  mfaEnabled:      boolean;
  emailVerifiedAt: string | null;
  lastLoginAt:     string | null;
  createdAt:       string;
  googleId?:       string;        // non-null = Google linked
}

// ── Organization / membership ─────────────────────────────────────────────────

export type UserRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'MANAGER' | 'VIEWER' | 'CLIENT';
export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';

export interface OrgMembership {
  role:      UserRole;
  isDefault: boolean;
  joinedAt:  string;
  organization: {
    id:      string;
    name:    string;
    slug:    string;
    status:  OrgStatus;
    logoUrl: string | null;
    subscription: {
      plan: { name: string; displayName: string } | null;
    } | null;
    appAccess: { app: string }[];
  };
}

// ── JWT payload shapes (decoded) ──────────────────────────────────────────────

export interface JwtPayload {
  sub:         string;
  email:       string;
  status:      UserStatus;
  isSuperAdmin: boolean;   // CEO/platform-owner — bypasses all plan/role/app restrictions
  iat?:        number;
  exp?:        number;
}

export interface OrgJwtPayload extends JwtPayload {
  orgId:       string;
  role:        UserRole;
  plan:        string;
  apps:        string[];   // plan-intersected org-enabled apps
  mfaVerified: boolean;
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export type BusinessType =
  | 'SME' | 'FREELANCER' | 'STARTUP'
  | 'CORPORATION' | 'NON_PROFIT' | 'ENTERPRISE';

export type AppKey =
  | 'INVOICING' | 'EXPENSES' | 'PAYROLL' | 'INVENTORY'
  | 'ACCOUNTING' | 'BANK_RECON' | 'CONTACTS' | 'CALENDAR'
  | 'APPOINTMENTS' | 'DOCUMENTS' | 'SIGN' | 'REPORTS';

export interface OnboardOrgPayload {
  businessName:    string;
  businessType:    BusinessType;
  country:         string;
  currency:        string;
  fiscalYearStart: number;
  timezone?:       string;
  taxId?:          string;
  industry?:       string;
  selectedApp?:    AppKey;
}

// ── Auth store shape ──────────────────────────────────────────────────────────

export interface AuthState {
  accessToken:  string | null;
  user:         User | null;
  currentOrgId: string | null;
  orgPayload:   OrgJwtPayload | null;
  memberships:  OrgMembership[];
  isLoading:    boolean;
  isHydrated:   boolean;
}