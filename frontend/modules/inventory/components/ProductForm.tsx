'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { productFormSchema, type ProductFormData } from '../types/product.schema'
import { useCreateProduct } from '../hooks/useCreateProduct'
import { useUpdateProduct } from '../hooks/useUpdateProduct'
import { useProduct } from '../hooks/useProducts'
import { Button, Input, Textarea, Card, PageHeader, Select } from '@/shared/ui'

const productUnits = [
  { value: 'EA', label: 'Each (EA)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'BOX', label: 'Box (BOX)' },
  { value: 'PACK', label: 'Pack (PACK)' },
  { value: 'SET', label: 'Set (SET)' },
]

const productCategories = [
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'services', label: 'Services' },
  { value: 'other', label: 'Other' },
]

interface ProductFormProps {
  productId?: string
}

export function ProductForm({ productId }: ProductFormProps) {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string

  const { data: product, isLoading: isLoadingProduct } = useProduct(orgId, productId)
  const createProduct = useCreateProduct(orgId)
  const updateProduct = useUpdateProduct(orgId, productId!)

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      sku: '',
      name: '',
      description: '',
      category: '',
      unit: 'EA',
      unitPrice: 0,
      costPrice: 0,
      currentStock: 0,
      minStockLevel: 0,
      maxStockLevel: undefined,
      location: '',
      imageUrl: '',
    },
  })

  React.useEffect(() => {
    if (product) {
      form.reset({
        sku: product.data.sku,
        name: product.data.name,
        description: product.data.description || '',
        category: product.data.category,
        unit: product.data.unit,
        unitPrice: product.data.unitPrice,
        costPrice: product.data.costPrice,
        currentStock: product.data.currentStock,
        minStockLevel: product.data.minStockLevel,
        maxStockLevel: product.data.maxStockLevel,
        location: product.data.location || '',
        imageUrl: product.data.imageUrl || '',
      })
    }
  }, [product, form])

  const onSubmit = (data: ProductFormData) => {
    if (productId) {
      updateProduct.mutate(data)
    } else {
      createProduct.mutate(data)
    }
  }

  if (isLoadingProduct && productId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <PageHeader
        title={productId ? 'Edit Product' : 'New Product'}
        description={productId ? 'Update product details' : 'Add a new product to inventory'}
        actions={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={createProduct.isPending || updateProduct.isPending}>
              {productId ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="SKU"
              placeholder="PROD-001"
              error={form.formState.errors.sku?.message}
              {...form.register('sku')}
            />
            <Input
              label="Product Name"
              placeholder="Product name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Select
              label="Category"
              options={productCategories}
              value={form.watch('category')}
              onValueChange={(value) => form.setValue('category', value)}
              error={form.formState.errors.category?.message}
            />
            <Select
              label="Unit"
              options={productUnits}
              value={form.watch('unit')}
              onValueChange={(value) => form.setValue('unit', value as any)}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Description"
                placeholder="Product description..."
                {...form.register('description')}
              />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-base font-medium text-text-primary">Pricing & Stock</h3>
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="Unit Price"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={form.formState.errors.unitPrice?.message}
              {...form.register('unitPrice', { valueAsNumber: true })}
            />
            <Input
              label="Cost Price"
              type="number"
              step="0.01"
              placeholder="0.00"
              error={form.formState.errors.costPrice?.message}
              {...form.register('costPrice', { valueAsNumber: true })}
            />
            <Input
              label="Initial Stock"
              type="number"
              step="1"
              placeholder="0"
              error={form.formState.errors.currentStock?.message}
              {...form.register('currentStock', { valueAsNumber: true })}
            />
            <Input
              label="Min Stock Level"
              type="number"
              step="1"
              placeholder="0"
              error={form.formState.errors.minStockLevel?.message}
              {...form.register('minStockLevel', { valueAsNumber: true })}
            />
            <Input
              label="Max Stock Level (Optional)"
              type="number"
              step="1"
              placeholder="Not set"
              {...form.register('maxStockLevel', { valueAsNumber: true })}
            />
            <Input
              label="Location (Optional)"
              placeholder="Warehouse A, Shelf 1"
              {...form.register('location')}
            />
          </div>
        </Card>
      </div>
    </form>
  )
}