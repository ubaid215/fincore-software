import Link from 'next/link'
import { Button } from '@/shared/ui'
import { ArrowRight, CheckCircle } from 'lucide-react'

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-surface pt-24 pb-16 md:pt-32 md:pb-24">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-accent/5 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Announcement pill */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-sm shadow-sm">
              <span className="text-accent">✨ New</span>
              <span className="text-text-tertiary">•</span>
              <span className="text-text-tertiary">Inventory Management is here</span>
            </div>
          </div>

          {/* Hero Title */}
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
            Modern accounting for{' '}
            <span className="relative inline-block whitespace-nowrap text-accent">
              growing businesses
              <svg
                aria-hidden="true"
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 300 12"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M0 8 L300 8"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          {/* Hero Description */}
          <p className="mx-auto mt-6 max-w-2xl text-base text-text-tertiary sm:text-lg">
            Streamline your finances with Fincore. Invoicing, expense tracking, payroll, inventory,
            and financial reporting — all in one powerful platform.
          </p>

          {/* CTA Buttons - FIXED ALIGNMENT */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="inline-flex items-center justify-center gap-2">
                <span>Start Free Trial</span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            </Link>
            <Link href="/features">
              <Button variant="secondary" size="lg">
                View Features
              </Button>
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-tertiary">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0 text-accent" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0 text-accent" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 shrink-0 text-accent" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="mt-16 w-full overflow-hidden rounded-xl border border-border bg-white shadow-xl">
          <div className="border-b border-border bg-surface px-4 py-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-danger/60" />
              <div className="h-3 w-3 rounded-full bg-warning/60" />
              <div className="h-3 w-3 rounded-full bg-success/60" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-white to-surface p-4 sm:p-6">
            <div className="flex h-64 items-center justify-center rounded-lg bg-surface-2 sm:h-80">
              <span className="text-text-tertiary">Dashboard Preview</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}