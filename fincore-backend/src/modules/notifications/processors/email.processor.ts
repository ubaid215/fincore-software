// src/modules/notifications/processors/email.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

@Processor('email')
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: Transporter | null = null;
  private readonly smtpHost: string;
  private readonly smtpPort: number;
  private readonly smtpUser: string;
  private readonly smtpPass: string;
  private readonly emailFrom: string;

  constructor(private configService: ConfigService) {
    super();
    this.smtpHost = this.configService.get<string>('smtp.host', 'localhost');
    this.smtpPort = this.configService.get<number>('smtp.port', 1025);
    this.smtpUser = this.configService.get<string>('smtp.user', '');
    this.smtpPass = this.configService.get<string>('smtp.pass', '');
    this.emailFrom = this.configService.get<string>('smtp.from', 'noreply@fincore.local');
    this.initTransporter();
  }

  private initTransporter(): void {
    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: false, // TLS not used in local dev
      auth:
        this.smtpUser && this.smtpPass ? { user: this.smtpUser, pass: this.smtpPass } : undefined,
    });
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    this.logger.debug(`Processing email job ${job.id} to ${job.data.to}`);

    if (!this.transporter) {
      throw new Error('SMTP transport not initialized');
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.emailFrom,
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html,
      });

      this.logger.debug(`Email sent: messageId=${info.messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error; // BullMQ will retry based on backoff config
    }
  }
}
