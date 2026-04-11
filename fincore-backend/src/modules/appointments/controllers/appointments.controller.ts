// src/modules/appointments/controllers/appointments.controller.ts
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
import { AppointmentsService } from '../services/appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  CancelAppointmentDto,
  QueryAppointmentDto,
} from '../dto/appointment.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgId, RequireApp } from '../../../common/decorators/organization.decorator';
import { OrgJwtPayload } from '../../../common/types/jwt-payload.type';
import { AppKey } from '@prisma/client';

@ApiTags('appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireApp(AppKey.APPOINTMENTS)
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an appointment' })
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Body() dto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(orgId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List appointments — filter by status, contact, date range' })
  findAll(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Query() query: QueryAppointmentDto,
  ) {
    return this.appointmentsService.findAll(orgId, user.sub, query);
  }

  @Get('upcoming')
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Next N days (default 7)' })
  @ApiOperation({ summary: 'Get upcoming appointments for the next N days' })
  getUpcoming(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Query('days') days?: number,
  ) {
    return this.appointmentsService.getUpcoming(orgId, user.sub, days ? Number(days) : 7);
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get appointment detail' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.findOne(orgId, id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update appointment details' })
  update(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(orgId, id, dto);
  }

  @Patch(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Confirm a scheduled appointment' })
  confirm(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.appointmentsService.confirm(orgId, id, user.sub);
  }

  @Patch(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Mark appointment as completed' })
  complete(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.markCompleted(orgId, id);
  }

  @Patch(':id/no-show')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Mark appointment as no-show' })
  noShow(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.markNoShow(orgId, id);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Cancel an appointment with optional reason' })
  cancel(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    return this.appointmentsService.cancel(orgId, id, dto);
  }
}
