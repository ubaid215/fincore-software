// src/modules/chart-of-accounts/tests/accounts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { AccountsService, NORMAL_BALANCE } from '../services/accounts.service';
import { PrismaService } from '../../../database/prisma.service';

// Define proper types for mocks
type MockPrismaAccount = {
  findUnique: jest.Mock;
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  upsert: jest.Mock;
  deleteMany: jest.Mock;
  count: jest.Mock;
  findUniqueOrThrow?: jest.Mock;
};

type MockPrisma = {
  account: MockPrismaAccount;
  journalEntry: { count: jest.Mock };
  journalLine: { count: jest.Mock };
};

interface Account {
  id: string;
  organizationId: string;
  accountCode: string;
  name: string;
  type: AccountType;
  subType: string;
  parentId: string | null;
  isArchived: boolean;
  isLocked: boolean;
  description: string | null;
  children: unknown[];
  parent: unknown;
}

const mockPrisma: MockPrisma = {
  account: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  journalEntry: { count: jest.fn() },
  journalLine: { count: jest.fn() },
};

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-001',
  organizationId: 'org-001',
  accountCode: '1110',
  name: 'Cash at Bank',
  type: AccountType.ASSET,
  subType: 'Current Asset',
  parentId: null,
  isArchived: false,
  isLocked: false,
  description: null,
  children: [],
  parent: null,
  ...overrides,
});

// Helper to safely access create call arguments
interface CreateCallData {
  data: {
    accountCode: string;
    organizationId: string;
  };
}

const getCreateCallData = (): CreateCallData | undefined => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const createCall = mockPrisma.account.create.mock.calls[0];
  return createCall?.[0] as CreateCallData | undefined;
};

