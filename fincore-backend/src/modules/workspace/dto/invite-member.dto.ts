// src/modules/workspace/dto/invite-member.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class InviteMemberDto {
  @ApiProperty({ example: 'colleague@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.ACCOUNTANT })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class AcceptInviteDto {
  @ApiProperty({ description: 'Invite token from the email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
