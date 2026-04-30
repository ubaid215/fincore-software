// prisma/seeds/plans.seed.ts
// Seeds Plan + PlanLimit records with correct AppKey enum values.
// Features must match AppKey enum: INVOICING | EXPENSES | PAYROLL | etc.
// Use 'ALL' wildcard for unlimited/enterprise plans.

import { PrismaClient } from '@prisma/client';

export async function seedPlans(prisma: PrismaClient) {
  const plans = [
    {
      name: 'FREE',
      displayName: 'Free',
      priceMonthly: 0,
      currency: 'PKR',
      maxSeats: 1,
      features: ['INVOICING'],    // 1 app of choice (set at onboarding)
      isActive: true,
      isPublic: true,
      sortOrder: 0,
      limits: { maxUsers: 1, maxOrgs: 1, maxInvoices: 50, maxContacts: 100, maxStorage: 500, maxApps: 1 },
    },
    {
      name: 'STARTER',
      displayName: 'Starter',
      priceMonthly: 2500,
      currency: 'PKR',
      maxSeats: 3,
      features: ['INVOICING', 'EXPENSES', 'BANK_RECON', 'CONTACTS'],
      isActive: true,
      isPublic: true,
      sortOrder: 1,
      limits: { maxUsers: 3, maxOrgs: 1, maxInvoices: 500, maxContacts: 500, maxStorage: 2048, maxApps: 4 },
    },
    {
      name: 'PROFESSIONAL',
      displayName: 'Professional',
      priceMonthly: 7500,
      currency: 'PKR',
      maxSeats: 10,
      features: ['INVOICING', 'EXPENSES', 'BANK_RECON', 'CONTACTS', 'ACCOUNTING', 'REPORTS', 'CALENDAR', 'APPOINTMENTS'],
      isActive: true,
      isPublic: true,
      sortOrder: 2,
      limits: { maxUsers: 10, maxOrgs: 3, maxInvoices: -1, maxContacts: -1, maxStorage: 10240, maxApps: 8 },
    },
    {
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      priceMonthly: 20000,
      currency: 'PKR',
      maxSeats: -1,  // unlimited
      features: ['ALL'],            // ALL wildcard = every app
      isActive: true,
      isPublic: false,              // not shown on public pricing page
      sortOrder: 99,
      limits: { maxUsers: -1, maxOrgs: -1, maxInvoices: -1, maxContacts: -1, maxStorage: -1, maxApps: -1 },
    },
  ];

  for (const { limits, ...plan } of plans) {
    const created = await prisma.plan.upsert({
      where:  { name: plan.name },
      update: { ...plan },
      create: { ...plan },
    });

    await prisma.planLimit.upsert({
      where:  { planId: created.id },
      update: limits,
      create: { planId: created.id, ...limits },
    });
  }

  console.log('✅ Plans seeded: FREE, STARTER, PROFESSIONAL, ENTERPRISE');
}
