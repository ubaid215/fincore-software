import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import type { Organization } from '@/shared/types'

// Mock API - replace with actual API call
const fetchOrganization = async (orgId: string): Promise<Organization> => {
  // TODO: Replace with actual API call
  return {
    id: orgId,
    name: 'Acme Inc.',
    slug: 'acme',
    logoUrl: null,
    currency: 'USD',
    timezone: 'America/New_York',
    country: 'US',
    taxNumber: '12-3456789',
    address: '123 Business St',
    createdAt: new Date().toISOString(),
  }
}

export function useOrganization(orgId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organization.detail(orgId!),
    queryFn: () => fetchOrganization(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}