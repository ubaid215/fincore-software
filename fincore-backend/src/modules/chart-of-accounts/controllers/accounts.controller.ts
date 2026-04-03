// src/modules/chart-of-accounts/controllers/accounts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AccountType, UserRole } from '@prisma/client';
import { AccountsService } from '../services/accounts.service';
import {
  CreateAccountDto,
  UpdateAccountDto,
  ImportTemplateDto,
  CreateSubAccountDto,
} from '../dto/create-account.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';

@ApiTags('chart-of-accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'accounts', version: '1' })
export class AccountsController {
  constructor(private readonly service: AccountsService) {}

  @Post()
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Create a new account in the Chart of Accounts' })
  @ApiResponse({ status: 409, description: 'Account code already in use' })
  create(@OrgId() orgId: string, @Body() dto: CreateAccountDto) {
    return this.service.create(orgId, dto);
  }

  // NEW: Create sub-account (e.g., HBL, UBL under Cash at Bank)
  @Post('sub-account')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({
    summary: 'Create a sub-account (e.g., HBL, UBL) under a parent account',
    description: 'Automatically generates account code like "1112-01" for the sub-account',
  })
  @ApiResponse({ status: 201, description: 'Sub-account created successfully' })
  @ApiResponse({ status: 404, description: 'Parent account not found' })
  @ApiResponse({ status: 409, description: 'Sub-account code already exists' })
  createSubAccount(@OrgId() orgId: string, @Body() dto: CreateSubAccountDto) {
    return this.service.createSubAccount(orgId, dto);
  }

  @Post('import')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Import GAAP USA or IFRS template (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns count of accounts imported' })
  importTemplate(@OrgId() orgId: string, @Body() dto: ImportTemplateDto) {
    return this.service.importTemplate(orgId, dto.template, dto.replaceExisting);
  }

  @Get()
  @ApiOperation({ summary: 'List all accounts — returns nested tree by default' })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  @ApiQuery({
    name: 'flat',
    required: false,
    type: Boolean,
    description: 'Return flat list instead of tree',
  })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter by parent account ID' })
  findAll(
    @OrgId() orgId: string,
    @Query('type') type?: AccountType,
    @Query('includeArchived') includeArchived?: boolean,
    @Query('flat') flat?: boolean,
    @Query('parentId') parentId?: string,
  ) {
    return this.service.findAll(orgId, { type, includeArchived, flat, parentId });
  }

  // NEW: Get account tree with full hierarchy
  @Get('tree')
  @ApiOperation({ summary: 'Get full account tree with hierarchy' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  getTree(@OrgId() orgId: string, @Query('includeArchived') includeArchived?: boolean) {
    return this.service.getAccountTree(orgId, includeArchived);
  }

  // NEW: Get sub-accounts under a parent
  @Get('sub-accounts/:parentCode')
  @ApiOperation({ summary: 'Get all sub-accounts under a parent account code' })
  @ApiParam({ name: 'parentCode', description: 'Parent account code (e.g., "1112")' })
  getSubAccounts(@OrgId() orgId: string, @Param('parentCode') parentCode: string) {
    return this.service.getSubAccounts(orgId, parentCode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account with parent + children' })
  @ApiParam({ name: 'id', description: 'Account UUID' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(orgId, id);
  }

  @Get('code/:accountCode')
  @ApiOperation({ summary: 'Get account by account code' })
  @ApiParam({ name: 'accountCode', description: 'Account code (e.g., "1112" or "1112-01")' })
  findByCode(@OrgId() orgId: string, @Param('accountCode') accountCode: string) {
    return this.service.findByCode(orgId, accountCode);
  }

  @Patch(':id')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Update account name, subType, or description' })
  update(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Patch(':id/archive')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Archive account — rejected if it has active children or posted transactions',
  })
  archive(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.archive(orgId, id);
  }

  @Patch(':id/unarchive')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unarchive account — rejected if parent is still archived' })
  unarchive(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.unarchive(orgId, id);
  }

  @Patch(':id/lock')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lock account — permanently prevents edits and GL writes to this account',
  })
  lock(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.lock(orgId, id);
  }

  @Patch(':id/unlock')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock account' })
  unlock(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.unlock(orgId, id);
  }
}
