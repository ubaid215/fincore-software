// ============================================================
// FINCORE — App Configuration
// Single source of truth for all app-wide constants.
// ============================================================

// --- Environment ---
export const env = {
  apiUrl:   process.env.NEXT_PUBLIC_API_URL   ?? 'http://localhost:3001',
  appUrl:   process.env.NEXT_PUBLIC_APP_URL   ?? 'http://localhost:3000',
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
  s3BucketUrl: process.env.NEXT_PUBLIC_S3_BUCKET_URL ?? '',
  isDev:    process.env.NODE_ENV === 'development',
  isProd:   process.env.NODE_ENV === 'production',
} as const

// --- Feature flags ---
export const features = {
  payroll:         process.env.NEXT_PUBLIC_ENABLE_PAYROLL         === 'true',
  inventory:       process.env.NEXT_PUBLIC_ENABLE_INVENTORY        === 'true',
  advancedReports: process.env.NEXT_PUBLIC_ENABLE_ADVANCED_REPORTS === 'true',
} as const

// --- API ---
export const API = {
  timeout:      30_000,        // ms
  retries:      2,
  retryDelay:   1_000,         // ms
} as const

// --- Pagination defaults ---
export const PAGINATION = {
  defaultPageSize: 50,
  pageSizeOptions: [25, 50, 100, 200],
} as const

// --- Cache TTLs (ms) ---
export const CACHE_TTL = {
  financial:    0,             // No stale reads for GL / reports
  invoices:     30_000,        // 30s
  expenses:     30_000,
  members:      120_000,       // 2min
  accounts:     300_000,       // 5min — Chart of Accounts
  currencies:   600_000,       // 10min
  lookups:      600_000,
} as const

// --- Local storage keys ---
export const STORAGE_KEYS = {
  activeOrgId:    'fincore:activeOrgId',
  sidebarState:   'fincore:sidebar',
  tablePageSize:  'fincore:pageSize',
  theme:          'fincore:theme',
} as const

// --- Invoice status ---
export const INVOICE_STATUS = {
  DRAFT:    'DRAFT',
  SENT:     'SENT',
  PAID:     'PAID',
  OVERDUE:  'OVERDUE',
  VOID:     'VOID',
} as const

// --- Expense status ---
export const EXPENSE_STATUS = {
  DRAFT:             'DRAFT',
  SUBMITTED:         'SUBMITTED',
  MANAGER_APPROVED:  'MANAGER_APPROVED',
  FINANCE_APPROVED:  'FINANCE_APPROVED',
  POSTED:            'POSTED',
  REJECTED:          'REJECTED',
} as const

// --- User roles (matches backend) ---
export const ROLES = {
  OWNER:      'OWNER',
  ADMIN:      'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  MANAGER:    'MANAGER',
  VIEWER:     'VIEWER',
} as const

export type Role = keyof typeof ROLES

// --- Role hierarchy (higher index = more access) ---
export const ROLE_HIERARCHY: Role[] = [
  'VIEWER',
  'MANAGER',
  'ACCOUNTANT',
  'ADMIN',
  'OWNER',
]

// --- Supported currencies ---
export const DEFAULT_CURRENCY = 'PKR'

export const CURRENCIES = [
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
] as const

// --- Date formats ---
export const DATE_FORMAT = {
  display:   'dd MMM yyyy',         // 01 Jan 2025
  displayShort: 'dd MMM',           // 01 Jan
  input:     'yyyy-MM-dd',          // HTML date input
  timestamp: 'dd MMM yyyy, HH:mm',  // 01 Jan 2025, 14:30
  month:     'MMM yyyy',            // Jan 2025
} as const