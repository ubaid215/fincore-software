/**
 * test/e2e/bank-reconciliation.e2e-spec.ts
 *
 * End-to-end tests for Bank Reconciliation.
 * Uses in-memory CSV content to test the full import → match → report pipeline.
 * S3 uploads are no-ops (dummy credentials in test env).
 *
 * Sprint: S3 · Week 7–8
 */

import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb } from '../helpers/db.helper';
import { createTestUser, authHeaders, type TestCredentials } from '../helpers/auth.helper';

// ── Typed response shapes ──────────────────────────────────────────────────

interface ImportStatementResult {
  statementId: string;
  bankName: string;
  accountNumber: string;
  format: string;
  periodStart: string;
  periodEnd: string;
  transactionCount: number;
}

interface BankTransaction {
  id: string;
  statementId: string;
  date: string;
  description: string;
  reference: string | null;
  debit: string;
  credit: string;
  balance: string | null;
  matchStatus: string;
  matchedEntryId: string | null;
  matchConfidence: string | null;
  createdAt: string;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface PaginatedTransactions {
  data: BankTransaction[];
  meta: PaginationMeta;
}

interface ReportSummary {
  total: number;
  totalDebit: number;
  totalCredit: number;
  unmatchedCount: number;
  byMatchStatus: Record<string, { count: number; debit: number; credit: number }>;
}

interface ReconReport {
  statementId: string;
  isReconciled: boolean;
  summary: ReportSummary;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

/** Cast supertest response body to a typed API envelope. */
function typed<T>(rawBody: unknown): ApiResponse<T> {
  return rawBody as ApiResponse<T>;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Bank Reconciliation (e2e)', () => {
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

  // ── Sample CSV content ────────────────────────────────────────────────────

  const CSV_CONTENT =
    `Date,Description,Reference,Debit,Credit,Balance\n` +
    `2025-03-01,Opening Balance,,0,100000,100000\n` +
    `2025-03-05,ACME Client Payment,INV-2025-000001,0,50000,150000\n` +
    `2025-03-10,Office Rent,CHQ-001,35000,0,115000\n` +
    `2025-03-15,HBL Bank Fee,,500,0,114500\n`;

  async function importStatement(user: TestCredentials): Promise<ImportStatementResult> {
    const res = await api(app)
      .post('/v1/bank-reconciliation/statements/import')
      .set(authHeaders(user))
      .field('bankName', 'HBL')
      .field('accountNumber', 'PK00HABB0000000000000000')
      .field('format', 'CSV')
      .attach('file', Buffer.from(CSV_CONTENT), {
        filename: 'statement.csv',
        contentType: 'text/csv',
      })
      .expect(201);
    return typed<ImportStatementResult>(res.body).data;
  }

  // ── POST /v1/bank-reconciliation/statements/import ─────────────────────────
  describe('POST /v1/bank-reconciliation/statements/import', () => {
    it('201 — imports CSV with 4 transactions', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const result = await importStatement(user);

      expect(result.statementId).toBeDefined();
      expect(result.transactionCount).toBe(4);
      expect(result.bankName).toBe('HBL');
      expect(result.format).toBe('CSV');
    });

    it('201 — transactions are persisted as UNMATCHED', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const res = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions`)
        .set(authHeaders(user))
        .expect(200);

      const payload = typed<PaginatedTransactions>(res.body).data;
      expect(payload.meta.total).toBe(4);
      payload.data.forEach((txn) => {
        expect(txn.matchStatus).toBe('UNMATCHED');
      });
    });

    it('400 — no file uploaded', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const res = await api(app)
        .post('/v1/bank-reconciliation/statements/import')
        .set(authHeaders(user))
        .field('bankName', 'HBL')
        .field('accountNumber', '1234')
        .field('format', 'CSV')
        .expect(400);

      const body = typed<never>(res.body) as ApiResponse<never> & { message: string };
      expect(body.message).toMatch(/no file/i);
    });

    it('403 — VIEWER cannot import statements', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      await api(app)
        .post('/v1/bank-reconciliation/statements/import')
        .set(authHeaders(viewer))
        .field('bankName', 'HBL')
        .field('accountNumber', '1234')
        .field('format', 'CSV')
        .attach('file', Buffer.from(CSV_CONTENT), { filename: 'stmt.csv', contentType: 'text/csv' })
        .expect(403);
    });

    it('401 — unauthenticated', () =>
      api(app).post('/v1/bank-reconciliation/statements/import').expect(401));
  });

  // ── GET /v1/bank-reconciliation/statements ─────────────────────────────────
  describe('GET /v1/bank-reconciliation/statements', () => {
    it('200 — lists imported statements', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await importStatement(user);
      await importStatement(user);

      const res = await api(app)
        .get('/v1/bank-reconciliation/statements')
        .set(authHeaders(user))
        .expect(200);

      const statements = typed<ImportStatementResult[]>(res.body).data;
      expect(Array.isArray(statements)).toBe(true);
      expect(statements.length).toBe(2);
    });

    it('200 — tenant isolation: org A cannot see org B statements', async () => {
      const userA = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const userB = await createTestUser(app, { role: UserRole.ACCOUNTANT });

      await importStatement(userA);
      await importStatement(userB);

      const res = await api(app)
        .get('/v1/bank-reconciliation/statements')
        .set(authHeaders(userA))
        .expect(200);

      const statements = typed<ImportStatementResult[]>(res.body).data;
      expect(statements.length).toBe(1);
    });
  });

  // ── GET /v1/bank-reconciliation/statements/:id/transactions ────────────────
  describe('GET transactions', () => {
    it('200 — returns paginated transactions', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const res = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions?limit=2`)
        .set(authHeaders(user))
        .expect(200);

      const payload = typed<PaginatedTransactions>(res.body).data;
      expect(payload.meta.total).toBe(4);
      expect(payload.data).toHaveLength(2);
      expect(payload.meta.pages).toBe(2);
    });

