'use client'

import { useState } from 'react'
import { PricingCard, PricingToggle, FaqAccordion } from '@/components/marketing'
import { CtaStrip } from '@/components/marketing'

const tiers = [
  {
    name: 'Starter',
    price: { monthly: 29, annual: 278 },
    description: 'Perfect for small businesses and freelancers',
    features: [
      'Up to 5 users',
      'Invoicing & payments',
      'Expense tracking',
      'Basic reporting',
      'Email support',
    ],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Professional',
    price: { monthly: 79, annual: 758 },
    description: 'For growing businesses with advanced needs',
    features: [
      'Up to 20 users',
      'Everything in Starter',
      'Payroll management',
      'Inventory tracking',
      'Advanced reporting',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: { monthly: 199, annual: 1910 },
    description: 'For large organizations with custom requirements',
    features: [
      'Unlimited users',
      'Everything in Professional',
      'Custom roles & permissions',
      'API access',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(false)

  return (
    <>
      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-tertiary">
              Choose the plan that works best for your business. All plans include a 14-day free trial.
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <PricingToggle isAnnual={isAnnual} onToggle={setIsAnnual} />
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <PricingCard key={tier.name} tier={tier} isAnnual={isAnnual} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-text-primary sm:text-3xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-3 text-center text-text-tertiary">
            Everything you need to know about Fincore
          </p>
          <div className="mt-8">
            <FaqAccordion />
          </div>
        </div>
      </section>

      <CtaStrip />
    </>
  )
}