// src/modules/contacts/controllers/contacts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ContactsService } from '../services/contacts.service';
import {
  CreateContactDto,
  UpdateContactDto,
  QueryContactDto,
  CreateContactNoteDto,
  SetCustomFieldDto,
  EnablePortalDto,
  AddContactAttachmentDto,
  ContactPickerQueryDto,
} from '../dto/contact.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { OrgId, RequireApp } from '../../../common/decorators/organization.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgJwtPayload } from '../../../common/types/jwt-payload.type';
import { AppKey } from '@prisma/client';

@ApiTags('contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@RequireApp(AppKey.CONTACTS) // app-level gate — org must have CONTACTS enabled
@Controller({ path: 'contacts', version: '1' })
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════════

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a contact (person or company)' })
  @ApiResponse({ status: 409, description: 'Contact code already exists' })
  @ApiResponse({ status: 402, description: 'Contact limit reached — upgrade plan' })
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: OrgJwtPayload,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(orgId, user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List contacts — search, filter by type, tag, active status' })
  findAll(@OrgId() orgId: string, @Query() query: QueryContactDto) {
    return this.contactsService.findAll(orgId, query);
  }

  @Get('picker/search')
  @ApiOperation({ summary: 'Fast contact search endpoint for customer/vendor pickers' })
  picker(@OrgId() orgId: string, @Query() query: ContactPickerQueryDto) {
    return this.contactsService.picker(orgId, query.search, query.contactType, query.limit);
  }

  @Get(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get contact detail with smart button counts, notes, custom fields' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  findOne(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.findOne(orgId, id);
  }

  @Patch(':id')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Update contact fields' })
  update(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ACCOUNTANT)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Soft-delete a contact — Accountant or above' })
  remove(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.remove(orgId, id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SMART BUTTON COUNTS  (Odoo-style header badges)
  // ══════════════════════════════════════════════════════════════════════════

  @Get(':id/summary')
  @ApiParam({ name: 'id' })
  @ApiOperation({
    summary: 'Smart button counts — invoices, sales orders, appointments, documents',
    description: 'Powers the Odoo-style smart buttons shown in the contact header.',
  })
  getSummary(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.getSmartButtonCounts(orgId, id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // NOTES  (chatter — "Send message / Log note")
  // ══════════════════════════════════════════════════════════════════════════

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Add a note or message to the contact chatter' })
  addNote(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: OrgJwtPayload,
    @Body() dto: CreateContactNoteDto,
  ) {
    const authorName =
      `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim() || user.email;
    return this.contactsService.addNote(id, user.sub, authorName, dto.body);
  }

  @Get(':id/notes')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Get all notes for a contact (newest first)' })
  getNotes(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.getNotes(orgId, id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CUSTOM FIELDS  (Owner-defined "New Fields" panel from screenshot 1)
  // ══════════════════════════════════════════════════════════════════════════

  @Get('custom-fields/definitions')
  @ApiOperation({
    summary: 'List all custom field definitions for contacts in this org',
    description: 'Returns the fields shown in the "New Fields" sidebar panel.',
  })
  getCustomFieldDefs(@OrgId() orgId: string) {
    return this.contactsService.getCustomFieldDefs(orgId);
  }

  @Post('custom-fields/definitions')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new custom field definition — Owner only' })
  createCustomFieldDef(
    @OrgId() orgId: string,
    @Body()
    dto: {
      label: string;
      fieldKey: string;
      fieldType: string;
      isRequired?: boolean;
      defaultValue?: string;
      options?: string[];
      sortOrder?: number;
    },
  ) {
    return this.contactsService.createCustomFieldDef(orgId, dto);
  }

  @Patch(':id/custom-fields')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Set one or more custom field values for a contact' })
  setCustomFieldValues(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() fields: SetCustomFieldDto[],
  ) {
    return this.contactsService.setCustomFieldValues(orgId, id, fields);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PORTAL ACCESS
  // ══════════════════════════════════════════════════════════════════════════

  @Post(':id/portal/enable')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Enable client portal for this contact — Admin only' })
  enablePortal(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnablePortalDto,
  ) {
    return this.contactsService.enablePortal(orgId, id, dto.userId);
  }

  @Post(':id/portal/disable')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Disable client portal for this contact' })
  disablePortal(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.disablePortal(orgId, id);
  }

  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'Attach file metadata to a contact' })
  addAttachment(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: OrgJwtPayload,
    @Body() dto: AddContactAttachmentDto,
  ) {
    return this.contactsService.addAttachment(orgId, id, user.sub, dto);
  }

  @Get(':id/attachments')
  @ApiParam({ name: 'id' })
  @ApiOperation({ summary: 'List contact attachments' })
  listAttachments(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.contactsService.listAttachments(orgId, id);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'attachmentId' })
  @ApiOperation({ summary: 'Remove one attachment from a contact' })
  removeAttachment(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.contactsService.removeAttachment(orgId, id, attachmentId);
  }
}
