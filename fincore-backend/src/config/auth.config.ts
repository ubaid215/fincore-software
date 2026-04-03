import { registerAs } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export default registerAs('auth', () => {
  const privatePath = process.env.JWT_PRIVATE_KEY_PATH ?? './keys/private.pem';
  const publicPath = process.env.JWT_PUBLIC_KEY_PATH ?? './keys/public.pem';

  // In test environment we allow missing keys and fall back to a simple secret
  const isTest = process.env.NODE_ENV === 'test';

  let privateKey: string | undefined;
  let publicKey: string | undefined;

  try {
    privateKey = fs.readFileSync(path.resolve(privatePath), 'utf8');
    publicKey = fs.readFileSync(path.resolve(publicPath), 'utf8');
  } catch {
    if (!isTest) {
      throw new Error(
        `RSA key files not found. Run: bash scripts/generate-rsa-keys.sh\n` +
          `Private: ${privatePath}\nPublic:  ${publicPath}`,
      );
    }
    // Test fallback — symmetric secret so tests don't need key files
    privateKey = process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only';
    publicKey = process.env.JWT_SECRET ?? 'test-jwt-secret-for-testing-only';
  }

  return {
    jwtPrivateKey: privateKey,
    jwtPublicKey: publicKey,
    jwtAlgorithm: isTest ? 'HS256' : 'RS256',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
    jwtSecret: process.env.JWT_SECRET,
  };
});
