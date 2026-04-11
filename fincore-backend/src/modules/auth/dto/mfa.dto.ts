// src/modules/auth/dto/mfa.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Length } from 'class-validator';

/** Confirm a TOTP code — used for enable, disable, and verify-at-login */
export class MfaCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit TOTP code from authenticator app' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;
}

/** Verify MFA code during login (when requiresMfa === true) */
export class MfaVerifyDto {
  @ApiProperty({ description: 'userId from the requiresMfa login response' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code!: string;

  @ApiProperty({ example: 'Chrome on Windows' })
  @IsString()
  deviceLabel?: string;
}
