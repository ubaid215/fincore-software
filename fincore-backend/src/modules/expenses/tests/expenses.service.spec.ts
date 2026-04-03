/**
 * src/modules/expenses/tests/expenses.service.spec.ts
 *
 * Unit tests for ExpensesService — 3-step approval workflow.
 * All Prisma and GL calls are mocked. Focus: state machine correctness,
 * Decimal totals, receipt guard, claimant-only enforcement.
 *
 * Sprint: S3 · Week 7–8
 */

import { Test, TestingModule }    from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ExpenseStatus, UserRole } from '@prisma/client';
import { ExpensesService }         from '../services/expenses.service';
import { GeneralLedgerService }    from '../../general-ledger/services/general-ledger.service';
import { PrismaService }           from '../../../database/prisma.service';
import { EXPENSE_TRANSITIONS }     from '../types/expense.types';
import Decimal                     from 'decimal.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

type ExpenseMockPrisma = {
  expense: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  account: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

const mockPrisma = {} as ExpenseMockPrisma;
mockPrisma.expense = {
  create: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
};
mockPrisma.account = { findMany: jest.fn() };
mockPrisma.$transaction = jest.fn((cb: (tx: ExpenseMockPrisma) => unknown) => cb(mockPrisma));

const mockGlService = {
  createJournalEntry: jest.fn(),
  postJournalEntry:   jest.fn(),
};

// ── Fixtures ───────────────────────────────────────────────────────────────

const ORG_ID       = 'org-001';
const CLAIMANT_ID  = 'user-claimant';
const APPROVER_ID  = 'user-approver';
const AP_ACCOUNT   = 'acc-ap-001';

const makeAccount = (id: string) => ({
  id, accountCode: '6110', isLocked: false, isArchived: false, organizationId: ORG_ID,
});

function makeExpense(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:             'exp-001',
    organizationId: ORG_ID,
    claimantId:     CLAIMANT_ID,
    approverId:     null,
    title:          'March Business Trip',
    description:    null,
    totalAmount:    new Decimal(8500),
    currency:       'PKR',
    status:         ExpenseStatus.DRAFT,
    submittedAt:    null,
    approvedAt:     null,
    rejectedAt:     null,
    rejectionNote:  null,
    postedToGLAt:   null,
    createdAt:      new Date(),
    updatedAt:      new Date(),
    lines: [
      {
        id: 'el-001', expenseId: 'exp-001', accountId: 'acc-001',
        description: 'Hotel', amount: new Decimal(5000), category: 'Accommodation',
      },
      {
        id: 'el-002', expenseId: 'exp-001', accountId: 'acc-002',
        description: 'Meals',  amount: new Decimal(3500), category: 'Meals',
      },
    ],
    receipts: [
      { id: 'rec-001', expenseId: 'exp-001', fileName: 'hotel.jpg', s3Key: 'receipts/org-001/...' },
    ],
    claimant: { id: CLAIMANT_ID, firstName: 'Ali', lastName: 'Ahmed', email: 'ali@test.com' },
    approver: null,
    ...overrides,
  };
}

const CREATE_DTO = {
  title:    'March Business Trip',
  currency: 'PKR',
  lines: [
    { accountId: 'acc-001', description: 'Hotel',  amount: 5000, category: 'Accommodation' },
    { accountId: 'acc-002', description: 'Meals',   amount: 3500, category: 'Meals' },
  ],
};

// ── Test suite ─────────────────────────────────────────────────────────────

