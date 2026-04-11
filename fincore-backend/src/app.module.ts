// src/app.module.ts
//
// FIXES applied:
//  16. OrganizationsModule removed — WorkspaceModule is the canonical org module.
//      Duplicate /organizations routes eliminated.
//  18. JwtAuthGuard, RolesGuard, FeatureFlagGuard registered as APP_GUARD
//      providers so they protect ALL routes globally with full DI access.
//  TenantContextMiddleware wired globally so every request sets prisma context.
//
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { TransformableInfo } from 'logform';
import * as path from 'path';

// ── Config ────────────────────────────────────────────────────────────────────
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import awsConfig from './config/aws.config';
import redisConfig from './config/redis.config';

// ── Core ──────────────────────────────────────────────────────────────────────
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';

// ── Global guards (DI-aware — must be APP_GUARD not useGlobalGuards) ─────────
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FeatureFlagGuard } from './common/guards/feature-flag.guard';

// ── Middleware ────────────────────────────────────────────────────────────────
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

// ── Feature modules ───────────────────────────────────────────────────────────
import { AuthModule } from './modules/auth/auth.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { ChartOfAccountsModule } from './modules/chart-of-accounts/chart-of-accounts.module';
import { GeneralLedgerModule } from './modules/general-ledger/general-ledger.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { BankReconciliationModule } from './modules/bank-reconciliation/bank-reconciliation.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { ManualPaymentsModule } from './modules/manual-payments/manual-payments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { FinancialReportsModule } from './modules/financial-reports/financial-reports.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { GlobalRedisModule } from './modules/redis/redis.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
// FIX 16: OrganizationsModule REMOVED — WorkspaceModule is canonical

@Module({
  imports: [
    // ── Config (global) ────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, awsConfig, redisConfig],
      envFilePath: path.resolve(process.cwd(), '.env'),
    }),

    // ── Logging ────────────────────────────────────────────────────────────
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf((info: TransformableInfo) => {
              const ts = typeof info['timestamp'] === 'string' ? info['timestamp'] : '';
              const level = typeof info['level'] === 'string' ? info['level'] : '';
              const message =
                typeof info['message'] === 'string' ? info['message'] : String(info['message']);
              const context = typeof info['context'] === 'string' ? `[${info['context']}] ` : '';
              const meta = { ...info } as Record<string, unknown>;
              ['timestamp', 'level', 'message', 'context'].forEach((k) => delete meta[k]);
              const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${ts} ${level} ${context}${message}${rest}`;
            }),
          ),
        }),
      ],
    }),

    // ── Rate limiting ──────────────────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => [
        {
          ttl: cfg.get<number>('app.throttleTtl', 60),
          limit: cfg.get<number>('app.throttleLimit', 100),
        },
      ],
    }),

    // ── Queue (BullMQ / Redis) ─────────────────────────────────────────────
    (BullModule as any).forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('redis.host', 'localhost'),
          port: cfg.get<number>('redis.port', 6379),
          password: cfg.get<string>('redis.password'),
        },
      }),
    }),

    // ── Scheduler ─────────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── S0: Infrastructure ─────────────────────────────────────────────────
    PrismaModule,
    HealthModule,
    GlobalRedisModule,

    // ── S1: Auth + Workspace ───────────────────────────────────────────────
    AuthModule,
    WorkspaceModule,

    // ── S2: Accounting foundation ──────────────────────────────────────────
    ChartOfAccountsModule,
    GeneralLedgerModule,

    // ── S3: Finance apps ───────────────────────────────────────────────────
    InvoicingModule,
    ExpensesModule,
    BankReconciliationModule,
    InventoryModule,

    // ── S4: Business ops ───────────────────────────────────────────────────
    SubscriptionsModule,
    ManualPaymentsModule,
    FeatureFlagsModule,
    NotificationsModule,

    // ── S5: Reporting & analytics ──────────────────────────────────────────
    FinancialReportsModule,
    AnalyticsModule,

    // ── S6: Productivity apps ──────────────────────────────────────────────
    ContactsModule,
    CalendarModule,
    AppointmentsModule,
  ],

  providers: [
    // ── FIX 18: Global guards via APP_GUARD ────────────────────────────────
    // Registered here (not useGlobalGuards) so Reflector + DI work correctly.
    // Order matters: Throttler → JWT → Roles → FeatureFlag
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // rate limiting on all routes
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // JWT verification (skipped on @Public routes)
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // role check (skipped if no @Roles decorator)
    },
    {
      provide: APP_GUARD,
      useClass: FeatureFlagGuard, // app-access check (skipped if no @RequireApp)
    },
  ],
})
export class AppModule implements NestModule {
  // ── FIX: Wire TenantContextMiddleware globally ─────────────────────────
  // Sets prisma.setTenantContext() at the start of every HTTP request
  // so the Prisma tenant middleware has the correct organizationId.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
