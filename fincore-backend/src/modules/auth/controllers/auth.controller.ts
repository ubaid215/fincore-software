// src/modules/auth/controllers/auth.controller.ts

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';

import { AuthService, TokenPair } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { SendMagicLinkDto, VerifyMagicLinkDto } from '../dto/magic-link.dto';
import { MfaCodeDto, MfaVerifyDto } from '../dto/mfa.dto';
import { SelectOrgDto } from '../dto/select-org.dto';
import { OnboardOrgDto } from '../dto/onboard-org.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { GoogleUser } from '../strategies/google.strategy';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

// ── Cookie options helper ─────────────────────────────────────────────────────
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
}

@ApiTags('auth')
@UseGuards(JwtAuthGuard)
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Step 1 — Register account. Sends email verification link.' })
  @ApiResponse({ status: 201, description: '{ message, userId }' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email from link. Returns token pair on success.' })
  @ApiResponse({ status: 400, description: 'Invalid/expired/used token' })
  async verifyEmail(@Body() dto: VerifyEmailDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.verifyEmail(dto.token);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    // Return both tokens — frontend proxy needs refreshToken to set fincore_refresh cookie
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Post('resend-verification')
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email (authenticated, for UNVERIFIED users)' })
  async resendVerification(@CurrentUser() user: JwtPayload) {
    const profile = await this.authService.getProfile(user.sub);
    await this.authService.sendEmailVerificationLink(user.sub, profile.email);
    return { message: 'Verification email resent' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LOGIN — Email + Password
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email + password. Sets refresh_token HttpOnly cookie.' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    // If MFA required, no cookie yet — just return the signal
    if ('requiresMfa' in result && result.requiresMfa) {
      return result;
    }

    const tokens = result as TokenPair;
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());

    // Return both tokens — client needs refreshToken to store as fincore_refresh cookie
    // (via POST /api/auth/set-refresh-token Next.js BFF route)
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MFA STEP-UP  — called when login returns requiresMfa: true
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete MFA step-up after password login. Returns token pair.' })
  async verifyMfaLogin(@Body() dto: MfaVerifyDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.verifyMfaLogin(dto);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GOOGLE OAuth
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Redirect to Google consent screen' })
  googleAuth() {
    // Handled by passport-google-oauth20 — redirect happens automatically
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback — issues JWT pair, redirects to frontend' })
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const googleUser = req.user as unknown as GoogleUser;
    const { accessToken, refreshToken, isNewUser } =
      await this.authService.loginWithGoogle(googleUser);

    const frontendUrl = this.config.get<string>('auth.frontendUrl', 'http://localhost:3000');

    res.cookie('refresh_token', refreshToken, refreshCookieOptions());

    // Pass both tokens in query params so frontend can store fincore_refresh
    const redirectUrl = isNewUser
      ? `${frontendUrl}/onboarding?access_token=${accessToken}&refresh_token=${refreshToken}`
      : `${frontendUrl}/select?access_token=${accessToken}&refresh_token=${refreshToken}`;

    return res.redirect(redirectUrl);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAGIC LINK — Passwordless
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('magic-link/send')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send passwordless magic-link email' })
  sendMagicLink(@Body() dto: SendMagicLinkDto) {
    return this.authService.sendMagicLink(dto.email, dto.deviceLabel);
  }

  @Public()
  @Post('magic-link/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange magic-link token for JWT pair' })
  @ApiResponse({ status: 401, description: 'Invalid/expired/used token' })
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyMagicLink(dto.token);
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORGOT / RESET PASSWORD
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send password-reset email (always returns same response)' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email. Revokes all sessions.' })
  @ApiResponse({ status: 400, description: 'Invalid/expired/used token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TOKEN MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token. Accepts from HttpOnly cookie OR request body.' })
  async refresh(
    @Req() req: Request,
    @Body() body: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Accept from HttpOnly cookie (direct browser call) OR body (Next.js BFF proxy call)
    const rawToken = req.cookies?.['refresh_token'] ?? body?.refreshToken;
    if (!rawToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const tokens = await this.authService.refreshTokens(rawToken);

    // Rotate the cookie for direct browser calls
    res.cookie('refresh_token', tokens.refreshToken, refreshCookieOptions());

    // Return both tokens so the Next.js proxy can rotate fincore_refresh cookie too
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = req.cookies?.['refresh_token'];
    if (rawToken) {
      await this.authService.logout(rawToken);
    }
    res.clearCookie('refresh_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATED ENDPOINTS
  // ══════════════════════════════════════════════════════════════════════════

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  @Get('organizations')
  @ApiBearerAuth()
  @ApiOperation({ summary: "List user's organization memberships" })
  getMyOrganizations(@CurrentUser() user: JwtPayload) {
    return this.authService.getUserOrganizations(user.sub);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke all sessions (all refresh tokens) for current user' })
  logoutAll(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response) {
    res.clearCookie('refresh_token', { path: '/' });
    return this.authService.logoutAll(user.sub);
  }

  // ── Session management ───────────────────────────────────────────────────

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all active sessions (device, IP, created date)' })
  getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getSessions(user.sub);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a specific session by ID' })
  revokeSession(@CurrentUser() user: JwtPayload, @Param('id') sessionId: string) {
    return this.authService.revokeSession(user.sub, sessionId);
  }

  // ── Org context ──────────────────────────────────────────────────────────

  @Post('select-org')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange bare access token for org-scoped token (role + plan + apps embedded)',
    description:
      'Call this after login/org-list. The returned accessToken replaces the previous one in memory.',
  })
  selectOrg(@CurrentUser() user: JwtPayload, @Body() dto: SelectOrgDto) {
    return this.authService.selectOrg(user.sub, dto);
  }

  @Post('onboard-org')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Step 2 of registration — create organization and become OWNER' })
  @ApiResponse({ status: 409, description: 'User already in an organization' })
  onboardOrg(@CurrentUser() user: JwtPayload, @Body() dto: OnboardOrgDto) {
    return this.authService.onboardOrg(user.sub, dto);
  }

  // ── MFA ──────────────────────────────────────────────────────────────────

  @Post('mfa/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Begin MFA setup — returns TOTP secret and QR code URL' })
  setupMfa(@CurrentUser() user: JwtPayload) {
    return this.authService.setupMfa(user.sub);
  }

  @Post('mfa/enable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm TOTP code and activate MFA. Returns backup codes (shown once).',
  })
  enableMfa(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto) {
    return this.authService.enableMfa(user.sub, dto.code);
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable MFA — requires valid TOTP code. Revokes all sessions.' })
  disableMfa(@CurrentUser() user: JwtPayload, @Body() dto: MfaCodeDto) {
    return this.authService.disableMfa(user.sub, dto.code);
  }
}
