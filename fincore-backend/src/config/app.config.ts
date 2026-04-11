// src/config/app.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigins: process.env.CORS_ORIGINS ?? 'http://localhost:3000',
  throttleTtl: parseInt(process.env.THROTTLE_TTL ?? '60', 10), // seconds
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10), // requests per TTL
  name: process.env.APP_NAME ?? 'FinCore',
}));
