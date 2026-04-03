/**
 * src/modules/expenses/dto/expense.dto.ts
 *
 * Request validation DTOs for the Expenses module.
 * Monetary amounts are plain numbers in the DTO — Decimal conversion
 * happens in the service layer, never here.
 *
 * Sprint: S3 · Week 7–8
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsUUID,
  IsNumber,
  IsPositive,
  IsEnum,
  IsDateString,
  IsBoolean,
  MaxLength,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { ExpenseStatus } from '@prisma/client';

// ─── Expense line DTO ─────────────────────────────────────────────────────────

export class CreateExpenseLineDto {
  @ApiProperty({ description: 'GL Account UUID to debit for this line item' })
  @IsUUID()
  accountId!: string;

  @ApiProperty({ example: 'Client dinner at Café de Paris' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 3500, description: 'Amount in the expense currency' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  amount!: number;

  @ApiProperty({ example: 'Meals & Entertainment', description: 'Expense category for reporting' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category!: string;
}

// ─── Create expense ───────────────────────────────────────────────────────────

export class CreateExpenseDto {
  @ApiProperty({ example: 'March 2025 Business Trip — Lahore to Karachi' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({
    example: 'Three-day client engagement including accommodation and travel.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'PKR', default: 'PKR' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @ApiProperty({
    type: [CreateExpenseLineDto],
    minItems: 1,
    maxItems: 50,
    description: 'At least one line item is required. Lines map to GL accounts.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'An expense must have at least one line item' })
  @ArrayMaxSize(50, { message: 'An expense cannot exceed 50 line items' })
  @ValidateNested({ each: true })
  @Type(() => CreateExpenseLineDto)
  lines!: CreateExpenseLineDto[];
}

// ─── Approve ──────────────────────────────────────────────────────────────────

export class ApproveExpenseDto {
  @ApiPropertyOptional({ example: 'Approved — amounts verified against receipts.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export class RejectExpenseDto {
  @ApiProperty({ example: 'Receipt for meal exceeds policy limit of PKR 2,500 per person.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Rejection note must be at least 10 characters — explain the reason clearly.',
  })
  @MaxLength(1000)
  rejectionNote!: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export class QueryExpensesDto {
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

  @ApiPropertyOptional({
    enum: ['DRAFT', 'SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_APPROVED', 'POSTED', 'REJECTED'],
  })
  @IsOptional()
  @IsString()
  status?: ExpenseStatus;

  @ApiPropertyOptional({ description: 'Filter by claimant user UUID' })
  @IsOptional()
  @IsUUID()
  claimantId?: string;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'If true, return only expenses awaiting my approval' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  pendingMyApproval?: boolean;
}

// ─── Receipt upload initiation ────────────────────────────────────────────────

export class InitiateReceiptUploadDto {
  @ApiProperty({ example: 'receipt_acme_march_2025.jpg' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME type: image/jpeg | image/png | application/pdf',
  })
  @IsString()
  @IsEnum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], {
    message: 'Only JPEG, PNG, WEBP images and PDF files are accepted.',
  })
  mimeType!: string;

  @ApiProperty({ example: 512000, description: 'File size in bytes (max 10 MB)' })
  @IsNumber()
  @Min(1)
  @Max(10 * 1024 * 1024, { message: 'Receipt file must not exceed 10 MB.' })
  sizeBytes!: number;
}

/*
 * Sprint S3 · Expense DTOs · Week 7–8
 * Owned by: Expense team
 */
