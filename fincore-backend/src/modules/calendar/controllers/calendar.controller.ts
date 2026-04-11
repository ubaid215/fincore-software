// src/modules/calendar/controllers/calendar.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CalendarService } from '../services/calendar.service';
import {
  CreateCalendarEventDto,
  UpdateCalendarEventDto,
  QueryCalendarEventDto,
  CreateAttendeeDto,
  UpdateAttendeeStatusDto,
} from '../dto/calendar.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgId, RequireApp } from '../../../common/decorators/organization.decorator';
import { OrgJwtPayload } from '../../../common/types/jwt-payload.type';
import { AppKey } from '@prisma/client';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireApp(AppKey.CALENDAR)
@Controller({ path: 'calendar', version: '1' })
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a calendar event' })
  createEvent(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Body() dto: CreateCalendarEventDto,
  ) {
    return this.calendarService.createEvent(orgId, user.sub, dto);
  }

  @Get('events')
  @ApiOperation({ summary: 'List events — filter by date range, organizer, contact, status' })
  findEvents(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Query() query: QueryCalendarEventDto,
  ) {
    return this.calendarService.findEvents(orgId, user.sub, query);
  }

  @Get('events/upcoming')
  @ApiOperation({ summary: 'My upcoming events — next N days (default 7)' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getMyUpcoming(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Query('days') days?: number,
  ) {
    return this.calendarService.getMyUpcoming(orgId, user.sub, days ? Number(days) : 7);
  }

  @Get('events/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get event detail with attendees' })
  findOne(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.findOne(orgId, id, user.sub);
  }

  @Patch('events/:id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update event' })
  updateEvent(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarEventDto,
  ) {
    return this.calendarService.updateEvent(orgId, id, user.sub, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Delete event' })
  deleteEvent(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.calendarService.deleteEvent(orgId, id, user.sub);
  }

  // ── Attendees ─────────────────────────────────────────────────────────────

  @Post('events/:id/attendees')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Add an attendee to an event' })
  addAttendee(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAttendeeDto,
  ) {
    return this.calendarService.addAttendee(orgId, id, user.sub, dto);
  }

  @Patch('events/:id/attendees/:attendeeId/status')
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'attendeeId' })
  @ApiOperation({ summary: 'Update own attendance status (ACCEPTED / DECLINED / TENTATIVE)' })
  updateAttendeeStatus(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attendeeId', ParseUUIDPipe) attendeeId: string,
    @Body() dto: UpdateAttendeeStatusDto,
  ) {
    return this.calendarService.updateAttendeeStatus(orgId, id, attendeeId, user.sub, dto);
  }

  @Delete('events/:id/attendees/:attendeeId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'attendeeId' })
  @ApiOperation({ summary: 'Remove an attendee from an event' })
  removeAttendee(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attendeeId', ParseUUIDPipe) attendeeId: string,
  ) {
    return this.calendarService.removeAttendee(orgId, id, attendeeId);
  }
}
