/**
 * src/modules/invoicing/dto/create-invoice.dto.ts
 *
 * FIXES:
 *  17. customerId field added (FK to Contact)
 *  18. purchaseOrder field added (client's PO reference)
 *  19. terms field added (payment terms text)
 *  20. exchangeRate field added
 *  21. RecurringPeriod enum aligned with schema: WEEKLY|BIWEEKLY|MONTHLY|QUARTERLY|ANNUALLY
 *  22. QueryInvoicesDto — customerId filter added
 *  23. QueryInvoicesDto — VIEWED and OVERDUE added to status enum
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
  IsUUID,
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
import { InvoiceStatus, RecurringPeriod } from '@prisma/client';

// ─── Line item ─────────────────────────────────────────────────────────────

export class CreateInvoiceLineItemDto {
  @ApiPropertyOptional({ description: 'Product UUID — auto-fills description and price' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ example: 'Software Development — March 2025' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 40 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 5000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 'GST17' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  taxCode?: string;

  @ApiPropertyOptional({
    example: 0.17,
    description: 'Tax rate as decimal (0.17 = 17%)',
    default: 0,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  taxRate?: number;

  @ApiPropertyOptional({
    example: 0.05,
    description: 'Discount rate as decimal (0.05 = 5%)',
    default: 0,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  discount?: number;

  @ApiPropertyOptional({ example: 0, description: 'Display order within invoice' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;
}

// ─── Create invoice ────────────────────────────────────────────────────────

export class CreateInvoiceDto {
  // FIX 17: customerId — links invoice to a Contact record
  @ApiPropertyOptional({ description: 'Contact UUID — links this invoice to a contact record' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  // Client snapshot fields (always stored even when customerId is provided,
  // so the invoice remains accurate if the Contact is later edited)
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

  @ApiPropertyOptional({ example: '1234567-8', description: 'Client NTN / GST / VAT number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  clientTaxId?: string;

  // FIX 18: purchaseOrder — client's PO reference number
  @ApiPropertyOptional({
    example: 'PO-2025-0042',
    description: "Client's purchase order reference",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  purchaseOrder?: string;

  @ApiProperty({ example: '2025-06-01' })
  @IsDateString()
  issueDate!: string;

  @ApiPropertyOptional({ example: '2025-06-30' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ example: 'PKR', default: 'PKR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  // FIX 20: exchangeRate field
  @ApiPropertyOptional({
    example: 278.5,
    description: 'Exchange rate to org base currency (PKR). Default 1 for PKR invoices.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  exchangeRate?: number;

  // FIX 19: terms — payment terms text
  @ApiPropertyOptional({ example: 'Payment due within 30 days. Late fee of 2% per month.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  terms?: string;

  @ApiPropertyOptional({ example: 'Thank you for your business.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  // FIX 21: RecurringPeriod aligned with schema enum
  @ApiPropertyOptional({
    enum: RecurringPeriod,
    description: 'WEEKLY | BIWEEKLY | MONTHLY | QUARTERLY | ANNUALLY',
  })
  @IsOptional()
  @IsEnum(RecurringPeriod)
  recurringPeriod?: RecurringPeriod;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Stop generating after this date' })
  @IsOptional()
  @IsDateString()
  recurringEndDate?: string;

  @ApiProperty({ type: [CreateInvoiceLineItemDto], minItems: 1, maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one line item is required' })
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems!: CreateInvoiceLineItemDto[];
}

// ─── Update invoice (DRAFT only) ──────────────────────────────────────────

export class UpdateInvoiceDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() clientEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) clientAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) clientTaxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) terms?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) purchaseOrder?: string;
}

// ─── Record payment ────────────────────────────────────────────────────────

export class RecordPaymentDto {
  @ApiProperty({
    example: 50000,
    description: 'Amount in invoice currency. Partial payments allowed.',
  })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ example: 'PKR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 278.5, description: 'Exchange rate used for this payment' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  exchangeRate?: number;

  @ApiProperty({
    example: 'bank_transfer',
    enum: ['bank_transfer', 'cash', 'cheque', 'online', 'other'],
  })
  @IsString()
  @IsEnum(['bank_transfer', 'cash', 'cheque', 'online', 'other'])
  method!: string;

  @ApiPropertyOptional({ example: 'TXN-HBL-20250601-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'Partial payment via HBL transfer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ example: '2025-06-01' })
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

  @ApiPropertyOptional({ example: 25, default: 25 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  // FIX 23: VIEWED and OVERDUE added
  @ApiPropertyOptional({
    enum: InvoiceStatus,
    description: 'DRAFT | SENT | VIEWED | PARTIALLY_PAID | PAID | OVERDUE | VOID | DISPUTED',
  })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  // FIX 22: customerId filter
  @ApiPropertyOptional({ description: 'Filter by Contact UUID (customer)' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'ACME' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientName?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    description: 'Only return overdue invoices (dueDate < today, status ≠ PAID|VOID)',
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  overdueOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only return recurring invoices' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  recurringOnly?: boolean;
}
