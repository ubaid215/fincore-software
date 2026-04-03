// src/modules/financial-reports/services/trial-balance.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TrialBalanceReport, TrialBalanceLine } from '../types/financial-reports.types';

@Injectable()
export class TrialBalanceService {
  private readonly logger = new Logger(TrialBalanceService.name);

  constructor(private prisma: PrismaService) {}

  async generate(organizationId: string, asOfDate: Date): Promise<TrialBalanceReport> {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: 'POSTED',
        postedAt: { lte: asOfDate },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    const accountBalances = new Map<string, { account: any; debit: number; credit: number }>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const current = accountBalances.get(line.accountId) || {
          account: line.account,
          debit: 0,
          credit: 0,
        };
        accountBalances.set(line.accountId, {
          account: line.account,
          debit: current.debit + line.debit.toNumber(),
          credit: current.credit + line.credit.toNumber(),
        });
      }
    }

    const rows: TrialBalanceLine[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const [, data] of accountBalances) {
      const netBalance = data.debit - data.credit;
      rows.push({
        accountId: data.account.id,
        accountCode: data.account.accountCode,
        name: data.account.name,
        type: data.account.type,
        debit: data.debit,
        credit: data.credit,
      });
      totalDebits += data.debit;
      totalCredits += data.credit;
    }

    rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

    return {
      rows,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      asOfDate: asOfDate.toISOString(),
    };
  }
}
