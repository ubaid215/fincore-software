// src/modules/auth/config/auth.config.ts
import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export default registerAs('auth', () => {
  const privatePath = process.env.JWT_PRIVATE_KEY_PATH ?? './keys/private.pem';
  const publicPath = process.env.JWT_PUBLIC_KEY_PATH ?? './keys/public.pem';
  const isTest = process.env.NODE_ENV === 'test';

  let privateKey: string;
  let publicKey: string;
  let algorithm: 'RS256' | 'HS256';

  try {
    privateKey = fs.readFileSync(path.resolve(privatePath), 'utf8');
    publicKey = fs.readFileSync(path.resolve(publicPath), 'utf8');
    algorithm = 'RS256';
  } catch {
    if (!isTest) {
      throw new Error(
        `RSA key files not found. Run: bash scripts/generate-rsa-keys.sh\n` +
          `Private: ${privatePath}\nPublic:  ${publicPath}`,
      );
    }
    const secret = process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only';
    privateKey = secret;
    publicKey = secret;
    algorithm = 'HS256';
  }

  return {
    // ── JWT ────────────────────────────────────────────────────────────────
    jwtPrivateKey: privateKey,
    jwtPublicKey: publicKey,
    jwtAlgorithm: algorithm, // single source — both module & strategy read this
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    jwtOrgExpiresIn: process.env.JWT_ORG_EXPIRES_IN ?? '15m', // org-scoped token TTL
    // Only exposed in test — no symmetric secret in production
    ...(isTest ? { jwtSecret: process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only' } : {}),

    // ── Google OAuth 2.0 ───────────────────────────────────────────────────
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl:
      process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/v1/auth/google/callback',

    // ── Resend (email) ─────────────────────────────────────────────────────
    resendApiKey: process.env.RESEND_API_KEY,
    emailFrom: process.env.EMAIL_FROM ?? 'noreply@fincore.app',
    emailFromName: process.env.EMAIL_FROM_NAME ?? 'FinCore',

    // ── Magic link / OTP ───────────────────────────────────────────────────
    magicLinkExpiryMin: parseInt(process.env.MAGIC_LINK_EXPIRY_MIN ?? '15', 10),
    passwordResetExpiryMin: parseInt(process.env.PASSWORD_RESET_EXPIRY_MIN ?? '60', 10),
    verifyEmailExpiryHr: parseInt(process.env.VERIFY_EMAIL_EXPIRY_HR ?? '24', 10),

    // ── App ────────────────────────────────────────────────────────────────
    appName: process.env.APP_NAME ?? 'FinCore',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',

    // ── Security ───────────────────────────────────────────────────────────
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10),
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS ?? '5', 10),
    lockDurationMin: parseInt(process.env.LOCK_DURATION_MIN ?? '15', 10),
    maxRefreshTokens: parseInt(process.env.MAX_REFRESH_TOKENS ?? '10', 10),
  };
});
