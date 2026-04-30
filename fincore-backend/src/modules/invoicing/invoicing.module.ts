// src/modules/invoicing/invoicing.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InvoicesController } from './controllers/invoices.controller';
import { InvoicesService, PDF_QUEUE } from './services/invoices.service';
import { InvoicesTrackingService } from './services/invoices-tracking.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { FxRateService } from './services/fx-rate.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SubscriptionsModule,
    NotificationsModule,
    BullModule.registerQueueAsync({
      name: PDF_QUEUE,
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('redis.host', 'localhost'),
          port: cfg.get<number>('redis.port', 6379),
          password: cfg.get<string>('redis.password'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 50 },
          removeOnFail: { count: 20 },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesTrackingService, InvoicePdfService, FxRateService],
  exports: [InvoicesService, InvoicesTrackingService, FxRateService],
})
export class InvoicingModule {}
