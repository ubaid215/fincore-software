'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Textarea, Card } from '@/shared/ui'
import { toast } from '@/shared/ui'

const orgSettingsSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  currency: z.string().min(1, 'Currency is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  country: z.string().min(1, 'Country is required'),
  taxNumber: z.string().optional(),
  address: z.string().optional(),
})

type OrgSettingsFormData = z.infer<typeof orgSettingsSchema>

interface OrgSettingsFormProps {
  orgId: string
  initialData: OrgSettingsFormData
}

export function OrgSettingsForm({ orgId, initialData }: OrgSettingsFormProps) {
  const { register, handleSubmit, formState: { errors, isDirty, isSubmitting } } = useForm<OrgSettingsFormData>({
    resolver: zodResolver(orgSettingsSchema),
    defaultValues: initialData,
  })

  const onSubmit = async (data: OrgSettingsFormData) => {
    // TODO: API call to update organization
    console.log('Update org:', orgId, data)
    toast.success('Organization settings updated')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <div className="space-y-6">
          <Input
            label="Organization Name"
            error={errors.name?.message}
            {...register('name')}
          />
          <div className="grid gap-6 sm:grid-cols-2">
            <Input
              label="Currency"
              placeholder="USD"
              error={errors.currency?.message}
              {...register('currency')}
            />
            <Input
              label="Timezone"
              placeholder="America/New_York"
              error={errors.timezone?.message}
              {...register('timezone')}
            />
            <Input
              label="Country"
              placeholder="United States"
              error={errors.country?.message}
              {...register('country')}
            />
            <Input
              label="Tax Number (Optional)"
              {...register('taxNumber')}
            />
          </div>
          <Textarea
            label="Address (Optional)"
            rows={3}
            {...register('address')}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty || isSubmitting} loading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </div>
      </Card>
    </form>
  )
}