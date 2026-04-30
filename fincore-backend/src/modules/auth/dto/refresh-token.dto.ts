// src/modules/auth/dto/refresh-token.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Raw refresh token — required when called from a Next.js BFF proxy (body transport). ' +
      'Omit when calling directly from a browser that already has the HttpOnly cookie.',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
