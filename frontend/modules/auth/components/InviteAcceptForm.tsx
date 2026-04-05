'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, useRouter } from 'next/navigation'
import { inviteAcceptSchema, type InviteAcceptFormData } from '../types/auth.schema'
import { useAcceptInvite } from '../hooks/useAcceptInvite'
import { Button, Input } from '@/shared/ui'

export function InviteAcceptForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)

  const acceptInvite = useAcceptInvite()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<InviteAcceptFormData>({
    resolver: zodResolver(inviteAcceptSchema),
    defaultValues: {
      token: '',
      password: '',
      firstName: '',
      lastName: '',
    },
  })

  useEffect(() => {
    if (token) {
      setValue('token', token)
    } else {
      setError('Invalid or missing invite token')
    }
  }, [token, setValue])

  const onSubmit = (data: InviteAcceptFormData) => {
    acceptInvite.mutate(data)
  }

  if (error) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded-full bg-danger-subtle p-3 w-12 h-12 mx-auto flex items-center justify-center">
          <svg className="h-6 w-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-primary">Invalid Invite</h3>
        <p className="text-sm text-text-tertiary">{error}</p>
        <a href="/login" className="text-sm text-accent hover:text-accent-hover">
          Go to login
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First name"
          placeholder="John"
          error={errors.firstName?.message}
          {...register('firstName')}
        />
        <Input
          label="Last name"
          placeholder="Doe"
          error={errors.lastName?.message}
          {...register('lastName')}
        />
      </div>

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        hint="At least 8 characters"
        {...register('password')}
      />

      <Button
        type="submit"
        fullWidth
        loading={acceptInvite.isPending}
        disabled={acceptInvite.isPending}
      >
        Accept Invitation
      </Button>
    </form>
  )
}