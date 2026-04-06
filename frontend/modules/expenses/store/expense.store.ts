import { create } from 'zustand'

interface ExpenseStore {
  // UI state
  selectedExpenseIds: string[]
  isFilterDrawerOpen: boolean
  viewMode: 'table' | 'kanban'
  filters: {
    status?: string
    category?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }
  
  // Actions
  setSelectedExpenseIds: (ids: string[]) => void
  toggleSelectedExpense: (id: string) => void
  clearSelected: () => void
  setFilterDrawerOpen: (open: boolean) => void
  setViewMode: (mode: 'table' | 'kanban') => void
  setFilters: (filters: Partial<ExpenseStore['filters']>) => void
  clearFilters: () => void
}

export const useExpenseStore = create<ExpenseStore>((set) => ({
  selectedExpenseIds: [],
  isFilterDrawerOpen: false,
  viewMode: 'table',
  filters: {},
  
  setSelectedExpenseIds: (selectedExpenseIds) => set({ selectedExpenseIds }),
  
  toggleSelectedExpense: (id) =>
    set((state) => ({
      selectedExpenseIds: state.selectedExpenseIds.includes(id)
        ? state.selectedExpenseIds.filter((i) => i !== id)
        : [...state.selectedExpenseIds, id],
    })),
  
  clearSelected: () => set({ selectedExpenseIds: [] }),
  
  setFilterDrawerOpen: (isFilterDrawerOpen) => set({ isFilterDrawerOpen }),
  
  setViewMode: (viewMode) => set({ viewMode }),
  
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  
  clearFilters: () => set({ filters: {} }),
}))