/**
 * src/modules/invoicing/controllers/invoices.controller.ts
 *
 * HTTP controller for the Invoice resource.
 * All monetary amounts in responses are Prisma Decimal objects —
 * serialized to strings by JSON.stringify, not native JS numbers.
 *
 * Sprint: S2 · Week 5–6
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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InvoicesService } from '../services/invoices.service';
import { FxRateService } from '../services/fx-rate.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  RecordPaymentDto,
  QueryInvoicesDto,
} from '../dto/create-invoice.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';

@ApiTags('invoicing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly fxService: FxRateService,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a DRAFT invoice with computed line item totals' })
  @ApiResponse({ status: 201, description: 'Invoice created with invoiceNumber INV-YYYY-NNNNNN' })
  @ApiResponse({
    status: 400,
    description: 'Validation error — missing required fields or invalid amounts',
  })
  create(@OrgId() orgId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(orgId, dto);
  }

  // ── List ───────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List invoices with optional filters — paginated' })
  findAll(@OrgId() orgId: string, @Query() query: QueryInvoicesDto) {
    return this.invoicesService.findAll(orgId, query);
  }

  // ── Single ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiOperation({ summary: 'Get a single invoice with line items and payment history' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(orgId, id);
  }

  // ── Update DRAFT ───────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.ACCOUNTANT)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update a DRAFT invoice — rejected once the invoice is SENT' })
  @ApiResponse({ status: 409, description: 'Invoice is not in DRAFT status' })
  update(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(orgId, id, dto);
  }

  // ── State transitions ──────────────────────────────────────────────────────

  @Patch(':id/send')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Mark invoice as SENT — triggers async PDF generation via BullMQ',
    description:
      'Transitions DRAFT → SENT. A PDF is generated asynchronously and uploaded to S3. ' +
      'The client receives a response immediately; invoice.pdfUrl is populated within seconds.',
  })
  @ApiResponse({ status: 409, description: 'Invoice is not in DRAFT status' })
  send(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.send(orgId, id);
  }

  @Patch(':id/void')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Void an invoice — PAID invoices cannot be voided (issue a credit note)',
  })
  @ApiResponse({ status: 409, description: 'Invalid state transition or invoice is PAID' })
  void(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.void(orgId, id);
  }

  @Patch(':id/dispute')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Mark invoice as DISPUTED — triggers investigation workflow' })
  @ApiResponse({ status: 409, description: 'Transition not allowed from current status' })
  dispute(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.markDisputed(orgId, id);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  @Post(':id/payments')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiOperation({
    summary: 'Record a payment against an invoice',
    description:
      'Supports partial payments. Status auto-advances to PARTIALLY_PAID or PAID. ' +
      'Overpayment is rejected — record the actual amount received.',
  })
  @ApiResponse({ status: 400, description: 'Payment exceeds outstanding balance' })
  @ApiResponse({
    status: 409,
    description: 'Invoice status does not accept payments (e.g. DRAFT, VOID)',
  })
  recordPayment(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoicesService.recordPayment(orgId, id, dto);
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  @Post(':id/pdf/regenerate')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Re-trigger PDF generation — returns job ID',
    description:
      'Enqueues a new PDF generation job. The invoice.pdfUrl is updated when the job completes.',
  })
  regeneratePdf(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.regeneratePdf(orgId, id);
  }

  // ── FX rates ───────────────────────────────────────────────────────────────

  @Get('fx/rates')
  @ApiOperation({ summary: 'Get current PKR exchange rates — cached in Redis, refreshed hourly' })
  getFxRates() {
    return this.fxService.getAllRates();
  }

  @Get('fx/rate/:currency')
  @ApiParam({ name: 'currency', example: 'USD', description: 'ISO 4217 currency code' })
  @ApiOperation({ summary: 'Get PKR exchange rate for a specific currency' })
  getFxRate(@Param('currency') currency: string) {
    return this.fxService.getRate(currency);
  }
}

/*
 * Sprint S2 · Invoices Controller · Week 5–6
 * Endpoints: 11 total (CRUD + state transitions + payments + FX)
 * Owned by: Invoicing team
 */
