/**
 * src/modules/bank-reconciliation/parsers/ofx.parser.ts
 *
 * Parses OFX (Open Financial Exchange) and QFX (Quicken Financial Exchange) files.
 *
 * OFX / QFX are SGML-based (not true XML in v1) formats.
 * They follow a tag structure like:
 *   <STMTTRN>
 *     <TRNTYPE>CREDIT
 *     <DTPOSTED>20250315120000
 *     <TRNAMT>50000.00
 *     <FITID>TXN12345
 *     <MEMO>Client Payment
 *   </STMTTRN>
 *
 * QFX is functionally identical to OFX — we use the same parser for both.
 *
 * Sprint: S3 · Week 7–8
 */

import { BadRequestException } from '@nestjs/common';
import type { ParsedStatement, ParsedTransaction } from '../types/recon.types';

/**
 * Parse an OFX file buffer into a normalised ParsedStatement.
 * Works for both OFX (banks) and QFX (Quicken/Intuit) formats.
 */
export function parseOfxStatement(
  buffer: Buffer,
  bankName: string,
  accountNumber: string,
): ParsedStatement {
  const content = buffer.toString('utf-8');

  if (!content.trim()) {
    throw new BadRequestException('OFX/QFX file is empty');
  }

  // Basic sanity check
  if (!content.includes('STMTTRN') && !content.includes('<OFX>')) {
    throw new BadRequestException(
      'File does not appear to be a valid OFX/QFX statement. Expected STMTTRN blocks.',
    );
  }

  // Extract statement-level fields
  const currency = extractTag(content, 'CURDEF') ?? 'PKR';
  const acctId = extractTag(content, 'ACCTID') ?? accountNumber;
  const bankId = extractTag(content, 'BANKID') ?? bankName;

  // Extract all transaction blocks
  const txnBlocks = extractAllBlocks(content, 'STMTTRN');
  if (txnBlocks.length === 0) {
    throw new BadRequestException('OFX/QFX file contains no transaction records');
  }

  const transactions: ParsedTransaction[] = [];
  let minDate: Date = new Date('9999-12-31');
  let maxDate: Date = new Date('1970-01-01');

  for (const block of txnBlocks) {
    const trnType = extractTag(block, 'TRNTYPE') ?? '';
    const dtPosted = extractTag(block, 'DTPOSTED');
    const amount = parseFloat(extractTag(block, 'TRNAMT') ?? '0');
    const fitid = extractTag(block, 'FITID') ?? null;
    const memo = extractTag(block, 'MEMO') ?? extractTag(block, 'NAME') ?? '';
    const checkNum = extractTag(block, 'CHECKNUM') ?? null;

    if (!dtPosted) continue;

    const date = parseOfxDate(dtPosted);
    if (!date) continue;

    // OFX uses signed amounts: negative = money leaving (debit), positive = money entering
    const debit = amount < 0 ? Math.abs(amount) : 0;
    const credit = amount > 0 ? amount : 0;

    const reference = checkNum ?? fitid;

    transactions.push({
      date,
      description: memo,
      reference,
      debit,
      credit,
      balance: null, // OFX individual transactions don't include running balance
    });

    if (date < minDate) minDate = date;
    if (date > maxDate) maxDate = date;
  }

  if (transactions.length === 0) {
    throw new BadRequestException('No valid transactions could be parsed from OFX/QFX file');
  }

  return {
    bankName: bankId,
    accountNumber: acctId,
    currency,
    periodStart: minDate,
    periodEnd: maxDate,
    transactions,
  };
}

/** QFX is structurally identical to OFX — re-export the same parser */
export const parseQfxStatement = parseOfxStatement;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract the text content of a single OFX tag.
 * Handles both SGML style (<TAG>value) and XML style (<TAG>value</TAG>).
 */
function extractTag(content: string, tag: string): string | null {
  // Try XML-style first: <TAG>value</TAG>
  const xmlRegex = new RegExp(`<${tag}>([^<]+)<\\/${tag}>`, 'i');
  const xmlMatch = content.match(xmlRegex);
  if (xmlMatch) return xmlMatch[1]?.trim() ?? null;

  // Try SGML-style: <TAG>value (ends at newline or next tag)
  const sgmlRegex = new RegExp(`<${tag}>([^\r\n<]+)`, 'i');
  const sgmlMatch = content.match(sgmlRegex);
  if (sgmlMatch) return sgmlMatch[1]?.trim() ?? null;

  return null;
}

/** Extract all content blocks between <TAG> ... </TAG> */
function extractAllBlocks(content: string, tag: string): string[] {
  const blocks: string[] = [];

  // Try XML-style blocks first
  const xmlRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = xmlRegex.exec(content)) !== null) {
    if (match[1]) blocks.push(match[1]);
  }

  if (blocks.length > 0) return blocks;

  // SGML-style: <TAG> until </${TAG}> or next <TAG>
  const sgmlRegex = new RegExp(`<${tag}>[\\s\\S]*?(?=<${tag}>|$)`, 'gi');

  while ((match = sgmlRegex.exec(content)) !== null) {
    blocks.push(match[0]);
  }

  return blocks;
}

/**
 * Parse OFX date format: YYYYMMDDHHMMSS or YYYYMMDD
 * OFX dates may include timezone: 20250315120000[+05:30:PKT]
 */
function parseOfxDate(raw: string): Date | null {
  // Strip timezone bracket and everything after the 8-digit date
  const cleaned = raw
    .trim()
    .replace(/\[.*\]/, '')
    .substring(0, 8);

  if (!/^\d{8}$/.test(cleaned)) return null;

  const year = parseInt(cleaned.substring(0, 4), 10);
  const month = parseInt(cleaned.substring(4, 6), 10) - 1; // 0-indexed
  const day = parseInt(cleaned.substring(6, 8), 10);

  const d = new Date(Date.UTC(year, month, day));
  return isNaN(d.getTime()) ? null : d;
}

/*
 * Sprint S3 · OFX/QFX Parser · Week 7–8
 * Handles: SGML (OFX v1) and XML (OFX v2) formats
 * QFX is a Quicken-branded OFX — same structure, same parser
 * Owned by: Recon team
 */
