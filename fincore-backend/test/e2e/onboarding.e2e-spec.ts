// test/e2e/onboarding.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

describe('Onboarding (e2e)', () => {
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

  // ─── GET /v1/onboarding ───────────────────────────────────────────────────
  describe('GET /v1/onboarding', () => {
    it('200 — returns onboarding state', async () => {
      const user = await createTestUser(app);

      const { body } = await api(app).get('/v1/onboarding').set(authHeaders(user)).expect(200);

      expect(body.data).toHaveProperty('currentStep');
      expect(body.data).toHaveProperty('steps');
      expect(body.data.steps).toHaveLength(6);
      expect(body.data.currentStep).toBe(1);
    });

    it('401 — unauthenticated', async () => {
      await api(app).get('/v1/onboarding').expect(401);
    });
  });

  // ─── PUT /v1/onboarding/wizard ────────────────────────────────────────────
  describe('PUT /v1/onboarding/wizard', () => {
    it('200 — updates wizard data and advances step', async () => {
      const user = await createTestUser(app);

      const { body } = await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 1,
          data: {
            organizationName: 'My Business',
            organizationSlug: 'my-business',
            organizationCurrency: 'PKR',
          },
        })
        .expect(200);

      expect(body.data.currentStep).toBe(2);
      expect(body.data.wizardData.organizationName).toBe('My Business');
    });

    it('400 — updating wrong step number', async () => {
      const user = await createTestUser(app);

      const { body } = await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 3,
          data: { someData: 'value' },
        })
        .expect(400);

      expect(body.message).toMatch(/complete step 1 first/i);
    });
  });

  // ─── POST /v1/onboarding/skip ─────────────────────────────────────────────
  describe('POST /v1/onboarding/skip', () => {
    it('200 — skips optional step', async () => {
      const user = await createTestUser(app);

      // Complete step 1 first
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 1,
          data: {
            organizationName: 'My Biz',
            organizationSlug: 'my-biz',
            organizationCurrency: 'PKR',
          },
        });

      // Complete step 2
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 2,
          data: {
            accountingStandard: 'GAAP_USA',
            fiscalYearStart: '2025-01-01',
            fiscalYearEnd: '2025-12-31',
          },
        });

      // Skip step 5 (Team invites - optional)
      const { body } = await api(app)
        .post('/v1/onboarding/skip')
        .set(authHeaders(user))
        .send({ step: 5 })
        .expect(200);

      expect(body.data.currentStep).toBe(6);
    });

    it('400 — cannot skip required step', async () => {
      const user = await createTestUser(app);

      const { body } = await api(app)
        .post('/v1/onboarding/skip')
        .set(authHeaders(user))
        .send({ step: 1 })
        .expect(400);

      expect(body.message).toMatch(/required and cannot be skipped/i);
    });
  });

  // ─── Complete onboarding flow ─────────────────────────────────────────────
  describe('Complete onboarding flow', () => {
    it('completes all steps successfully', async () => {
      const user = await createTestUser(app);

      // Step 1: Organization Setup
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 1,
          data: {
            organizationName: 'Complete Business',
            organizationSlug: 'complete-business',
            organizationCurrency: 'PKR',
          },
        });

      // Step 2: Accounting Settings
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 2,
          data: {
            accountingStandard: 'GAAP_USA',
            fiscalYearStart: '2025-01-01',
            fiscalYearEnd: '2025-12-31',
          },
        });

      // Step 3: Chart of Accounts
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 3,
          data: {
            importChartOfAccounts: true,
          },
        });

      // Step 4: Subscription
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 4,
          data: {
            selectedPlan: 'PROFESSIONAL',
            paymentMethod: 'manual',
          },
        });

      // Step 5: Team Invites (skip)
      await api(app).post('/v1/onboarding/skip').set(authHeaders(user)).send({ step: 5 });

      // Step 6: First Invoice
      await api(app)
        .put('/v1/onboarding/wizard')
        .set(authHeaders(user))
        .send({
          step: 6,
          data: {
            createFirstInvoice: true,
            firstInvoiceData: {
              clientName: 'First Client',
              clientEmail: 'client@example.com',
              amount: 50000,
              description: 'Consulting Services',
            },
          },
        });

      // Verify onboarding is complete
      const finalState = await api(app).get('/v1/onboarding').set(authHeaders(user)).expect(200);

      expect(finalState.body.data.completedAt).toBeDefined();
      expect(finalState.body.data.currentStep).toBeGreaterThan(6);
    });
  });
});
