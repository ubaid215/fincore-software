// test/e2e/chart-of-accounts.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { AccountType, UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

describe('Chart of Accounts (e2e)', () => {
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

  // ─── POST /v1/accounts ────────────────────────────────────────────────────
  describe('POST /v1/accounts', () => {
    it('201 — creates a top-level account', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });

      const { body } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({ accountCode: '1110', name: 'Cash at Bank', type: AccountType.ASSET })
        .expect(201);

      expect(body.data.accountCode).toBe('1110');
      expect(body.data.type).toBe(AccountType.ASSET);
      expect(body.data.isArchived).toBe(false);
      expect(body.data.isLocked).toBe(false);
    });

    it('201 — creates a child account linked to parent', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });

      // Create parent first
      const { body: parent } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({ accountCode: '1100', name: 'Current Assets', type: AccountType.ASSET })
        .expect(201);

      // Create child
      const { body: child } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({
          accountCode: '1110',
          name: 'Cash at Bank',
          type: AccountType.ASSET,
          parentId: parent.data.id,
        })
        .expect(201);

      expect(child.data.parentId).toBe(parent.data.id);
    });

    it('409 — duplicate account code in same org', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      const dto = { accountCode: '1110', name: 'Cash', type: AccountType.ASSET };

      await api(app).post('/v1/accounts').set(authHeaders(user)).send(dto).expect(201);
      const { body } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send(dto)
        .expect(409);
      expect(body.message).toMatch(/already in use/i);
    });

    it('400 — type mismatch with parent', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });

      const { body: parent } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({ accountCode: '1000', name: 'Assets', type: AccountType.ASSET })
        .expect(201);

      // Try to create LIABILITY child under ASSET parent
      const { body } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({
          accountCode: '2000',
          name: 'Payable',
          type: AccountType.LIABILITY,
          parentId: parent.data.id,
        })
        .expect(400);

      expect(body.message).toMatch(/type mismatch/i);
    });

    it('400 — account code with special chars fails validation', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({ accountCode: '1110 CASH', name: 'Cash', type: AccountType.ASSET })
        .expect(400);
    });

    it('403 — VIEWER cannot create accounts', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      await api(app)
        .post('/v1/accounts')
        .set(authHeaders(viewer))
        .send({ accountCode: '1110', name: 'Cash', type: AccountType.ASSET })
        .expect(403);
    });

    it('401 — unauthenticated', () =>
      api(app)
        .post('/v1/accounts')
        .send({ accountCode: '1110', name: 'Cash', type: AccountType.ASSET })
        .expect(401));
  });

  // ─── POST /v1/accounts/import ─────────────────────────────────────────────
  describe('POST /v1/accounts/import', () => {
    it('200 — imports GAAP USA template with 80+ accounts', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body } = await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(admin))
        .send({ template: 'GAAP_USA' })
        .expect(200);

      expect(body.data.imported).toBeGreaterThan(80);
      expect(body.data.template).toBe('GAAP_USA');
      expect(body.data.unresolved).toBe(0);
    });

    it('200 — imports IFRS template with 80+ accounts', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body } = await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(admin))
        .send({ template: 'IFRS' })
        .expect(200);

      expect(body.data.imported).toBeGreaterThan(80);
      expect(body.data.template).toBe('IFRS');
    });

    it('200 — re-import is idempotent (upserts, does not duplicate)', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body: first } = await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(admin))
        .send({ template: 'GAAP_USA' })
        .expect(200);

      const { body: second } = await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(admin))
        .send({ template: 'GAAP_USA' })
        .expect(200);

      // Account count should be the same — no duplicates
      const prisma = getPrisma(app);
      const count = await prisma.account.count({ where: { organizationId: admin.orgId } });
      expect(count).toBe(first.data.imported);
      expect(second.data.imported).toBe(first.data.imported);
    });

    it('403 — ACCOUNTANT cannot import template (Admin only)', async () => {
      const accountant = await createTestUser(app, { role: UserRole.ACCOUNTANT });
      await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(accountant))
        .send({ template: 'GAAP_USA' })
        .expect(403);
    });
  });

  // ─── GET /v1/accounts ────────────────────────────────────────────────────
  describe('GET /v1/accounts', () => {
    it('200 — returns nested tree by default', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(admin))
        .send({ template: 'GAAP_USA' });

      const { body } = await api(app).get('/v1/accounts').set(authHeaders(admin)).expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      // Top-level accounts (no parentId) should be root nodes
      body.data.forEach((node: any) => {
        expect(node.children).toBeDefined();
      });
    });

    it('200 — flat=true returns flat array', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      await api(app)
        .post('/v1/accounts/import')
        .set(authHeaders(admin))
        .send({ template: 'GAAP_USA' });

      const { body } = await api(app)
        .get('/v1/accounts?flat=true')
        .set(authHeaders(admin))
        .expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      // Flat list — no children property nesting
      body.data.forEach((a: any) => {
        expect(a.children).toBeUndefined();
      });
    });

    it('200 — type filter returns only matching accounts', async () => {
      const user = await createTestUser(app, { role: UserRole.ACCOUNTANT });

      await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({ accountCode: '1110', name: 'Cash', type: AccountType.ASSET });
      await api(app)
        .post('/v1/accounts')
        .set(authHeaders(user))
        .send({ accountCode: '4110', name: 'Revenue', type: AccountType.REVENUE });

      const { body } = await api(app)
        .get(`/v1/accounts?type=${AccountType.ASSET}&flat=true`)
        .set(authHeaders(user))
        .expect(200);

      expect(body.data.every((a: any) => a.type === AccountType.ASSET)).toBe(true);
    });
  });

  // ─── PATCH /v1/accounts/:id/archive ──────────────────────────────────────
  describe('PATCH /v1/accounts/:id/archive', () => {
    it('200 — archives an account with no children or transactions', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body: created } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(admin))
        .send({ accountCode: '9999', name: 'Unused', type: AccountType.EXPENSE })
        .expect(201);

      const { body } = await api(app)
        .patch(`/v1/accounts/${created.data.id}/archive`)
        .set(authHeaders(admin))
        .expect(200);

      expect(body.data.isArchived).toBe(true);
    });

    it('400 — cannot archive account with active children', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body: parent } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(admin))
        .send({ accountCode: '6000', name: 'Operating Expenses', type: AccountType.EXPENSE });

      await api(app)
        .post('/v1/accounts')
        .set(authHeaders(admin))
        .send({
          accountCode: '6100',
          name: 'Payroll',
          type: AccountType.EXPENSE,
          parentId: parent.data.id,
        });

      const { body } = await api(app)
        .patch(`/v1/accounts/${parent.data.id}/archive`)
        .set(authHeaders(admin))
        .expect(400);

      expect(body.message).toMatch(/active child/i);
    });
  });

  // ─── PATCH /v1/accounts/:id/lock & unlock ────────────────────────────────
  describe('PATCH /v1/accounts/:id/lock', () => {
    it('200 — locks then unlocks an account', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body: acc } = await api(app)
        .post('/v1/accounts')
        .set(authHeaders(admin))
        .send({ accountCode: '1110', name: 'Cash', type: AccountType.ASSET });

      const locked = await api(app)
        .patch(`/v1/accounts/${acc.data.id}/lock`)
        .set(authHeaders(admin))
        .expect(200);

      expect(locked.body.data.isLocked).toBe(true);

      const unlocked = await api(app)
        .patch(`/v1/accounts/${acc.data.id}/unlock`)
        .set(authHeaders(admin))
        .expect(200);

      expect(unlocked.body.data.isLocked).toBe(false);
    });
  });
});
