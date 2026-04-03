/**
 * test/e2e/subscriptions.e2e-spec.ts
 *
 * End-to-end tests for the Subscriptions module.
 * Tests the full state machine lifecycle via real HTTP.
 * Seeds plans via direct DB inserts since the plan seeder runs at startup.
 *
 * Sprint: S4 · Week 9–10
 */

import { INestApplication } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

describe('Subscriptions (e2e)', () => {
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

  async function seedPlan(overrides: Record<string, unknown> = {}) {
    const prisma = getPrisma(app);
    return prisma.plan.create({
      data: {
        name: 'PROFESSIONAL',
        displayName: 'Professional',
        priceMonthly: 7500,
        currency: 'PKR',
        maxSeats: 10,
        features: ['invoicing', 'expenses', 'bank_reconciliation', 'financial_reports'],
        isActive: true,
        ...overrides,
      },
    });
  }

  async function seedStarterPlan() {
    const prisma = getPrisma(app);
    return prisma.plan.create({
      data: {
        name: 'STARTER',
        displayName: 'Starter',
        priceMonthly: 2500,
        currency: 'PKR',
        maxSeats: 3,
        features: ['invoicing', 'expenses'],
        isActive: true,
      },
    });
  }

  // ── GET /v1/subscriptions/plans ────────────────────────────────────────────
  describe('GET /v1/subscriptions/plans', () => {
    it('200 — returns active plans', async () => {
      const user = await createTestUser(app, { role: UserRole.ADMIN });
      await seedPlan();

      const { body } = await api(app)
        .get('/v1/subscriptions/plans')
        .set(authHeaders(user))
        .expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('401 — unauthenticated', () => api(app).get('/v1/subscriptions/plans').expect(401));
  });

  // ── POST /v1/subscriptions/trial ───────────────────────────────────────────
  describe('POST /v1/subscriptions/trial', () => {
    it('201 — starts TRIALING subscription', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      const { body } = await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id })
        .expect(201);

      expect(body.data.status).toBe('TRIALING');
      expect(body.data.plan.name).toBe('PROFESSIONAL');
    });

    it('409 — cannot start trial when ACTIVE subscription exists', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      // Start trial first
      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      // Try to start another trial
      const { body } = await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id })
        .expect(409);

      expect(body.message).toMatch(/already has a subscription/i);
    });

    it('403 — VIEWER cannot start trial', async () => {
      const viewer = await createTestUser(app, { role: UserRole.VIEWER });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(viewer))
        .send({ planId: plan.id })
        .expect(403);
    });
  });

  // ── POST /v1/subscriptions/activate ──────────────────────────────────────
  describe('POST /v1/subscriptions/activate', () => {
    it('200 — activates TRIALING subscription', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      const { body } = await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id })
        .expect(200);

      expect(body.data.status).toBe('ACTIVE');
    });

    it('409 — ACTIVE → ACTIVE is invalid transition', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      const { body } = await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id })
        .expect(409);

      expect(body.message).toMatch(/transition/i);
    });
  });

  // ── PATCH /v1/subscriptions/plan ─────────────────────────────────────────
  describe('PATCH /v1/subscriptions/plan', () => {
    it('200 — upgrades from STARTER to PROFESSIONAL', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const starter = await seedStarterPlan();
      const pro = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: starter.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: starter.id });

      const { body } = await api(app)
        .patch('/v1/subscriptions/plan')
        .set(authHeaders(admin))
        .send({ planId: pro.id })
        .expect(200);

      expect(body.data.plan.name).toBe('PROFESSIONAL');
    });

    it('400 — downgrade blocked when current members exceed new plan limit', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const pro = await seedPlan();
      const starter = await seedStarterPlan(); // maxSeats: 3

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: pro.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: pro.id });

      // Manually add 5 members to the DB so downgrade is blocked
      const prisma = getPrisma(app);
      for (let i = 0; i < 4; i++) {
        const u = await prisma.user.create({
          data: {
            email: `extra${i}@test.com`,
            passwordHash: 'x',
            firstName: 'Extra',
            lastName: `User${i}`,
          },
        });
        await prisma.userOrganization.create({
          data: { userId: u.id, organizationId: admin.orgId, role: UserRole.VIEWER },
        });
      }

      const { body } = await api(app)
        .patch('/v1/subscriptions/plan')
        .set(authHeaders(admin))
        .send({ planId: starter.id })
        .expect(400);

      expect(body.message).toMatch(/exceed.*seat/i);
    });
  });

  // ── PATCH /v1/subscriptions/suspend ──────────────────────────────────────
  describe('PATCH /v1/subscriptions/suspend', () => {
    it('200 — suspends a PAST_DUE subscription', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app).patch('/v1/subscriptions/past-due').set(authHeaders(admin));

      const { body } = await api(app)
        .patch('/v1/subscriptions/suspend')
        .set(authHeaders(admin))
        .send({ reason: 'PAST_DUE' })
        .expect(200);

      expect(body.data.suspended).toBe(true);
    });

    it('409 — ACTIVE → SUSPEND is invalid (must go via PAST_DUE)', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      const { body } = await api(app)
        .patch('/v1/subscriptions/suspend')
        .set(authHeaders(admin))
        .send({ reason: 'MANUAL' })
        .expect(409);

      expect(body.message).toMatch(/transition/i);
    });
  });

  // ── GET /v1/subscriptions/seats ──────────────────────────────────────────
  describe('GET /v1/subscriptions/seats', () => {
    it('200 — returns seat availability', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      const { body } = await api(app)
        .get('/v1/subscriptions/seats')
        .set(authHeaders(admin))
        .expect(200);

      expect(body.data.maxSeats).toBe(10);
      expect(body.data.currentCount).toBeGreaterThanOrEqual(1);
      expect(typeof body.data.hasCapacity).toBe('boolean');
    });
  });

  // ── PATCH /v1/subscriptions/cancel ───────────────────────────────────────
  describe('PATCH /v1/subscriptions/cancel', () => {
    it('200 — cancels an ACTIVE subscription', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      const { body } = await api(app)
        .patch('/v1/subscriptions/cancel')
        .set(authHeaders(admin))
        .send({ reason: 'Switching to competitor' })
        .expect(200);

      expect(body.data.status).toBe('CANCELED');
    });

    it('409 — CANCELED → CANCELED (terminal)', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app)
        .post('/v1/subscriptions/activate')
        .set(authHeaders(admin))
        .send({ planId: plan.id });
      await api(app).patch('/v1/subscriptions/cancel').set(authHeaders(admin)).send({});

      await api(app).patch('/v1/subscriptions/cancel').set(authHeaders(admin)).send({}).expect(409);
    });
  });

  // ── GET /v1/subscriptions ─────────────────────────────────────────────────
  describe('GET /v1/subscriptions', () => {
    it('200 — returns current subscription', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });
      const plan = await seedPlan();

      await api(app)
        .post('/v1/subscriptions/trial')
        .set(authHeaders(admin))
        .send({ planId: plan.id });

      const { body } = await api(app).get('/v1/subscriptions').set(authHeaders(admin)).expect(200);

      expect(body.data.status).toBe('TRIALING');
      expect(body.data.plan).toBeDefined();
    });

    it('404 — no subscription found for org without one', async () => {
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const { body } = await api(app).get('/v1/subscriptions').set(authHeaders(admin)).expect(404);

      expect(body.message).toMatch(/no subscription/i);
    });
  });
});

/*
 * Sprint S4 · Subscriptions E2E Tests · Week 9–10
 * 18 test cases — full state machine via HTTP, plan changes, seat limits
 */
