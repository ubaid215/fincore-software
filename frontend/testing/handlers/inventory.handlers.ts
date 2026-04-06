import { http, HttpResponse } from 'msw'
import { env } from '@/config/app.config'

const API_URL = env.apiUrl

const mockProducts = [
  {
    id: 'prod-1',
    sku: 'PROD-001',
    name: 'Laptop Pro',
    description: 'High-performance laptop',
    category: 'electronics',
    unit: 'EA',
    unitPrice: 1299.99,
    costPrice: 999.99,
    currentStock: 15,
    minStockLevel: 5,
    maxStockLevel: 50,
    location: 'Warehouse A',
    isActive: true,
    organizationId: 'org-456',
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-10T10:00:00Z',
  },
  {
    id: 'prod-2',
    sku: 'PROD-002',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse',
    category: 'accessories',
    unit: 'EA',
    unitPrice: 49.99,
    costPrice: 25.99,
    currentStock: 3,
    minStockLevel: 10,
    maxStockLevel: 100,
    location: 'Warehouse B',
    isActive: true,
    organizationId: 'org-456',
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-10T10:00:00Z',
  },
]

export const inventoryHandlers = [
  http.get(`${API_URL}/organizations/:orgId/inventory/products`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedData = mockProducts.slice(start, end)
    
    return HttpResponse.json({
      data: paginatedData,
      meta: {
        page,
        limit,
        total: mockProducts.length,
        totalPages: Math.ceil(mockProducts.length / limit),
        hasNextPage: end < mockProducts.length,
        hasPrevPage: page > 1,
      },
    })
  }),

  http.get(`${API_URL}/organizations/:orgId/inventory/products/:id`, ({ params }) => {
    const { id } = params
    const product = mockProducts.find(p => p.id === id)
    
    if (!product) {
      return HttpResponse.json(
        { message: 'Product not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    return HttpResponse.json(product)
  }),

  http.get(`${API_URL}/organizations/:orgId/inventory/low-stock`, () => {
    const lowStockProducts = mockProducts.filter(p => p.currentStock <= p.minStockLevel)
    return HttpResponse.json(lowStockProducts)
  }),

  http.get(`${API_URL}/organizations/:orgId/inventory/summary`, () => {
    return HttpResponse.json({
      totalProducts: mockProducts.length,
      totalValue: mockProducts.reduce((sum, p) => sum + p.currentStock * p.unitPrice, 0),
      lowStockCount: mockProducts.filter(p => p.currentStock <= p.minStockLevel).length,
      outOfStockCount: mockProducts.filter(p => p.currentStock === 0).length,
    })
  }),
]