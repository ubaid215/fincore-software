// src/modules/inventory/dto/inventory.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  IsEnum,
  IsDateString,
  MinLength,
  MaxLength,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovementType, PurchaseOrderStatus, SaleOrderStatus } from '@prisma/client';

export class CreateProductDto {
  @ApiProperty({ example: 'PRD-001', description: 'Unique product SKU' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  code!: string;

  @ApiPropertyOptional({ example: '8901234567890', description: 'EAN-13 barcode' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  barcode?: string;

  @ApiProperty({ example: 'iPhone 15 Pro' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Latest Apple smartphone' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiProperty({ example: 'pcs', description: 'Unit of measurement' })
  @IsString()
  @MaxLength(20)
  unit!: string;

  @ApiProperty({ example: 250000, description: 'Selling price to customers' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sellingPrice!: number;

  @ApiProperty({ example: 200000, description: 'Cost price from supplier' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice!: number;

  @ApiPropertyOptional({ example: 230000, description: 'Wholesale price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  wholesalePrice?: number;

  @ApiPropertyOptional({ example: 17, description: 'Tax rate percentage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  taxRate?: number;

  @ApiPropertyOptional({ example: 10, description: 'Minimum stock level before reorder' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minStockLevel?: number;

  @ApiPropertyOptional({ example: 100, description: 'Maximum stock level' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxStockLevel?: number;

  @ApiPropertyOptional({ example: 50, description: 'Quantity to reorder' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderQuantity?: number;

  @ApiPropertyOptional({ default: false, description: 'Track serial numbers' })
  @IsOptional()
  @IsBoolean()
  trackSerialNumbers?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Track batch numbers' })
  @IsOptional()
  @IsBoolean()
  trackBatchNumbers?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Track expiry dates' })
  @IsOptional()
  @IsBoolean()
  trackExpiry?: boolean;

  @ApiPropertyOptional({ description: 'Sales revenue account ID' })
  @IsOptional()
  @IsUUID()
  salesAccountId?: string;

  @ApiPropertyOptional({ description: 'COGS account ID' })
  @IsOptional()
  @IsUUID()
  cogsAccountId?: string;

  @ApiPropertyOptional({ description: 'Inventory asset account ID' })
  @IsOptional()
  @IsUUID()
  inventoryAccountId?: string;

  @ApiPropertyOptional({ example: 'https://...', description: 'Product image URL' })
  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sellingPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  costPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minStockLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxStockLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderQuantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AdjustStockDto {
  @ApiProperty({ enum: StockMovementType })
  @IsEnum(StockMovementType)
  movementType!: StockMovementType;

  @ApiProperty({ example: 10, description: 'Quantity (positive for IN, negative for OUT)' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @ApiPropertyOptional({ description: 'Batch number for tracked products' })
  @IsOptional()
  @IsString()
  batchNumber?: string;

  @ApiPropertyOptional({ description: 'Serial number for tracked products' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  // FIX: inventory.service.ts uses dto.expiryDate when creating an InventoryBatch.
  // This field was missing from AdjustStockDto — it only existed on ReceiveLineDto.
  @ApiPropertyOptional({ description: 'Expiry date for batch-tracked products (ISO date string)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Reference document ID (PO, Invoice, etc.)' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional({ description: 'Reference document type' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 200000, description: 'Unit price for this movement' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;

  @ApiPropertyOptional({ example: 'Stock adjustment for damage' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ example: 'Vendor Name' })
  @IsString()
  vendorName!: string;

  @ApiPropertyOptional({ description: 'Vendor contact ID' })
  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @ApiPropertyOptional({ example: '2025-04-15' })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  lines?: PurchaseOrderLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PurchaseOrderLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;
}

export class ReceivePurchaseOrderDto {
  @IsUUID()
  purchaseOrderId!: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  receipts!: ReceiveLineDto[];
}

export class ReceiveLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class CreateSaleOrderDto {
  @ApiProperty({ example: 'Customer Name' })
  @IsString()
  customerName!: string;

  @ApiPropertyOptional({ description: 'Customer contact ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: '2025-04-20' })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  lines!: SaleOrderLineDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SaleOrderLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;
}

export class ShipSaleOrderDto {
  @IsUUID()
  saleOrderId!: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  shipments!: ShipmentLineDto[];
}

export class ShipmentLineDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;
}

export class StockQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

export class StockReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}
