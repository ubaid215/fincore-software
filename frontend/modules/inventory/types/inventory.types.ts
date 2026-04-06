import type { ID, Timestamps } from '@/shared/types'

export type ProductUnit = 'EA' | 'KG' | 'L' | 'BOX' | 'PACK' | 'SET'

export type MovementType = 'IN' | 'OUT' | 'ADJUST'

export interface Product extends Timestamps {
  id: ID
  sku: string
  name: string
  description?: string
  category: string
  unit: ProductUnit
  unitPrice: number
  costPrice: number
  currentStock: number
  minStockLevel: number
  maxStockLevel?: number
  location?: string
  isActive: boolean
  organizationId: ID
  imageUrl?: string
  createdAt: string
  updatedAt: string
}

export interface StockMovement {
  id: ID
  productId: ID
  productName: string
  productSku: string
  type: MovementType
  quantity: number
  previousStock: number
  newStock: number
  reference?: string
  notes?: string
  userId: ID
  userName: string
  createdAt: string
}

export interface CreateProductRequest {
  sku: string
  name: string
  description?: string
  category: string
  unit: ProductUnit
  unitPrice: number
  costPrice: number
  currentStock?: number
  minStockLevel: number
  maxStockLevel?: number
  location?: string
  imageUrl?: string
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
  id: ID
}

export interface AdjustStockRequest {
  productId: ID
  quantity: number
  type: MovementType
  reference?: string
  notes?: string
}

export interface ProductFilters {
  category?: string
  search?: string
  lowStock?: boolean
  isActive?: boolean
  page?: number
  limit?: number
}