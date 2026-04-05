import { http, HttpResponse } from 'msw'
import { env } from '@/config/app.config'

const API_URL = env.apiUrl

// Mock user data
const mockUser = {
  id: 'user-123',
  email: 'john@acme.com',
  firstName: 'John',
  lastName: 'Doe',
  avatarUrl: null,
}

const mockMemberships = [
  {
    organizationId: 'org-456',
    organizationName: 'Acme Inc.',
    role: 'ADMIN',
    isDefault: true,
  },
  {
    organizationId: 'org-789',
    organizationName: 'Beta Corp',
    role: 'VIEWER',
    isDefault: false,
  },
]

const mockTokens = {
  accessToken: 'mock-access-token-xyz',
  expiresIn: 3600,
}

// Store for active sessions (in-memory for MSW)
let activeRefreshToken: string | null = 'mock-refresh-token-xyz'

export const authHandlers = [
  // Login
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    
    if (body.email === 'john@acme.com' && body.password === 'password123') {
      return HttpResponse.json({
        user: mockUser,
        tokens: mockTokens,
        memberships: mockMemberships,
      })
    }
    
    return HttpResponse.json(
      { message: 'Invalid email or password', statusCode: 401 },
      { status: 401 }
    )
  }),

  // Signup
  http.post(`${API_URL}/auth/signup`, async ({ request }) => {
    const body = await request.json() as { 
      email: string; 
      password: string; 
      firstName: string; 
      lastName: string; 
      organizationName: string 
    }
    
    return HttpResponse.json({
      user: {
        id: 'new-user-123',
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        avatarUrl: null,
      },
      tokens: mockTokens,
      memberships: [
        {
          organizationId: 'new-org-456',
          organizationName: body.organizationName,
          role: 'OWNER',
          isDefault: true,
        },
      ],
    })
  }),

  // Refresh token
  http.post(`${API_URL}/auth/refresh`, async ({ request }) => {
    const cookie = request.headers.get('cookie')
    
    if (cookie?.includes('fincore_refresh') && activeRefreshToken) {
      return HttpResponse.json({
        accessToken: 'new-mock-access-token-' + Date.now(),
        expiresIn: 3600,
      })
    }
    
    return HttpResponse.json(
      { message: 'Refresh token expired', statusCode: 401 },
      { status: 401 }
    )
  }),

  // Logout
  http.post(`${API_URL}/auth/logout`, () => {
    activeRefreshToken = null
    return HttpResponse.json({ success: true })
  }),

  // Get current user
  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (authHeader === `Bearer ${mockTokens.accessToken}`) {
      return HttpResponse.json(mockUser)
    }
    
    return HttpResponse.json(
      { message: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }),

  // Get user's organizations
  http.get(`${API_URL}/auth/organizations`, ({ request }) => {
    const authHeader = request.headers.get('Authorization')
    
    if (authHeader === `Bearer ${mockTokens.accessToken}`) {
      return HttpResponse.json(mockMemberships)
    }
    
    return HttpResponse.json(
      { message: 'Unauthorized', statusCode: 401 },
      { status: 401 }
    )
  }),

  // Accept invite
  http.post(`${API_URL}/auth/invite/accept`, async ({ request }) => {
    const body = await request.json() as { token: string; password: string; firstName: string; lastName: string }
    
    if (body.token === 'valid-invite-token') {
      return HttpResponse.json({
        user: {
          id: 'invited-user-123',
          email: 'invited@acme.com',
          firstName: body.firstName,
          lastName: body.lastName,
          avatarUrl: null,
        },
        tokens: mockTokens,
        memberships: [
          {
            organizationId: 'org-456',
            organizationName: 'Acme Inc.',
            role: 'MEMBER',
            isDefault: true,
          },
        ],
      })
    }
    
    return HttpResponse.json(
      { message: 'Invalid or expired invite token', statusCode: 400 },
      { status: 400 }
    )
  }),

  // Forgot password
  http.post(`${API_URL}/auth/forgot-password`, async ({ request }) => {
    const body = await request.json() as { email: string }
    
    // Always return success for security (don't reveal if email exists)
    return HttpResponse.json({ message: 'Password reset email sent' })
  }),

  // Reset password
  http.post(`${API_URL}/auth/reset-password`, async ({ request }) => {
    const body = await request.json() as { token: string; password: string }
    
    if (body.token === 'valid-reset-token') {
      return HttpResponse.json({ message: 'Password reset successful' })
    }
    
    return HttpResponse.json(
      { message: 'Invalid or expired reset token', statusCode: 400 },
      { status: 400 }
    )
  }),
]