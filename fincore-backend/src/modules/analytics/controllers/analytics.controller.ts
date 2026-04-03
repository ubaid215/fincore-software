// src/modules/analytics/controllers/analytics.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from '../services/analytics.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get KPI dashboard metrics' })
  getDashboard(@OrgId() orgId: string) {
    return this.analyticsService.getDashboardMetrics(orgId);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get customer insights' })
  getCustomerInsights(@OrgId() orgId: string) {
    return this.analyticsService.getCustomerInsights(orgId);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get product insights' })
  getProductInsights(@OrgId() orgId: string) {
    return this.analyticsService.getProductInsights(orgId);
  }
}
