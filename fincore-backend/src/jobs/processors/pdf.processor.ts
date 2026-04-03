/**
 * src/jobs/processors/pdf.processor.ts
 *
 * BullMQ job processor for invoice PDF generation.
 *
 * This runs in the background — completely decoupled from the HTTP request.
 * When InvoicesService.send() is called, it enqueues a job here.
 * The client receives a 200 response immediately; the PDF is ready within seconds.
 *
 * Job flow:
 *   1. InvoicesService.send()  →  pdfQueue.add('generate', payload)
 *   2. This processor picks up the job from Redis
 *   3. InvoicePdfService.generateAndUpload() → Puppeteer → S3
 *   4. invoice.pdfUrl is updated in PostgreSQL
 *   5. Job marked complete in Redis
 *
 * Retry policy: 3 attempts with exponential backoff (2s, 4s, 8s)
 *
 * Sprint: S2 · Week 5–6
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InvoicePdfService } from '../../modules/invoicing/services/invoice-pdf.service';
import { PDF_QUEUE } from '../../modules/invoicing/services/invoices.service';
import type { PdfJobPayload } from '../../modules/invoicing/types/invoice.types';

@Processor(PDF_QUEUE)
export class PdfProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(private readonly pdfService: InvoicePdfService) {
    super();
  }

  /**
   * Main job handler — called by BullMQ when a job is dequeued.
   * Route by job.name to support multiple job types on the same queue.
   * Any error thrown here triggers a retry (up to the job's configured attempts).
   */
  async process(job: Job<PdfJobPayload>): Promise<void> {
    if (job.name !== 'generate') {
      this.logger.warn(`[Job ${job.id}] Unknown job name: ${job.name} — skipping`);
      return;
    }

    const { invoiceId, organizationId } = job.data;

    this.logger.log(
      `[Job ${job.id}] Generating PDF for invoice ${invoiceId} (attempt ${job.attemptsMade + 1})`,
    );

    try {
      const result = await this.pdfService.generateAndUpload(invoiceId, organizationId);

      this.logger.log(`[Job ${job.id}] PDF ready → ${result.s3Key} (${result.sizeBytes} bytes)`);

      // updateProgress replaces the legacy job.progress() call from bull
      await job.updateProgress(100);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Job ${job.id}] PDF generation failed for invoice ${invoiceId}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Re-throw so BullMQ knows to retry
      throw err;
    }
  }
}

/*
 * Sprint S2 · PDF BullMQ Processor · Week 5–6
 * Queue:   invoice-pdf (PDF_QUEUE constant)
 * Retry:   3 attempts, exponential backoff (2s, 4s, 8s)
 * Owned by: Invoicing team
 */
