import type { ROLES } from '@/config/app.config'

// ─── Primitives ──────────────────────────────────────────────
export type ID = string

export type Role = keyof typeof ROLES

export type Currency = string   // ISO 4217 code, e.g. "PKR", "USD"

// ─── API Response Wrappers ───────────────────────────────────
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface PaginationMeta {
  page:        number
  limit:       number
  total:       number
  totalPages:  number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export interface PaginationParams {
  page?:   number
  limit?:  number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─── Error types ─────────────────────────────────────────────
export interface ApiError {
  message:    string
  statusCode: number
  errors?:    Record<string, string[]>  // field-level validation errors
}

// ─── Auth ────────────────────────────────────────────────────
export interface AuthUser {
  id:        ID
  email:     string
  firstName: string
  lastName:  string
  avatarUrl: string | null
}

export interface AuthTokens {
  accessToken: string
  expiresIn:   number
}

export interface OrganizationMembership {
  organizationId:   ID
  organizationName: string
  role:             Role
  isDefault:        boolean
}

// ─── Organization ────────────────────────────────────────────
export interface Organization {
  id:           ID
  name:         string
  slug:         string
  logoUrl:      string | null
  currency:     Currency
  timezone:     string
  country:      string
  taxNumber:    string | null
  address:      string | null
  createdAt:    string
}

// ─── Common entity fields ────────────────────────────────────
export interface Timestamps {
  createdAt: string
  updatedAt: string
}

export interface SoftDelete extends Timestamps {
  deletedAt: string | null
}

// ─── Status badge variant helper ────────────────────────────
export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'draft'

// ─── Table ───────────────────────────────────────────────────
export interface TableFilter {
  id:    string
  value: unknown
}

export interface TableSort {
  id:   string
  desc: boolean
}

// ─── Form ────────────────────────────────────────────────────
export type FormMode = 'create' | 'edit' | 'view'

// ─── Select option (for dropdowns) ──────────────────────────
export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
  description?: string
}