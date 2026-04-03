import { PrismaClient } from '@prisma/client';

export async function seedPlans(prisma: PrismaClient) {
  const plans = [
    {
      name: 'STARTER',
      displayName: 'Starter',
      priceMonthly: 2500,
      currency: 'PKR',
      maxSeats: 3,
      features: ['invoicing', 'expenses', 'bank_reconciliation'],
    },
    {
      name: 'PROFESSIONAL',
      displayName: 'Professional',
      priceMonthly: 7500,
      currency: 'PKR',
      maxSeats: 10,
      features: [
        'invoicing',
        'expenses',
        'bank_reconciliation',
        'financial_reports',
        'multi_currency',
      ],
    },
    {
      name: 'ENTERPRISE',
      displayName: 'Enterprise',
      priceMonthly: 20000,
      currency: 'PKR',
      maxSeats: 999,
      features: [
        'invoicing',
        'expenses',
        'bank_reconciliation',
        'financial_reports',
        'multi_currency',
        'api_access',
        'priority_support',
        'custom_branding',
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
  }
  console.log('✅ Plans seeded: Starter, Professional, Enterprise');
}
