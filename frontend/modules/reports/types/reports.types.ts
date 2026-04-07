import type { ID } from '@/shared/types'

export type DateRangeType = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'custom'

export interface DateRange {
  from: string
  to: string
}

export interface ReportFilters {
  dateRange: DateRange
  compareWith?: DateRange
  accountId?: string
  customerId?: string
  vendorId?: string
}

export interface FinancialStatementLine {
  accountId: ID
  accountCode: string
  accountName: string
  amount: number
  level: number
  children?: FinancialStatementLine[]
}

export interface PnLReport {
  revenue: FinancialStatementLine[]
  totalRevenue: number
  cogs: FinancialStatementLine[]
  totalCogs: number
  grossProfit: number
  grossMargin: number
  expenses: FinancialStatementLine[]
  totalExpenses: number
  netIncome: number
  netMargin: number
}

export interface BalanceSheetReport {
  assets: {
    current: FinancialStatementLine[]
    fixed: FinancialStatementLine[]
    other: FinancialStatementLine[]
    total: number
  }
  liabilities: {
    current: FinancialStatementLine[]
    longTerm: FinancialStatementLine[]
    total: number
  }
  equity: {
    capital: FinancialStatementLine[]
    retainedEarnings: FinancialStatementLine[]
    total: number
  }
  totalLiabilitiesEquity: number
}

export interface CashFlowReport {
  operating: {
    lines: FinancialStatementLine[]
    total: number
  }
  investing: {
    lines: FinancialStatementLine[]
    total: number
  }
  financing: {
    lines: FinancialStatementLine[]
    total: number
  }
  netCashFlow: number
  beginningCash: number
  endingCash: number
}

export interface AgedReceivable {
  customerId: ID
  customerName: string
  current: number
  days1_30: number
  days31_60: number
  days61_90: number
  days90_plus: number
  total: number
}

export interface AgedPayable {
  vendorId: ID
  vendorName: string
  current: number
  days1_30: number
  days31_60: number
  days61_90: number
  days90_plus: number
  total: number
}

export interface DashboardStats {
  totalRevenue: {
    value: number
    change: number
    trend: 'up' | 'down' | 'flat'
  }
  outstandingInvoices: {
    value: number
    change: number
    trend: 'up' | 'down' | 'flat'
  }
  pendingExpenses: {
    value: number
    change: number
    trend: 'up' | 'down' | 'flat'
  }
  netProfit: {
    value: number
    change: number
    trend: 'up' | 'down' | 'flat'
  }
  recentInvoices: Array<{
    id: ID
    invoiceNumber: string
    customerName: string
    total: number
    status: string
    dueDate: string
  }>
  recentExpenses: Array<{
    id: ID
    expenseNumber: string
    description: string
    total: number
    status: string
    expenseDate: string
  }>
  cashFlowData: Array<{
    month: string
    income: number
    expense: number
  }>
}