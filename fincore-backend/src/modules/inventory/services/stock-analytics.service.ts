// src/modules/inventory/services/stock-analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma } from '@prisma/client';
import {
  StockSummaryReport,
  SlowMovingReport,
  ReorderReport,
} from '../types/inventory.types';

// Prisma-generated type helpers
type ProductRow = Prisma.ProductGetPayload<Record<string, never>>;
type StockMovementRow = Prisma.StockMovementGetPayload<Record<string, never>>;

@Injectable()
export class StockAnalyticsService {
  constructor(private prisma: PrismaService) {}

  // FIX: return type now resolved — StockSummaryReport is imported from inventory.types.ts
  async getStockSummary(organizationId: string): Promise<StockSummaryReport[]> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: {
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    return products.map((product) => {
      const dailySales = this.calculateDailySales(product.stockMovements);
      const turnoverRate = this.calculateTurnoverRate(product.currentStock, dailySales);

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        currentStock: product.currentStock,
        minStockLevel: product.minStockLevel ?? 0,
        maxStockLevel: product.maxStockLevel ?? null,
        reorderStatus: this.getReorderStatus(product),
        // FIX: costPrice is Decimal — call .toNumber()
        stockValue: product.currentStock * product.costPrice.toNumber(),
        turnoverRate,
        daysInStock: turnoverRate > 0 ? 365 / turnoverRate : 0,
        lastMovementDate: product.stockMovements[0]?.createdAt ?? null,
      };
    });
  }

  // FIX: return type now resolved — SlowMovingReport is imported from inventory.types.ts
  async getSlowMovingStock(
    organizationId: string,
    daysThreshold = 90,
  ): Promise<SlowMovingReport[]> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: {
        stockMovements: {
          where: { movementType: 'SALE_OUT' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = new Date();
    // FIX: typed array — no implicit any
    const results: SlowMovingReport[] = [];

    for (const product of products) {
      const lastSale = product.stockMovements[0];
      const daysSinceLastSale = lastSale
        ? Math.floor((now.getTime() - lastSale.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastSale >= daysThreshold && product.currentStock > 0) {
        const monthlySales = this.calculateMonthlySales(product.stockMovements);
        const monthsOfStock = monthlySales > 0 ? product.currentStock / monthlySales : 999;

        results.push({
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          currentStock: product.currentStock,
          daysSinceLastSale,
          monthsOfStock,
          // FIX: costPrice is Decimal — call .toNumber()
          estimatedValue: product.currentStock * product.costPrice.toNumber(),
          recommendedAction: this.getRecommendedAction(monthsOfStock, daysSinceLastSale),
        });
      }
    }

    return results.sort((a, b) => b.daysSinceLastSale - a.daysSinceLastSale);
  }

  // FIX: return type now resolved — ReorderReport is imported from inventory.types.ts
  // FIX: prisma.product.fields.minStockLevel is a FieldRef, NOT usable as a runtime where value.
  // Use $queryRaw to do a column-to-column comparison.
  async getReorderReport(organizationId: string): Promise<ReorderReport[]> {
    const products = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT * FROM "Product"
      WHERE "organizationId" = ${organizationId}
        AND "isActive" = true
        AND "minStockLevel" IS NOT NULL
        AND "currentStock" < "minStockLevel"
    `;

    return products.map((product) => {
      const avgDailySales = this.calculateAverageDailySales(product.id);
      const leadTimeDays = 7;
      const safetyStock = avgDailySales * leadTimeDays * 1.5;
      const suggestedOrderQty = Math.max(
        Number(product.reorderQuantity ?? 0),
        avgDailySales * leadTimeDays * 2 - product.currentStock + safetyStock,
      );

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        currentStock: product.currentStock,
        reorderLevel: product.minStockLevel ?? 0,
        reorderQuantity: product.reorderQuantity ?? 0,
        leadTimeDays,
        suggestedOrderQty: Math.ceil(suggestedOrderQty),
        // FIX: costPrice from $queryRaw is a plain number — wrap in Number() to be safe
        estimatedCost: Math.ceil(suggestedOrderQty) * Number(product.costPrice),
        preferredVendor: 'Default Supplier',
        urgency: this.getUrgency(product),
      };
    });
  }

  async getProfitabilityByProduct(organizationId: string, startDate: Date, endDate: Date) {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        organizationId,
        status: 'PAID',
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        // FIX: product relation now exists on InvoiceLineItem — include is valid
        lineItems: { include: { product: true } },
      },
    });

    const productProfit: Map<string, { revenue: number; cost: number; units: number }> = new Map();

    for (const invoice of invoices) {
      for (const item of invoice.lineItems) {
        // FIX: productId is optional — guard before use
        if (!item.productId) continue;

        const current = productProfit.get(item.productId) || { revenue: 0, cost: 0, units: 0 };
        // FIX: quantity and unitPrice are Decimal — call .toNumber()
        const revenue = item.quantity.toNumber() * item.unitPrice.toNumber();
        const cost =
          item.quantity.toNumber() * (item.product?.costPrice.toNumber() ?? 0);

        productProfit.set(item.productId, {
          revenue: current.revenue + revenue,
          cost: current.cost + cost,
          units: current.units + item.quantity.toNumber(),
        });
      }
    }

    const totalProfit = Array.from(productProfit.values()).reduce(
      (sum, p) => sum + (p.revenue - p.cost),
      0,
    );

    const results = [];
    for (const [productId, data] of productProfit) {
      // FIX: this.prisma.product is valid after prisma generate
      const product = await this.prisma.product.findUnique({ where: { id: productId } });
      const grossProfit = data.revenue - data.cost;

      results.push({
        productCode: product?.code,
        productName: product?.name,
        unitsSold: data.units,
        totalRevenue: data.revenue,
        totalCost: data.cost,
        grossProfit,
        profitMargin: data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0,
        contributionToTotal: totalProfit > 0 ? (grossProfit / totalProfit) * 100 : 0,
      });
    }

    return results.sort((a, b) => b.grossProfit - a.grossProfit);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  // FIX: typed parameter — no implicit any
  private getReorderStatus(product: ProductRow): 'OK' | 'LOW' | 'OVERSTOCK' | 'CRITICAL' {
    if (product.currentStock <= 0) return 'CRITICAL';
    if (product.currentStock <= (product.minStockLevel ?? 0)) return 'LOW';
    if (product.maxStockLevel && product.currentStock >= product.maxStockLevel) return 'OVERSTOCK';
    return 'OK';
  }

  private getUrgency(product: ProductRow): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (product.currentStock <= 0) return 'CRITICAL';
    if (product.currentStock <= (product.minStockLevel ?? 0) / 2) return 'HIGH';
    if (product.currentStock <= (product.minStockLevel ?? 0)) return 'MEDIUM';
    return 'LOW';
  }

  private calculateTurnoverRate(currentStock: number, dailySales: number): number {
    if (dailySales === 0) return 0;
    return currentStock / dailySales;
  }

  private calculateAverageDailySales(_productId: string): number {
    // TODO: Query last 30 days of sales from stockMovements
    return 10;
  }

  // FIX: typed parameter — no implicit any
  private calculateDailySales(movements: StockMovementRow[]): number {
    if (movements.length === 0) return 0;
    const totalSales = movements.reduce((sum, m) => sum + m.quantity, 0);
    return totalSales / 30;
  }

  // FIX: typed parameter — no implicit any
  private calculateMonthlySales(movements: StockMovementRow[]): number {
    return movements.length > 0 ? movements.length / 3 : 0;
  }

  private getRecommendedAction(
    monthsOfStock: number,
    daysSinceLastSale: number,
  ): 'DISCOUNT' | 'RETURN' | 'WRITE_OFF' | 'MONITOR' {
    if (monthsOfStock > 12) return 'WRITE_OFF';
    if (monthsOfStock > 6) return 'DISCOUNT';
    if (daysSinceLastSale > 180) return 'RETURN';
    return 'MONITOR';
  }
}
