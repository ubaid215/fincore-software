import { http, HttpResponse } from 'msw'
import { env } from '@/config/app.config'

const API_URL = env.apiUrl

// Mock invoice data
const mockInvoices = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-000001',
    organizationId: 'org-456',
    customerId: 'cust-1',
    customerName: 'Acme Corp',
    customerEmail: 'billing@acme.com',
    issueDate: '2025-01-15T00:00:00Z',
    dueDate: '2025-02-14T00:00:00Z',
    status: 'SENT',
    currency: 'USD',
    notes: 'Thank you for your business',
    terms: 'Net 30',
    subtotal: 1000,
    taxTotal: 100,
    total: 1100,
    amountPaid: 0,
    amountDue: 1100,
    lineItems: [
      {
        id: 'li-1',
        description: 'Consulting Services',
        quantity: 10,
        unitPrice: 100,
        discountPercent: 0,
        taxRate: 10,
        gross: 1000,
        discount: 0,
        subtotal: 1000,
        tax: 100,
        total: 1100,
      },
    ],
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-000002',
    organizationId: 'org-456',
    customerId: 'cust-2',
    customerName: 'Beta LLC',
    customerEmail: 'finance@beta.com',
    issueDate: '2025-01-20T00:00:00Z',
    dueDate: '2025-02-19T00:00:00Z',
    status: 'DRAFT',
    currency: 'USD',
    notes: '',
    terms: '',
    subtotal: 500,
    taxTotal: 50,
    total: 550,
    amountPaid: 0,
    amountDue: 550,
    lineItems: [
      {
        id: 'li-2',
        description: 'Software License',
        quantity: 1,
        unitPrice: 500,
        discountPercent: 0,
        taxRate: 10,
        gross: 500,
        discount: 0,
        subtotal: 500,
        tax: 50,
        total: 550,
      },
    ],
    createdAt: '2025-01-20T14:30:00Z',
    updatedAt: '2025-01-20T14:30:00Z',
  },
]

export const invoicesHandlers = [
  // List invoices
  http.get(`${API_URL}/organizations/:orgId/invoices`, ({ request }) => {
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedData = mockInvoices.slice(start, end)
    
    return HttpResponse.json({
      data: paginatedData,
      meta: {
        page,
        limit,
        total: mockInvoices.length,
        totalPages: Math.ceil(mockInvoices.length / limit),
        hasNextPage: end < mockInvoices.length,
        hasPrevPage: page > 1,
      },
    })
  }),

  // Get single invoice
  http.get(`${API_URL}/organizations/:orgId/invoices/:id`, ({ params }) => {
    const { id } = params
    const invoice = mockInvoices.find(i => i.id === id)
    
    if (!invoice) {
      return HttpResponse.json(
        { message: 'Invoice not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    return HttpResponse.json(invoice)
  }),

  // Create invoice
  http.post(`${API_URL}/organizations/:orgId/invoices`, async ({ request }) => {
    const body = await request.json() as any
    const newInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `INV-${String(mockInvoices.length + 1).padStart(6, '0')}`,
      organizationId: 'org-456',
      status: 'DRAFT',
      amountPaid: 0,
      amountDue: body.total,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...body,
    }
    
    mockInvoices.push(newInvoice)
    return HttpResponse.json(newInvoice, { status: 201 })
  }),

  // Update invoice
  http.patch(`${API_URL}/organizations/:orgId/invoices/:id`, async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as any
    const index = mockInvoices.findIndex(i => i.id === id)
    
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Invoice not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    mockInvoices[index] = {
      ...mockInvoices[index],
      ...body,
      updatedAt: new Date().toISOString(),
    }
    
    return HttpResponse.json(mockInvoices[index])
  }),

  // Send invoice
  http.post(`${API_URL}/organizations/:orgId/invoices/:id/send`, async ({ params }) => {
    const { id } = params
    const index = mockInvoices.findIndex(i => i.id === id)
    
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Invoice not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    mockInvoices[index].status = 'SENT'
    mockInvoices[index].updatedAt = new Date().toISOString()
    
    return HttpResponse.json({ success: true })
  }),

  // Record payment
  http.post(`${API_URL}/organizations/:orgId/invoices/:id/payments`, async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as any
    const index = mockInvoices.findIndex(i => i.id === id)
    
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Invoice not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    mockInvoices[index].amountPaid = body.amount
    mockInvoices[index].amountDue = mockInvoices[index].total - body.amount
    mockInvoices[index].status = mockInvoices[index].amountDue <= 0 ? 'PAID' : 'SENT'
    mockInvoices[index].updatedAt = new Date().toISOString()
    
    return HttpResponse.json(mockInvoices[index])
  }),

  // Void invoice
  http.post(`${API_URL}/organizations/:orgId/invoices/:id/void`, async ({ params, request }) => {
    const { id } = params
    const body = await request.json() as any
    const index = mockInvoices.findIndex(i => i.id === id)
    
    if (index === -1) {
      return HttpResponse.json(
        { message: 'Invoice not found', statusCode: 404 },
        { status: 404 }
      )
    }
    
    mockInvoices[index].status = 'VOID'
    mockInvoices[index].updatedAt = new Date().toISOString()
    
    return HttpResponse.json(mockInvoices[index])
  }),
]