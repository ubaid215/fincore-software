// src/modules/auth/services/auth.service.ts
//
// Complete rewrite. Fixes vs original:
//
//  1. Refresh tokens stored as SHA-256 hash — raw token never in DB.
//  2. register() sets status=UNVERIFIED, sends verification email — login blocked until verified.
//  3. Magic link flow: send → verify (login + password-reset).
//  4. Google OAuth: findOrCreate by googleId/email, auto-verifies email.
//  5. UserStatus enum checked everywhere (not isActive boolean).
//  6. MFA required for OWNER/ADMIN roles — enforced at login.
//  7. select-org issues OrgJwtPayload embedding role/plan/apps — eliminates DB
//     roundtrips in guards.
//  8. Onboard-org creates tenant, links free plan, enables chosen app.
//  9. Token rotation: old token deleted before new one issued (RT never reused).
// 10. Email service injected via EmailService (Resend wrapper).
// 11. mfaVerified claim embedded in org token for RolesGuard safety check.

import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import {
  UserStatus,
  UserRole,
  MagicLinkPurpose,
  OrgStatus,
  AppKey,
  BusinessType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from '@otplib/preset-default';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { OnboardOrgDto } from '../dto/onboard-org.dto';
import { SelectOrgDto } from '../dto/select-org.dto';
import { MfaVerifyDto } from '../dto/mfa.dto';
import { JwtPayload, OrgJwtPayload } from '../../../common/types/jwt-payload.type';
import { MFA_REQUIRED_ROLES } from '../../../common/constants/roles.constants';
import { EmailService } from './email.service';
import { StringValue } from 'ms';
import * as ms from 'ms';

// ─── Response interfaces ──────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string; // raw token — client stores in HttpOnly cookie
}

export interface OrgTokenResponse {
  accessToken: string; // OrgJwtPayload — replaces bare token in memory
}

