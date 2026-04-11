// src/modules/auth/dto/select-org.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/**
 * POST /auth/select-org
 *
 * After login the user holds a bare JwtPayload (no org context).
 * They call this endpoint to get an OrgJwtPayload token scoped to a specific org.
 * The response replaces the access token in memory — the refresh token is unchanged.
 */
export class SelectOrgDto {
  @ApiProperty({ description: 'Organization ID to scope the session to' })
  @IsString()
  @IsNotEmpty()
  organizationId!: string;

  @ApiPropertyOptional({ example: 'Chrome on Windows' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceLabel?: string;
}
