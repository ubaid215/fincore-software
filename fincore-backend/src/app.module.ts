// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { TransformableInfo } from 'logform';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import awsConfig from './config/aws.config';
import redisConfig from './config/redis.config';
import { PrismaModule } from './database/prisma.module';
import { HealthModule } from './health/health.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, awsConfig, redisConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            winston.format.colorize(),
            winston.format.printf((info: TransformableInfo) => {
              const timestamp = typeof info['timestamp'] === 'string' ? info['timestamp'] : '';
              const level = typeof info['level'] === 'string' ? info['level'] : '';
              const message =
                typeof info['message'] === 'string' ? info['message'] : String(info['message']);
              const context = typeof info['context'] === 'string' ? `[${info['context']}] ` : '';
              const meta = { ...info } as Record<string, unknown>;
              delete meta['timestamp'];
              delete meta['level'];
              delete meta['message'];
              delete meta['context'];
              const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} ${level} ${context}${message}${rest}`;
            }),
          ),
        }),
      ],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => [
        {
          ttl: cfg.get<number>('app.throttleTtl', 60),
          limit: cfg.get<number>('app.throttleLimit', 100),
        },
      ],
    }),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
    ScheduleModule.forRoot(),

    // ── S0 ────────────────────────────────────────────────────────────────────
    PrismaModule,
    HealthModule,
    AuthModule,
    WorkspaceModule,
    // ── S1 ────────────────────────────────────────────────────────────────────
    ChartOfAccountsModule, // Accounts + FiscalPeriods
    GeneralLedgerModule, // JournalEntries — depends on ChartOfAccountsModule
    // ── S2 ────────────────────────────────────────────────────────────────────

    InvoicingModule,
    // ── S3 ────────────────────────────────────────────────────────────────────
    ExpensesModule,
    BankReconciliationModule,
    SubscriptionsModule,
    FeatureFlagsModule,
    ManualPaymentsModule,
    NotificationsModule,
    FinancialReportsModule,
    InventoryModule, // ← Add this
    AnalyticsModule,
  ],
})
export class AppModule {}
