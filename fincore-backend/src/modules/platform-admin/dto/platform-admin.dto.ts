import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppKey } from '@prisma/client';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpsertOrgEntitlementOverrideDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsersOverride?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessionsOverride?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAppsOverride?: number;

  @ApiPropertyOptional({ enum: AppKey, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(AppKey, { each: true })
  allowedAppsOverride?: AppKey[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
