import { CtaStrip } from '@/components/marketing'

export const metadata = {
  title: 'About Us',
  description: 'Learn about Fincore and our mission',
}

export default function AboutPage() {
  return (
    <>
      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Our mission
            </h1>
            <p className="mx-auto mt-4 text-lg text-text-tertiary">
              To empower businesses with modern, intuitive financial tools that save time and drive growth.
            </p>
          </div>

          <div className="mt-12 space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-text-primary">Who we are</h2>
              <p className="mt-4 text-text-secondary">
                Fincore was founded in 2024 by a team of accountants and software engineers who believed 
                that small and medium businesses deserve better financial tools. We saw that existing 
                solutions were either too complex or too limited, so we built something better.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-text-primary">Our values</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold text-text-primary">Simplicity</h3>
                  <p className="mt-1 text-sm text-text-tertiary">Complexity hidden, clarity delivered.</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold text-text-primary">Accuracy</h3>
                  <p className="mt-1 text-sm text-text-tertiary">Financial data you can trust.</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold text-text-primary">Innovation</h3>
                  <p className="mt-1 text-sm text-text-tertiary">Always improving, never stagnant.</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <h3 className="font-semibold text-text-primary">Support</h3>
                  <p className="mt-1 text-sm text-text-tertiary">Your success is our success.</p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-text-primary">Our team</h2>
              <p className="mt-4 text-text-secondary">
                We&lsquo;re a remote-first team of passionate individuals spread across the globe, united by 
                our mission to modernize business finance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CtaStrip />
    </>
  )
}