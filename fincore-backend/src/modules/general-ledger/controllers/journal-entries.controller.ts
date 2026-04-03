// src/modules/general-ledger/controllers/journal-entries.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { GeneralLedgerService } from '../services/general-ledger.service';
import { CreateJournalEntryDto, QueryJournalEntriesDto } from '../dto/create-journal-entry.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';

@ApiTags('general-ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'journal-entries', version: '1' })
export class JournalEntriesController {
  constructor(private readonly glService: GeneralLedgerService) {}

  @Post()
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a DRAFT journal entry — validates double-entry before writing' })
  @ApiResponse({
    status: 400,
    description: 'Double-entry violated, zero entry, locked account, or closed period',
  })
  create(@OrgId() orgId: string, @Body() dto: CreateJournalEntryDto) {
    return this.glService.createJournalEntry(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List journal entries with optional filters' })
  findAll(@OrgId() orgId: string, @Query() query: QueryJournalEntriesDto) {
    return this.glService.findAll(orgId, query);
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Generate Trial Balance — all accounts with debit/credit totals' })
  @ApiQuery({ name: 'asOf', required: false, description: 'ISO date — balance as of this date' })
  @ApiQuery({
    name: 'periodId',
    required: false,
    description: 'Restrict to a specific fiscal period',
  })
  getTrialBalance(
    @OrgId() orgId: string,
    @Query('asOf') asOf?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.glService.getTrialBalance(orgId, {
      asOf: asOf ? new Date(asOf) : undefined,
      periodId: periodId ?? undefined,
    });
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Journal entry UUID' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.glService.findOne(orgId, id);
  }

  @Get('accounts/:accountId/balance')
  @ApiOperation({ summary: 'Get account running balance from posted journal lines' })
  @ApiParam({ name: 'accountId' })
  @ApiQuery({ name: 'asOf', required: false })
  @ApiQuery({ name: 'periodId', required: false })
  getAccountBalance(
    @OrgId() orgId: string,
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query('asOf') asOf?: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.glService.getAccountBalance(orgId, accountId, {
      asOf: asOf ? new Date(asOf) : undefined,
      periodId: periodId ?? undefined,
    });
  }

  @Patch(':id/post')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Post a DRAFT journal entry — makes it permanent and updates balances' })
  @ApiResponse({ status: 409, description: 'Entry is not in DRAFT status' })
  post(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.glService.postJournalEntry(orgId, id);
  }

  @Post(':id/reverse')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Reverse a POSTED entry — creates new entry with swapped debits/credits',
  })
  @ApiBody({
    schema: {
      properties: {
        reversalDate: { type: 'string', example: '2025-04-01' },
        description: { type: 'string', example: 'Correcting entry for March accrual' },
      },
    },
  })
  reverse(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reversalDate?: string; description?: string },
  ) {
    return this.glService.reverseJournalEntry(orgId, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a DRAFT entry — POSTED entries cannot be deleted, only reversed',
  })
  @ApiResponse({ status: 409, description: 'Entry is not in DRAFT status' })
  deleteDraft(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.glService.deleteDraft(orgId, id);
  }
}
