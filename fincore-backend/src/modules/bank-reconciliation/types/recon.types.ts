/**
 * src/modules/bank-reconciliation/types/recon.types.ts
 *
 * Shared TypeScript interfaces for the Bank Reconciliation domain.
 *
 * Sprint: S3 · Week 7–8
 */

import type { MatchStatus } from '@prisma/client';

// ─── Parsed bank transaction ───────────────────────────────────────────────

/** A single transaction row parsed from CSV / OFX / QFX */
export interface ParsedTransaction {
  date: Date;
  description: string;
  reference: string | null;
  debit: number; // amount of money leaving the account
  credit: number; // amount of money entering the account
  balance: number | null; // running balance (may not be in all formats)
}

/** Statement-level metadata extracted from the file */
export interface ParsedStatement {
  bankName: string;
  accountNumber: string;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  transactions: ParsedTransaction[];
}

// ─── Supported formats ─────────────────────────────────────────────────────

export type StatementFormat = 'CSV' | 'OFX' | 'QFX';

// ─── Auto-match result ─────────────────────────────────────────────────────

export type MatchConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Result of running AutoMatchService.matchTransaction() against one bank tx */
export interface MatchResult {
  bankTransactionId: string;
  journalEntryId: string;
  confidence: MatchConfidence;
  amountDelta: number; // abs(bankAmount - glAmount)
  dateDelta: number; // abs days difference
  refSimilarity: number; // 0–1 Levenshtein similarity of reference strings
}

/** Summary returned after running auto-match on a full statement */
export interface AutoMatchSummary {
  statementId: string;
  total: number;
  autoMatched: number;
  unmatched: number;
  excluded: number;
  results: MatchResult[];
}

// ─── Manual match request ─────────────────────────────────────────────────

export interface ManualMatchRequest {
  bankTransactionId: string;
  journalEntryId: string;
}

// ─── Statement upload context ─────────────────────────────────────────────

export interface StatementUploadContext {
  organizationId: string;
  bankName: string;
  accountNumber: string;
  format: StatementFormat;
  fileBuffer: Buffer;
  s3Key: string;
}

// ─── DB transaction row (returned from queries) ───────────────────────────

export interface BankTransactionRow {
  id: string;
  statementId: string;
  date: Date;
  description: string;
  reference: string | null;
  debit: object; // Prisma Decimal
  credit: object;
  balance: object | null;
  matchStatus: MatchStatus;
  matchedEntryId: string | null;
  matchConfidence: string | null;
  createdAt: Date;
}

/*
 * Sprint S3 · Bank Reconciliation Types · Week 7–8
 * Owned by: Recon team
 */
