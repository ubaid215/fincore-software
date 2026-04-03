// src/modules/workspace/dto/create-organization.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'FinCore Technologies' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'fincore-tech',
    description: 'URL-safe slug — lowercase letters, numbers, hyphens',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase letters, numbers, and hyphens only' })
  @MinLength(2)
  @MaxLength(50)
  slug!: string;

  @ApiProperty({ example: 'billing@fincore.app' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Asia/Karachi', default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'PKR', default: 'PKR' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ example: 6, description: 'Fiscal year end month (1–12)', default: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearEnd?: number;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(12) fiscalYearEnd?: number;
}
