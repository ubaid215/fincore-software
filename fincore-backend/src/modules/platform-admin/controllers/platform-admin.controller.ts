import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AppKey } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { PlatformAdminService } from '../services/platform-admin.service';
import { UpsertOrgEntitlementOverrideDto } from '../dto/platform-admin.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: 'platform-admin', version: '1' })
export class PlatformAdminController {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  @Get('organizations')
  @ApiOperation({ summary: 'List tenant organizations with plan/apps/override metadata' })
  listOrganizations(@CurrentUser() user: JwtPayload) {
    return this.platformAdmin.listOrganizations(user.sub);
  }

  @Post('organizations/:orgId/override')
  @ApiParam({ name: 'orgId' })
  @ApiOperation({ summary: 'Create or update entitlement override for a tenant organization' })
  upsertOverride(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') organizationId: string,
    @Body() dto: UpsertOrgEntitlementOverrideDto,
  ) {
    return this.platformAdmin.upsertOverride(user.sub, organizationId, dto);
  }

  @Delete('organizations/:orgId/override')
  @ApiParam({ name: 'orgId' })
  @ApiOperation({ summary: 'Delete entitlement override for a tenant organization' })
  clearOverride(@CurrentUser() user: JwtPayload, @Param('orgId') organizationId: string) {
    return this.platformAdmin.clearOverride(user.sub, organizationId);
  }

  @Patch('organizations/:orgId/apps/:app')
  @ApiParam({ name: 'orgId' })
  @ApiParam({ name: 'app', enum: AppKey })
  @ApiOperation({ summary: 'Enable or disable an app for a tenant organization' })
  setAppAccess(
    @CurrentUser() user: JwtPayload,
    @Param('orgId') organizationId: string,
    @Param('app') app: AppKey,
    @Body('enabled') enabled: boolean,
  ) {
    return this.platformAdmin.setAppAccess(user.sub, organizationId, app, Boolean(enabled));
  }
}
