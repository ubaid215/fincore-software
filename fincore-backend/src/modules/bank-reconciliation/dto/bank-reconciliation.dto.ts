/**
 * src/modules/bank-reconciliation/dto/bank-reconciliation.dto.ts
 * Sprint: S3 · Week 7–8
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { MatchStatus } from '@prisma/client';

// ─── Upload statement ─────────────────────────────────────────────────────

export class UploadStatementDto {
  @ApiProperty({ example: 'HBL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bankName!: string;

  @ApiProperty({ example: 'PK00HABB0000000000000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  accountNumber!: string;

  @ApiProperty({ enum: ['CSV', 'OFX', 'QFX'], example: 'CSV' })
  @IsEnum(['CSV', 'OFX', 'QFX'])
  format!: 'CSV' | 'OFX' | 'QFX';
}

// ─── Manual match ─────────────────────────────────────────────────────────

export class ManualMatchDto {
  @ApiProperty({ description: 'Bank transaction UUID to match' })
  @IsUUID()
  bankTransactionId!: string;

  @ApiProperty({ description: 'Journal entry UUID to match against' })
  @IsUUID()
  journalEntryId!: string;
}

// ─── Query transactions ───────────────────────────────────────────────────

export class QueryTransactionsDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: ['UNMATCHED', 'AUTO_MATCHED', 'MANUALLY_MATCHED', 'EXCLUDED'] })
  @IsOptional()
  @IsString()
  matchStatus?: MatchStatus;

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-03-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/*
 * Sprint S3 · Bank Reconciliation DTOs · Week 7–8
 */
