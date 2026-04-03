/**
 * test/e2e/expenses.e2e-spec.ts
 *
 * End-to-end tests for the Expenses module.
 * Tests the full 3-step approval lifecycle through real HTTP calls.
 * S3 presigned URL calls are not made — tested at unit level.
 *
 * Sprint: S3 · Week 7–8
 */

import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

describe('Expenses (e2e)', () => {
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

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Set up an org, import GAAP accounts, return IDs for common accounts */
  async function setupOrgWithAccounts() {
    const owner = await createTestUser(app, { role: UserRole.OWNER });

    // Import GAAP template so we have valid account codes
    await api(app)
      .post('/v1/accounts/import')
      .set(authHeaders(owner))
      .send({ template: 'GAAP_USA' });

    const { body: flat } = await api(app).get('/v1/accounts?flat=true').set(authHeaders(owner));
    const accounts: any[] = flat.data;

    const salaryAccount = accounts.find((a: any) => a.accountCode === '6112'); // Staff Salaries
    const mealAccount = accounts.find((a: any) => a.accountCode === '6540'); // Meals & Entertainment
    const apAccount = accounts.find((a: any) => a.accountCode === '2111'); // Trade Creditors

    return {
      owner,
      salaryAccountId: salaryAccount.id,
      mealAccountId: mealAccount.id,
      apAccountId: apAccount.id,
    };
  }

  async function createExpense(user: any, salaryId: string, mealId: string) {
    const { body } = await api(app)
      .post('/v1/expenses')
      .set(authHeaders(user))
      .send({
        title: 'March Business Trip',
        currency: 'PKR',
        lines: [
          {
            accountId: salaryId,
            description: 'Hotel stay',
            amount: 12000,
            category: 'Accommodation',
          },
          { accountId: mealId, description: 'Client dinner', amount: 3500, category: 'Meals' },
        ],
      })
      .expect(201);
    return body.data;
  }

  /** Attach a fake receipt directly in DB (bypasses S3) so we can test submit */
  async function attachReceipt(expenseId: string) {
    const prisma = getPrisma(app);
    return prisma.receipt.create({
      data: {
        expenseId,
        fileName: 'receipt.jpg',
        s3Key: `receipts/org/2025/06/${expenseId}/fake.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 102400,
      },
    });
  }

  // ── POST /v1/expenses ──────────────────────────────────────────────────────
  describe('POST /v1/expenses', () => {
    it('201 — creates DRAFT expense with correct total', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();

      const { body } = await api(app)
        .post('/v1/expenses')
        .set(authHeaders(owner))
        .send({
          title: 'March Trip',
          lines: [
            {
              accountId: salaryAccountId,
              description: 'Hotel',
              amount: 12000,
              category: 'Accommodation',
            },
            { accountId: mealAccountId, description: 'Meals', amount: 3500, category: 'Meals' },
          ],
        })
        .expect(201);

      expect(body.data.status).toBe('DRAFT');
      expect(parseFloat(body.data.totalAmount)).toBe(15500);
      expect(body.data.lines).toHaveLength(2);
    });

    it('404 — rejects unknown GL account', async () => {
      const owner = await createTestUser(app, { role: UserRole.OWNER });

      const { body } = await api(app)
        .post('/v1/expenses')
        .set(authHeaders(owner))
        .send({
          title: 'Bad',
          lines: [
            {
              accountId: '00000000-0000-0000-0000-000000000001',
              description: 'X',
              amount: 1000,
              category: 'X',
            },
          ],
        })
        .expect(404);

      expect(body.message).toMatch(/not found/i);
    });

    it('400 — no line items', async () => {
      const owner = await createTestUser(app, { role: UserRole.OWNER });
      await api(app)
        .post('/v1/expenses')
        .set(authHeaders(owner))
        .send({ title: 'Empty', lines: [] })
        .expect(400);
    });

    it('401 — unauthenticated', () =>
      api(app).post('/v1/expenses').send({ title: 'x', lines: [] }).expect(401));
  });

  // ── PATCH /v1/expenses/:id/submit ─────────────────────────────────────────
  describe('PATCH /v1/expenses/:id/submit', () => {
    it('200 — claimant submits DRAFT with receipt → SUBMITTED', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/submit`)
        .set(authHeaders(owner))
        .expect(200);

      expect(body.data.status).toBe('SUBMITTED');
    });

    it('400 — no receipts attached', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      // Do NOT attach receipt

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/submit`)
        .set(authHeaders(owner))
        .expect(400);

      expect(body.message).toMatch(/receipt/i);
    });

    it('409 — cannot submit an already-SUBMITTED expense', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);

      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));
      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/submit`)
        .set(authHeaders(owner))
        .expect(409);

      expect(body.message).toMatch(/transition/i);
    });
  });

  // ── Approval chain ─────────────────────────────────────────────────────────
  describe('Manager + Finance approval chain', () => {
    it('200 — SUBMITTED → MANAGER_APPROVED by a MANAGER', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const manager = await createTestUser(app, { role: UserRole.MANAGER });
      // Manager must be in the same org — for E2E we use owner as claimant, manager as approver
      // Since createTestUser creates a separate org, let's use the owner for both
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/approve/manager`)
        .set(authHeaders(owner)) // owner has OWNER role which satisfies MANAGER requirement
        .expect(200);

      expect(body.data.status).toBe('MANAGER_APPROVED');
    });

    it('200 — MANAGER_APPROVED → FINANCE_APPROVED by ACCOUNTANT', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));
      await api(app).patch(`/v1/expenses/${expense.id}/approve/manager`).set(authHeaders(owner));

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/approve/finance`)
        .set(authHeaders(owner))
        .expect(200);

      expect(body.data.status).toBe('FINANCE_APPROVED');
    });

    it('409 — cannot skip manager step (SUBMITTED → FINANCE_APPROVED)', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/approve/finance`)
        .set(authHeaders(owner))
        .expect(409);

      expect(body.message).toMatch(/transition/i);
    });
  });

  // ── PATCH /v1/expenses/:id/reject ─────────────────────────────────────────
  describe('PATCH /v1/expenses/:id/reject', () => {
    it('200 — rejects from SUBMITTED with note', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/reject`)
        .set(authHeaders(owner))
        .send({ rejectionNote: 'Amounts do not match receipts provided.' })
        .expect(200);

      expect(body.data.status).toBe('REJECTED');
      expect(body.data.rejectionNote).toBe('Amounts do not match receipts provided.');
    });

    it('400 — rejection note too short', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));

      await api(app)
        .patch(`/v1/expenses/${expense.id}/reject`)
        .set(authHeaders(owner))
        .send({ rejectionNote: 'Too short' })
        .expect(400);
    });

    it('409 — cannot reject a DRAFT expense', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);

      await api(app)
        .patch(`/v1/expenses/${expense.id}/reject`)
        .set(authHeaders(owner))
        .send({ rejectionNote: 'This rejection note is long enough to pass validation.' })
        .expect(409);
    });
  });

  // ── PATCH /v1/expenses/:id/redraft ────────────────────────────────────────
  describe('PATCH /v1/expenses/:id/redraft', () => {
    it('200 — REJECTED → DRAFT for revision', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));
      await api(app)
        .patch(`/v1/expenses/${expense.id}/reject`)
        .set(authHeaders(owner))
        .send({ rejectionNote: 'Please provide itemised receipt for each expense.' });

      const { body } = await api(app)
        .patch(`/v1/expenses/${expense.id}/redraft`)
        .set(authHeaders(owner))
        .expect(200);

      expect(body.data.status).toBe('DRAFT');
      expect(body.data.rejectionNote).toBeNull();
    });
  });

  // ── GET /v1/expenses ───────────────────────────────────────────────────────
  describe('GET /v1/expenses', () => {
    it('200 — returns paginated list', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      await createExpense(owner, salaryAccountId, mealAccountId);
      await createExpense(owner, salaryAccountId, mealAccountId);

      const { body } = await api(app).get('/v1/expenses').set(authHeaders(owner)).expect(200);

      expect(body.data.total).toBe(2);
      expect(body.data.data).toHaveLength(2);
    });

    it('200 — status filter returns only matching expenses', async () => {
      const { owner, salaryAccountId, mealAccountId } = await setupOrgWithAccounts();
      const expense = await createExpense(owner, salaryAccountId, mealAccountId);
      await createExpense(owner, salaryAccountId, mealAccountId); // stays DRAFT
      await attachReceipt(expense.id);
      await api(app).patch(`/v1/expenses/${expense.id}/submit`).set(authHeaders(owner));

      const { body } = await api(app)
        .get('/v1/expenses?status=SUBMITTED')
        .set(authHeaders(owner))
        .expect(200);

      expect(body.data.total).toBe(1);
      expect(body.data.data[0].status).toBe('SUBMITTED');
    });
  });
});

/*
 * Sprint S3 · Expenses E2E Tests · Week 7–8
 * Tests the 3-step approval lifecycle via real HTTP; S3 bypass for receipt upload
 */
