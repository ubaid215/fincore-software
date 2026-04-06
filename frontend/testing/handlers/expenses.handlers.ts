import { http, HttpResponse } from 'msw'
import { env } from '@/config/app.config'

const API_URL = env.apiUrl

const mockExpenses = [
  {
    id: 'exp-1',
    expenseNumber: 'EXP-000001',
    organizationId: 'org-456',
    userId: 'user-123',
    userName: 'John Doe',
    category: 'travel',
    description: 'Flight to NYC',
    expenseDate: '2025-01-10T00:00:00Z',
    amount: 500,
    taxRate: 0,
    total: 500,
    status: 'POSTED',
    currency: 'USD',
    notes: null,
    createdAt: '2025-01-10T10:00:00Z',
    updatedAt: '2025-01-10T10:00:00Z',
  },
  {
    id: 'exp-2',
    expenseNumber: 'EXP-000002',
    organizationId: 'org-456',
    userId: 'user-123',
    userName: 'John Doe',
    category: 'meals',
    description: 'Client lunch',
    expenseDate: '2025-01-15T00:00:00Z',
    amount: 85.5,
    taxRate: 10,
    total: 94.05,
    status: 'SUBMITTED',
    currency: 'USD',
    notes: 'with Acme team',
    createdAt: '2025-01-15T14:30:00Z',
    updatedAt: '2025-01-15T14:30:00Z',
  },
]

export const expensesHandlers = [
  http.get(`${API_URL}/organizations/:orgId/expenses`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedData = mockExpenses.slice(start, end)
    
    return HttpResponse.json({
      data: paginatedData,
      meta: {
        page,
        limit,
        total: mockExpenses.length,
        totalPages: Math.ceil(mockExpenses.length / limit),
        hasNextPage: end < mockExpenses.length,
        hasPrevPage: page > 1,
      },
    })
  }),

  http.get(`${API_URL}/organizations/:orgId/expenses/:id`, ({ params }) => {
    const { id } = params
    const expense = mockExpenses.find(e => e.id === id)
    
    if (!expense) {
      return HttpResponse.json(
        { message: 'Expense not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    return HttpResponse.json(expense)
  }),

  http.post(`${API_URL}/organizations/:orgId/expenses`, async ({ request }) => {
    const body = await request.json() as any
    const newExpense = {
      id: `exp-${Date.now()}`,
      expenseNumber: `EXP-${String(mockExpenses.length + 1).padStart(6, '0')}`,
      organizationId: 'org-456',
      userId: 'user-123',
      userName: 'John Doe',
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...body,
    }
    
    mockExpenses.push(newExpense)
    return HttpResponse.json(newExpense, { status: 201 })
  }),

  http.post(`${API_URL}/organizations/:orgId/expenses/:id/submit`, ({ params }) => {
    const { id } = params
    const index = mockExpenses.findIndex(e => e.id === id)
    
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Expense not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    mockExpenses[index].status = 'SUBMITTED'
    mockExpenses[index].updatedAt = new Date().toISOString()
    
    return HttpResponse.json(mockExpenses[index])
  }),

  http.post(`${API_URL}/organizations/:orgId/expenses/:id/approve-manager`, ({ params }) => {
    const { id } = params
    const index = mockExpenses.findIndex(e => e.id === id)
    
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Expense not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    mockExpenses[index].status = 'MANAGER_APPROVED'
    mockExpenses[index].updatedAt = new Date().toISOString()
    
    return HttpResponse.json(mockExpenses[index])
  }),
]