/**
 * src/modules/expenses/types/expense.types.ts
 *
 * Shared TypeScript interfaces for the Expense Management domain.
 * Every type used across DTOs, services, and tests is defined here once.
 *
 * Approval state machine:
 *   DRAFT → SUBMITTED → MANAGER_APPROVED → FINANCE_APPROVED → POSTED
 *                    ↘ REJECTED (available at SUBMITTED, MANAGER_APPROVED, FINANCE_APPROVED)
 *
 * Sprint: S3 · Week 7–8
 */

import type { ExpenseStatus } from '@prisma/client';

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Allowed transitions for each status.
 * Read as: from status X → the listed statuses are reachable.
 * REJECTED and POSTED are terminal states.
 */
export const EXPENSE_TRANSITIONS: Readonly<Record<ExpenseStatus, readonly ExpenseStatus[]>> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['MANAGER_APPROVED', 'REJECTED'],
  MANAGER_APPROVED: ['FINANCE_APPROVED', 'REJECTED'],
  FINANCE_APPROVED: ['POSTED', 'REJECTED'],
  POSTED: [],
  REJECTED: [],
} as const;

/** Who can approve at each step */
export const APPROVAL_ROLES: Readonly<Record<ExpenseStatus, string>> = {
  DRAFT: 'claimant',
  SUBMITTED: 'manager',
  MANAGER_APPROVED: 'finance',
  FINANCE_APPROVED: 'system', // auto-posted after finance approval
  POSTED: 'none',
  REJECTED: 'none',
} as const;

// ─── Expense line ─────────────────────────────────────────────────────────────

/** A single line item on an expense claim */
export interface ExpenseLineData {
  readonly accountId: string;
  readonly description: string;
  readonly amount: string; // Decimal string (DECIMAL 19,4)
  readonly category: string;
}

export interface ComputedExpenseLine {
  readonly accountId: string;
  readonly description: string;
  readonly amount: string; // rounded Decimal string
  readonly category: string;
}
// ─── Receipt upload ───────────────────────────────────────────────────────────

/** Metadata for a receipt file before S3 upload */
export interface ReceiptFileInput {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}

/** Result of a successful S3 presigned URL generation */
export interface PresignedUploadResult {
  readonly uploadUrl: string; // PUT this URL with the file binary
  readonly s3Key: string; // store this; used later to confirm upload
  readonly expiresIn: number; // seconds until the URL expires
  readonly receiptId: string; // DB record UUID — confirm after upload
}

// ─── Expense with full relations (service return shape) ───────────────────────

export interface ExpenseWithRelations {
  id: string;
  organizationId: string;
  claimantId: string;
  approverId: string | null;
  title: string;
  description: string | null;
  totalAmount: object; // Prisma Decimal — serialises to string
  currency: string;
  status: ExpenseStatus;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionNote: string | null;
  postedToGLAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lines: ExpenseLineRecord[];
  receipts: ReceiptRecord[];
}

export interface ExpenseLineRecord {
  id: string;
  expenseId: string;
  accountId: string;
  description: string;
  amount: object;
  category: string;
}

export interface ReceiptRecord {
  id: string;
  expenseId: string;
  fileName: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

/*
 * Sprint S3 · Expense Management · Week 7–8
 * Owned by: Expense team
 */
