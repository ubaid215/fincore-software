// src/modules/auth/dto/refresh-token.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Raw refresh token from prior login/refresh response' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
