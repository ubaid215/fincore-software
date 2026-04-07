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
    apiClient.get<DashboardStats>(`/organizations/${orgId}/reports/dashboard`),

  // Profit & Loss
  getPnL: (orgId: string, filters: ReportFilters) =>
    apiClient.get<PnLReport>(`/organizations/${orgId}/reports/pnl`, {
      params: filters,
    }),

  // Balance Sheet
  getBalanceSheet: (orgId: string, asOfDate: string) =>
    apiClient.get<BalanceSheetReport>(`/organizations/${orgId}/reports/balance-sheet`, {
      params: { asOfDate },
    }),

  // Cash Flow
  getCashFlow: (orgId: string, filters: ReportFilters) =>
    apiClient.get<CashFlowReport>(`/organizations/${orgId}/reports/cash-flow`, {
      params: filters,
    }),

  // Aged Receivables
  getAgedReceivables: (orgId: string, asOfDate: string) =>
    apiClient.get<AgedReceivable[]>(`/organizations/${orgId}/reports/aged-receivables`, {
      params: { asOfDate },
    }),

  // Aged Payables
  getAgedPayables: (orgId: string, asOfDate: string) =>
    apiClient.get<AgedPayable[]>(`/organizations/${orgId}/reports/aged-payables`, {
      params: { asOfDate },
    }),

  // Export
  exportReport: (orgId: string, reportType: string, format: 'pdf' | 'xlsx', filters: any) =>
    apiClient.post<Blob>(
      `/organizations/${orgId}/reports/export`,
      { reportType, format, filters },
      { responseType: 'blob' }
    ),
}