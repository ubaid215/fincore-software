import { useAuthStore } from '@/modules/auth/store/auth.store'
import { ROLE_HIERARCHY } from '@/config/app.config'
import type { Role } from '@/shared/types'

export function usePermission() {
  const { userMemberships, activeOrganizationId } = useAuthStore()

  const currentMembership = userMemberships?.find(
    (m) => m.organizationId === activeOrganizationId,
  )

  const userRole = currentMembership?.role as Role | undefined

  const hasRole = (requiredRoles: Role | Role[]): boolean => {
    if (!userRole) return false
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles]
    return roles.includes(userRole)
  }

  const hasMinRole = (minRole: Role): boolean => {
    if (!userRole) return false
    const userIndex = ROLE_HIERARCHY.indexOf(userRole)
    const requiredIndex = ROLE_HIERARCHY.indexOf(minRole)
    return userIndex >= requiredIndex
  }

  const canAccessModule = (module: 'inventory' | 'payroll' | 'advancedReports'): boolean => {
    // Check feature flags first
    const features = {
      inventory: process.env.NEXT_PUBLIC_ENABLE_INVENTORY === 'true',
      payroll: process.env.NEXT_PUBLIC_ENABLE_PAYROLL === 'true',
      advancedReports: process.env.NEXT_PUBLIC_ENABLE_ADVANCED_REPORTS === 'true',
    }

    if (!features[module]) return false

    // Check role-based access
    if (module === 'payroll') {
      return hasMinRole('ADMIN')
    }
    return hasMinRole('VIEWER')
  }

  return { userRole, hasRole, hasMinRole, canAccessModule }
}