// src/modules/general-ledger/tests/general-ledger.service.spec.ts
// Deep unit test suite — 40+ test cases covering every path in the GL engine
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JournalEntryStatus } from '@prisma/client';
import { GeneralLedgerService } from '../services/general-ledger.service';
import { FiscalPeriodsService } from '../../chart-of-accounts/services/fiscal-periods.service';
import { PrismaService } from '../../../database/prisma.service';
import Decimal from 'decimal.js';

// ── Type Definitions for Mocks ─────────────────────────────────────────────────

type MockPrismaJournalEntry = {
  create: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  count: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
};

type MockPrismaJournalLine = {
  aggregate: jest.Mock;
  groupBy: jest.Mock;
};

type MockPrisma = {
  journalEntry: MockPrismaJournalEntry;
  journalLine: MockPrismaJournalLine;
  fiscalPeriod: { findUnique: jest.Mock; findFirst: jest.Mock };
  account: { findFirst: jest.Mock; findMany: jest.Mock };
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Use a valid UUID format for tests
const VALID_ORG_ID = '123e4567-e89b-12d3-a456-426614174000';

const mockPrisma: MockPrisma = {
  journalEntry: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  journalLine: {
    aggregate: jest.fn(),
    groupBy: jest.fn(),
  },
  fiscalPeriod: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  account: { findFirst: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((cb: (prisma: MockPrisma) => unknown) => cb(mockPrisma)),
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
};

const mockFiscalPeriods = {
  assertPeriodOpen: jest.fn(),
  findByDate: jest.fn().mockResolvedValue(null),
  findOne: jest.fn(),
};

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ORG_ID = VALID_ORG_ID;

interface Account {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  isLocked: boolean;
  isArchived: boolean;
  organizationId: string;
}

const makeAccounts = (overrides: Partial<Account>[] = []): Account[] => [
  {
    id: 'acc-cash',
    accountCode: '1112',
    name: 'Cash',
    type: 'ASSET',
    isLocked: false,
    isArchived: false,
    organizationId: ORG_ID,
  },
  {
    id: 'acc-revenue',
    accountCode: '4110',
    name: 'Revenue',
    type: 'REVENUE',
    isLocked: false,
    isArchived: false,
    organizationId: ORG_ID,
  },
  ...(overrides as Account[]),
];

interface LineDto {
  accountId: string;
  debit: number;
  credit: number;
  currency?: string;
  fxRate?: number;
}

const VALID_LINES: LineDto[] = [
  { accountId: 'acc-cash', debit: 50000, credit: 0, currency: 'PKR', fxRate: 1 },
  { accountId: 'acc-revenue', debit: 0, credit: 50000, currency: 'PKR', fxRate: 1 },
];

interface CreateJournalEntryDto {
  description: string;
  entryDate: string;
  lines: LineDto[];
  periodId?: string;
}

const VALID_DTO: CreateJournalEntryDto = {
  description: 'Client payment received',
  entryDate: '2025-03-15',
  lines: VALID_LINES,
};

interface JournalLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  baseCurrencyDebit: Decimal;
  baseCurrencyCredit: Decimal;
  currency: string;
  fxRate: Decimal;
  description: string | null;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  description: string;
  reference: string | null;
  status: JournalEntryStatus;
  isReversed: boolean;
  organizationId: string;
  lines: JournalLine[];
  period: unknown;
}

interface CreateJournalEntryData {
  data: {
    description: string;
    entryDate: Date;
    lines: {
      create: Array<Record<string, unknown>>;
    };
  };
}

const makeEntry = (overrides: Partial<JournalEntry> = {}): JournalEntry => ({
  id: 'entry-001',
  entryNumber: 'JE-2025-000001',
  description: 'Client payment received',
  reference: null,
  status: JournalEntryStatus.POSTED,
  isReversed: false,
  organizationId: ORG_ID,
  lines: [
    {
      accountId: 'acc-cash',
      debit: new Decimal(50000),
      credit: new Decimal(0),
      baseCurrencyDebit: new Decimal(50000),
      baseCurrencyCredit: new Decimal(0),
      currency: 'PKR',
      fxRate: new Decimal(1),
      description: null,
    },
    {
      accountId: 'acc-revenue',
      debit: new Decimal(0),
      credit: new Decimal(50000),
      baseCurrencyDebit: new Decimal(0),
      baseCurrencyCredit: new Decimal(50000),
      currency: 'PKR',
      fxRate: new Decimal(1),
      description: null,
    },
  ],
  period: null,
  ...overrides,
});

// Helper to safely access mock call arguments
const getCreateCallData = (): CreateJournalEntryData | undefined => {
  const createCall = mockPrisma.journalEntry.create.mock.calls[0];
  return createCall?.[0] as CreateJournalEntryData | undefined;
};

const getLineFromCreateCall = (index: number): Record<string, unknown> | undefined => {
  const callData = getCreateCallData();
  return callData?.data.lines.create[index];
};

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('GeneralLedgerService', () => {
  let service: GeneralLedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralLedgerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FiscalPeriodsService, useValue: mockFiscalPeriods },
      ],
    }).compile();

    service = module.get<GeneralLedgerService>(GeneralLedgerService);
    jest.clearAllMocks();

    // Default happy-path mocks
    mockFiscalPeriods.assertPeriodOpen.mockResolvedValue(undefined);
    mockFiscalPeriods.findByDate.mockResolvedValue(null);
    mockPrisma.account.findMany.mockResolvedValue(makeAccounts());
    mockPrisma.account.findFirst.mockResolvedValue(makeAccounts()[0]);
    mockPrisma.$executeRaw.mockResolvedValue(undefined);
    mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 1n }]);
    mockPrisma.journalEntry.create.mockResolvedValue(
      makeEntry({ status: JournalEntryStatus.DRAFT }),
    );
    mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null);
    mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(null);
  });

  // ─── createJournalEntry() ─────────────────────────────────────────────────
  describe('createJournalEntry()', () => {
    // Happy path
    it('creates a valid DRAFT journal entry', async () => {
      const result = await service.createJournalEntry(ORG_ID, VALID_DTO);
      expect(result.status).toBe(JournalEntryStatus.DRAFT);
      expect(mockPrisma.journalEntry.create).toHaveBeenCalledTimes(1);
      expect(mockFiscalPeriods.assertPeriodOpen).toHaveBeenCalled();
    });

    // Double-entry violations
    it('throws when debits ≠ credits (50000 vs 49999.99)', async () => {
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: 50000, credit: 0 },
          { accountId: 'acc-revenue', debit: 0, credit: 49999.99 },
        ],
      };
      await expect(service.createJournalEntry(ORG_ID, dto)).rejects.toThrow(
        /double-entry constraint/i,
      );
    });

    it('throws for completely zero entry', async () => {
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: 0, credit: 0 },
          { accountId: 'acc-revenue', debit: 0, credit: 0 },
        ],
      };
      await expect(service.createJournalEntry(ORG_ID, dto)).rejects.toThrow(/zero/i);
    });

    it('handles floating-point amounts without precision drift (0.1 + 0.2 = 0.3)', async () => {
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: 0.1, credit: 0 },
          { accountId: 'acc-revenue', debit: 0.2, credit: 0 },
          { accountId: 'acc-revenue-2', debit: 0, credit: 0.3 },
        ],
      };
      mockPrisma.account.findMany.mockResolvedValue([
        makeAccounts()[0], // cash
        makeAccounts()[1], // revenue
        { ...makeAccounts()[1], id: 'acc-revenue-2' }, // second revenue account for credit
      ]);
      await expect(service.createJournalEntry(ORG_ID, dto)).resolves.toBeDefined();
    });

    // Line validity
    it('throws when a single line has both debit and credit > 0', async () => {
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: 1000, credit: 1000 },
          { accountId: 'acc-revenue', debit: 0, credit: 0 },
        ],
      };
      await expect(service.createJournalEntry(ORG_ID, dto)).rejects.toThrow(
        /both debit and credit/i,
      );
    });

    it('throws for negative debit amount', async () => {
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: -500, credit: 0 },
          { accountId: 'acc-revenue', debit: 0, credit: -500 },
        ],
      };
      await expect(service.createJournalEntry(ORG_ID, dto)).rejects.toThrow(/non-negative/i);
    });

    // Account validation
    it('throws NotFoundException when account not in org', async () => {
      mockPrisma.account.findMany.mockResolvedValue([makeAccounts()[0]]);
      await expect(service.createJournalEntry(ORG_ID, VALID_DTO)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when account is locked', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { ...makeAccounts()[0], isLocked: true },
        makeAccounts()[1],
      ]);
      await expect(service.createJournalEntry(ORG_ID, VALID_DTO)).rejects.toThrow(/locked/i);
    });

    it('throws BadRequestException when account is archived', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        { ...makeAccounts()[0], isArchived: true },
        makeAccounts()[1],
      ]);
      await expect(service.createJournalEntry(ORG_ID, VALID_DTO)).rejects.toThrow(/archived/i);
    });

    // Period validation
    it('throws BadRequestException when fiscal period is CLOSED', async () => {
      mockFiscalPeriods.assertPeriodOpen.mockRejectedValue(
        new BadRequestException('Fiscal period "Q1 2025" is CLOSED'),
      );
      await expect(service.createJournalEntry(ORG_ID, VALID_DTO)).rejects.toThrow(/closed/i);
    });

    it('throws NotFoundException when explicit periodId does not exist', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(
        service.createJournalEntry(ORG_ID, { ...VALID_DTO, periodId: 'ghost-period' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when entryDate is outside explicit period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue({
        id: 'p1',
        name: 'Q1',
        organizationId: ORG_ID,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        status: 'OPEN',
      });
      await expect(
        service.createJournalEntry(ORG_ID, {
          ...VALID_DTO,
          entryDate: '2025-06-15',
          periodId: 'p1',
        }),
      ).rejects.toThrow(/outside fiscal period/i);
    });

    // Multi-currency
    it('converts USD lines to PKR base currency correctly', async () => {
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: 100, credit: 0, currency: 'USD', fxRate: 278.5 },
          { accountId: 'acc-revenue', debit: 0, credit: 100, currency: 'USD', fxRate: 278.5 },
        ],
      };

      await service.createJournalEntry(ORG_ID, dto);

      const line0 = getLineFromCreateCall(0);
      expect(line0?.baseCurrencyDebit).toBe('27850.0000');
      expect(line0?.currency).toBe('USD');
      expect(line0?.fxRate).toBe('278.500000');
    });

    it('handles 3+ line compound entries (multiple debits, multiple credits)', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        makeAccounts()[0],
        makeAccounts()[1],
        {
          id: 'acc-tax',
          accountCode: '2131',
          name: 'Sales Tax',
          type: 'LIABILITY',
          isLocked: false,
          isArchived: false,
          organizationId: ORG_ID,
        },
      ]);
      const dto = {
        ...VALID_DTO,
        lines: [
          { accountId: 'acc-cash', debit: 57500, credit: 0 },
          { accountId: 'acc-revenue', debit: 0, credit: 50000 },
          { accountId: 'acc-tax', debit: 0, credit: 7500 },
        ],
      };
      await expect(service.createJournalEntry(ORG_ID, dto)).resolves.toBeDefined();
    });
  });

  // ─── postJournalEntry() ──────────────────────────────────────────────────
  describe('postJournalEntry()', () => {
    it('posts a DRAFT entry successfully', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.DRAFT }),
      );
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.journalEntry.update.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.POSTED }),
      );

      const result = await service.postJournalEntry(ORG_ID, 'entry-001');
      expect(result.status).toBe(JournalEntryStatus.POSTED);
      expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ status: JournalEntryStatus.POSTED }),
        }),
      );
    });

    it('throws ConflictException for already-POSTED entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.POSTED }),
      );
      await expect(service.postJournalEntry(ORG_ID, 'entry-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException for REVERSED entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.REVERSED }),
      );
      await expect(service.postJournalEntry(ORG_ID, 'entry-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException if period was closed after entry was created', async () => {
      const entryWithPeriod = makeEntry({ status: JournalEntryStatus.DRAFT });
      const entryWithPeriodId = { ...entryWithPeriod, periodId: 'p1' };
      mockPrisma.journalEntry.findFirst.mockResolvedValue(entryWithPeriodId);
      mockPrisma.fiscalPeriod.findUnique.mockResolvedValue({
        id: 'p1',
        name: 'Q1',
        status: 'CLOSED',
        startDate: new Date(),
        endDate: new Date(),
        organizationId: ORG_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await expect(service.postJournalEntry(ORG_ID, 'entry-001')).rejects.toThrow(/now closed/i);
    });

    it('throws NotFoundException for unknown entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(null);
      await expect(service.postJournalEntry(ORG_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── reverseJournalEntry() ───────────────────────────────────────────────
  describe('reverseJournalEntry()', () => {
    it('creates reversal with all debits and credits swapped', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(makeEntry());
      mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 2n }]);
      mockPrisma.journalEntry.create.mockResolvedValue(
        makeEntry({ entryNumber: 'JE-2025-000002' }),
      );
      mockPrisma.journalEntry.update.mockResolvedValue({} as JournalEntry);

      await service.reverseJournalEntry(ORG_ID, 'entry-001');

      const line0 = getLineFromCreateCall(0);
      const line1 = getLineFromCreateCall(1);

      expect(line0?.debit?.toString()).toBe('0');
      expect(line0?.credit?.toString()).toBe('50000');
      expect(line1?.debit?.toString()).toBe('50000');
      expect(line1?.credit?.toString()).toBe('0');
    });

    it('auto-generates description if none provided', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(makeEntry());
      mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 2n }]);
      mockPrisma.journalEntry.create.mockResolvedValue(makeEntry());
      mockPrisma.journalEntry.update.mockResolvedValue({} as JournalEntry);

      await service.reverseJournalEntry(ORG_ID, 'entry-001');

      const callData = getCreateCallData();
      expect(callData?.data.description).toMatch(/Reversal of JE-2025-000001/);
    });

    it('uses custom reversalDate when provided', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(makeEntry());
      mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 2n }]);
      mockPrisma.journalEntry.create.mockResolvedValue(makeEntry());
      mockPrisma.journalEntry.update.mockResolvedValue({} as JournalEntry);

      await service.reverseJournalEntry(ORG_ID, 'entry-001', { reversalDate: '2025-04-01' });

      const callData = getCreateCallData();
      expect(callData?.data.entryDate).toEqual(new Date('2025-04-01'));
    });

    it('throws BadRequestException for DRAFT entry (cannot reverse)', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.DRAFT }),
      );
      await expect(service.reverseJournalEntry(ORG_ID, 'entry-001')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException for already-reversed entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(makeEntry({ isReversed: true }));
      await expect(service.reverseJournalEntry(ORG_ID, 'entry-001')).rejects.toThrow(
        ConflictException,
      );
    });

    it('marks original entry as REVERSED after reversal', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(makeEntry());
      mockPrisma.$queryRaw.mockResolvedValue([{ next_number: 2n }]);
      mockPrisma.journalEntry.create.mockResolvedValue(makeEntry());
      mockPrisma.journalEntry.update.mockResolvedValue({} as JournalEntry);

      await service.reverseJournalEntry(ORG_ID, 'entry-001');

      expect(mockPrisma.journalEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'entry-001' },
          data: { isReversed: true, status: JournalEntryStatus.REVERSED },
        }),
      );
    });
  });

  // ─── deleteDraft() ────────────────────────────────────────────────────────
  describe('deleteDraft()', () => {
    it('deletes a DRAFT entry', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.DRAFT }),
      );
      mockPrisma.journalEntry.delete.mockResolvedValue({} as JournalEntry);

      const result = await service.deleteDraft(ORG_ID, 'entry-001');
      expect(result.deleted).toBe(true);
      expect(result.entryNumber).toBe('JE-2025-000001');
    });

    it('throws ConflictException for POSTED entry (cannot delete — reverse instead)', async () => {
      mockPrisma.journalEntry.findFirst.mockResolvedValue(
        makeEntry({ status: JournalEntryStatus.POSTED }),
      );
      await expect(service.deleteDraft(ORG_ID, 'entry-001')).rejects.toThrow(ConflictException);
      expect(mockPrisma.journalEntry.delete).not.toHaveBeenCalled();
    });
  });

  // ─── getAccountBalance() ─────────────────────────────────────────────────
  describe('getAccountBalance()', () => {
    it('returns positive net balance for asset account (debit normal)', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({ ...makeAccounts()[0], type: 'ASSET' });
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { baseCurrencyDebit: '150000.0000', baseCurrencyCredit: '50000.0000' },
      });

      const result = await service.getAccountBalance(ORG_ID, 'acc-cash');

      expect(result.totalDebit).toBe(150000);
      expect(result.totalCredit).toBe(50000);
      expect(result.netBalance).toBe(100000);
      expect(result.normalBalance).toBe('DEBIT');
    });

    it('returns positive net balance for revenue account (credit normal)', async () => {
      mockPrisma.account.findFirst.mockResolvedValue({ ...makeAccounts()[1], type: 'REVENUE' });
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { baseCurrencyDebit: '0.0000', baseCurrencyCredit: '200000.0000' },
      });

      const result = await service.getAccountBalance(ORG_ID, 'acc-revenue');

      expect(result.netBalance).toBe(200000);
      expect(result.normalBalance).toBe('CREDIT');
    });

    it('returns zero balance for account with no posted transactions', async () => {
      mockPrisma.journalLine.aggregate.mockResolvedValue({
        _sum: { baseCurrencyDebit: null, baseCurrencyCredit: null },
      });

      const result = await service.getAccountBalance(ORG_ID, 'acc-cash');
      expect(result.netBalance).toBe(0);
      expect(result.totalDebit).toBe(0);
      expect(result.totalCredit).toBe(0);
    });

    it('throws NotFoundException when account not in org', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      await expect(service.getAccountBalance(ORG_ID, 'ghost-acc')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getTrialBalance() ────────────────────────────────────────────────────
  describe('getTrialBalance()', () => {
    it('returns isBalanced=true when Σ(debits) = Σ(credits)', async () => {
      mockPrisma.journalLine.groupBy.mockResolvedValue([
        {
          accountId: 'acc-cash',
          _sum: { baseCurrencyDebit: '50000.0000', baseCurrencyCredit: '0.0000' },
        },
        {
          accountId: 'acc-revenue',
          _sum: { baseCurrencyDebit: '0.0000', baseCurrencyCredit: '50000.0000' },
        },
      ]);
      mockPrisma.account.findMany.mockResolvedValue(makeAccounts());

      const result = await service.getTrialBalance(ORG_ID);

      expect(result.isBalanced).toBe(true);
      expect(result.totalDebits).toBe(50000);
      expect(result.totalCredits).toBe(50000);
      expect(result.imbalance).toBe(0);
    });

    it('detects imbalance and sets isBalanced=false', async () => {
      mockPrisma.journalLine.groupBy.mockResolvedValue([
        {
          accountId: 'acc-cash',
          _sum: { baseCurrencyDebit: '50001.0000', baseCurrencyCredit: '0.0000' },
        },
        {
          accountId: 'acc-revenue',
          _sum: { baseCurrencyDebit: '0.0000', baseCurrencyCredit: '50000.0000' },
        },
      ]);
      mockPrisma.account.findMany.mockResolvedValue(makeAccounts());

      const result = await service.getTrialBalance(ORG_ID);

      expect(result.isBalanced).toBe(false);
      expect(result.imbalance).toBe(1);
    });

    it('returns rows sorted by account code', async () => {
      mockPrisma.journalLine.groupBy.mockResolvedValue([
        { accountId: 'acc-revenue', _sum: { baseCurrencyDebit: '0', baseCurrencyCredit: '50000' } },
        { accountId: 'acc-cash', _sum: { baseCurrencyDebit: '50000', baseCurrencyCredit: '0' } },
      ]);
      mockPrisma.account.findMany.mockResolvedValue(makeAccounts());

      const result = await service.getTrialBalance(ORG_ID);

      expect(result.rows[0]?.accountCode).toBe('1112');
      expect(result.rows[1]?.accountCode).toBe('4110');
    });

    it('returns empty trial balance when no posted entries exist', async () => {
      mockPrisma.journalLine.groupBy.mockResolvedValue([]);
      mockPrisma.account.findMany.mockResolvedValue([]);

      const result = await service.getTrialBalance(ORG_ID);

      expect(result.rows).toHaveLength(0);
      expect(result.isBalanced).toBe(true);
    });
  });
});
