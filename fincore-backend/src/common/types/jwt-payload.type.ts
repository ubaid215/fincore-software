// src/common/types/jwt-payload.type.ts
//
// Embeds all guard-relevant claims in the token (zero DB hits on hot path).
// Access tokens are RS256-signed, 15-min TTL.
// isSuperAdmin: CEO/platform-owner flag — bypasses ALL restrictions in every guard.

import { UserRole, UserStatus } from '@prisma/client';

// ─── Core payload — embedded in every access token ───────────────────────────
export interface JwtPayload {
  sub: string;           // User.id
  email: string;
  status: UserStatus;    // ACTIVE | UNVERIFIED | SUSPENDED | DELETED
  isSuperAdmin: boolean; // CEO account — bypasses plan/role/app restrictions
  iat?: number;
  exp?: number;
}

// ─── Org-scoped payload — issued after org context is established ─────────────
export interface OrgJwtPayload extends JwtPayload {
  orgId: string;         // Organization.id the token is scoped to
  role: UserRole;        // membership role in that org
  plan: string;          // Plan.name: "FREE" | "STARTER" | "PRO" | "ENTERPRISE"
  apps: string[];        // enabled app keys that are BOTH org-toggled AND plan-allowed
  mfaVerified: boolean;  // true = user passed TOTP at login for this session
}

// ─── Type guard helpers ───────────────────────────────────────────────────────
export function isOrgPayload(p: JwtPayload | OrgJwtPayload): p is OrgJwtPayload {
  return 'orgId' in p && 'role' in p;
}

// ─── Augment Express Request ──────────────────────────────────────────────────
declare module 'express' {
  interface Request {
    user?: JwtPayload | OrgJwtPayload;
  }
}
