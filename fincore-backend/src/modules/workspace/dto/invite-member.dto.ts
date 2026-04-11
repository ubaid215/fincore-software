// src/modules/workspace/dto/invite-member.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { UserRole, AppKey } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'colleague@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ACCOUNTANT })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiPropertyOptional({
    type: [String],
    enum: AppKey,
    example: ['INVOICING', 'CONTACTS'],
    description: 'App access to grant. Leave empty to inherit org defaults.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AppKey, { each: true })
  appAccess?: AppKey[];
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invite token from the email URL' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
