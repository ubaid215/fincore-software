// src/modules/notifications/services/notifications.service.ts
//
// FIX 15 & 16: Added two missing capabilities:
//   - Socket.io real-time delivery via NotificationsGateway
//   - DB persistence via Notification model for in-app notification center
//
// Architecture:
//   createNotification() → saves to DB → emits via Socket.io → done
//   sendEmail()          → queues BullMQ job → EmailProcessor delivers
//   Both paths are independent — email delivery doesn't block real-time.

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs/promises';
import * as path from 'path';
import Handlebars from 'handlebars';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsGateway } from '../gateway/notifications.gateway';
import { NotificationType, AppKey } from '@prisma/client';

export interface SendEmailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
}

export interface CreateNotificationOptions {
  organizationId: string;
  userId: string; // recipient user ID
  type: NotificationType;
  title: string;
  body: string;
  app?: AppKey;
  resourceType?: string;
  resourceId?: string;
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

  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // FIX 15 & 16: Real-time + persisted notifications
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Creates a persisted notification in DB and emits it via Socket.io.
   * Use this for all in-app notifications (invoice paid, expense approved, etc.)
   */
  async createNotification(opts: CreateNotificationOptions): Promise<void> {
    // 1. Persist to DB (in-app notification center / unread count)
    const notification = await this.prisma.notification.create({
      data: {
        organizationId: opts.organizationId,
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        app: opts.app,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId,
        isRead: false,
      },
    });

    // 2. Emit real-time to user's socket room
    this.gateway.emitToUser(opts.userId, 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      app: notification.app,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      createdAt: notification.createdAt,
    });
  }

  /**
   * Broadcast a real-time event to all connected members of an org.
   * Does NOT persist — use for dashboard data refresh signals.
   * e.g. "invoice created → refresh invoice list"
   */
  broadcastToOrg(organizationId: string, event: string, data: unknown): void {
    this.gateway.emitToOrg(organizationId, event, data);
  }

  /** Mark a notification as read */
  async markRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Get unread notifications for a user in an org */
  async getUnread(organizationId: string, userId: string) {
    return this.prisma.notification.findMany({
      where: { organizationId, userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Mark all as read for a user */
  async markAllRead(organizationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { organizationId, userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EMAIL (BullMQ queue — unchanged from original)
  // ══════════════════════════════════════════════════════════════════════════

  async sendEmail(options: SendEmailOptions): Promise<string> {
    await this.loadTemplates();
    const template = this.templates.get(options.template);
    if (!template) throw new Error(`Template "${options.template}" not found`);

    const html = template(options.context);
    const job = await this.emailQueue.add('send', {
      to: options.to,
      subject: options.subject,
      html,
    });

    this.logger.debug(`Email queued: jobId=${job.id}, to=${options.to}`);
    return job.id ?? '';
  }

  async sendPaymentInstructions(to: string, ctx: PaymentInstructionsContext): Promise<string> {
    return this.sendEmail({
      to,
      subject: `FinCore Payment Instructions — Ref: ${ctx.referenceCode}`,
      template: 'payment-instructions.hbs',
      context: ctx as unknown as Record<string, unknown>,
    });
  }

  async sendSubscriptionActivated(to: string, ctx: SubscriptionActivatedContext): Promise<string> {
    return this.sendEmail({
      to,
      subject: `FinCore — Your ${ctx.planName} plan is now active!`,
      template: 'subscription-activated.hbs',
      context: ctx as unknown as Record<string, unknown>,
    });
  }

  async sendPaymentRejected(to: string, ctx: PaymentRejectedContext): Promise<string> {
    return this.sendEmail({
      to,
      subject: `FinCore — Payment ref ${ctx.referenceCode} not approved`,
      template: 'payment-rejected.hbs',
      context: ctx as unknown as Record<string, unknown>,
    });
  }

  // ── Template loader ───────────────────────────────────────────────────────

  private async loadTemplates(): Promise<void> {
    if (this.templateCacheValid) return;

    const templateDir = path.join(__dirname, '..', 'templates');
    const templateFiles = [
      'payment-instructions.hbs',
      'subscription-activated.hbs',
      'payment-rejected.hbs',
    ];

    for (const file of templateFiles) {
      const content = await fs.readFile(path.join(templateDir, file), 'utf-8');
      this.templates.set(file, Handlebars.compile(content));
    }

    Handlebars.registerHelper('formatCurrency', (amount: number, currency: string) =>
      new Intl.NumberFormat('en-PK', { style: 'currency', currency }).format(amount),
    );
    Handlebars.registerHelper('formatDate', (date: string | Date) =>
      new Date(date).toLocaleDateString('en-PK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    );

    this.templateCacheValid = true;
  }
}
