import { apiClient } from '@/shared/lib/api-client'
import type {
  Product,
  StockMovement,
  CreateProductRequest,
  UpdateProductRequest,
  AdjustStockRequest,
  ProductFilters,
} from '../types/inventory.types'
import type { PaginatedResponse } from '@/shared/types'

export const inventoryApi = {
  // Products
  listProducts: (orgId: string, filters?: ProductFilters) =>
    apiClient.get<PaginatedResponse<Product>>(`/v1/inventory/products`, {
      params: filters,
    }),

  getProduct: (orgId: string, id: string) =>
    apiClient.get<Product>(`/v1/inventory/products/${id}`),

  createProduct: (orgId: string, data: CreateProductRequest) =>
    apiClient.post<Product>(`/v1/inventory/products`, data),

  updateProduct: (orgId: string, id: string, data: UpdateProductRequest) =>
    apiClient.patch<Product>(`/v1/inventory/products/${id}`, data),

  deleteProduct: (orgId: string, id: string) =>
    apiClient.delete(`/v1/inventory/products/${id}`),

  // Stock Movements
  getStockMovements: (orgId: string, productId: string, page?: number, limit?: number) =>
    apiClient.get<PaginatedResponse<StockMovement>>(
      `/v1/inventory/products/${productId}/movements`,
      { params: { page, limit } }
    ),

  adjustStock: (orgId: string, data: AdjustStockRequest) =>
    apiClient.post<StockMovement>(`/v1/inventory/stock/adjust`, data),

  // Dashboard
  getLowStockProducts: (orgId: string) =>
    apiClient.get<Product[]>(`/v1/inventory/low-stock`),

  getStockSummary: (orgId: string) =>
    apiClient.get<{
      totalProducts: number
      totalValue: number
      lowStockCount: number
      outOfStockCount: number
    }>(`/v1/inventory/summary`),
}