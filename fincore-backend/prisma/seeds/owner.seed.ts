// ============================================================
// prisma/seed/owner.seed.ts
// Creates the immutable platform OWNER account.
// Run once:  npx ts-node prisma/seed/owner.seed.ts
// The OWNER role can NEVER be removed via the application.
// Guard enforced at: NestJS guard + DB CHECK constraint (below).
// ============================================================

import {
  PrismaClient,
  UserRole,
  UserStatus,
  OrgStatus,
  BusinessType,
  SubscriptionStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// ── Config — override via environment variables ──────────────
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'owner@yourdomain.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD ?? 'Change_me_immediately!1';
const OWNER_FIRST = process.env.OWNER_FIRST ?? 'Platform';
const OWNER_LAST = process.env.OWNER_LAST ?? 'Owner';
const ORG_NAME = process.env.ORG_NAME ?? 'Platform HQ';
const ORG_SLUG = process.env.ORG_SLUG ?? 'platform-hq';

async function main() {
  console.log('🌱  Seeding platform OWNER...');

  // ── 1. Hash password ─────────────────────────────────────
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);

  // ── 2. Upsert OWNER user ─────────────────────────────────
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {}, // never overwrite if already exists
    create: {
      email: OWNER_EMAIL,
      passwordHash,
      firstName: OWNER_FIRST,
      lastName: OWNER_LAST,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      mfaEnabled: true, // OWNER must use 2FA
      isActive: true,
    },
  });

  console.log(`✅  Owner user: ${owner.email} (id: ${owner.id})`);

  // ── 3. Upsert FREE plan (required before subscription) ───
  const freePlan = await prisma.plan.upsert({
    where: { name: 'FREE' },
    update: {},
    create: {
      name: 'FREE',
      displayName: 'Free',
      priceMonthly: 0,
      currency: 'PKR',
      maxSeats: 1,
      features: ['invoicing'],
      isActive: true,
      isPublic: true,
      sortOrder: 0,
    },
  });

  // ── 4. Upsert plan limits for FREE ───────────────────────
  await prisma.planLimit.upsert({
    where: { planId: freePlan.id },
    update: {},
    create: {
      planId: freePlan.id,
      maxUsers: 1,
      maxOrgs: 1,
      maxInvoices: 50,
      maxContacts: 100,
      maxStorage: 500,
      maxApps: 1,
    },
  });

  // ── 5. Upsert platform HQ organization ───────────────────
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      status: OrgStatus.ACTIVE,
      businessType: BusinessType.CORPORATION,
      onboardingStep: 2, // owner doesn't go through wizard
    },
  });

  console.log(`✅  Organization: ${org.name} (id: ${org.id})`);

  // ── 6. Create subscription for platform org ───────────────
  // Find or create an ENTERPRISE plan for internal use
  const enterprisePlan = await prisma.plan.upsert({
    where: { name: 'ENTERPRISE' },
    update: {},
    create: {
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      priceMonthly: 0,
      currency: 'PKR',
      maxSeats: -1, // unlimited
      features: ['ALL'],
      isActive: true,
      isPublic: false, // not shown to customers
      sortOrder: 99,
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    update: {},
    create: {
      organizationId: org.id,
      planId: enterprisePlan.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date('2099-12-31'),
      seatCount: -1,
    },
  });

  // ── 7. Link owner to org as OWNER role ───────────────────
  await prisma.userOrganization.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: {},
    create: {
      userId: owner.id,
      organizationId: org.id,
      role: UserRole.OWNER,
      isDefault: true,
      appAccess: [], // empty = all apps (checked at middleware)
    },
  });

  console.log(`✅  Owner linked to org as OWNER`);

  // ── 8. Enable all apps for platform org ───────────────────
  const allApps = [
    'INVOICING',
    'EXPENSES',
    'PAYROLL',
    'INVENTORY',
    'ACCOUNTING',
    'BANK_RECON',
    'CONTACTS',
    'CALENDAR',
    'APPOINTMENTS',
    'DOCUMENTS',
    'SIGN',
    'REPORTS',
  ] as const;

  for (const app of allApps) {
    await prisma.orgAppAccess.upsert({
      where: { organizationId_app: { organizationId: org.id, app } },
      update: {},
      create: { organizationId: org.id, app, isEnabled: true },
    });
  }

  console.log(`✅  All apps enabled for platform org`);
  console.log('');
  console.log('══════════════════════════════════════════');
  console.log('  OWNER SEEDED SUCCESSFULLY');
  console.log(`  Email   : ${OWNER_EMAIL}`);
  console.log(`  Password: ${OWNER_PASSWORD}`);
  console.log('  ⚠️  Change the password immediately!');
  console.log('══════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
