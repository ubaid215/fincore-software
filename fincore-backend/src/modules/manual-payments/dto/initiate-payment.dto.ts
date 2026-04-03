// src/modules/manual-payments/dto/initiate-payment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'Subscription ID to pay for' })
  @IsUUID()
  @IsNotEmpty()
  subscriptionId!: string;

  @ApiProperty({ description: 'Payment amount (must match plan price)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiProperty({ description: 'Customer name for pro-forma invoice', required: false })
  @IsOptional()
  @IsString()
  customerName?: string;
}

export class InitiatePaymentResponseDto {
  @ApiProperty()
  referenceCode!: string;

  @ApiProperty()
  proformaPdfUrl!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  expiresAt!: Date;
}
