import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Support TEST_DATABASE_URL override (as the spec expects), fallback to DATABASE_URL
dotenv.config({ path: resolve(__dirname, '../.env') });

// If a separate test DB URL is provided, override DATABASE_URL with it
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

console.log('[setup-env] DATABASE_URL loaded:', !!process.env.DATABASE_URL);
