// Types
export type * from './types/inventory.types'
export { productFormSchema, adjustStockSchema } from './types/product.schema'

// API
export { inventoryApi } from './api/inventory.api'

// Hooks
export { useProducts, useProduct, useLowStockProducts, useStockSummary } from './hooks/useProducts'
export { useCreateProduct } from './hooks/useCreateProduct'
export { useUpdateProduct } from './hooks/useUpdateProduct'
export { useStockMovements, useAdjustStock } from './hooks/useStockMovements'

// Components
export { ProductTable } from './components/ProductTable'
export { ProductForm } from './components/ProductForm'
export { StockMovements } from './components/StockMovements'
export { LowStockAlert } from './components/LowStockAlert'