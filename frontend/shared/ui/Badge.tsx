import { cn } from '@/shared/utils/cn'
import { type BadgeVariant } from '@/shared/types'

export interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-2 text-text-secondary border-border',
  success: 'bg-success-subtle text-success-text border-success/20',
  warning: 'bg-warning-subtle text-warning-text border-warning/20',
  danger: 'bg-danger-subtle text-danger-text border-danger/20',
  info: 'bg-info-subtle text-info-text border-info/20',
  draft: 'bg-draft-bg text-draft-text border-border',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}