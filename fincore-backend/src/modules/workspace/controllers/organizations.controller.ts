// src/modules/workspace/controllers/organizations.controller.ts
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
import { UserRole } from '@prisma/client';
import { OrganizationsService } from '../services/organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from '../dto/create-organization.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization — creator becomes Owner' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrganizationDto) {
    return this.orgsService.create(user.sub, dto);
  }

  // ── My organizations ──────────────────────────────────────────────────────

  @Get('my')
  @ApiOperation({ summary: 'List all organizations the current user belongs to' })
  findMine(@CurrentUser() user: JwtPayload) {
    return this.orgsService.findAllForUser(user.sub);
  }

  // ── Single org (requires membership via RolesGuard) ───────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details + member list' })
  @ApiParam({ name: 'id', description: 'Organization UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orgsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update organization settings — Admin or Owner only' })
  update(@OrgId() orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.orgsService.update(orgId, dto);
  }

  // ── Members ───────────────────────────────────────────────────────────────

  @Get(':id/members')
  @ApiOperation({ summary: 'List all members of an organization' })
  getMembers(@OrgId() orgId: string) {
    return this.orgsService.getMembers(orgId);
  }

  @Patch(':id/members/:userId/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Change a member role — Admin or Owner only' })
  @ApiParam({ name: 'userId', description: 'Target user UUID' })
  updateMemberRole(
    @OrgId() orgId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @Body('role') newRole: UserRole,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orgsService.updateMemberRole(orgId, targetUserId, newRole, user.sub);
  }

  @Delete(':id/members/:userId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a member from the organization — Admin or Owner only' })
  removeMember(
    @OrgId() orgId: string,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.orgsService.removeMember(orgId, targetUserId, user.sub);
  }
}
