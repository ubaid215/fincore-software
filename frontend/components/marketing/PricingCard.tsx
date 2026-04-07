import { Check } from 'lucide-react'
import { Button } from '@/shared/ui'
import { cn } from '@/shared/utils/cn'

export interface PricingTier {
  name: string
  price: {
    monthly: number
    annual: number
  }
  description: string
  features: string[]
  cta: string
  highlighted?: boolean
}

interface PricingCardProps {
  tier: PricingTier
  isAnnual: boolean
}

export function PricingCard({ tier, isAnnual }: PricingCardProps) {
  const price = isAnnual ? tier.price.annual : tier.price.monthly
  const period = isAnnual ? '/year' : '/month'

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md',
        tier.highlighted && 'border-accent ring-2 ring-accent/20'
      )}
    >
      {tier.highlighted && (
        <div className="mb-4 inline-block rounded-full bg-accent-subtle px-3 py-1 text-xs font-semibold text-accent">
          Most Popular
        </div>
      )}
      <h3 className="text-xl font-semibold text-text-primary">{tier.name}</h3>
      <p className="mt-2 text-sm text-text-tertiary">{tier.description}</p>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-bold text-text-primary">${price}</span>
        <span className="text-text-tertiary">{period}</span>
      </div>
      <Button
        className="mt-6 w-full"
        variant={tier.highlighted ? 'primary' : 'secondary'}
      >
        {tier.cta}
      </Button>
      <ul className="mt-6 space-y-3">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span className="text-text-secondary">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}