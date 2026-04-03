/**
 * src/modules/expenses/controllers/expenses.controller.ts
 *
 * HTTP controller for the Expense Management module.
 *
 * Role conventions:
 *  - ACCOUNTANT / MANAGER / ADMIN can submit expenses
 *  - MANAGER / ADMIN can perform manager-level approvals
 *  - ACCOUNTANT / ADMIN can perform finance-level approvals and GL posting
 *  - Any authenticated user can create DRAFT expenses
 *
 * Sprint: S3 · Week 7–8
 */

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
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ExpensesService } from '../services/expenses.service';
import { ReceiptsService } from '../services/receipts.service';
import {
  CreateExpenseDto,
  RejectExpenseDto,
  QueryExpensesDto,
  InitiateReceiptUploadDto,
} from '../dto/expense.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'expenses', version: '1' })
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly receiptsService: ReceiptsService,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a DRAFT expense claim with one or more GL-account lines' })
  @ApiResponse({ status: 201, description: 'Expense created in DRAFT status' })
  @ApiResponse({ status: 404, description: 'One or more GL accounts not found' })
  create(@OrgId() orgId: string, @CurrentUser() user: JwtPayload, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(orgId, user.sub, dto);
  }

  // ── List ───────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List expense claims — VIEWERs see only their own; others see all' })
  findAll(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryExpensesDto,
  ) {
    // Role is injected by RolesGuard into request.userRole
    // We default to VIEWER so the query scopes correctly for low-privilege users
    const role = (user as JwtPayload & { userRole?: UserRole }).userRole ?? UserRole.VIEWER;
    return this.expensesService.findAll(orgId, query, user.sub, role);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Expense UUID' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.findOne(orgId, id);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  @Patch(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Submit DRAFT expense for approval — claimant only',
    description: 'At least one receipt must be attached before submission.',
  })
  @ApiResponse({ status: 400, description: 'No receipts attached' })
  @ApiResponse({ status: 403, description: 'Only the claimant can submit' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  submit(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.submit(orgId, id, user.sub);
  }

  // ── Manager approval ───────────────────────────────────────────────────────

  @Patch(':id/approve/manager')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Manager approves SUBMITTED expense — MANAGER or higher' })
  approveByManager(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.approveByManager(orgId, id, user.sub);
  }

  // ── Finance approval ───────────────────────────────────────────────────────

  @Patch(':id/approve/finance')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Finance team approves MANAGER_APPROVED expense — ACCOUNTANT or higher',
  })
  approveByFinance(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.approveByFinance(orgId, id, user.sub);
  }

  // ── Post to GL ─────────────────────────────────────────────────────────────

  @Patch(':id/post')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Post FINANCE_APPROVED expense to General Ledger — ACCOUNTANT or higher',
    description: 'Requires the Accounts Payable GL account UUID for the credit side.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['apAccountId'],
      properties: {
        apAccountId: {
          type: 'string',
          format: 'uuid',
          description: 'Accounts Payable account UUID — the credit side of the GL entry',
        },
      },
    },
  })
  postToGL(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('apAccountId', ParseUUIDPipe) apAccountId: string,
  ) {
    return this.expensesService.postToGL(orgId, id, apAccountId);
  }

  // ── Reject ─────────────────────────────────────────────────────────────────

  @Patch(':id/reject')
  @Roles(UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Reject an expense — MANAGER or higher; rejection note is required' })
  reject(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
  ) {
    return this.expensesService.reject(orgId, id, dto);
  }

  // ── Re-draft after rejection ───────────────────────────────────────────────

  @Patch(':id/redraft')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Return a REJECTED expense to DRAFT for revision — claimant only' })
  redraft(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.redraft(orgId, id, user.sub);
  }

  // ── Receipts ───────────────────────────────────────────────────────────────

  @Post(':id/receipts/initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', description: 'Expense UUID' })
  @ApiOperation({
    summary: 'Get a presigned S3 URL to upload a receipt — claimant only',
    description:
      'Step 1 of the 2-step upload flow. Returns a PUT URL valid for 5 minutes. ' +
      'After uploading, call POST /v1/expenses/:id/receipts/:receiptId/confirm.',
  })
  initiateReceiptUpload(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateReceiptUploadDto,
  ) {
    return this.receiptsService.initiateUpload(id, orgId, user.sub, dto);
  }

  @Post(':id/receipts/:receiptId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Expense UUID' })
  @ApiParam({ name: 'receiptId', description: 'Receipt UUID' })
  @ApiOperation({ summary: 'Confirm receipt upload — verifies file exists in S3' })
  confirmReceiptUpload(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
  ) {
    return this.receiptsService.confirmUpload(id, orgId, receiptId);
  }

  @Get(':id/receipts')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'List all receipts attached to an expense' })
  listReceipts(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.receiptsService.listReceipts(id, orgId);
  }

  @Delete(':id/receipts/:receiptId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'receiptId' })
  @ApiOperation({ summary: 'Delete a receipt from a DRAFT expense — claimant only' })
  deleteReceipt(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
  ) {
    return this.receiptsService.deleteReceipt(id, orgId, receiptId, user.sub);
  }
}

/*
 * Sprint S3 · ExpensesController · Week 7–8
 * Endpoints: 10 total (CRUD + 3-step approval + receipt management)
 * Owned by: Expense team
 */
