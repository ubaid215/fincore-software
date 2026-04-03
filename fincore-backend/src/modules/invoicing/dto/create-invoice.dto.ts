/**
 * src/modules/invoicing/dto/create-invoice.dto.ts
 *
 * Request body validation for the Invoicing module.
 * All monetary fields are validated as positive numbers — Decimal.js
 * conversion happens in the service layer, never in the DTO.
 *
 * Sprint: S2 · Week 5–6
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsPositive,
  Min,
  Max,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { InvoiceStatus } from '@prisma/client';

// ─── Line item DTO ─────────────────────────────────────────────────────────

export class CreateInvoiceLineItemDto {
  @ApiProperty({ example: 'Software Development — March 2025' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 40, description: 'Number of units (hours, items, etc.)' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 5000, description: 'Price per unit in invoice currency (PKR default)' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'GST17', description: 'Tax code identifier for reporting' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxCode?: string;

  @ApiPropertyOptional({
    example: 0.17,
    description: 'Tax rate as a decimal (0.17 = 17% GST). Applied to line total after discount.',
    default: 0,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  taxRate?: number;

  @ApiPropertyOptional({
    example: 0.05,
    description: 'Discount rate as a decimal (0.05 = 5%). Applied before tax.',
    default: 0,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  discount?: number;
}

// ─── Create invoice ────────────────────────────────────────────────────────

export class CreateInvoiceDto {
  @ApiProperty({ example: 'ACME Corporation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  clientName!: string;

  @ApiPropertyOptional({ example: 'billing@acme.com' })
  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @ApiPropertyOptional({ example: '123 Main Street, Karachi, Pakistan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  clientAddress?: string;

  @ApiProperty({ example: '2025-06-01', description: 'ISO 8601 date the invoice is issued' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ example: '2025-06-30', description: 'Payment due date (optional)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    example: 'PKR',
    default: 'PKR',
    description: 'ISO 4217 currency code. Use PKR for local, USD/EUR for international.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Payment due within 30 days. Late fee of 2% per month.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Mark as recurring — template for auto-generation on each billing cycle.',
  })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    example: 'MONTHLY',
    description: 'Recurring period: MONTHLY, QUARTERLY, ANNUAL',
  })
  @IsOptional()
  @IsString()
  @IsEnum(['MONTHLY', 'QUARTERLY', 'ANNUAL'])
  recurringPeriod?: string;

  @ApiProperty({
    type: [CreateInvoiceLineItemDto],
    minItems: 1,
    maxItems: 100,
    description: 'At least one line item is required.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice must have at least one line item' })
  @ArrayMaxSize(100, { message: 'An invoice cannot exceed 100 line items' })
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems!: CreateInvoiceLineItemDto[];
}

// ─── Update invoice ────────────────────────────────────────────────────────

export class UpdateInvoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() clientEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) clientAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

// ─── Record payment ────────────────────────────────────────────────────────

export class RecordPaymentDto {
  @ApiProperty({
    example: 50000,
    description: 'Amount paid in the invoice currency. Can be a partial payment.',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({
    example: 'PKR',
    description: 'Currency of the payment. Must match invoice currency for PKR invoices.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiProperty({
    example: 'bank_transfer',
    description: 'Payment method: bank_transfer | cash | cheque | online',
  })
  @IsString()
  @IsEnum(['bank_transfer', 'cash', 'cheque', 'online', 'other'])
  method!: string;

  @ApiPropertyOptional({
    example: 'TXN-HBL-20250601-12345',
    description: 'Bank transaction reference or cheque number',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ example: '2025-06-01', description: 'Date the payment was received' })
  @IsDateString()
  paidAt!: string;
}

// ─── Query params ──────────────────────────────────────────────────────────

export class QueryInvoicesDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID', 'DISPUTED'] })
  @IsOptional()
  @IsString()
  status?: InvoiceStatus;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'ACME', description: 'Filter by client name (partial match)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientName?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Filter by invoice currency' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Return only overdue invoices (dueDate < today, not PAID/VOID)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  overdueOnly?: boolean;
}

/*
 * Sprint S2 · Invoicing & Billing · Week 5–6
 * Owned by: Invoicing team
 */
