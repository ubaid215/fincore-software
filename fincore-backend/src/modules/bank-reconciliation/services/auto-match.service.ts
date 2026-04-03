/**
 * src/modules/bank-reconciliation/services/auto-match.service.ts
 *
 * Automatically matches bank transactions against General Ledger journal entries.
 *
 * Matching algorithm (scored, three signals):
 *   1. Amount delta   — |bankAmount - glAmount| <= 0.01 (PKR) → HIGH
 *   2. Date delta     — |bankDate - glDate| <= 3 days          → HIGH if exact, MEDIUM if within 3d
 *   3. Reference similarity — Levenshtein distance <= 2       → HIGH signal
 *
 * Confidence score:
 *   HIGH   — all three signals match
 *   MEDIUM — amount + date match (reference absent or weak)
 *   LOW    — amount matches only (date or ref mismatch — review recommended)
 *
 * Entries already matched (AUTO_MATCHED, MANUALLY_MATCHED, EXCLUDED) are never re-matched.
 *
 * Sprint: S3 · Week 7–8
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { MatchStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { toDecimal } from '../../../common/utils/decimal.util';
import type { MatchResult, AutoMatchSummary, MatchConfidence } from '../types/recon.types';
import DecimalJs from 'decimal.js';

const AMOUNT_TOLERANCE_PKR = new DecimalJs('0.01'); // ±1 paisas
const DATE_WINDOW_DAYS = 3; // bank may settle T+3

@Injectable()
export class AutoMatchService {
  private readonly logger = new Logger(AutoMatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run auto-matching on all UNMATCHED transactions in a statement.
   * Returns a summary of what was matched, not matched, and skipped.
   */
  async matchStatement(statementId: string, organizationId: string): Promise<AutoMatchSummary> {
    // Load all UNMATCHED transactions from this statement
    const unmatchedTxns = await this.prisma.bankTransaction.findMany({
      where: { statementId, matchStatus: MatchStatus.UNMATCHED },
      orderBy: { date: 'asc' },
    });

    if (unmatchedTxns.length === 0) {
      return {
        statementId,
        total: 0,
        autoMatched: 0,
        unmatched: 0,
        excluded: 0,
        results: [],
      };
    }

    // Load candidate GL entries within a reasonable date range
    const dateMin = new Date(unmatchedTxns[0].date);
    const dateMax = new Date(unmatchedTxns[unmatchedTxns.length - 1].date);
    dateMin.setDate(dateMin.getDate() - DATE_WINDOW_DAYS);
    dateMax.setDate(dateMax.getDate() + DATE_WINDOW_DAYS);

    const candidateEntries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: 'POSTED',
        entryDate: { gte: dateMin, lte: dateMax },
      },
      include: { lines: { select: { baseCurrencyDebit: true, baseCurrencyCredit: true } } },
    });

    const results: MatchResult[] = [];
    let autoMatchedCount = 0;

    for (const txn of unmatchedTxns) {
      const txnAmount =
        txn.credit.toString() !== '0'
          ? toDecimal(txn.credit.toString())
          : toDecimal(txn.debit.toString());

      const best = this.findBestMatch(txn, txnAmount, candidateEntries);

      if (best) {
        // Update the bank transaction in DB
        await this.prisma.bankTransaction.update({
          where: { id: txn.id },
          data: {
            matchStatus: MatchStatus.AUTO_MATCHED,
            matchedEntryId: best.journalEntryId,
            matchConfidence: best.confidence,
          },
        });
        results.push(best);
        autoMatchedCount++;
      }
    }

    const total = unmatchedTxns.length;
    const unmatched = total - autoMatchedCount;

    this.logger.log(`AutoMatch on statement ${statementId}: ${autoMatchedCount}/${total} matched`);

    return {
      statementId,
      total,
      autoMatched: autoMatchedCount,
      unmatched,
      excluded: 0,
      results,
    };
  }

  /**
   * Match a single bank transaction against a set of GL entries.
   * Returns the best match if confidence is >= MEDIUM, otherwise null.
   */
  findBestMatch(
    txn: {
      id: string;
      date: Date;
      reference: string | null;
      debit: Prisma.Decimal;
      credit: Prisma.Decimal;
    },
    txnAmount: DecimalJs,
    candidates: Array<{
      id: string;
      entryDate: Date;
      entryNumber: string;
      reference: string | null;
      lines: Array<{ baseCurrencyDebit: Prisma.Decimal; baseCurrencyCredit: Prisma.Decimal }>;
    }>,
  ): MatchResult | null {
    let bestResult: MatchResult | null = null;
    let bestScore = -Infinity;

    for (const entry of candidates) {
      // GL total: sum of all debit lines (equals sum of all credit lines in a balanced entry)
      const glTotal = entry.lines.reduce((sum, line) => {
        const debit = line.baseCurrencyDebit;
        const credit = line.baseCurrencyCredit;
        const lineAmt = debit.gt(0) ? debit : credit;
        return sum.plus(lineAmt);
      }, new DecimalJs(0));

      const amountDelta = txnAmount.minus(glTotal).abs();
      if (amountDelta.gt(AMOUNT_TOLERANCE_PKR)) continue; // amount must match

      const dateDelta = Math.abs(
        Math.floor((txn.date.getTime() - entry.entryDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      if (dateDelta > DATE_WINDOW_DAYS) continue; // date must be within window

      // Reference similarity (0–1)
      const refSimilarity = this.computeRefSimilarity(
        txn.reference,
        entry.reference ?? entry.entryNumber,
      );

      const confidence = this.computeConfidence(amountDelta, dateDelta, refSimilarity);
      const score = this.scoreMatch(amountDelta, dateDelta, refSimilarity);

      if (score > bestScore) {
        bestScore = score;
        bestResult = {
          bankTransactionId: txn.id,
          journalEntryId: entry.id,
          confidence,
          amountDelta: amountDelta.toNumber(),
          dateDelta,
          refSimilarity,
        };
      }
    }

    // Only accept HIGH or MEDIUM confidence matches automatically
    if (bestResult && bestResult.confidence === 'LOW') return null;
    return bestResult;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private computeConfidence(
    amountDelta: DecimalJs,
    dateDelta: number,
    refSimilarity: number,
  ): MatchConfidence {
    const amountExact = amountDelta.lte('0.001');
    const dateExact = dateDelta === 0;
    const refGood = refSimilarity >= 0.8;

    if (amountExact && dateExact && refGood) return 'HIGH';
    if (amountExact && dateDelta <= 1) return 'HIGH';
    if (amountExact && dateDelta <= 3) return 'MEDIUM';
    return 'LOW';
  }

  private scoreMatch(amountDelta: DecimalJs, dateDelta: number, refSimilarity: number): number {
    // Weighted score: amount match is most important (50%), date (30%), ref (20%)
    const amountScore = Math.max(0, 1 - amountDelta.toNumber() * 100); // 0–1
    const dateScore = Math.max(0, 1 - dateDelta / DATE_WINDOW_DAYS); // 0–1
    return amountScore * 0.5 + dateScore * 0.3 + refSimilarity * 0.2;
  }

  /**
   * Compute string similarity using Levenshtein distance.
   * Returns 0–1 where 1 = identical strings.
   * Returns 0 if either string is null/empty.
   */
  computeRefSimilarity(a: string | null, b: string | null): number {
    if (!a || !b) return 0;
    const s1 = a.toLowerCase().replace(/\s+/g, '');
    const s2 = b.toLowerCase().replace(/\s+/g, '');
    if (s1 === s2) return 1;

    const dist = this.levenshtein(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1;

    return Math.max(0, 1 - dist / maxLen);
  }

  /**
   * Standard Levenshtein distance.
   * O(m×n) time, O(min(m,n)) space.
   */
  levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Ensure a is the shorter string for space efficiency
    if (a.length > b.length) [a, b] = [b, a];

    let prev = Array.from({ length: a.length + 1 }, (_, i) => i);

    for (let j = 1; j <= b.length; j++) {
      const curr = [j];
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[i] = Math.min(
          (prev[i] ?? 0) + 1, // deletion
          (curr[i - 1] ?? 0) + 1, // insertion
          (prev[i - 1] ?? 0) + cost, // substitution
        );
      }
      prev = curr;
    }

    return prev[a.length] ?? a.length;
  }
}

/*
 * Sprint S3 · AutoMatchService · Week 7–8
 * Algorithm: amount ±0.01, date ±3 days, Levenshtein ref similarity
 * Confidence: HIGH (exact amount + date ≤ 1d) | MEDIUM (exact amount + date ≤ 3d) | LOW
 * LOW confidence matches are NOT auto-applied — require manual review
 */
