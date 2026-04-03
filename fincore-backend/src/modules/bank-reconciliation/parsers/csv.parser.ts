/**
 * src/modules/bank-reconciliation/parsers/csv.parser.ts
 *
 * Parses bank statement CSV files into a normalised ParsedStatement.
 *
 * Supported column layouts (auto-detected):
 *   Layout A: Date, Description, Debit, Credit, Balance
 *   Layout B: Date, Description, Reference, Amount, Balance  (negative = debit)
 *   Layout C: Date, Narration, Withdrawal, Deposit, Balance  (HBL/MCB style)
 *
 * Sprint: S3 · Week 7–8
 */

import { BadRequestException } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import type { ParsedStatement, ParsedTransaction } from '../types/recon.types';

// All recognised column name variants — case-insensitive
const DATE_COLS = ['date', 'transaction date', 'txn date', 'value date'];
const DESC_COLS = ['description', 'narration', 'particulars', 'details', 'memo'];
const REF_COLS = ['reference', 'ref', 'cheque no', 'cheque number', 'txn id'];
const DEBIT_COLS = ['debit', 'withdrawal', 'dr', 'charge', 'payment'];
const CREDIT_COLS = ['credit', 'deposit', 'cr', 'receipt'];
const AMOUNT_COLS = ['amount', 'net amount'];
const BALANCE_COLS = ['balance', 'running balance', 'closing balance'];

export function parseCsvStatement(
  buffer: Buffer,
  bankName: string,
  accountNumber: string,
  currency: string = 'PKR',
): ParsedStatement {
  const content = buffer.toString('utf-8').trim();

  if (!content) {
    throw new BadRequestException('CSV file is empty');
  }

  // Parse raw CSV — handles quoted fields, various delimiters
  let records: Record<string, string>[];
  try {
    records = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err: unknown) {
    throw new BadRequestException(
      `Failed to parse CSV: ${err instanceof Error ? err.message : 'Invalid format'}`,
    );
  }

  if (records.length === 0) {
    throw new BadRequestException('CSV contains no data rows');
  }

  // Normalise column names to lowercase for lookup
  const cols = Object.keys(records[0]).map((k) => k.toLowerCase().trim());

  const findCol = (variants: string[]): string | null =>
    variants.find((v) => cols.includes(v)) ?? null;

  const dateCol = findCol(DATE_COLS);
  const descCol = findCol(DESC_COLS);
  const refCol = findCol(REF_COLS);
  const debitCol = findCol(DEBIT_COLS);
  const creditCol = findCol(CREDIT_COLS);
  const amountCol = findCol(AMOUNT_COLS);
  const balanceCol = findCol(BALANCE_COLS);

  if (!dateCol || !descCol) {
    throw new BadRequestException(
      `CSV missing required columns. Need at minimum: date + description. ` +
        `Found: [${cols.join(', ')}]`,
    );
  }
  if (!debitCol && !creditCol && !amountCol) {
    throw new BadRequestException(
      'CSV missing amount column. Expected one of: Debit/Credit, Withdrawal/Deposit, or Amount.',
    );
  }

  const transactions: ParsedTransaction[] = [];
  let minDate: Date = new Date('9999-12-31');
  let maxDate: Date = new Date('1970-01-01');

  for (let i = 0; i < records.length; i++) {
    const rawRow = records[i];

    // Normalise keys to lowercase for consistent access
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      row[k.toLowerCase().trim()] = (v ?? '').trim();
    }

    const rawDate = row[dateCol] ?? '';
    if (!rawDate) continue; // skip blank rows

    const date = parseDate(rawDate);
    if (!date) {
      throw new BadRequestException(
        `Row ${i + 2}: cannot parse date '${rawDate}'. Expected YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY.`,
      );
    }

    let debit = 0;
    let credit = 0;

    if (debitCol && creditCol) {
      debit = parseAmount(row[debitCol] ?? '0');
      credit = parseAmount(row[creditCol] ?? '0');
    } else if (amountCol) {
      // Signed amount: negative = debit, positive = credit
      const amt = parseAmount(row[amountCol] ?? '0');
      if (amt < 0) debit = Math.abs(amt);
      else credit = amt;
    }

    const balance = balanceCol ? parseAmount(row[balanceCol] ?? '') : null;
    const ref = refCol ? row[refCol] || null : null;
    const desc = row[descCol] ?? '';

    transactions.push({ date, description: desc, reference: ref, debit, credit, balance });

    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;
  }

  if (transactions.length === 0) {
    throw new BadRequestException('No valid transactions found in CSV');
  }

  return {
    bankName,
    accountNumber,
    currency,
    periodStart: minDate,
    periodEnd: maxDate,
    transactions,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseDate(raw: string): Date | null {
  const cleaned = raw.trim();
  // Try ISO first: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const d = new Date(cleaned + 'T00:00:00Z');
    return isNaN(d.getTime()) ? null : d;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const parts = cleaned.split(/[/\\-]/);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts.map(Number);
    // Assume DD/MM/YYYY if first number <= 31
    if (p1 !== undefined && p2 !== undefined && p3 !== undefined) {
      if (p1 <= 31 && p2 <= 12 && p3 > 31) {
        const d = new Date(Date.UTC(p3, p2 - 1, p1));
        return isNaN(d.getTime()) ? null : d;
      }
      // MM/DD/YYYY
      if (p1 <= 12 && p2 <= 31 && p3 > 31) {
        const d = new Date(Date.UTC(p3, p1 - 1, p2));
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }
  return null;
}

function parseAmount(raw: string): number {
  if (!raw || raw === '' || raw === '-') return 0;
  // Remove commas, parentheses (accountancy negatives), currency symbols
  const cleaned = raw.replace(/[,\s\u20a8$€£]/g, '').replace(/\((\d+\.?\d*)\)/, '-$1');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/*
 * Sprint S3 · CSV Parser · Week 7–8
 * Handles: HBL/MCB/UBL/ABL standard export formats
 * Owned by: Recon team
 */
