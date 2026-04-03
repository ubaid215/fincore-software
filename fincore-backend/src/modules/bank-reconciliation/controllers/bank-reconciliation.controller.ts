/**
 * src/modules/bank-reconciliation/controllers/bank-reconciliation.controller.ts
 *
 * HTTP controller for Bank Reconciliation.
 *
 * File upload uses Multer (memory storage) — the buffer is passed directly
 * to BankReconciliationService.importStatement(). Max file size: 5 MB.
 *
 * Sprint: S3 · Week 7–8
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { BankReconciliationService } from '../services/bank-reconciliation.service';
import {
  UploadStatementDto,
  ManualMatchDto,
  QueryTransactionsDto,
} from '../dto/bank-reconciliation.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';

// ── Local Multer file interface (avoids requiring @types/multer globally) ──

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// ── Multer memory storage configuration ───────────────────────────────────

const ALLOWED_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'text/plain', // some browsers send CSV as text/plain
  'application/vnd.ms-excel', // CSV on Windows
  'application/x-ofx',
  'application/ofx',
  'application/qfx',
  'application/octet-stream', // generic binary — format detected from content
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

@ApiTags('bank-reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'bank-reconciliation', version: '1' })
export class BankReconciliationController {
  constructor(private readonly reconService: BankReconciliationService) {}

  // ── Import statement ───────────────────────────────────────────────────────

  @Post('statements/import')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: undefined, // memory storage — buffer available as file.buffer
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (
        _req: Express.Request,
        file: MulterFile,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (ALLOWED_MIMETYPES.has(file.mimetype) || /\.(csv|ofx|qfx)$/i.test(file.originalname)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              `Unsupported file type: ${file.mimetype}. Upload CSV, OFX, or QFX.`,
            ),
            false,
          );
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Bank statement file (CSV, OFX, or QFX) + metadata',
    schema: {
      type: 'object',
      required: ['file', 'bankName', 'accountNumber', 'format'],
      properties: {
        file: { type: 'string', format: 'binary' },
        bankName: { type: 'string', example: 'HBL' },
        accountNumber: { type: 'string', example: 'PK00HABB0000000000000000' },
        format: { type: 'string', enum: ['CSV', 'OFX', 'QFX'] },
      },
    },
  })
  @ApiOperation({
    summary: 'Import a bank statement — ACCOUNTANT or higher',
    description:
      'Parses CSV/OFX/QFX, persists transactions, uploads raw file to S3. ' +
      'Returns statement ID and transaction count. Run /auto-match after import.',
  })
  @ApiResponse({ status: 400, description: 'Parse error or unsupported file format' })
  async importStatement(
    @OrgId() orgId: string,
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadStatementDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Send a multipart/form-data request with a "file" field.',
      );
    }

    return this.reconService.importStatement(
      orgId,
      dto.bankName,
      dto.accountNumber,
      dto.format,
      file.buffer,
      file.originalname,
    );
  }

  // ── List statements ────────────────────────────────────────────────────────

  @Get('statements')
  @ApiOperation({ summary: 'List all imported bank statements for the organization' })
  listStatements(@OrgId() orgId: string) {
    return this.reconService.listStatements(orgId);
  }

  // ── List transactions ──────────────────────────────────────────────────────

  @Get('statements/:statementId/transactions')
  @ApiParam({ name: 'statementId', description: 'Bank statement UUID' })
  @ApiOperation({
    summary: 'List transactions in a statement — filterable by match status and date',
  })
  listTransactions(
    @OrgId() orgId: string,
    @Param('statementId', ParseUUIDPipe) statementId: string,
    @Query() query: QueryTransactionsDto,
  ) {
    return this.reconService.listTransactions(statementId, orgId, query);
  }

  // ── Auto-match ─────────────────────────────────────────────────────────────

  @Post('statements/:statementId/auto-match')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'statementId' })
  @ApiOperation({
    summary: 'Run auto-matching on all UNMATCHED transactions in a statement',
    description:
      'Matches bank transactions to GL journal entries using: ' +
      'amount ±0.01 PKR, date ±3 days, Levenshtein reference similarity. ' +
      'Returns count of matched / unmatched transactions.',
  })
  autoMatch(@OrgId() orgId: string, @Param('statementId', ParseUUIDPipe) statementId: string) {
    return this.reconService.runAutoMatch(statementId, orgId);
  }

  // ── Manual match ───────────────────────────────────────────────────────────

  @Post('manual-match')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually link a bank transaction to a GL journal entry',
    description: 'Use when auto-match did not find a match or matched incorrectly.',
  })
  @ApiResponse({ status: 404, description: 'Bank transaction or journal entry not found' })
  @ApiResponse({ status: 409, description: 'Transaction already matched — unmatch first' })
  manualMatch(@OrgId() orgId: string, @Body() dto: ManualMatchDto) {
    return this.reconService.manualMatch(orgId, dto);
  }

  // ── Unmatch ────────────────────────────────────────────────────────────────

  @Patch('transactions/:transactionId/unmatch')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'transactionId' })
  @ApiOperation({ summary: 'Remove an existing match — sets status back to UNMATCHED' })
  unmatch(@OrgId() orgId: string, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.reconService.unmatch(orgId, transactionId);
  }

  // ── Exclude ────────────────────────────────────────────────────────────────

  @Patch('transactions/:transactionId/exclude')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'transactionId' })
  @ApiOperation({
    summary: 'Exclude a transaction from reconciliation',
    description: 'Use for bank fees, transfers, or items that do not have a GL counterpart.',
  })
  exclude(@OrgId() orgId: string, @Param('transactionId', ParseUUIDPipe) transactionId: string) {
    return this.reconService.exclude(orgId, transactionId);
  }

  // ── Reconciliation report ──────────────────────────────────────────────────

  @Get('statements/:statementId/report')
  @ApiParam({ name: 'statementId' })
  @ApiOperation({
    summary: 'Get reconciliation report — isReconciled flag + totals by match status',
    description:
      'isReconciled = true only when all transactions are matched or excluded. ' +
      'Returns totals for debit/credit per match status bucket.',
  })
  getReport(@OrgId() orgId: string, @Param('statementId', ParseUUIDPipe) statementId: string) {
    return this.reconService.getReconciliationReport(statementId, orgId);
  }
}

/*
 * Sprint S3 · BankReconciliationController · Week 7–8
 * Endpoints: 8 total (import, list, auto-match, manual-match, unmatch, exclude, report)
 * File upload: Multer memory storage, max 5 MB
 * Owned by: Recon team
 */
