
## File 9: `docs/modules/INVENTORY.md`

```markdown
# Inventory Management Module

## Overview

Complete inventory management with product master, stock tracking, purchase orders, and sales orders.

## Features

- Product master with SKU, barcode, pricing
- Stock movement tracking (IN/OUT)
- Batch and serial number tracking
- Purchase Orders (procurement)
- Sales Orders (customer orders)
- Stock reports (summary, slow-moving, reorder)
- Real-time stock updates

## API Endpoints

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/inventory/products` | Create product |
| GET | `/v1/inventory/products` | List products |
| GET | `/v1/inventory/products/:id` | Get product |
| PATCH | `/v1/inventory/products/:id` | Update product |
| DELETE | `/v1/inventory/products/:id` | Delete product |

### Stock Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/inventory/products/:id/adjust-stock` | Adjust stock |
| GET | `/v1/inventory/stock-movements` | Movement history |

### Stock Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/inventory/reports/summary` | Stock summary |
| GET | `/v1/inventory/reports/slow-moving` | Slow-moving items |
| GET | `/v1/inventory/reports/reorder` | Reorder report |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/inventory/purchase-orders` | Create PO |
| POST | `/v1/inventory/purchase-orders/receive` | Receive PO |
| GET | `/v1/inventory/purchase-orders` | List POs |

## Stock Movement Types

| Type | Effect | Use Case |
|------|--------|----------|
| PURCHASE_IN | +Stock | Receiving from supplier |
| SALE_OUT | -Stock | Selling to customer |
| ADJUSTMENT_IN | +Stock | Count adjustment |
| ADJUSTMENT_OUT | -Stock | Damage/loss |
| RETURN_IN | +Stock | Customer return |
| RETURN_OUT | -Stock | Return to supplier |

## Example Workflow

```bash
# 1. Create product
POST /v1/inventory/products
{
  "code": "LAPTOP-001",
  "name": "Gaming Laptop",
  "unit": "pcs",
  "sellingPrice": 250000,
  "costPrice": 200000,
  "minStockLevel": 5,
  "reorderQuantity": 10
}

# 2. Purchase stock
POST /v1/inventory/products/LAPTOP-001/adjust-stock
{
  "movementType": "PURCHASE_IN",
  "quantity": 50,
  "unitPrice": 200000
}

# 3. Check stock
GET /v1/inventory/reports/summary

# 4. Create purchase order (low stock)
POST /v1/inventory/purchase-orders
{
  "vendorName": "Tech Distributors",
  "lines": [
    { "productId": "LAPTOP-001", "quantity": 20, "unitPrice": 195000 }
  ]
}

# 5. Receive purchase order
POST /v1/inventory/purchase-orders/receive
{
  "purchaseOrderId": "po-123",
  "receipts": [
    { "productId": "LAPTOP-001", "quantity": 20 }
  ]
}

Stock Reports
Summary Report
Shows current stock levels, reorder status, and stock value.

Slow-Moving Report
Identifies products with no sales for >90 days.

Reorder Report
Products below minimum stock level with suggested order quantities.