    it('200 — matchStatus filter returns only UNMATCHED', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const txnRes = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions`)
        .set(authHeaders(user));

      const txns = typed<PaginatedTransactions>(txnRes.body).data;
      const firstTxnId = txns.data[0].id;

      await api(app)
        .patch(`/v1/bank-reconciliation/transactions/${firstTxnId}/exclude`)
        .set(authHeaders(user));

      const filteredRes = await api(app)
        .get(
          `/v1/bank-reconciliation/statements/${stmt.statementId}/transactions?matchStatus=UNMATCHED`,
        )
        .set(authHeaders(user))
        .expect(200);

      const filtered = typed<PaginatedTransactions>(filteredRes.body).data;
      expect(filtered.meta.total).toBe(3);
    });
  });

  // ── PATCH /v1/bank-reconciliation/transactions/:id/exclude ─────────────────
  describe('PATCH exclude + unmatch', () => {
    it('200 — excludes a transaction', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const txnRes = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions`)
        .set(authHeaders(user));

      const txns = typed<PaginatedTransactions>(txnRes.body).data;
      const bankFeeId = txns.data[3].id;

      const res = await api(app)
        .patch(`/v1/bank-reconciliation/transactions/${bankFeeId}/exclude`)
        .set(authHeaders(user))
        .expect(200);

      expect(typed<BankTransaction>(res.body).data.matchStatus).toBe('EXCLUDED');
    });

    it('200 — unmatch returns excluded transaction to UNMATCHED', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const txnRes = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions`)
        .set(authHeaders(user));

      const txns = typed<PaginatedTransactions>(txnRes.body).data;
      const txnId = txns.data[3].id;

      await api(app)
        .patch(`/v1/bank-reconciliation/transactions/${txnId}/exclude`)
        .set(authHeaders(user));

      const res = await api(app)
        .patch(`/v1/bank-reconciliation/transactions/${txnId}/unmatch`)
        .set(authHeaders(user))
        .expect(200);

      expect(typed<BankTransaction>(res.body).data.matchStatus).toBe('UNMATCHED');
    });

    it('409 — unmatching an already-UNMATCHED transaction', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const txnRes = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions`)
        .set(authHeaders(user));

      const txns = typed<PaginatedTransactions>(txnRes.body).data;
      const txnId = txns.data[0].id;

      await api(app)
        .patch(`/v1/bank-reconciliation/transactions/${txnId}/unmatch`)
        .set(authHeaders(user))
        .expect(409);
    });
  });

  // ── GET /v1/bank-reconciliation/statements/:id/report ──────────────────────
  describe('GET /v1/bank-reconciliation/statements/:id/report', () => {
    it('200 — isReconciled = false when unmatched transactions remain', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const res = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/report`)
        .set(authHeaders(user))
        .expect(200);

      const report = typed<ReconReport>(res.body).data;
      expect(report.isReconciled).toBe(false);
      expect(report.summary.total).toBe(4);
      expect(report.summary.unmatchedCount).toBe(4);
    });

    it('200 — isReconciled = true when all transactions excluded or matched', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const txnRes = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/transactions`)
        .set(authHeaders(user));

      const txns = typed<PaginatedTransactions>(txnRes.body).data;
      for (const txn of txns.data) {
        await api(app)
          .patch(`/v1/bank-reconciliation/transactions/${txn.id}/exclude`)
          .set(authHeaders(user));
      }

      const res = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/report`)
        .set(authHeaders(user))
        .expect(200);

      expect(typed<ReconReport>(res.body).data.isReconciled).toBe(true);
    });

    it('200 — report includes totals by match status', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const res = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/report`)
        .set(authHeaders(user))
        .expect(200);

      const report = typed<ReconReport>(res.body).data;
      expect(report.summary.byMatchStatus['UNMATCHED']).toBeDefined();
      expect(report.summary.byMatchStatus['UNMATCHED'].count).toBe(4);
    });

    it('200 — totalDebit and totalCredit are correct', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const stmt = await importStatement(user);

      const res = await api(app)
        .get(`/v1/bank-reconciliation/statements/${stmt.statementId}/report`)
        .set(authHeaders(user))
        .expect(200);

      const report = typed<ReconReport>(res.body).data;
      // CSV: Credits = 100000 + 50000 = 150000; Debits = 35000 + 500 = 35500
      expect(report.summary.totalCredit).toBe(150000);
      expect(report.summary.totalDebit).toBe(35500);
    });
  });
});

/*
 * Sprint S3 · Bank Reconciliation E2E Tests · Week 7–8
 * Tests import → exclude → unmatch → reconciliation report via real HTTP
 */
