// src/modules/financial-reports/dto/report-params.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class BalanceSheetQueryDto {
  @ApiProperty({ required: false, description: 'As of date (ISO format)' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export class ProfitLossQueryDto {
  @ApiProperty({ description: 'Start date (ISO format)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date (ISO format)' })
  @IsDateString()
  endDate!: string;
}

export class TrialBalanceQueryDto {
  @ApiProperty({ required: false, description: 'As of date (ISO format)' })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export class CashFlowQueryDto {
  @ApiProperty({ description: 'Start date (ISO format)' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date (ISO format)' })
  @IsDateString()
  endDate!: string;
}

export class ReportExportQueryDto {
  @ApiProperty({ enum: ['pdf', 'csv'], description: 'Export format' })
  @IsString()
  format!: 'pdf' | 'csv';
}
