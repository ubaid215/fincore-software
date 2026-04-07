import { Receipt, FileText, BookOpen, Package, Users, BarChart3, Shield, Zap } from 'lucide-react'

const features = [
  {
    icon: Receipt,
    title: 'Invoicing',
    description: 'Create professional invoices, track payments, and manage recurring billing.',
  },
  {
    icon: FileText,
    title: 'Expense Tracking',
    description: 'Capture receipts, categorize expenses, and automate approval workflows.',
  },
  {
    icon: BookOpen,
    title: 'General Ledger',
    description: 'Double-entry accounting with real-time financial reporting.',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description: 'Track stock levels, manage products, and get low stock alerts.',
  },
  {
    icon: Users,
    title: 'Payroll',
    description: 'Process payroll, manage employees, and generate payslips.',
  },
  {
    icon: BarChart3,
    title: 'Financial Reports',
    description: 'P&L, Balance Sheet, Cash Flow — all your key metrics in one place.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description: 'Granular permissions for owners, admins, accountants, and viewers.',
  },
  {
    icon: Zap,
    title: 'Real-Time Sync',
    description: 'All your data syncs in real-time across devices.',
  },
]

export function FeatureGrid() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">
            Everything you need to manage your finances
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-tertiary">
            Powerful features that work together to help you run your business efficiently.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-white p-6 transition-shadow hover:shadow-md"
            >
              <feature.icon className="h-10 w-10 text-accent" />
              <h3 className="mt-4 text-lg font-semibold text-text-primary">{feature.title}</h3>
              <p className="mt-2 text-sm text-text-tertiary leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}