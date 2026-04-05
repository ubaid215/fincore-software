'use client'

import { useAuthStore } from '@/modules/auth/store/auth.store'
import { ROLES } from '@/config/app.config'
import type { Role } from '@/shared/types'

export interface GuardProps {
  children: React.ReactNode
  roles?: Role[]
  fallback?: React.ReactNode
}

export function Guard({ children, roles, fallback = null }: GuardProps) {
  const { userMemberships, activeOrganizationId } = useAuthStore()

  const currentOrgMembership = userMemberships?.find(
    (m) => m.organizationId === activeOrganizationId,
  )

  const userRole = currentOrgMembership?.role

  if (!userRole) return fallback

  if (roles && !roles.includes(userRole as Role)) {
    return fallback
  }

  return <>{children}</>
}

// Helper for conditional rendering
export function useHasPermission(requiredRoles?: Role[]): boolean {
  const { userMemberships, activeOrganizationId } = useAuthStore()

  const currentOrgMembership = userMemberships?.find(
    (m) => m.organizationId === activeOrganizationId,
  )

  const userRole = currentOrgMembership?.role

  if (!userRole) return false
  if (!requiredRoles || requiredRoles.length === 0) return true

  return requiredRoles.includes(userRole as Role)
}