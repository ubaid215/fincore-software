'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginFormData } from '../types/auth.schema'
import { useLogin } from '../hooks/useLogin'
import { Button, Input } from '@/shared/ui'

export function LoginForm() {
  const login = useLogin()
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = (data: LoginFormData) => {
    login.mutate(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
        {...register('password')}
      />

      <div className="flex items-center justify-end">
        <a href="/forgot-password" className="text-sm text-accent hover:text-accent-hover">
          Forgot password?
        </a>
      </div>

      <Button
        type="submit"
        fullWidth
        loading={login.isPending}
        disabled={login.isPending}
      >
        Sign in
      </Button>

      <p className="text-center text-sm text-text-tertiary">
        Don&apos;t have an account?{' '}
        <a href="/signup" className="text-accent hover:text-accent-hover font-medium">
          Create account
        </a>
      </p>
    </form>
  )
}