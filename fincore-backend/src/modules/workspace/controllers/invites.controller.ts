// src/modules/workspace/controllers/invites.controller.ts
import {
  Controller,
  Post,
  Get,
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
import { InvitesService } from '../services/invites.service';
import { InviteMemberDto, AcceptInviteDto } from '../dto/invite-member.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'invites', version: '1' })
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a new member to the organization — Admin or Owner' })
  @ApiResponse({ status: 201, description: 'Invite created and email sent' })
  @ApiResponse({ status: 402, description: 'Seat limit reached — upgrade plan' })
  @ApiResponse({ status: 409, description: 'Already a member or pending invite exists' })
  create(@OrgId() orgId: string, @CurrentUser() user: JwtPayload, @Body() dto: InviteMemberDto) {
    return this.invitesService.createInvite(orgId, user.sub, dto);
  }

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invite token — joins the organization' })
  @ApiResponse({ status: 400, description: 'Token expired' })
  @ApiResponse({ status: 404, description: 'Token not found' })
  @ApiResponse({ status: 409, description: 'Invite already accepted' })
  accept(@CurrentUser() user: JwtPayload, @Body() dto: AcceptInviteDto) {
    return this.invitesService.acceptInvite(dto.token, user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all pending invites for the organization' })
  listPending(@OrgId() orgId: string) {
    return this.invitesService.listPendingInvites(orgId);
  }

  @Delete(':inviteId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invite — Admin or Owner' })
  @ApiParam({ name: 'inviteId', description: 'Invite UUID' })
  revoke(@OrgId() orgId: string, @Param('inviteId', ParseUUIDPipe) inviteId: string) {
    return this.invitesService.revokeInvite(inviteId, orgId);
  }
}
