// ============================================================
// FINCORE — Query Key Factory
// Every TanStack Query key lives here.
// Keys are strongly typed tuples for safe cache invalidation.
// ============================================================

import type { ID } from '@/shared/types'

type OrgId = string

export const queryKeys = {

  // ─── Auth ─────────────────────────────────────────────
  auth: {
    me:   ()       => ['auth', 'me']      as const,
    orgs: ()       => ['auth', 'orgs']    as const,
  },

  // ─── Invoicing ────────────────────────────────────────
  invoices: {
    all:    (orgId: OrgId)                  => ['invoices', orgId]               as const,
    list:   (orgId: OrgId, filters?: object) => ['invoices', orgId, 'list', filters ?? {}] as const,
    detail: (orgId: OrgId, id: ID)          => ['invoices', orgId, id]          as const,
    pdf:    (orgId: OrgId, id: ID)          => ['invoices', orgId, id, 'pdf']   as const,
  },

  // ─── Expenses ─────────────────────────────────────────
  expenses: {
    all:       (orgId: OrgId)                   => ['expenses', orgId]                        as const,
    list:      (orgId: OrgId, filters?: object)  => ['expenses', orgId, 'list', filters ?? {}] as const,
    detail:    (orgId: OrgId, id: ID)            => ['expenses', orgId, id]                   as const,
    approvals: (orgId: OrgId)                   => ['expenses', orgId, 'approvals']           as const,
  },

  // ─── General Ledger ───────────────────────────────────
  accounts: {
    all:    (orgId: OrgId)           => ['accounts', orgId]         as const,
    list:   (orgId: OrgId)           => ['accounts', orgId, 'list'] as const,
    detail: (orgId: OrgId, id: ID)   => ['accounts', orgId, id]     as const,
    tree:   (orgId: OrgId)           => ['accounts', orgId, 'tree'] as const,
  },

  journal: {
    all:    (orgId: OrgId)                   => ['journal', orgId]                        as const,
    list:   (orgId: OrgId, filters?: object)  => ['journal', orgId, 'list', filters ?? {}] as const,
    detail: (orgId: OrgId, id: ID)            => ['journal', orgId, id]                   as const,
  },

  // ─── Inventory ────────────────────────────────────────
  products: {
    all:       (orgId: OrgId)                   => ['products', orgId]                        as const,
    list:      (orgId: OrgId, filters?: object)  => ['products', orgId, 'list', filters ?? {}] as const,
    detail:    (orgId: OrgId, id: ID)            => ['products', orgId, id]                   as const,
    movements: (orgId: OrgId, id: ID)            => ['products', orgId, id, 'movements']      as const,
  },

  // ─── Payroll ──────────────────────────────────────────
  employees: {
    all:    (orgId: OrgId)           => ['employees', orgId]         as const,
    list:   (orgId: OrgId)           => ['employees', orgId, 'list'] as const,
    detail: (orgId: OrgId, id: ID)   => ['employees', orgId, id]     as const,
  },

  payruns: {
    all:    (orgId: OrgId)           => ['payruns', orgId]         as const,
    list:   (orgId: OrgId)           => ['payruns', orgId, 'list'] as const,
    detail: (orgId: OrgId, id: ID)   => ['payruns', orgId, id]     as const,
  },

  // ─── Reports ──────────────────────────────────────────
  reports: {
    overview:     (orgId: OrgId, range: string) => ['reports', orgId, 'overview', range]     as const,
    pnl:          (orgId: OrgId, range: string) => ['reports', orgId, 'pnl', range]          as const,
    balanceSheet: (orgId: OrgId, date:  string) => ['reports', orgId, 'balance-sheet', date] as const,
    cashFlow:     (orgId: OrgId, range: string) => ['reports', orgId, 'cash-flow', range]    as const,
    agedReceiv:   (orgId: OrgId, date:  string) => ['reports', orgId, 'aged-receivables', date] as const,
  },

  // ─── Workspace ────────────────────────────────────────
  organization: {
    detail:  (orgId: OrgId) => ['organization', orgId]           as const,
    members: (orgId: OrgId) => ['organization', orgId, 'members'] as const,
  },

  // ─── Reference data ───────────────────────────────────
  customers: {
    list: (orgId: OrgId) => ['customers', orgId, 'list'] as const,
  },

  taxRates: {
    list: (orgId: OrgId) => ['tax-rates', orgId, 'list'] as const,
  },

  currencies: {
    list: () => ['currencies'] as const,
    rates: (base: string) => ['currencies', 'rates', base] as const,
  },

} as const