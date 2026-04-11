// src/common/types/jwt-payload.type.ts
//
// FIX (was): { sub, email } only — forced every guard to do a DB roundtrip
//            on every single request just to get role/org/plan.
//
// NOW: Embed role, orgId, plan, status in the access token (15-min TTL).
//      Guards read these claims directly from the token — zero DB hits
//      on the hot path. On role/plan change the old token expires in ≤15 min
//      and the next refresh issues a fresh payload — acceptable window.
//
// SECURITY: Access tokens are RS256-signed and short-lived (15 min).
//           Refresh tokens are stored hashed in DB and rotated on every use.

import { UserRole, UserStatus } from '@prisma/client';

// ─── Core payload — embedded in every access token ───────────────────────────
export interface JwtPayload {
  sub: string;          // User.id
  email: string;
  status: UserStatus;   // ACTIVE | UNVERIFIED | SUSPENDED | DELETED
  iat?: number;
  exp?: number;
}

// ─── Org-scoped payload — issued after org context is established ─────────────
// This is a SEPARATE short-lived token issued when the user selects an org.
// It carries role and plan so RolesGuard and FeatureFlagGuard need no DB hit.
export interface OrgJwtPayload extends JwtPayload {
  orgId: string;        // Organization.id the token is scoped to
  role: UserRole;       // membership role in that org
  plan: string;         // Plan.name: "FREE" | "STARTER" | "PRO" | "ENTERPRISE"
  apps: string[];       // OrgAppAccess enabled app keys e.g. ["INVOICING","CONTACTS"]
}

// ─── Type guard helpers ───────────────────────────────────────────────────────
export function isOrgPayload(p: JwtPayload | OrgJwtPayload): p is OrgJwtPayload {
  return 'orgId' in p && 'role' in p;
}

// ─── Augment Express Request ──────────────────────────────────────────────────
// Allows request.user to be typed without casting everywhere.
declare module 'express' {
  interface Request {
    user?: JwtPayload | OrgJwtPayload;
  }
}