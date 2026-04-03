// src/common/constants/features.constants.ts
export const FEATURES = {
  INVOICING: 'invoicing',
  EXPENSES: 'expenses',
  BANK_RECONCILIATION: 'bank_reconciliation',
  FINANCIAL_REPORTS: 'financial_reports',
  MULTI_CURRENCY: 'multi_currency',
  API_ACCESS: 'api_access',
  PRIORITY_SUPPORT: 'priority_support',
  CUSTOM_BRANDING: 'custom_branding',
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];
