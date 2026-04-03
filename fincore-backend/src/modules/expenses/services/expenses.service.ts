/**
 * src/modules/expenses/services/expenses.service.ts
 *
 * Core Expense service — 3-step approval workflow:
 *   DRAFT → SUBMITTED → MANAGER_APPROVED → FINANCE_APPROVED → POSTED
 *                    ↘ REJECTED (from any approval step)
 *
 * Key design decisions:
 *  - Each transition is a separate public method with an explicit role check
 *  - GL posting happens inside a Prisma transaction — atomically
 *  - Total is re-computed from lines on create; DTO total is never trusted
 *  - REJECTED expenses can be revised (back to DRAFT) for resubmission
 *
 * Sprint: S3 · Week 7–8
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ExpenseStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { GeneralLedgerService } from '../../general-ledger/services/general-ledger.service';
import { CreateExpenseDto, RejectExpenseDto, QueryExpensesDto } from '../dto/expense.dto';
import { EXPENSE_TRANSITIONS, type ComputedExpenseLine } from '../types/expense.types';
import Decimal from 'decimal.js';
import { toDecimal, roundMoney } from '../../../common/utils/decimal.util';
import {
  buildPaginatedResult,
  parsePagination,
  type PaginatedResult,
} from '../../../common/utils/pagination.util';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly glService: GeneralLedgerService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(organizationId: string, claimantId: string, dto: CreateExpenseDto) {
    // Validate all accounts exist in this org and are not locked/archived
    await this.validateAccounts(
      organizationId,
      dto.lines.map((l) => l.accountId),
    );

    const computedLines = this.computeLines(dto.lines);
    const totalAmount = computedLines.reduce(
      (sum, l) => sum.plus(toDecimal(l.amount)),
      new Decimal(0),
    );

    return this.prisma.expense.create({
      data: {
        organizationId,
        claimantId,
        title: dto.title,
        description: dto.description ?? null,
        currency: (dto.currency ?? 'PKR').toUpperCase(),
        totalAmount: roundMoney(totalAmount).toString(),
        status: ExpenseStatus.DRAFT,
        lines: {
          create: computedLines,
        },
      },
      include: this.defaultInclude(),
    });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  async findAll(
    organizationId: string,
    query: QueryExpensesDto,
    requestorId: string,
    requestorRole: UserRole,
  ): Promise<PaginatedResult<Awaited<ReturnType<typeof this.findOneOrFail>>>> {
    const { page, limit, skip } = parsePagination({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });

    const where: Prisma.ExpenseWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.claimantId ? { claimantId: query.claimantId } : {}),
      ...(query.fromDate || query.toDate
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
      // Non-managers only see their own expenses unless they have approval authority
      ...(requestorRole === UserRole.VIEWER ? { claimantId: requestorId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: this.defaultInclude(),
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(organizationId: string, expenseId: string) {
    return this.findOneOrFail(organizationId, expenseId);
  }

  // ─── Submit (DRAFT → SUBMITTED) ────────────────────────────────────────────

  async submit(organizationId: string, expenseId: string, claimantId: string) {
    const expense = await this.findOneOrFail(organizationId, expenseId);

    // Only the claimant can submit their own expense
    if (expense.claimantId !== claimantId) {
      throw new ForbiddenException('Only the expense claimant can submit this expense');
    }

    this.assertTransition(expense.status, ExpenseStatus.SUBMITTED, expense.id);

    // Must have at least one receipt to submit
    if (expense.receipts.length === 0) {
      throw new BadRequestException(
        'An expense must have at least one receipt attached before submission. ' +
          'Upload receipts using POST /v1/expenses/:id/receipts/initiate',
      );
    }

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: ExpenseStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
  }

  // ─── Manager approve (SUBMITTED → MANAGER_APPROVED) ────────────────────────

  async approveByManager(organizationId: string, expenseId: string, approverId: string) {
    const expense = await this.findOneOrFail(organizationId, expenseId);
    this.assertTransition(expense.status, ExpenseStatus.MANAGER_APPROVED, expense.id);

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: ExpenseStatus.MANAGER_APPROVED,
        approverId,
        approvedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
  }

  // ─── Finance approve (MANAGER_APPROVED → FINANCE_APPROVED) ─────────────────

  async approveByFinance(organizationId: string, expenseId: string, approverId: string) {
    const expense = await this.findOneOrFail(organizationId, expenseId);
    this.assertTransition(expense.status, ExpenseStatus.FINANCE_APPROVED, expense.id);

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: ExpenseStatus.FINANCE_APPROVED,
        approverId,
        approvedAt: new Date(),
      },
      include: this.defaultInclude(),
    });
  }

  // ─── Post to GL (FINANCE_APPROVED → POSTED) ────────────────────────────────

  async postToGL(
    organizationId: string,
    expenseId: string,
    glApPayableAccountId: string, // Accounts Payable account UUID (org-specific)
  ) {
    const expense = await this.findOneOrFail(organizationId, expenseId);
    this.assertTransition(expense.status, ExpenseStatus.POSTED, expense.id);

    // Build GL entry: DR each expense account, CR Accounts Payable
    const totalAmount = toDecimal(expense.totalAmount.toString());

    const glDto = {
      description: `Expense posted: ${expense.title}`,
      reference: expense.id,
      entryDate: new Date().toISOString().slice(0, 10),
      lines: [
        // Debit each expense line
        ...expense.lines.map(
          (line: { accountId: string; amount: Decimal; description: string }) => ({
            accountId: line.accountId,
            description: line.description,
            debit: Number(toDecimal(line.amount.toString()).toDecimalPlaces(4)),
            credit: 0,
            currency: expense.currency,
            fxRate: 1,
          }),
        ),
        // Credit Accounts Payable (single line for the total)
        {
          accountId: glApPayableAccountId,
          description: `Accounts Payable — ${expense.title}`,
          debit: 0,
          credit: Number(totalAmount.toDecimalPlaces(4)),
          currency: expense.currency,
          fxRate: 1,
        },
      ],
    };

    return this.prisma.$transaction(async (tx) => {
      // Create and immediately post the GL entry
      const glEntry = await this.glService.createJournalEntry(organizationId, glDto);
      await this.glService.postJournalEntry(organizationId, glEntry.id);

      // Mark expense as POSTED
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data: {
          status: ExpenseStatus.POSTED,
          postedToGLAt: new Date(),
        },
        include: this.defaultInclude(),
      });

      this.logger.log(`Expense ${expenseId} posted to GL as entry ${glEntry.entryNumber}`);

      return { expense: updated, glEntryNumber: glEntry.entryNumber };
    });
  }

  // ─── Reject (from SUBMITTED | MANAGER_APPROVED | FINANCE_APPROVED) ─────────

  async reject(organizationId: string, expenseId: string, dto: RejectExpenseDto) {
    const expense = await this.findOneOrFail(organizationId, expenseId);
    this.assertTransition(expense.status, ExpenseStatus.REJECTED, expense.id);

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: ExpenseStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionNote: dto.rejectionNote,
      },
      include: this.defaultInclude(),
    });
  }

  // ─── Re-draft after rejection (REJECTED → DRAFT) ───────────────────────────

  async redraft(organizationId: string, expenseId: string, claimantId: string) {
    const expense = await this.findOneOrFail(organizationId, expenseId);

    if (expense.status !== ExpenseStatus.REJECTED) {
      throw new ConflictException(
        `Only REJECTED expenses can be re-drafted. Current status: ${expense.status}`,
      );
    }
    if (expense.claimantId !== claimantId) {
      throw new ForbiddenException('Only the original claimant can re-draft an expense');
    }

    return this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: ExpenseStatus.DRAFT,
        rejectedAt: null,
        rejectionNote: null,
        submittedAt: null,
        approvedAt: null,
        approverId: null,
      },
      include: this.defaultInclude(),
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private assertTransition(from: ExpenseStatus, to: ExpenseStatus, expenseId: string): void {
    const allowed = EXPENSE_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Invalid transition for expense ${expenseId}: ${from} → ${to}. ` +
          `Allowed from ${from}: [${allowed.join(', ') || 'none — terminal state'}]`,
      );
    }
  }

  private computeLines(lines: CreateExpenseDto['lines']): ComputedExpenseLine[] {
    return lines.map((line) => ({
      accountId: line.accountId,
      description: line.description,
      amount: roundMoney(toDecimal(line.amount)).toString(),
      category: line.category,
    }));
  }

  private async validateAccounts(organizationId: string, accountIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(accountIds)];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: uniqueIds }, organizationId },
    });

    if (accounts.length !== uniqueIds.length) {
      const foundIds = new Set(accounts.map((a) => a.id));
      const missingIds = uniqueIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `GL accounts not found in this organization: ${missingIds.join(', ')}`,
      );
    }

    const locked = accounts.filter((a) => a.isLocked || a.isArchived);
    if (locked.length > 0) {
      throw new BadRequestException(
        `Accounts are locked/archived: ${locked.map((a) => a.accountCode).join(', ')}`,
      );
    }
  }

  private async findOneOrFail(organizationId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, organizationId },
      include: this.defaultInclude(),
    });
    if (!expense) {
      throw new NotFoundException(`Expense ${expenseId} not found in this organization`);
    }
    return expense;
  }

  private defaultInclude() {
    return {
      lines: { orderBy: { id: 'asc' as const } },
      receipts: { orderBy: { createdAt: 'asc' as const } },
      claimant: { select: { id: true, firstName: true, lastName: true, email: true } },
      approver: { select: { id: true, firstName: true, lastName: true, email: true } },
    };
  }
}

/*
 * Sprint S3 · ExpensesService · Week 7–8
 * State machine: DRAFT → SUBMITTED → MANAGER_APPROVED → FINANCE_APPROVED → POSTED
 *                REJECTED at any approval step; REJECTED → DRAFT (revision)
 * GL posting: atomic transaction — creates + posts JournalEntry in one tx
 */
