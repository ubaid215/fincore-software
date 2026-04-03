// src/modules/notifications/tests/notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../services/notifications.service';
import { Queue } from 'bullmq';

// Mock Queue
const mockQueue = {
  add: jest.fn(),
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let queue: Queue;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'redis.host') return 'localhost';
              if (key === 'redis.port') return 6379;
              return null;
            }),
          },
        },
        {
          provide: getQueueToken('email'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
    queue = module.get(getQueueToken('email'));
  });

  describe('sendPaymentInstructions', () => {
    it('queues an email job with correct template', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-123' });

      const jobId = await service.sendPaymentInstructions('test@example.com', {
        customerName: 'John Doe',
        referenceCode: 'ABC12345',
        amount: 7500,
        currency: 'PKR',
        planName: 'Professional',
        bankName: 'HBL',
        bankAccountTitle: 'FinCore Technologies',
        bankIban: 'PK00HABB0000000000000000',
        bankSwift: 'HABBPKKA',
        expiresAt: '2025-04-10T00:00:00Z',
      });

      expect(jobId).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('ABC12345'),
          html: expect.stringContaining('FinCore Payment Instructions'),
        }),
      );
    });
  });

  describe('sendSubscriptionActivated', () => {
    it('queues an email job for subscription activation', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-456' });

      const jobId = await service.sendSubscriptionActivated('user@example.com', {
        customerName: 'Jane Smith',
        planName: 'Enterprise',
        startDate: '2025-04-01',
        endDate: '2025-05-01',
        dashboardUrl: 'https://app.fincore.com/dashboard',
      });

      expect(jobId).toBe('job-456');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          subject: expect.stringContaining('Enterprise plan is now active'),
          html: expect.stringContaining('Welcome to FinCore'),
        }),
      );
    });
  });

  describe('sendPaymentRejected', () => {
    it('queues an email job for payment rejection', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-789' });

      const jobId = await service.sendPaymentRejected('customer@example.com', {
        customerName: 'John Doe',
        referenceCode: 'REJECT123',
        rejectionReason: 'Amount mismatch — expected PKR 7500, received PKR 5000',
        supportEmail: 'support@fincore.com',
      });

      expect(jobId).toBe('job-789');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({
          subject: expect.stringContaining('REJECT123 was not approved'),
          html: expect.stringContaining('Amount mismatch'),
        }),
      );
    });
  });
});
