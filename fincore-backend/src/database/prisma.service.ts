// src/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type TenantContext = {
  organizationId: string | null;
  userId: string | null;
  bypassTenant?: boolean;
};

// ─────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  private _tenantCtx: TenantContext = {
    organizationId: null,
    userId: null,
  };

  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set.');
    }

    // ✅ REQUIRED super() call (fixes TS2377)
    super({
      adapter: new PrismaPg({ connectionString }),
    });

    // Capture context safely (DO NOT use `this` inside extension)
    const getCtx = () => this._tenantCtx;

    // Extend Prisma client (Prisma v5 pattern)
    const extended = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const ctx = getCtx();

            // Skip tenant logic
            if (ctx?.bypassTenant) {
              return query(args);
            }

            // Only modify if args has "where"
            if (ctx?.organizationId && args && typeof args === 'object' && 'where' in args) {
              const currentWhere = (args as any).where ?? {};

              (args as any).where = {
                AND: [currentWhere, { organizationId: ctx.organizationId }],
              };
            }

            return query(args);
          },
        },
      },
    });

    // ⚠️ IMPORTANT: overwrite instance with extended client
    Object.assign(this, extended);
  }

  // ───────────────────────────────────────────────────────────
  // TENANT CONTEXT
  // ───────────────────────────────────────────────────────────

  setTenantContext(ctx: TenantContext): void {
    this._tenantCtx = ctx;
  }

  bypassTenant(): void {
    this._tenantCtx = {
      organizationId: null,
      userId: null,
      bypassTenant: true,
    };
  }

  // ───────────────────────────────────────────────────────────
  // LIFECYCLE
  // ───────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('✅ Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // ───────────────────────────────────────────────────────────
  // TEST HELPER
  // ───────────────────────────────────────────────────────────

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() only allowed in test');
    }

    this.bypassTenant();

    const tables = [
      'documentSignature',
      'document',
      'documentFolder',
      'eventAttendee',
      'calendarEvent',
      'appointment',

      'salaryRecord',
      'payrollRun',
      'employee',

      'saleOrderLine',
      'saleOrder',
      'purchaseOrderLine',
      'purchaseOrder',
      'stockMovement',
      'stockSnapshot',
      'inventoryBatch',
      'product',

      'bankTransaction',
      'bankStatement',
      'receipt',
      'expenseLine',
      'expense',
      'invoicePayment',
      'invoiceLineItem',
      'invoice',
      'journalLine',
      'journalEntry',
      'fiscalPeriod',
      'account',
      'costCenter',

      'contactNote',
      'contact',

      'usageRecord',
      'manualPayment',
      'subscription',
      'planLimit',
      'plan',
      'customFieldValue',
      'customFieldDef',
      'whiteLabelConfig',
      'orgAppAccess',
      'notification',
      'auditLog',

      'invite',
      'apiKey',
      'oAuthAccount',
      'magicLink',
      'refreshToken',
      'userOrganization',
      'organization',
      'user',
    ] as const;

    for (const t of tables) {
      const model = (this as any)[t];
      if (model?.deleteMany) {
        await model.deleteMany();
      }
    }
  }
}
