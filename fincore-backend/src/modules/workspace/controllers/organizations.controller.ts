// src/modules/workspace/controllers/organizations.controller.ts
//
// FIX 16: Consolidated. WorkspaceModule's OrganizationsController is the
//         canonical one. OrganizationsModule is now REMOVED from app.module.ts.
//
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AppKey, UserRole } from '@prisma/client';
import { OrganizationsService } from '../services/organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UpdateMemberRoleDto,
} from '../dto/create-organization.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgId, RequireApp } from '../../../common/decorators/organization.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgJwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('workspace / organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization — caller becomes OWNER' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  create(@CurrentUser() user: OrgJwtPayload, @Body() dto: CreateOrganizationDto) {
    return this.orgsService.create(user.sub, dto);
  }

  // ── My orgs ───────────────────────────────────────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'List all organizations the current user belongs to' })
  findMine(@CurrentUser() user: OrgJwtPayload) {
    return this.orgsService.findAllForUser(user.sub);
  }

  // ── Single org ────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get organization details' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update organization settings — Admin or Owner' })
  update(@OrgId() orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.orgsService.update(orgId, dto);
  }

  // ── Members ───────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'List active members' })
  getMembers(@OrgId() orgId: string) {
    return this.orgsService.getMembers(orgId);
  }

  @Patch(':id/members/:userId/role')
  @Roles(UserRole.ADMIN)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'userId' })
  @ApiOperation({ summary: 'Change a member role — Admin or Owner only' })
  updateMemberRole(
    @OrgId() orgId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: OrgJwtPayload,
  ) {
    return this.orgsService.updateMemberRole(orgId, targetUserId, dto.role, user.sub);
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'userId' })
  @ApiOperation({ summary: 'Remove (soft-delete) a member' })
  removeMember(
    @OrgId() orgId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: OrgJwtPayload,
  ) {
    return this.orgsService.removeMember(orgId, targetUserId, user.sub);
  }

  // ── App access ────────────────────────────────────────────────────────────

  @Get(':id/apps')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'List app access settings for this org' })
  getAppAccess(@OrgId() orgId: string) {
    return this.orgsService.getAppAccess(orgId);
  }

  @Patch(':id/apps/:app')
  @Roles(UserRole.OWNER)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'app', enum: AppKey })
  @ApiOperation({ summary: 'Enable or disable an app — Owner only' })
  toggleApp(
    @OrgId() orgId: string,
    @Param('app') app: AppKey,
    @Body('enable') enable: boolean,
    @CurrentUser() user: OrgJwtPayload,
  ) {
    return this.orgsService.toggleApp(orgId, app, enable, user.sub);
  }
}
