// prisma.config.ts
import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node ./prisma/seeds/index.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
