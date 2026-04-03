// src/modules/manual-payments/services/manual-payments.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { ProformaPdfService } from './proforma-pdf.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ManualPaymentStatus, SubscriptionStatus, UserRole, Prisma } from '@prisma/client';
import {
  InitiatePaymentResult,
  ConfirmPaymentResult,
  PendingPayment,
  ProformaData,
  ManualPaymentWithRelations,
} from '../types/manual-payment.types';

@Injectable()
export class ManualPaymentsService {
  private readonly logger = new Logger(ManualPaymentsService.name);
  private readonly bankName: string;
  private readonly bankAccountTitle: string;
  private readonly bankIban: string;
  private readonly bankSwift: string;
  private readonly supportEmail: string;

  constructor(
    private prisma: PrismaService,
    private proformaPdfService: ProformaPdfService,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {
    this.bankName = this.configService.get<string>('bank.name', 'HBL')!;
    this.bankAccountTitle = this.configService.get<string>(
      'bank.accountTitle',
      'FinCore Technologies',
    )!;
    this.bankIban = this.configService.get<string>('bank.iban', 'PK00HABB0000000000000000')!;
    this.bankSwift = this.configService.get<string>('bank.swift', 'HABBPKKA')!;
    this.supportEmail = this.configService.get<string>('support.email', 'support@fincore.com')!;
  }

  private generateReferenceCode(): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const alphanumeric = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const prefix =
      letters[Math.floor(Math.random() * letters.length)] +
      letters[Math.floor(Math.random() * letters.length)];
    let suffix = '';
    for (let i = 0; i < 6; i++) {
      suffix += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
    }
    return `${prefix}${suffix}`;
  }

  async initiatePayment(
    userId: string,
    organizationId: string,
    subscriptionId: string,
    customAmount?: number,
    customerNameOverride?: string,
  ): Promise<InitiatePaymentResult> {
    // Get subscription with plan
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }

    // Verify subscription belongs to organization
    if (subscription.organizationId !== organizationId) {
      throw new ForbiddenException('Subscription does not belong to your organization');
    }