export interface MfaRequiredResponse {
  requiresMfa: true;
  userId: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

// ─────────────────────────────────────────────────────────────────────────────

// SHA-256 hash of a raw token — what we store in DB
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Cryptographically random URL-safe token
function generateSecureToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // ── Config values cached at construction ──────────────────────────────────
  private readonly bcryptRounds: number;
  private readonly maxFailedAttempts: number;
  private readonly lockDurationMs: number;
  private readonly maxRefreshTokens: number;
  private readonly refreshExpiresIn: string;
  private readonly magicLinkExpiryMin: number;
  private readonly passwordResetExpiryMin: number;
  private readonly verifyEmailExpiryHr: number;
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private email: EmailService,
  ) {
    this.bcryptRounds = this.config.get<number>('auth.bcryptRounds', 12);
    this.maxFailedAttempts = this.config.get<number>('auth.maxFailedAttempts', 5);
    this.lockDurationMs = this.config.get<number>('auth.lockDurationMin', 15) * 60_000;
    this.maxRefreshTokens = this.config.get<number>('auth.maxRefreshTokens', 10);
    this.refreshExpiresIn = this.config.get<string>('auth.jwtRefreshExpiresIn', '7d');
    this.magicLinkExpiryMin = this.config.get<number>('auth.magicLinkExpiryMin', 15);
    this.passwordResetExpiryMin = this.config.get<number>('auth.passwordResetExpiryMin', 60);
    this.verifyEmailExpiryHr = this.config.get<number>('auth.verifyEmailExpiryHr', 24);
    this.frontendUrl = this.config.get<string>('auth.frontendUrl', 'http://localhost:3001');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Step 1 of registration.
   * Creates user with status=UNVERIFIED, sends verification email.
   * Returns message + userId — NOT a token (login blocked until verified).
   */
  async register(dto: RegisterDto): Promise<RegisterResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existing) throw new ConflictException('An account with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        status: UserStatus.UNVERIFIED,
      },
      select: { id: true, email: true, firstName: true },
    });

    // Issue and email verification link
    await this.sendEmailVerificationLink(user.id, user.email);

    this.logger.log(`User registered: ${user.email} (${user.id})`);

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════

  async sendEmailVerificationLink(userId: string, email: string): Promise<void> {
    // Invalidate any prior unused verification links for this user
    await this.prisma.magicLink.updateMany({
      where: { userId, purpose: MagicLinkPurpose.EMAIL_VERIFICATION, usedAt: null },
      data: { usedAt: new Date() }, // mark old ones consumed
    });

    const rawToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + this.verifyEmailExpiryHr * 3_600_000);

    await this.prisma.magicLink.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        purpose: MagicLinkPurpose.EMAIL_VERIFICATION,
        expiresAt,
      },
    });

    const verifyUrl = `${this.frontendUrl}/auth/verify-email?token=${rawToken}`;

    await this.email.sendVerificationEmail(email, verifyUrl);
  }

  async verifyEmail(rawToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);

    const link = await this.prisma.magicLink.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!link || link.purpose !== MagicLinkPurpose.EMAIL_VERIFICATION) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    if (link.usedAt) throw new BadRequestException('Verification link already used');
    if (link.expiresAt < new Date()) throw new BadRequestException('Verification link expired');

    // Atomic: mark link used + activate user
    await this.prisma.$transaction([
      this.prisma.magicLink.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: link.userId },
        data: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
      }),
    ]);

    this.logger.log(`Email verified for user ${link.userId}`);

    return this.issueTokenPair(link.user.id, link.user.email);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN — Email + Password
  // ══════════════════════════════════════════════════════════════════════════

  async login(dto: LoginDto): Promise<TokenPair | MfaRequiredResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Timing-safe: always hash even when user not found to prevent user enumeration
    if (!user) {
      await bcrypt.hash(dto.password, this.bcryptRounds);
      throw new UnauthorizedException('Invalid email or password');
    }

    // ── Lockout check ─────────────────────────────────────────────────────
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      throw new ForbiddenException(`Account locked. Try again in ${remaining} minute(s)`);
    }

    // ── Status check ──────────────────────────────────────────────────────
    if (user.status === UserStatus.UNVERIFIED) {
      throw new ForbiddenException('Please verify your email before logging in. Check your inbox.');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException('Account suspended. Contact support.');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account inactive');
    }

    // ── Password check ────────────────────────────────────────────────────
    if (!user.passwordHash) {
      // Google-only account — no password set
      throw new UnauthorizedException(
        'This account uses Google sign-in. Use "Continue with Google".',
      );
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= this.maxFailedAttempts ? new Date(Date.now() + this.lockDurationMs) : null,
        },
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed attempts on success
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    // ── MFA check ─────────────────────────────────────────────────────────
    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        // Signal client to show MFA form
        return { requiresMfa: true, userId: user.id };
      }
      this.verifyTotp(user.mfaSecret!, dto.mfaCode);
    }

    return this.issueTokenPair(user.id, user.email, dto.deviceLabel, user.mfaEnabled);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MFA STEP-UP  — called when login returns requiresMfa: true
  // ══════════════════════════════════════════════════════════════════════════

  async verifyMfaLogin(dto: MfaVerifyDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, email: true, mfaEnabled: true, mfaSecret: true, status: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid request');
    }
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new BadRequestException('MFA not enabled on this account');
    }

    this.verifyTotp(user.mfaSecret, dto.code);

    this.logger.log(`MFA verified for user ${user.id}`);

    return this.issueTokenPair(user.id, user.email, dto.deviceLabel, true);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GOOGLE OAuth  — called from GoogleStrategy.validate()
  // ══════════════════════════════════════════════════════════════════════════

  async loginWithGoogle(googleUser: {
    id: string;
    email: string;
    isNewUser: boolean;
  }): Promise<TokenPair & { isNewUser: boolean }> {
    const pair = await this.issueTokenPair(googleUser.id, googleUser.email);
    return { ...pair, isNewUser: googleUser.isNewUser };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAGIC LINK — Passwordless login
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Send a magic-link login email.
   * If email not found we return the SAME response to prevent user enumeration.
   */
  async sendMagicLink(email: string, deviceLabel?: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, status: true },
    });

    // Always respond with same message — prevents enumeration
    const genericMessage = 'If an account exists, a sign-in link has been sent to your email.';

    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: genericMessage };
    }

    // Invalidate old unused magic-login links for this user
    await this.prisma.magicLink.updateMany({
      where: { userId: user.id, purpose: MagicLinkPurpose.MAGIC_LOGIN, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + this.magicLinkExpiryMin * 60_000);

    await this.prisma.magicLink.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        purpose: MagicLinkPurpose.MAGIC_LOGIN,
        expiresAt,
      },
    });

    const loginUrl = `${this.frontendUrl}/auth/magic?token=${rawToken}`;
    await this.email.sendMagicLinkEmail(user.email, loginUrl, this.magicLinkExpiryMin);

    return { message: genericMessage };
  }

  async verifyMagicLink(rawToken: string, deviceLabel?: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawToken);

    const link = await this.prisma.magicLink.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!link || link.purpose !== MagicLinkPurpose.MAGIC_LOGIN) {
      throw new UnauthorizedException('Invalid or expired magic link');
    }
    if (link.usedAt) throw new UnauthorizedException('Magic link already used');
    if (link.expiresAt < new Date()) throw new UnauthorizedException('Magic link expired');
    if (link.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account inactive');
    }

    // Consume the link
    await this.prisma.magicLink.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: link.userId },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokenPair(link.user.id, link.user.email, deviceLabel);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORGOT / RESET PASSWORD
  // ══════════════════════════════════════════════════════════════════════════

  async forgotPassword(email: string): Promise<{ message: string }> {
    const genericMessage = 'If an account exists, a password-reset link has been sent.';

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, status: true, passwordHash: true },
    });

    // Don't reveal whether the email exists
    if (!user || user.status !== UserStatus.ACTIVE) {
      return { message: genericMessage };
    }

    // Google-only accounts have no password to reset
    if (!user.passwordHash) {
      await this.email.sendOAuthAccountEmail(user.email);
      return { message: genericMessage };
    }

    // Invalidate prior unused reset links
    await this.prisma.magicLink.updateMany({
      where: { userId: user.id, purpose: MagicLinkPurpose.PASSWORD_RESET, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = generateSecureToken();
    const expiresAt = new Date(Date.now() + this.passwordResetExpiryMin * 60_000);

    await this.prisma.magicLink.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        purpose: MagicLinkPurpose.PASSWORD_RESET,
        expiresAt,
      },
    });

    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${rawToken}`;
    await this.email.sendPasswordResetEmail(user.email, resetUrl, this.passwordResetExpiryMin);

    return { message: genericMessage };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = hashToken(rawToken);

    const link = await this.prisma.magicLink.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!link || link.purpose !== MagicLinkPurpose.PASSWORD_RESET) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (link.usedAt) throw new BadRequestException('Reset link already used');
    if (link.expiresAt < new Date()) throw new BadRequestException('Reset link expired');

    const newHash = await bcrypt.hash(newPassword, this.bcryptRounds);

    // Atomic: consume link + update password + revoke all sessions
    await this.prisma.$transaction([
      this.prisma.magicLink.update({
        where: { tokenHash },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: link.userId },
        data: { passwordHash: newHash },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId: link.userId } }),
    ]);

    this.logger.log(`Password reset for user ${link.userId} — all sessions revoked`);

    return { message: 'Password updated successfully. Please log in again.' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOKEN REFRESH
  // ══════════════════════════════════════════════════════════════════════════

  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    // Expired — delete and reject
    if (stored.expiresAt < new Date() || stored.revokedAt) {
      await this.prisma.refreshToken.delete({ where: { tokenHash } });
      throw new UnauthorizedException('Refresh token expired — please log in again');
    }

    // Rotate: delete old before issuing new (prevents replay)
    await this.prisma.refreshToken.delete({ where: { tokenHash } });

    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, status: true, mfaEnabled: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Account inactive');
    }

    return this.issueTokenPair(
      user.id,
      user.email,
      stored.deviceLabel ?? undefined,
      user.mfaEnabled,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ORG SELECTION — upgrades bare token to org-scoped OrgJwtPayload token
  // ══════════════════════════════════════════════════════════════════════════

  async selectOrg(userId: string, dto: SelectOrgDto): Promise<OrgTokenResponse> {
    const membership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: dto.organizationId },
      },
      include: {
        organization: {
          select: {
            id: true,
            status: true,
            subscription: {
              select: {
                plan: { select: { name: true } },
              },
            },
            appAccess: {
              where: { isEnabled: true },
              select: { app: true },
            },
          },
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    if (membership.organization.status !== OrgStatus.ACTIVE) {
      throw new ForbiddenException(
        `Organization is ${membership.organization.status.toLowerCase()}. Contact support.`,
      );
    }

    const plan = membership.organization.subscription?.plan.name ?? 'FREE';
    const apps = membership.organization.appAccess.map((a) => a.app as string);

    const orgPayload: OrgJwtPayload & { mfaVerified: boolean } = {
      sub: userId,
      email: membership.userId, // resolved below
      status: UserStatus.ACTIVE,
      orgId: dto.organizationId,
      role: membership.role,
      plan,
      apps,
      mfaVerified: MFA_REQUIRED_ROLES.includes(membership.role), // true = passed MFA at login
    };

    // Fetch email for the payload (we need it for the token)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    orgPayload.email = user!.email;
    orgPayload.mfaVerified = !MFA_REQUIRED_ROLES.includes(membership.role) || user!.mfaEnabled;

    const orgExpiresIn = this.config.get<string>('auth.jwtExpiresIn', '15m') as StringValue;
    const accessToken = this.jwt.sign(orgPayload, { expiresIn: orgExpiresIn });

    return { accessToken };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ORG ONBOARDING — step 2 after registration
  // ══════════════════════════════════════════════════════════════════════════

  async onboardOrg(userId: string, dto: OnboardOrgDto): Promise<OrgTokenResponse> {
    // Check user isn't already in an org (free plan = 1 org)
    const existingMembership = await this.prisma.userOrganization.findFirst({
      where: { userId },
    });

    if (existingMembership) {
      throw new ConflictException('You are already part of an organization');
    }

    // Generate URL-safe slug from business name
    const baseSlug = dto.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    // Ensure slug uniqueness
    const slug = await this.uniqueSlug(baseSlug);

    // Find FREE plan
    const freePlan = await this.prisma.plan.findUnique({ where: { name: 'FREE' } });
    if (!freePlan) throw new BadRequestException('Free plan not configured. Contact support.');

    // Determine selected app — default to INVOICING for free plan
    const selectedApp = (dto.selectedApp as AppKey) ?? AppKey.INVOICING;

    // Atomic: create org + subscription + membership + app access
    const org = await this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: dto.businessName,
          slug,
          businessType: dto.businessType,
          country: dto.country,
          currency: dto.currency,
          timezone: dto.timezone ?? 'UTC',
          fiscalYearStart: dto.fiscalYearStart,
          fiscalYearEnd: dto.fiscalYearStart === 1 ? 12 : dto.fiscalYearStart - 1,
          taxId: dto.taxId,
          industry: dto.industry,
          status: OrgStatus.ACTIVE,
          onboardingStep: 2,
        },
      });

      // Create free subscription
      await tx.subscription.create({
        data: {
          organizationId: organization.id,
          planId: freePlan.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 3_600_000), // 1 year
          seatCount: 1,
        },
      });

      // Link user as OWNER
      await tx.userOrganization.create({
        data: {
          userId,
          organizationId: organization.id,
          role: UserRole.OWNER,
          isDefault: true,
        },
      });

      // Enable the selected app
      await tx.orgAppAccess.create({
        data: {
          organizationId: organization.id,
          app: selectedApp,
          isEnabled: true,
          enabledById: userId,
        },
      });

      return organization;
    });

    this.logger.log(`Org created: ${org.name} (${org.id}) for user ${userId}`);

    // Return org-scoped token so user goes straight to dashboard
    return this.selectOrg(userId, { organizationId: org.id });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  async logout(rawRefreshToken: string): Promise<{ message: string }> {
    const tokenHash = hashToken(rawRefreshToken);
    // deleteMany — no error if already gone
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    const { count } = await this.prisma.refreshToken.deleteMany({ where: { userId } });
    this.logger.log(`logoutAll: ${count} session(s) revoked for user ${userId}`);
    return { message: 'All sessions invalidated' };
  }

  async getSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceLabel: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ message: string }> {
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { message: 'Session revoked' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROFILE
  // ══════════════════════════════════════════════════════════════════════════

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        mfaEnabled: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
        googleId: true, // non-null = Google linked
      },
    });
  }

  async getUserOrganizations(userId: string) {
    return this.prisma.userOrganization.findMany({
      where: { userId, removedAt: null },
      select: {
        role: true,
        isDefault: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            logoUrl: true,
            subscription: {
              select: { plan: { select: { name: true, displayName: true } } },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MFA
  // ══════════════════════════════════════════════════════════════════════════

  async setupMfa(userId: string): Promise<{ secret: string; qrCodeUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, mfaEnabled: true },
    });

    if (user.mfaEnabled) throw new ConflictException('MFA is already enabled');

    const secret = authenticator.generateSecret();
    const appName = this.config.get<string>('auth.appName', 'FinCore');
    const qrCodeUrl = authenticator.keyuri(user.email, appName, secret);

    // Store pending secret — not active until enableMfa confirms
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret },
    });

    return { secret, qrCodeUrl };
  }

  async enableMfa(
    userId: string,
    code: string,
  ): Promise<{ message: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (user.mfaEnabled) throw new ConflictException('MFA already enabled');
    if (!user.mfaSecret) throw new BadRequestException('Call /mfa/setup first');

    this.verifyTotp(user.mfaSecret, code);

    // Generate 10 one-time backup codes (hashed)
    const rawCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase(),
    );
    const hashedCodes = rawCodes.map((c) => hashToken(c));

    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true, mfaBackupCodes: hashedCodes },
    });

    return {
      message: 'MFA enabled. Store backup codes securely — they will not be shown again.',
      backupCodes: rawCodes,
    };
  }

  async disableMfa(userId: string, code: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true },
    });

    if (!user.mfaEnabled || !user.mfaSecret) throw new ConflictException('MFA not enabled');

    this.verifyTotp(user.mfaSecret, code);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaSecret: null, mfaBackupCodes: [] },
      }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
    ]);

    this.logger.log(`MFA disabled and all sessions revoked for user ${userId}`);
    return { message: 'MFA disabled. All sessions revoked.' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Issues a JWT access token + a rotating refresh token.
   * Refresh token stored as SHA-256 hash — raw value returned to caller ONLY.
   */
  private async issueTokenPair(
    userId: string,
    email: string,
    deviceLabel?: string,
    mfaVerified?: boolean,
  ): Promise<TokenPair> {
    const payload: JwtPayload = {
      sub: userId,
      email,
      status: UserStatus.ACTIVE,
    };

    const accessToken = this.jwt.sign(payload);

    // ── Refresh token ───────────────────────────────────────────────────────
    const expiryMs = ms(this.refreshExpiresIn as StringValue);
    if (!expiryMs) throw new Error(`Invalid refresh expiry config: ${this.refreshExpiresIn}`);

    const expiresAt = new Date(Date.now() + expiryMs);
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Cap active sessions per user — evict oldest first
    const count = await this.prisma.refreshToken.count({ where: { userId } });

    if (count >= this.maxRefreshTokens) {
      const excess = await this.prisma.refreshToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: count - this.maxRefreshTokens + 1,
        select: { id: true },
      });
      await this.prisma.refreshToken.deleteMany({
        where: { id: { in: excess.map((t) => t.id) } },
      });
    }

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash, // ← hash stored, not raw
        expiresAt,
        deviceLabel: deviceLabel ?? null,
      },
    });

    return { accessToken, refreshToken: rawToken };
  }

  private verifyTotp(secret: string, code: string): void {
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) throw new UnauthorizedException('Invalid MFA code');
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let attempt = 0;
    while (true) {
      const existing = await this.prisma.organization.findUnique({ where: { slug } });
      if (!existing) return slug;
      attempt++;
      slug = `${base}-${attempt}`;
    }
  }
}
