/**
 * src/modules/subscriptions/services/subscriptions.service.ts
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type Redis from 'ioredis';
import { OrgStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ActivateSubscriptionDto,
  StartTrialDto,
  UpgradeSubscriptionDto,
  CancelSubscriptionDto,
  SuspendSubscriptionDto,
  UpdateSeatCountDto,
} from '../dto/subscription.dto';
import {
  SUBSCRIPTION_TRANSITIONS,
  type SuspensionReason,
  type SeatCheckResult,
} from '../types/subscription.types';

/** Cache key for org feature entitlements — must match FeatureFlagsService */
const ENTITLEMENT_CACHE_KEY = (orgId: string): string => `entitlements:${orgId}`;

/** Grace period before PAST_DUE → SUSPENDED (days) */
const GRACE_PERIOD_DAYS = 7;

/** Default trial duration (days) */
const TRIAL_DURATION_DAYS = 14;

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────────

  async getSubscription(organizationId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!sub) {
      throw new NotFoundException(`No subscription found for organization ${organizationId}`);
    }
    return sub;
  }

  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
    });
  }

  // ─── Entitlement check (called by FeatureFlagsService) ────────────────────

  /**
   * Check whether an org's subscription grants access to a feature.
   * Returns false for any non-ACTIVE/TRIALING status.
   * Results are cached in Redis by FeatureFlagsService — this method
   * is the DB source of truth called on cache miss.
   */
  async checkFeatureAccess(organizationId: string, featureKey: string): Promise<boolean> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!sub) return false;

    const allowedStatuses: SubscriptionStatus[] = [
      SubscriptionStatus.ACTIVE,
      SubscriptionStatus.TRIALING,
    ];
    if (!allowedStatuses.includes(sub.status)) return false;

    const features = sub.plan.features as string[];
    return features.includes(featureKey);
  }

  // ─── Start trial ───────────────────────────────────────────────────────────

  async startTrial(organizationId: string, dto: StartTrialDto) {
    const existing = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (existing && existing.status !== SubscriptionStatus.CANCELED) {
      throw new ConflictException(
        `Organization already has a subscription in status: ${existing.status}. Cancel it before starting a trial.`,
      );
    }

    const plan = await this.findPlanOrFail(dto.planId);

    const now = new Date();
    const trialEnds = dto.trialEndsAt
      ? new Date(dto.trialEndsAt)
      : new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const sub = await this.prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        planId: plan.id,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        seatCount: 1,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: trialEnds,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.ACTIVE);
    await this.invalidateEntitlementCache(organizationId);

    this.logger.log(
      `Trial started for org ${organizationId} — plan: ${plan.name}, ends: ${trialEnds.toISOString()}`,
    );

    return sub;
  }

  // ─── Activate ──────────────────────────────────────────────────────────────

  async activate(organizationId: string, dto: ActivateSubscriptionDto) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.ACTIVE, organizationId);

    const plan = await this.findPlanOrFail(dto.planId);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.ACTIVE);
    await this.invalidateEntitlementCache(organizationId);

    this.logger.log(`Subscription ACTIVATED for org ${organizationId} — plan: ${plan.name}`);
    return updated;
  }

  // ─── Change plan ───────────────────────────────────────────────────────────

  async changePlan(organizationId: string, dto: UpgradeSubscriptionDto) {
    const sub = await this.getSubscription(organizationId);

    if (sub.status === SubscriptionStatus.CANCELED) {
      throw new ConflictException('Cannot change plan on a CANCELED subscription');
    }

    const newPlan = await this.findPlanOrFail(dto.planId);
    const currentMembers = await this.prisma.userOrganization.count({
      where: { organizationId },
    });

    if (currentMembers > newPlan.maxSeats) {
      throw new BadRequestException(
        `Cannot downgrade to '${newPlan.displayName}': ` +
          `${currentMembers} current members exceed the plan limit of ${newPlan.maxSeats} seats. ` +
          `Remove ${currentMembers - newPlan.maxSeats} member(s) first.`,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { planId: newPlan.id },
      include: { plan: true },
    });

    await this.invalidateEntitlementCache(organizationId);

    this.logger.log(`Plan changed for org ${organizationId}: ${sub.plan.name} → ${newPlan.name}`);

    return updated;
  }

  // ─── Mark PAST_DUE ─────────────────────────────────────────────────────────

  async markPastDue(organizationId: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.PAST_DUE, organizationId);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.PAST_DUE },
      include: { plan: true },
    });

    await this.invalidateEntitlementCache(organizationId);
    this.logger.warn(`Subscription PAST_DUE for org ${organizationId}`);
    return updated;
  }

  // ─── Suspend ───────────────────────────────────────────────────────────────

  async suspend(organizationId: string, dto: SuspendSubscriptionDto) {
    return this.suspendInternal(organizationId, dto.reason as SuspensionReason);
  }

  /** Internal — also called by the cron job */
  async suspendInternal(organizationId: string, reason: SuspensionReason) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.SUSPENDED, organizationId);

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.SUSPENDED },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.SUSPENDED);
    await this.invalidateEntitlementCache(organizationId);

    this.logger.warn(`Subscription SUSPENDED for org ${organizationId} — reason: ${reason}`);

    return { suspended: true, organizationId, reason, suspendedAt: new Date() };
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  async cancel(organizationId: string, dto: CancelSubscriptionDto) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.CANCELED, organizationId);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.CANCELED },
      include: { plan: true },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.CANCELED);
    await this.invalidateEntitlementCache(organizationId);

    this.logger.log(
      `Subscription CANCELED for org ${organizationId} — reason: ${dto.reason ?? 'none'}`,
    );
    return updated;
  }

  // ─── Update seat count ─────────────────────────────────────────────────────

  async updateSeatCount(organizationId: string, dto: UpdateSeatCountDto) {
    const sub = await this.getSubscription(organizationId);

    if (dto.seatCount > sub.plan.maxSeats) {
      throw new BadRequestException(
        `Requested ${dto.seatCount} seats exceeds plan maximum of ${sub.plan.maxSeats}. Upgrade your plan.`,
      );
    }

    const currentMembers = await this.prisma.userOrganization.count({
      where: { organizationId },
    });
    if (dto.seatCount < currentMembers) {
      throw new BadRequestException(
        `Cannot reduce to ${dto.seatCount} seats — org has ${currentMembers} active members. Remove members first.`,
      );
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { seatCount: dto.seatCount },
      include: { plan: true },
    });
  }

  // ─── Seat check ────────────────────────────────────────────────────────────

  async checkSeatAvailability(organizationId: string): Promise<SeatCheckResult> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    const maxSeats = sub?.plan.maxSeats ?? 3; // grace: 3 seats with no subscription

    const currentCount = await this.prisma.userOrganization.count({
      where: { organizationId },
    });

    return {
      currentCount,
      maxSeats,
      available: Math.max(0, maxSeats - currentCount),
      hasCapacity: currentCount < maxSeats,
    };
  }

  /** Throw 402-style BadRequestException if org is at seat limit */
  async assertSeatAvailable(organizationId: string): Promise<void> {
    const result = await this.checkSeatAvailability(organizationId);
    if (!result.hasCapacity) {
      throw new BadRequestException({
        statusCode: 402,
        message: `Seat limit reached (${result.maxSeats} seats). Upgrade your plan to invite more members.`,
        code: 'SEAT_LIMIT_REACHED',
      });
    }
  }

  // ─── Auto-suspension cron ──────────────────────────────────────────────────

  /**
   * Runs daily at 02:00 UTC.
   * 1. Suspends TRIALING orgs whose trial has expired.
   * 2. Suspends PAST_DUE orgs beyond the 7-day grace period.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runAutoSuspensionCron(): Promise<void> {
    this.logger.log('[Cron] Auto-suspension started');
    const now = new Date();
    const graceDate = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // 1. Suspend expired trials
    const expiredTrials = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: { lt: now },
      },
      select: { organizationId: true },
    });

    for (const { organizationId } of expiredTrials) {
      try {
        await this.suspendInternal(organizationId, 'TRIAL_EXPIRED');
        this.logger.warn(`[Cron] Trial expired — suspended org ${organizationId}`);
      } catch (err: unknown) {
        this.logger.error(
          `[Cron] Failed to suspend trial org ${organizationId}: ${(err as Error).message}`,
        );
      }
    }

    // 2. Suspend PAST_DUE orgs past grace period
    const pastDueExpired = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodEnd: { lt: graceDate },
      },
      select: { organizationId: true },
    });

    for (const { organizationId } of pastDueExpired) {
      try {
        await this.suspendInternal(organizationId, 'GRACE_PERIOD_EXPIRED');
        this.logger.warn(`[Cron] Grace period expired — suspended org ${organizationId}`);
      } catch (err: unknown) {
        this.logger.error(
          `[Cron] Failed to suspend past-due org ${organizationId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `[Cron] Done — ${expiredTrials.length} trials + ${pastDueExpired.length} past-due suspended`,
    );
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertTransition(
    from: SubscriptionStatus,
    to: SubscriptionStatus,
    organizationId: string,
  ): void {
    const allowed = SUBSCRIPTION_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Invalid subscription transition for org ${organizationId}: ${from} → ${to}. ` +
          `Allowed from ${from}: [${allowed.join(', ') || 'none — terminal state'}]`,
      );
    }
  }

  private async findPlanOrFail(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    if (!plan.isActive)
      throw new BadRequestException(`Plan '${plan.displayName}' is no longer available`);
    return plan;
  }

  private async syncOrgStatus(organizationId: string, status: OrgStatus): Promise<void> {
    await this.prisma.organization.update({ where: { id: organizationId }, data: { status } });
  }

  async invalidateEntitlementCache(organizationId: string): Promise<void> {
    try {
      await this.redis.del(ENTITLEMENT_CACHE_KEY(organizationId));
      this.logger.debug(`[Cache] Entitlement cache invalidated for org ${organizationId}`);
    } catch (err: unknown) {
      this.logger.warn(
        `[Cache] Redis del failed for org ${organizationId}: ${(err as Error).message}`,
      );
    }
  }
}

/*
 * Sprint S4 · SubscriptionsService · Week 9–10
 * State machine: TRIALING → ACTIVE → PAST_DUE → SUSPENDED → CANCELED
 * Cron: @Cron(EVERY_DAY_AT_2AM) — suspends expired trials + past-due orgs
 * Cache: invalidates Redis entitlement key directly (no circular FF dep)
 * Owned by: Billing team
 */
