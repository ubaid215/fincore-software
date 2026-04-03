/**
 * Unit tests for OnboardingService — wizard flow and organization JSON config persistence.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OnboardingService } from '../services/onboarding.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountsService } from '../../chart-of-accounts/services/accounts.service';
import { SubscriptionsService } from '../../subscriptions/services/subscriptions.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { OnboardingState } from '../types/onboarding.types';

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  plan: { findUnique: jest.fn() },
  subscription: { create: jest.fn() },
  invite: { create: jest.fn() },
  product: { create: jest.fn() },
  invoice: { create: jest.fn() },
};

const mockAccountsService = {
  importTemplate: jest.fn().mockResolvedValue(undefined),
};

const mockSubscriptionsService = {};

const mockNotificationsService = {
  sendEmail: jest.fn().mockResolvedValue(undefined),
};

describe('OnboardingService', () => {
  let service: OnboardingService;

  const userId = 'user-1';
  const organizationId = 'org-1';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.organization.findUnique.mockResolvedValue({ id: organizationId, config: null });
    mockPrisma.organization.update.mockResolvedValue({ id: organizationId });
    mockPrisma.plan.findUnique.mockResolvedValue({
      id: 'plan-1',
      name: 'STARTER',
    });
    mockPrisma.subscription.create.mockResolvedValue({ id: 'sub-1' });
    mockPrisma.invite.create.mockResolvedValue({ id: 'inv-1' });
    mockPrisma.product.create.mockResolvedValue({ id: 'prod-1' });
    mockPrisma.invoice.create.mockResolvedValue({ id: 'inv-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountsService, useValue: mockAccountsService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get(OnboardingService);
  });

  describe('completeOnboarding', () => {
    const baseState: OnboardingState = {
      userId,
      organizationId,
      currentStep: 7,
      completedAt: null,
      steps: [],
      wizardData: {
        organizationName: 'Acme',
        organizationSlug: 'acme',
        organizationCurrency: 'PKR',
        accountingStandard: 'GAAP_USA',
        fiscalYearStart: '01-01',
        fiscalYearEnd: '12-31',
        importChartOfAccounts: false,
        selectedPlan: 'STARTER',
        paymentMethod: 'manual',
        invites: [],
        createFirstInvoice: false,
      },
    };

    it('persists organization config as Prisma-compatible JSON (wizardData)', async () => {
      await service.completeOnboarding(userId, organizationId, baseState);

      expect(mockPrisma.organization.update).toHaveBeenCalledWith({
        where: { id: organizationId },
        data: {
          config: expect.objectContaining({
            onboardingCompleted: true,
            wizardData: expect.anything(),
          }),
        },
      });
    });

    it('imports chart of accounts when wizard requests it', async () => {
      const state: OnboardingState = {
        ...baseState,
        wizardData: { ...baseState.wizardData, importChartOfAccounts: true },
      };
      await service.completeOnboarding(userId, organizationId, state);
      expect(mockAccountsService.importTemplate).toHaveBeenCalledWith(
        organizationId,
        'GAAP_USA',
        false,
      );
    });
  });

  describe('updateWizardData', () => {
    it('rejects updates after onboarding is completed', async () => {
      mockPrisma.organization.findUnique.mockResolvedValue({
        id: organizationId,
        config: { onboardingCompleted: true },
      });

      await service.getOnboardingState(userId, organizationId);

      await expect(service.updateWizardData(userId, organizationId, 1, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
