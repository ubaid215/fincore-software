// src/modules/inventory/services/inventory.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, StockMovementType, PurchaseOrderStatus, SaleOrderStatus } from '@prisma/client';
import { CreateProductDto, UpdateProductDto, AdjustStockDto } from '../dto/inventory.dto';
import { ProductWithStock, StockSummaryReport } from '../types/inventory.types';
import { buildPaginatedResult } from '../../../common/utils/pagination.util';

// Prisma-generated type for a Product row
type ProductRow = Prisma.ProductGetPayload<Record<string, never>>;

// Prisma-generated type for a StockMovement row
type StockMovementRow = Prisma.StockMovementGetPayload<Record<string, never>>;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Product CRUD ─────────────────────────────────────────────────────────

  async createProduct(organizationId: string, dto: CreateProductDto): Promise<ProductWithStock> {
    const existing = await this.prisma.product.findUnique({
      where: { organizationId_code: { organizationId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Product with code ${dto.code} already exists`);
    }

    if (dto.barcode) {
      const existingBarcode = await this.prisma.product.findUnique({
        where: { organizationId_barcode: { organizationId, barcode: dto.barcode } },
      });
      if (existingBarcode) {
        throw new ConflictException(`Product with barcode ${dto.barcode} already exists`);
      }
    }

    const product = await this.prisma.product.create({
      data: {
        organizationId,
        code: dto.code,
        barcode: dto.barcode,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        brand: dto.brand,
        unit: dto.unit,
        sellingPrice: dto.sellingPrice,
        costPrice: dto.costPrice,
        wholesalePrice: dto.wholesalePrice,
        taxRate: dto.taxRate ?? 0,
        minStockLevel: dto.minStockLevel,
        maxStockLevel: dto.maxStockLevel,
        reorderQuantity: dto.reorderQuantity,
        trackSerialNumbers: dto.trackSerialNumbers ?? false,
        trackBatchNumbers: dto.trackBatchNumbers ?? false,
        trackExpiry: dto.trackExpiry ?? false,
        salesAccountId: dto.salesAccountId,
        cogsAccountId: dto.cogsAccountId,
        inventoryAccountId: dto.inventoryAccountId,
        imageUrl: dto.imageUrl,
      },
    });

    this.logger.log(`Product created: ${product.code} - ${product.name}`);
    return this.toProductWithStock(product);
  }

  async updateProduct(
    organizationId: string,
    productId: string,
    dto: UpdateProductDto,
  ): Promise<ProductWithStock> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const updated = await this.prisma.product.update({
      where: { id: productId },
      data: dto,
    });

    return this.toProductWithStock(updated);
  }

  async getProduct(organizationId: string, productId: string): Promise<ProductWithStock> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return this.toProductWithStock(product);
  }

  async getProducts(
    organizationId: string,
    options: { category?: string; search?: string; page?: number; limit?: number },
  ) {
    const { category, search, page = 1, limit = 20 } = options;

    // FIX: Prisma.ProductWhereInput is available after `npx prisma generate` with inventory models
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(category ? { category } : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { name: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    // FIX: explicit type on the map parameter — no implicit any
    const productsWithStock = data.map((p: ProductRow) => this.toProductWithStock(p));
    return buildPaginatedResult(productsWithStock, total, page, limit);
  }

  async deleteProduct(organizationId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      include: { stockMovements: { take: 1 } },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    if (product.stockMovements.length > 0) {
      throw new BadRequestException(
        'Cannot delete product with stock movements. Archive it instead.',
      );
    }
    await this.prisma.product.delete({ where: { id: productId } });
    this.logger.log(`Product deleted: ${product.code}`);
  }

  // ─── Stock Management ─────────────────────────────────────────────────────

  async adjustStock(
    organizationId: string,
    productId: string,
    userId: string,
    dto: AdjustStockDto,
  ): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const isInflow = ['PURCHASE_IN', 'ADJUSTMENT_IN', 'RETURN_IN', 'TRANSFER_IN'].includes(
      dto.movementType,
    );
    const quantityChange = isInflow ? dto.quantity : -dto.quantity;
    const newStock = product.currentStock + quantityChange;

    if (newStock < 0) {
      throw new BadRequestException(`Insufficient stock. Current: ${product.currentStock}`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      let batchId: string | undefined;
      if (product.trackBatchNumbers && dto.batchNumber) {
        let batch = await tx.inventoryBatch.findFirst({
          where: { organizationId, productId, batchNumber: dto.batchNumber },
        });
        if (!batch && isInflow) {
          batch = await tx.inventoryBatch.create({
            data: {
              organizationId,
              productId,
              batchNumber: dto.batchNumber,
              serialNumber: dto.serialNumber,
              quantity: dto.quantity,
              remainingQty: dto.quantity,
              costPrice: dto.unitPrice ?? product.costPrice,
              purchaseDate: new Date(),
              // FIX: dto.expiryDate now exists on AdjustStockDto — no more TS2339
              expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
            },
          });
        }
        batchId = batch?.id;
      }

      await tx.stockMovement.create({
        data: {
          organizationId,
          productId,
          batchId,
          movementType: dto.movementType,
          quantity: dto.quantity,
          referenceId: dto.referenceId,
          referenceType: dto.referenceType,
          unitPrice: dto.unitPrice,
          notes: dto.notes,
          createdBy: userId,
        },
      });
    });

    this.logger.log(
      `Stock adjusted for ${product.code}: ${quantityChange > 0 ? '+' : ''}${quantityChange}`,
    );
  }

  async getStockMovements(
    organizationId: string,
    productId?: string,
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 50,
  ) {
    // FIX: Prisma.StockMovementWhereInput — available after prisma generate
    const where: Prisma.StockMovementWhereInput = {
      organizationId,
      ...(productId ? { productId } : {}),
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
      ...(endDate ? { createdAt: { lte: endDate } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { code: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    // FIX: explicit typed parameter — no implicit any
    const movements = data.map((m: typeof data[number]) => ({
      id: m.id,
      date: m.createdAt,
      productCode: m.product.code,
      productName: m.product.name,
      movementType: m.movementType,
      quantity: m.quantity,
      reference: m.referenceId ?? '',
      unitPrice: m.unitPrice?.toNumber() ?? null,
      totalValue: (m.unitPrice?.toNumber() ?? 0) * m.quantity,
      user: m.createdBy,
      batchNumber: null,
    }));

    return buildPaginatedResult(movements, total, page, limit);
  }

  // ─── Stock Reports ────────────────────────────────────────────────────────

  async getStockSummary(organizationId: string): Promise<StockSummaryReport[]> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: {
        stockMovements: {
          where: { movementType: 'SALE_OUT' },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });

    return products.map((product) => {
      const lastSale = product.stockMovements[0];
      const dailySales = this.calculateDailySales(product.stockMovements);
      const turnoverRate = dailySales > 0 ? product.currentStock / dailySales : 0;

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        currentStock: product.currentStock,
        minStockLevel: product.minStockLevel ?? 0,
        maxStockLevel: product.maxStockLevel ?? null,
        reorderStatus: this.getReorderStatus(product),
        // FIX: costPrice is Decimal — call .toNumber() before multiplication
        stockValue: product.currentStock * product.costPrice.toNumber(),
        turnoverRate,
        daysInStock: turnoverRate > 0 ? 365 / turnoverRate : 0,
        lastMovementDate: lastSale?.createdAt ?? null,
      };
    });
  }

  async getSlowMovingStock(organizationId: string, daysThreshold: number = 90): Promise<any[]> {
    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true, currentStock: { gt: 0 } },
      include: {
        stockMovements: {
          where: { movementType: 'SALE_OUT' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const now = new Date();
    const results = [];

    for (const product of products) {
      const lastSale = product.stockMovements[0];
      const daysSinceLastSale = lastSale
        ? Math.floor((now.getTime() - lastSale.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSinceLastSale >= daysThreshold) {
        const monthlySales = product.stockMovements.length / 3;
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

  async getReorderReport(organizationId: string): Promise<any[]> {
    // FIX: prisma.product.fields.minStockLevel is a FieldRef, NOT a runtime number.
    // It cannot be used as a filter value in a where clause. Use $queryRaw to compare
    // two columns, or fetch and filter in JS. Raw SQL is the correct approach here.
    const products = await this.prisma.$queryRaw<ProductRow[]>`
      SELECT * FROM "Product"
      WHERE "organizationId" = ${organizationId}
        AND "isActive" = true
        AND "minStockLevel" IS NOT NULL
        AND "currentStock" < "minStockLevel"
    `;

    return products.map((product) => {
      const avgDailySales = 10; // TODO: Calculate from actual sales
      const leadTimeDays = 7;
      const safetyStock = avgDailySales * leadTimeDays * 1.5;
      const suggestedOrderQty = Math.max(
        Number(product.reorderQuantity ?? 0),
        avgDailySales * leadTimeDays * 2 - product.currentStock + safetyStock,
      );

      let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
      if (product.currentStock <= 0) urgency = 'CRITICAL';
      else if (product.currentStock <= (product.minStockLevel ?? 0) / 2) urgency = 'HIGH';
      else if (product.currentStock <= (product.minStockLevel ?? 0)) urgency = 'MEDIUM';
      else urgency = 'LOW';

      return {
        productId: product.id,
        productCode: product.code,
        productName: product.name,
        currentStock: product.currentStock,
        reorderLevel: product.minStockLevel ?? 0,
        reorderQuantity: product.reorderQuantity ?? 0,
        leadTimeDays,
        suggestedOrderQty: Math.ceil(suggestedOrderQty),
        // FIX: costPrice from raw query is a plain number (not Decimal object)
        estimatedCost: Math.ceil(suggestedOrderQty) * Number(product.costPrice),
        preferredVendor: 'Default Supplier',
        urgency,
      };
    });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  // FIX: typed parameter — no implicit any
  private toProductWithStock(product: ProductRow): ProductWithStock {
    return {
      ...product,
      sellingPrice: product.sellingPrice.toNumber(),
      costPrice: product.costPrice.toNumber(),
      wholesalePrice: product.wholesalePrice?.toNumber() ?? null,
      taxRate: product.taxRate.toNumber(),
      currentStock: product.currentStock,
    };
  }

  // FIX: typed parameter — no implicit any
  private getReorderStatus(product: ProductRow): 'OK' | 'LOW' | 'OVERSTOCK' | 'CRITICAL' {
    if (product.currentStock <= 0) return 'CRITICAL';
    if (product.minStockLevel && product.currentStock <= product.minStockLevel) return 'LOW';
    if (product.maxStockLevel && product.currentStock >= product.maxStockLevel) return 'OVERSTOCK';
    return 'OK';
  }

  // FIX: typed parameter — no implicit any
  private calculateDailySales(movements: StockMovementRow[]): number {
    if (movements.length === 0) return 0;
    const totalSales = movements.reduce((sum, m) => sum + m.quantity, 0);
    return totalSales / 30;
  }

  private getRecommendedAction(monthsOfStock: number, daysSinceLastSale: number): string {
    if (monthsOfStock > 12) return 'WRITE_OFF';
    if (monthsOfStock > 6) return 'DISCOUNT';
    if (daysSinceLastSale > 180) return 'RETURN';
    return 'MONITOR';
  }
}
