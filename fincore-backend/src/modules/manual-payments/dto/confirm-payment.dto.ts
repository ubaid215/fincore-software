// src/modules/manual-payments/dto/confirm-payment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Reference code from pro-forma invoice' })
  @IsString()
  @MinLength(8)
  @MaxLength(8)
  referenceCode!: string;

  @ApiProperty({ description: 'Optional note about this confirmation', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectPaymentDto {
  @ApiProperty({ description: 'Reference code from pro-forma invoice' })
  @IsString()
  @MinLength(8)
  @MaxLength(8)
  referenceCode!: string;

  @ApiProperty({ description: 'Reason for rejection' })
  @IsString()
  @MinLength(10)
  rejectionReason!: string;
}
