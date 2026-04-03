// test/e2e/general-ledger.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

// Define interfaces for response types
interface Account {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  isLocked: boolean;
  isArchived: boolean;
  organizationId: string;
}

interface JournalLine {
  accountId: string;
  debit: number;
  credit: number;
  account?: Account;
  currency?: string;
  fxRate?: number;
}

interface JournalEntry {
  id: string;
  entryNumber: string;
  description: string;
  reference: string | null;
  status: string;
  isReversed: boolean;
  postedAt?: string;
  lines: JournalLine[];
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

describe('General Ledger (e2e)', () => {
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

  /** Bootstrap a complete org with GAAP accounts and return two common account IDs */
  async function setupOrg(): Promise<{ user: any; headers: any; cashId: string; revenueId: string }> {
    const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
    const headers = authHeaders(user);

    // Import GAAP template
    await api(app).post('/v1/accounts/import').set(headers).send({ template: 'GAAP_USA' });

    // Look up accounts by code
    const { body }: { body: ApiResponse<Account[]> } = await api(app).get('/v1/accounts?flat=true').set(headers);
    const accounts: Account[] = body.data;

    const cash = accounts.find((a: Account) => a.accountCode === '1112'); // Cash at Bank — HBL
    const revenue = accounts.find((a: Account) => a.accountCode === '4112'); // Service Revenue

    if (!cash || !revenue) {
      throw new Error('Required accounts not found in template');
    }

    return { user, headers, cashId: cash.id, revenueId: revenue.id };
  }

  function makeValidEntry(cashId: string, revenueId: string, amount = 50000) {
    return {
      description: 'Client payment received',
      entryDate: '2025-03-15',
      lines: [
        { accountId: cashId, debit: amount, credit: 0 },
        { accountId: revenueId, debit: 0, credit: amount },
      ],
    };
  }

  // ─── POST /v1/journal-entries ─────────────────────────────────────────────
  describe('POST /v1/journal-entries', () => {
    it('201 — creates a DRAFT journal entry with INV-format entry number', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      const { body }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId))
        .expect(201);

      expect(body.data.status).toBe('DRAFT');
      expect(body.data.entryNumber).toMatch(/^JE-\d{4}-\d{6}$/);
      expect(body.data.lines).toHaveLength(2);
    });

    it('201 — creates a 3-line compound entry (compound journal)', async () => {
      const { headers } = await setupOrg();
      const { body }: { body: ApiResponse<Account[]> } = await api(app).get('/v1/accounts?flat=true').set(headers);
      const accounts: Account[] = body.data;

      const cash = accounts.find((a: Account) => a.accountCode === '1112');
      const revenue = accounts.find((a: Account) => a.accountCode === '4112');
      const tax = accounts.find((a: Account) => a.accountCode === '2131'); // Sales Tax Payable

      if (!cash || !revenue || !tax) {
        throw new Error('Required accounts not found');
      }

      const { body: response }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          description: 'Invoice with 17% GST',
          entryDate: '2025-03-15',
          lines: [
            { accountId: cash.id, debit: 58500, credit: 0 }, // Cash
            { accountId: revenue.id, debit: 0, credit: 50000 }, // Revenue
            { accountId: tax.id, debit: 0, credit: 8500 }, // GST 17%
          ],
        })
        .expect(201);

      expect(response.data.lines).toHaveLength(3);
    });

    // Double-entry violation tests
    it('400 — debits ≠ credits', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      const { body }: { body: { message: string } } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          description: 'Bad entry',
          entryDate: '2025-03-15',
          lines: [
            { accountId: cashId, debit: 50000, credit: 0 },
            { accountId: revenueId, debit: 0, credit: 49000 }, // 1000 short
          ],
        })
        .expect(400);

      expect(body.message).toMatch(/double-entry/i);
    });

    it('400 — all-zero entry', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body }: { body: { message: string } } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          description: 'Zero entry',
          entryDate: '2025-03-15',
          lines: [
            { accountId: cashId, debit: 0, credit: 0 },
            { accountId: revenueId, debit: 0, credit: 0 },
          ],
        })
        .expect(400);
      expect(body.message).toMatch(/zero/i);
    });

    it('400 — fewer than 2 lines', async () => {
      const { headers, cashId } = await setupOrg();
      await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          description: 'Single line',
          entryDate: '2025-03-15',
          lines: [{ accountId: cashId, debit: 50000, credit: 0 }],
        })
        .expect(400);
    });

    it('400 — line has both debit and credit > 0', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body }: { body: { message: string } } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          description: 'Bad line',
          entryDate: '2025-03-15',
          lines: [
            { accountId: cashId, debit: 50000, credit: 50000 },
            { accountId: revenueId, debit: 0, credit: 0 },
          ],
        })
        .expect(400);
      expect(body.message).toMatch(/both debit and credit/i);
    });

    it('400 — account not in organization', async () => {
      const { headers } = await setupOrg();
      const { body }: { body: { message: string } } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          description: 'Cross-org',
          entryDate: '2025-03-15',
          lines: [
            { accountId: '00000000-0000-0000-0000-000000000001', debit: 1000, credit: 0 },
            { accountId: '00000000-0000-0000-0000-000000000002', debit: 0, credit: 1000 },
          ],
        })
        .expect(404);
      expect(body.message).toMatch(/not found/i);
    });

    it('400 — writing to locked account', async () => {
      const { user, headers, cashId } = await setupOrg();

      // Lock the cash account
      await api(app)
        .patch(`/v1/accounts/${cashId}/lock`)
        .set(authHeaders({ ...user, token: user.token, orgId: user.orgId }));

      const { body: accountResponse }: { body: ApiResponse<Account[]> } = await api(app)
        .get('/v1/accounts?flat=true')
        .set(headers);
      const revenue = accountResponse.data.find((a: Account) => a.accountCode === '4112');

      if (!revenue) {
        throw new Error('Revenue account not found');
      }

      const { body }: { body: { message: string } } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenue.id))
        .expect(400);

      expect(body.message).toMatch(/locked/i);
    });

    it('403 — VIEWER cannot create journal entries', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      await api(app)
        .post('/v1/journal-entries')
        .set(authHeaders(viewer))
        .send({ description: 'x', entryDate: '2025-01-01', lines: [] })
        .expect(403);
    });

    it('401 — unauthenticated', () => api(app).post('/v1/journal-entries').send({}).expect(401));
  });

  // ─── PATCH /v1/journal-entries/:id/post ──────────────────────────────────
  describe('PATCH /v1/journal-entries/:id/post', () => {
    it('200 — posts a DRAFT entry', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId))
        .expect(201);

      const { body: posted }: { body: ApiResponse<JournalEntry> } = await api(app)
        .patch(`/v1/journal-entries/${created.data.id}/post`)
        .set(headers)
        .expect(200);

      expect(posted.data.status).toBe('POSTED');
      expect(posted.data.postedAt).toBeDefined();
    });

    it('409 — posting an already-POSTED entry', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId));

      await api(app).patch(`/v1/journal-entries/${created.data.id}/post`).set(headers);

      const { body }: { body: { message: string } } = await api(app)
        .patch(`/v1/journal-entries/${created.data.id}/post`)
        .set(headers)
        .expect(409);

      expect(body.message).toMatch(/already POSTED/i);
    });
  });

  // ─── POST /v1/journal-entries/:id/reverse ────────────────────────────────
  describe('POST /v1/journal-entries/:id/reverse', () => {
    it('201 — creates reversal with swapped debit/credit', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      // Create and post
      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId, 30000));
      const { body: posted }: { body: ApiResponse<JournalEntry> } = await api(app)
        .patch(`/v1/journal-entries/${created.data.id}/post`)
        .set(headers);

      // Reverse
      const { body: reversal }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post(`/v1/journal-entries/${posted.data.id}/reverse`)
        .set(headers)
        .send({ description: 'Correcting March entry' })
        .expect(201);

      expect(reversal.data.status).toBe('POSTED');
      expect(reversal.data.entryNumber).not.toBe(posted.data.entryNumber);

      // Find the original line and reversal line and verify swap
      const originalCashLine = posted.data.lines.find(
        (l: JournalLine) => l.account?.accountCode === '1112'
      );
      const reversalCashLine = reversal.data.lines.find(
        (l: JournalLine) => l.account?.accountCode === '1112'
      );

      // Original: DR 30000 / CR 0 → Reversal: DR 0 / CR 30000
      expect(Number(originalCashLine?.debit)).toBe(30000);
      expect(Number(reversalCashLine?.credit)).toBe(30000);
    });

    it('400 — cannot reverse a DRAFT entry', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId));

      await api(app)
        .post(`/v1/journal-entries/${created.data.id}/reverse`)
        .set(headers)
        .expect(400);
    });

    it('409 — cannot reverse the same entry twice', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId));
      await api(app).patch(`/v1/journal-entries/${created.data.id}/post`).set(headers);
      await api(app).post(`/v1/journal-entries/${created.data.id}/reverse`).set(headers);

      const { body }: { body: { message: string } } = await api(app)
        .post(`/v1/journal-entries/${created.data.id}/reverse`)
        .set(headers)
        .expect(409);
      expect(body.message).toMatch(/already been reversed/i);
    });

    it('original entry status becomes REVERSED after reversal', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId));
      const { body: posted }: { body: ApiResponse<JournalEntry> } = await api(app)
        .patch(`/v1/journal-entries/${created.data.id}/post`)
        .set(headers);

      await api(app).post(`/v1/journal-entries/${posted.data.id}/reverse`).set(headers);

      const { body: original }: { body: ApiResponse<JournalEntry> } = await api(app)
        .get(`/v1/journal-entries/${posted.data.id}`)
        .set(headers)
        .expect(200);

      expect(original.data.status).toBe('REVERSED');
      expect(original.data.isReversed).toBe(true);
    });
  });

  // ─── DELETE /v1/journal-entries/:id ──────────────────────────────────────
  describe('DELETE /v1/journal-entries/:id', () => {
    it('200 — deletes a DRAFT entry', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId));

      const { body }: { body: ApiResponse<{ deleted: boolean }> } = await api(app)
        .delete(`/v1/journal-entries/${created.data.id}`)
        .set(headers)
        .expect(200);

      expect(body.data.deleted).toBe(true);

      // Verify it's gone from DB
      await api(app).get(`/v1/journal-entries/${created.data.id}`).set(headers).expect(404);
    });

    it('409 — cannot delete a POSTED entry', async () => {
      const { headers, cashId, revenueId } = await setupOrg();
      const { body: created }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId));
      await api(app).patch(`/v1/journal-entries/${created.data.id}/post`).set(headers);

      const { body }: { body: { message: string } } = await api(app)
        .delete(`/v1/journal-entries/${created.data.id}`)
        .set(headers)
        .expect(409);

      expect(body.message).toMatch(/DRAFT entries can be deleted/i);
    });
  });

  // ─── GET /v1/journal-entries/trial-balance ───────────────────────────────
  describe('GET /v1/journal-entries/trial-balance', () => {
    it('200 — returns balanced trial balance after posting entries', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      // Post 3 entries
      for (let i = 0; i < 3; i++) {
        const { body: entry }: { body: ApiResponse<JournalEntry> } = await api(app)
          .post('/v1/journal-entries')
          .set(headers)
          .send(makeValidEntry(cashId, revenueId, (i + 1) * 10000));
        await api(app).patch(`/v1/journal-entries/${entry.data.id}/post`).set(headers);
      }

      const { body }: { body: ApiResponse<any> } = await api(app)
        .get('/v1/journal-entries/trial-balance')
        .set(headers)
        .expect(200);

      expect(body.data.isBalanced).toBe(true);
      expect(body.data.imbalance).toBe(0);
      expect(body.data.totalDebits).toBe(body.data.totalCredits);
      expect(body.data.totalDebits).toBe(60000); // 10000+20000+30000
      expect(body.data.rows).toHaveLength(2); // Cash + Revenue
    });

    it('200 — DRAFT entries are excluded from trial balance', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      // Post one, leave one as DRAFT
      const { body: entry }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId, 10000));
      await api(app).patch(`/v1/journal-entries/${entry.data.id}/post`).set(headers);

      // DRAFT — not posted
      await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send(makeValidEntry(cashId, revenueId, 999999));

      const { body }: { body: ApiResponse<any> } = await api(app)
        .get('/v1/journal-entries/trial-balance')
        .set(headers)
        .expect(200);

      // Only the posted 10000 should appear
      expect(body.data.totalDebits).toBe(10000);
      expect(body.data.isBalanced).toBe(true);
    });
  });

  // ─── GET /v1/journal-entries/accounts/:id/balance ─────────────────────────
  describe('GET /v1/journal-entries/accounts/:id/balance', () => {
    it('200 — returns correct balance for asset account', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      // Post two entries: +50000 and +25000 on cash
      for (const amount of [50000, 25000]) {
        const { body: entry }: { body: ApiResponse<JournalEntry> } = await api(app)
          .post('/v1/journal-entries')
          .set(headers)
          .send(makeValidEntry(cashId, revenueId, amount));
        await api(app).patch(`/v1/journal-entries/${entry.data.id}/post`).set(headers);
      }

      const { body }: { body: ApiResponse<any> } = await api(app)
        .get(`/v1/journal-entries/accounts/${cashId}/balance`)
        .set(headers)
        .expect(200);

      expect(body.data.netBalance).toBe(75000);
      expect(body.data.normalBalance).toBe('DEBIT');
      expect(body.data.accountCode).toBe('1112');
    });

    it('200 — returns zero balance for account with no transactions', async () => {
      const { headers, cashId } = await setupOrg();

      const { body }: { body: ApiResponse<any> } = await api(app)
        .get(`/v1/journal-entries/accounts/${cashId}/balance`)
        .set(headers)
        .expect(200);

      expect(body.data.netBalance).toBe(0);
    });
  });

  // ─── Fiscal period integration ────────────────────────────────────────────
  describe('Fiscal period + GL interaction', () => {
    it('400 — cannot post entry to a CLOSED fiscal period', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      // Create period for Q1 2025
      const { body: period }: { body: ApiResponse<{ id: string }> } = await api(app)
        .post('/v1/fiscal-periods')
        .set(headers)
        .send({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' })
        .expect(201);

      // Create a DRAFT entry within that period
      const { body: entry }: { body: ApiResponse<JournalEntry> } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({ ...makeValidEntry(cashId, revenueId), entryDate: '2025-02-15' })
        .expect(201);

      // Close the period (no DRAFT entries in it at this point — just the one we created)
      await api(app).patch(`/v1/journal-entries/${entry.data.id}/post`).set(headers);
      await api(app).patch(`/v1/fiscal-periods/${period.data.id}/close`).set(headers);

      // Now try to create a new entry in the closed period
      const { body }: { body: { message: string } } = await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({ ...makeValidEntry(cashId, revenueId), entryDate: '2025-02-20' })
        .expect(400);

      expect(body.message).toMatch(/closed/i);
    });

    it('400 — period with DRAFT entries cannot be closed', async () => {
      const { headers, cashId, revenueId } = await setupOrg();

      const { body: period }: { body: ApiResponse<{ id: string }> } = await api(app)
        .post('/v1/fiscal-periods')
        .set(headers)
        .send({ name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' });

      // Create DRAFT entry (do NOT post it)
      await api(app)
        .post('/v1/journal-entries')
        .set(headers)
        .send({
          ...makeValidEntry(cashId, revenueId),
          entryDate: '2025-02-15',
          periodId: period.data.id,
        });

      const { body }: { body: { message: string } } = await api(app)
        .patch(`/v1/fiscal-periods/${period.data.id}/close`)
        .set(headers)
        .expect(400);

      expect(body.message).toMatch(/draft.*entries/i);
    });
  });
});
