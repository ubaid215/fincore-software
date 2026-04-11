/**
 * src/modules/subscriptions/services/subscriptions.service.ts
 *
 * FIXES:
 *  1.  checkSeatAvailability — removedAt:null filter added
 *  2.  changePlan            — removedAt:null filter added
 *  3.  listPlans             — isPublic:true filter added
 *  4.  cancel()              — canceledAt timestamp stored
 *  5.  cancel()              — cancelReason stored
 *  6.  updateSeatCount       — -1 (unlimited) ENTERPRISE case handled
 *  7.  checkFeatureAccess    — checks OrgAppAccess.app (primary gate) + Plan.features[]
 *  8.  UsageRecord           — incrementUsage() and checkUsageLimit() added
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
import { OrgStatus, SubscriptionStatus, AppKey } from '@prisma/client';
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
  TRIAL_DURATION_DAYS,
  PAST_DUE_GRACE_DAYS,
  entitlementCacheKey,
  type SuspensionReason,
  type SeatCheckResult,
  type UsageLimitKey,
} from '../types/subscription.types';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // READ
  // ══════════════════════════════════════════════════════════════════════════

  async getSubscription(organizationId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: { include: { limits: true } } },
    });
    if (!sub) throw new NotFoundException(`No subscription found for org ${organizationId}`);
    return sub;
  }

  // FIX 3: isPublic:true — hides ENTERPRISE/internal plans from customer-facing list
  async listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      include: { limits: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FEATURE / APP ACCESS CHECK  (called by FeatureFlagsService on cache miss)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * FIX 7: Two-layer check:
   *   Layer 1 — OrgAppAccess: is this app enabled for the org? (primary gate)
   *   Layer 2 — Plan.features[]: does the subscription plan include it?
   *
   * Both must pass. If either fails → denied.
   * featureKey is an AppKey enum value (e.g. "INVOICING") not old lowercase string.
   */
  async checkFeatureAccess(organizationId: string, featureKey: string): Promise<boolean> {
    // Layer 1: OrgAppAccess — admin-toggled per org
    const appAccess = await this.prisma.orgAppAccess.findUnique({
      where: { organizationId_app: { organizationId, app: featureKey as AppKey } },
    });
    if (!appAccess?.isEnabled) return false;

    // Layer 2: Subscription status + plan features
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

    // Plan.features[] stores AppKey values e.g. ["INVOICING","EXPENSES","ALL"]
    const features = sub.plan.features as string[];
    return features.includes('ALL') || features.includes(featureKey);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // USAGE RECORD  (FIX 8)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Increment a usage counter for the current month.
   * Call this from InvoicingService.create(), ContactsService.create(), etc.
   */
  async incrementUsage(
    organizationId: string,
    field: UsageLimitKey,
    delta: number = 1,
  ): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      select: { id: true },
    });
    if (!sub) return; // no subscription — no tracking

    await this.prisma.usageRecord.upsert({
      where: { subscriptionId_year_month: { subscriptionId: sub.id, year, month } },
      create: {
        subscriptionId: sub.id,
        organizationId,
        month,
        year,
        [field]: delta,
      },
      update: { [field]: { increment: delta } },
    });
  }

  /**
   * Check whether an org has exceeded their plan limit for a given metric.
   * Returns { allowed: true } or throws BadRequestException with upgrade prompt.
   */
  async assertUsageAllowed(organizationId: string, field: UsageLimitKey): Promise<void> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: { include: { limits: true } } },
    });

    if (!sub?.plan?.limits) return; // no limits configured — allow

    const limits = sub.plan.limits;
    const limitMap: Record<UsageLimitKey, number> = {
      invoiceCount: limits.maxInvoices,
      userCount: limits.maxUsers,
      contactCount: limits.maxContacts,
      storageBytes: limits.maxStorage * 1024 * 1024, // convert MB to bytes
    };

    const max = limitMap[field];
    if (max === -1) return; // unlimited

    const usage = await this.prisma.usageRecord.findUnique({
      where: { subscriptionId_year_month: { subscriptionId: sub.id, year, month } },
    });

    const current = Number((usage as any)?.[field] ?? 0);
    if (current >= max) {
      const labels: Record<UsageLimitKey, string> = {
        invoiceCount: `${max} invoices/month`,
        userCount: `${max} users`,
        contactCount: `${max} contacts`,
        storageBytes: `${limits.maxStorage}MB storage`,
      };
      throw new BadRequestException({
        statusCode: 402,
        message: `Plan limit reached: ${labels[field]}. Upgrade your plan to continue.`,
        code: 'USAGE_LIMIT_REACHED',
        field,
        current,
        max,
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIFECYCLE MUTATIONS
  // ══════════════════════════════════════════════════════════════════════════

  async startTrial(organizationId: string, dto: StartTrialDto) {
    const existing = await this.prisma.subscription.findUnique({ where: { organizationId } });
    if (existing && existing.status !== SubscriptionStatus.CANCELED) {
      throw new ConflictException(
        `Org already has a subscription in status: ${existing.status}. Cancel it first.`,
      );
    }

    const plan = await this.findPlanOrFail(dto.planId);
    const now = new Date();
    const trialEnds = dto.trialEndsAt
      ? new Date(dto.trialEndsAt)
      : new Date(now.getTime() + TRIAL_DURATION_DAYS * 86_400_000);
    const periodEnd = new Date(now.getTime() + 30 * 86_400_000);

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
        canceledAt: null,
        cancelReason: null,
      },
      include: { plan: true },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.ACTIVE);
    await this.invalidateEntitlementCache(organizationId);
    this.logger.log(
      `Trial started: org ${organizationId} → plan ${plan.name}, ends ${trialEnds.toISOString()}`,
    );
    return sub;
  }

  async activate(organizationId: string, dto: ActivateSubscriptionDto) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.ACTIVE, organizationId);

    const plan = await this.findPlanOrFail(dto.planId);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86_400_000);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
        cancelReason: null,
      },
      include: { plan: true },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.ACTIVE);
    await this.invalidateEntitlementCache(organizationId);
    this.logger.log(`Subscription ACTIVATED: org ${organizationId} → plan ${plan.name}`);
    return updated;
  }

  async changePlan(organizationId: string, dto: UpgradeSubscriptionDto) {
    const sub = await this.getSubscription(organizationId);
    if (sub.status === SubscriptionStatus.CANCELED) {
      throw new ConflictException('Cannot change plan on a CANCELED subscription');
    }

    const newPlan = await this.findPlanOrFail(dto.planId);

    // FIX 2: removedAt:null — only count active members
    const currentMembers = await this.prisma.userOrganization.count({
      where: { organizationId, removedAt: null },
    });

    // FIX 6: -1 = unlimited seats — skip check for ENTERPRISE plans
    if (newPlan.maxSeats !== -1 && currentMembers > newPlan.maxSeats) {
      throw new BadRequestException(
        `Cannot downgrade to '${newPlan.displayName}': ` +
          `${currentMembers} members exceed the ${newPlan.maxSeats}-seat limit. ` +
          `Remove ${currentMembers - newPlan.maxSeats} member(s) first.`,
      );
    }

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { planId: newPlan.id },
      include: { plan: true },
    });

    await this.invalidateEntitlementCache(organizationId);
    this.logger.log(`Plan changed: org ${organizationId} → ${newPlan.name}`);
    return updated;
  }

  async markPastDue(organizationId: string) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.PAST_DUE, organizationId);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.PAST_DUE },
      include: { plan: true },
    });

    await this.invalidateEntitlementCache(organizationId);
    this.logger.warn(`Subscription PAST_DUE: org ${organizationId}`);
    return updated;
  }

  async suspend(organizationId: string, dto: SuspendSubscriptionDto) {
    return this.suspendInternal(organizationId, dto.reason as SuspensionReason);
  }

  async suspendInternal(organizationId: string, reason: SuspensionReason) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.SUSPENDED, organizationId);

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.SUSPENDED },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.SUSPENDED);
    await this.invalidateEntitlementCache(organizationId);
    this.logger.warn(`Subscription SUSPENDED: org ${organizationId} reason: ${reason}`);

    return { suspended: true, organizationId, reason, suspendedAt: new Date() };
  }

  // FIX 4 & 5: Store canceledAt and cancelReason
  async cancel(organizationId: string, dto: CancelSubscriptionDto) {
    const sub = await this.getSubscription(organizationId);
    this.assertTransition(sub.status, SubscriptionStatus.CANCELED, organizationId);

    const updated = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(), // FIX 4
        cancelReason: dto.reason ?? null, // FIX 5
      },
      include: { plan: true },
    });

    await this.syncOrgStatus(organizationId, OrgStatus.CANCELED);
    await this.invalidateEntitlementCache(organizationId);
    this.logger.log(`Subscription CANCELED: org ${organizationId} reason: ${dto.reason ?? 'none'}`);
    return updated;
  }

  async updateSeatCount(organizationId: string, dto: UpdateSeatCountDto) {
    const sub = await this.getSubscription(organizationId);

    // FIX 6: Skip max-seat check for unlimited (-1) plans
    if (sub.plan.maxSeats !== -1 && dto.seatCount > sub.plan.maxSeats) {
      throw new BadRequestException(
        `${dto.seatCount} seats exceeds plan max of ${sub.plan.maxSeats}. Upgrade your plan.`,
      );
    }

    // FIX 1: removedAt:null — only count active members
    const currentMembers = await this.prisma.userOrganization.count({
      where: { organizationId, removedAt: null },
    });
    if (dto.seatCount < currentMembers) {
      throw new BadRequestException(
        `Cannot reduce to ${dto.seatCount} seats — org has ${currentMembers} active members.`,
      );
    }

    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { seatCount: dto.seatCount },
      include: { plan: true },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SEAT CHECK
  // ══════════════════════════════════════════════════════════════════════════

  // FIX 1: removedAt:null, FIX 6: -1 unlimited handling
  async checkSeatAvailability(organizationId: string): Promise<SeatCheckResult> {
    const sub = await this.prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: { include: { limits: true } } },
    });

    // PlanLimit.maxUsers takes precedence over Plan.maxSeats
    const maxSeats = sub?.plan?.limits?.maxUsers ?? sub?.plan?.maxSeats ?? 3; // grace default for orgs with no subscription

    const currentCount = await this.prisma.userOrganization.count({
      where: { organizationId, removedAt: null }, // FIX 1
    });

    // -1 = unlimited
    if (maxSeats === -1) {
      return { currentCount, maxSeats: -1, available: -1, hasCapacity: true };
    }

    return {
      currentCount,
      maxSeats,
      available: Math.max(0, maxSeats - currentCount),
      hasCapacity: currentCount < maxSeats,
    };
  }

  async assertSeatAvailable(organizationId: string): Promise<void> {
    const result = await this.checkSeatAvailability(organizationId);
    if (!result.hasCapacity) {
      throw new BadRequestException({
        statusCode: 402,
        message: `Seat limit reached (${result.maxSeats}). Upgrade your plan.`,
        code: 'SEAT_LIMIT_REACHED',
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTO-SUSPENSION CRON
  // ══════════════════════════════════════════════════════════════════════════

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runAutoSuspensionCron(): Promise<void> {
    this.logger.log('[Cron] Auto-suspension check started');
    const now = new Date();
    const graceDate = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * 86_400_000);

    // 1. Suspend expired trials
    const expiredTrials = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.TRIALING, trialEndsAt: { lt: now } },
      select: { organizationId: true },
    });
    for (const { organizationId } of expiredTrials) {
      try {
        await this.suspendInternal(organizationId, 'TRIAL_EXPIRED');
      } catch (err: unknown) {
        this.logger.error(
          `[Cron] Trial suspend failed for ${organizationId}: ${(err as Error).message}`,
        );
      }
    }

    // 2. Suspend PAST_DUE past grace period
    const pastDueExpired = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.PAST_DUE, currentPeriodEnd: { lt: graceDate } },
      select: { organizationId: true },
    });
    for (const { organizationId } of pastDueExpired) {
      try {
        await this.suspendInternal(organizationId, 'GRACE_PERIOD_EXPIRED');
      } catch (err: unknown) {
        this.logger.error(
          `[Cron] Past-due suspend failed for ${organizationId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `[Cron] Done — trials: ${expiredTrials.length}, past-due: ${pastDueExpired.length}`,
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  private assertTransition(from: SubscriptionStatus, to: SubscriptionStatus, orgId: string): void {
    const allowed = SUBSCRIPTION_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new ConflictException(
        `Invalid transition for org ${orgId}: ${from} → ${to}. ` +
          `Allowed: [${allowed.join(', ') || 'none — terminal'}]`,
      );
    }
  }

  private async findPlanOrFail(planId: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} not found`);
    if (!plan.isActive) throw new BadRequestException(`Plan '${plan.displayName}' is unavailable`);
    return plan;
  }

  private async syncOrgStatus(organizationId: string, status: OrgStatus): Promise<void> {
    await this.prisma.organization.update({ where: { id: organizationId }, data: { status } });
  }

  async invalidateEntitlementCache(organizationId: string): Promise<void> {
    try {
      await this.redis.del(entitlementCacheKey(organizationId));
    } catch (err: unknown) {
      this.logger.warn(`[Cache] Redis del failed: ${(err as Error).message}`);
    }
  }
}
