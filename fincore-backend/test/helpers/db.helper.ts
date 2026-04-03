// test/helpers/db.helper.ts
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/database/prisma.service';

/**
 * Wipe all data between E2E tests.
 * Call in beforeEach() of every E2E spec file that writes to the DB.
 */
export async function cleanDb(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.cleanDatabase();
}

/**
 * Get the PrismaService directly for assertions in E2E tests.
 * Use sparingly — prefer asserting through the API response.
 */
export function getPrisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}
