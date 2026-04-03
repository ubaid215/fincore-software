// src/modules/general-ledger/services/general-ledger.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { FiscalPeriodsService } from '../../chart-of-accounts/services/fiscal-periods.service';
import { JournalEntryStatus, PeriodStatus, Prisma } from '@prisma/client';
import { CreateJournalEntryDto, QueryJournalEntriesDto } from '../dto/create-journal-entry.dto';
import Decimal from 'decimal.js';
import { buildPaginatedResult } from '../../../common/utils/pagination.util';

// Configure Decimal for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

@Injectable()
export class GeneralLedgerService {
  private readonly logger = new Logger(GeneralLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalPeriods: FiscalPeriodsService,
  ) {}

  // ─── Create Journal Entry ──────────────────────────────────────────────────

  async createJournalEntry(organizationId: string, dto: CreateJournalEntryDto) {
    const entryDate = new Date(dto.entryDate);

    // 1. Double-entry validation — MUST run before any DB calls
    this.assertDoubleEntry(dto.lines);

    // 2. Validate each line has either debit OR credit (not both, not neither)
    this.assertLineValidity(dto.lines);

    // 3. Fiscal period check
    await this.fiscalPeriods.assertPeriodOpen(organizationId, entryDate);

    // 4. Validate all accounts exist, belong to org, and are not locked/archived
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const accountMap = await this.validateAndLoadAccounts(
      organizationId,
      dto.lines.map((l) => l.accountId),
    );

    // 5. Auto-detect or validate periodId
    const resolvedPeriodId = await this.resolvePeriodId(organizationId, entryDate, dto.periodId);

    // 6. Generate sequential entry number atomically using SELECT FOR UPDATE
    const entryNumber = await this.generateEntryNumberAtomic(organizationId);

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber,
          description: dto.description,
          reference: dto.reference,
          entryDate,
          periodId: resolvedPeriodId,
          status: JournalEntryStatus.DRAFT,
          lines: {
            create: dto.lines.map((line) => {
              const debit = new Decimal(line.debit ?? 0);
              const credit = new Decimal(line.credit ?? 0);
              const fxRate = new Decimal(line.fxRate ?? 1);
              return {
                accountId: line.accountId,
                description: line.description,
                debit: debit.toFixed(4),
                credit: credit.toFixed(4),
                fxRate: fxRate.toFixed(6),
                currency: line.currency ?? 'PKR',
                baseCurrencyDebit: debit.mul(fxRate).toFixed(4),
                baseCurrencyCredit: credit.mul(fxRate).toFixed(4),
              };
            }),
          },
        },
        include: {
          lines: {
            include: { account: { select: { accountCode: true, name: true, type: true } } },
          },
        },
      });

      this.logger.log(`Journal entry ${entry.entryNumber} created for org ${organizationId}`);
      return entry;
    });
  }

  // ─── Post Journal Entry ────────────────────────────────────────────────────

  async postJournalEntry(organizationId: string, entryId: string) {
    const entry = await this.findOneOrFail(organizationId, entryId);

    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new ConflictException(
        `Journal entry '${entry.entryNumber}' is already ${entry.status} and cannot be posted`,
      );
    }

    // Re-validate period hasn't been closed since entry was created
    if (entry.periodId) {
      const period = await this.prisma.fiscalPeriod.findUnique({ where: { id: entry.periodId } });
      if (period && period.status !== PeriodStatus.OPEN) {
        throw new BadRequestException(
          `Cannot post: fiscal period "${period.name}" is now ${period.status}`,
        );
      }
    }

    return this.prisma.journalEntry.update({
      where: { id: entryId },
      data: { status: JournalEntryStatus.POSTED, postedAt: new Date() },
      include: {
        lines: { include: { account: { select: { accountCode: true, name: true, type: true } } } },
      },
    });
  }

  // ─── Reverse Journal Entry ─────────────────────────────────────────────────

  async reverseJournalEntry(
    organizationId: string,
    entryId: string,
    opts: { reversalDate?: string; description?: string } = {},
  ) {
    const original = await this.findOneOrFail(organizationId, entryId);

    if (original.status !== JournalEntryStatus.POSTED) {
      throw new BadRequestException(
        `Only POSTED journal entries can be reversed. Entry '${original.entryNumber}' is ${original.status}`,
      );
    }
    if (original.isReversed) {
      throw new ConflictException(`Entry '${original.entryNumber}' has already been reversed`);
    }

    const reversalDate = opts.reversalDate ? new Date(opts.reversalDate) : new Date();

    // Check reversal date's period is open
    await this.fiscalPeriods.assertPeriodOpen(organizationId, reversalDate);

    const reversalPeriodId = await this.resolvePeriodId(organizationId, reversalDate);
    const reversalNumber = await this.generateEntryNumberAtomic(organizationId);
    const reversalDesc =
      opts.description ?? `Reversal of ${original.entryNumber}: ${original.description}`;

    return this.prisma.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber: reversalNumber,
          description: reversalDesc,
          reference: original.reference,
          entryDate: reversalDate,
          periodId: reversalPeriodId,
          status: JournalEntryStatus.POSTED,
          reversalOfId: original.id,
          postedAt: new Date(),
          lines: {
            create: original.lines.map((line) => ({
              accountId: line.accountId,
              description: line.description,
              // Swap debit ↔ credit
              debit: line.credit.toString(),
              credit: line.debit.toString(),
              currency: line.currency,
              fxRate: line.fxRate.toString(),
              baseCurrencyDebit: line.baseCurrencyCredit.toString(),
              baseCurrencyCredit: line.baseCurrencyDebit.toString(),
            })),
          },
        },
        include: { lines: true },
      });

      await tx.journalEntry.update({
        where: { id: original.id },
        data: { isReversed: true, status: JournalEntryStatus.REVERSED },
      });

      this.logger.log(`Entry ${original.entryNumber} reversed as ${reversalNumber}`);
      return reversal;
    });
  }

  // ─── Delete DRAFT Entry ────────────────────────────────────────────────────

  async deleteDraft(organizationId: string, entryId: string) {
    const entry = await this.findOneOrFail(organizationId, entryId);

    if (entry.status !== JournalEntryStatus.DRAFT) {
      throw new ConflictException(
        `Only DRAFT entries can be deleted. Entry '${entry.entryNumber}' is ${entry.status}`,
      );
    }

    // Cascade deletes journal lines via onDelete: Cascade in schema
    await this.prisma.journalEntry.delete({ where: { id: entryId } });
    return { deleted: true, entryNumber: entry.entryNumber };
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  async findAll(organizationId: string, query: QueryJournalEntriesDto) {
    const { page = 1, limit = 20, status, fromDate, toDate } = query;

    const where: Prisma.JournalEntryWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(fromDate ? { entryDate: { gte: new Date(fromDate) } } : {}),
      ...(toDate ? { entryDate: { lte: new Date(toDate) } } : {}),
      ...(fromDate && toDate
        ? { entryDate: { gte: new Date(fromDate), lte: new Date(toDate) } }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: { select: { accountCode: true, name: true, type: true } } },
          },
          period: { select: { name: true, status: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { entryDate: 'desc' },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(organizationId: string, entryId: string) {
    return this.findOneOrFail(organizationId, entryId);
  }

  // ─── Account Balance ───────────────────────────────────────────────────────

  async getAccountBalance(
    organizationId: string,
    accountId: string,
    opts: { asOf?: Date; periodId?: string } = {},
  ) {
    // Verify account belongs to org
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, organizationId },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);

    const dateFilter: Prisma.DateTimeFilter | undefined = opts.asOf
      ? { lte: opts.asOf }
      : undefined;

    const result = await this.prisma.journalLine.aggregate({
      where: {
        accountId,
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          ...(dateFilter ? { entryDate: dateFilter } : {}),
          ...(opts.periodId ? { periodId: opts.periodId } : {}),
        },
      },
      _sum: {
        baseCurrencyDebit: true,
        baseCurrencyCredit: true,
      },
    });

    const totalDebit = new Decimal(result._sum.baseCurrencyDebit?.toString() ?? '0');
    const totalCredit = new Decimal(result._sum.baseCurrencyCredit?.toString() ?? '0');

    // Net balance in normal balance direction
    // Assets/Expenses: debit - credit (positive = normal)
    // Liabilities/Equity/Revenue: credit - debit (positive = normal)
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
    const netBalance = isDebitNormal
      ? totalDebit.minus(totalCredit)
      : totalCredit.minus(totalDebit);

    return {
      accountCode: account.accountCode,
      accountName: account.name,
      accountType: account.type,
      totalDebit: totalDebit.toDecimalPlaces(4).toNumber(),
      totalCredit: totalCredit.toDecimalPlaces(4).toNumber(),
      netBalance: netBalance.toDecimalPlaces(4).toNumber(),
      normalBalance: isDebitNormal ? 'DEBIT' : 'CREDIT',
    };
  }

  // ─── Trial Balance ─────────────────────────────────────────────────────────

  async getTrialBalance(organizationId: string, opts: { periodId?: string; asOf?: Date } = {}) {
    const dateFilter = opts.asOf ? { lte: opts.asOf } : undefined;

    const lines = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        journalEntry: {
          organizationId,
          status: JournalEntryStatus.POSTED,
          ...(dateFilter ? { entryDate: dateFilter } : {}),
          ...(opts.periodId ? { periodId: opts.periodId } : {}),
        },
      },
      _sum: { baseCurrencyDebit: true, baseCurrencyCredit: true },
    });

    const accountIds = lines.map((l) => l.accountId);
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, accountCode: true, name: true, type: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    const rows = lines
      .map((l) => {
        const account = accountMap.get(l.accountId);
        const debit = new Decimal(l._sum.baseCurrencyDebit?.toString() ?? '0');
        const credit = new Decimal(l._sum.baseCurrencyCredit?.toString() ?? '0');
        totalDebits = totalDebits.plus(debit);
        totalCredits = totalCredits.plus(credit);

        return {
          accountId: l.accountId,
          accountCode: account?.accountCode ?? 'UNKNOWN',
          accountName: account?.name ?? 'Unknown Account',
          accountType: account?.type,
          debit: debit.toDecimalPlaces(4).toNumber(),
          credit: credit.toDecimalPlaces(4).toNumber(),
        };
      })
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    const isBalanced = totalDebits.equals(totalCredits);

    return {
      rows,
      totalDebits: totalDebits.toDecimalPlaces(4).toNumber(),
      totalCredits: totalCredits.toDecimalPlaces(4).toNumber(),
      isBalanced,
      // If not balanced there is a data integrity issue — never should happen
      imbalance: totalDebits.minus(totalCredits).toDecimalPlaces(4).toNumber(),
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Validate double-entry: SUM(debits) must equal SUM(credits) exactly.
   * Uses Decimal.js to avoid floating-point drift.
   */
  private assertDoubleEntry(lines: Array<{ debit: number; credit: number }>) {
    const totalDebit = lines.reduce((s, l) => s.plus(l.debit ?? 0), new Decimal(0));
    const totalCredit = lines.reduce((s, l) => s.plus(l.credit ?? 0), new Decimal(0));

    if (totalDebit.isZero() && totalCredit.isZero()) {
      throw new BadRequestException(
        'Journal entry must have at least one non-zero line. All amounts are zero.',
      );
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Double-entry constraint violated: total debits (${totalDebit.toFixed(4)}) ≠ total credits (${totalCredit.toFixed(4)}). ` +
          `Difference: ${totalDebit.minus(totalCredit).abs().toFixed(4)}`,
      );
    }
  }

  /** Each line must have debit XOR credit > 0, not both, not neither */
  private assertLineValidity(lines: Array<{ debit: number; credit: number; accountId: string }>) {
    lines.forEach((line, i) => {
      const debit = new Decimal(line.debit ?? 0);
      const credit = new Decimal(line.credit ?? 0);

      if (debit.isNegative() || credit.isNegative()) {
        throw new BadRequestException(
          `Line ${i + 1} (account ${line.accountId}): debit and credit must be non-negative`,
        );
      }

      if (debit.gt(0) && credit.gt(0)) {
        throw new BadRequestException(
          `Line ${i + 1} (account ${line.accountId}): a single line cannot have both debit and credit amounts. ` +
            `Split into two separate lines.`,
        );
      }
    });
  }

  private async validateAndLoadAccounts(organizationId: string, accountIds: string[]) {
    const uniqueIds = [...new Set(accountIds)];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: uniqueIds }, organizationId },
    });

    if (accounts.length !== uniqueIds.length) {
      const foundIds = new Set(accounts.map((a) => a.id));
      const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Accounts not found in this organization: ${missingIds.join(', ')}`,
      );
    }

    const locked = accounts.filter((a) => a.isLocked);
    if (locked.length > 0) {
      throw new BadRequestException(
        `Accounts are locked and cannot receive journal entries: ${locked.map((a) => a.accountCode).join(', ')}`,
      );
    }

    const archived = accounts.filter((a) => a.isArchived);
    if (archived.length > 0) {
      throw new BadRequestException(
        `Accounts are archived and cannot receive journal entries: ${archived.map((a) => a.accountCode).join(', ')}`,
      );
    }

    return new Map(accounts.map((a) => [a.id, a]));
  }

  private async resolvePeriodId(
    organizationId: string,
    entryDate: Date,
    explicitPeriodId?: string,
  ): Promise<string | null> {
    if (explicitPeriodId) {
      const period = await this.prisma.fiscalPeriod.findFirst({
        where: { id: explicitPeriodId, organizationId },
      });
      if (!period) {
        throw new NotFoundException(`Fiscal period ${explicitPeriodId} not found`);
      }
      if (entryDate < period.startDate || entryDate > period.endDate) {
        throw new BadRequestException(
          `Entry date ${entryDate.toISOString().slice(0, 10)} is outside fiscal period ` +
            `"${period.name}" (${period.startDate.toISOString().slice(0, 10)} → ${period.endDate.toISOString().slice(0, 10)})`,
        );
      }
      return explicitPeriodId;
    }

    const period = await this.fiscalPeriods.findByDate(organizationId, entryDate);
    return period?.id ?? null;
  }

  /**
   * Generate sequential entry number using raw SQL with advisory lock.
   * Prevents race conditions under concurrent writes.
   * Format: JE-YYYY-NNNNNN (e.g. JE-2025-000042)
   */
  private async generateEntryNumberAtomic(organizationId: string): Promise<string> {
    const lockKey = this.orgIdToLockKey(organizationId);

    // Acquire advisory lock first (returns void — must be separate from SELECT)
    await this.prisma.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    const result = await this.prisma.$queryRaw<[{ next_number: bigint }]>`
    SELECT (SELECT COUNT(*) FROM "JournalEntry" WHERE "organizationId" = ${organizationId}) + 1 AS next_number
  `;

    const seq = Number(result[0].next_number);
    const year = new Date().getFullYear();
    return `JE-${year}-${String(seq).padStart(6, '0')}`;
  }

  /** Convert org UUID to a stable int64 for pg_advisory_lock */
  private orgIdToLockKey(orgId: string): bigint {
    // Take last 8 hex chars of UUID (without dashes) → parse as int
    const hex = orgId.replace(/-/g, '').slice(-8);
    return BigInt('0x' + hex);
  }

  private async findOneOrFail(organizationId: string, entryId: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: entryId, organizationId },
      include: {
        lines: { include: { account: { select: { accountCode: true, name: true, type: true } } } },
        period: { select: { name: true, status: true } },
      },
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${entryId} not found in this organization`);
    }
    return entry;
  }
}
