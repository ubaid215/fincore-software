// src/modules/notifications/services/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export interface PaymentInstructionsContext {
  customerName: string;
  referenceCode: string;
  amount: number;
  currency: string;
  planName: string;
  bankName: string;
  bankAccountTitle: string;
  bankIban: string;
  bankSwift: string;
  proformaPdfUrl?: string;
  expiresAt: string;
}

export interface SubscriptionActivatedContext {
  customerName: string;
  planName: string;
  startDate: string;
  endDate: string;
  dashboardUrl: string;
}

export interface PaymentRejectedContext {
  customerName: string;
  referenceCode: string;
  rejectionReason: string;
  supportEmail: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();
  private templateCacheValid = false;

  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  private async loadTemplates(): Promise<void> {
    if (this.templateCacheValid) return;

    const templateDir = path.join(__dirname, '..', 'templates');
    const templateFiles = [
      'payment-instructions.hbs',
      'subscription-activated.hbs',
      'payment-rejected.hbs',
    ];

    for (const file of templateFiles) {
      try {
        const content = await fs.readFile(path.join(templateDir, file), 'utf-8');
        this.templates.set(file, Handlebars.compile(content));
        this.logger.debug(`Loaded template: ${file}`);
      } catch (error) {
        this.logger.error(`Failed to load template ${file}:`, error);
        throw new Error(`Template ${file} not found or invalid`);
      }
    }

    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string) => {
      return new Intl.NumberFormat('en-PK', { style: 'currency', currency }).format(amount);
    });

    Handlebars.registerHelper('formatDate', (date: string | Date) => {
      return new Date(date).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    this.templateCacheValid = true;
  }

  async sendEmail(options: SendEmailOptions): Promise<string> {
    await this.loadTemplates();

    const template = this.templates.get(options.template);
    if (!template) {
      throw new Error(`Template "${options.template}" not found`);
    }

    const html = template(options.context);
    const job = await this.emailQueue.add('send', {
      to: options.to,
      subject: options.subject,
      html,
    });

    this.logger.debug(
      `Email queued: jobId=${job.id}, to=${options.to}, template=${options.template}`,
    );

    // FIX: job.id is string | undefined in BullMQ types — use nullish coalescing to guarantee string
    return job.id ?? '';
  }

  async sendPaymentInstructions(to: string, context: PaymentInstructionsContext): Promise<string> {
    return this.sendEmail({
      to,
      subject: `FinCore Payment Instructions — Reference: ${context.referenceCode}`,
      template: 'payment-instructions.hbs',
      context: context as unknown as Record<string, unknown>,
    });
  }

  async sendSubscriptionActivated(
    to: string,
    context: SubscriptionActivatedContext,
  ): Promise<string> {
    return this.sendEmail({
      to,
      subject: `FinCore — Your ${context.planName} plan is now active!`,
      template: 'subscription-activated.hbs',
      context: context as unknown as Record<string, unknown>,
    });
  }

  async sendPaymentRejected(to: string, context: PaymentRejectedContext): Promise<string> {
    return this.sendEmail({
      to,
      subject: `FinCore — Payment reference ${context.referenceCode} was not approved`,
      template: 'payment-rejected.hbs',
      context: context as unknown as Record<string, unknown>,
    });
  }
}
