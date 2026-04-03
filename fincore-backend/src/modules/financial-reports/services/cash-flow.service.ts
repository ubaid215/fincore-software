// src/modules/financial-reports/services/cash-flow.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CashFlowReport, CashFlowLine } from '../types/financial-reports.types';

@Injectable()
export class CashFlowService {
  private readonly logger = new Logger(CashFlowService.name);

  constructor(private prisma: PrismaService) {}

  async generate(organizationId: string, startDate: Date, endDate: Date): Promise<CashFlowReport> {
    // Get all posted journal entries in period
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

    // Classify accounts by cash flow category
    const operatingItems: Array<{ description: string; amount: number }> = [];
    const investingItems: Array<{ description: string; amount: number }> = [];
    const financingItems: Array<{ description: string; amount: number }> = [];

    for (const entry of entries) {
      for (const line of entry.lines) {
        const account = line.account;
        const amount = line.debit.toNumber() - line.credit.toNumber();

        // Skip if zero
        if (Math.abs(amount) < 0.01) continue;

        // Classify based on account type and code patterns
        if (this.isOperatingActivity(account)) {
          operatingItems.push({
            description: `${account.accountCode} - ${account.name}`,
            amount: amount,
          });
        } else if (this.isInvestingActivity(account)) {
          investingItems.push({
            description: `${account.accountCode} - ${account.name}`,
            amount: amount,
          });
        } else if (this.isFinancingActivity(account)) {
          financingItems.push({
            description: `${account.accountCode} - ${account.name}`,
            amount: amount,
          });
        }
      }
    }

    const operatingTotal = operatingItems.reduce((sum, i) => sum + i.amount, 0);
    const investingTotal = investingItems.reduce((sum, i) => sum + i.amount, 0);
    const financingTotal = financingItems.reduce((sum, i) => sum + i.amount, 0);

    const netCashFlow = operatingTotal + investingTotal + financingTotal;

    // Get beginning cash balance
    const beginningCash = await this.getCashBalance(organizationId, startDate);
    const endingCash = beginningCash + netCashFlow;

    return {
      operating: {
        category: 'Operating Activities',
        amount: operatingTotal,
        items: operatingItems,
      },
      investing: {
        category: 'Investing Activities',
        amount: investingTotal,
        items: investingItems,
      },
      financing: {
        category: 'Financing Activities',
        amount: financingTotal,
        items: financingItems,
      },
      netCashFlow,
      beginningCash,
      endingCash,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }

  private isOperatingActivity(account: any): boolean {
    // Operating activities: Revenue, Expenses, Current assets/liabilities
    const operatingTypes = ['REVENUE', 'EXPENSE'];
    if (operatingTypes.includes(account.type)) return true;

    // Current asset/liability account codes (1xxx = current assets, 2xxx = current liabilities)
    const codePrefix = account.accountCode.charAt(0);
    if (codePrefix === '1' || codePrefix === '2') return true;

    return false;
  }

  private isInvestingActivity(account: any): boolean {
    // Investing: Fixed assets (1xxxx where not current), investments
    const investingCodes = ['12', '13', '14']; // Fixed assets, investments
    return investingCodes.some((code) => account.accountCode.startsWith(code));
  }

  private isFinancingActivity(account: any): boolean {
    // Financing: Long-term debt, equity, dividends
    const financingTypes = ['EQUITY'];
    if (financingTypes.includes(account.type)) return true;

    const financingCodes = ['22', '23', '24']; // Long-term liabilities
    return financingCodes.some((code) => account.accountCode.startsWith(code));
  }

  private async getCashBalance(organizationId: string, asOfDate: Date): Promise<number> {
    // Get cash account (typically 1110, 1112)
    const cashAccounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        accountCode: { startsWith: '111' }, // Cash accounts
        isArchived: false,
      },
    });

    const cashAccountIds = cashAccounts.map((a) => a.id);

    const entries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: 'POSTED',
        postedAt: { lt: asOfDate },
      },
      include: {
        lines: {
          where: { accountId: { in: cashAccountIds } },
        },
      },
    });

    let balance = 0;
    for (const entry of entries) {
      for (const line of entry.lines) {
        balance += line.debit.toNumber() - line.credit.toNumber();
      }
    }

    return balance;
  }
}
