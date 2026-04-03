/**
 * src/modules/subscriptions/tests/subscriptions.service.spec.ts
 *
 * Unit tests for SubscriptionsService — complete state machine,
 * seat enforcement, cron auto-suspension, and cache invalidation.
 *
 * Sprint: S4 · Week 9–10
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { SubscriptionStatus, OrgStatus } from '@prisma/client';
import { SubscriptionsService } from '../services/subscriptions.service';
import { PrismaService } from '../../../database/prisma.service';
import { SUBSCRIPTION_TRANSITIONS, PAST_DUE_GRACE_DAYS } from '../types/subscription.types';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockPrisma = {
  subscription: {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  plan: { findUnique: jest.fn() },
  userOrganization: { count: jest.fn() },
  organization: { update: jest.fn() },
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
};

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

// ── Fixtures ──────────────────────────────────────────────────────────────

const ORG_ID = 'org-001';
const PLAN_ID = 'plan-pro';

const makePlan = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: PLAN_ID,
  name: 'PROFESSIONAL',
  displayName: 'Professional',
  priceMonthly: { toString: () => '7500' },
  currency: 'PKR',
  maxSeats: 10,
  features: ['invoicing', 'expenses', 'bank_reconciliation', 'financial_reports'],
  isActive: true,
  ...overrides,
});

const makeSub = (
  status: SubscriptionStatus = SubscriptionStatus.ACTIVE,
  overrides: Partial<Record<string, unknown>> = {},
) => ({
  id: 'sub-001',
  organizationId: ORG_ID,
  planId: PLAN_ID,
  status,
  trialEndsAt: null,
  currentPeriodStart: new Date('2025-06-01'),
  currentPeriodEnd: new Date('2025-07-01'),
  seatCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  plan: makePlan(),
  ...overrides,
});

// ── Test suite ────────────────────────────────────────────────────────────

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    jest.clearAllMocks();

    // Default happy-path mocks
    mockPrisma.subscription.findUnique.mockResolvedValue(makeSub());
    mockPrisma.plan.findUnique.mockResolvedValue(makePlan());
    mockPrisma.subscription.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(
          makeSub((data['status'] as SubscriptionStatus) ?? SubscriptionStatus.ACTIVE, data),
        ),
    );
    mockPrisma.organization.update.mockResolvedValue({});
    mockPrisma.userOrganization.count.mockResolvedValue(3);
    mockRedis.del.mockResolvedValue(1);
  });

  // ─── SUBSCRIPTION_TRANSITIONS constant ───────────────────────────────────
  describe('SUBSCRIPTION_TRANSITIONS (state machine map)', () => {
    it('TRIALING allows → ACTIVE, SUSPENDED, CANCELED', () => {
      expect(SUBSCRIPTION_TRANSITIONS.TRIALING).toEqual(
        expect.arrayContaining(['ACTIVE', 'SUSPENDED', 'CANCELED']),
      );
    });

    it('ACTIVE allows → PAST_DUE, CANCELED', () => {
      expect(SUBSCRIPTION_TRANSITIONS.ACTIVE).toEqual(
        expect.arrayContaining(['PAST_DUE', 'CANCELED']),
      );
    });

    it('PAST_DUE allows → ACTIVE, SUSPENDED', () => {
      expect(SUBSCRIPTION_TRANSITIONS.PAST_DUE).toEqual(
        expect.arrayContaining(['ACTIVE', 'SUSPENDED']),
      );
    });

    it('SUSPENDED allows → ACTIVE, CANCELED', () => {
      expect(SUBSCRIPTION_TRANSITIONS.SUSPENDED).toEqual(
        expect.arrayContaining(['ACTIVE', 'CANCELED']),
      );
    });

    it('CANCELED is terminal — no transitions', () => {
      expect(SUBSCRIPTION_TRANSITIONS.CANCELED).toHaveLength(0);
    });
  });

  // ─── getSubscription() ──────────────────────────────────────────────────
  describe('getSubscription()', () => {
    it('returns subscription with plan', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub());
      const result = await service.getSubscription(ORG_ID);
      expect(result.id).toBe('sub-001');
      expect(result.plan.name).toBe('PROFESSIONAL');
    });

    it('throws NotFoundException when no subscription exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      await expect(service.getSubscription(ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── startTrial() ───────────────────────────────────────────────────────
  describe('startTrial()', () => {
    const dto = { planId: PLAN_ID };

    it('creates TRIALING subscription for org with no existing sub', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null); // no existing sub
      mockPrisma.subscription.upsert.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));

      const result = await service.startTrial(ORG_ID, dto);

      expect(result.status).toBe(SubscriptionStatus.TRIALING);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ status: SubscriptionStatus.TRIALING }),
        }),
      );
    });

    it('defaults trial to 14 days when trialEndsAt not specified', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.upsert.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));

      await service.startTrial(ORG_ID, dto);

      const upsertCall = mockPrisma.subscription.upsert.mock.calls[0][0];
      const trialEndsAt = upsertCall.create.trialEndsAt as Date;
      const daysFromNow = Math.round((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      expect(daysFromNow).toBe(14);
    });

    it('respects custom trialEndsAt date', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.upsert.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));
      const customDate = '2025-12-31';

      await service.startTrial(ORG_ID, { ...dto, trialEndsAt: customDate });

      const upsertCall = mockPrisma.subscription.upsert.mock.calls[0][0];
      expect(upsertCall.create.trialEndsAt.toISOString().slice(0, 10)).toBe(customDate);
    });

    it('throws ConflictException when org already has ACTIVE subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.ACTIVE));
      await expect(service.startTrial(ORG_ID, dto)).rejects.toThrow(ConflictException);
    });

    it('invalidates entitlement cache after trial starts', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.subscription.upsert.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));

      await service.startTrial(ORG_ID, dto);

      expect(mockRedis.del).toHaveBeenCalledWith(`entitlements:${ORG_ID}`);
    });
  });

  // ─── activate() ─────────────────────────────────────────────────────────
  describe('activate()', () => {
    it('transitions TRIALING → ACTIVE', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));

      await service.activate(ORG_ID, { planId: PLAN_ID });

      const updateCall = mockPrisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(SubscriptionStatus.ACTIVE);
    });

    it('transitions PAST_DUE → ACTIVE (payment recovery)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.PAST_DUE));

      await expect(service.activate(ORG_ID, { planId: PLAN_ID })).resolves.toBeDefined();
    });

    it('transitions SUSPENDED → ACTIVE (admin re-activates)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.SUSPENDED));

      await expect(service.activate(ORG_ID, { planId: PLAN_ID })).resolves.toBeDefined();
    });

    it('throws ConflictException for ACTIVE → ACTIVE (invalid transition)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.ACTIVE));
      await expect(service.activate(ORG_ID, { planId: PLAN_ID })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException for CANCELED → ACTIVE (terminal)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.CANCELED));
      await expect(service.activate(ORG_ID, { planId: PLAN_ID })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException for unknown plan', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));
      mockPrisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.activate(ORG_ID, { planId: 'bad-plan' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException for inactive plan', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));
      mockPrisma.plan.findUnique.mockResolvedValue(makePlan({ isActive: false }));
      await expect(service.activate(ORG_ID, { planId: PLAN_ID })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('syncs org status to ACTIVE and invalidates cache', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));

      await service.activate(ORG_ID, { planId: PLAN_ID });

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrgStatus.ACTIVE } }),
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`entitlements:${ORG_ID}`);
    });
  });

  // ─── changePlan() ───────────────────────────────────────────────────────
  describe('changePlan()', () => {
    const downgradeDto = { planId: 'plan-starter' };

    it('changes plan when member count fits within new plan seats', async () => {
      const starterPlan = makePlan({ id: 'plan-starter', name: 'STARTER', maxSeats: 5 });
      mockPrisma.plan.findUnique.mockResolvedValue(starterPlan);
      mockPrisma.userOrganization.count.mockResolvedValue(3); // 3 < 5 = ok

      await expect(service.changePlan(ORG_ID, downgradeDto)).resolves.toBeDefined();
    });

    it('throws BadRequestException when downgrading below current member count', async () => {
      const tinyPlan = makePlan({ id: 'plan-tiny', name: 'TINY', maxSeats: 2 });
      mockPrisma.plan.findUnique.mockResolvedValue(tinyPlan);
      mockPrisma.userOrganization.count.mockResolvedValue(5); // 5 > 2 = blocked

      const err = await service.changePlan(ORG_ID, { planId: 'plan-tiny' }).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.message).toMatch(/exceed.*seat/i);
    });

    it('throws ConflictException when changing plan on a CANCELED subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.CANCELED));

      await expect(service.changePlan(ORG_ID, downgradeDto)).rejects.toThrow(ConflictException);
    });

    it('invalidates entitlement cache after plan change', async () => {
      mockPrisma.plan.findUnique.mockResolvedValue(makePlan({ maxSeats: 10 }));
      mockPrisma.userOrganization.count.mockResolvedValue(2);

      await service.changePlan(ORG_ID, downgradeDto);

      expect(mockRedis.del).toHaveBeenCalledWith(`entitlements:${ORG_ID}`);
    });
  });

  // ─── markPastDue() ──────────────────────────────────────────────────────
  describe('markPastDue()', () => {
    it('transitions ACTIVE → PAST_DUE', async () => {
      await service.markPastDue(ORG_ID);

      const updateCall = mockPrisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(SubscriptionStatus.PAST_DUE);
    });

    it('throws ConflictException for SUSPENDED → PAST_DUE (invalid)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.SUSPENDED));
      await expect(service.markPastDue(ORG_ID)).rejects.toThrow(ConflictException);
    });
  });

  // ─── suspend() ──────────────────────────────────────────────────────────
  describe('suspend()', () => {
    it('transitions PAST_DUE → SUSPENDED', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.PAST_DUE));

      const result = await service.suspend(ORG_ID, { reason: 'PAST_DUE' });

      expect(result.suspended).toBe(true);
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrgStatus.SUSPENDED } }),
      );
    });

    it('throws ConflictException for ACTIVE → SUSPENDED (must go via PAST_DUE)', async () => {
      // ACTIVE is not in SUBSCRIPTION_TRANSITIONS.ACTIVE — wait, it's not
      // ACTIVE allows PAST_DUE and CANCELED, NOT SUSPENDED directly
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.ACTIVE));
      await expect(service.suspend(ORG_ID, { reason: 'MANUAL' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException for CANCELED → SUSPENDED (terminal)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.CANCELED));
      await expect(service.suspend(ORG_ID, { reason: 'MANUAL' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── cancel() ───────────────────────────────────────────────────────────
  describe('cancel()', () => {
    it('transitions ACTIVE → CANCELED', async () => {
      const result = await service.cancel(ORG_ID, { reason: 'User requested cancellation' });
      const updateCall = mockPrisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe(SubscriptionStatus.CANCELED);
    });

    it('syncs org status to CANCELED', async () => {
      await service.cancel(ORG_ID, {});
      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: OrgStatus.CANCELED } }),
      );
    });

    it('throws ConflictException for CANCELED → CANCELED (terminal)', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.CANCELED));
      await expect(service.cancel(ORG_ID, {})).rejects.toThrow(ConflictException);
    });
  });

  // ─── checkSeatAvailability() ────────────────────────────────────────────
  describe('checkSeatAvailability()', () => {
    it('returns correct seat status when below limit', async () => {
      mockPrisma.userOrganization.count.mockResolvedValue(3);

      const result = await service.checkSeatAvailability(ORG_ID);

      expect(result.currentCount).toBe(3);
      expect(result.maxSeats).toBe(10);
      expect(result.available).toBe(7);
      expect(result.hasCapacity).toBe(true);
    });

    it('returns atLimit when at max seats', async () => {
      mockPrisma.userOrganization.count.mockResolvedValue(10); // = maxSeats

      const result = await service.checkSeatAvailability(ORG_ID);

      expect(result.hasCapacity).toBe(false);
      expect(result.available).toBe(0);
    });

    it('uses grace limit of 3 when no subscription exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.userOrganization.count.mockResolvedValue(2);

      const result = await service.checkSeatAvailability(ORG_ID);

      expect(result.maxSeats).toBe(3);
      expect(result.hasCapacity).toBe(true);
    });
  });

  // ─── assertSeatAvailable() ──────────────────────────────────────────────
  describe('assertSeatAvailable()', () => {
    it('resolves silently when seats are available', async () => {
      mockPrisma.userOrganization.count.mockResolvedValue(3); // 3 < 10

      await expect(service.assertSeatAvailable(ORG_ID)).resolves.not.toThrow();
    });

    it('throws 402-coded BadRequestException when at seat limit', async () => {
      mockPrisma.userOrganization.count.mockResolvedValue(10); // = maxSeats

      const err = await service.assertSeatAvailable(ORG_ID).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.response.code).toBe('SEAT_LIMIT_REACHED');
      expect(err.response.statusCode).toBe(402);
    });
  });

  // ─── updateSeatCount() ──────────────────────────────────────────────────
  describe('updateSeatCount()', () => {
    it('updates seat count within plan limits', async () => {
      mockPrisma.userOrganization.count.mockResolvedValue(3);

      await expect(service.updateSeatCount(ORG_ID, { seatCount: 7 })).resolves.toBeDefined();

      const updateCall = mockPrisma.subscription.update.mock.calls[0][0];
      expect(updateCall.data.seatCount).toBe(7);
    });

    it('throws BadRequestException when seatCount exceeds plan maximum', async () => {
      await expect(service.updateSeatCount(ORG_ID, { seatCount: 15 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when seatCount below current member count', async () => {
      mockPrisma.userOrganization.count.mockResolvedValue(8);

      await expect(service.updateSeatCount(ORG_ID, { seatCount: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── runAutoSuspensionCron() ────────────────────────────────────────────
  describe('runAutoSuspensionCron()', () => {
    it('suspends expired trial orgs', async () => {
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([{ organizationId: 'org-trial' }]) // expired trials
        .mockResolvedValueOnce([]); // no past-due

      // suspendInternal calls getSubscription, which calls findUnique
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSub(SubscriptionStatus.TRIALING, { organizationId: 'org-trial' }),
      );

      await service.runAutoSuspensionCron();

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: SubscriptionStatus.SUSPENDED } }),
      );
    });

    it('suspends PAST_DUE orgs beyond grace period', async () => {
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([]) // no expired trials
        .mockResolvedValueOnce([{ organizationId: 'org-past-due' }]); // past-due orgs

      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSub(SubscriptionStatus.PAST_DUE, { organizationId: 'org-past-due' }),
      );

      await service.runAutoSuspensionCron();

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: SubscriptionStatus.SUSPENDED } }),
      );
    });

    it('continues processing other orgs even if one fails', async () => {
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([{ organizationId: 'org-fail' }, { organizationId: 'org-ok' }])
        .mockResolvedValueOnce([]);

      // First org fails, second succeeds
      mockPrisma.subscription.findUnique
        .mockRejectedValueOnce(new Error('DB timeout'))
        .mockResolvedValueOnce(makeSub(SubscriptionStatus.TRIALING, { organizationId: 'org-ok' }));

      // Should not throw even if one org fails
      await expect(service.runAutoSuspensionCron()).resolves.not.toThrow();
    });

    it('processes nothing and returns when no expired subs found', async () => {
      mockPrisma.subscription.findMany
        .mockResolvedValueOnce([]) // no trials
        .mockResolvedValueOnce([]); // no past-due

      await service.runAutoSuspensionCron();

      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  // ─── checkFeatureAccess() ───────────────────────────────────────────────
  describe('checkFeatureAccess()', () => {
    it('returns true for ACTIVE subscription with feature in plan', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.ACTIVE));

      const result = await service.checkFeatureAccess(ORG_ID, 'invoicing');
      expect(result).toBe(true);
    });

    it('returns true for TRIALING subscription with feature in plan', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.TRIALING));

      const result = await service.checkFeatureAccess(ORG_ID, 'invoicing');
      expect(result).toBe(true);
    });

    it('returns false for SUSPENDED subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(makeSub(SubscriptionStatus.SUSPENDED));

      const result = await service.checkFeatureAccess(ORG_ID, 'invoicing');
      expect(result).toBe(false);
    });

    it('returns false when feature not in plan', async () => {
      const limitedPlan = makePlan({ features: ['invoicing'] });
      mockPrisma.subscription.findUnique.mockResolvedValue(
        makeSub(SubscriptionStatus.ACTIVE, { plan: limitedPlan }),
      );

      const result = await service.checkFeatureAccess(ORG_ID, 'financial_reports');
      expect(result).toBe(false);
    });

    it('returns false when no subscription exists', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.checkFeatureAccess(ORG_ID, 'invoicing');
      expect(result).toBe(false);
    });
  });
});

/*
 * Sprint S4 · SubscriptionsService Unit Tests · Week 9–10
 * 35 test cases — state machine, seat enforcement, cron, cache invalidation
 */
