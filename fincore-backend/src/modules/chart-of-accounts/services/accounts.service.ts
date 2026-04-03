// src/modules/chart-of-accounts/services/accounts.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccountType, Prisma } from '@prisma/client';
import { CreateAccountDto, UpdateAccountDto, CreateSubAccountDto } from '../dto/create-account.dto';
import Decimal from 'decimal.js';

const MAX_HIERARCHY_DEPTH = 8;

export const NORMAL_BALANCE: Record<AccountType, 'DEBIT' | 'CREDIT'> = {
  [AccountType.ASSET]: 'DEBIT',
  [AccountType.EXPENSE]: 'DEBIT',
  [AccountType.LIABILITY]: 'CREDIT',
  [AccountType.EQUITY]: 'CREDIT',
  [AccountType.REVENUE]: 'CREDIT',
};

type AccountWithChildren = Prisma.AccountGetPayload<object> & {
  children: AccountWithChildren[];
  fullCode?: string;
  fullName?: string;
};

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Create Account (with automatic sub-account detection) ─────────────────

  async create(organizationId: string, dto: CreateAccountDto) {
    // Check if this is a sub-account (accountCode contains hyphen or parent exists)
    const isSubAccount = dto.accountCode.includes('-') || !!dto.parentId;

    // If parentId is provided, validate parent exists
    if (dto.parentId) {
      const parent = await this.prisma.account.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.organizationId !== organizationId) {
        throw new NotFoundException(`Parent account '${dto.parentId}' not found`);
      }
      if (parent.isArchived) {
        throw new BadRequestException('Cannot add a child to an archived account');
      }
      if (parent.type !== dto.type) {
        throw new BadRequestException(
          `Account type mismatch: parent is ${parent.type} but child is ${dto.type}`,
        );
      }

      // For sub-accounts, auto-generate accountCode if not provided
      if (isSubAccount && !dto.accountCode.includes('-')) {
        // Find next available sub-account number
        const existingChildren = await this.prisma.account.findMany({
          where: { parentId: dto.parentId },
          select: { accountCode: true },
        });
        const nextNumber = (existingChildren.length + 1).toString().padStart(2, '0');
        dto.accountCode = `${parent.accountCode}-${nextNumber}`;
      }
    }

    // Check for duplicate account code
    const codeTaken = await this.prisma.account.findUnique({
      where: { organizationId_accountCode: { organizationId, accountCode: dto.accountCode } },
    });
    if (codeTaken) {
      throw new ConflictException(`Account code '${dto.accountCode}' is already in use`);
    }

    // Check hierarchy depth
    if (dto.parentId) {
      const depth = await this.getDepth(dto.parentId);
      if (depth >= MAX_HIERARCHY_DEPTH) {
        throw new BadRequestException(
          `Maximum account hierarchy depth of ${MAX_HIERARCHY_DEPTH} reached`,
        );
      }
    }

    const account = await this.prisma.account.create({
      data: {
        organizationId,
        accountCode: dto.accountCode.toUpperCase(),
        name: dto.name,
        type: dto.type,
        subType: dto.subType,
        parentId: dto.parentId,
        description: dto.description,
      },
    });

    return this.toResponseDto(account);
  }

  // ─── NEW: Create Sub-Account (e.g., HBL, UBL under Cash at Bank) ────────────

  async createSubAccount(organizationId: string, dto: CreateSubAccountDto) {
    // Find parent account
    const parent = await this.prisma.account.findUnique({
      where: { organizationId_accountCode: { organizationId, accountCode: dto.parentAccountCode } },
    });

    if (!parent) {
      throw new NotFoundException(`Parent account '${dto.parentAccountCode}' not found`);
    }

    if (parent.type !== AccountType.ASSET && parent.type !== AccountType.LIABILITY) {
      throw new BadRequestException(
        'Sub-accounts can only be created under ASSET or LIABILITY accounts',
      );
    }

    // Generate sub-account code: e.g., "1112-01"
    const subAccountCode = `${parent.accountCode}-${dto.suffix}`;

    // Check if sub-account already exists
    const existing = await this.prisma.account.findUnique({
      where: { organizationId_accountCode: { organizationId, accountCode: subAccountCode } },
    });

    if (existing) {
      throw new ConflictException(`Sub-account '${subAccountCode}' already exists`);
    }

    // Create the sub-account
    const subAccount = await this.prisma.account.create({
      data: {
        organizationId,
        accountCode: subAccountCode,
        name: dto.name,
        type: parent.type,
        subType: parent.subType,
        parentId: parent.id,
        description: dto.bankAccountNumber ? `Bank Account: ${dto.bankAccountNumber}` : null,
      },
    });

    this.logger.log(
      `Created sub-account ${subAccountCode} (${dto.name}) under ${parent.accountCode}`,
    );

    // If opening balance provided, create a journal entry for it
    if (dto.openingBalance && dto.openingBalance !== 0) {
      await this.createOpeningBalanceEntry(
        organizationId,
        subAccount.id,
        dto.openingBalance,
        parent.type,
      );
    }

    return this.toResponseDto(subAccount);
  }

  private async createOpeningBalanceEntry(
    organizationId: string,
    accountId: string,
    amount: number,
    accountType: AccountType,
  ) {
    // Find or create opening balance equity account
    let openingBalanceEquity = await this.prisma.account.findUnique({
      where: { organizationId_accountCode: { organizationId, accountCode: '3999' } },
    });

    if (!openingBalanceEquity) {
      openingBalanceEquity = await this.prisma.account.create({
        data: {
          organizationId,
          accountCode: '3999',
          name: 'Opening Balance Equity',
          type: AccountType.EQUITY,
          description: 'Auto-created for opening balance adjustments',
        },
      });
    }

    const isDebitNormal = accountType === AccountType.ASSET;
    const debit = isDebitNormal ? Math.abs(amount) : 0;
    const credit = isDebitNormal ? 0 : Math.abs(amount);

    // Create journal entry for opening balance
    await this.prisma.journalEntry.create({
      data: {
        organizationId,
        entryNumber: `OPEN-${new Date().getFullYear()}-${Date.now()}`,
        description: `Opening balance for account`,
        entryDate: new Date(),
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            {
              accountId,
              debit,
              credit,
              currency: 'PKR',
              fxRate: 1,
              baseCurrencyDebit: debit,
              baseCurrencyCredit: credit,
            },
            {
              accountId: openingBalanceEquity.id,
              debit: credit,
              credit: debit,
              currency: 'PKR',
              fxRate: 1,
              baseCurrencyDebit: credit,
              baseCurrencyCredit: debit,
            },
          ],
        },
      },
    });
  }

  // ─── Read with full code support ───────────────────────────────────────────

  async findAll(
    organizationId: string,
    opts: { type?: AccountType; includeArchived?: boolean; flat?: boolean; parentId?: string },
  ): Promise<AccountWithChildren[]> {
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        ...(opts.type ? { type: opts.type } : {}),
        ...(opts.parentId ? { parentId: opts.parentId } : {}),
        ...(!opts.includeArchived ? { isArchived: false } : {}),
      },
      orderBy: [{ accountCode: 'asc' }],
    });

    const accountsWithFullInfo = accounts.map((acc) => this.toResponseDto(acc));

    if (opts.flat) return accountsWithFullInfo as AccountWithChildren[];
    return this.buildTree(accountsWithFullInfo as AccountWithChildren[]);
  }

  async findOne(organizationId: string, accountId: string) {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
      include: {
        parent: true,
        children: { where: { isArchived: false }, orderBy: { accountCode: 'asc' } },
      },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    return this.toResponseDto(account);
  }

  async findByCode(organizationId: string, accountCode: string) {
    const account = await this.prisma.account.findUnique({
      where: {
        organizationId_accountCode: { organizationId, accountCode: accountCode.toUpperCase() },
      },
    });
    if (!account) throw new NotFoundException(`Account code '${accountCode}' not found`);
    return this.toResponseDto(account);
  }

  // ─── Get all sub-accounts under a parent ───────────────────────────────────

  async getSubAccounts(organizationId: string, parentAccountCode: string) {
    const parent = await this.findByCode(organizationId, parentAccountCode);

    const subAccounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        parentId: parent.id,
        isArchived: false,
      },
      orderBy: { accountCode: 'asc' },
    });

    return subAccounts.map((acc) => this.toResponseDto(acc));
  }

  // ─── Get account tree with full hierarchy ──────────────────────────────────

  async getAccountTree(organizationId: string, includeArchived = false) {
    const allAccounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        ...(!includeArchived ? { isArchived: false } : {}),
      },
      orderBy: [{ accountCode: 'asc' }],
    });

    const accountsWithInfo = allAccounts.map((acc) => this.toResponseDto(acc));
    return this.buildTree(accountsWithInfo as AccountWithChildren[]);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(organizationId: string, accountId: string, dto: UpdateAccountDto) {
    const account = await this.findOne(organizationId, accountId);

    if (account.isLocked) {
      throw new BadRequestException(
        `Account '${account.fullCode}' is locked and cannot be modified`,
      );
    }

    const updated = await this.prisma.account.update({
      where: { id: accountId },
      data: dto,
    });

    return this.toResponseDto(updated);
  }

  // ─── Archive / Unarchive ───────────────────────────────────────────────────

  async archive(organizationId: string, accountId: string) {
    const account = await this.findOne(organizationId, accountId);

    if (account.isLocked) {
      throw new BadRequestException('Locked accounts cannot be archived');
    }

    const activeChildren = await this.prisma.account.count({
      where: { parentId: accountId, isArchived: false },
    });
    if (activeChildren > 0) {
      throw new BadRequestException(
        `Cannot archive account '${account.fullCode}': it has ${activeChildren} active child account(s). Archive children first.`,
      );
    }

    const hasTransactions = await this.prisma.journalLine.count({
      where: {
        accountId,
        journalEntry: { status: 'POSTED' },
      },
    });
    if (hasTransactions > 0) {
      throw new BadRequestException(
        `Account '${account.fullCode}' has ${hasTransactions} posted transaction(s) and cannot be archived. Lock it instead.`,
      );
    }

    const archived = await this.prisma.account.update({
      where: { id: accountId },
      data: { isArchived: true },
    });
    return this.toResponseDto(archived);
  }

  async unarchive(organizationId: string, accountId: string) {
    const account = await this.findOne(organizationId, accountId);

    if (account.parentId) {
      const parent = await this.prisma.account.findUnique({
        where: { id: account.parentId },
      });
      if (parent?.isArchived) {
        throw new BadRequestException(
          `Cannot unarchive: parent account '${parent.accountCode}' is archived. Unarchive the parent first.`,
        );
      }
    }

    const unarchived = await this.prisma.account.update({
      where: { id: accountId },
      data: { isArchived: false },
    });
    return this.toResponseDto(unarchived);
  }

  // ─── Lock / Unlock ─────────────────────────────────────────────────────────

  async lock(organizationId: string, accountId: string) {
    await this.findOne(organizationId, accountId);
    const locked = await this.prisma.account.update({
      where: { id: accountId },
      data: { isLocked: true },
    });
    return this.toResponseDto(locked);
  }

  async unlock(organizationId: string, accountId: string) {
    await this.findOne(organizationId, accountId);
    const unlocked = await this.prisma.account.update({
      where: { id: accountId },
      data: { isLocked: false },
    });
    return this.toResponseDto(unlocked);
  }

  // ─── Helper: Convert account to response DTO with full code ────────────────

  private toResponseDto(account: any): any {
    const isSubAccount = account.accountCode.includes('-');
    const parts = account.accountCode.split('-');

    return {
      ...account,
      fullCode: account.accountCode,
      fullName: isSubAccount ? `${account.name} (${parts[1]})` : account.name,
      isSubAccount,
      // For display: parent code without suffix
      parentCode: isSubAccount ? parts[0] : null,
      // Convert Decimal to number for API response
      ...(account.balance !== undefined && {
        balance: account.balance?.toNumber?.() ?? account.balance,
      }),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async getDepth(accountId: string, depth = 0): Promise<number> {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
      select: { parentId: true },
    });
    if (!account?.parentId) return depth;
    return this.getDepth(account.parentId, depth + 1);
  }

  private buildTree(accounts: AccountWithChildren[]): AccountWithChildren[] {
    const map = new Map<string, AccountWithChildren>();
    accounts.forEach((a) => map.set(a.id, { ...a, children: [] }));

    const roots: AccountWithChildren[] = [];
    accounts.forEach((a) => {
      if (a.parentId && map.has(a.parentId)) {
        map.get(a.parentId)!.children.push(map.get(a.id)!);
      } else {
        roots.push(map.get(a.id)!);
      }
    });
    return roots;
  }

  // ─── CoA Template Import ───────────────────────────────────────────────────

  async importTemplate(
    organizationId: string,
    template: 'GAAP_USA' | 'IFRS',
    replaceExisting = false,
  ) {
    if (replaceExisting) {
      const journalCount = await this.prisma.journalEntry.count({ where: { organizationId } });
      if (journalCount > 0) {
        throw new BadRequestException(
          `Cannot replace accounts: ${journalCount} journal entries already exist. ` +
            `Replacing accounts would break historical records.`,
        );
      }
      await this.prisma.account.deleteMany({ where: { organizationId } });
      this.logger.warn(`Replaced all accounts for org ${organizationId}`);
    }

    const { GAAP_USA_ACCOUNTS } = await import('../../../../prisma/seeds/coa-gaap.seed');
    const { IFRS_ACCOUNTS } = await import('../../../../prisma/seeds/coa-ifrs.seed');
    const accounts = template === 'GAAP_USA' ? GAAP_USA_ACCOUNTS : IFRS_ACCOUNTS;

    const codeToId = new Map<string, string>();

    const topLevel = accounts.filter((a) => !a.parentCode);
    for (const a of topLevel) {
      const created = await this.prisma.account.upsert({
        where: { organizationId_accountCode: { organizationId, accountCode: a.accountCode } },
        update: { name: a.name, subType: a.subType, description: a.description },
        create: {
          organizationId,
          accountCode: a.accountCode,
          name: a.name,
          type: a.type,
          subType: a.subType,
          description: a.description,
        },
      });
      codeToId.set(a.accountCode, created.id);
    }

    const remaining = accounts.filter((a) => a.parentCode);
    let unresolved = remaining;
    let maxPasses = 10;

    while (unresolved.length > 0 && maxPasses-- > 0) {
      const nextRound: typeof unresolved = [];
      for (const a of unresolved) {
        const parentId = codeToId.get(a.parentCode!);
        if (!parentId) {
          nextRound.push(a);
          continue;
        }

        const created = await this.prisma.account.upsert({
          where: { organizationId_accountCode: { organizationId, accountCode: a.accountCode } },
          update: { name: a.name, subType: a.subType, description: a.description, parentId },
          create: {
            organizationId,
            accountCode: a.accountCode,
            name: a.name,
            type: a.type,
            subType: a.subType,
            parentId,
            description: a.description,
          },
        });
        codeToId.set(a.accountCode, created.id);
      }
      unresolved = nextRound;
    }

    if (unresolved.length > 0) {
      this.logger.error(
        `${unresolved.length} accounts could not be imported (unresolvable parents)`,
      );
    }

    this.logger.log(`Imported ${codeToId.size} ${template} accounts for org ${organizationId}`);
    return { imported: codeToId.size, template, unresolved: unresolved.length };
  }
}
