// src/modules/financial-reports/types/financial-reports.types.ts

export interface BalanceSheetAccount {
  id: string;
  accountCode: string;
  name: string;
  type: string;
  balance: number;
  children?: BalanceSheetAccount[];
}

export interface BalanceSheetSection {
  name: string;
  total: number;
  accounts: BalanceSheetAccount[];
}

export interface BalanceSheetReport {
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  asOfDate: string;
}

export interface ProfitLossLine {
  accountId: string;
  accountCode: string;
  name: string;
  amount: number;
}

export interface ProfitLossReport {
  revenue: {
    total: number;
    accounts: ProfitLossLine[];
  };
  expenses: {
    total: number;
    accounts: ProfitLossLine[];
  };
  grossProfit: number;
  netIncome: number;
  startDate: string;
  endDate: string;
}

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceReport {
  rows: TrialBalanceLine[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  asOfDate: string;
}

export interface CashFlowLine {
  category: string;
  amount: number;
  items: Array<{
    description: string;
    amount: number;
  }>;
}

export interface CashFlowReport {
  operating: CashFlowLine;
  investing: CashFlowLine;
  financing: CashFlowLine;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
  startDate: string;
  endDate: string;
}

export interface ReportParams {
  startDate: Date;
  endDate: Date;
  asOfDate?: Date;
}
