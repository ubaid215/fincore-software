/**
 * src/modules/subscriptions/controllers/subscriptions.controller.ts
 * Sprint: S4 · Week 9–10
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SubscriptionsService } from '../services/subscriptions.service';
import {
  ActivateSubscriptionDto,
  StartTrialDto,
  UpgradeSubscriptionDto,
  CancelSubscriptionDto,
  SuspendSubscriptionDto,
  UpdateSeatCountDto,
} from '../dto/subscription.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'subscriptions', version: '1' })
export class SubscriptionsController {
  constructor(private readonly sub: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List all active plans' })
  listPlans() {
    return this.sub.listPlans();
  }

  @Get()
  @ApiOperation({ summary: 'Get current subscription for the authenticated organization' })
  @ApiResponse({ status: 404, description: 'No subscription found' })
  getSubscription(@OrgId() orgId: string) {
    return this.sub.getSubscription(orgId);
  }

  @Post('trial')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a 14-day trial — ADMIN only' })
  @ApiResponse({ status: 409, description: 'Org already has an active subscription' })
  startTrial(@OrgId() orgId: string, @Body() dto: StartTrialDto) {
    return this.sub.startTrial(orgId, dto);
  }

  @Post('activate')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate subscription after payment — ADMIN only' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  activate(@OrgId() orgId: string, @Body() dto: ActivateSubscriptionDto) {
    return this.sub.activate(orgId, dto);
  }

  @Patch('plan')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upgrade or downgrade plan — ADMIN only' })
  @ApiResponse({ status: 400, description: 'Current members exceed new plan seat limit' })
  changePlan(@OrgId() orgId: string, @Body() dto: UpgradeSubscriptionDto) {
    return this.sub.changePlan(orgId, dto);
  }

  @Patch('seats')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update seat count — ADMIN only' })
  updateSeatCount(@OrgId() orgId: string, @Body() dto: UpdateSeatCountDto) {
    return this.sub.updateSeatCount(orgId, dto);
  }

  @Get('seats')
  @ApiOperation({ summary: 'Check seat availability for the organization' })
  checkSeats(@OrgId() orgId: string) {
    return this.sub.checkSeatAvailability(orgId);
  }

  @Patch('suspend')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually suspend subscription — ADMIN only' })
  @ApiResponse({ status: 409, description: 'Invalid status transition' })
  suspend(@OrgId() orgId: string, @Body() dto: SuspendSubscriptionDto) {
    return this.sub.suspend(orgId, dto);
  }

  @Patch('cancel')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel subscription — ADMIN only. Terminal state.' })
  cancel(@OrgId() orgId: string, @Body() dto: CancelSubscriptionDto) {
    return this.sub.cancel(orgId, dto);
  }

  @Patch('past-due')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark subscription PAST_DUE — called by payment webhook' })
  markPastDue(@OrgId() orgId: string) {
    return this.sub.markPastDue(orgId);
  }
}

/*
 * Sprint S4 · SubscriptionsController · Week 9–10
 * 10 endpoints: plans/get/trial/activate/changePlan/seats/suspend/cancel/past-due
 */
