// src/modules/workspace/dto/create-organization.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  IsArray,
  MinLength,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { BusinessType, AppKey, UserRole } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'FinCore Technologies' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'fincore-tech', description: 'Lowercase letters, numbers, hyphens' })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, {
    message: 'Slug must be 3–50 lowercase letters, numbers, or hyphens',
  })
  slug!: string;

  @ApiPropertyOptional({ example: 'billing@fincore.app' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ enum: BusinessType, default: BusinessType.SME })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({ example: 'PK', description: 'ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ example: 'PKR', description: 'ISO 4217' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Karachi', default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 1, description: 'Fiscal year start month (1-12)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStart?: number;

  @ApiPropertyOptional({ example: 12, description: 'Fiscal year end month (1-12)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearEnd?: number;

  @ApiPropertyOptional({ example: '1234567-8', description: 'NTN / GST / VAT number' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxId?: string;

  @ApiPropertyOptional({ example: 'Technology' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  industry?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: AppKey,
    example: ['INVOICING'],
    description: 'Apps to enable. Free plan = 1 app max.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AppKey, { each: true })
  enabledApps?: AppKey[];
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(12) fiscalYearEnd?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsEnum(BusinessType) businessType?: BusinessType;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

// re-export UserRole so controllers can use it without extra import
export { UserRole };
