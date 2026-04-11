import { apiClient } from '@/shared/lib/api-client'
import type {
  PnLReport,
  BalanceSheetReport,
  CashFlowReport,
  AgedReceivable,
  AgedPayable,
  DashboardStats,
  ReportFilters,
} from '../types/reports.types'

export const reportsApi = {
  // Dashboard
  getDashboardStats: (orgId: string) =>
    apiClient.get<DashboardStats>(`/v1/reports/dashboard`),

  // Profit & Loss
  getPnL: (orgId: string, filters: ReportFilters) =>
    apiClient.get<PnLReport>(`/v1/reports/pnl`, {
      params: filters,
    }),

  // Balance Sheet
  getBalanceSheet: (orgId: string, asOfDate: string) =>
    apiClient.get<BalanceSheetReport>(`/v1/reports/balance-sheet`, {
      params: { asOfDate },
    }),

  // Cash Flow
  getCashFlow: (orgId: string, filters: ReportFilters) =>
    apiClient.get<CashFlowReport>(`/v1/reports/cash-flow`, {
      params: filters,
    }),

  // Aged Receivables
  getAgedReceivables: (orgId: string, asOfDate: string) =>
    apiClient.get<AgedReceivable[]>(`/v1/reports/aged-receivables`, {
      params: { asOfDate },
    }),

  // Aged Payables
  getAgedPayables: (orgId: string, asOfDate: string) =>
    apiClient.get<AgedPayable[]>(`/v1/reports/aged-payables`, {
      params: { asOfDate },
    }),

  // Export
  exportReport: (orgId: string, reportType: string, format: 'pdf' | 'xlsx', filters: any) =>
    apiClient.post<Blob>(
      `/v1/reports/export`,
      { reportType, format, filters },
      { responseType: 'blob' }
    ),
}