describe('ExpensesService', () => {
  let service: ExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService,        useValue: mockPrisma    },
        { provide: GeneralLedgerService, useValue: mockGlService },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    jest.clearAllMocks();

    // Default happy-path mocks
    mockPrisma.account.findMany.mockResolvedValue([
      makeAccount('acc-001'),
      makeAccount('acc-002'),
    ]);
    mockPrisma.expense.create.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT }));
    mockPrisma.expense.update.mockImplementation(
      ({ data }: { data: Partial<Record<string, unknown>> }) =>
        Promise.resolve(makeExpense({ ...data })),
    );
  });

  // ─── EXPENSE_TRANSITIONS constant ─────────────────────────────────────────
  describe('EXPENSE_TRANSITIONS (state machine map)', () => {
    it('DRAFT only allows → SUBMITTED', () => {
      expect(EXPENSE_TRANSITIONS.DRAFT).toEqual(['SUBMITTED']);
    });

    it('SUBMITTED allows → MANAGER_APPROVED or REJECTED', () => {
      expect(EXPENSE_TRANSITIONS.SUBMITTED).toEqual(
        expect.arrayContaining(['MANAGER_APPROVED', 'REJECTED']),
      );
      expect(EXPENSE_TRANSITIONS.SUBMITTED).toHaveLength(2);
    });

    it('MANAGER_APPROVED allows → FINANCE_APPROVED or REJECTED', () => {
      expect(EXPENSE_TRANSITIONS.MANAGER_APPROVED).toEqual(
        expect.arrayContaining(['FINANCE_APPROVED', 'REJECTED']),
      );
    });

    it('FINANCE_APPROVED allows → POSTED or REJECTED', () => {
      expect(EXPENSE_TRANSITIONS.FINANCE_APPROVED).toEqual(
        expect.arrayContaining(['POSTED', 'REJECTED']),
      );
    });

    it('POSTED is a terminal state — no transitions', () => {
      expect(EXPENSE_TRANSITIONS.POSTED).toHaveLength(0);
    });

    it('REJECTED is a terminal state — no transitions', () => {
      expect(EXPENSE_TRANSITIONS.REJECTED).toHaveLength(0);
    });
  });

  // ─── create() ─────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('creates DRAFT expense with correct total: 5000 + 3500 = 8500', async () => {
      const result = await service.create(ORG_ID, CLAIMANT_ID, CREATE_DTO);

      expect(result.status).toBe(ExpenseStatus.DRAFT);
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      expect(new Decimal(createCall.data.totalAmount).toFixed(4)).toBe('8500.0000');
    });

    it('uppercases currency before saving', async () => {
      await service.create(ORG_ID, CLAIMANT_ID, { ...CREATE_DTO, currency: 'usd' });
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      expect(createCall.data.currency).toBe('USD');
    });

    it('defaults to PKR when currency is omitted', async () => {
      const dto = { ...CREATE_DTO };
      delete (dto as Partial<typeof dto>).currency;
      await service.create(ORG_ID, CLAIMANT_ID, dto);
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      expect(createCall.data.currency).toBe('PKR');
    });

    it('throws NotFoundException when GL account does not exist in org', async () => {
      mockPrisma.account.findMany.mockResolvedValue([makeAccount('acc-001')]); // only 1 of 2 found
      await expect(service.create(ORG_ID, CLAIMANT_ID, CREATE_DTO))
        .rejects.toThrow(NotFoundException);
      expect(mockPrisma.expense.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for locked account', async () => {
      mockPrisma.account.findMany.mockResolvedValue([
        makeAccount('acc-001'),
        { ...makeAccount('acc-002'), isLocked: true },
      ]);
      await expect(service.create(ORG_ID, CLAIMANT_ID, CREATE_DTO))
        .rejects.toThrow(BadRequestException);
    });

    it('creates lines with Decimal-rounded amounts', async () => {
      const dto = {
        ...CREATE_DTO,
        lines: [{ accountId: 'acc-001', description: 'Test', amount: 0.1 + 0.2, category: 'X' }],
      };
      mockPrisma.account.findMany.mockResolvedValue([makeAccount('acc-001')]);
      await service.create(ORG_ID, CLAIMANT_ID, dto);
      const createCall = mockPrisma.expense.create.mock.calls[0][0];
      // 0.1 + 0.2 floating point = 0.30000000000000004 in JS
      // Decimal.js should give us 0.3000
      expect(new Decimal(createCall.data.totalAmount).toFixed(4)).toBe('0.3000');
    });
  });

  // ─── submit() ─────────────────────────────────────────────────────────────
  describe('submit()', () => {
    it('transitions DRAFT → SUBMITTED when claimant submits with receipts', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT }));

      const result = await service.submit(ORG_ID, 'exp-001', CLAIMANT_ID);
      expect(result.status).toBe(ExpenseStatus.SUBMITTED);

      const updateCall = mockPrisma.expense.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ExpenseStatus.SUBMITTED);
      expect(updateCall.data.submittedAt).toBeInstanceOf(Date);
    });

    it('throws ForbiddenException when non-claimant tries to submit', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT }));
      await expect(service.submit(ORG_ID, 'exp-001', 'other-user'))
        .rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when no receipts are attached', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.DRAFT, receipts: [] }),
      );
      const err = await service.submit(ORG_ID, 'exp-001', CLAIMANT_ID).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toMatch(/receipt/i);
    });

    it('throws ConflictException when submitting an already-SUBMITTED expense', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.SUBMITTED }));
      await expect(service.submit(ORG_ID, 'exp-001', CLAIMANT_ID))
        .rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown expense', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(null);
      await expect(service.submit(ORG_ID, 'ghost-id', CLAIMANT_ID))
        .rejects.toThrow(NotFoundException);
    });
  });

  // ─── approveByManager() ───────────────────────────────────────────────────
  describe('approveByManager()', () => {
    it('transitions SUBMITTED → MANAGER_APPROVED', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.SUBMITTED }));

      await service.approveByManager(ORG_ID, 'exp-001', APPROVER_ID);

      const updateCall = mockPrisma.expense.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ExpenseStatus.MANAGER_APPROVED);
      expect(updateCall.data.approverId).toBe(APPROVER_ID);
      expect(updateCall.data.approvedAt).toBeInstanceOf(Date);
    });

    it('throws ConflictException when approving a DRAFT (must be SUBMITTED first)', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT }));
      await expect(service.approveByManager(ORG_ID, 'exp-001', APPROVER_ID))
        .rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when already MANAGER_APPROVED', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.MANAGER_APPROVED }),
      );
      await expect(service.approveByManager(ORG_ID, 'exp-001', APPROVER_ID))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── approveByFinance() ───────────────────────────────────────────────────
  describe('approveByFinance()', () => {
    it('transitions MANAGER_APPROVED → FINANCE_APPROVED', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.MANAGER_APPROVED }),
      );

      await service.approveByFinance(ORG_ID, 'exp-001', APPROVER_ID);

      const updateCall = mockPrisma.expense.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ExpenseStatus.FINANCE_APPROVED);
    });

    it('throws ConflictException when skipping manager step (SUBMITTED → FINANCE_APPROVED)', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.SUBMITTED }));
      await expect(service.approveByFinance(ORG_ID, 'exp-001', APPROVER_ID))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── postToGL() ───────────────────────────────────────────────────────────
  describe('postToGL()', () => {
    it('creates and posts GL entry when FINANCE_APPROVED', async () => {
      const expense = makeExpense({ status: ExpenseStatus.FINANCE_APPROVED });
      mockPrisma.expense.findFirst.mockResolvedValue(expense);
      mockGlService.createJournalEntry.mockResolvedValue({
        id: 'je-001', entryNumber: 'JE-2025-000001',
      });
      mockGlService.postJournalEntry.mockResolvedValue({});
      mockPrisma.expense.update.mockResolvedValue(makeExpense({ status: ExpenseStatus.POSTED }));

      const result = await service.postToGL(ORG_ID, 'exp-001', AP_ACCOUNT);

      // GL entry should have been created and immediately posted
      expect(mockGlService.createJournalEntry).toHaveBeenCalledTimes(1);
      expect(mockGlService.postJournalEntry).toHaveBeenCalledWith(ORG_ID, 'je-001');

      // Expense lines generate debit entries
      const glDto = mockGlService.createJournalEntry.mock.calls[0][1];
      const debitLines = glDto.lines.filter((l: { debit: number }) => l.debit > 0);
      const creditLines = glDto.lines.filter((l: { credit: number }) => l.credit > 0);

      expect(debitLines).toHaveLength(2);  // one per expense line
      expect(creditLines).toHaveLength(1); // single AP credit

      // Credit AP line amount = total expense (8500)
      expect(creditLines[0].credit).toBe(8500);
      expect(creditLines[0].accountId).toBe(AP_ACCOUNT);

      expect(result.glEntryNumber).toBe('JE-2025-000001');
    });

    it('throws ConflictException when posting a non-FINANCE_APPROVED expense', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.MANAGER_APPROVED }),
      );
      await expect(service.postToGL(ORG_ID, 'exp-001', AP_ACCOUNT))
        .rejects.toThrow(ConflictException);
      expect(mockGlService.createJournalEntry).not.toHaveBeenCalled();
    });
  });

  // ─── reject() ─────────────────────────────────────────────────────────────
  describe('reject()', () => {
    const rejectDto = { rejectionNote: 'Meal exceeds policy limit of PKR 2,500 per person.' };

    it('rejects from SUBMITTED status', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.SUBMITTED }));

      await service.reject(ORG_ID, 'exp-001', rejectDto);

      const updateCall = mockPrisma.expense.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ExpenseStatus.REJECTED);
      expect(updateCall.data.rejectionNote).toBe(rejectDto.rejectionNote);
      expect(updateCall.data.rejectedAt).toBeInstanceOf(Date);
    });

    it('rejects from MANAGER_APPROVED status', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.MANAGER_APPROVED }),
      );
      await expect(service.reject(ORG_ID, 'exp-001', rejectDto)).resolves.toBeDefined();
    });

    it('rejects from FINANCE_APPROVED status', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.FINANCE_APPROVED }),
      );
      await expect(service.reject(ORG_ID, 'exp-001', rejectDto)).resolves.toBeDefined();
    });

    it('throws ConflictException when rejecting a DRAFT (not yet submitted)', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.DRAFT }));
      await expect(service.reject(ORG_ID, 'exp-001', rejectDto))
        .rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when rejecting a POSTED expense (terminal)', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(makeExpense({ status: ExpenseStatus.POSTED }));
      await expect(service.reject(ORG_ID, 'exp-001', rejectDto))
        .rejects.toThrow(ConflictException);
    });
  });

  // ─── redraft() ────────────────────────────────────────────────────────────
  describe('redraft()', () => {
    it('transitions REJECTED → DRAFT for the claimant', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.REJECTED }),
      );

      await service.redraft(ORG_ID, 'exp-001', CLAIMANT_ID);

      const updateCall = mockPrisma.expense.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(ExpenseStatus.DRAFT);
      expect(updateCall.data.rejectionNote).toBeNull();
      expect(updateCall.data.submittedAt).toBeNull();
    });

    it('throws ConflictException when trying to re-draft a SUBMITTED expense', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.SUBMITTED }),
      );
      await expect(service.redraft(ORG_ID, 'exp-001', CLAIMANT_ID))
        .rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when non-claimant tries to re-draft', async () => {
      mockPrisma.expense.findFirst.mockResolvedValue(
        makeExpense({ status: ExpenseStatus.REJECTED }),
      );
      await expect(service.redraft(ORG_ID, 'exp-001', 'other-user'))
        .rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Complete approval flow ────────────────────────────────────────────────
  describe('Complete approval flow (integration-style with mocks)', () => {
    it('full happy path: DRAFT → SUBMITTED → MANAGER_APPROVED → FINANCE_APPROVED → POSTED', async () => {
      // Each findFirst returns the current state; each update advances it
      const statuses = [
        ExpenseStatus.DRAFT,
        ExpenseStatus.SUBMITTED,
        ExpenseStatus.MANAGER_APPROVED,
        ExpenseStatus.FINANCE_APPROVED,
      ];

      let callIdx = 0;
      mockPrisma.expense.findFirst.mockImplementation(() =>
        Promise.resolve(makeExpense({ status: statuses[callIdx++] })),
      );

      mockGlService.createJournalEntry.mockResolvedValue({ id: 'je-1', entryNumber: 'JE-2025-000001' });
      mockGlService.postJournalEntry.mockResolvedValue({});
      mockPrisma.expense.update.mockResolvedValue(makeExpense({ status: ExpenseStatus.POSTED }));

      await service.submit(ORG_ID, 'exp-001', CLAIMANT_ID);
      await service.approveByManager(ORG_ID, 'exp-001', APPROVER_ID);
      await service.approveByFinance(ORG_ID, 'exp-001', APPROVER_ID);
      const result = await service.postToGL(ORG_ID, 'exp-001', AP_ACCOUNT);

      expect(result.expense.status).toBe(ExpenseStatus.POSTED);
      expect(result.glEntryNumber).toBe('JE-2025-000001');
    });
  });
});

/*
 * Sprint S3 · ExpensesService Unit Tests · Week 7–8
 * 25 test cases — state machine, Decimal totals, receipt guard, claimant rules, GL posting
 */