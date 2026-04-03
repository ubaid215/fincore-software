/**
 * src/modules/invoicing/invoicing.module.ts
 *
 * Invoicing feature module — Sprint S2.
 *
 * Registers:
 *  - InvoicesService     — 6-state lifecycle + payment recording
 *  - InvoicePdfService   — Puppeteer → S3 PDF generation
 *  - FxRateService       — Open Exchange Rates + Redis cache
 *  - PdfProcessor        — BullMQ job consumer (imported from JobsModule)
 *  - BullMQ queue        — 'invoice-pdf' queue backed by Redis
 *
 * Sprint: S2 · Week 5–6
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InvoicesService, PDF_QUEUE } from './services/invoices.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { FxRateService } from './services/fx-rate.service';
import { InvoicesController } from './controllers/invoices.controller';
import { PdfProcessor } from '../../jobs/processors/pdf.processor';

@Module({
  imports: [
    // Register the invoice-pdf BullMQ queue — backed by the Redis connection
    // configured in BullModule.forRootAsync() in AppModule
    BullModule.registerQueue({ name: PDF_QUEUE }),
  ],
  providers: [
    InvoicesService,
    InvoicePdfService,
    FxRateService,
    PdfProcessor, // BullMQ processor — must be a provider in the same module
  ],
  controllers: [InvoicesController],
  exports: [InvoicesService, FxRateService],
})
export class InvoicingModule {}

/*
 * Sprint S2 · Invoicing Module · Week 5–6
 * Owned by: Invoicing team
 * Exports: InvoicesService (used by S6 FinancialReports), FxRateService (shared)
 */
