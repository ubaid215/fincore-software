/**
 * src/modules/bank-reconciliation/services/bank-reconciliation.service.ts
 *
 * Core Bank Reconciliation service.
 *
 * Workflow:
 *   1. Import statement (CSV / OFX / QFX) → parse + persist transactions + upload to S3
 *   2. Run auto-match → matches bank txns to GL journal entries
 *   3. Manual match → accountant manually links remaining unmatched transactions
 *   4. Exclude → mark a bank txn as intentionally unmatched (bank fee, etc.)
 *   5. Reconciliation report → summary of matched/unmatched with totals
 *
 * Sprint: S3 · Week 7–8
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { MatchStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { S3Client, PutObjectCommand, type PutObjectCommandInput } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { AutoMatchService } from './auto-match.service';
import { parseCsvStatement } from '../parsers/csv.parser';
import { parseOfxStatement, parseQfxStatement } from '../parsers/ofx.parser';
import { QueryTransactionsDto, ManualMatchDto } from '../dto/bank-reconciliation.dto';
import type { StatementFormat, AutoMatchSummary } from '../types/recon.types';
import { toDecimal } from '../../../common/utils/decimal.util';
import { buildPaginatedResult, parsePagination } from '../../../common/utils/pagination.util';
import type { PaginatedResult } from '../../../common/utils/pagination.util';

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly autoMatch: AutoMatchService,
    private readonly config: ConfigService,
  ) {
    this.s3 = new S3Client({
      region: config.get<string>('aws.region', 'ap-south-1'),
      credentials: {
        accessKeyId: config.get<string>('aws.accessKeyId', 'dummy'),
        secretAccessKey: config.get<string>('aws.secretAccessKey', 'dummy'),
      },
    });
    this.bucket = config.get<string>('aws.s3.documentsBucket', 'fincore-documents-dev');
  }

  // ─── Import statement ─────────────────────────────────────────────────────

  async importStatement(
    organizationId: string,
    bankName: string,
    accountNumber: string,
    format: StatementFormat,
    fileBuffer: Buffer,
    fileName: string,
  ) {
    // 1. Parse the file
    let parsed;
    if (format === 'CSV') {
      parsed = parseCsvStatement(fileBuffer, bankName, accountNumber);
    } else if (format === 'OFX') {
      parsed = parseOfxStatement(fileBuffer, bankName, accountNumber);
    } else if (format === 'QFX') {
      parsed = parseQfxStatement(fileBuffer, bankName, accountNumber);
    } else {
      throw new BadRequestException(`Unsupported format: ${format as string}`);
    }

    // 2. Upload raw file to S3 for audit trail
    const now = new Date();
    const s3Key = `statements/${organizationId}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${Date.now()}_${fileName}`;

    const s3Cmd: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: format === 'CSV' ? 'text/csv' : 'application/octet-stream',
      Metadata: { organizationId, bankName, accountNumber, format },
    };

    try {
      await this.s3.send(new PutObjectCommand(s3Cmd));
    } catch (err: unknown) {
      this.logger.warn(`S3 upload failed for statement ${s3Key}: ${(err as Error).message}`);
      // Don't block import if S3 is unavailable — the statement is still imported
    }

    // 3. Persist statement and transactions in a transaction
    const statement = await this.prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.create({
        data: {
          organizationId,
          bankName: parsed.bankName,
          accountNumber: parsed.accountNumber,
          currency: parsed.currency,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          s3Key,
          format,
        },
      });

      // Batch-insert transactions (chunked to avoid parameter limit)
      const CHUNK = 500;
      for (let i = 0; i < parsed.transactions.length; i += CHUNK) {
        const chunk = parsed.transactions.slice(i, i + CHUNK);
        await tx.bankTransaction.createMany({
          data: chunk.map((t) => ({
            statementId: stmt.id,
            date: t.date,
            description: t.description,
            reference: t.reference,
            debit: t.debit.toString(),
            credit: t.credit.toString(),
            balance: t.balance !== null ? t.balance.toString() : null,
            matchStatus: MatchStatus.UNMATCHED,
          })),
        });
      }

      return stmt;
    });

    this.logger.log(
      `Imported statement ${statement.id}: ${parsed.transactions.length} transactions (${format})`,
    );

    return {
      statementId: statement.id,
      bankName: parsed.bankName,
      accountNumber: parsed.accountNumber,
      format,
      periodStart: parsed.periodStart,
      periodEnd: parsed.periodEnd,
      transactionCount: parsed.transactions.length,
    };
  }

  // ─── Run auto-match ───────────────────────────────────────────────────────

  async runAutoMatch(statementId: string, organizationId: string): Promise<AutoMatchSummary> {
    await this.assertStatementBelongsToOrg(statementId, organizationId);
    return this.autoMatch.matchStatement(statementId, organizationId);
  }

  // ─── Manual match ─────────────────────────────────────────────────────────

  async manualMatch(organizationId: string, dto: ManualMatchDto) {
    // Verify bank transaction exists and belongs to org (via statement)
    const txn = await this.prisma.bankTransaction.findFirst({
      where: { id: dto.bankTransactionId, statement: { organizationId } },
    });
    if (!txn) throw new NotFoundException(`Bank transaction ${dto.bankTransactionId} not found`);

    if (
      txn.matchStatus === MatchStatus.MANUALLY_MATCHED ||
      txn.matchStatus === MatchStatus.AUTO_MATCHED
    ) {
      throw new ConflictException(
        `Transaction ${dto.bankTransactionId} is already matched (${txn.matchStatus}). ` +
          `Unmatch it first before creating a new match.`,
      );
    }

    // Verify GL entry exists and belongs to org
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id: dto.journalEntryId, organizationId },
    });
    if (!entry) throw new NotFoundException(`Journal entry ${dto.journalEntryId} not found`);

    const updated = await this.prisma.bankTransaction.update({
      where: { id: dto.bankTransactionId },
      data: {
        matchStatus: MatchStatus.MANUALLY_MATCHED,
        matchedEntryId: dto.journalEntryId,
        matchConfidence: 'HIGH',
      },
    });

    return updated;
  }

  // ─── Unmatch ──────────────────────────────────────────────────────────────

  async unmatch(organizationId: string, bankTransactionId: string) {
    const txn = await this.prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, statement: { organizationId } },
    });
    if (!txn) throw new NotFoundException(`Bank transaction ${bankTransactionId} not found`);

    if (txn.matchStatus === MatchStatus.UNMATCHED) {
      throw new ConflictException('Transaction is already unmatched');
    }

    return this.prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { matchStatus: MatchStatus.UNMATCHED, matchedEntryId: null, matchConfidence: null },
    });
  }

  // ─── Exclude ──────────────────────────────────────────────────────────────

  async exclude(organizationId: string, bankTransactionId: string) {
    const txn = await this.prisma.bankTransaction.findFirst({
      where: { id: bankTransactionId, statement: { organizationId } },
    });
    if (!txn) throw new NotFoundException(`Bank transaction ${bankTransactionId} not found`);

    return this.prisma.bankTransaction.update({
      where: { id: bankTransactionId },
      data: { matchStatus: MatchStatus.EXCLUDED },
    });
  }

  // ─── List statements ──────────────────────────────────────────────────────

  async listStatements(organizationId: string) {
    return this.prisma.bankStatement.findMany({
      where: { organizationId },
      orderBy: { importedAt: 'desc' },
    });
  }

  // ─── List transactions ────────────────────────────────────────────────────

  async listTransactions(
    statementId: string,
    organizationId: string,
    query: QueryTransactionsDto,
  ): Promise<
    PaginatedResult<Awaited<ReturnType<typeof this.prisma.bankTransaction.findMany>>[number]>
  > {
    await this.assertStatementBelongsToOrg(statementId, organizationId);

    const { page, limit, skip } = parsePagination({
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });

    const where: Prisma.BankTransactionWhereInput = {
      statementId,
      ...(query.matchStatus ? { matchStatus: query.matchStatus } : {}),
      ...(query.fromDate || query.toDate
        ? {
            date: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.bankTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
      }),
      this.prisma.bankTransaction.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // ─── Reconciliation report ────────────────────────────────────────────────

  async getReconciliationReport(statementId: string, organizationId: string) {
    await this.assertStatementBelongsToOrg(statementId, organizationId);

    const [statement, counts, totals] = await Promise.all([
      this.prisma.bankStatement.findUnique({ where: { id: statementId } }),
      this.prisma.bankTransaction.groupBy({
        by: ['matchStatus'],
        where: { statementId },
        _count: { id: true },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.bankTransaction.aggregate({
        where: { statementId },
        _sum: { debit: true, credit: true },
        _count: { id: true },
      }),
    ]);

    const byStatus: Record<string, { count: number; debit: number; credit: number }> = {};
    for (const row of counts) {
      byStatus[row.matchStatus] = {
        count: row._count.id,
        debit: toDecimal(row._sum.debit?.toString() ?? '0').toNumber(),
        credit: toDecimal(row._sum.credit?.toString() ?? '0').toNumber(),
      };
    }

    const unmatchedCount = byStatus['UNMATCHED']?.count ?? 0;
    const isReconciled = unmatchedCount === 0;

    return {
      statementId,
      statement,
      isReconciled,
      summary: {
        total: totals._count.id,
        totalDebit: toDecimal(totals._sum.debit?.toString() ?? '0').toNumber(),
        totalCredit: toDecimal(totals._sum.credit?.toString() ?? '0').toNumber(),
        byMatchStatus: byStatus,
        unmatchedCount,
      },
    };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async assertStatementBelongsToOrg(
    statementId: string,
    organizationId: string,
  ): Promise<void> {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, organizationId },
    });
    if (!stmt) {
      throw new NotFoundException(`Bank statement ${statementId} not found`);
    }
  }
}

/*
 * Sprint S3 · BankReconciliationService · Week 7–8
 * Flow: Import → AutoMatch → ManualMatch → Exclude → Report
 * Statement formats: CSV, OFX, QFX
 * Owned by: Recon team
 */
