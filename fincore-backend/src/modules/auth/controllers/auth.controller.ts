// src/modules/auth/controllers/auth.controller.ts
//
// Complete rewrite. Added vs original:
//  - POST /auth/verify-email
//  - POST /auth/resend-verification
//  - POST /auth/forgot-password
//  - POST /auth/reset-password
//  - POST /auth/magic-link/send
//  - POST /auth/magic-link/verify
//  - POST /auth/mfa/verify       (step-up after requiresMfa response)
//  - GET  /auth/google
//  - GET  /auth/google/callback
//  - POST /auth/select-org       (bare → org-scoped token)
//  - POST /auth/onboard-org      (step 2 of registration)
//  - GET  /auth/sessions         (active session list)
//  - DELETE /auth/sessions/:id   (revoke specific session)

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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';

import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { VerifyEmailDto } from '../dto/verify-email.dto';
import { SendMagicLinkDto, VerifyMagicLinkDto } from '../dto/magic-link.dto';
import { MfaCodeDto, MfaVerifyDto } from '../dto/mfa.dto';
import { SelectOrgDto } from '../dto/select-org.dto';
import { OnboardOrgDto } from '../dto/onboard-org.dto';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';
import { GoogleUser } from '../strategies/google.strategy';
import { ConfigService } from '@nestjs/config';

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
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @ApiBearerAuth()
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
  @ApiOperation({
    summary: 'Login with email + password',
    description:
      'Returns TokenPair on success, or { requiresMfa: true, userId } when 2FA is needed.',
  })
  @ApiResponse({ status: 200, description: 'Token pair or requiresMfa signal' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Locked / unverified / suspended' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MFA STEP-UP  — called when login returns requiresMfa: true
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete MFA step-up after password login. Returns token pair.' })
  verifyMfaLogin(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfaLogin(dto);
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
    // FIX: req.user is typed as JwtPayload | OrgJwtPayload | undefined by the
    // JwtAuthGuard applied at the class level. On this specific route, Passport's
    // GoogleStrategy populates req.user with a GoogleUser object. The types don't
    // overlap enough for a direct cast (TS2352). Cast through `unknown` first —
    // this is correct because at runtime Passport guarantees GoogleUser here.
    const googleUser = req.user as unknown as GoogleUser;
    const { accessToken, refreshToken, isNewUser } =
      await this.authService.loginWithGoogle(googleUser);

    const frontendUrl = this.config.get<string>('auth.frontendUrl', 'http://localhost:3000');

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const redirectUrl = isNewUser
      ? `${frontendUrl}/onboarding?access_token=${accessToken}`
      : `${frontendUrl}/dashboard?access_token=${accessToken}`;

    return res.redirect(redirectUrl);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAGIC LINK — Passwordless
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('magic-link/send')
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
  verifyMagicLink(@Body() dto: VerifyMagicLinkDto) {
    return this.authService.verifyMagicLink(dto.token);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORGOT / RESET PASSWORD
  // ══════════════════════════════════════════════════════════════════════════

  @Public()
  @Post('forgot-password')
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
  @ApiOperation({ summary: 'Rotate refresh token — returns new token pair' })
  @ApiResponse({ status: 401, description: 'Token invalid, expired, or revoked' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate one refresh token (single session logout)' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
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
  logoutAll(@CurrentUser() user: JwtPayload) {
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
