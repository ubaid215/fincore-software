import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import * as bcrypt from 'bcrypt';
import { authenticator } from '@otplib/preset-default';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';

const BCRYPT_ROUNDS = 12;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface MfaRequiredResponse {
  requiresMfa: true;
  userId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    this.logger.log(`New user registered: ${user.email}`);
    return this.issueTokenPair(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<TokenPair | MfaRequiredResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');

    if (user.mfaEnabled) {
      if (!dto.mfaCode) return { requiresMfa: true, userId: user.id };
      this.validateTotp(user.mfaSecret!, dto.mfaCode);
    }

    return this.issueTokenPair(user.id, user.email);
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });
    return this.issueTokenPair(user.id, user.email);
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return { success: true };
  }

  async setupMfa(
    userId: string,
  ): Promise<{ secret: string; otpAuthUrl: string; qrCodeUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled on this account');

    const secret: string = authenticator.generateSecret();
    const otpAuthUrl: string = authenticator.keyuri(user.email, 'FinCore', secret);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaSecret: secret } });

    return {
      secret,
      otpAuthUrl,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(otpAuthUrl)}&size=200x200`,
    };
  }

  async enableMfa(userId: string, code: string): Promise<{ enabled: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled');
    if (!user.mfaSecret) throw new BadRequestException('Call POST /auth/mfa/setup first');
    this.validateTotp(user.mfaSecret, code);
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }

  async disableMfa(userId: string, code: string): Promise<{ disabled: true }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabled) throw new BadRequestException('MFA is not enabled on this account');
    this.validateTotp(user.mfaSecret!, code);
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecret: null },
    });
    return { disabled: true };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mfaEnabled: true,
        createdAt: true,
      },
    });
  }

  private async issueTokenPair(userId: string, email: string): Promise<TokenPair> {
    const payload = { sub: userId, email };

    const signOptions: JwtSignOptions = {
      privateKey: this.config.get<string>('auth.jwtPrivateKey'),
      algorithm: 'RS256',
      expiresIn: 900,
    };

    const accessToken: string = this.jwt.sign(payload, signOptions);

    const refreshTokenValue: string = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({
      data: { userId, token: refreshTokenValue, expiresAt },
    });

    return { accessToken, refreshToken: refreshTokenValue };
  }

  private validateTotp(secret: string, code: string): void {
    const isValid: boolean = authenticator.verify({ token: code, secret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired MFA code');
    }
  }
}
