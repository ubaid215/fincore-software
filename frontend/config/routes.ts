// ============================================================
// FINCORE — Route Definitions
// All app routes in one place. Fully typed. No magic strings.
// ============================================================

// --- Auth routes ---
export const authRoutes = {
  login:          '/login',
  signup:         '/signup',
  forgotPassword: '/forgot-password',
  resetPassword:  (token: string) => `/reset-password?token=${token}`,
  acceptInvite:   (token: string) => `/invite?token=${token}`,
} as const

// --- Dashboard root ---
export const dashboardRoutes = {
  selectOrg: '/dashboard/select',
  home:      (orgId: string) => `/dashboard/${orgId}`,
} as const

// --- Module routes (scoped to orgId) ---
export const invoicingRoutes = {
  list:   (orgId: string)              => `/dashboard/${orgId}/invoices`,
  new:    (orgId: string)              => `/dashboard/${orgId}/invoices/new`,
  detail: (orgId: string, id: string)  => `/dashboard/${orgId}/invoices/${id}`,
  edit:   (orgId: string, id: string)  => `/dashboard/${orgId}/invoices/${id}/edit`,
} as const

export const expenseRoutes = {
  list:      (orgId: string)             => `/dashboard/${orgId}/expenses`,
  new:       (orgId: string)             => `/dashboard/${orgId}/expenses/new`,
  detail:    (orgId: string, id: string) => `/dashboard/${orgId}/expenses/${id}`,
  approvals: (orgId: string)             => `/dashboard/${orgId}/expenses/approvals`,
} as const

export const ledgerRoutes = {
  accounts: (orgId: string)             => `/dashboard/${orgId}/accounts`,
  journal:  (orgId: string)             => `/dashboard/${orgId}/journal`,
  entry:    (orgId: string, id: string) => `/dashboard/${orgId}/journal/${id}`,
  trialBalance: (orgId: string)         => `/dashboard/${orgId}/trial-balance`,
} as const

export const inventoryRoutes = {
  products:  (orgId: string)             => `/dashboard/${orgId}/inventory`,
  new:       (orgId: string)             => `/dashboard/${orgId}/inventory/new`,
  detail:    (orgId: string, id: string) => `/dashboard/${orgId}/inventory/${id}`,
  movements: (orgId: string)             => `/dashboard/${orgId}/inventory/movements`,
} as const

export const payrollRoutes = {
  employees: (orgId: string)             => `/dashboard/${orgId}/payroll`,
  new:       (orgId: string)             => `/dashboard/${orgId}/payroll/new`,
  payruns:   (orgId: string)             => `/dashboard/${orgId}/payroll/payruns`,
  payrun:    (orgId: string, id: string) => `/dashboard/${orgId}/payroll/payruns/${id}`,
} as const

export const reportRoutes = {
  overview:     (orgId: string) => `/dashboard/${orgId}/reports`,
  pnl:          (orgId: string) => `/dashboard/${orgId}/reports/profit-loss`,
  balance:      (orgId: string) => `/dashboard/${orgId}/reports/balance-sheet`,
  cashflow:     (orgId: string) => `/dashboard/${orgId}/reports/cash-flow`,
  agedReceiv:   (orgId: string) => `/dashboard/${orgId}/reports/aged-receivables`,
  agedPayables: (orgId: string) => `/dashboard/${orgId}/reports/aged-payables`,
} as const

export const settingsRoutes = {
  organization: (orgId: string) => `/dashboard/${orgId}/settings`,
  members:      (orgId: string) => `/dashboard/${orgId}/settings/members`,
  billing:      (orgId: string) => `/dashboard/${orgId}/settings/billing`,
  integrations: (orgId: string) => `/dashboard/${orgId}/settings/integrations`,
  profile:      (orgId: string) => `/dashboard/${orgId}/settings/profile`,
} as const