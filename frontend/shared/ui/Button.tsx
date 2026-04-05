import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/utils/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'icon'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary: 'bg-accent text-white hover:bg-accent-hover active:bg-accent-active shadow-xs',
      secondary: 'bg-white border border-border text-text-secondary hover:bg-surface active:bg-surface-2',
      ghost: 'text-text-secondary hover:bg-surface active:bg-surface-2',
      destructive: 'bg-danger text-white hover:bg-danger/90 active:bg-danger/80',
      icon: 'text-text-tertiary hover:text-text-primary hover:bg-surface',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-10 px-4 text-base gap-2',
      lg: 'h-12 px-6 text-lg gap-2.5',
    }

    const iconSize = {
      sm: 'w-3.5 h-3.5',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center font-medium rounded-md transition-all duration-200',
          'focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
          'active:scale-[0.98]',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          variant === 'icon' && 'px-0 aspect-square',
          className,
        )}
        {...props}
      >
        {loading && (
          <svg
            className={cn('animate-spin absolute', iconSize[size])}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={cn(loading && 'opacity-0')}>{children}</span>
      </button>
    )
  },
)

Button.displayName = 'Button'