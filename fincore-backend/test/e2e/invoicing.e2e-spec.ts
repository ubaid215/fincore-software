/**
 * test/e2e/invoicing.e2e-spec.ts
 * Sprint: S2 · Week 5–6
 */

import { INestApplication } from '@nestjs/common';
import { UserRole, InvoiceStatus } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

// Define proper types for API responses
interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  clientName: string;
  clientEmail: string | null;
  clientAddress?: string | null;
  currency: string;
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  amountPaid: string;
  issueDate: string;
  dueDate: string | null;
  notes?: string | null;
  pdfUrl?: string | null;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number;
    total: string;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    method: string;
    reference: string | null;
    paidAt: string;
  }>;
}

interface PaginatedResponse {
  data: InvoiceResponse[];
  total: number;
  page: number;
  limit: number;
}

interface FxRatesResponse {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

describe('Invoicing (e2e)', () => {
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

  const validDto = {
    clientName: 'ACME Corporation',
    clientEmail: 'billing@acme.com',
    issueDate: '2025-06-01',
    dueDate: '2025-06-30',
    currency: 'PKR',
    lineItems: [
      { description: 'Software Development', quantity: 40, unitPrice: 5000, taxRate: 0.17 },
    ],
  };

  async function createInvoice(
    user: Awaited<ReturnType<typeof createTestUser>>,
  ): Promise<InvoiceResponse> {
    const response = await api(app)
      .post('/v1/invoices')
      .set(authHeaders(user))
      .send(validDto)
      .expect(201);

    // Type assertion after validation
    const data = response.body?.data;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }
    return data as InvoiceResponse;
  }

  async function createAndSend(
    user: Awaited<ReturnType<typeof createTestUser>>,
  ): Promise<InvoiceResponse> {
    const inv = await createInvoice(user);
    const response = await api(app)
      .patch(`/v1/invoices/${inv.id}/send`)
      .set(authHeaders(user))
      .expect(200);

    const data = response.body?.data;
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response format');
    }
    return data as InvoiceResponse;
  }

  describe('POST /v1/invoices', () => {
    it('201 — creates DRAFT with INV-YYYY-NNNNNN number', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const response = await api(app)
        .post('/v1/invoices')
        .set(authHeaders(user))
        .send(validDto)
        .expect(201);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.DRAFT);
      expect(data.invoiceNumber).toMatch(/^INV-\d{4}-\d{6}$/);
    });

