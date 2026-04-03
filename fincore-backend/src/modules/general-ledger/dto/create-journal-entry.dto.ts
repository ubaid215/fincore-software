// src/modules/general-ledger/dto/create-journal-entry.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsDateString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsPositive,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JournalLineDto {
  @ApiProperty({ description: 'Account UUID' })
  @IsUUID()
  accountId!: string;

  @ApiPropertyOptional({ example: 'Cash received from client' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiProperty({ example: 50000, description: 'Debit amount in line currency (0 if credit side)' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  debit!: number;

  @ApiProperty({ example: 0, description: 'Credit amount in line currency (0 if debit side)' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  credit!: number;

  @ApiPropertyOptional({ example: 'PKR', default: 'PKR' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currency?: string;

  @ApiPropertyOptional({ example: 1, description: 'FX rate to base currency (PKR). Default 1.' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  fxRate?: number;
}

export class CreateJournalEntryDto {
  @ApiProperty({ example: 'Client payment received — Invoice INV-2025-000042' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiPropertyOptional({ example: 'INV-2025-000042', description: 'External reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ example: '2025-03-15', description: 'ISO 8601 date of the transaction' })
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional({
    description: 'Fiscal period UUID — auto-detected from entryDate if omitted',
  })
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiProperty({ type: [JournalLineDto], minItems: 2, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(2, { message: 'A journal entry must have at least 2 lines' })
  @ArrayMaxSize(50, { message: 'A journal entry cannot exceed 50 lines' })
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}

export class QueryJournalEntriesDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: ['DRAFT', 'POSTED', 'REVERSED'] })
  @IsOptional()
  @IsString()
  status?: 'DRAFT' | 'POSTED' | 'REVERSED';

  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-03-31' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
