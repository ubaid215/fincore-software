'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Select, Input } from '@/shared/ui'
import { useDebounce } from '@/shared/hooks/useDebounce'
import { queryKeys } from '@/shared/lib/query-keys'

interface Customer {
  id: string
  name: string
  email?: string
}

interface CustomerSelectProps {
  orgId: string
  value?: string
  onChange: (value: string) => void
  error?: string
  label?: string
}

// Mock API - replace with actual API call
const fetchCustomers = async (orgId: string, search?: string): Promise<Customer[]> => {
  // TODO: Replace with actual API call
  return [
    { id: '1', name: 'Acme Corp', email: 'billing@acme.com' },
    { id: '2', name: 'Beta LLC', email: 'finance@beta.com' },
    { id: '3', name: 'Gamma Inc', email: 'accounts@gamma.com' },
  ]
}

export function CustomerSelect({ orgId, value, onChange, error, label }: CustomerSelectProps) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)

  const { data: customers, isLoading } = useQuery({
    queryKey: [...queryKeys.customers.list(orgId), debouncedSearch],
    queryFn: () => fetchCustomers(orgId, debouncedSearch),
    enabled: !!orgId,
  })

  const options = customers?.map(c => ({
    value: c.id,
    label: c.name,
  })) ?? []

  const selectedCustomer = customers?.find(c => c.id === value)

  return (
    <Select
      label={label || 'Customer'}
      value={value}
      onValueChange={onChange}
      options={options}
      error={error}
      disabled={isLoading}
      placeholder={isLoading ? 'Loading customers...' : 'Select a customer'}
    />
  )
}