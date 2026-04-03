/**
 * src/modules/bank-reconciliation/tests/csv-parser.spec.ts
 *
 * Unit tests for CSV and OFX/QFX parsers — pure functions, no mocks needed.
 * Tests real parsing with realistic bank statement content.
 *
 * Sprint: S3 · Week 7–8
 */

import { parseCsvStatement } from '../parsers/csv.parser';
import { parseOfxStatement, parseQfxStatement } from '../parsers/ofx.parser';
import { BadRequestException } from '@nestjs/common';

// ─── CSV Parser tests ──────────────────────────────────────────────────────

describe('parseCsvStatement()', () => {
  // Layout A: Date, Description, Debit, Credit, Balance
  const layoutA = Buffer.from(
    `Date,Description,Debit,Credit,Balance\n` +
      `2025-03-01,Opening Balance,0,100000,100000\n` +
      `2025-03-05,Client Payment ACME,0,50000,150000\n` +
      `2025-03-10,Office Rent,35000,0,115000\n` +
      `2025-03-15,Utility Bill,5000,0,110000\n`,
    'utf-8',
  );

  it('parses Layout A (Date/Description/Debit/Credit/Balance) correctly', () => {
    const result = parseCsvStatement(layoutA, 'HBL', '1234567890');

    expect(result.transactions).toHaveLength(4);
    expect(result.bankName).toBe('HBL');
    expect(result.accountNumber).toBe('1234567890');
  });

  it('extracts debit and credit amounts correctly from Layout A', () => {
    const result = parseCsvStatement(layoutA, 'HBL', '1234567890');
    const rent = result.transactions[2]; // Office Rent row

    expect(rent.description).toBe('Office Rent');
    expect(rent.debit).toBe(35000);
    expect(rent.credit).toBe(0);
    expect(rent.balance).toBe(115000);
  });

  it('extracts credit amount correctly', () => {
    const result = parseCsvStatement(layoutA, 'HBL', '1234567890');
    const payment = result.transactions[1];

    expect(payment.credit).toBe(50000);
    expect(payment.debit).toBe(0);
  });

  it('sets periodStart and periodEnd from min/max dates', () => {
    const result = parseCsvStatement(layoutA, 'HBL', '1234567890');

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2025-03-01');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2025-03-15');
  });

  // Layout C: HBL/MCB style (Narration, Withdrawal, Deposit)
  const layoutC = Buffer.from(
    `Date,Narration,Cheque No,Withdrawal,Deposit,Balance\n` +
      `01/03/2025,Opening Balance,,0,100000,100000\n` +
      `05/03/2025,ACME PAYMENT,CHQ-001,0,50000,150000\n` +
      `10/03/2025,RENT PAYMENT,CHQ-002,35000,0,115000\n`,
    'utf-8',
  );

  it('parses Layout C (HBL/MCB Narration/Withdrawal/Deposit style)', () => {
    const result = parseCsvStatement(layoutC, 'MCB', '9876543210');

    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[1].description).toBe('ACME PAYMENT');
    expect(result.transactions[1].credit).toBe(50000);
    expect(result.transactions[1].reference).toBe('CHQ-001');
  });

  it('parses DD/MM/YYYY dates correctly', () => {
    const result = parseCsvStatement(layoutC, 'MCB', '9876543210');
    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2025-03-01');
  });

  // Signed amount layout
  const layoutSigned = Buffer.from(
    `Date,Description,Amount,Balance\n` +
      `2025-03-01,Deposit,50000,50000\n` +
      `2025-03-05,Withdrawal,-15000,35000\n`,
    'utf-8',
  );

  it('parses signed amount layout (positive=credit, negative=debit)', () => {
    const result = parseCsvStatement(layoutSigned, 'UBL', '1111111111');

    expect(result.transactions[0].credit).toBe(50000);
    expect(result.transactions[0].debit).toBe(0);
    expect(result.transactions[1].debit).toBe(15000);
    expect(result.transactions[1].credit).toBe(0);
  });

  it('handles amounts with commas as thousands separators', () => {
    const csv = Buffer.from(
      `Date,Description,Debit,Credit,Balance\n` + `2025-03-01,Big Payment,0,"1,500,000",1500000\n`,
      'utf-8',
    );
    const result = parseCsvStatement(csv, 'HBL', '1234');
    expect(result.transactions[0].credit).toBe(1500000);
  });

  it('skips completely empty rows without throwing', () => {
    const csv = Buffer.from(
      `Date,Description,Debit,Credit,Balance\n` +
        `2025-03-01,Payment,0,10000,10000\n` +
        `\n` +
        `2025-03-05,Rent,5000,0,5000\n`,
      'utf-8',
    );
    const result = parseCsvStatement(csv, 'HBL', '1234');
    expect(result.transactions).toHaveLength(2);
  });

  // Error cases
  it('throws BadRequestException for empty CSV', () => {
    expect(() => parseCsvStatement(Buffer.from(''), 'HBL', '1234')).toThrow(BadRequestException);
  });

  it('throws BadRequestException when date column is missing', () => {
    const bad = Buffer.from(`Description,Debit,Credit\nPayment,0,100\n`, 'utf-8');
    expect(() => parseCsvStatement(bad, 'HBL', '1234')).toThrow(/missing required columns/i);
  });

  it('throws BadRequestException when no amount columns are found', () => {
    const bad = Buffer.from(`Date,Description\n2025-01-01,Payment\n`, 'utf-8');
    expect(() => parseCsvStatement(bad, 'HBL', '1234')).toThrow(/amount column/i);
  });
});

