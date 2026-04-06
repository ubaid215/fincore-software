'use client'

import { useFieldArray, UseFormReturn } from 'react-hook-form'
import { Plus, Trash2 } from 'lucide-react'
import { Button, Input } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'
import { calculateLineTotals } from '../utils/invoice.calculations'
import type { InvoiceFormData } from '../types/invoice.schema'

interface LineItemsGridProps {
  form: UseFormReturn<InvoiceFormData>
  currency: string
}

export function LineItemsGrid({ form, currency }: LineItemsGridProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'lineItems',
  })

  const { watch, setValue } = form
  const lineItems = watch('lineItems')

  const addLineItem = () => {
    append({
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountPercent: 0,
      taxRate: 0,
    })
  }

  const updateLineItemTotals = (index: number) => {
    const item = lineItems[index]
    if (!item) return
    
    const calculated = calculateLineTotals({
      ...item,
      quantity: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      discountPercent: item.discountPercent || 0,
      taxRate: item.taxRate || 0,
    })
    
    // Update calculated fields in the form
    setValue(`lineItems.${index}.quantity`, item.quantity)
    setValue(`lineItems.${index}.unitPrice`, item.unitPrice)
  }

  // Calculate invoice totals
  const totals = lineItems?.reduce(
    (acc, item) => {
      const calculated = calculateLineTotals({
        ...item,
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        discountPercent: item.discountPercent || 0,
        taxRate: item.taxRate || 0,
      })
      return {
        subtotal: acc.subtotal + calculated.subtotal,
        taxTotal: acc.taxTotal + calculated.tax,
        total: acc.total + calculated.total,
      }
    },
    { subtotal: 0, taxTotal: 0, total: 0 }
  ) ?? { subtotal: 0, taxTotal: 0, total: 0 }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-border">
            <tr className="text-left text-sm text-text-tertiary">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium w-24">Quantity</th>
              <th className="pb-2 font-medium w-32">Unit Price</th>
              <th className="pb-2 font-medium w-24">Discount %</th>
              <th className="pb-2 font-medium w-24">Tax %</th>
              <th className="pb-2 font-medium w-32">Total</th>
              <th className="pb-2 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = lineItems?.[index]
              const calculated = item
                ? calculateLineTotals({
                    ...item,
                    quantity: item.quantity || 0,
                    unitPrice: item.unitPrice || 0,
                    discountPercent: item.discountPercent || 0,
                    taxRate: item.taxRate || 0,
                  })
                : null

              return (
                <tr key={field.id} className="border-b border-border">
                  <td className="py-2 pr-2">
                    <Input
                      {...form.register(`lineItems.${index}.description`)}
                      placeholder="Item description"
                      className="w-full"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      {...form.register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                      onChange={(e) => {
                        form.setValue(`lineItems.${index}.quantity`, parseFloat(e.target.value) || 0)
                        updateLineItemTotals(index)
                      }}
                      className="w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
                      onChange={(e) => {
                        form.setValue(`lineItems.${index}.unitPrice`, parseFloat(e.target.value) || 0)
                        updateLineItemTotals(index)
                      }}
                      className="w-32"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...form.register(`lineItems.${index}.discountPercent`, { valueAsNumber: true })}
                      onChange={(e) => {
                        form.setValue(`lineItems.${index}.discountPercent`, parseFloat(e.target.value) || 0)
                        updateLineItemTotals(index)
                      }}
                      className="w-24"
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      {...form.register(`lineItems.${index}.taxRate`, { valueAsNumber: true })}
                      onChange={(e) => {
                        form.setValue(`lineItems.${index}.taxRate`, parseFloat(e.target.value) || 0)
                        updateLineItemTotals(index)
                      }}
                      className="w-24"
                    />
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <span className="text-sm font-medium text-text-primary">
                      {calculated?.total.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-text-tertiary hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="pt-4">
                <Button type="button" variant="ghost" size="sm" onClick={addLineItem}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add line item
                </Button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Totals summary */}
      <div className="flex justify-end">
        <div className="w-80 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Subtotal</span>
            <span className="text-text-primary">{totals.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-text-tertiary">Tax</span>
            <span className="text-text-primary">{totals.taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span className="text-text-primary">Total</span>
            <span className="text-text-primary">{totals.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}