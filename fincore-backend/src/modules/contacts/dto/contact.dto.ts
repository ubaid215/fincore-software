// src/modules/contacts/dto/contact.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUrl,
  IsDateString,
  IsDecimal,
  MinLength,
  MaxLength,
  IsPhoneNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContactType } from '@prisma/client';

// ─── Create Contact ───────────────────────────────────────────────────────────

export class CreateContactDto {
  // ── Classification ──────────────────────────────────────────────────────
  @ApiProperty({ enum: ContactType, example: ContactType.CUSTOMER })
  @IsEnum(ContactType)
  contactType!: ContactType;

  @ApiPropertyOptional({
    description: 'Auto-generated if not provided (e.g. CUST-0001)',
    example: 'CUST-0001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  code?: string;

  // ── Identity ─────────────────────────────────────────────────────────────
  @ApiProperty({
    description: 'Full display name — "Acme Corp" or "John Doe"',
    example: 'Akbar Tax Store',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  displayName!: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Akbar Tax Store' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  companyName?: string;

  @ApiPropertyOptional({
    description: 'S/O Name — father or spouse name (Pakistani KYC field)',
    example: 'Muhammad Akbar',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  soName?: string; // shown as "S/O Name" in the form

  @ApiPropertyOptional({ example: 'CEO' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  // ── Communication ─────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'contact@akbartaxstore.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'billing@akbartaxstore.com' })
  @IsOptional()
  @IsEmail()
  email2?: string;

  @ApiPropertyOptional({ example: '+923001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: '+923009876543' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone2?: string;

  @ApiPropertyOptional({ example: '+923001234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsapp?: string;

  @ApiPropertyOptional({ example: 'https://akbartaxstore.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  // ── Address ───────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: '12-A, Commercial Area' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Block 5, Clifton' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Karachi' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Sindh' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: '75600' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'PK' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  // ── Pakistani compliance fields (from screenshot) ─────────────────────────
  @ApiPropertyOptional({
    description: 'NTN — National Tax Number (Pakistan)',
    example: '1234567-8',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({
    description: 'CNIC — Computerized National Identity Card (Pakistan)',
    example: '42101-1234567-1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnic?: string;

  @ApiPropertyOptional({
    description: 'Date of Birth (ISO 8601)',
    example: '1985-06-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Date of Expiry — passport, license, etc.',
    example: '2030-06-15',
  })
  @IsOptional()
  @IsDateString()
  dateOfExpire?: string;

  // ── Finance ───────────────────────────────────────────────────────────────
  @ApiPropertyOptional({ example: 'PKR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: '50000.00' })
  @IsOptional()
  @IsString() // Decimal validated as string — converted in service
  creditLimit?: string;

  @ApiPropertyOptional({ description: 'Payment terms in days', example: 30 })
  @IsOptional()
  paymentTerms?: number;

  @ApiPropertyOptional({ example: '0.00', description: 'Opening balance amount' })
  @IsOptional()
  @IsString()
  openingBalance?: string;

  @ApiPropertyOptional({ example: 'HBL' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankName?: string;

  @ApiPropertyOptional({ example: 'PK36HABB0000000013020010' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  bankIban?: string;

  @ApiPropertyOptional({ example: '0123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  bankAccount?: string;

  // ── Tags & notes ──────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    type: [String],
    example: ['VIP', 'B2B', 'Consulting'],
    description: 'Free-form tags for filtering and segmentation',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Key account. Always call before emailing.' })
  @IsOptional()
  @IsString()
  notes?: string;

  // ── Client portal ─────────────────────────────────────────────────────────
  @ApiPropertyOptional({
    description: 'Enable client portal access for this contact',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  portalEnabled?: boolean;
}

// ─── Update Contact ───────────────────────────────────────────────────────────

export class UpdateContactDto {
  @ApiPropertyOptional() @IsOptional() @IsEnum(ContactType) contactType?: ContactType;
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() companyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() soName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() jobTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() whatsapp?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() website?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() cnic?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dateOfExpire?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() creditLimit?: string;
  @ApiPropertyOptional() @IsOptional() paymentTerms?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() openingBalance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankIban?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankAccount?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() portalEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

// ─── Query / Filter ───────────────────────────────────────────────────────────

export class QueryContactDto {
  @ApiPropertyOptional({ example: 'Akbar', description: 'Search name, email, phone, code' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ContactType })
  @IsOptional()
  @IsEnum(ContactType)
  contactType?: ContactType;

  @ApiPropertyOptional({ example: 'VIP' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

export class ContactPickerQueryDto {
  @ApiPropertyOptional({ example: 'akbar' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ContactType })
  @IsOptional()
  @IsEnum(ContactType)
  contactType?: ContactType;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}

// ─── Contact Note ─────────────────────────────────────────────────────────────

export class CreateContactNoteDto {
  @ApiProperty({ example: 'Called regarding Q3 invoice. Follow up next week.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

// ─── Custom Field Value ───────────────────────────────────────────────────────

export class SetCustomFieldDto {
  @ApiProperty({ description: 'CustomFieldDef UUID' })
  @IsString()
  fieldDefId!: string;

  @ApiPropertyOptional({ description: 'Field value as string. Null to clear.' })
  @IsOptional()
  @IsString()
  value?: string;
}

// ─── Portal access ────────────────────────────────────────────────────────────

export class EnablePortalDto {
  @ApiProperty({ description: 'User ID to link as CLIENT portal user' })
  @IsString()
  userId!: string;
}

export class AddContactAttachmentDto {
  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty()
  @IsString()
  mimeType!: string;

  @ApiProperty()
  @Type(() => Number)
  sizeBytes!: number;

  @ApiProperty()
  @IsString()
  s3Key!: string;
}

// ─── Smart button summary shape ───────────────────────────────────────────────

export class ContactSummaryDto {
  invoiceCount!: number;
  invoicedAmount!: string;
  saleOrderCount!: number;
  purchaseOrderCount!: number;
  appointmentCount!: number;
  documentCount!: number;
}