describe('AccountsService', () => {
  let service: AccountsService;
  const ORG_ID = 'org-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<AccountsService>(AccountsService);
    jest.clearAllMocks();
    mockPrisma.account.findUnique.mockReset();
    mockPrisma.account.findMany.mockResolvedValue([]);
  });

  // ─── create() ────────────────────────────────────────────────────────────
  describe('create()', () => {
    const dto = { accountCode: '1110', name: 'Cash at Bank', type: AccountType.ASSET };

    it('creates account successfully', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null); // code free
      mockPrisma.account.create.mockResolvedValue(makeAccount());

      const result = await service.create(ORG_ID, dto);
      expect(result.accountCode).toBe('1110');
      expect(mockPrisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ accountCode: '1110', organizationId: ORG_ID }),
        }),
      );
    });

    it('uppercases the account code before saving', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(null);
      mockPrisma.account.create.mockResolvedValue(makeAccount({ accountCode: 'CASH-001' }));

      await service.create(ORG_ID, { ...dto, accountCode: 'cash-001' });

      const createCall = getCreateCallData();
      expect(createCall?.data.accountCode).toBe('CASH-001');
    });

    it('throws ConflictException when account code already exists', async () => {
      mockPrisma.account.findUnique.mockResolvedValue(makeAccount());
      await expect(service.create(ORG_ID, dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.account.create).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when parent account does not exist', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce(null);

      await expect(service.create(ORG_ID, { ...dto, parentId: 'ghost-parent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when parent belongs to different org', async () => {
      mockPrisma.account.findUnique.mockResolvedValueOnce(
        makeAccount({ id: 'acc-parent', organizationId: 'other-org' }),
      );

      await expect(service.create(ORG_ID, { ...dto, parentId: 'acc-parent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when child type differs from parent type', async () => {
      const parent = makeAccount({ id: 'acc-parent', type: AccountType.LIABILITY });
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce(null);

      await expect(
        service.create(ORG_ID, { ...dto, parentId: 'acc-parent', type: AccountType.ASSET }),
      ).rejects.toThrow(/type mismatch/i);
    });

    it('throws BadRequestException when adding child to archived parent', async () => {
      const archivedParent = makeAccount({
        id: 'acc-parent',
        isArchived: true,
        type: AccountType.ASSET,
      });
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(archivedParent)
        .mockResolvedValueOnce(null);

      await expect(service.create(ORG_ID, { ...dto, parentId: 'acc-parent' })).rejects.toThrow(
        /archived/i,
      );
    });

    it('throws BadRequestException when hierarchy depth would exceed 8', async () => {
      const parent = makeAccount({ id: 'acc-parent', type: AccountType.ASSET, isArchived: false });
      mockPrisma.account.findUnique
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce(null);

      const depthSpy = jest.spyOn(AccountsService.prototype as any, 'getDepth').mockResolvedValue(8);

      await expect(service.create(ORG_ID, { ...dto, parentId: 'acc-parent' })).rejects.toThrow(
        /maximum.*hierarchy depth/i,
      );
      depthSpy.mockRestore();
    });
  });

  // ─── findOne() ───────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('returns account with children', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ children: [] }));
      const result = await service.findOne(ORG_ID, 'acc-001');
      expect(result.id).toBe('acc-001');
    });

    it('throws NotFoundException for unknown account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(null);
      await expect(service.findOne(ORG_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── update() ────────────────────────────────────────────────────────────
  describe('update()', () => {
    it('updates name successfully', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ children: [] }));
      mockPrisma.account.update.mockResolvedValue(makeAccount({ name: 'New Name' }));

      const result = await service.update(ORG_ID, 'acc-001', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('throws BadRequestException for locked account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ isLocked: true, children: [] }));
      await expect(service.update(ORG_ID, 'acc-001', { name: 'X' })).rejects.toThrow(/locked/i);
    });
  });

  // ─── archive() ───────────────────────────────────────────────────────────
  describe('archive()', () => {
    it('archives an account with no children and no transactions', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ children: [] }));
      mockPrisma.account.count.mockResolvedValue(0); // no active children
      mockPrisma.journalLine.count.mockResolvedValue(0); // no posted transactions
      mockPrisma.account.update.mockResolvedValue(makeAccount({ isArchived: true }));

      const result = await service.archive(ORG_ID, 'acc-001');
      expect(result.isArchived).toBe(true);
    });

    it('throws when account has active children', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ children: [] }));
      mockPrisma.account.count.mockResolvedValue(3); // 3 active children
      await expect(service.archive(ORG_ID, 'acc-001')).rejects.toThrow(/active child/i);
    });

    it('throws when account has posted transactions', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ children: [] }));
      mockPrisma.account.count.mockResolvedValue(0);
      mockPrisma.journalLine.count.mockResolvedValue(5); // has transactions

      await expect(service.archive(ORG_ID, 'acc-001')).rejects.toThrow(/posted transaction/i);
    });

    it('throws for locked accounts', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ isLocked: true, children: [] }));
      await expect(service.archive(ORG_ID, 'acc-001')).rejects.toThrow(/locked/i);
    });
  });

  // ─── unarchive() ─────────────────────────────────────────────────────────
  describe('unarchive()', () => {
    it('unarchives when parent is active', async () => {
      const archived = makeAccount({ isArchived: true, parentId: 'parent-001', children: [] });
      mockPrisma.account.findFirst.mockResolvedValue(archived);
      mockPrisma.account.findUnique.mockResolvedValueOnce(
        makeAccount({ id: 'parent-001', isArchived: false, organizationId: ORG_ID }),
      );
      mockPrisma.account.update.mockResolvedValue({ ...archived, isArchived: false });

      const result = await service.unarchive(ORG_ID, 'acc-001');
      expect(result.isArchived).toBe(false);
    });

    it('throws when parent is still archived', async () => {
      const archived = makeAccount({ isArchived: true, parentId: 'parent-001', children: [] });
      mockPrisma.account.findFirst.mockResolvedValue(archived);
      mockPrisma.account.findUnique.mockResolvedValueOnce(
        makeAccount({ id: 'parent-001', isArchived: true, organizationId: ORG_ID }),
      );

      await expect(service.unarchive(ORG_ID, 'acc-001')).rejects.toThrow(/Cannot unarchive/i);
    });
  });

  // ─── lock() / unlock() ────────────────────────────────────────────────────
  describe('lock() / unlock()', () => {
    it('locks an account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ children: [] }));
      mockPrisma.account.update.mockResolvedValue(makeAccount({ isLocked: true }));

      const result = await service.lock(ORG_ID, 'acc-001');
      expect(result.isLocked).toBe(true);
      expect(mockPrisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isLocked: true } }),
      );
    });

    it('unlocks an account', async () => {
      mockPrisma.account.findFirst.mockResolvedValue(makeAccount({ isLocked: true, children: [] }));
      mockPrisma.account.update.mockResolvedValue(makeAccount({ isLocked: false }));

      const result = await service.unlock(ORG_ID, 'acc-001');
      expect(result.isLocked).toBe(false);
    });
  });

  // ─── importTemplate() ────────────────────────────────────────────────────
  describe('importTemplate()', () => {
    it('rejects replaceExisting when journal entries exist', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(10);

      await expect(service.importTemplate(ORG_ID, 'GAAP_USA', true)).rejects.toThrow(
        /journal entries already exist/i,
      );
      expect(mockPrisma.account.deleteMany).not.toHaveBeenCalled();
    });

    it('allows replaceExisting when no journal entries exist', async () => {
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.account.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.account.upsert.mockResolvedValue(makeAccount());

      const result = await service.importTemplate(ORG_ID, 'GAAP_USA', true);
      expect(mockPrisma.account.deleteMany).toHaveBeenCalled();
      expect(result.template).toBe('GAAP_USA');
      expect(result.imported).toBeGreaterThan(0);
    });

    it('imports GAAP template without clearing existing accounts by default', async () => {
      mockPrisma.account.upsert.mockResolvedValue(makeAccount());

      const result = await service.importTemplate(ORG_ID, 'GAAP_USA');
      expect(mockPrisma.account.deleteMany).not.toHaveBeenCalled();
      expect(result.imported).toBeGreaterThan(50); // GAAP has 80+ accounts
    });

    it('imports IFRS template', async () => {
      mockPrisma.account.upsert.mockResolvedValue(makeAccount());

      const result = await service.importTemplate(ORG_ID, 'IFRS');
      expect(result.template).toBe('IFRS');
      expect(result.imported).toBeGreaterThan(50);
    });
  });

  // ─── NORMAL_BALANCE constant ─────────────────────────────────────────────
  describe('NORMAL_BALANCE constants', () => {
    it('Assets and Expenses have DEBIT normal balance', () => {
      expect(NORMAL_BALANCE[AccountType.ASSET]).toBe('DEBIT');
      expect(NORMAL_BALANCE[AccountType.EXPENSE]).toBe('DEBIT');
    });

    it('Liabilities, Equity, Revenue have CREDIT normal balance', () => {
      expect(NORMAL_BALANCE[AccountType.LIABILITY]).toBe('CREDIT');
      expect(NORMAL_BALANCE[AccountType.EQUITY]).toBe('CREDIT');
      expect(NORMAL_BALANCE[AccountType.REVENUE]).toBe('CREDIT');
    });
  });
});
