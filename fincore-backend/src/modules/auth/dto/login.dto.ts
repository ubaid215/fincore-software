// src/modules/auth/dto/login.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ubaid@fincore.app' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({ example: '123456', description: 'TOTP code — required when MFA enabled' })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  mfaCode?: string;

  @ApiPropertyOptional({
    example: 'Chrome on Windows',
    description: 'Device label for session list',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}
