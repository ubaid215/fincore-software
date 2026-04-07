import { FeatureGrid } from '@/components/marketing/FeatureGrid'
import { CtaStrip } from '@/components/marketing'
import { CheckCircle } from 'lucide-react'

const detailedFeatures = [
  {
    category: 'Financial Management',
    items: [
      'Double-entry accounting',
      'Chart of accounts',
      'Journal entries',
      'Trial balance',
      'Financial statements',
    ],
  },
  {
    category: 'Operations',
    items: [
      'Inventory management',
      'Stock tracking',
      'Low stock alerts',
      'Product catalog',
      'Stock movements history',
    ],
  },
  {
    category: 'Workforce',
    items: [
      'Employee management',
      'Payroll processing',
      'Payslip generation',
      'Leave tracking',
      'Expense reimbursements',
    ],
  },
  {
    category: 'Reporting',
    items: [
      'Real-time dashboards',
      'Profit & Loss',
      'Balance Sheet',
      'Cash flow analysis',
      'Aged receivables/payables',
    ],
  },
]

export const metadata = {
  title: 'Features',
  description: 'Everything you need to manage your business finances',
}

export default function FeaturesPage() {
  return (
    <>
      <section className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Everything you need in one platform
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-tertiary">
              Fincore combines powerful accounting features with an intuitive interface.
            </p>
          </div>
        </div>
      </section>

      <FeatureGrid />

      <section className="py-16 bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-text-primary sm:text-3xl">
            Comprehensive features for modern businesses
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {detailedFeatures.map((category) => (
              <div key={category.category} className="rounded-lg border border-border bg-white p-6">
                <h3 className="text-lg font-semibold text-text-primary">{category.category}</h3>
                <ul className="mt-4 space-y-2">
                  {category.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-text-secondary">
                      <CheckCircle className="h-4 w-4 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaStrip />
    </>
  )
}