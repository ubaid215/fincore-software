// src/modules/analytics/services/analytics.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  DashboardMetrics,
  TrendAnalysis,
  CustomerInsights,
  ProductInsights,
  KpiDashboard,
  KpiAlert,
} from '../types/analytics.types';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async getDashboardMetrics(organizationId: string): Promise<KpiDashboard> {
    const [currentPeriod, previousPeriod] = await Promise.all([
      this.calculatePeriodMetrics(organizationId, 0, 30),
      this.calculatePeriodMetrics(organizationId, 30, 60),
    ]);

    const trends: TrendAnalysis[] = [
      {
        metric: 'Revenue',
        currentPeriod: currentPeriod.revenue,
        previousPeriod: previousPeriod.revenue,
        changePercent: this.calcChange(currentPeriod.revenue, previousPeriod.revenue),
        trend: this.getTrend(currentPeriod.revenue, previousPeriod.revenue),
        forecast: currentPeriod.revenue * 1.1,
      },
      {
        metric: 'Net Profit',
        currentPeriod: currentPeriod.netProfit,
        previousPeriod: previousPeriod.netProfit,
        changePercent: this.calcChange(currentPeriod.netProfit, previousPeriod.netProfit),
        trend: this.getTrend(currentPeriod.netProfit, previousPeriod.netProfit),
        forecast: currentPeriod.netProfit * 1.08,
      },
      {
        metric: 'Gross Margin',
        currentPeriod: currentPeriod.grossMargin,
        previousPeriod: previousPeriod.grossMargin,
        changePercent: this.calcChange(currentPeriod.grossMargin, previousPeriod.grossMargin),
        trend: this.getTrend(currentPeriod.grossMargin, previousPeriod.grossMargin),
        forecast: currentPeriod.grossMargin * 1.02,
      },
    ];

    const alerts = await this.generateAlerts(organizationId, currentPeriod);

    return {
      metrics: currentPeriod,
      trends,
      alerts,
      timestamp: new Date(),
    };
  }

  async getCustomerInsights(organizationId: string): Promise<CustomerInsights> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: 'PAID',
        createdAt: { gte: thirtyDaysAgo },
      },
      include: { lineItems: true },
    });

    const customerTotals = new Map<string, { total: number; count: number; lastDate: Date }>();

    for (const invoice of invoices) {
      const customerKey = invoice.clientEmail || invoice.clientName;
      const current = customerTotals.get(customerKey) || {
        total: 0,
        count: 0,
        lastDate: new Date(0),
      };
      current.total += invoice.totalAmount.toNumber();
      current.count++;
      if (invoice.createdAt > current.lastDate) current.lastDate = invoice.createdAt;
      customerTotals.set(customerKey, current);
    }

    const topCustomers = Array.from(customerTotals.entries())
      .map(([name, data]) => ({
        name,
        totalSpent: data.total,
        averageOrderValue: data.total / data.count,
        lastOrderDate: data.lastDate,
        lifetimeValue: data.total,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    const atRiskCustomers = topCustomers
      .filter((c) => {
        const daysSinceLastOrder = Math.floor(
          (Date.now() - c.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        return daysSinceLastOrder > 45;
      })
      .map((c) => ({
        name: c.name,
        daysSinceLastOrder: Math.floor(
          (Date.now() - c.lastOrderDate.getTime()) / (1000 * 60 * 60 * 24),
        ),
        previousAverageOrder: c.averageOrderValue,
      }));

    const uniqueCustomers = new Set(customerTotals.keys());
    const returningCustomers = Array.from(customerTotals.values()).filter(
      (v) => v.count > 1,
    ).length;
    const retentionRate =
      uniqueCustomers.size > 0 ? (returningCustomers / uniqueCustomers.size) * 100 : 0;

    return {
      topCustomers,
      atRiskCustomers,
      newCustomers: uniqueCustomers.size,
      customerRetentionRate: retentionRate,
      customerChurnRate: 100 - retentionRate,
    };
  }

  async getProductInsights(organizationId: string): Promise<ProductInsights> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // FIX: InvoiceLineItem has productId + product relation — include is now valid
    const invoiceLines = await this.prisma.invoiceLineItem.findMany({
      where: {
        invoice: {
          organizationId,
          status: 'PAID',
          createdAt: { gte: thirtyDaysAgo },
        },
      },
      include: { product: true },
    });

    const productSales = new Map<string, { units: number; revenue: number; cost: number }>();

    for (const line of invoiceLines) {
      // FIX: productId is optional on InvoiceLineItem — guard before use
      if (!line.productId || !line.product) continue;
      const current = productSales.get(line.productId) || { units: 0, revenue: 0, cost: 0 };
      // FIX: quantity is Decimal — call .toNumber()
      current.units += line.quantity.toNumber();
      current.revenue += line.total.toNumber();
      // FIX: quantity is Decimal — call .toNumber() before multiplication
      current.cost +=
        line.quantity.toNumber() * (line.product.costPrice?.toNumber() ?? 0);
      productSales.set(line.productId, current);
    }

    const bestSellers = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productName:
          invoiceLines.find((l) => l.productId === productId)?.product?.name ?? 'Unknown',
        unitsSold: data.units,
        revenue: data.revenue,
        profitMargin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // FIX: this.prisma.product is valid — Prisma client is regenerated with Product model
    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true },
    });

    const worstSellers = products
      .filter(
        (p) =>
          p.currentStock > 50 && (!productSales.has(p.id) || productSales.get(p.id)!.units === 0),
      )
      .map((p) => ({
        productName: p.name,
        unitsSold: productSales.get(p.id)?.units ?? 0,
        stockHolding: p.currentStock,
        daysInInventory: 30,
      }))
      .sort((a, b) => b.stockHolding - a.stockHolding)
      .slice(0, 10);

    return {
      bestSellers,
      worstSellers,
      seasonalityPatterns: [],
    };
  }

  private async calculatePeriodMetrics(
    organizationId: string,
    daysAgoStart: number,
    daysAgoEnd: number,
  ): Promise<DashboardMetrics> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - daysAgoStart);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgoEnd);

    const journalEntries = await this.prisma.journalEntry.findMany({
      where: {
        organizationId,
        status: 'POSTED',
        postedAt: { gte: startDate, lte: endDate },
      },
      include: { lines: { include: { account: true } } },
    });

    let revenue = 0;
    let expenses = 0;
    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    for (const entry of journalEntries) {
      for (const line of entry.lines) {
        const amount = line.baseCurrencyDebit.toNumber() - line.baseCurrencyCredit.toNumber();
        const accountType = line.account?.type;

        if (accountType === 'REVENUE') revenue += Math.abs(amount);
        else if (accountType === 'EXPENSE') expenses += Math.abs(amount);
        else if (accountType === 'ASSET') assets += amount;
        else if (accountType === 'LIABILITY') liabilities += amount;
        else if (accountType === 'EQUITY') equity += amount;
      }
    }

    const netProfit = revenue - expenses;
    const grossMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const currentRatio = liabilities > 0 ? assets / liabilities : 0;
    const quickRatio = liabilities > 0 ? (assets * 0.5) / liabilities : 0;
    const debtToEquity = equity > 0 ? liabilities / equity : 0;
    const workingCapital = assets - liabilities;

    return {
      currentRatio,
      quickRatio,
      debtToEquity,
      workingCapital,
      grossMargin,
      netMargin,
      operatingMargin: grossMargin,
      returnOnEquity: equity > 0 ? (netProfit / equity) * 100 : 0,
      inventoryTurnover: 0,
      receivablesTurnover: 0,
      payablesTurnover: 0,
      revenueGrowth: 0,
      profitGrowth: 0,
      operatingCashFlow: netProfit,
      freeCashFlow: netProfit,
      cashConversionCycle: 0,
      // FIX: now valid — DashboardMetrics declares revenue + netProfit
      revenue,
      netProfit,
    };
  }

  private async generateAlerts(
    organizationId: string,
    metrics: DashboardMetrics,
  ): Promise<KpiAlert[]> {
    const alerts: KpiAlert[] = [];

    if (metrics.currentRatio < 1) {
      alerts.push({
        metric: 'Current Ratio',
        severity: 'WARNING',
        message: 'Current ratio is below 1. Business may have liquidity issues.',
        currentValue: metrics.currentRatio,
        threshold: 1,
      });
    }

    if (metrics.netMargin < 5) {
      alerts.push({
        metric: 'Net Margin',
        severity: 'WARNING',
        message: 'Net profit margin is below 5%. Review expenses and pricing.',
        currentValue: metrics.netMargin,
        threshold: 5,
      });
    }

    if (metrics.debtToEquity > 2) {
      alerts.push({
        metric: 'Debt to Equity',
        severity: 'CRITICAL',
        message: 'Debt to equity ratio exceeds 2. High financial risk.',
        currentValue: metrics.debtToEquity,
        threshold: 2,
      });
    }

    // FIX: Can't use prisma.product.fields.minStockLevel as a runtime value in a where clause.
    // Use a raw column reference via Prisma.sql or a self-referencing filter workaround.
    // Correct approach: filter where currentStock < minStockLevel at the DB level using a raw query
    // or by fetching and filtering in JS (safe for small datasets, use raw for large scale).
    const lowStockProducts = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*)::bigint as count
      FROM "Product"
      WHERE "organizationId" = ${organizationId}
        AND "minStockLevel" IS NOT NULL
        AND "currentStock" < "minStockLevel"
    `;
    const lowStockCount = Number(lowStockProducts[0]?.count ?? 0);

    if (lowStockCount > 0) {
      alerts.push({
        metric: 'Inventory',
        severity: 'WARNING',
        message: `${lowStockCount} products are below reorder level.`,
        currentValue: lowStockCount,
        threshold: 0,
      });
    }

    return alerts;
  }

  private calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private getTrend(current: number, previous: number): 'UP' | 'DOWN' | 'STABLE' {
    if (current > previous) return 'UP';
    if (current < previous) return 'DOWN';
    return 'STABLE';
  }
}