// ─── OFX / QFX Parser tests ───────────────────────────────────────────────

describe('parseOfxStatement()', () => {
  const validOfxSgml = Buffer.from(
    `OFXHEADER:100\n` +
      `DATA:OFXSGML\n` +
      `<OFX>\n` +
      `<BANKMSGSRSV1>\n` +
      `<STMTTRNRS>\n` +
      `<STMTRS>\n` +
      `<CURDEF>PKR\n` +
      `<BANKACCTFROM>\n` +
      `<BANKID>HBL\n` +
      `<ACCTID>PK00HABB1234\n` +
      `</BANKACCTFROM>\n` +
      `<BANKTRANLIST>\n` +
      `<STMTTRN>\n` +
      `<TRNTYPE>CREDIT\n` +
      `<DTPOSTED>20250305120000\n` +
      `<TRNAMT>50000.00\n` +
      `<FITID>TXN-001\n` +
      `<MEMO>Client Payment ACME Corp\n` +
      `</STMTTRN>\n` +
      `<STMTTRN>\n` +
      `<TRNTYPE>DEBIT\n` +
      `<DTPOSTED>20250310120000\n` +
      `<TRNAMT>-35000.00\n` +
      `<FITID>TXN-002\n` +
      `<MEMO>Office Rent\n` +
      `<CHECKNUM>CHQ-042\n` +
      `</STMTTRN>\n` +
      `</BANKTRANLIST>\n` +
      `</STMTRS>\n` +
      `</STMTTRNRS>\n` +
      `</BANKMSGSRSV1>\n` +
      `</OFX>\n`,
    'utf-8',
  );

  it('parses SGML-style OFX with 2 transactions', () => {
    const result = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');

    expect(result.transactions).toHaveLength(2);
    expect(result.currency).toBe('PKR');
  });

  it('extracts positive TRNAMT as credit', () => {
    const result = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');
    const payment = result.transactions[0];

    expect(payment.credit).toBe(50000);
    expect(payment.debit).toBe(0);
    expect(payment.description).toBe('Client Payment ACME Corp');
  });

  it('extracts negative TRNAMT as debit (absolute value)', () => {
    const result = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const rent = result.transactions[1];

    expect(result.transactions[1].debit).toBe(35000);
    expect(result.transactions[1].credit).toBe(0);
  });

  it('uses CHECKNUM as reference when available, falls back to FITID', () => {
    const result = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');

    // First txn has no CHECKNUM → use FITID
    expect(result.transactions[0].reference).toBe('TXN-001');
    // Second txn has CHECKNUM → use that
    expect(result.transactions[1].reference).toBe('CHQ-042');
  });

  it('parses OFX dates in YYYYMMDDHHMMSS format correctly', () => {
    const result = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');

    expect(result.transactions[0].date.toISOString().slice(0, 10)).toBe('2025-03-05');
    expect(result.transactions[1].date.toISOString().slice(0, 10)).toBe('2025-03-10');
  });

  it('sets periodStart and periodEnd from min/max dates', () => {
    const result = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2025-03-05');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2025-03-10');
  });

  it('throws BadRequestException for empty OFX file', () => {
    expect(() => parseOfxStatement(Buffer.from(''), 'HBL', '1234')).toThrow(BadRequestException);
  });

  it('throws BadRequestException when file lacks STMTTRN blocks', () => {
    expect(() =>
      parseOfxStatement(Buffer.from('<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>'), 'HBL', '1234'),
    ).toThrow(/no transaction records/i);
  });

  it('parseQfxStatement is an alias of parseOfxStatement — same result', () => {
    const ofxResult = parseOfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');
    const qfxResult = parseQfxStatement(validOfxSgml, 'HBL', 'PK00HABB1234');

    expect(qfxResult.transactions).toHaveLength(ofxResult.transactions.length);
    expect(qfxResult.currency).toBe(ofxResult.currency);
  });
});

/*
 * Sprint S3 · CSV + OFX/QFX Parser Unit Tests · Week 7–8
 * 20 test cases — layout auto-detection, amount parsing, date formats, error cases
 */
