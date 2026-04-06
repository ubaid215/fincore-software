import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Organization } from '@/shared/types'

interface WorkspaceStore {
  // State
  activeOrganizationId: string | null
  activeOrganization: Organization | null
  organizations: Organization[]
  
  // Actions
  setActiveOrganizationId: (id: string | null) => void
  setActiveOrganization: (org: Organization | null) => void
  setOrganizations: (orgs: Organization[]) => void
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      activeOrganizationId: null,
      activeOrganization: null,
      organizations: [],
      
      setActiveOrganizationId: (activeOrganizationId) => set({ activeOrganizationId }),
      setActiveOrganization: (activeOrganization) => set({ activeOrganization }),
      setOrganizations: (organizations) => set({ organizations }),
    }),
    {
      name: 'fincore:workspace',
      partialize: (state) => ({
        activeOrganizationId: state.activeOrganizationId,
      }),
    }
  )
)