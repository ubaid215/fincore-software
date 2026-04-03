// src/modules/inventory/services/purchase-order.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PurchaseOrderStatus } from '@prisma/client';
import { CreatePurchaseOrderDto, ReceivePurchaseOrderDto } from '../dto/inventory.dto';
import { PurchaseOrderWithLines } from '../types/inventory.types';

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(private prisma: PrismaService) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreatePurchaseOrderDto,
  ): Promise<PurchaseOrderWithLines> {
    const poNumber = await this.generatePONumber(organizationId);

    let subtotal = 0;
    const lines = dto.lines || [];

    for (const line of lines) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, organizationId },
      });
      if (!product) {
        throw new NotFoundException(`Product ${line.productId} not found`);
      }
      const total = line.quantity * line.unitPrice;
      subtotal += total;
    }

    const taxAmount = subtotal * 0.17; // 17% GST
    const totalAmount = subtotal + taxAmount;

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        organizationId,
        poNumber,
        vendorName: dto.vendorName,
        vendorId: dto.vendorId,
        status: PurchaseOrderStatus.DRAFT,
        orderDate: new Date(),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        subtotal,
        taxAmount,
        totalAmount,
        notes: dto.notes,
      },
    });

    for (const line of lines) {
      const product = await this.prisma.product.findFirst({
        where: { id: line.productId, organizationId },
      });
      if (!product) continue;

      await this.prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          productId: line.productId,
          productCode: product.code,
          productName: product.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.quantity * line.unitPrice,
        },
      });
    }

    this.logger.log(`Purchase Order created: ${poNumber}`);
    return this.findOne(organizationId, purchaseOrder.id);
  }

  async receive(organizationId: string, userId: string, dto: ReceivePurchaseOrderDto) {
    const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, organizationId },
      include: { lines: true },
    });

    if (!purchaseOrder) {
      throw new NotFoundException(`Purchase order ${dto.purchaseOrderId} not found`);
    }

    if (purchaseOrder.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException('Purchase order already fully received');
    }

    // Update received quantities
    for (const receipt of dto.receipts) {
      const line = purchaseOrder.lines.find((l) => l.productId === receipt.productId);
      if (!line) continue;

      const newReceivedQty = line.receivedQty + receipt.quantity;
      await this.prisma.purchaseOrderLine.update({
        where: { id: line.id },
        data: { receivedQty: newReceivedQty },
      });
    }

    // Check if all lines are fully received
    const updatedLines = await this.prisma.purchaseOrderLine.findMany({
      where: { purchaseOrderId: purchaseOrder.id },
    });

    const allReceived = updatedLines.every((line) => line.receivedQty >= line.quantity);
    const partialReceived = updatedLines.some(
      (line) => line.receivedQty > 0 && line.receivedQty < line.quantity,
    );

    const newStatus = allReceived
      ? PurchaseOrderStatus.RECEIVED
      : partialReceived
        ? PurchaseOrderStatus.PARTIALLY_RECEIVED
        : PurchaseOrderStatus.SENT;

    await this.prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        status: newStatus,
        receivedAt: allReceived ? new Date() : undefined,
        receivedBy: allReceived ? userId : undefined,
      },
    });

    this.logger.log(`Purchase Order received: ${purchaseOrder.poNumber}`);
    return this.findOne(organizationId, purchaseOrder.id);
  }

  async findOne(organizationId: string, id: string): Promise<PurchaseOrderWithLines> {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: { product: true },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase order ${id} not found`);
    }

    return {
      ...po,
      subtotal: po.subtotal.toNumber(),
      taxAmount: po.taxAmount.toNumber(),
      totalAmount: po.totalAmount.toNumber(),
      lines: po.lines.map((line) => ({
        id: line.id,
        productId: line.productId,
        productCode: line.productCode,
        productName: line.productName,
        quantity: line.quantity,
        receivedQty: line.receivedQty,
        unitPrice: line.unitPrice.toNumber(),
        total: line.total.toNumber(),
      })),
    };
  }

  async findAll(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseOrder.count({ where: { organizationId } }),
    ]);

    return {
      data: data.map((po) => ({
        ...po,
        subtotal: po.subtotal.toNumber(),
        taxAmount: po.taxAmount.toNumber(),
        totalAmount: po.totalAmount.toNumber(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async generatePONumber(organizationId: string): Promise<string> {
    const count = await this.prisma.purchaseOrder.count({ where: { organizationId } });
    const year = new Date().getFullYear();
    return `PO-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
