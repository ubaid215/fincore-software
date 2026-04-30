// src/modules/invoicing/services/invoices-tracking.service.ts
//
// Tracking methods — stats dashboard + per-invoice activity timeline.
// These are added as a separate service to keep invoices.service.ts focused.
// InvoicingModule exports both services.

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InvoiceStatus } from '@prisma/client';
import Decimal from 'decimal.js';

export interface InvoiceStats {
  totalInvoiced: string; // sum of ALL non-void invoice totals
  totalPaid: string; // sum of amountPaid across all invoices
  totalOutstanding: string; // sum of amountDue (unpaid portion)
  totalOverdue: string; // sum of amountDue for OVERDUE invoices
  countDraft: number;
  countSent: number;
  countViewed: number;
  countPartial: number;
  countPaid: number;
  countOverdue: number;
  countVoid: number;
  countDisputed: number;
  countTotal: number;
  currency: string; // org default currency
}

export interface InvoiceTimelineEntry {
  id: string;
  action: string;
  description: string;
  userId: string | null;
  userName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  icon: string; // emoji for UI
}

@Injectable()
export class InvoicesTrackingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Stats dashboard ──────────────────────────────────────────────────────

  async getStats(organizationId: string): Promise<InvoiceStats> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { currency: true },
    });
    const currency = org?.currency ?? 'PKR';

    // One aggregate query per relevant set
    const [agg, countsByStatus] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { organizationId, deletedAt: null, status: { notIn: [InvoiceStatus.VOID] } },
        _sum: { totalAmount: true, amountPaid: true, amountDue: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { organizationId, deletedAt: null },
        _count: { id: true },
      }),
    ]);

    // Overdue aggregate
    const overdueAgg = await this.prisma.invoice.aggregate({
      where: { organizationId, status: InvoiceStatus.OVERDUE, deletedAt: null },
      _sum: { amountDue: true },
    });

    // Build counts map
    const counts: Record<string, number> = {};
    for (const row of countsByStatus) {
      counts[row.status] = row._count.id;
    }

    const totalInvoiced = new Decimal(agg._sum.totalAmount?.toString() ?? '0');
    const totalPaid = new Decimal(agg._sum.amountPaid?.toString() ?? '0');
    const totalOutstanding = new Decimal(agg._sum.amountDue?.toString() ?? '0');
    const totalOverdue = new Decimal(overdueAgg._sum.amountDue?.toString() ?? '0');

    return {
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalOutstanding: totalOutstanding.toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
      countDraft: counts[InvoiceStatus.DRAFT] ?? 0,
      countSent: counts[InvoiceStatus.SENT] ?? 0,
      countViewed: counts[InvoiceStatus.VIEWED] ?? 0,
      countPartial: counts[InvoiceStatus.PARTIALLY_PAID] ?? 0,
      countPaid: counts[InvoiceStatus.PAID] ?? 0,
      countOverdue: counts[InvoiceStatus.OVERDUE] ?? 0,
      countVoid: counts[InvoiceStatus.VOID] ?? 0,
      countDisputed: counts[InvoiceStatus.DISPUTED] ?? 0,
      countTotal: Object.values(counts).reduce((a, b) => a + b, 0),
      currency,
    };
  }

  // ── Per-invoice timeline ─────────────────────────────────────────────────

  async getTimeline(organizationId: string, invoiceId: string): Promise<InvoiceTimelineEntry[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { organizationId, resourceType: 'Invoice', resourceId: invoiceId },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Also fetch payments to include in timeline
    const payments = await this.prisma.invoicePayment.findMany({
      where: { invoiceId },
      orderBy: { paidAt: 'desc' },
    });

    const ACTION_MAP: Record<string, { description: string; icon: string }> = {
      'invoice.created': { description: 'Invoice created', icon: '📄' },
      'invoice.sent': { description: 'Invoice sent to client', icon: '📤' },
      'invoice.voided': { description: 'Invoice voided', icon: '🚫' },
      'invoice.deleted': { description: 'Invoice deleted', icon: '🗑️' },
      'invoice.payment_recorded': { description: 'Payment recorded', icon: '💳' },
    };

    const auditEntries: InvoiceTimelineEntry[] = logs.map((log) => {
      const meta = (log.metadata ?? {}) as Record<string, unknown>;
      const mapped = ACTION_MAP[log.action] ?? { description: log.action, icon: '📋' };

      // Build readable description
      let description = mapped.description;
      if (log.action === 'invoice.payment_recorded' && meta.amount) {
        description = `Payment of ${meta.currency ?? ''} ${meta.amount} recorded via ${meta.method ?? ''}`;
      }

      return {
        id: log.id,
        action: log.action,
        description,
        userId: log.userId,
        userName: log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : null,
        metadata: meta,
        createdAt: log.createdAt.toISOString(),
        icon: mapped.icon,
      };
    });

    // Interleave payment entries that may not have audit logs (legacy data)
    const paymentEntries: InvoiceTimelineEntry[] = payments.map((p) => ({
      id: `payment-${p.id}`,
      action: 'payment.received',
      description: `${p.currency} ${Number(p.amount).toFixed(2)} received via ${p.method}`,
      userId: null,
      userName: null,
      metadata: { amount: p.amount, method: p.method, reference: p.reference },
      createdAt: p.paidAt.toISOString(),
      icon: '💰',
    }));

    // Merge and sort by date descending
    return [...auditEntries, ...paymentEntries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // ── Overdue alert list ────────────────────────────────────────────────────

  async getOverdue(organizationId: string) {
    return this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: InvoiceStatus.OVERDUE,
        deletedAt: null,
      },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        dueDate: true,
        amountDue: true,
        currency: true,
        customerId: true,
      },
      orderBy: { dueDate: 'asc' },
    });
  }
}
