import { BlogCard } from '@/components/marketing'
import type { BlogPost } from '@/components/marketing'

// This would normally come from a CMS or MDX files
const blogPosts: BlogPost[] = [
  {
    slug: 'getting-started-with-fincore',
    title: 'Getting Started with Fincore',
    excerpt: 'Learn how to set up your account and start managing your finances in minutes.',
    author: 'Sarah Johnson',
    date: '2025-03-15',
    tags: ['Getting Started', 'Tutorial'],
  },
  {
    slug: 'double-entry-accounting-explained',
    title: 'Double-Entry Accounting Explained',
    excerpt: 'Understanding the foundation of modern accounting and why it matters for your business.',
    author: 'Michael Chen',
    date: '2025-03-10',
    tags: ['Accounting', 'Education'],
  },
  {
    slug: 'inventory-management-best-practices',
    title: 'Inventory Management Best Practices',
    excerpt: 'Tips and strategies to optimize your inventory and reduce costs.',
    author: 'Emily Rodriguez',
    date: '2025-03-05',
    tags: ['Inventory', 'Best Practices'],
  },
  {
    slug: 'payroll-tax-guide-2025',
    title: 'Payroll Tax Guide 2025',
    excerpt: 'Everything you need to know about payroll taxes this year.',
    author: 'David Kim',
    date: '2025-02-28',
    tags: ['Payroll', 'Tax'],
  },
  {
    slug: 'financial-reporting-for-small-business',
    title: 'Financial Reporting for Small Business',
    excerpt: 'Key reports every small business owner should review regularly.',
    author: 'Lisa Wong',
    date: '2025-02-20',
    tags: ['Reporting', 'Business'],
  },
  {
    slug: 'automating-expense-tracking',
    title: 'Automating Expense Tracking',
    excerpt: 'How to save time and reduce errors with automated expense management.',
    author: 'Sarah Johnson',
    date: '2025-02-15',
    tags: ['Expenses', 'Automation'],
  },
]

export const metadata = {
  title: 'Blog',
  description: 'Insights, tips, and updates from the Fincore team',
}

export default function BlogPage() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
            Blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-tertiary">
            Insights, tips, and updates from the Fincore team
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </section>
  )
}