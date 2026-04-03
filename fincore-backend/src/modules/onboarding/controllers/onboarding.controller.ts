// src/modules/onboarding/controllers/onboarding.controller.ts
import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { OnboardingService } from '../services/onboarding.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

class UpdateWizardDataDto {
  step: number;
  data: Record<string, any>;
}

class SkipStepDto {
  step: number;
}

@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'onboarding', version: '1' })
export class OnboardingController {
  constructor(private onboardingService: OnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'Get current onboarding state' })
  async getState(@CurrentUser() user: JwtPayload, @OrgId() orgId: string) {
    return this.onboardingService.getOnboardingState(user.sub, orgId);
  }

  @Put('wizard')
  @ApiOperation({ summary: 'Update wizard data and advance to next step' })
  async updateWizard(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Body() dto: UpdateWizardDataDto,
  ) {
    return this.onboardingService.updateWizardData(user.sub, orgId, dto.step, dto.data);
  }

  @Post('skip')
  @ApiOperation({ summary: 'Skip current step (if optional)' })
  async skipStep(
    @CurrentUser() user: JwtPayload,
    @OrgId() orgId: string,
    @Body() dto: SkipStepDto,
  ) {
    return this.onboardingService.skipStep(user.sub, orgId, dto.step);
  }
}