    it('201 — computes totals: 40 × 5000 × 1.17 = 234,000', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const inv = await createInvoice(user);
      expect(parseFloat(inv.totalAmount)).toBe(234000);
      expect(parseFloat(inv.subtotal)).toBe(200000);
      expect(parseFloat(inv.taxAmount)).toBe(34000);
      expect(parseFloat(inv.amountPaid)).toBe(0);
    });

    it('201 — multi-line aggregated total', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const response = await api(app)
        .post('/v1/invoices')
        .set(authHeaders(user))
        .send({
          ...validDto,
          lineItems: [
            { description: 'Design', quantity: 10, unitPrice: 3000 },
            { description: 'Dev', quantity: 40, unitPrice: 5000 },
            { description: 'Hosting', quantity: 12, unitPrice: 500 },
          ],
        })
        .expect(201);

      const data = response.body?.data as InvoiceResponse;
      expect(parseFloat(data.totalAmount)).toBe(236000);
      expect(data.lineItems).toHaveLength(3);
    });

    it('400 — no line items', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const response = await api(app)
        .post('/v1/invoices')
        .set(authHeaders(user))
        .send({ ...validDto, lineItems: [] })
        .expect(400);

      const errorMessage = response.body?.message as string;
      expect(errorMessage).toMatch(/at least one line item/i);
    });

    it('400 — zero quantity', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await api(app)
        .post('/v1/invoices')
        .set(authHeaders(user))
        .send({ ...validDto, lineItems: [{ description: 'X', quantity: 0, unitPrice: 1000 }] })
        .expect(400);
    });

    it('400 — taxRate > 1', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await api(app)
        .post('/v1/invoices')
        .set(authHeaders(user))
        .send({
          ...validDto,
          lineItems: [{ description: 'X', quantity: 1, unitPrice: 1000, taxRate: 1.5 }],
        })
        .expect(400);
    });

    it('403 — VIEWER cannot create', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      await api(app).post('/v1/invoices').set(authHeaders(viewer)).send(validDto).expect(403);
    });

    it('401 — unauthenticated', () => api(app).post('/v1/invoices').send(validDto).expect(401));

    it('numbers are sequential within org', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const i1 = await createInvoice(user);
      const i2 = await createInvoice(user);
      const n1 = parseInt(i1.invoiceNumber.split('-')[2], 10);
      const n2 = parseInt(i2.invoiceNumber.split('-')[2], 10);
      expect(n2 - n1).toBe(1);
    });
  });

  describe('PATCH /v1/invoices/:id/send', () => {
    it('200 — DRAFT → SENT', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const inv = await createInvoice(user);
      const response = await api(app)
        .patch(`/v1/invoices/${inv.id}/send`)
        .set(authHeaders(user))
        .expect(200);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.SENT);
    });

    it('409 — already SENT', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      await api(app).patch(`/v1/invoices/${sent.id}/send`).set(authHeaders(user)).expect(409);
    });

    it('409 — VOID cannot be sent', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const inv = await createInvoice(user);
      await api(app).patch(`/v1/invoices/${inv.id}/void`).set(authHeaders(user));
      await api(app).patch(`/v1/invoices/${inv.id}/send`).set(authHeaders(user)).expect(409);
    });
  });

  describe('PATCH /v1/invoices/:id/void', () => {
    it('200 — DRAFT → VOID', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const inv = await createInvoice(user);
      const response = await api(app)
        .patch(`/v1/invoices/${inv.id}/void`)
        .set(authHeaders(user))
        .expect(200);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.VOID);
    });

    it('200 — SENT → VOID', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      const response = await api(app)
        .patch(`/v1/invoices/${sent.id}/void`)
        .set(authHeaders(user))
        .expect(200);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.VOID);
    });

    it('409 — PAID → VOID rejected (issue credit note)', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 234000, method: 'bank_transfer', paidAt: '2025-06-15' });

      const response = await api(app)
        .patch(`/v1/invoices/${sent.id}/void`)
        .set(authHeaders(user))
        .expect(409);

      const errorMessage = response.body?.message as string;
      expect(errorMessage).toMatch(/credit note/i);
    });
  });

  describe('POST /v1/invoices/:id/payments', () => {
    it('201 — partial payment → PARTIALLY_PAID', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      const response = await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 100000, method: 'bank_transfer', paidAt: '2025-06-10' })
        .expect(201);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.PARTIALLY_PAID);
      expect(parseFloat(data.amountPaid)).toBe(100000);
    });

    it('201 — full payment → PAID', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      const response = await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 234000, method: 'bank_transfer', paidAt: '2025-06-15' })
        .expect(201);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.PAID);
    });

    it('201 — two partials summing to total → PAID', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 117000, method: 'bank_transfer', paidAt: '2025-06-10' });

      const response = await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 117000, method: 'bank_transfer', paidAt: '2025-06-20' })
        .expect(201);

      const data = response.body?.data as InvoiceResponse;
      expect(data.status).toBe(InvoiceStatus.PAID);
      expect(parseFloat(data.amountPaid)).toBe(234000);
    });

    it('400 — overpayment rejected', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      const response = await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 999999, method: 'bank_transfer', paidAt: '2025-06-15' })
        .expect(400);

      const errorMessage = response.body?.message as string;
      expect(errorMessage).toMatch(/exceeds.*outstanding/i);
    });

    it('409 — DRAFT cannot accept payments', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const inv = await createInvoice(user);
      const response = await api(app)
        .post(`/v1/invoices/${inv.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 100000, method: 'bank_transfer', paidAt: '2025-06-15' })
        .expect(409);

      const errorMessage = response.body?.message as string;
      expect(errorMessage).toMatch(/DRAFT/i);
    });

    it('payment persisted in payments array', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const sent = await createAndSend(user);
      await api(app)
        .post(`/v1/invoices/${sent.id}/payments`)
        .set(authHeaders(user))
        .send({ amount: 50000, method: 'cheque', reference: 'CHQ-001', paidAt: '2025-06-10' });

      const response = await api(app).get(`/v1/invoices/${sent.id}`).set(authHeaders(user));

      const data = response.body?.data as InvoiceResponse;
      expect(data.payments).toHaveLength(1);
      expect(data.payments[0]?.reference).toBe('CHQ-001');
    });
  });

  describe('GET /v1/invoices', () => {
    it('200 — paginated list', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await createInvoice(user);
      await createInvoice(user);
      const response = await api(app).get('/v1/invoices').set(authHeaders(user)).expect(200);

      const data = response.body?.data as PaginatedResponse;
      expect(data.total).toBe(2);
      expect(data.page).toBe(1);
    });

    it('200 — status filter', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const inv = await createInvoice(user);
      await createInvoice(user);
      await api(app).patch(`/v1/invoices/${inv.id}/send`).set(authHeaders(user));

      const response = await api(app)
        .get('/v1/invoices?status=SENT')
        .set(authHeaders(user))
        .expect(200);

      const data = response.body?.data as PaginatedResponse;
      expect(data.data).toHaveLength(1);
      expect(data.data[0]?.status).toBe(InvoiceStatus.SENT);
    });

    it('200 — tenant isolation: org A cannot see org B invoices', async () => {
      const userA = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const userB = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await createInvoice(userA);
      await createInvoice(userA);
      await createInvoice(userB);

      const response = await api(app).get('/v1/invoices').set(authHeaders(userA)).expect(200);

      const data = response.body?.data as PaginatedResponse;
      expect(data.total).toBe(2);
    });
  });

  describe('GET /v1/invoices/fx/rates', () => {
    it('200 — returns rate map with PKR base', async () => {
      const user = await createTestUser(app, { role: UserRole.VIEWER });
      const response = await api(app)
        .get('/v1/invoices/fx/rates')
        .set(authHeaders(user))
        .expect(200);

      const data = response.body?.data as FxRatesResponse;
      expect(data.base).toBe('PKR');
      expect(data.rates['PKR']).toBe(1);
    });
  });
});
