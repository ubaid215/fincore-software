// src/modules/manual-payments/tests/manual-payments.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ManualPaymentsService } from '../services/manual-payments.service';
import { ProformaPdfService } from '../services/proforma-pdf.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PrismaService } from '../../../database/prisma.service';
import { ManualPaymentStatus, Prisma, SubscriptionStatus, UserRole } from '@prisma/client';

// Mock implementations
const mockPrisma = {
  subscription: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  manualPayment: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  userOrganization: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockProformaPdfService = {
  generateAndUpload: jest.fn(),
  getPresignedUrl: jest.fn(),
};

const mockNotificationsService = {
  sendPaymentInstructions: jest.fn(),
  sendSubscriptionActivated: jest.fn(),
  sendPaymentRejected: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const configs: Record<string, string> = {
      'bank.name': 'HBL',
      'bank.accountTitle': 'FinCore Technologies',
      'bank.iban': 'PK00HABB0000000000000000',
      'bank.swift': 'HABBPKKA',
      'support.email': 'support@fincore.com',
      'app.frontendUrl': 'https://app.fincore.com',
    };
    return configs[key];
  }),
};

describe('ManualPaymentsService', () => {
  let service: ManualPaymentsService;

  const mockUserId = 'user-123';
  const mockOrgId = 'org-456';
  const mockSubscriptionId = 'sub-789';
  const mockPlan = {
    id: 'plan-1',
    name: 'PROFESSIONAL',
    displayName: 'Professional',
    priceMonthly: new Prisma.Decimal(7500),
    currency: 'PKR',
  };
  const mockSubscription = {
    id: mockSubscriptionId,
    organizationId: mockOrgId,
    planId: mockPlan.id,
    status: SubscriptionStatus.TRIALING,
    plan: mockPlan,
    organization: {
      users: [
        {
          userId: mockUserId,
          user: {
            id: mockUserId,
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
          },
        },
      ],
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualPaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProformaPdfService, useValue: mockProformaPdfService },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(ManualPaymentsService);
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.userOrganization.findUnique.mockResolvedValue({
        userId: mockUserId,
        organizationId: mockOrgId,
        role: UserRole.OWNER,
        user: {
          id: mockUserId,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
        },
      });
      mockPrisma.manualPayment.findFirst.mockResolvedValue(null);
      mockPrisma.manualPayment.findUnique.mockResolvedValue(null);
      mockProformaPdfService.generateAndUpload.mockResolvedValue({
        s3Key: 'proforma/ABC12345/1234567890.pdf',
        url: 'https://s3.example.com/proforma.pdf',
      });
      mockPrisma.manualPayment.create.mockResolvedValue({
        id: 'payment-1',
        organizationId: mockOrgId,
        referenceCode: 'FC3A7B9D',
        status: ManualPaymentStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 86400000),
        subscription: mockSubscription,
      });
      mockNotificationsService.sendPaymentInstructions.mockResolvedValue('job-1');
    });

    it('creates a payment and returns pro-forma URL', async () => {
      const result = await service.initiatePayment(mockUserId, mockOrgId, mockSubscriptionId);

      expect(result.payment.referenceCode).toBeDefined();
      expect(result.proformaPdfUrl).toBe('https://s3.example.com/proforma.pdf');
      expect(mockPrisma.manualPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: mockOrgId,
            subscriptionId: mockSubscriptionId,
          }),
        }),
      );
      expect(mockNotificationsService.sendPaymentInstructions).toHaveBeenCalled();
    });

    it('throws NotFoundException for invalid subscription', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.initiatePayment(mockUserId, mockOrgId, 'invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if user not in organization', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(mockSubscription);
      mockPrisma.userOrganization.findUnique.mockResolvedValue(null);

      await expect(
        service.initiatePayment(mockUserId, mockOrgId, mockSubscriptionId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException if subscription is already ACTIVE', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      });

      await expect(
        service.initiatePayment(mockUserId, mockOrgId, mockSubscriptionId),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing pending payment if one exists', async () => {
      mockPrisma.manualPayment.findFirst.mockResolvedValue({
        id: 'existing-payment',
        referenceCode: 'EXIST123',
        status: ManualPaymentStatus.PENDING,
        proformaS3Key: 'proforma/existing.pdf',
      });
      mockProformaPdfService.getPresignedUrl.mockResolvedValue(
        'https://s3.example.com/existing.pdf',
      );

      const result = await service.initiatePayment(mockUserId, mockOrgId, mockSubscriptionId);

      expect(result.proformaPdfUrl).toBe('https://s3.example.com/existing.pdf');
      expect(mockPrisma.manualPayment.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmPayment', () => {
    const mockPayment = {
      id: 'payment-1',
      referenceCode: 'FC3A7B9D',
      status: ManualPaymentStatus.PENDING,
      amount: new Prisma.Decimal(7500),
      currency: 'PKR',
      expiresAt: new Date(Date.now() + 7 * 86400000),
      subscriptionId: mockSubscriptionId,
      subscription: {
        ...mockSubscription,
        organizationId: mockOrgId,
        organization: {
          users: [
            {
              role: UserRole.OWNER,
              user: {
                id: 'owner-1',
                email: 'owner@example.com',
                firstName: 'Owner',
                lastName: 'User',
              },
            },
          ],
        },
        plan: mockPlan,
      },
    };

    beforeEach(() => {
      mockPrisma.manualPayment.findUnique.mockResolvedValue(mockPayment);
      mockPrisma.userOrganization.findUnique.mockResolvedValue({
        userId: 'admin-1',
        organizationId: mockOrgId,
        role: UserRole.ADMIN,
      });
      mockPrisma.manualPayment.update.mockResolvedValue({
        ...mockPayment,
        status: ManualPaymentStatus.CONFIRMED,
        confirmedAt: new Date(),
      });
      mockPrisma.subscription.update.mockResolvedValue({
        ...mockSubscription,
        status: SubscriptionStatus.ACTIVE,
      });
      mockNotificationsService.sendSubscriptionActivated.mockResolvedValue('job-2');
    });

    it('confirms payment and activates subscription', async () => {
      const result = await service.confirmPayment('admin-1', mockOrgId, 'FC3A7B9D');

      expect(result.subscriptionActivated).toBe(true);
      expect(mockPrisma.manualPayment.update).toHaveBeenCalled();
      expect(mockPrisma.subscription.update).toHaveBeenCalled();
      expect(mockNotificationsService.sendSubscriptionActivated).toHaveBeenCalled();
    });

    it('throws NotFoundException for invalid reference', async () => {
      mockPrisma.manualPayment.findUnique.mockResolvedValue(null);

      await expect(service.confirmPayment('admin-1', mockOrgId, 'INVALID')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException for already confirmed payment', async () => {
      mockPrisma.manualPayment.findUnique.mockResolvedValue({
        ...mockPayment,
        status: ManualPaymentStatus.CONFIRMED,
      });

      await expect(service.confirmPayment('admin-1', mockOrgId, 'FC3A7B9D')).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException for expired payment', async () => {
      mockPrisma.manualPayment.findUnique.mockResolvedValue({
        ...mockPayment,
        expiresAt: new Date(Date.now() - 86400000),
      });

      await expect(service.confirmPayment('admin-1', mockOrgId, 'FC3A7B9D')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('getPendingPayments', () => {
    it('returns list of pending payments', async () => {
      mockPrisma.userOrganization.findMany.mockResolvedValue([
        {
          role: UserRole.OWNER,
          user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        },
      ]);
      mockPrisma.manualPayment.findMany.mockResolvedValue([
        {
          id: 'payment-1',
          referenceCode: 'ABC12345',
          amount: new Prisma.Decimal(7500),
          currency: 'PKR',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7 * 86400000),
          subscription: {
            plan: { displayName: 'Professional' },
            organization: {
              users: [
                {
                  role: UserRole.OWNER,
                  user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
                },
              ],
            },
          },
        },
      ]);

      const result = await service.getPendingPayments(mockOrgId);

      expect(result).toHaveLength(1);
      expect(result[0].referenceCode).toBe('ABC12345');
      expect(result[0].customerName).toBe('John Doe');
    });
  });

  describe('expireStalePayments', () => {
    it('updates expired payments', async () => {
      mockPrisma.manualPayment.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.expireStalePayments();

      expect(result).toBe(5);
      expect(mockPrisma.manualPayment.updateMany).toHaveBeenCalledWith({
        where: {
          status: ManualPaymentStatus.PENDING,
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: ManualPaymentStatus.EXPIRED },
      });
    });
  });
});
