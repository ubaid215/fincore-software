import { INestApplication } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { Algorithm } from 'jsonwebtoken';
import { PrismaService } from '../../src/database/prisma.service';
import * as bcrypt from 'bcrypt';

export interface TestCredentials {
  userId: string;
  orgId: string;
  token: string;
  email: string;
}

const TEST_PASSWORD = 'TestPass123!';
const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

export async function createTestUser(
  app: INestApplication,
  opts: { role?: UserRole; emailSuffix?: string } = {},
): Promise<TestCredentials> {
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);
  const config = app.get(ConfigService);

  const role = opts.role ?? UserRole.OWNER;
  const emailSuffix = opts.emailSuffix ?? Math.random().toString(36).slice(2, 8);
  const email = `test-${emailSuffix}@fincore.test`;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: TEST_PASSWORD_HASH,
      firstName: 'Test',
      lastName: 'User',
    },
  });

  const slug = `test-org-${emailSuffix}`;
  const org = await prisma.organization.create({
    data: { name: `Test Org ${emailSuffix}`, slug, email: `org-${emailSuffix}@fincore.test` },
  });

  await prisma.userOrganization.create({
    data: { userId: user.id, organizationId: org.id, role },
  });

  const signOptions: JwtSignOptions = {
    secret: config.get<string>('auth.jwtPrivateKey'),
    algorithm: config.get<string>('auth.jwtAlgorithm', 'HS256') as Algorithm,
    expiresIn: 3600,
  };

  const token: string = jwt.sign({ sub: user.id, email: user.email }, signOptions);

  return { userId: user.id, orgId: org.id, token, email };
}

export function authHeaders(creds: TestCredentials): Record<string, string> {
  return {
    Authorization: `Bearer ${creds.token}`,
    'X-Organization-Id': creds.orgId,
  };
}

export const TEST_USER_PASSWORD = TEST_PASSWORD;
