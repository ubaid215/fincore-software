// src/prisma/tenant.middleware.ts
// Tenant isolation middleware for Prisma.
//
// PURPOSE:
//   Every query against a tenant-scoped model MUST include
//   organizationId in the WHERE clause. This middleware:
//   1. Auto-injects organizationId on findMany / findFirst / count / aggregate
//   2. Throws if a write (create/update/delete) lacks organizationId
//   3. Logs a warning for any bypass attempt
//
// USAGE in PrismaService:
//   this.$use(createTenantMiddleware(() => this._tenantCtx))
//
// FIX (Prisma 5): Prisma.Middleware and Prisma.MiddlewareParams were removed.
//   We define equivalent types inline. The $use() API itself still exists on
//   PrismaClient in Prisma 5 (it was soft-deprecated but not removed), so the
//   call site in PrismaService remains unchanged.
//   Refs: https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware

import { Prisma } from '@prisma/client';
import { ForbiddenException, Logger } from '@nestjs/common';

// ── Prisma 5 compatible middleware types ─────────────────────────────────────
// Prisma.Middleware and Prisma.MiddlewareParams are no longer exported in v5.
// These manual types are structurally identical to what was exported in v4.

export type MiddlewareParams = {
  model?: Prisma.ModelName;
  action: string;
  args: any;
  dataPath: string[];
  runInTransaction: boolean;
};

export type MiddlewareFn = (
  params: MiddlewareParams,
  next: (params: MiddlewareParams) => Promise<any>,
) => Promise<any>;

// ── Models that are tenant-scoped (have organizationId) ──────────────────────
const TENANT_MODELS = new Set([
  'Invoice',
  'InvoiceLineItem',
  'InvoicePayment',
  'Expense',
  'ExpenseLine',
  'Receipt',
  'CostCenter',
  'JournalEntry',
  'JournalLine',
  'FiscalPeriod',
  'Account',
  'BankStatement',
  'BankTransaction',
  'Product',
  'InventoryBatch',
  'StockMovement',
  'StockSnapshot',
  'PurchaseOrder',
  'PurchaseOrderLine',
  'SaleOrder',
  'SaleOrderLine',
  'Employee',
  'SalaryRecord',
  'PayrollRun',
  'Contact',
  'ContactNote',
  'AuditLog',
  'Notification',
  'OrgAppAccess',
  'CustomFieldDef',
  'CustomFieldValue',
  'ApiKey',
  'Invite',
  'UserOrganization',
  'CalendarEvent',
  'EventAttendee',
  'Appointment',
  'Document',
  'DocumentFolder',
  'DocumentSignature',
  'UsageRecord',
  'ManualPayment',
  'Subscription',
]);

// ── Read operations that get auto-injected org filter ───────────────────────
const READ_ACTIONS = new Set([
  'findUnique',
  'findFirst',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

// ── Write operations that are validated ─────────────────────────────────────
const WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const logger = new Logger('TenantMiddleware');

// ── Context interface — set per request in NestJS ───────────────────────────
export interface TenantContext {
  organizationId: string | null;
  userId: string | null;
  bypassTenant?: boolean; // ONLY for internal seed / admin scripts
}

export function createTenantMiddleware(getContext: () => TenantContext): MiddlewareFn {
  return async (params: MiddlewareParams, next: (params: MiddlewareParams) => Promise<any>) => {
    const ctx = getContext();

    // Not a tenant-scoped model — pass through immediately
    if (!params.model || !TENANT_MODELS.has(params.model)) {
      return next(params);
    }

    // Internal bypass — owner seed / admin migration scripts only
    if (ctx.bypassTenant) {
      logger.warn(`Tenant bypass used by userId=${ctx.userId} on ${params.model}.${params.action}`);
      return next(params);
    }

    if (!ctx.organizationId) {
      throw new ForbiddenException(
        `Tenant context missing — organizationId required for ${params.model}.${params.action}`,
      );
    }

    // ── READ: auto-inject organizationId into where clause ──────────────────
    if (READ_ACTIONS.has(params.action)) {
      params.args = params.args ?? {};
      params.args.where = {
        ...(params.args.where ?? {}),
        organizationId: ctx.organizationId,
      };
    }

    // ── WRITE: validate organizationId is present ───────────────────────────
    if (WRITE_ACTIONS.has(params.action)) {
      _validateWriteTenant(params, ctx.organizationId);
    }

    return next(params);
  };
}

function _validateWriteTenant(params: MiddlewareParams, organizationId: string): void {
  const action = params.action;

  if (action === 'create' || action === 'upsert') {
    const data = action === 'upsert' ? params.args?.create : params.args?.data;
    if (data && data.organizationId && data.organizationId !== organizationId) {
      throw new ForbiddenException(
        `Tenant mismatch on ${params.model}.${action} — ` +
          `context=${organizationId}, payload=${data.organizationId}`,
      );
    }
    // Auto-inject if missing
    if (data && !data.organizationId) {
      data.organizationId = organizationId;
    }
  }

  if (action === 'createMany') {
    const rows: any[] = params.args?.data ?? [];
    for (const row of rows) {
      if (row.organizationId && row.organizationId !== organizationId) {
        throw new ForbiddenException(`Tenant mismatch in createMany on ${params.model}`);
      }
      row.organizationId = organizationId;
    }
  }

  if (
    action === 'update' ||
    action === 'delete' ||
    action === 'updateMany' ||
    action === 'deleteMany'
  ) {
    params.args = params.args ?? {};
    params.args.where = {
      ...(params.args.where ?? {}),
      organizationId, // always scope mutations to current tenant
    };
  }
}
