// src/modules/organizations/dto/create-organization.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Display name of the organization' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'acme-corp',
    description: 'URL-safe slug — lowercase letters, numbers, hyphens. Min 3, max 50 chars.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, {
    message:
      'Slug must be 3–50 lowercase letters, numbers, or hyphens and cannot start or end with a hyphen',
  })
  slug!: string;
}
