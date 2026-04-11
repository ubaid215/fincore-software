// src/modules/auth/dto/magic-link.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/** Step 1 — request a magic link to be emailed */
export class SendMagicLinkDto {
  @ApiProperty({ example: 'ubaid@fincore.app' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}

/** Step 2 — exchange the token from the email link for a JWT pair */
export class VerifyMagicLinkDto {
  @ApiProperty({ description: 'Token from the magic-link email URL' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
