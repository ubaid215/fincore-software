import { z } from 'zod'

export const productFormSchema = z.object({
  sku: z.string().min(1, 'SKU is required'),
  name: z.string().min(1, 'Product name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  unit: z.enum(['EA', 'KG', 'L', 'BOX', 'PACK', 'SET']),
  unitPrice: z.number().min(0, 'Unit price must be 0 or greater'),
  costPrice: z.number().min(0, 'Cost price must be 0 or greater'),
  currentStock: z.number().min(0).default(0),
  minStockLevel: z.number().min(0).default(0),
  maxStockLevel: z.number().min(0).optional(),
  location: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
})

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than 0'),
  type: z.enum(['IN', 'OUT', 'ADJUST']),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

export type ProductFormData = z.infer<typeof productFormSchema>
export type AdjustStockFormData = z.infer<typeof adjustStockSchema>