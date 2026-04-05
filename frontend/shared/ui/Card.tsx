import { cn } from '@/shared/utils/cn'

export interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'sm'
  hover?: boolean
}

export function Card({ children, className, variant = 'default', hover = false }: CardProps) {
  const variants = {
    default: 'p-6 rounded-lg',
    sm: 'p-4 rounded-md',
  }

  return (
    <div
      className={cn(
        'bg-white border border-border shadow-xs transition-all duration-200',
        variants[variant],
        hover && 'hover:shadow-md hover:border-border-2',
        className,
      )}
    >
      {children}
    </div>
  )
}