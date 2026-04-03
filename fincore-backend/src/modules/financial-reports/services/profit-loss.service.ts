// src/modules/financial-reports/services/profit-loss.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ProfitLossReport, ProfitLossLine } from '../types/financial-reports.types';

@Injectable()
export class ProfitLossService {
  private readonly logger = new Logger(ProfitLossService.name);

  constructor(private prisma: PrismaService) {}

  async generate(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ProfitLossReport> {
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: 'POSTED',
        postedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    const revenueMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const account = line.account;
        const amount = line.debit.toNumber() - line.credit.toNumber();
        const absoluteAmount = Math.abs(amount);

        if (account.type === 'REVENUE') {
          const current = revenueMap.get(account.id) || 0;
          revenueMap.set(account.id, current + absoluteAmount);
        } else if (account.type === 'EXPENSE') {
          const current = expenseMap.get(account.id) || 0;
          expenseMap.set(account.id, current + absoluteAmount);
        }
      }
    }

    // Get account details
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        type: { in: ['REVENUE', 'EXPENSE'] },
        isArchived: false,
      },
    });

    const revenueLines: ProfitLossLine[] = [];
    const expenseLines: ProfitLossLine[] = [];

    for (const account of accounts) {
      if (account.type === 'REVENUE') {
        const amount = revenueMap.get(account.id) || 0;
        if (amount > 0) {
          revenueLines.push({
            accountId: account.id,
            accountCode: account.accountCode,
            name: account.name,
            amount,
          });
        }
      } else if (account.type === 'EXPENSE') {
        const amount = expenseMap.get(account.id) || 0;
        if (amount > 0) {
          expenseLines.push({
            accountId: account.id,
            accountCode: account.accountCode,
            name: account.name,
            amount,
          });
        }
      }
    }

    const totalRevenue = revenueLines.reduce((sum, l) => sum + l.amount, 0);
    const totalExpenses = expenseLines.reduce((sum, l) => sum + l.amount, 0);
    const grossProfit = totalRevenue - totalExpenses;

    return {
      revenue: {
        total: totalRevenue,
        accounts: revenueLines,
      },
      expenses: {
        total: totalExpenses,
        accounts: expenseLines,
      },
      grossProfit,
      netIncome: grossProfit,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }
}
