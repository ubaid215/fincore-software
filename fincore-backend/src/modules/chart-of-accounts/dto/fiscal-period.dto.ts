// src/modules/chart-of-accounts/dto/fiscal-period.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreateFiscalPeriodDto {
  @ApiProperty({ example: 'FY 2025 Q1', description: 'Human-readable period name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '2025-01-01', description: 'ISO 8601 date — period start (inclusive)' })
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2025-03-31', description: 'ISO 8601 date — period end (inclusive)' })
  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}
