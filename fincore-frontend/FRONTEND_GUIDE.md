# FinCore Frontend Integration Guide

> **Stack:** React 18 + Vite · TypeScript · REST (OpenAPI 3.1)  
> **Base URL:** `http://localhost:3000/v1` (dev) · `https://api.fincore.app/v1` (prod)  
> **Auth:** JWT RS256 Bearer token · Refresh token rotation  
> **Multi-tenancy:** Every request carries `X-Organization-Id` header

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [API Client Configuration](#2-api-client-configuration)
3. [Authentication Flow](#3-authentication-flow)
4. [Request & Response Conventions](#4-request--response-conventions)
5. [Global Types](#5-global-types)
6. [Module API Reference](#6-module-api-reference)
   - 6.1 [Auth](#61-auth)
   - 6.2 [Workspace (Organizations & Invites)](#62-workspace-organizations--invites)
   - 6.3 [Chart of Accounts](#63-chart-of-accounts)
   - 6.4 [General Ledger](#64-general-ledger)
   - 6.5 [Invoicing](#65-invoicing)
   - 6.6 [Expenses](#66-expenses)
   - 6.7 [Bank Reconciliation](#67-bank-reconciliation)
   - 6.8 [Subscriptions & Plans](#68-subscriptions--plans)
   - 6.9 [Manual Payments](#69-manual-payments)
   - 6.10 [Financial Reports](#610-financial-reports)
   - 6.11 [Inventory](#611-inventory)
   - 6.12 [Payroll](#612-payroll)
   - 6.13 [Contacts](#613-contacts)
   - 6.14 [Audit Logs](#614-audit-logs)
7. [Error Handling](#7-error-handling)
8. [Pagination Pattern](#8-pagination-pattern)
9. [File Uploads](#9-file-uploads)
10. [Real-time & Polling](#10-real-time--polling)
11. [RBAC & Feature Gates](#11-rbac--feature-gates)
12. [State Management Recommendations](#12-state-management-recommendations)
13. [Environment Variables](#13-environment-variables)

---

## 1. Project Setup

### Recommended dependencies

```bash
npm install axios @tanstack/react-query decimal.js dayjs
npm install -D @types/node
```

### Folder structure (frontend)

```
src/
├── api/
│   ├── client.ts          # Axios instance + interceptors
│   ├── auth.api.ts
│   ├── invoices.api.ts
│   ├── expenses.api.ts
│   └── ...                # one file per module
├── types/
│   ├── auth.types.ts
│   ├── invoice.types.ts
│   └── ...                # mirror backend types exactly
├── hooks/
│   ├── useAuth.ts
│   ├── useInvoices.ts
│   └── ...                # React Query wrappers
└── store/
    └── auth.store.ts      # Access token + org ID in memory
```

---

## 2. API Client Configuration

```typescript
// src/api/client.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/v1';

// ── Token store (in-memory — never localStorage for access tokens) ────────────
let accessToken: string | null = null;
let currentOrgId: string | null = null;

export const tokenStore = {
  setToken: (t: string) => { accessToken = t; },
  clearToken: () => { accessToken = null; },
  setOrgId: (id: string) => { currentOrgId = id; },
  clearOrgId: () => { currentOrgId = null; },
};

// ── Axios instance ─────────────────────────────────────────────────────────────
export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,   // sends HttpOnly refresh token cookie
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach Bearer token + org header ────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (currentOrgId) {
    config.headers['X-Organization-Id'] = currentOrgId;
  }
  return config;
});

// ── Response interceptor — auto-refresh on 401 ────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is in HttpOnly cookie — no body needed
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken: string = data.data.accessToken;
        tokenStore.setToken(newToken);
        processQueue(null, newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        tokenStore.clearToken();
        tokenStore.clearOrgId();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

---

## 3. Authentication Flow

### Token lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  1. POST /auth/login  →  { accessToken, user }                   │
│     accessToken: JWT RS256, expires in 15m                       │
│     refreshToken: set as HttpOnly cookie, expires in 7d          │
│                                                                   │
│  2. Store accessToken IN MEMORY ONLY (never localStorage)        │
│                                                                   │
│  3. On 401 → POST /auth/refresh (cookie sent automatically)      │
│     →  new accessToken                                            │
│                                                                   │
│  4. POST /auth/logout  →  cookie cleared server-side             │
└─────────────────────────────────────────────────────────────────┘
```

### MFA flow

```
POST /auth/login  →  { requiresMfa: true, mfaTempToken: "..." }
                  ↓
POST /auth/login  body: { email, password, mfaCode: "123456" }
                  →  { accessToken, user }
```

---

## 4. Request & Response Conventions

### Every response is wrapped

```typescript
// Success
{
  "data": <T>,           // the actual payload
  "meta": {              // pagination (list endpoints only)
    "total": number,
    "page": number,
    "limit": number,
    "pages": number,
    "hasNext": boolean,
    "hasPrev": boolean
  },
  "timestamp": "2025-06-01T12:00:00.000Z"
}

// Error
{
  "statusCode": number,
  "message": string | string[],   // validation errors are arrays
  "error": string                  // HTTP status text
}
```

### Standard query params (list endpoints)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number (1-indexed) |
| `limit` | number | 20 | Items per page (max 100) |

### Required header

```
X-Organization-Id: <uuid>    // required on every authenticated request
```

---

## 5. Global Types

```typescript
// src/types/common.types.ts

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  meta: PaginationMeta;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// All monetary values come as strings from the API (DECIMAL(19,4) in DB)
// Always parse with Decimal.js — never parseFloat()
export type MoneyString = string;   // e.g. "1234.5000"

// All dates come as ISO 8601 strings
export type ISODateString = string; // e.g. "2025-06-01T00:00:00.000Z"

// Enums (mirror backend exactly)
export type UserRole = 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'MANAGER' | 'VIEWER';
export type OrgStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELED';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';
export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | 'DISPUTED';
export type ExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'MANAGER_APPROVED' | 'FINANCE_APPROVED' | 'POSTED' | 'REJECTED';
export type MatchStatus = 'UNMATCHED' | 'AUTO_MATCHED' | 'MANUALLY_MATCHED' | 'EXCLUDED';
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED';
export type ManualPaymentStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
export type ContactType = 'CUSTOMER' | 'VENDOR' | 'BANK';
export type StockMovementType = 'PURCHASE_IN' | 'SALE_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'RETURN_IN' | 'RETURN_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
export type SaleOrderStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_SHIPPED' | 'SHIPPED' | 'INVOICED' | 'CANCELLED';
export type SalaryStatus = 'PENDING' | 'PROCESSED' | 'PAID' | 'CANCELLED';
```

---

## 6. Module API Reference

---

### 6.1 Auth

**Base path:** `/auth`

#### Types

```typescript
// src/types/auth.types.ts
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mfaEnabled: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface AuthTokens {
  accessToken: string;
  // refreshToken is set as HttpOnly cookie — not in response body
}

export interface LoginResponse extends AuthTokens {
  user: User;
  requiresMfa?: boolean;
  mfaTempToken?: string;
}

// ── Request bodies ─────────────────────────────────────────────────
export interface RegisterDto {
  email: string;        // valid email
  password: string;     // min 8 chars
  firstName: string;
  lastName: string;
}

export interface LoginDto {
  email: string;
  password: string;
  mfaCode?: string;     // 6-digit TOTP — required if MFA enabled
}

export interface MfaSetupResponse {
  secret: string;       // base32 secret for authenticator app
  qrCodeUrl: string;    // data:image/png;base64,... — render as <img>
}

export interface MfaEnableDto {
  token: string;        // 6-digit code from authenticator app to confirm setup
}

export interface MfaDisableDto {
  token: string;        // 6-digit code to confirm disable
  password: string;
}
```

#### Endpoints

```typescript
// src/api/auth.api.ts
import { apiClient } from './client';
import type { RegisterDto, LoginDto, LoginResponse, User, MfaSetupResponse, MfaEnableDto, MfaDisableDto } from '../types/auth.types';

export const authApi = {
  // POST /auth/register
  register: (dto: RegisterDto) =>
    apiClient.post<ApiResponse<User>>('/auth/register', dto),

  // POST /auth/login
  login: (dto: LoginDto) =>
    apiClient.post<ApiResponse<LoginResponse>>('/auth/login', dto),

  // POST /auth/refresh  (no body — reads HttpOnly cookie)
  refresh: () =>
    apiClient.post<ApiResponse<AuthTokens>>('/auth/refresh'),

  // POST /auth/logout
  logout: () =>
    apiClient.post('/auth/logout'),

  // GET /auth/me
  getMe: () =>
    apiClient.get<ApiResponse<User>>('/auth/me'),

  // POST /auth/mfa/setup  →  returns QR code + secret
  mfaSetup: () =>
    apiClient.post<ApiResponse<MfaSetupResponse>>('/auth/mfa/setup'),

  // POST /auth/mfa/enable  →  confirms setup with first TOTP code
  mfaEnable: (dto: MfaEnableDto) =>
    apiClient.post('/auth/mfa/enable', dto),

  // POST /auth/mfa/disable
  mfaDisable: (dto: MfaDisableDto) =>
    apiClient.post('/auth/mfa/disable', dto),
};
```

---

### 6.2 Workspace (Organizations & Invites)

**Base path:** `/organizations`, `/invites`

#### Types

```typescript
// src/types/workspace.types.ts
export interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string;
  timezone: string;         // e.g. "Asia/Karachi"
  currency: string;         // e.g. "PKR"
  fiscalYearEnd: number;    // 1–12 (month number)
  status: OrgStatus;
  config: Record<string, unknown> | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface OrgMember {
  id: string;               // UserOrganization.id
  userId: string;
  organizationId: string;
  role: UserRole;
  createdAt: ISODateString;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface Invite {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: ISODateString;
  acceptedAt: ISODateString | null;
  createdAt: ISODateString;
}

// ── Request bodies ─────────────────────────────────────────────────
export interface CreateOrganizationDto {
  name: string;
  slug: string;             // URL-safe unique identifier
  email: string;
  timezone?: string;        // default: "UTC"
  currency?: string;        // default: "PKR"
  fiscalYearEnd?: number;   // default: 12
}

export interface UpdateOrganizationDto {
  name?: string;
  email?: string;
  timezone?: string;
  currency?: string;
  fiscalYearEnd?: number;
}

export interface InviteMemberDto {
  email: string;
  role: UserRole;
}

export interface UpdateMemberRoleDto {
  role: UserRole;
}

export interface AcceptInviteDto {
  token: string;
}
```

#### Endpoints

```typescript
// src/api/workspace.api.ts
export const organizationsApi = {
  // POST /organizations
  create: (dto: CreateOrganizationDto) =>
    apiClient.post<ApiResponse<Organization>>('/organizations', dto),

  // GET /organizations/my  →  all orgs the current user belongs to
  getMy: () =>
    apiClient.get<ApiResponse<Organization[]>>('/organizations/my'),

  // GET /organizations/:id
  getOne: (id: string) =>
    apiClient.get<ApiResponse<Organization>>(`/organizations/${id}`),

  // PATCH /organizations/:id
  update: (id: string, dto: UpdateOrganizationDto) =>
    apiClient.patch<ApiResponse<Organization>>(`/organizations/${id}`, dto),

  // GET /organizations/:id/members
  getMembers: (id: string) =>
    apiClient.get<ApiResponse<OrgMember[]>>(`/organizations/${id}/members`),

  // PATCH /organizations/:id/members/:userId/role
  updateMemberRole: (orgId: string, userId: string, dto: UpdateMemberRoleDto) =>
    apiClient.patch(`/organizations/${orgId}/members/${userId}/role`, dto),

  // DELETE /organizations/:id/members/:userId
  removeMember: (orgId: string, userId: string) =>
    apiClient.delete(`/organizations/${orgId}/members/${userId}`),
};

export const invitesApi = {
  // POST /invites
  send: (dto: InviteMemberDto) =>
    apiClient.post<ApiResponse<Invite>>('/invites', dto),

  // POST /invites/accept
  accept: (dto: AcceptInviteDto) =>
    apiClient.post('/invites/accept', dto),

  // GET /invites  →  pending invites for current org
  list: () =>
    apiClient.get<ApiResponse<Invite[]>>('/invites'),

  // DELETE /invites/:inviteId
  revoke: (inviteId: string) =>
    apiClient.delete(`/invites/${inviteId}`),
};
```

---

### 6.3 Chart of Accounts

**Base path:** `/accounts`

#### Types

```typescript
// src/types/accounts.types.ts
export interface Account {
  id: string;
  organizationId: string;
  accountCode: string;      // e.g. "1000", "2100"
  name: string;
  type: AccountType;
  subType: string | null;
  parentId: string | null;
  isArchived: boolean;
  isLocked: boolean;
  description: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  // Populated when fetching tree
  children?: Account[];
}

export interface Contact {
  id: string;
  organizationId: string;
  contactType: ContactType;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  openingBalance: MoneyString | null;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface FiscalPeriod {
  id: string;
  organizationId: string;
  name: string;
  startDate: ISODateString;
  endDate: ISODateString;
  status: PeriodStatus;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ── Request bodies ─────────────────────────────────────────────────
export interface CreateAccountDto {
  accountCode: string;
  name: string;
  type: AccountType;
  subType?: string;
  parentId?: string;
  description?: string;
}

export interface UpdateAccountDto {
  name?: string;
  description?: string;
  subType?: string;
}

export interface ImportCoaDto {
  template: 'GAAP' | 'IFRS';
}
```

#### Endpoints

```typescript
// src/api/accounts.api.ts
export const accountsApi = {
  // POST /accounts
  create: (dto: CreateAccountDto) =>
    apiClient.post<ApiResponse<Account>>('/accounts', dto),

  // POST /accounts/sub-account
  createSubAccount: (dto: CreateAccountDto & { parentId: string }) =>
    apiClient.post<ApiResponse<Account>>('/accounts/sub-account', dto),

  // POST /accounts/import  →  seed GAAP or IFRS chart of accounts
  import: (dto: ImportCoaDto) =>
    apiClient.post<ApiResponse<{ imported: number }>>('/accounts/import', dto),

  // GET /accounts  →  flat list
  list: (params?: PaginationQuery & { type?: AccountType; isArchived?: boolean }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Account>>>('/accounts', { params }),

  // GET /accounts/tree  →  hierarchical tree
  getTree: () =>
    apiClient.get<ApiResponse<Account[]>>('/accounts/tree'),

  // GET /accounts/sub-accounts/:parentCode
  getSubAccounts: (parentCode: string) =>
    apiClient.get<ApiResponse<Account[]>>(`/accounts/sub-accounts/${parentCode}`),

  // GET /accounts/:id
  getOne: (id: string) =>
    apiClient.get<ApiResponse<Account>>(`/accounts/${id}`),

  // GET /accounts/code/:accountCode
  getByCode: (code: string) =>
    apiClient.get<ApiResponse<Account>>(`/accounts/code/${code}`),

  // PATCH /accounts/:id
  update: (id: string, dto: UpdateAccountDto) =>
    apiClient.patch<ApiResponse<Account>>(`/accounts/${id}`, dto),

  // PATCH /accounts/:id/archive
  archive: (id: string) =>
    apiClient.patch(`/accounts/${id}/archive`),

  // PATCH /accounts/:id/unarchive
  unarchive: (id: string) =>
    apiClient.patch(`/accounts/${id}/unarchive`),

  // PATCH /accounts/:id/lock
  lock: (id: string) =>
    apiClient.patch(`/accounts/${id}/lock`),

  // PATCH /accounts/:id/unlock
  unlock: (id: string) =>
    apiClient.patch(`/accounts/${id}/unlock`),
};

export const fiscalPeriodsApi = {
  // POST /fiscal-periods
  create: (dto: { name: string; startDate: string; endDate: string }) =>
    apiClient.post<ApiResponse<FiscalPeriod>>('/fiscal-periods', dto),

  // GET /fiscal-periods
  list: () =>
    apiClient.get<ApiResponse<FiscalPeriod[]>>('/fiscal-periods'),

  // GET /fiscal-periods/:id
  getOne: (id: string) =>
    apiClient.get<ApiResponse<FiscalPeriod>>(`/fiscal-periods/${id}`),

  // PATCH /fiscal-periods/:id/close
  close: (id: string) =>
    apiClient.patch(`/fiscal-periods/${id}/close`),

  // PATCH /fiscal-periods/:id/reopen
  reopen: (id: string) =>
    apiClient.patch(`/fiscal-periods/${id}/reopen`),

  // PATCH /fiscal-periods/:id/lock
  lock: (id: string) =>
    apiClient.patch(`/fiscal-periods/${id}/lock`),
};
```

---

### 6.4 General Ledger

**Base path:** `/journal-entries`

#### Types

```typescript
// src/types/general-ledger.types.ts
export interface JournalLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  description: string | null;
  debit: MoneyString;               // "0.0000" if credit side
  credit: MoneyString;              // "0.0000" if debit side
  currency: string;
  fxRate: string;                   // "1.000000" for PKR
  baseCurrencyDebit: MoneyString;
  baseCurrencyCredit: MoneyString;
}

export interface JournalEntry {
  id: string;
  organizationId: string;
  periodId: string | null;
  entryNumber: string;              // e.g. "JE-2025-000001"
  description: string;
  reference: string | null;
  entryDate: ISODateString;
  status: JournalEntryStatus;
  isReversed: boolean;
  reversalOfId: string | null;
  postedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lines: JournalLine[];
}

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  totalDebit: MoneyString;
  totalCredit: MoneyString;
  balance: MoneyString;
}

// ── Request bodies ─────────────────────────────────────────────────
export interface CreateJournalLineDto {
  accountId: string;
  description?: string;
  debit?: number;           // provide debit OR credit, not both
  credit?: number;
  currency?: string;        // default: org currency
  fxRate?: number;          // default: 1
}

export interface CreateJournalEntryDto {
  description: string;
  entryDate: string;        // ISO date string "YYYY-MM-DD"
  reference?: string;
  periodId?: string;
  lines: CreateJournalLineDto[];
  // RULE: SUM(lines.debit) MUST equal SUM(lines.credit) — server enforces this
}

export interface AccountBalanceQuery {
  fromDate?: string;
  toDate?: string;
}
```

#### Endpoints

```typescript
// src/api/general-ledger.api.ts
export const journalEntriesApi = {
  // POST /journal-entries
  create: (dto: CreateJournalEntryDto) =>
    apiClient.post<ApiResponse<JournalEntry>>('/journal-entries', dto),

  // GET /journal-entries
  list: (params?: PaginationQuery & {
    status?: JournalEntryStatus;
    fromDate?: string;
    toDate?: string;
    periodId?: string;
  }) =>
    apiClient.get<ApiResponse<PaginatedResponse<JournalEntry>>>('/journal-entries', { params }),

  // GET /journal-entries/trial-balance
  getTrialBalance: (params?: { fromDate?: string; toDate?: string }) =>
    apiClient.get<ApiResponse<TrialBalanceLine[]>>('/journal-entries/trial-balance', { params }),

  // GET /journal-entries/:id
  getOne: (id: string) =>
    apiClient.get<ApiResponse<JournalEntry>>(`/journal-entries/${id}`),

  // GET /journal-entries/accounts/:accountId/balance
  getAccountBalance: (accountId: string, params?: AccountBalanceQuery) =>
    apiClient.get<ApiResponse<{ debit: MoneyString; credit: MoneyString; balance: MoneyString }>>(
      `/journal-entries/accounts/${accountId}/balance`, { params }
    ),

  // PATCH /journal-entries/:id/post  →  DRAFT → POSTED
  post: (id: string) =>
    apiClient.patch<ApiResponse<JournalEntry>>(`/journal-entries/${id}/post`),

  // POST /journal-entries/:id/reverse  →  creates reversal entry
  reverse: (id: string, dto: { description?: string; entryDate: string }) =>
    apiClient.post<ApiResponse<JournalEntry>>(`/journal-entries/${id}/reverse`, dto),

  // DELETE /journal-entries/:id  →  only DRAFT entries
  delete: (id: string) =>
    apiClient.delete(`/journal-entries/${id}`),
};
```

---

### 6.5 Invoicing

**Base path:** `/invoices`

#### Types

```typescript
// src/types/invoice.types.ts
export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: MoneyString;        // Decimal(10,4)
  unitPrice: MoneyString;       // Decimal(19,4)
  taxCode: string | null;
  taxRate: MoneyString;         // e.g. "0.1700" = 17%
  discount: MoneyString;        // e.g. "0.0500" = 5%
  total: MoneyString;           // qty × unitPrice × (1 - discount%) × (1 + taxRate%)
  productId: string | null;
}

export interface InvoicePayment {
  id: string;
  invoiceId: string;
  amount: MoneyString;
  currency: string;
  method: string;               // "bank_transfer" | "cash" | "cheque" | "online"
  reference: string | null;
  paidAt: ISODateString;
  createdAt: ISODateString;
}

export interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;        // "INV-2025-000001"
  clientName: string;
  clientEmail: string | null;
  clientAddress: string | null;
  customerId: string | null;
  status: InvoiceStatus;
  issueDate: ISODateString;
  dueDate: ISODateString | null;
  currency: string;
  subtotal: MoneyString;
  taxAmount: MoneyString;
  discountAmount: MoneyString;
  totalAmount: MoneyString;
  amountPaid: MoneyString;
  notes: string | null;
  pdfUrl: string | null;
  isRecurring: boolean;
  recurringPeriod: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
}

// ── Request bodies ─────────────────────────────────────────────────
export interface CreateLineItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;       // 0–1 decimal, e.g. 0.17 for 17%
  discount?: number;      // 0–1 decimal, e.g. 0.05 for 5%
  taxCode?: string;
  productId?: string;
}

export interface CreateInvoiceDto {
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  customerId?: string;
  issueDate: string;      // "YYYY-MM-DD"
  dueDate?: string;       // "YYYY-MM-DD"
  currency?: string;      // default: org currency
  notes?: string;
  isRecurring?: boolean;
  recurringPeriod?: string;
  lineItems: CreateLineItemDto[];
}

export interface UpdateInvoiceDto {
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  dueDate?: string;
  notes?: string;
  // NOTE: Only DRAFT invoices can be updated
}

export interface RecordPaymentDto {
  amount: number;
  method: string;         // "bank_transfer" | "cash" | "cheque" | "online"
  paidAt: string;         // "YYYY-MM-DD"
  currency?: string;      // defaults to invoice currency
  reference?: string;
}

export interface QueryInvoicesDto extends PaginationQuery {
  status?: InvoiceStatus;
  currency?: string;
  clientName?: string;    // partial, case-insensitive
  fromDate?: string;
  toDate?: string;
  overdueOnly?: boolean;
}
```

#### Endpoints

```typescript
// src/api/invoices.api.ts
export const invoicesApi = {
  // POST /invoices
  create: (dto: CreateInvoiceDto) =>
    apiClient.post<ApiResponse<Invoice>>('/invoices', dto),

  // GET /invoices
  list: (params?: QueryInvoicesDto) =>
    apiClient.get<ApiResponse<PaginatedResponse<Invoice>>>('/invoices', { params }),

  // GET /invoices/:id
  getOne: (id: string) =>
    apiClient.get<ApiResponse<Invoice>>(`/invoices/${id}`),

  // PATCH /invoices/:id  →  DRAFT only
  update: (id: string, dto: UpdateInvoiceDto) =>
    apiClient.patch<ApiResponse<Invoice>>(`/invoices/${id}`, dto),

  // PATCH /invoices/:id/send  →  DRAFT → SENT, enqueues PDF job
  send: (id: string) =>
    apiClient.patch<ApiResponse<Invoice>>(`/invoices/${id}/send`),

  // PATCH /invoices/:id/void  →  DRAFT | SENT → VOID (not PAID)
  void: (id: string) =>
    apiClient.patch<ApiResponse<Invoice>>(`/invoices/${id}/void`),

  // PATCH /invoices/:id/dispute  →  SENT → DISPUTED
  dispute: (id: string) =>
    apiClient.patch<ApiResponse<Invoice>>(`/invoices/${id}/dispute`),

  // POST /invoices/:id/payments
  recordPayment: (id: string, dto: RecordPaymentDto) =>
    apiClient.post<ApiResponse<Invoice>>(`/invoices/${id}/payments`, dto),

  // POST /invoices/:id/pdf/regenerate
  regeneratePdf: (id: string) =>
    apiClient.post<ApiResponse<{ jobId: string }>>(`/invoices/${id}/pdf/regenerate`),

  // GET /invoices/fx/rates  →  all rates vs org base currency
  getFxRates: () =>
    apiClient.get<ApiResponse<Record<string, number>>>('/invoices/fx/rates'),

  // GET /invoices/fx/rate/:currency
  getFxRate: (currency: string) =>
    apiClient.get<ApiResponse<{ currency: string; rate: number }>>(`/invoices/fx/rate/${currency}`),
};
```

#### Invoice state machine

```
DRAFT ──send()──→ SENT ──recordPayment(partial)──→ PARTIALLY_PAID
  │                │                                      │
  │             dispute()                           recordPayment(full)
  │                ↓                                      │
  └──void()──→ DISPUTED ←──────────────────────────      ↓
                  │                                     PAID  (terminal)
               send()                                    │
               (back to SENT)                         void() → 409 ConflictException
                  │                                         (use credit note instead)
               recordPayment(full)
                  ↓
                PAID
```

---

### 6.6 Expenses

**Base path:** `/expenses`

#### Types

```typescript
// src/types/expense.types.ts
export interface ExpenseLine {
  id: string;
  expenseId: string;
  accountId: string;
  description: string;
  amount: MoneyString;
  category: string;
}

export interface Receipt {
  id: string;
  expenseId: string;
  fileName: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: ISODateString;
}

export interface Expense {
  id: string;
  organizationId: string;
  claimantId: string;
  approverId: string | null;
  title: string;
  description: string | null;
  totalAmount: MoneyString;
  currency: string;
  status: ExpenseStatus;
  submittedAt: ISODateString | null;
  approvedAt: ISODateString | null;
  rejectedAt: ISODateString | null;
  rejectionNote: string | null;
  postedToGLAt: ISODateString | null;
  costCenterId: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lines: ExpenseLine[];
  receipts: Receipt[];
}

// ── Request bodies ─────────────────────────────────────────────────
export interface CreateExpenseLineDto {
  accountId: string;
  description: string;
  amount: number;
  category: string;
}

export interface CreateExpenseDto {
  title: string;
  description?: string;
  currency?: string;
  costCenterId?: string;
  lines: CreateExpenseLineDto[];
}

export interface ApproveExpenseDto {
  step: 'manager' | 'finance';
}

export interface RejectExpenseDto {
  rejectionNote: string;
}

// Receipt upload — use multipart/form-data
export interface InitiateReceiptUploadDto {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ReceiptUploadResponse {
  receiptId: string;
  presignedUrl: string;   // PUT directly to this S3 URL
  expiresIn: number;      // seconds
}
```

#### Endpoints

```typescript
// src/api/expenses.api.ts
export const expensesApi = {
  // POST /expenses
  create: (dto: CreateExpenseDto) =>
    apiClient.post<ApiResponse<Expense>>('/expenses', dto),

  // GET /expenses
  list: (params?: PaginationQuery & { status?: ExpenseStatus; claimantId?: string }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Expense>>>('/expenses', { params }),

  // GET /expenses/:id
  getOne: (id: string) =>
    apiClient.get<ApiResponse<Expense>>(`/expenses/${id}`),

  // PATCH /expenses/:id/submit  →  DRAFT → SUBMITTED
  submit: (id: string) =>
    apiClient.patch<ApiResponse<Expense>>(`/expenses/${id}/submit`),

  // PATCH /expenses/:id/approve/manager  →  SUBMITTED → MANAGER_APPROVED
  approveManager: (id: string) =>
    apiClient.patch<ApiResponse<Expense>>(`/expenses/${id}/approve/manager`),

  // PATCH /expenses/:id/approve/finance  →  MANAGER_APPROVED → FINANCE_APPROVED → auto-posts to GL
  approveFinance: (id: string) =>
    apiClient.patch<ApiResponse<Expense>>(`/expenses/${id}/approve/finance`),

  // PATCH /expenses/:id/post  →  manually post to GL (if auto-post not configured)
  post: (id: string) =>
    apiClient.patch<ApiResponse<Expense>>(`/expenses/${id}/post`),

  // PATCH /expenses/:id/reject
  reject: (id: string, dto: RejectExpenseDto) =>
    apiClient.patch<ApiResponse<Expense>>(`/expenses/${id}/reject`, dto),

  // PATCH /expenses/:id/redraft  →  REJECTED → DRAFT
  redraft: (id: string) =>
    apiClient.patch<ApiResponse<Expense>>(`/expenses/${id}/redraft`),

  // POST /expenses/:id/receipts/initiate  →  get S3 presigned upload URL
  initiateReceiptUpload: (id: string, dto: InitiateReceiptUploadDto) =>
    apiClient.post<ApiResponse<ReceiptUploadResponse>>(`/expenses/${id}/receipts/initiate`, dto),

  // POST /expenses/:id/receipts/:receiptId/confirm  →  confirm upload completed
  confirmReceiptUpload: (expenseId: string, receiptId: string) =>
    apiClient.post(`/expenses/${expenseId}/receipts/${receiptId}/confirm`),

  // GET /expenses/:id/receipts
  getReceipts: (id: string) =>
    apiClient.get<ApiResponse<Receipt[]>>(`/expenses/${id}/receipts`),

  // DELETE /expenses/:id/receipts/:receiptId
  deleteReceipt: (expenseId: string, receiptId: string) =>
    apiClient.delete(`/expenses/${expenseId}/receipts/${receiptId}`),
};
```

#### Receipt upload flow

```typescript
// 1. Initiate — get presigned URL
const { data } = await expensesApi.initiateReceiptUpload(expenseId, {
  fileName: file.name,
  mimeType: file.type,
  sizeBytes: file.size,
});

// 2. Upload directly to S3 — do NOT use apiClient here (no auth header)
await axios.put(data.data.presignedUrl, file, {
  headers: { 'Content-Type': file.type },
});

// 3. Confirm upload
await expensesApi.confirmReceiptUpload(expenseId, data.data.receiptId);
```

---

### 6.7 Bank Reconciliation

**Base path:** `/bank-reconciliation`

#### Types

```typescript
// src/types/bank-reconciliation.types.ts
export interface BankStatement {
  id: string;
  organizationId: string;
  bankName: string;
  accountNumber: string;
  currency: string;
  importedAt: ISODateString;
  periodStart: ISODateString;
  periodEnd: ISODateString;
  s3Key: string;
  format: 'CSV' | 'OFX' | 'QFX';
}

export interface BankTransaction {
  id: string;
  statementId: string;
  date: ISODateString;
  description: string;
  reference: string | null;
  debit: MoneyString;
  credit: MoneyString;
  balance: MoneyString | null;
  matchStatus: MatchStatus;
  matchedEntryId: string | null;
  matchConfidence: string | null;
  createdAt: ISODateString;
}

export interface ReconciliationReport {
  statementId: string;
  bankName: string;
  period: { start: ISODateString; end: ISODateString };
  totalTransactions: number;
  matched: number;
  unmatched: number;
  excluded: number;
  matchRate: number;          // 0–100
}

// ── Request bodies ─────────────────────────────────────────────────
export interface ManualMatchDto {
  bankTransactionId: string;
  journalEntryId: string;
}
```

#### Endpoints

```typescript
// src/api/bank-reconciliation.api.ts
export const bankReconciliationApi = {
  // POST /bank-reconciliation/statements/import  (multipart/form-data)
  // Field: file (CSV/OFX/QFX), bankName, accountNumber, currency
  importStatement: (formData: FormData) =>
    apiClient.post<ApiResponse<BankStatement>>(
      '/bank-reconciliation/statements/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),

  // GET /bank-reconciliation/statements
  listStatements: (params?: PaginationQuery) =>
    apiClient.get<ApiResponse<PaginatedResponse<BankStatement>>>(
      '/bank-reconciliation/statements', { params }
    ),

  // GET /bank-reconciliation/statements/:statementId/transactions
  getTransactions: (statementId: string, params?: PaginationQuery & { matchStatus?: MatchStatus }) =>
    apiClient.get<ApiResponse<PaginatedResponse<BankTransaction>>>(
      `/bank-reconciliation/statements/${statementId}/transactions`, { params }
    ),

  // POST /bank-reconciliation/statements/:statementId/auto-match
  autoMatch: (statementId: string) =>
    apiClient.post<ApiResponse<{ matched: number; total: number }>>(
      `/bank-reconciliation/statements/${statementId}/auto-match`
    ),

  // POST /bank-reconciliation/manual-match
  manualMatch: (dto: ManualMatchDto) =>
    apiClient.post('/bank-reconciliation/manual-match', dto),

  // PATCH /bank-reconciliation/transactions/:transactionId/unmatch
  unmatch: (transactionId: string) =>
    apiClient.patch(`/bank-reconciliation/transactions/${transactionId}/unmatch`),

  // PATCH /bank-reconciliation/transactions/:transactionId/exclude
  exclude: (transactionId: string) =>
    apiClient.patch(`/bank-reconciliation/transactions/${transactionId}/exclude`),

  // GET /bank-reconciliation/statements/:statementId/report
  getReport: (statementId: string) =>
    apiClient.get<ApiResponse<ReconciliationReport>>(
      `/bank-reconciliation/statements/${statementId}/report`
    ),
};
```

---

### 6.8 Subscriptions & Plans

**Base path:** `/subscriptions`

#### Types

```typescript
// src/types/subscription.types.ts
export interface Plan {
  id: string;
  name: string;           // "STARTER" | "PROFESSIONAL" | "ENTERPRISE"
  displayName: string;
  priceMonthly: MoneyString;
  currency: string;
  maxSeats: number;
  features: string[];     // feature key list, e.g. ["INVOICING", "REPORTS", "API_ACCESS"]
  isActive: boolean;
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: ISODateString | null;
  currentPeriodStart: ISODateString;
  currentPeriodEnd: ISODateString;
  seatCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  plan: Plan;
}

export interface SeatUsage {
  used: number;
  max: number;
  available: number;
}

// ── Request bodies ─────────────────────────────────────────────────
export interface SelectPlanDto {
  planId: string;
}

export interface UpdateSeatsDto {
  seatCount: number;
}
```

#### Endpoints

```typescript
// src/api/subscriptions.api.ts
export const subscriptionsApi = {
  // GET /subscriptions/plans  →  all available plans (public, no auth needed)
  getPlans: () =>
    apiClient.get<ApiResponse<Plan[]>>('/subscriptions/plans'),

  // GET /subscriptions  →  current org's subscription
  getCurrent: () =>
    apiClient.get<ApiResponse<Subscription>>('/subscriptions'),

  // POST /subscriptions/trial  →  start free trial
  startTrial: (dto: SelectPlanDto) =>
    apiClient.post<ApiResponse<Subscription>>('/subscriptions/trial', dto),

  // POST /subscriptions/activate  →  activate after payment confirmed
  activate: (dto: SelectPlanDto) =>
    apiClient.post<ApiResponse<Subscription>>('/subscriptions/activate', dto),

  // PATCH /subscriptions/plan  →  change plan
  changePlan: (dto: SelectPlanDto) =>
    apiClient.patch<ApiResponse<Subscription>>('/subscriptions/plan', dto),

  // PATCH /subscriptions/seats  →  update seat count
  updateSeats: (dto: UpdateSeatsDto) =>
    apiClient.patch<ApiResponse<Subscription>>('/subscriptions/seats', dto),

  // GET /subscriptions/seats  →  seat usage
  getSeatUsage: () =>
    apiClient.get<ApiResponse<SeatUsage>>('/subscriptions/seats'),

  // PATCH /subscriptions/suspend
  suspend: () =>
    apiClient.patch('/subscriptions/suspend'),

  // PATCH /subscriptions/cancel
  cancel: () =>
    apiClient.patch('/subscriptions/cancel'),

  // PATCH /subscriptions/past-due
  markPastDue: () =>
    apiClient.patch('/subscriptions/past-due'),
};
```

> **HTTP 402 Payment Required** — when the org's plan does not include a feature, the API returns `402`. Show an upgrade prompt on this status code.

---

### 6.9 Manual Payments

**Base paths:** `/payments` (customer), `/admin/payments` (admin)

#### Types

```typescript
// src/types/manual-payment.types.ts
export interface ManualPayment {
  id: string;
  organizationId: string;
  subscriptionId: string;
  referenceCode: string;      // 8-char uppercase e.g. "AB12CD34"
  proformaS3Key: string | null;
  amount: MoneyString;
  currency: string;
  status: ManualPaymentStatus;
  confirmedByAdminId: string | null;
  confirmedAt: ISODateString | null;
  rejectionNote: string | null;
  expiresAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PaymentInstructions {
  referenceCode: string;
  amount: MoneyString;
  currency: string;
  bankName: string;
  bankAccountTitle: string;
  bankIban: string;
  bankSwift: string;
  proformaUrl: string;        // presigned S3 URL for PDF download
  expiresAt: ISODateString;
}

// ── Request bodies ─────────────────────────────────────────────────
export interface InitiatePaymentDto {
  planId: string;
  seatCount?: number;
}

export interface ConfirmPaymentDto {
  referenceCode: string;
}

export interface RejectPaymentDto {
  referenceCode: string;
  rejectionNote: string;
}
```

#### Endpoints

```typescript
// src/api/manual-payments.api.ts
export const manualPaymentsApi = {
  // POST /payments/initiate  →  creates ManualPayment + sends pro-forma email
  initiate: (dto: InitiatePaymentDto) =>
    apiClient.post<ApiResponse<PaymentInstructions>>('/payments/initiate', dto),

  // GET /payments/status/:referenceCode  →  check payment status
  getStatus: (referenceCode: string) =>
    apiClient.get<ApiResponse<ManualPayment>>(`/payments/status/${referenceCode}`),
};

export const adminPaymentsApi = {
  // GET /admin/payments/pending  →  all PENDING payments across all orgs
  listPending: (params?: PaginationQuery) =>
    apiClient.get<ApiResponse<PaginatedResponse<ManualPayment>>>(
      '/admin/payments/pending', { params }
    ),

  // POST /admin/payments/confirm  →  PENDING → CONFIRMED, activates subscription
  confirm: (dto: ConfirmPaymentDto) =>
    apiClient.post<ApiResponse<ManualPayment>>('/admin/payments/confirm', dto),

  // POST /admin/payments/reject
  reject: (dto: RejectPaymentDto) =>
    apiClient.post<ApiResponse<ManualPayment>>('/admin/payments/reject', dto),
};
```

---

### 6.10 Financial Reports

**Base path:** `/reports`

#### Types

```typescript
// src/types/reports.types.ts
export interface ReportParams {
  startDate: string;    // "YYYY-MM-DD"
  endDate: string;      // "YYYY-MM-DD"
  format?: 'json' | 'pdf' | 'csv';
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  balance: MoneyString;
  subType: string | null;
  children?: BalanceSheetLine[];
}

export interface BalanceSheet {
  asOf: ISODateString;
  assets: { items: BalanceSheetLine[]; total: MoneyString };
  liabilities: { items: BalanceSheetLine[]; total: MoneyString };
  equity: { items: BalanceSheetLine[]; total: MoneyString };
  isBalanced: boolean;    // assets.total === liabilities.total + equity.total
}

export interface ProfitLossLine {
  accountCode: string;
  accountName: string;
  amount: MoneyString;
}

export interface ProfitLoss {
  period: { start: ISODateString; end: ISODateString };
  revenue: { items: ProfitLossLine[]; total: MoneyString };
  expenses: { items: ProfitLossLine[]; total: MoneyString };
  grossProfit: MoneyString;
  netIncome: MoneyString;
  grossMargin: number;    // percentage
  netMargin: number;      // percentage
}

export interface CashFlowStatement {
  period: { start: ISODateString; end: ISODateString };
  operating: { items: ProfitLossLine[]; total: MoneyString };
  investing: { items: ProfitLossLine[]; total: MoneyString };
  financing: { items: ProfitLossLine[]; total: MoneyString };
  netChange: MoneyString;
  openingBalance: MoneyString;
  closingBalance: MoneyString;
}
```

#### Endpoints

```typescript
// src/api/reports.api.ts
export const reportsApi = {
  // GET /reports/balance-sheet
  getBalanceSheet: (params: ReportParams) =>
    apiClient.get<ApiResponse<BalanceSheet>>('/reports/balance-sheet', { params }),

  // GET /reports/profit-loss
  getProfitLoss: (params: ReportParams) =>
    apiClient.get<ApiResponse<ProfitLoss>>('/reports/profit-loss', { params }),

  // GET /reports/trial-balance
  getTrialBalance: (params: ReportParams) =>
    apiClient.get<ApiResponse<TrialBalanceLine[]>>('/reports/trial-balance', { params }),

  // GET /reports/cash-flow
  getCashFlow: (params: ReportParams) =>
    apiClient.get<ApiResponse<CashFlowStatement>>('/reports/cash-flow', { params }),

  // GET /reports/balance-sheet/export  →  returns PDF/CSV binary
  exportBalanceSheet: (params: ReportParams & { format: 'pdf' | 'csv' }) =>
    apiClient.get('/reports/balance-sheet/export', {
      params,
      responseType: 'blob',
    }),
};
```

---

### 6.11 Inventory

**Base path:** `/inventory`

#### Types

```typescript
// src/types/inventory.types.ts
export interface Product {
  id: string;
  organizationId: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string;               // "PCS" | "KG" | "LTR" etc.
  sellingPrice: MoneyString;
  costPrice: MoneyString;
  wholesalePrice: MoneyString | null;
  taxRate: MoneyString;       // e.g. "17.00" = 17%
  currentStock: number;
  minStockLevel: number | null;
  maxStockLevel: number | null;
  reorderQuantity: number | null;
  trackSerialNumbers: boolean;
  trackBatchNumbers: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  salesAccountId: string | null;
  cogsAccountId: string | null;
  inventoryAccountId: string | null;
  imageUrl: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface StockAdjustmentDto {
  quantity: number;             // positive = IN, negative = OUT
  movementType: StockMovementType;
  notes?: string;
  unitPrice?: number;
}

export interface PurchaseOrder {
  id: string;
  organizationId: string;
  poNumber: string;
  vendorId: string | null;
  vendorName: string;
  status: PurchaseOrderStatus;
  orderDate: ISODateString;
  expectedDate: ISODateString | null;
  subtotal: MoneyString;
  taxAmount: MoneyString;
  totalAmount: MoneyString;
  notes: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  receivedQty: number;
  unitPrice: MoneyString;
  total: MoneyString;
}
```

#### Endpoints

```typescript
// src/api/inventory.api.ts
export const inventoryApi = {
  // Products
  createProduct: (dto: Partial<Product>) =>
    apiClient.post<ApiResponse<Product>>('/inventory/products', dto),

  listProducts: (params?: PaginationQuery & { category?: string; isActive?: boolean }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Product>>>('/inventory/products', { params }),

  getProduct: (id: string) =>
    apiClient.get<ApiResponse<Product>>(`/inventory/products/${id}`),

  updateProduct: (id: string, dto: Partial<Product>) =>
    apiClient.patch<ApiResponse<Product>>(`/inventory/products/${id}`, dto),

  deleteProduct: (id: string) =>
    apiClient.delete(`/inventory/products/${id}`),

  adjustStock: (id: string, dto: StockAdjustmentDto) =>
    apiClient.post<ApiResponse<Product>>(`/inventory/products/${id}/adjust-stock`, dto),

  // Stock Movements
  listStockMovements: (params?: PaginationQuery & { productId?: string }) =>
    apiClient.get<ApiResponse<PaginatedResponse<StockMovement>>>('/inventory/stock-movements', { params }),

  // Reports
  getInventorySummary: () =>
    apiClient.get<ApiResponse<{ totalProducts: number; totalValue: MoneyString; lowStockCount: number }>>(
      '/inventory/reports/summary'
    ),

  getSlowMoving: (params?: { days?: number }) =>
    apiClient.get<ApiResponse<Product[]>>('/inventory/reports/slow-moving', { params }),

  getReorderReport: () =>
    apiClient.get<ApiResponse<Product[]>>('/inventory/reports/reorder'),

  // Purchase Orders
  createPurchaseOrder: (dto: Partial<PurchaseOrder>) =>
    apiClient.post<ApiResponse<PurchaseOrder>>('/inventory/purchase-orders', dto),

  receivePurchaseOrder: (dto: { purchaseOrderId: string; lines: { lineId: string; receivedQty: number }[] }) =>
    apiClient.post<ApiResponse<PurchaseOrder>>('/inventory/purchase-orders/receive', dto),

  listPurchaseOrders: (params?: PaginationQuery & { status?: PurchaseOrderStatus }) =>
    apiClient.get<ApiResponse<PaginatedResponse<PurchaseOrder>>>('/inventory/purchase-orders', { params }),

  getPurchaseOrder: (id: string) =>
    apiClient.get<ApiResponse<PurchaseOrder>>(`/inventory/purchase-orders/${id}`),
};
```

---

### 6.12 Payroll

> Payroll endpoints are not yet exposed via the MVP controllers. The schema is in place. Use this section as a reference for when the module ships. Types mirror the Prisma schema exactly.

```typescript
// src/types/payroll.types.ts
export interface Employee {
  id: string;
  organizationId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  department: string | null;
  designation: string | null;
  joinDate: ISODateString;
  salary: MoneyString;
  bankAccount: string | null;
  cnic: string | null;
  taxNumber: string | null;
  isActive: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface SalaryRecord {
  id: string;
  organizationId: string;
  employeeId: string;
  month: number;            // 1–12
  year: number;
  basicSalary: MoneyString;
  allowances: MoneyString;
  bonuses: MoneyString;
  deductions: MoneyString;
  netSalary: MoneyString;
  status: SalaryStatus;
  paidAt: ISODateString | null;
  journalEntryId: string | null;
  createdAt: ISODateString;
}
```

---

### 6.13 Contacts

**Base path:** `/contacts` *(part of Chart of Accounts module)*

```typescript
// src/types/contact.types.ts — already defined above in common types

export const contactsApi = {
  create: (dto: {
    contactType: ContactType;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    taxId?: string;
    openingBalance?: number;
  }) =>
    apiClient.post<ApiResponse<Contact>>('/contacts', dto),

  list: (params?: PaginationQuery & { contactType?: ContactType; isActive?: boolean }) =>
    apiClient.get<ApiResponse<PaginatedResponse<Contact>>>('/contacts', { params }),

  getOne: (id: string) =>
    apiClient.get<ApiResponse<Contact>>(`/contacts/${id}`),

  update: (id: string, dto: Partial<Contact>) =>
    apiClient.patch<ApiResponse<Contact>>(`/contacts/${id}`, dto),

  deactivate: (id: string) =>
    apiClient.patch(`/contacts/${id}/deactivate`),
};
```

---

### 6.14 Audit Logs

**Base path:** `/audit-logs`

```typescript
export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;           // e.g. "invoice.sent", "expense.approved"
  resourceType: string;     // e.g. "Invoice", "Expense"
  resourceId: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: ISODateString;
}

export const auditLogsApi = {
  list: (params?: PaginationQuery & {
    action?: string;
    resourceType?: string;
    resourceId?: string;
    fromDate?: string;
    toDate?: string;
  }) =>
    apiClient.get<ApiResponse<PaginatedResponse<AuditLog>>>('/audit-logs', { params }),
};
```

---

## 7. Error Handling

```typescript
// src/api/errors.ts
import { AxiosError } from 'axios';

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiError | undefined;
    if (!data) return 'Network error — please check your connection';

    if (Array.isArray(data.message)) {
      return data.message.join(', ');    // validation error list
    }
    return data.message ?? error.message;
  }
  return 'An unexpected error occurred';
}

export function isApiError(error: unknown, statusCode: number): boolean {
  return error instanceof AxiosError && error.response?.status === statusCode;
}

// Common status codes to handle:
// 400 — Bad Request (validation failed, business rule violated e.g. overpayment)
// 401 — Unauthorized (token expired — auto-refresh handles this)
// 402 — Payment Required (feature not in plan — show upgrade prompt)
// 403 — Forbidden (insufficient role)
// 404 — Not Found (wrong org isolation or deleted resource)
// 409 — Conflict (invalid state transition e.g. VOID→SENT, PAID→VOID)
// 422 — Unprocessable Entity (semantic error)
// 429 — Too Many Requests (throttle limit hit — back off and retry)
```

### React Query error handling pattern

```typescript
// src/hooks/useInvoices.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices.api';
import { getErrorMessage, isApiError } from '../api/errors';

export function useInvoices(params?: QueryInvoicesDto) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => invoicesApi.list(params).then((r) => r.data.data),
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.send(id).then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      if (isApiError(error, 409)) {
        // ConflictException — show state machine message
        alert(getErrorMessage(error));
      }
    },
  });
}
```

---

## 8. Pagination Pattern

```typescript
// src/hooks/usePagination.ts
import { useState } from 'react';

export function usePagination(defaultLimit = 20) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);

  return {
    page,
    limit,
    setPage,
    setLimit,
    reset: () => setPage(1),
    queryParams: { page, limit },
  };
}

// Usage in component:
// const { page, limit, setPage, queryParams } = usePagination();
// const { data } = useInvoices(queryParams);
//
// Response shape:
// data.data        → Invoice[]
// data.total       → number (total count)
// data.page        → number
// data.limit       → number
// data.meta.pages  → number (total pages)
// data.meta.hasNext → boolean
```

---

## 9. File Uploads

### Bank statement import (multipart)

```typescript
async function importBankStatement(file: File, meta: {
  bankName: string;
  accountNumber: string;
  currency: string;
}) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bankName', meta.bankName);
  formData.append('accountNumber', meta.accountNumber);
  formData.append('currency', meta.currency);

  return bankReconciliationApi.importStatement(formData);
}
```

### Expense receipt (presigned S3 upload)

```typescript
async function uploadReceipt(expenseId: string, file: File) {
  // Step 1: get presigned URL
  const { data } = await expensesApi.initiateReceiptUpload(expenseId, {
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  // Step 2: PUT directly to S3 (bypass apiClient — no auth header)
  await fetch(data.data.presignedUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

  // Step 3: confirm
  await expensesApi.confirmReceiptUpload(expenseId, data.data.receiptId);
}
```

---

## 10. Real-time & Polling

The MVP API is REST-only — no WebSocket. For near-real-time needs:

```typescript
// Poll invoice PDF status until pdfUrl is set
function useInvoicePdf(invoiceId: string) {
  return useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.getOne(invoiceId).then((r) => r.data.data),
    refetchInterval: (data) => {
      // Stop polling once PDF URL is available
      return data?.pdfUrl ? false : 3000;
    },
  });
}

// Poll manual payment status
function usePaymentStatus(referenceCode: string) {
  return useQuery({
    queryKey: ['payment-status', referenceCode],
    queryFn: () => manualPaymentsApi.getStatus(referenceCode).then((r) => r.data.data),
    refetchInterval: (data) => {
      const done = data?.status === 'CONFIRMED' || data?.status === 'REJECTED';
      return done ? false : 5000;
    },
  });
}
```

---

## 11. RBAC & Feature Gates

### Role hierarchy

```
OWNER > ADMIN > ACCOUNTANT | MANAGER > VIEWER

OWNER      — full access including org settings, billing, member management
ADMIN      — all module access, cannot change billing plan
ACCOUNTANT — GL, invoices, expenses, reports (read/write)
MANAGER    — expenses (approve up to manager step), inventory (read/write)
VIEWER     — read-only across all modules
```

### Frontend enforcement

```typescript
// src/hooks/usePermission.ts
import { useAuthStore } from '../store/auth.store';

const ROLE_WEIGHT: Record<UserRole, number> = {
  VIEWER: 1, MANAGER: 2, ACCOUNTANT: 2, ADMIN: 3, OWNER: 4,
};

export function usePermission() {
  const { role } = useAuthStore();

  return {
    can: (minRole: UserRole) =>
      ROLE_WEIGHT[role] >= ROLE_WEIGHT[minRole],
    isOwner: role === 'OWNER',
    isAdmin: role === 'ADMIN' || role === 'OWNER',
  };
}

// Usage:
// const { can } = usePermission();
// {can('ADMIN') && <DeleteButton />}
```

### HTTP 402 — Feature gate

```typescript
// Global interceptor already handles 401.
// Add 402 handling in your router or a context provider:

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 402) {
      // Dispatch event or navigate to upgrade page
      window.dispatchEvent(new CustomEvent('feature-gate', {
        detail: { feature: error.response.data?.feature }
      }));
    }
    return Promise.reject(error);
  }
);
```

---

## 12. State Management Recommendations

```
┌─────────────────────────────────────────────────────────────┐
│  Server state  →  @tanstack/react-query                      │
│    All API responses, pagination, caching, background sync   │
│                                                              │
│  Auth state    →  Zustand (in-memory only)                   │
│    accessToken, user, currentOrgId, role                     │
│    NEVER persist accessToken to localStorage                 │
│                                                              │
│  UI state      →  useState / useReducer                      │
│    Modal open/close, form state, filters                     │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// src/store/auth.store.ts
import { create } from 'zustand';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  currentOrgId: string | null;
  role: UserRole | null;
  setAuth: (token: string, user: User) => void;
  setOrg: (orgId: string, role: UserRole) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  currentOrgId: null,
  role: null,
  setAuth: (accessToken, user) => {
    set({ accessToken, user });
    tokenStore.setToken(accessToken);  // sync to axios interceptor
  },
  setOrg: (currentOrgId, role) => {
    set({ currentOrgId, role });
    tokenStore.setOrgId(currentOrgId);
  },
  clear: () => {
    set({ accessToken: null, user: null, currentOrgId: null, role: null });
    tokenStore.clearToken();
    tokenStore.clearOrgId();
  },
}));
```

---

## 13. Environment Variables

```bash
# .env.local (Vite)
VITE_API_BASE_URL=http://localhost:3000/v1
VITE_APP_NAME=FinCore
VITE_ENVIRONMENT=development    # development | staging | production
```

```typescript
// src/config/env.ts
export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL as string,
  appName: import.meta.env.VITE_APP_NAME as string,
  isDev: import.meta.env.VITE_ENVIRONMENT === 'development',
} as const;
```

---

## Quick Reference

### Money values

```typescript
import Decimal from 'decimal.js';

// Always use Decimal.js — NEVER parseFloat() on monetary strings
const total = new Decimal(invoice.totalAmount);
const formatted = total.toFixed(2);   // "1234.50"

// Display with currency
const display = new Intl.NumberFormat('en-PK', {
  style: 'currency',
  currency: invoice.currency,
}).format(total.toNumber());
```

### Date handling

```typescript
import dayjs from 'dayjs';

// API sends ISO 8601 — always parse before display
const formatted = dayjs(invoice.issueDate).format('DD MMM YYYY');

// Send dates to API as "YYYY-MM-DD"
const forApi = dayjs(selectedDate).format('YYYY-MM-DD');
```

### Health check

```typescript
// GET /health  →  no auth required
// Useful for splash screen / maintenance mode detection
const health = await axios.get(`${BASE_URL.replace('/v1', '')}/health`);
// { status: "ok", info: { database: {...}, redis: {...} } }
```

---

*FinCore Frontend Guide · v1.0 · Generated April 2026*  
*Backend: NestJS v10 · Prisma v7 · PostgreSQL 16 · Redis 7*
