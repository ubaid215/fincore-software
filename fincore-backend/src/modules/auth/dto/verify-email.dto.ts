// src/modules/auth/dto/verify-email.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Token from the email-verification link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
