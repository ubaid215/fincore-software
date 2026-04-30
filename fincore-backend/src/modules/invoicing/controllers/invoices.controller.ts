/**
 * src/modules/invoicing/controllers/invoices.controller.ts
 *
 * FIXES:
 *  14. @RequireApp(AppKey.INVOICING) added
 *  15. customerId query param support via QueryInvoicesDto
 *  16. GET /:id/payments endpoint added
 *      userId injected into create/send/void/dispute/recordPayment/remove
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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserRole, AppKey } from '@prisma/client';
import { InvoicesService } from '../services/invoices.service';
import { InvoicesTrackingService } from '../services/invoices-tracking.service';
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
import { OrgId, RequireApp } from '../../../common/decorators/organization.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgJwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('invoicing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireApp(AppKey.INVOICING) // FIX 14
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly trackingService: InvoicesTrackingService,
    private readonly fxService: FxRateService,
  ) {}

  // ── Tracking / stats ───────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard KPIs — totals by status, revenue, outstanding, overdue' })
  getStats(@OrgId() orgId: string) {
    return this.trackingService.getStats(orgId);
  }

  @Get('overdue')
  @ApiOperation({ summary: 'List all overdue invoices for alerts' })
  getOverdue(@OrgId() orgId: string) {
    return this.trackingService.getOverdue(orgId);
  }

  @Get(':id/timeline')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Activity timeline — audit logs + payments merged, newest first' })
  getTimeline(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.trackingService.getTimeline(orgId, id);
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  @Post()
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a DRAFT invoice — links to Contact, enforces plan limits' })
  @ApiResponse({ status: 402, description: 'Invoice limit reached — upgrade plan' })
  @ApiResponse({ status: 409, description: 'Duplicate invoice number' })
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(orgId, user.sub, dto);
  }

  // ── List ───────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List invoices — filter by status, contact, date, currency, overdue' })
  findAll(@OrgId() orgId: string, @Query() query: QueryInvoicesDto) {
    return this.invoicesService.findAll(orgId, query);
  }

  // ── Single ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get invoice with line items, payments, and customer Contact' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.findOne(orgId, id);
  }

  // ── Payments list (FIX 16) ─────────────────────────────────────────────────

  @Get(':id/payments')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'List all payment records for an invoice' })
  getPayments(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.getPayments(orgId, id);
  }

  // ── Update DRAFT ───────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles(UserRole.ACCOUNTANT)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update a DRAFT invoice — rejected if status is not DRAFT' })
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
    summary: 'Send invoice — DRAFT→SENT, triggers async PDF, notifies contact portal',
  })
  send(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.send(orgId, id, user.sub);
  }

  @Patch(':id/viewed')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Mark invoice as viewed — called from client portal' })
  markViewed(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.markViewed(orgId, id);
  }

  @Patch(':id/void')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Void invoice — cannot void PAID invoices' })
  void(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.void(orgId, id, user.sub);
  }

  @Patch(':id/dispute')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Mark invoice as DISPUTED' })
  dispute(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.markDisputed(orgId, id, user.sub);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  @Post(':id/payments')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Record a payment — partial or full. Auto-advances status.' })
  @ApiResponse({ status: 400, description: 'Payment exceeds outstanding balance' })
  recordPayment(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoicesService.recordPayment(orgId, id, user.sub, dto);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Soft-delete a DRAFT or VOID invoice' })
  remove(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invoicesService.remove(orgId, id, user.sub);
  }

  // ── PDF ────────────────────────────────────────────────────────────────────

  @Post(':id/pdf/regenerate')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Re-trigger PDF generation — returns BullMQ job ID' })
  regeneratePdf(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoicesService.regeneratePdf(orgId, id);
  }

  // ── FX rates ───────────────────────────────────────────────────────────────

  @Get('fx/rates')
  @ApiOperation({ summary: 'Current PKR exchange rates — Redis-cached, refreshed hourly' })
  getFxRates() {
    return this.fxService.getAllRates();
  }

  @Get('fx/rate/:currency')
  @ApiParam({ name: 'currency', example: 'USD' })
  @ApiOperation({ summary: 'PKR exchange rate for a specific currency' })
  getFxRate(@Param('currency') currency: string) {
    return this.fxService.getRate(currency);
  }
}
