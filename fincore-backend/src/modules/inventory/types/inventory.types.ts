// src/modules/inventory/types/inventory.types.ts

export interface ProductWithStock {
  id: string;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  wholesalePrice: number | null;
  taxRate: number;
  currentStock: number;
  minStockLevel: number | null;
  maxStockLevel: number | null;
  reorderQuantity: number | null;
  trackSerialNumbers: boolean;
  trackBatchNumbers: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockSummaryReport {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  reorderStatus: 'OK' | 'LOW' | 'OVERSTOCK' | 'CRITICAL';
  stockValue: number;
  turnoverRate: number;
  daysInStock: number;
  lastMovementDate: Date | null;
}

export interface StockMovementReport {
  id: string;
  date: Date;
  productCode: string;
  productName: string;
  movementType: string;
  quantity: number;
  reference: string;
  unitPrice: number | null;
  totalValue: number;
  user: string;
  batchNumber: string | null;
}

export interface SlowMovingReport {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  daysSinceLastSale: number;
  monthsOfStock: number;
  estimatedValue: number;
  recommendedAction: 'DISCOUNT' | 'RETURN' | 'WRITE_OFF' | 'MONITOR';
}

export interface StockValuationReport {
  valuationMethod: 'FIFO' | 'WEIGHTED_AVERAGE';
  totalQuantity: number;
  totalValue: number;
  averageCost: number;
  breakdownByBatch: BatchValuation[];
}

export interface BatchValuation {
  batchNumber: string;
  quantity: number;
  costPrice: number;
  totalValue: number;
  expiryDate: Date | null;
  daysUntilExpiry: number | null;
}

export interface ReorderReport {
  productId: string;
  productCode: string;
  productName: string;
  currentStock: number;
  reorderLevel: number;
  reorderQuantity: number;
  leadTimeDays: number;
  suggestedOrderQty: number;
  estimatedCost: number;
  preferredVendor: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ProfitabilityByProduct {
  productId: string;
  productCode: string;
  productName: string;
  unitsSold: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  profitMargin: number;
  contributionToTotal: number;
}

export interface PurchaseOrderWithLines {
  id: string;
  poNumber: string;
  vendorId: string | null;
  vendorName: string;
  status: string;
  orderDate: Date;
  expectedDate: Date | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  receivedBy: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  lines: PurchaseOrderLineWithProduct[];
}

export interface PurchaseOrderLineWithProduct {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  total: number;
}

export interface SaleOrderWithLines {
  id: string;
  soNumber: string;
  customerId: string | null;
  customerName: string;
  status: string;
  orderDate: Date;
  deliveryDate: Date | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  shippedBy: string | null;
  shippedAt: Date | null;
  invoiceId: string | null;
  createdAt: Date;
  lines: SaleOrderLineWithProduct[];
}

export interface SaleOrderLineWithProduct {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  shippedQty: number;
  unitPrice: number;
  total: number;
}
