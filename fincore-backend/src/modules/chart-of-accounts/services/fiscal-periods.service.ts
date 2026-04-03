// src/modules/chart-of-accounts/services/fiscal-periods.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PeriodStatus } from '@prisma/client';
import { CreateFiscalPeriodDto } from '../dto/fiscal-period.dto';

@Injectable()
export class FiscalPeriodsService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateFiscalPeriodDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    // Reject overlapping periods for the same organization
    const overlap = await this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        OR: [{ startDate: { lte: end }, endDate: { gte: start } }],
      },
    });
    if (overlap) {
      throw new ConflictException(
        `Fiscal period overlaps with existing period "${overlap.name}" ` +
          `(${overlap.startDate.toISOString().slice(0, 10)} → ${overlap.endDate.toISOString().slice(0, 10)})`,
      );
    }

    return this.prisma.fiscalPeriod.create({
      data: {
        organizationId,
        name: dto.name,
        startDate: start,
        endDate: end,
        status: PeriodStatus.OPEN,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.fiscalPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(organizationId: string, periodId: string) {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { id: periodId, organizationId },
    });
    if (!period) throw new NotFoundException(`Fiscal period ${periodId} not found`);
    return period;
  }

  async findByDate(organizationId: string, date: Date) {
    return this.prisma.fiscalPeriod.findFirst({
      where: {
        organizationId,
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });
  }

  // ─── Transitions ───────────────────────────────────────────────────────────

  async close(organizationId: string, periodId: string) {
    const period = await this.findOne(organizationId, periodId);

    if (period.status === PeriodStatus.CLOSED) {
      throw new ConflictException(`Period "${period.name}" is already closed`);
    }
    if (period.status === PeriodStatus.LOCKED) {
      throw new ConflictException(`Period "${period.name}" is locked and cannot be closed`);
    }

    // Reject if any DRAFT journal entries exist in this period
    const draftEntries = await this.prisma.journalEntry.count({
      where: {
        organizationId,
        periodId,
        status: 'DRAFT',
      },
    });
    if (draftEntries > 0) {
      throw new BadRequestException(
        `Cannot close period "${period.name}": ${draftEntries} unposted (DRAFT) journal entries remain. ` +
          `Post or delete them before closing.`,
      );
    }

    return this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: PeriodStatus.CLOSED },
    });
  }

  async reopen(organizationId: string, periodId: string) {
    const period = await this.findOne(organizationId, periodId);

    if (period.status === PeriodStatus.OPEN) {
      throw new ConflictException(`Period "${period.name}" is already open`);
    }
    if (period.status === PeriodStatus.LOCKED) {
      throw new BadRequestException(
        `Period "${period.name}" is permanently locked and cannot be reopened. ` +
          `Only a CLOSED period can be reopened.`,
      );
    }

    return this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: PeriodStatus.OPEN },
    });
  }

  async lock(organizationId: string, periodId: string) {
    const period = await this.findOne(organizationId, periodId);

    if (period.status === PeriodStatus.OPEN) {
      throw new BadRequestException(
        `Period "${period.name}" must be CLOSED before it can be locked. Close it first.`,
      );
    }
    if (period.status === PeriodStatus.LOCKED) {
      throw new ConflictException(`Period "${period.name}" is already locked`);
    }

    // Ensure no draft entries exist (should not be possible but defensive)
    const draftEntries = await this.prisma.journalEntry.count({
      where: { organizationId, periodId, status: 'DRAFT' },
    });
    if (draftEntries > 0) {
      throw new BadRequestException(
        `${draftEntries} DRAFT entries found in period. This should not happen — please report this error.`,
      );
    }

    return this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: PeriodStatus.LOCKED },
    });
  }

  /** Used by GeneralLedgerService to validate before writes */
  async assertPeriodOpen(organizationId: string, entryDate: Date): Promise<void> {
    const period = await this.findByDate(organizationId, entryDate);
    if (!period) return; // no period covering this date = allow writes

    if (period.status !== PeriodStatus.OPEN) {
      throw new BadRequestException(
        `Fiscal period "${period.name}" is ${period.status}. ` +
          `Cannot post journal entries to a ${period.status.toLowerCase()} period.`,
      );
    }
  }
}
