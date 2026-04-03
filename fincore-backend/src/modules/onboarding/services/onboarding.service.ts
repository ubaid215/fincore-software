// src/modules/onboarding/services/onboarding.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountsService } from '../../chart-of-accounts/services/accounts.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { OnboardingWizardData, OnboardingState, OnboardingStep } from '../types/onboarding.types';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);
  private onboardingCache = new Map<string, OnboardingState>();

  constructor(
    private prisma: PrismaService,
    private accountsService: AccountsService,
    private subscriptionsService: SubscriptionsService,
    private notificationsService: NotificationsService,
  ) {}

  async getOnboardingState(userId: string, organizationId: string): Promise<OnboardingState> {
    const cacheKey = `${userId}:${organizationId}`;
    if (this.onboardingCache.has(cacheKey)) {
      return this.onboardingCache.get(cacheKey)!;
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    // FIX: organization.config is now a Json? field (added to workspace.prisma).
    // Cast to Record<string, any> for safe property access.
    const orgConfig = organization?.config as Record<string, any> | null;
    if (orgConfig?.onboardingCompleted) {
      return {
        userId,
        organizationId,
        currentStep: 6,
        steps: this.getSteps().map((s) => ({ ...s, status: 'completed' as const })),
        completedAt: new Date(),
        wizardData: {} as OnboardingWizardData,
      };
    }

    const state: OnboardingState = {
      userId,
      organizationId,
      currentStep: 1,
      steps: this.getSteps(),
      completedAt: null,
      wizardData: {
        organizationName: '',
        organizationSlug: '',
        organizationCurrency: 'PKR',
        accountingStandard: 'GAAP_USA',
        fiscalYearStart: '',
        fiscalYearEnd: '',
        importChartOfAccounts: true,
        selectedPlan: 'STARTER',
        paymentMethod: 'manual',
        invites: [],
        createFirstInvoice: true,
      },
    };

    this.onboardingCache.set(cacheKey, state);
    return state;
  }

  async updateWizardData(
    userId: string,
    organizationId: string,
    step: number,
    data: Partial<OnboardingWizardData>,
  ): Promise<OnboardingState> {
    const cacheKey = `${userId}:${organizationId}`;
    let state = await this.getOnboardingState(userId, organizationId);

    if (state.completedAt) {
      throw new BadRequestException('Onboarding already completed');
    }

    if (step !== state.currentStep) {
      throw new BadRequestException(`Please complete step ${state.currentStep} first`);
    }

    state.wizardData = { ...state.wizardData, ...data };
    state.steps[step - 1].status = 'completed';
    state.currentStep = step + 1;

    if (state.currentStep > state.steps.length) {
      return this.completeOnboarding(userId, organizationId, state);
    }

    state.steps[state.currentStep - 1].status = 'in_progress';
    this.onboardingCache.set(cacheKey, state);

    return state;
  }

  async completeOnboarding(
    userId: string,
    organizationId: string,
    state: OnboardingState,
  ): Promise<OnboardingState> {
    const { wizardData } = state;

    if (wizardData.importChartOfAccounts) {
      await this.accountsService.importTemplate(
        organizationId,
        wizardData.accountingStandard,
        false,
      );
      this.logger.log(
        `Imported ${wizardData.accountingStandard} chart of accounts for org ${organizationId}`,
      );
    }

    const plan = await this.prisma.plan.findUnique({
      where: { name: wizardData.selectedPlan },
    });
    if (plan) {
      await this.prisma.subscription.create({
        data: {
          organizationId,
          planId: plan.id,
          status: 'TRIALING',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
          seatCount: 1,
        },
      });
      this.logger.log(`Created ${wizardData.selectedPlan} subscription for org ${organizationId}`);
    }

    for (const invite of wizardData.invites) {
      await this.prisma.invite.create({
        data: {
          organizationId,
          email: invite.email,
          role: invite.role as any,
          token: this.generateInviteToken(),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      this.notificationsService
        .sendEmail({
          to: invite.email,
          subject: "You've been invited to join FinCore",
          template: 'invite.hbs',
          context: {
            inviterName: 'Organization Owner',
            organizationName: wizardData.organizationName,
          },
        })
        .catch((err) => this.logger.error(`Failed to send invite: ${err}`));
    }

    if (wizardData.createFirstInvoice && wizardData.firstInvoiceData) {
      const product = await this.prisma.product.create({
        data: {
          organizationId,
          code: 'SERVICE-001',
          name: 'Professional Services',
          unit: 'hour',
          sellingPrice: wizardData.firstInvoiceData.amount,
          costPrice: wizardData.firstInvoiceData.amount * 0.6,
          currentStock: 0,
        },
      });

      await this.prisma.invoice.create({
        data: {
          organizationId,
          invoiceNumber: `INV-${new Date().getFullYear()}-000001`,
          clientName: wizardData.firstInvoiceData.clientName,
          clientEmail: wizardData.firstInvoiceData.clientEmail,
          status: 'DRAFT',
          issueDate: new Date(),
          currency: wizardData.organizationCurrency,
          subtotal: wizardData.firstInvoiceData.amount,
          taxAmount: wizardData.firstInvoiceData.amount * 0.17,
          totalAmount: wizardData.firstInvoiceData.amount * 1.17,
          amountPaid: 0,
          lineItems: {
            create: [
              {
                description: wizardData.firstInvoiceData.description,
                quantity: 1,
                unitPrice: wizardData.firstInvoiceData.amount,
                total: wizardData.firstInvoiceData.amount,
                // FIX: productId is now a valid field on InvoiceLineItem
                // (confirmed in invoicing.prisma — relation exists)
                productId: product.id,
              },
            ],
          },
        },
      });
      this.logger.log(`Created first invoice for org ${organizationId}`);
    }

    // FIX: config is now a valid Json? field on Organization (added to workspace.prisma)
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        config: {
          onboardingCompleted: true,
          onboardingCompletedAt: new Date().toISOString(),
          wizardData: wizardData as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });

    state.completedAt = new Date();
    state.currentStep = state.steps.length + 1;
    this.onboardingCache.delete(`${userId}:${organizationId}`);

    this.logger.log(`Onboarding completed for org ${organizationId}`);
    return state;
  }

  async skipStep(userId: string, organizationId: string, step: number): Promise<OnboardingState> {
    const cacheKey = `${userId}:${organizationId}`;
    let state = await this.getOnboardingState(userId, organizationId);

    if (step !== state.currentStep) {
      throw new BadRequestException(
        `Cannot skip step ${step}. Current step is ${state.currentStep}`,
      );
    }

    const stepConfig = state.steps[step - 1];
    if (!stepConfig.required) {
      stepConfig.status = 'skipped';
      state.currentStep = step + 1;
      if (state.currentStep <= state.steps.length) {
        state.steps[state.currentStep - 1].status = 'in_progress';
      }
      this.onboardingCache.set(cacheKey, state);
    } else {
      throw new BadRequestException(`Step ${step} is required and cannot be skipped`);
    }

    return state;
  }

  private getSteps(): OnboardingStep[] {
    return [
      {
        id: 'organization',
        name: 'Organization Setup',
        order: 1,
        status: 'pending',
        required: true,
      },
      {
        id: 'accounting',
        name: 'Accounting Settings',
        order: 2,
        status: 'pending',
        required: true,
      },
      {
        id: 'chart-of-accounts',
        name: 'Chart of Accounts',
        order: 3,
        status: 'pending',
        required: true,
      },
      { id: 'subscription', name: 'Choose Plan', order: 4, status: 'pending', required: true },
      { id: 'team', name: 'Invite Team Members', order: 5, status: 'pending', required: false },
      {
        id: 'first-invoice',
        name: 'Create First Invoice',
        order: 6,
        status: 'pending',
        required: false,
      },
    ];
  }

  private generateInviteToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}
