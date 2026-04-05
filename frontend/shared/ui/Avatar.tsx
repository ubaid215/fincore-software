import { getInitials } from '@/shared/utils/string'
import { cn } from '@/shared/utils/cn'

export interface AvatarProps {
  src?: string | null
  name?: string
  firstName?: string
  lastName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  fallback?: string
}

const sizes = {
  sm: 'w-6 h-6 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
}

export function Avatar({
  src,
  name,
  firstName,
  lastName,
  size = 'md',
  className,
  fallback,
}: AvatarProps) {
  let initials = fallback

  if (!initials && (firstName || lastName)) {
    initials = getInitials(firstName || '', lastName)
  }

  if (!initials && name) {
    const parts = name.split(' ')
    initials = getInitials(parts[0] || '', parts[1] || '')
  }

  if (!initials) {
    initials = 'U'
  }

  return (
    <div
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-secondary font-medium',
        sizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || 'Avatar'} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  )
}