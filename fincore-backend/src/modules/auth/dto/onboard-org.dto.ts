// src/modules/auth/dto/onboard-org.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsEmail,
} from 'class-validator';
import { AppKey, BusinessType } from '@prisma/client';

/**
 * POST /auth/onboard-org  (authenticated — requires valid JwtPayload)
 *
 * Step 2 of registration: creates the tenant Organization and links
 * the user as OWNER. After this, the user can call /auth/select-org
 * to receive an org-scoped token and enter the dashboard.
 */
export class OnboardOrgDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessName!: string;

  @ApiProperty({ enum: BusinessType, example: 'SME' })
  @IsEnum(BusinessType)
  businessType!: BusinessType;

  @ApiProperty({ example: 'PK', description: 'ISO 3166-1 alpha-2 country code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2)
  country!: string;

  @ApiProperty({ example: 'PKR', description: 'ISO 4217 currency code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({ example: 1, description: 'Fiscal year start month (1 = January)' })
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStart!: number;

  @ApiPropertyOptional({ example: 'UTC+5', description: 'IANA timezone string' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @ApiPropertyOptional({ example: '1234567-8', description: 'NTN / VAT / EIN / GST number' })
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
    example: 'INVOICING',
    description: 'AppKey — chosen app for free plan',
    enum: AppKey,
  })
  @IsOptional()
  @IsEnum(AppKey)
  selectedApp?: AppKey;
}
