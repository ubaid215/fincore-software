// src/modules/auth/dto/register.dto.ts
//
// FIX: Added phone (optional), missing from original.
//      Step-2 org fields are in a separate OnboardOrgDto below.
//
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsPhoneNumber,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'ubaid@fincore.app' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase, one lowercase, and one digit',
  })
  password!: string;

  @ApiProperty({ example: 'Ubaid' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'Rehman' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName!: string;

  @ApiPropertyOptional({
    example: '+923001234567',
    description: 'Optional — used for future SMS 2FA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
