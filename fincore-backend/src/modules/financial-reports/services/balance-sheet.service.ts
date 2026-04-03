// src/modules/financial-reports/services/balance-sheet.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  BalanceSheetReport,
  BalanceSheetSection,
  BalanceSheetAccount,
} from '../types/financial-reports.types';

@Injectable()
export class BalanceSheetService {
  private readonly logger = new Logger(BalanceSheetService.name);

  constructor(private prisma: PrismaService) {}

  async generate(organizationId: string, asOfDate: Date): Promise<BalanceSheetReport> {
    // Get all posted journal entries up to asOfDate
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

    // Calculate balances per account
    const accountBalances = new Map<string, number>();

    for (const entry of entries) {
      for (const line of entry.lines) {
        const current = accountBalances.get(line.accountId) || 0;
        const debit = line.debit.toNumber();
        const credit = line.credit.toNumber();
        accountBalances.set(line.accountId, current + debit - credit);
      }
    }

    // Get all accounts with their types and hierarchy
    const accounts = await this.prisma.account.findMany({
      where: {
        organizationId,
        isArchived: false,
      },
      orderBy: { accountCode: 'asc' },
    });

    // Build balance sheet sections
    const assets: BalanceSheetAccount[] = [];
    const liabilities: BalanceSheetAccount[] = [];
    const equity: BalanceSheetAccount[] = [];

    for (const account of accounts) {
      const balance = accountBalances.get(account.id) || 0;
      const accountData: BalanceSheetAccount = {
        id: account.id,
        accountCode: account.accountCode,
        name: account.name,
        type: account.type,
        balance: Math.abs(balance),
        children: [],
      };

      switch (account.type) {
        case 'ASSET':
          assets.push(accountData);
          break;
        case 'LIABILITY':
          liabilities.push(accountData);
          break;
        case 'EQUITY':
          equity.push(accountData);
          break;
      }
    }

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      assets: {
        name: 'Assets',
        total: totalAssets,
        accounts: assets,
      },
      liabilities: {
        name: 'Liabilities',
        total: totalLiabilities,
        accounts: liabilities,
      },
      equity: {
        name: "Shareholders' Equity",
        total: totalEquity,
        accounts: equity,
      },
      totalAssets,
      totalLiabilitiesAndEquity,
      isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01,
      asOfDate: asOfDate.toISOString(),
    };
  }
}
