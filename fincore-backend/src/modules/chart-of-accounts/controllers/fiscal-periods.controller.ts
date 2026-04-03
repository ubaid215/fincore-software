// src/modules/chart-of-accounts/controllers/fiscal-periods.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { FiscalPeriodsService } from '../services/fiscal-periods.service';
import { CreateFiscalPeriodDto } from '../dto/fiscal-period.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';

@ApiTags('fiscal-periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'fiscal-periods', version: '1' })
export class FiscalPeriodsController {
  constructor(private readonly service: FiscalPeriodsService) {}

  @Post()
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: 'Create a new fiscal period — rejects if dates overlap existing periods',
  })
  create(@OrgId() orgId: string, @Body() dto: CreateFiscalPeriodDto) {
    return this.service.create(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all fiscal periods (newest first)' })
  findAll(@OrgId() orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(orgId, id);
  }

  @Patch(':id/close')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close period — rejects if DRAFT journal entries exist in period' })
  close(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.close(orgId, id);
  }

  @Patch(':id/reopen')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen a CLOSED period — LOCKED periods cannot be reopened' })
  reopen(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.reopen(orgId, id);
  }

  @Patch(':id/lock')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently lock period — must be CLOSED first. Irreversible.' })
  lock(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.lock(orgId, id);
  }
}
