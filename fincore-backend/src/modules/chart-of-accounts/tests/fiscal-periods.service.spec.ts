// src/modules/chart-of-accounts/tests/fiscal-periods.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PeriodStatus } from '@prisma/client';
import { FiscalPeriodsService } from '../services/fiscal-periods.service';
import { PrismaService } from '../../../database/prisma.service';

const mockPrisma = {
  fiscalPeriod: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  journalEntry: { count: jest.fn() },
};

const makePeriod = (overrides = {}) => ({
  id: 'period-001',
  organizationId: 'org-001',
  name: 'Q1 2025',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  status: PeriodStatus.OPEN,
  ...overrides,
});

describe('FiscalPeriodsService', () => {
  let service: FiscalPeriodsService;
  const ORG_ID = 'org-001';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalPeriodsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get<FiscalPeriodsService>(FiscalPeriodsService);
    jest.clearAllMocks();
  });

  // ─── create() ─────────────────────────────────────────────────────────────
  describe('create()', () => {
    const dto = { name: 'Q1 2025', startDate: '2025-01-01', endDate: '2025-03-31' };

    it('creates a non-overlapping period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null); // no overlap
      mockPrisma.fiscalPeriod.create.mockResolvedValue(makePeriod());

      const result = await service.create(ORG_ID, dto);
      expect(result.name).toBe('Q1 2025');
      expect(result.status).toBe(PeriodStatus.OPEN);
    });

    it('throws BadRequestException when startDate >= endDate', async () => {
      await expect(
        service.create(ORG_ID, { name: 'Bad', startDate: '2025-03-31', endDate: '2025-01-01' }),
      ).rejects.toThrow(/startDate must be before endDate/i);
    });

    it('throws BadRequestException when startDate equals endDate', async () => {
      await expect(
        service.create(ORG_ID, { name: 'Bad', startDate: '2025-01-01', endDate: '2025-01-01' }),
      ).rejects.toThrow(/startDate must be before endDate/i);
    });

    it('throws ConflictException when period overlaps existing', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(makePeriod());
      await expect(service.create(ORG_ID, dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.fiscalPeriod.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException for partial overlap (new period ends inside existing)', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({
          name: 'Existing',
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-04-30'),
        }),
      );
      await expect(
        service.create(ORG_ID, { name: 'New', startDate: '2025-01-01', endDate: '2025-03-15' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── close() ──────────────────────────────────────────────────────────────
  describe('close()', () => {
    it('closes an OPEN period with no DRAFT entries', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(makePeriod());
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.fiscalPeriod.update.mockResolvedValue(makePeriod({ status: PeriodStatus.CLOSED }));

      const result = await service.close(ORG_ID, 'period-001');
      expect(result.status).toBe(PeriodStatus.CLOSED);
    });

    it('throws BadRequestException when DRAFT entries exist in period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(makePeriod());
      mockPrisma.journalEntry.count.mockResolvedValue(5);

      await expect(service.close(ORG_ID, 'period-001')).rejects.toThrow(/draft.*entries/i);
      expect(mockPrisma.fiscalPeriod.update).not.toHaveBeenCalled();
    });

    it('throws ConflictException for already CLOSED period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.CLOSED }),
      );
      await expect(service.close(ORG_ID, 'period-001')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException for LOCKED period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.LOCKED }),
      );
      await expect(service.close(ORG_ID, 'period-001')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(service.close(ORG_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── reopen() ─────────────────────────────────────────────────────────────
  describe('reopen()', () => {
    it('reopens a CLOSED period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.CLOSED }),
      );
      mockPrisma.fiscalPeriod.update.mockResolvedValue(makePeriod({ status: PeriodStatus.OPEN }));

      const result = await service.reopen(ORG_ID, 'period-001');
      expect(result.status).toBe(PeriodStatus.OPEN);
    });

    it('throws ConflictException for already OPEN period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.OPEN }),
      );
      await expect(service.reopen(ORG_ID, 'period-001')).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for LOCKED period — cannot be reopened', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.LOCKED }),
      );
      await expect(service.reopen(ORG_ID, 'period-001')).rejects.toThrow(
        /locked.*cannot be reopened/i,
      );
    });
  });

  // ─── lock() ───────────────────────────────────────────────────────────────
  describe('lock()', () => {
    it('locks a CLOSED period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.CLOSED }),
      );
      mockPrisma.journalEntry.count.mockResolvedValue(0);
      mockPrisma.fiscalPeriod.update.mockResolvedValue(makePeriod({ status: PeriodStatus.LOCKED }));

      const result = await service.lock(ORG_ID, 'period-001');
      expect(result.status).toBe(PeriodStatus.LOCKED);
    });

    it('throws BadRequestException for OPEN period — must close first', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.OPEN }),
      );
      await expect(service.lock(ORG_ID, 'period-001')).rejects.toThrow(
        /must be closed before.*locked/i,
      );
    });

    it('throws ConflictException for already LOCKED period', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.LOCKED }),
      );
      await expect(service.lock(ORG_ID, 'period-001')).rejects.toThrow(ConflictException);
    });
  });

  // ─── assertPeriodOpen() ───────────────────────────────────────────────────
  describe('assertPeriodOpen()', () => {
    it('passes silently when no period covers the date', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(null);
      await expect(service.assertPeriodOpen(ORG_ID, new Date('2025-06-15'))).resolves.not.toThrow();
    });

    it('passes silently when covering period is OPEN', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.OPEN }),
      );
      await expect(service.assertPeriodOpen(ORG_ID, new Date('2025-02-15'))).resolves.not.toThrow();
    });

    it('throws BadRequestException when covering period is CLOSED', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.CLOSED }),
      );
      await expect(service.assertPeriodOpen(ORG_ID, new Date('2025-02-15'))).rejects.toThrow(
        /closed/i,
      );
    });

    it('throws BadRequestException when covering period is LOCKED', async () => {
      mockPrisma.fiscalPeriod.findFirst.mockResolvedValue(
        makePeriod({ status: PeriodStatus.LOCKED }),
      );
      await expect(service.assertPeriodOpen(ORG_ID, new Date('2025-02-15'))).rejects.toThrow(
        /locked/i,
      );
    });
  });
});