    // Get user membership
    const membership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
      include: { user: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('Subscription is already active');
    }

    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('Canceled subscriptions cannot be paid');
    }

    const customerName =
      customerNameOverride || `${membership.user.firstName} ${membership.user.lastName}`;
    const amount = customAmount || subscription.plan.priceMonthly.toNumber();

    // Check for existing pending payment
    const existingPending = await this.prisma.manualPayment.findFirst({
      where: {
        subscriptionId,
        status: ManualPaymentStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingPending) {
      const proformaUrl = existingPending.proformaS3Key
        ? await this.proformaPdfService.getPresignedUrl(existingPending.proformaS3Key)
        : '';
      return {
        payment: existingPending as ManualPaymentWithRelations,
        proformaPdfUrl: proformaUrl,
      };
    }

    // Generate unique reference code
    let referenceCode: string = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      referenceCode = this.generateReferenceCode();
      const existing = await this.prisma.manualPayment.findUnique({
        where: { referenceCode },
      });
      if (!existing) isUnique = true;
      attempts++;
    }
    if (!isUnique) {
      throw new ConflictException('Unable to generate unique reference code');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Generate pro-forma PDF
    const proformaData: ProformaData = {
      referenceCode,
      customerName,
      customerEmail: membership.user.email,
      planName: subscription.plan.name,
      planDisplayName: subscription.plan.displayName,
      amount,
      currency: subscription.plan.currency,
      bankName: this.bankName,
      bankAccountTitle: this.bankAccountTitle,
      bankIban: this.bankIban,
      bankSwift: this.bankSwift,
      expiresAt,
      invoiceNumber: `PF-${referenceCode}`,
      issueDate: new Date(),
    };

    const { s3Key, url: proformaPdfUrl } =
      await this.proformaPdfService.generateAndUpload(proformaData);

    // Create payment record
    const payment = await this.prisma.manualPayment.create({
      data: {
        subscriptionId,
        referenceCode,
        proformaS3Key: s3Key,
        amount,
        currency: subscription.plan.currency,
        status: ManualPaymentStatus.PENDING,
        expiresAt,
      },
    });

    this.logger.log(
      `Manual payment initiated: ${referenceCode} for subscription ${subscriptionId}`,
    );

    // Send email asynchronously
    this.notificationsService
      .sendPaymentInstructions(membership.user.email, {
        customerName,
        referenceCode,
        amount,
        currency: subscription.plan.currency,
        planName: subscription.plan.displayName,
        bankName: this.bankName,
        bankAccountTitle: this.bankAccountTitle,
        bankIban: this.bankIban,
        bankSwift: this.bankSwift,
        proformaPdfUrl,
        expiresAt: expiresAt.toISOString(),
      })
      .catch((err) => this.logger.error(`Failed to send payment instructions email: ${err}`));

    return {
      payment: payment as ManualPaymentWithRelations,
      proformaPdfUrl,
    };
  }

  async confirmPayment(
    adminId: string,
    organizationId: string,
    referenceCode: string,
    note?: string,
  ): Promise<ConfirmPaymentResult> {
    const payment = await this.prisma.manualPayment.findUnique({
      where: { referenceCode },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${referenceCode} not found`);
    }

    if (payment.subscription.organizationId !== organizationId) {
      throw new ForbiddenException('Payment does not belong to your organization');
    }

    const adminMembership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: adminId,
          organizationId,
        },
      },
    });

    if (
      !adminMembership ||
      (adminMembership.role !== UserRole.OWNER && adminMembership.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can confirm payments');
    }

    if (payment.status === ManualPaymentStatus.CONFIRMED) {
      throw new ConflictException(`Payment ${referenceCode} is already confirmed`);
    }

    if (payment.status === ManualPaymentStatus.REJECTED) {
      throw new ConflictException(`Payment ${referenceCode} was rejected and cannot be confirmed`);
    }

    if (payment.expiresAt && payment.expiresAt < new Date()) {
      await this.prisma.manualPayment.update({
        where: { id: payment.id },
        data: { status: ManualPaymentStatus.EXPIRED },
      });
      throw new ConflictException(`Payment ${referenceCode} has expired`);
    }

    const updatedPayment = await this.prisma.manualPayment.update({
      where: { id: payment.id },
      data: {
        status: ManualPaymentStatus.CONFIRMED,
        confirmedByAdminId: adminId,
        confirmedAt: new Date(),
        rejectionNote: note,
      },
    });

    // Activate subscription
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    await this.prisma.subscription.update({
      where: { id: payment.subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: today,
        currentPeriodEnd: nextMonth,
      },
    });

    this.logger.log(
      `Payment confirmed: ${referenceCode}, subscription ${payment.subscriptionId} activated`,
    );

    // Get organization owners for email
    const owners = await this.prisma.userOrganization.findMany({
      where: {
        organizationId,
        role: UserRole.OWNER,
      },
      include: { user: true },
    });

    for (const ownerMembership of owners) {
      const owner = ownerMembership.user;
      this.notificationsService
        .sendSubscriptionActivated(owner.email, {
          customerName: `${owner.firstName} ${owner.lastName}`,
          planName: payment.subscription.plan.displayName,
          startDate: today.toISOString(),
          endDate: nextMonth.toISOString(),
          dashboardUrl: `${this.configService.get<string>('app.frontendUrl', 'https://app.fincore.com')}/dashboard`,
        })
        .catch((err) =>
          this.logger.error(`Failed to send activation email to ${owner.email}: ${err}`),
        );
    }

    return {
      payment: updatedPayment as ManualPaymentWithRelations,
      subscriptionActivated: true,
    };
  }

  async rejectPayment(
    adminId: string,
    organizationId: string,
    referenceCode: string,
    rejectionReason: string,
  ): Promise<{ payment: ManualPaymentWithRelations; emailSent: boolean }> {
    const payment = await this.prisma.manualPayment.findUnique({
      where: { referenceCode },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${referenceCode} not found`);
    }

    if (payment.subscription.organizationId !== organizationId) {
      throw new ForbiddenException('Payment does not belong to your organization');
    }

    const adminMembership = await this.prisma.userOrganization.findUnique({
      where: {
        userId_organizationId: {
          userId: adminId,
          organizationId,
        },
      },
    });

    if (
      !adminMembership ||
      (adminMembership.role !== UserRole.OWNER && adminMembership.role !== UserRole.ADMIN)
    ) {
      throw new ForbiddenException('Only OWNER or ADMIN can reject payments');
    }

    if (payment.status !== ManualPaymentStatus.PENDING) {
      throw new ConflictException(`Cannot reject payment in status ${payment.status}`);
    }

    const updatedPayment = await this.prisma.manualPayment.update({
      where: { id: payment.id },
      data: {
        status: ManualPaymentStatus.REJECTED,
        confirmedByAdminId: adminId,
        confirmedAt: new Date(),
        rejectionNote: rejectionReason,
      },
    });

    // Send rejection email to owners
    const owners = await this.prisma.userOrganization.findMany({
      where: {
        organizationId,
        role: UserRole.OWNER,
      },
      include: { user: true },
    });

    let emailSent = false;
    if (owners.length > 0) {
      const owner = owners[0].user;
      await this.notificationsService.sendPaymentRejected(owner.email, {
        customerName: `${owner.firstName} ${owner.lastName}`,
        referenceCode,
        rejectionReason,
        supportEmail: this.supportEmail,
      });
      emailSent = true;
    }

    this.logger.log(`Payment rejected: ${referenceCode} by admin ${adminId}`);

    return { payment: updatedPayment as ManualPaymentWithRelations, emailSent };
  }

  async getPendingPayments(organizationId: string): Promise<PendingPayment[]> {
    const payments = await this.prisma.manualPayment.findMany({
      where: {
        status: ManualPaymentStatus.PENDING,
        expiresAt: { gt: new Date() },
        subscription: {
          organizationId,
        },
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get owners for each payment
    const results: PendingPayment[] = [];
    for (const payment of payments) {
      const owners = await this.prisma.userOrganization.findMany({
        where: {
          organizationId,
          role: UserRole.OWNER,
        },
        include: { user: true },
      });
      const owner = owners[0]?.user;
      results.push({
        id: payment.id,
        referenceCode: payment.referenceCode,
        amount: payment.amount.toNumber(),
        currency: payment.currency,
        createdAt: payment.createdAt,
        expiresAt: payment.expiresAt,
        customerName: owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown',
        customerEmail: owner?.email || 'unknown',
        planName: payment.subscription.plan.displayName,
      });
    }

    return results;
  }

  async getPaymentByReference(referenceCode: string): Promise<any> {
    const payment = await this.prisma.manualPayment.findUnique({
      where: { referenceCode },
      include: {
        subscription: {
          include: { plan: true },
        },
        confirmedByAdmin: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${referenceCode} not found`);
    }

    return {
      ...payment,
      amount: payment.amount.toNumber(),
    };
  }

  async expireStalePayments(): Promise<number> {
    const result = await this.prisma.manualPayment.updateMany({
      where: {
        status: ManualPaymentStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      data: { status: ManualPaymentStatus.EXPIRED },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale manual payments`);
    }

    return result.count;
  }
}
