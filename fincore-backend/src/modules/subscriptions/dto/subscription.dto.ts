/**
 * src/modules/subscriptions/dto/subscription.dto.ts
 *
 * Request validation DTOs for the Subscriptions module.
 *
 * Sprint: S4 · Week 9–10
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Start trial ──────────────────────────────────────────────────────────

export class StartTrialDto {
  @ApiProperty({ description: 'Plan UUID to start trial on' })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({
    example: '2025-09-30',
    description: 'Trial end date. Defaults to 14 days.',
  })
  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;
}

// ─── Activate / upgrade ───────────────────────────────────────────────────

export class ActivateSubscriptionDto {
  @ApiProperty({ description: 'Plan UUID to activate' })
  @IsUUID()
  planId!: string;
}

export class UpgradeSubscriptionDto {
  @ApiProperty({ description: 'New plan UUID to upgrade to' })
  @IsUUID()
  planId!: string;
}

// ─── Update seats ─────────────────────────────────────────────────────────

export class UpdateSeatCountDto {
  @ApiProperty({
    example: 5,
    description: 'New total seat count (must be >= current member count)',
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  seatCount!: number;
}

// ─── Cancel / suspend ─────────────────────────────────────────────────────

export class CancelSubscriptionDto {
  @ApiPropertyOptional({ example: 'Switching to a competitor — price too high.', maxLength: 500 })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SuspendSubscriptionDto {
  @ApiProperty({ enum: ['PAST_DUE', 'MANUAL'], example: 'MANUAL' })
  @IsEnum(['PAST_DUE', 'MANUAL'])
  reason!: 'PAST_DUE' | 'MANUAL';
}

/*
 * Sprint S4 · Subscription DTOs · Week 9–10
 * Owned by: Billing team
 */
