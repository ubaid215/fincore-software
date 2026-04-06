import { create } from 'zustand'

interface InvoiceStore {
  // UI state
  selectedInvoiceIds: string[]
  isFilterDrawerOpen: boolean
  filters: {
    status?: string
    customerId?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }
  
  // Actions
  setSelectedInvoiceIds: (ids: string[]) => void
  toggleSelectedInvoice: (id: string) => void
  clearSelected: () => void
  setFilterDrawerOpen: (open: boolean) => void
  setFilters: (filters: Partial<InvoiceStore['filters']>) => void
  clearFilters: () => void
}

export const useInvoiceStore = create<InvoiceStore>((set) => ({
  // Initial state
  selectedInvoiceIds: [],
  isFilterDrawerOpen: false,
  filters: {},
  
  // Actions
  setSelectedInvoiceIds: (selectedInvoiceIds) => set({ selectedInvoiceIds }),
  
  toggleSelectedInvoice: (id) =>
    set((state) => ({
      selectedInvoiceIds: state.selectedInvoiceIds.includes(id)
        ? state.selectedInvoiceIds.filter((i) => i !== id)
        : [...state.selectedInvoiceIds, id],
    })),
  
  clearSelected: () => set({ selectedInvoiceIds: [] }),
  
  setFilterDrawerOpen: (isFilterDrawerOpen) => set({ isFilterDrawerOpen }),
  
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  
  clearFilters: () =>
    set({ filters: {} }),
}))