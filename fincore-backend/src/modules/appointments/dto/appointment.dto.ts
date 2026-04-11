// src/modules/appointments/dto/appointment.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'Onboarding Call' })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Walk through the dashboard features' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ example: '2025-09-15T10:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiPropertyOptional({ example: 30, description: 'Duration in minutes', default: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  @Type(() => Number)
  durationMinutes?: number;

  @ApiPropertyOptional({ example: 'Office — 3rd Floor' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ example: 'https://meet.google.com/xyz-abc-def' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  meetingUrl?: string;

  @ApiPropertyOptional({ description: 'Contact UUID to link this appointment to' })
  @IsOptional()
  @IsUUID()
  contactId?: string;
}

export class UpdateAppointmentDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsInt() @Min(5) @Max(480) durationMinutes?: number;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsString() @MaxLength(255) meetingUrl?: string;
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsUUID() contactId?: string;
}

export class CancelAppointmentDto {
  @ApiPropertyOptional({ example: 'Client requested reschedule' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}

export class QueryAppointmentDto {
  @ApiPropertyOptional({ example: '2025-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-09-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsOptional()
  @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @ApiPropertyOptional({ description: 'Filter by contact UUID' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 25 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
