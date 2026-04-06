'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal, Button, Input, Select } from '@/shared/ui'
import { toast } from '@/shared/ui'
import type { Role } from '@/shared/types'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'MANAGER', 'VIEWER']),
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (data: InviteFormData) => Promise<void>
}

const roleOptions = [
  { value: 'ADMIN', label: 'Admin - Full access' },
  { value: 'ACCOUNTANT', label: 'Accountant - Financial access' },
  { value: 'MANAGER', label: 'Manager - Approve expenses' },
  { value: 'VIEWER', label: 'Viewer - Read only' },
]

export function InviteMemberModal({ open, onOpenChange, onInvite }: InviteMemberModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  
  const { register, handleSubmit, reset, formState: { errors } } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'VIEWER',
    },
  })

  const onSubmit = async (data: InviteFormData) => {
    setIsLoading(true)
    try {
      await onInvite(data)
      toast.success(`Invitation sent to ${data.email}`)
      reset()
      onOpenChange(false)
    } catch (error) {
      toast.error('Failed to send invitation')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Invite Team Member"
      description="Send an invitation to join your organization"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="colleague@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Select
          label="Role"
          options={roleOptions}
          value={register('role').value}
          onValueChange={(value) => register('role').onChange({ target: { value } })}
          error={errors.role?.message}
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            Send Invitation
          </Button>
        </div>
      </form>
    </Modal>
  )
}