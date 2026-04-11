// src/modules/calendar/dto/calendar.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsEmail,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventVisibility, EventStatus, AttendeeStatus } from '@prisma/client';

// ─── Create Event ─────────────────────────────────────────────────────────────

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Q3 Review Meeting' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Review Q3 financials with the team' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Conference Room A' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiProperty({ example: '2025-09-15T09:00:00.000Z' })
  @IsDateString()
  startAt!: string;

  @ApiProperty({ example: '2025-09-15T10:00:00.000Z' })
  @IsDateString()
  endAt!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({
    description: 'RFC 5545 RRULE string — e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR',
    example: 'FREQ=WEEKLY;BYDAY=MO',
  })
  @IsOptional()
  @IsString()
  recurrenceRule?: string;

  @ApiPropertyOptional({ example: '#3b82f6', description: 'Hex color for calendar UI' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({ enum: EventVisibility, default: EventVisibility.TEAM })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.CONFIRMED })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  // ── Links to other domain records ─────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Contact UUID to associate with this event' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ description: 'Source record type e.g. "Invoice", "SaleOrder"' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Source record UUID' })
  @IsOptional()
  @IsUUID()
  resourceId?: string;

  // ── Attendees (can add on create) ─────────────────────────────────────────
  @ApiPropertyOptional({
    type: [Object],
    description: 'Initial attendees. userId for internal, email for external.',
  })
  @IsOptional()
  @IsArray()
  attendees?: CreateAttendeeDto[];
}

export class UpdateCalendarEventDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(200) location?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsBoolean() allDay?: boolean;
  @IsOptional() @IsBoolean() isRecurring?: boolean;
  @IsOptional() @IsString() recurrenceRule?: string;
  @IsOptional() @IsString() @MaxLength(7) color?: string;
  @IsOptional() @IsEnum(EventVisibility) visibility?: EventVisibility;
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @IsOptional() @IsUUID() contactId?: string;
}

// ─── Attendee ─────────────────────────────────────────────────────────────────

export class CreateAttendeeDto {
  @ApiPropertyOptional({ description: 'Internal user UUID' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: 'External attendee email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class UpdateAttendeeStatusDto {
  @ApiProperty({ enum: AttendeeStatus })
  @IsEnum(AttendeeStatus)
  status!: AttendeeStatus;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export class QueryCalendarEventDto {
  @ApiPropertyOptional({ example: '2025-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-09-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ description: 'Filter by organizer userId' })
  @IsOptional()
  @IsUUID()
  organizerId?: string;

  @ApiPropertyOptional({ description: 'Filter by linked contact UUID' })
  @IsOptional()
  @IsUUID()
  contactId?: string;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ enum: EventVisibility })
  @IsOptional()
  @IsEnum(EventVisibility)
  visibility?: EventVisibility;
}
