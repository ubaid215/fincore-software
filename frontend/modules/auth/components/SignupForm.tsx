'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signupSchema, type SignupFormData } from '../types/auth.schema'
import { useSignup } from '../hooks/useSignup'
import { Button, Input } from '@/shared/ui'

export function SignupForm() {
  const signup = useSignup()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
    },
  })

  const onSubmit = (data: SignupFormData) => {
    console.log('Sending signup data:', data)
    signup.mutate(data)
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
        label="Email"
        type="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        hint="At least 8 characters with uppercase, lowercase, and number"
        {...register('password')}
      />

      <Button
        type="submit"
        fullWidth
        loading={signup.isPending}
        disabled={signup.isPending}
      >
        Create account
      </Button>

      <p className="text-center text-sm text-text-tertiary">
        Already have an account?{' '}
        <a href="/login" className="text-accent hover:text-accent-hover font-medium">
          Sign in
        </a>
      </p>
    </form>
  )
}