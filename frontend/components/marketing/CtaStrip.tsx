import Link from 'next/link'
import { Button } from '@/shared/ui'
import { ArrowRight } from 'lucide-react'

export function CtaStrip() {
  return (
    <section className="bg-accent py-16 md:py-24">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to take control of your finances?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
          Join thousands of businesses that use Fincore to manage their accounting and operations.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link href="/signup">
            <Button variant="secondary" size="lg" className="bg-white text-accent hover:bg-white/90">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button variant="ghost" size="lg" className="text-white hover:bg-white/10">
              Contact Sales
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}