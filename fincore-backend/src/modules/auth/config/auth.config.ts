// src/modules/auth/config/auth.config.ts
import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export default registerAs('auth', () => {
  const privatePath = process.env.JWT_PRIVATE_KEY_PATH ?? './keys/private.pem';
  const publicPath = process.env.JWT_PUBLIC_KEY_PATH ?? './keys/public.pem';
  const isTest = process.env.NODE_ENV === 'test';

  let privateKey: string | undefined;
  let publicKey: string | undefined;
  // FIX: Track which mode we actually loaded so auth.module.ts and jwt.strategy.ts
  // both read the same value instead of each re-deriving it independently.
  // Previously the module and strategy could disagree on algorithm if env was unusual.
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
    // Test fallback — symmetric secret so tests don't need key files on disk.
    const secret = process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only';
    privateKey = secret;
    publicKey = secret;
    algorithm = 'HS256';
  }

  return {
    jwtPrivateKey: privateKey,
    jwtPublicKey: publicKey,
    // FIX: algorithm is now derived from what was actually loaded, not from NODE_ENV.
    // Both auth.module and jwt.strategy should read this value — single source of truth.
    jwtAlgorithm: algorithm,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    // FIX: jwtSecret is only exposed in test mode. In production it is undefined
    // so even if someone misconfigures the algorithm, there is no symmetric secret
    // available to sign or verify tokens — it fails loudly instead of silently.
    ...(isTest ? { jwtSecret: process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only' } : {}),
  };
});
