// test/e2e/manual-payments.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { UserRole, SubscriptionStatus, ManualPaymentStatus } from '@prisma/client';
import { createTestApp, api } from '../helpers/app.helper';
import { cleanDb, getPrisma } from '../helpers/db.helper';
import { createTestUser, authHeaders } from '../helpers/auth.helper';

interface ApiResponse<T = any> {
  data: T;
  message?: string;
  timestamp?: string;
}

interface InitiatePaymentResponse {
  referenceCode: string;
  proformaPdfUrl: string;
  paymentId: string;
  expiresAt: string;
}

interface ConfirmPaymentResponse {
  success: boolean;
  paymentId: string;
  referenceCode: string;
  subscriptionActivated: boolean;
  confirmedAt: string;
}

interface PendingPayment {
  id: string;
  referenceCode: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  planName: string;
  createdAt: string;
  expiresAt: string | null;
}

describe('Manual Payments (e2e)', () => {
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

  // ── Helper: Create plan and subscription ───────────────────────────────────
  async function createPlanAndSubscription(
    role: UserRole = UserRole.OWNER,
  ): Promise<{ user: any; subscriptionId: string; planId: string }> {
    const user = await createTestUser(app, { role });

    const prisma = getPrisma(app);
    const plan = await prisma.plan.create({
      data: {
        name: 'PROFESSIONAL',
        displayName: 'Professional',
        priceMonthly: 7500,
        currency: 'PKR',
        maxSeats: 10,
        features: ['invoicing', 'expenses', 'reports'],
        isActive: true,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        organizationId: user.orgId,
        planId: plan.id,
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        seatCount: 1,
      },
    });

    return {
      user,
      subscriptionId: subscription.id,
      planId: plan.id,
    };
  }

  // ── POST /v1/payments/initiate ────────────────────────────────────────────
  describe('POST /v1/payments/initiate', () => {
    it('201 — initiates payment and returns reference code', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription();

      const { body } = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId })
        .expect(201);

      const data = body.data as InitiatePaymentResponse;
      expect(data.referenceCode).toMatch(/^[A-Z]{2}[A-Z0-9]{6}$/);
      expect(data.proformaPdfUrl).toContain('amazonaws.com');
      expect(data.paymentId).toBeDefined();
      expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('201 — accepts custom amount', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription();

      const { body } = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId, amount: 5000 })
        .expect(201);

      const prisma = getPrisma(app);
      const payment = await prisma.manualPayment.findUnique({
        where: { referenceCode: body.data.referenceCode },
      });
      expect(payment?.amount.toNumber()).toBe(5000);
    });

    it('400 — subscription already ACTIVE', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription();

      const prisma = getPrisma(app);
      await prisma.subscription.update({
        where: { id: subscriptionId },
        data: { status: SubscriptionStatus.ACTIVE },
      });

      const { body } = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId })
        .expect(400);

      expect(body.message).toMatch(/already active/i);
    });

    it('404 — subscription not found', async () => {
      const { user } = await createPlanAndSubscription();

      await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('401 — unauthenticated', async () => {
      await api(app).post('/v1/payments/initiate').send({ subscriptionId: 'any-id' }).expect(401);
    });
  });

  // ── GET /v1/payments/status/:referenceCode ────────────────────────────────
  describe('GET /v1/payments/status/:referenceCode', () => {
    it('200 — returns payment status', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription();

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      const { body } = await api(app)
        .get(`/v1/payments/status/${referenceCode}`)
        .set(authHeaders(user))
        .expect(200);

      expect(body.data.status).toBe(ManualPaymentStatus.PENDING);
      expect(body.data.referenceCode).toBe(referenceCode);
      expect(body.data.amount).toBe(7500);
    });

    it('404 — invalid reference code', async () => {
      const { user } = await createPlanAndSubscription();

      await api(app).get('/v1/payments/status/INVALID99').set(authHeaders(user)).expect(404);
    });
  });

  // ── GET /v1/admin/payments/pending ────────────────────────────────────────
  describe('GET /v1/admin/payments/pending', () => {
    it('200 — returns pending payments for admin', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      await api(app).post('/v1/payments/initiate').set(authHeaders(user)).send({ subscriptionId });

      const { body } = await api(app)
        .get('/v1/admin/payments/pending')
        .set(authHeaders(user))
        .expect(200);

      const payments = body.data as PendingPayment[];
      expect(Array.isArray(payments)).toBe(true);
      expect(payments.length).toBe(1);
      expect(payments[0].referenceCode).toBeDefined();
      expect(payments[0].customerName).toBeDefined();
    });

    it('403 — VIEWER cannot access admin endpoint', async () => {
      const { user } = await createPlanAndSubscription(UserRole.VIEWER);

      await api(app).get('/v1/admin/payments/pending').set(authHeaders(user)).expect(403);
    });
  });

  // ── POST /v1/admin/payments/confirm ───────────────────────────────────────
  describe('POST /v1/admin/payments/confirm', () => {
    it('200 — confirms payment and activates subscription', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      const { body } = await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(user))
        .send({ referenceCode })
        .expect(200);

      const data = body.data as ConfirmPaymentResponse;
      expect(data.success).toBe(true);
      expect(data.subscriptionActivated).toBe(true);
      expect(data.referenceCode).toBe(referenceCode);

      // Verify subscription is now ACTIVE
      const prisma = getPrisma(app);
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);

      // Verify payment status is CONFIRMED
      const payment = await prisma.manualPayment.findUnique({
        where: { referenceCode },
      });
      expect(payment?.status).toBe(ManualPaymentStatus.CONFIRMED);
      expect(payment?.confirmedAt).toBeDefined();
    });

    it('200 — includes note in confirmation', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(user))
        .send({ referenceCode, note: 'Verified via bank screenshot' })
        .expect(200);

      const prisma = getPrisma(app);
      const payment = await prisma.manualPayment.findUnique({
        where: { referenceCode },
      });
      expect(payment?.rejectionNote).toBe('Verified via bank screenshot');
    });

    it('409 — cannot confirm already confirmed payment', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      // Confirm once
      await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(user))
        .send({ referenceCode });

      // Try to confirm again
      const { body } = await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(user))
        .send({ referenceCode })
        .expect(409);

      expect(body.message).toMatch(/already confirmed/i);
    });

    it('404 — invalid reference code', async () => {
      const { user } = await createPlanAndSubscription(UserRole.ADMIN);

      await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(user))
        .send({ referenceCode: 'INVALID99' })
        .expect(404);
    });
  });

  // ── POST /v1/admin/payments/reject ────────────────────────────────────────
  describe('POST /v1/admin/payments/reject', () => {
    it('200 — rejects payment with reason', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      const { body } = await api(app)
        .post('/v1/admin/payments/reject')
        .set(authHeaders(user))
        .send({ referenceCode, rejectionReason: 'Amount mismatch — expected PKR 7500' })
        .expect(200);

      expect(body.data.success).toBe(true);
      expect(body.data.emailSent).toBe(true);

      const prisma = getPrisma(app);
      const payment = await prisma.manualPayment.findUnique({
        where: { referenceCode },
      });
      expect(payment?.status).toBe(ManualPaymentStatus.REJECTED);
      expect(payment?.rejectionNote).toBe('Amount mismatch — expected PKR 7500');
    });

    it('409 — cannot reject already confirmed payment', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      // Confirm first
      await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(user))
        .send({ referenceCode });

      // Try to reject
      const { body } = await api(app)
        .post('/v1/admin/payments/reject')
        .set(authHeaders(user))
        .send({ referenceCode, rejectionReason: 'Too late' })
        .expect(409);

      expect(body.message).toMatch(/already confirmed/i);
    });

    it('400 — rejection reason too short', async () => {
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.ADMIN);

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      await api(app)
        .post('/v1/admin/payments/reject')
        .set(authHeaders(user))
        .send({ referenceCode, rejectionReason: 'Short' })
        .expect(400);
    });
  });

  // ── Full integration test: Complete payment flow ──────────────────────────
  describe('Complete payment flow', () => {
    it('Customer initiates → Admin confirms → Subscription activated', async () => {
      // 1. Customer (OWNER) initiates payment
      const { user, subscriptionId } = await createPlanAndSubscription(UserRole.OWNER);
      const admin = await createTestUser(app, { role: UserRole.ADMIN });

      const initiateRes = await api(app)
        .post('/v1/payments/initiate')
        .set(authHeaders(user))
        .send({ subscriptionId });

      const { referenceCode } = initiateRes.body.data;

      // 2. Check payment status
      const statusRes = await api(app)
        .get(`/v1/payments/status/${referenceCode}`)
        .set(authHeaders(user));
      expect(statusRes.body.data.status).toBe(ManualPaymentStatus.PENDING);

      // 3. Admin views pending payments
      const pendingRes = await api(app).get('/v1/admin/payments/pending').set(authHeaders(admin));
      expect(pendingRes.body.data.length).toBeGreaterThan(0);

      // 4. Admin confirms payment
      const confirmRes = await api(app)
        .post('/v1/admin/payments/confirm')
        .set(authHeaders(admin))
        .send({ referenceCode });

      expect(confirmRes.body.data.subscriptionActivated).toBe(true);

      // 5. Verify subscription is ACTIVE
      const prisma = getPrisma(app);
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
      });
      expect(subscription?.status).toBe(SubscriptionStatus.ACTIVE);

      // 6. Verify payment is CONFIRMED
      const payment = await prisma.manualPayment.findUnique({
        where: { referenceCode },
      });
      expect(payment?.status).toBe(ManualPaymentStatus.CONFIRMED);
      expect(payment?.confirmedAt).toBeDefined();
    });
  });
});
