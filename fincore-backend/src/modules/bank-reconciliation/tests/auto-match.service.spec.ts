/**
 * src/modules/bank-reconciliation/tests/auto-match.service.spec.ts
 *
 * Unit tests for AutoMatchService — fuzzy matching algorithm.
 * Focus: Levenshtein correctness, confidence scoring, amount tolerance,
 *        date window, full statement matching cycle.
 *
 * Sprint: S3 · Week 7–8
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MatchStatus, Prisma } from '@prisma/client';
import { AutoMatchService } from '../services/auto-match.service';
import { PrismaService } from '../../../database/prisma.service';
import Decimal from 'decimal.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  bankTransaction: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  journalEntry: {
    findMany: jest.fn(),
  },
};

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeBankTxn(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'btxn-001',
    statementId: 'stmt-001',
    date: new Date('2025-03-15'),
    description: 'Client payment ACME Corp',
    reference: 'INV-2025-000042',
    debit: new Prisma.Decimal(0),
    credit: new Prisma.Decimal('50000'),
    balance: null,
    matchStatus: MatchStatus.UNMATCHED,
    ...overrides,
  };
}

function makeGlEntry(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'je-001',
    entryDate: new Date('2025-03-15'),
    entryNumber: 'JE-2025-000001',
    reference: 'INV-2025-000042',
    lines: [
      {
        baseCurrencyDebit: new Prisma.Decimal(0),
        baseCurrencyCredit: new Prisma.Decimal('50000'),
      },
    ],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AutoMatchService', () => {
  let service: AutoMatchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutoMatchService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AutoMatchService>(AutoMatchService);
    jest.clearAllMocks();
  });

  // ─── levenshtein() ────────────────────────────────────────────────────────
  describe('levenshtein()', () => {
    it('returns 0 for identical strings', () => {
      expect(service.levenshtein('abc', 'abc')).toBe(0);
    });

    it('returns string length for empty other string', () => {
      expect(service.levenshtein('abc', '')).toBe(3);
      expect(service.levenshtein('', 'abc')).toBe(3);
    });

    it('returns 1 for single substitution', () => {
      expect(service.levenshtein('cat', 'bat')).toBe(1);
    });

    it('returns 1 for single insertion', () => {
      expect(service.levenshtein('cat', 'cats')).toBe(1);
    });

    it('returns 1 for single deletion', () => {
      expect(service.levenshtein('cats', 'cat')).toBe(1);
    });

    it('is symmetric — levenshtein(a,b) === levenshtein(b,a)', () => {
      expect(service.levenshtein('kitten', 'sitting')).toBe(
        service.levenshtein('sitting', 'kitten'),
      );
    });

    it('handles reference numbers with slight differences', () => {
      // INV-2025-000042 vs INV-2025-000043 → 1 substitution
      expect(service.levenshtein('INV-2025-000042', 'INV-2025-000043')).toBe(1);
    });

    it('handles completely different strings', () => {
      expect(service.levenshtein('abc', 'xyz')).toBe(3);
    });
  });

  // ─── computeRefSimilarity() ───────────────────────────────────────────────
  describe('computeRefSimilarity()', () => {
    it('returns 1 for identical references', () => {
      expect(service.computeRefSimilarity('INV-2025-000042', 'INV-2025-000042')).toBe(1);
    });

    it('returns 0 when either reference is null', () => {
      expect(service.computeRefSimilarity(null, 'INV-001')).toBe(0);
      expect(service.computeRefSimilarity('INV-001', null)).toBe(0);
      expect(service.computeRefSimilarity(null, null)).toBe(0);
    });

    it('returns > 0.9 for near-identical references (1 char different)', () => {
      const similarity = service.computeRefSimilarity('INV-2025-000042', 'INV-2025-000043');
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('is case-insensitive and ignores whitespace', () => {
      const s1 = service.computeRefSimilarity('INV-001', 'inv-001');
      const s2 = service.computeRefSimilarity('INV 001', 'INV-001');
      expect(s1).toBe(1);
      expect(s2).toBeGreaterThan(0.8);
    });

    it('returns < 0.5 for very different references', () => {
      const similarity = service.computeRefSimilarity('ABC-999', 'XYZ-001');
      expect(similarity).toBeLessThan(0.5);
    });
  });

  // ─── findBestMatch() ──────────────────────────────────────────────────────
  describe('findBestMatch()', () => {
    it('returns HIGH confidence match when amount exact + same date + matching reference', () => {
      const txn = makeBankTxn();
      const txnAmount = new Decimal('50000');
      const entries = [makeGlEntry()];

      const result = service.findBestMatch(txn, txnAmount, entries);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe('HIGH');
      expect(result!.journalEntryId).toBe('je-001');
      expect(result!.amountDelta).toBeLessThanOrEqual(0.01);
      expect(result!.dateDelta).toBe(0);
    });

    it('returns MEDIUM confidence when amount matches but date is 2 days off', () => {
      const txn = makeBankTxn({ date: new Date('2025-03-17') }); // 2 days later
      const txnAmt = new Decimal('50000');
      const entries = [makeGlEntry({ entryDate: new Date('2025-03-15'), reference: null })];

      const result = service.findBestMatch(txn, txnAmt, entries);

      expect(result).not.toBeNull();
      expect(result!.confidence).toBe('MEDIUM');
      expect(result!.dateDelta).toBe(2);
    });

    it('returns null when amount difference exceeds tolerance (±0.01)', () => {
      const txn = makeBankTxn();
      const txnAmt = new Decimal('50001'); // 1 PKR off — over tolerance
      const entries = [makeGlEntry()];

      const result = service.findBestMatch(txn, txnAmt, entries);
      expect(result).toBeNull();
    });

    it('returns null when date difference exceeds 3 days', () => {
      const txn = makeBankTxn({ date: new Date('2025-03-20') }); // 5 days later
      const txnAmt = new Decimal('50000');
      const entries = [makeGlEntry({ entryDate: new Date('2025-03-15') })];

      const result = service.findBestMatch(txn, txnAmt, entries);
      expect(result).toBeNull();
    });

    it('returns null when best match confidence is LOW (no auto-apply)', () => {
      // Amount matches but 3 day gap and no reference
      const txn = makeBankTxn({ date: new Date('2025-03-18'), reference: null });
      const txnAmt = new Decimal('50000');
      const entries = [makeGlEntry({ entryDate: new Date('2025-03-15'), reference: null })];

      const result = service.findBestMatch(txn, txnAmt, entries);
      // 3-day delta with no reference → LOW → not auto-applied
      expect(result).toBeNull();
    });

    it('picks best match when multiple candidates exist', () => {
      const txn = makeBankTxn();
      const txnAmt = new Decimal('50000');
      const goodEntry = makeGlEntry({ id: 'je-good', reference: 'INV-2025-000042' });
      const okEntry = makeGlEntry({
        id: 'je-ok',
        reference: null,
        entryDate: new Date('2025-03-17'),
      });

      const result = service.findBestMatch(txn, txnAmt, [okEntry, goodEntry]);
      expect(result!.journalEntryId).toBe('je-good'); // better reference match
    });

    it('returns null when no candidates exist', () => {
      const txn = makeBankTxn();
      const txnAmt = new Decimal('50000');
      expect(service.findBestMatch(txn, txnAmt, [])).toBeNull();
    });
  });

  // ─── matchStatement() ─────────────────────────────────────────────────────
  describe('matchStatement()', () => {
    const ORG_ID = 'org-001';
    const STMT_ID = 'stmt-001';

    it('returns empty summary when no UNMATCHED transactions exist', async () => {
      mockPrisma.bankTransaction.findMany.mockResolvedValue([]);

      const summary = await service.matchStatement(STMT_ID, ORG_ID);

      expect(summary.total).toBe(0);
      expect(summary.autoMatched).toBe(0);
      expect(mockPrisma.journalEntry.findMany).not.toHaveBeenCalled();
    });

    it('matches and updates DB for HIGH confidence transactions', async () => {
      const txns = [makeBankTxn()];
      mockPrisma.bankTransaction.findMany.mockResolvedValue(txns);
      mockPrisma.journalEntry.findMany.mockResolvedValue([makeGlEntry()]);
      mockPrisma.bankTransaction.update.mockResolvedValue({});

      const summary = await service.matchStatement(STMT_ID, ORG_ID);

      expect(summary.autoMatched).toBe(1);
      expect(summary.unmatched).toBe(0);
      expect(mockPrisma.bankTransaction.update).toHaveBeenCalledWith({
        where: { id: 'btxn-001' },
        data: {
          matchStatus: MatchStatus.AUTO_MATCHED,
          matchedEntryId: 'je-001',
          matchConfidence: 'HIGH',
        },
      });
    });

    it('leaves LOW confidence transactions as UNMATCHED', async () => {
      // Amount matches but date 5 days off → no match
      const txns = [makeBankTxn({ date: new Date('2025-03-20') })];
      mockPrisma.bankTransaction.findMany.mockResolvedValue(txns);
      mockPrisma.journalEntry.findMany.mockResolvedValue([
        makeGlEntry({ entryDate: new Date('2025-03-15') }),
      ]);

      const summary = await service.matchStatement(STMT_ID, ORG_ID);

      expect(summary.autoMatched).toBe(0);
      expect(summary.unmatched).toBe(1);
      expect(mockPrisma.bankTransaction.update).not.toHaveBeenCalled();
    });

    it('processes multiple transactions and reports correct totals', async () => {
      const txns = [
        makeBankTxn({ id: 'btxn-001' }),
        makeBankTxn({ id: 'btxn-002', date: new Date('2025-03-20') }), // too far — no match
      ];
      mockPrisma.bankTransaction.findMany.mockResolvedValue(txns);
      mockPrisma.journalEntry.findMany.mockResolvedValue([makeGlEntry()]);
      mockPrisma.bankTransaction.update.mockResolvedValue({});

      const summary = await service.matchStatement(STMT_ID, ORG_ID);

      expect(summary.total).toBe(2);
      expect(summary.autoMatched).toBe(1);
      expect(summary.unmatched).toBe(1);
    });
  });
});

/*
 * Sprint S3 · AutoMatchService Unit Tests · Week 7–8
 * 21 test cases — Levenshtein correctness, confidence scoring, edge cases
 */
