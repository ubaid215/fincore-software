// src/modules/chart-of-accounts/dto/create-account.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ example: '1112', description: 'Account code (hierarchical)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9.-]+$/i, {
    message: 'Account code may only contain letters, numbers, dots and hyphens',
  })
  accountCode!: string;

  @ApiProperty({ example: 'Cash at Bank' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ enum: AccountType, example: AccountType.ASSET })
  @IsEnum(AccountType)
  type!: AccountType;

  @ApiPropertyOptional({ example: 'Current Asset' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subType?: string;

  @ApiPropertyOptional({ description: 'UUID of parent account (for hierarchy)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: 'Main operating bank account' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  subType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class ImportTemplateDto {
  @ApiProperty({ enum: ['GAAP_USA', 'IFRS'], example: 'GAAP_USA' })
  @IsEnum(['GAAP_USA', 'IFRS'])
  template!: 'GAAP_USA' | 'IFRS';

  @ApiPropertyOptional({
    default: false,
    description:
      'If true, clears existing accounts before import. Rejected if any journal entries exist.',
  })
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}

// NEW: DTO for creating sub-accounts (bank accounts)
export class CreateSubAccountDto {
  @ApiProperty({ example: '1112', description: 'Parent account code' })
  @IsString()
  @IsNotEmpty()
  parentAccountCode!: string;

  @ApiProperty({ example: '01', description: 'Sub-account suffix (e.g., 01 for HBL)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{2}$/, { message: 'Sub-account suffix must be 2 digits (01-99)' })
  suffix!: string;

  @ApiProperty({ example: 'HBL Main Branch', description: 'Sub-account display name' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    example: 'PK36HABB0000000000000001',
    description: 'Bank account number/IBAN',
  })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ description: 'Opening balance for this bank account' })
  @IsOptional()
  openingBalance?: number;
}

// NEW: Response DTO with full code
export class AccountResponseDto {
  id!: string;
  organizationId!: string;
  accountCode!: string;
  fullCode!: string; // e.g., "1112-01" for sub-account
  name!: string;
  fullName!: string; // e.g., "Cash at Bank - HBL Main Branch"
  type!: AccountType;
  subType!: string | null;
  parentId!: string | null;
  isSubAccount!: boolean;
  isArchived!: boolean;
  isLocked!: boolean;
  description!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
