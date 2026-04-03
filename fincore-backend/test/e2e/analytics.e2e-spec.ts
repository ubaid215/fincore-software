// test/e2e/analytics.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

describe('Analytics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await cleanDb(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Setup test data ──────────────────────────────────────────────────────
  async function setupTestData(user: any) {
    const prisma = getPrisma(app);

    // Create accounts
    const cashAccount = await prisma.account.create({
      data: {
        organizationId: user.orgId,
        accountCode: '1112',
        name: 'Cash at Bank',
        type: 'ASSET',
      },
    });

    const revenueAccount = await prisma.account.create({
      data: {
        organizationId: user.orgId,
        accountCode: '4110',
        name: 'Sales Revenue',
        type: 'REVENUE',
      },
    });

    // Create journal entries
    await prisma.journalEntry.create({
      data: {
        organizationId: user.orgId,
        entryNumber: 'JE-2025-000001',
        description: 'Sale transaction',
        entryDate: new Date(),
        status: 'POSTED',
        postedAt: new Date(),
        lines: {
          create: [
            { accountId: cashAccount.id, debit: 50000, credit: 0, currency: 'PKR', baseCurrencyDebit: 50000, baseCurrencyCredit: 0 },
            { accountId: revenueAccount.id, debit: 0, credit: 50000, currency: 'PKR', baseCurrencyDebit: 0, baseCurrencyCredit: 50000 },
          ],
        },
      },
    });

    return { cashAccount, revenueAccount };
  }

  // ─── GET /v1/analytics/dashboard ──────────────────────────────────────────
  describe('GET /v1/analytics/dashboard', () => {
    it('200 — returns KPI dashboard metrics', async () => {
      const user = await createTestUser(app, { role: UserRole.ADMIN });
      await setupTestData(user);

      const { body } = await api(app)
        .get('/v1/analytics/dashboard')
        .set(authHeaders(user))
        .expect(200);

      expect(body.data).toHaveProperty('metrics');
      expect(body.data).toHaveProperty('trends');
      expect(body.data).toHaveProperty('alerts');
      expect(body.data.metrics).toHaveProperty('grossMargin');
      expect(body.data.metrics).toHaveProperty('netMargin');
    });

    it('403 — VIEWER cannot access analytics', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      await api(app)
        .get('/v1/analytics/dashboard')
        .set(authHeaders(viewer))
        .expect(403);
    });

    it('401 — unauthenticated', async () => {
      await api(app).get('/v1/analytics/dashboard').expect(401);
    });
  });

  // ─── GET /v1/analytics/customers ──────────────────────────────────────────
  describe('GET /v1/analytics/customers', () => {
    it('200 — returns customer insights', async () => {
      const user = await createTestUser(app, { role: UserRole.ADMIN });
      const prisma = getPrisma(app);

      // Create invoices for customers
      await prisma.invoice.create({
        data: {
          organizationId: user.orgId,
          invoiceNumber: 'INV-2025-000001',
          clientName: 'ACME Corp',
          clientEmail: 'billing@acme.com',
          status: 'PAID',
          issueDate: new Date(),
          currency: 'PKR',
          subtotal: 100000,
          totalAmount: 117000,
          amountPaid: 117000,
          lineItems: {
            create: [{ description: 'Service', quantity: 1, unitPrice: 100000, total: 100000 }],
          },
        },
      });

      const { body } = await api(app)
        .get('/v1/analytics/customers')
        .set(authHeaders(user))
        .expect(200);

      expect(body.data).toHaveProperty('topCustomers');
      expect(body.data).toHaveProperty('customerRetentionRate');
      expect(Array.isArray(body.data.topCustomers)).toBe(true);
    });
  });

  // ─── GET /v1/analytics/products ───────────────────────────────────────────
  describe('GET /v1/analytics/products', () => {
    it('200 — returns product insights', async () => {
      const user = await createTestUser(app, { role: UserRole.ADMIN });
      const prisma = getPrisma(app);

      // Create product
      const product = await prisma.product.create({
        data: {
          organizationId: user.orgId,
          code: 'PRD-001',
          name: 'Test Product',
          unit: 'pcs',
          sellingPrice: 1000,
          costPrice: 700,
          currentStock: 100,
        },
      });

      // Create invoice with product line
      const invoice = await prisma.invoice.create({
        data: {
          organizationId: user.orgId,
          invoiceNumber: 'INV-2025-000002',
          clientName: 'Customer',
          status: 'PAID',
          issueDate: new Date(),
          currency: 'PKR',
          subtotal: 5000,
          totalAmount: 5850,
          amountPaid: 5850,
        },
      });

      await prisma.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          productId: product.id,
          description: 'Product sale',
          quantity: 5,
          unitPrice: 1000,
          total: 5000,
        },
      });

      const { body } = await api(app)
        .get('/v1/analytics/products')
        .set(authHeaders(user))
        .expect(200);

      expect(body.data).toHaveProperty('bestSellers');
      expect(body.data).toHaveProperty('worstSellers');
      expect(Array.isArray(body.data.bestSellers)).toBe(true);
    });
  });
});
