// src/modules/organizations/controllers/organizations.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from '../services/organizations.service';
import { CreateOrganizationDto } from '../dto/create-organization.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard) // all routes require a valid JWT
@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * POST /v1/organizations
   * Create a new organization. The authenticated user becomes OWNER.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created, caller assigned as OWNER' })
  @ApiResponse({ status: 409, description: 'Slug already taken' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user.sub, dto);
  }

  /**
   * GET /v1/organizations
   * List all organizations the authenticated user is a member of.
   */
  @Get()
  @ApiOperation({ summary: "List current user's organizations" })
  @ApiResponse({ status: 200, description: 'Array of organizations with role' })
  findAllForUser(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findAllForUser(user.sub);
  }

  /**
   * GET /v1/organizations/:id
   * Get a single organization by ID (membership required).
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a single organization' })
  @ApiResponse({ status: 404, description: 'Not found or not a member' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.organizationsService.findOne(user.sub, id);
  }
}
