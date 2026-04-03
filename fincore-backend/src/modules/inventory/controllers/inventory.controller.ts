// src/modules/inventory/controllers/inventory.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { InventoryService } from '../services/inventory.service';
import { PurchaseOrderService } from '../services/purchase-order.service';
import {
  CreateProductDto,
  UpdateProductDto,
  AdjustStockDto,
  StockQueryDto,
  StockReportQueryDto,
  CreatePurchaseOrderDto,
  ReceivePurchaseOrderDto,
} from '../dto/inventory.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { OrgId } from '../../../common/decorators/organization.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../../common/types/jwt-payload.type';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(
    private inventoryService: InventoryService,
    private purchaseOrderService: PurchaseOrderService,
  ) {}

  // ─── Products ─────────────────────────────────────────────────────────────

  @Post('products')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Create a new product' })
  createProduct(@OrgId() orgId: string, @Body() dto: CreateProductDto) {
    return this.inventoryService.createProduct(orgId, dto);
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products' })
  getProducts(@OrgId() orgId: string, @Query() query: StockQueryDto) {
    return this.inventoryService.getProducts(orgId, query);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  getProduct(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getProduct(orgId, id);
  }

  @Patch('products/:id')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Update product' })
  updateProduct(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.inventoryService.updateProduct(orgId, id, dto);
  }

  @Delete('products/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete product (only if no transactions)' })
  deleteProduct(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.deleteProduct(orgId, id);
  }

  // ─── Stock Management ─────────────────────────────────────────────────────

  @Post('products/:id/adjust-stock')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Adjust stock level' })
  adjustStock(
    @OrgId() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(orgId, id, user.sub, dto);
  }

  @Get('stock-movements')
  @ApiOperation({ summary: 'Get stock movement history' })
  getStockMovements(
    @OrgId() orgId: string,
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.getStockMovements(
      orgId,
      productId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      page,
      limit,
    );
  }

  // ─── Stock Reports ────────────────────────────────────────────────────────

  @Get('reports/summary')
  @ApiOperation({ summary: 'Get stock summary report' })
  getStockSummary(@OrgId() orgId: string) {
    return this.inventoryService.getStockSummary(orgId);
  }

  @Get('reports/slow-moving')
  @ApiOperation({ summary: 'Get slow-moving stock report' })
  getSlowMovingStock(@OrgId() orgId: string, @Query('daysThreshold') daysThreshold?: number) {
    return this.inventoryService.getSlowMovingStock(orgId, daysThreshold ?? 90);
  }

  @Get('reports/reorder')
  @ApiOperation({ summary: 'Get reorder report' })
  getReorderReport(@OrgId() orgId: string) {
    return this.inventoryService.getReorderReport(orgId);
  }

  // ─── Purchase Orders ──────────────────────────────────────────────────────

  @Post('purchase-orders')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Create purchase order' })
  createPurchaseOrder(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrderService.create(orgId, user.sub, dto);
  }

  @Post('purchase-orders/receive')
  @Roles(UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Receive purchase order' })
  receivePurchaseOrder(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrderService.receive(orgId, user.sub, dto);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Get all purchase orders' })
  getPurchaseOrders(
    @OrgId() orgId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.purchaseOrderService.findAll(orgId, page, limit);
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get purchase order by ID' })
  getPurchaseOrder(@OrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrderService.findOne(orgId, id);
  }
}
