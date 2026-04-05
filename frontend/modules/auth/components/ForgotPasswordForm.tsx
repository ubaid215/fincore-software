'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '../types/auth.schema'
import { useForgotPassword } from '../hooks/useForgotPassword'
import { Button, Input } from '@/shared/ui'

export function ForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const forgotPassword = useForgotPassword()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  })

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPassword.mutate(data, {
      onSuccess: () => setIsSubmitted(true),
    })
  }

  if (isSubmitted) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded-full bg-success-subtle p-3 w-12 h-12 mx-auto flex items-center justify-center">
          <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-text-primary">Check your email</h3>
        <p className="text-sm text-text-tertiary">
          We&apos;ve sent you a password reset link. Please check your inbox.
        </p>
        <a href="/login" className="text-sm text-accent hover:text-accent-hover">
          Back to login
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <p className="text-sm text-text-tertiary">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      <Input
        label="Email"
        type="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <Button
        type="submit"
        fullWidth
        loading={forgotPassword.isPending}
        disabled={forgotPassword.isPending}
      >
        Send reset link
      </Button>

      <p className="text-center text-sm">
        <a href="/login" className="text-accent hover:text-accent-hover">
          Back to login
        </a>
      </p>
    </form>
  )
}