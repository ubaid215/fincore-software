import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export interface StatCardProps {
  title: string
  value: string | number
  trend?: {
    value: number
    label: string
  }
  icon?: React.ReactNode
  className?: string
}

export function StatCard({ title, value, trend, icon, className }: StatCardProps) {
  const isPositive = trend && trend.value > 0
  const isNegative = trend && trend.value < 0

  return (
    <div className={cn('rounded-lg border border-border bg-white p-5 shadow-xs', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-text-tertiary uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  isPositive && 'text-success',
                  isNegative && 'text-danger',
                  !isPositive && !isNegative && 'text-text-tertiary',
                )}
              >
                {isPositive && <TrendingUp className="h-3 w-3" />}
                {isNegative && <TrendingDown className="h-3 w-3" />}
                {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-text-tertiary">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-text-tertiary">{icon}</div>}
      </div>
    </div>
  )
}