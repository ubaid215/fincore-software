// src/modules/inventory/inventory.module.ts
import { Module } from '@nestjs/common';
import { InventoryService } from './services/inventory.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { InventoryController } from './controllers/inventory.controller';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, PurchaseOrderService],
  exports: [InventoryService, PurchaseOrderService],
})
export class InventoryModule {}
