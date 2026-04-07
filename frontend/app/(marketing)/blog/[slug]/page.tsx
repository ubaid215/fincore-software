import { notFound } from 'next/navigation'
import { Calendar, User, Tag } from 'lucide-react'
import { formatDate } from '@/shared/utils/date'
import { CtaStrip } from '@/components/marketing'

// This would normally come from a CMS or MDX files
const blogPosts: Record<string, any> = {
  'getting-started-with-fincore': {
    title: 'Getting Started with Fincore',
    author: 'Sarah Johnson',
    date: '2025-03-15',
    content: `
      <p>Welcome to Fincore! In this guide, we'll walk you through setting up your account and getting started with your first invoice.</p>
      
      <h2>Step 1: Complete your profile</h2>
      <p>After signing up, the first thing you'll want to do is complete your organization profile. Go to Settings > Organization to add your company details, logo, and default currency.</p>
      
      <h2>Step 2: Add your customers</h2>
      <p>Navigate to Invoicing > Customers to add your first customer. You can add them one by one or import a CSV file.</p>
      
      <h2>Step 3: Create your first invoice</h2>
      <p>Go to Invoicing > New Invoice. Select your customer, add line items, and set the due date. Review and save — your invoice is ready to send!</p>
      
      <h2>Step 4: Set up expense categories</h2>
      <p>To track expenses efficiently, set up your expense categories in Settings > Expense Categories.</p>
      
      <h2>Step 5: Invite your team</h2>
      <p>Go to Settings > Members to invite your team members and assign appropriate roles.</p>
      
      <p>That's it! You're now ready to manage your finances with Fincore. If you have any questions, our support team is here to help.</p>
    `,
    tags: ['Getting Started', 'Tutorial'],
  },
}

export async function generateStaticParams() {
  return Object.keys(blogPosts).map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const post = blogPosts[params.slug]
  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt?.slice(0, 160),
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = blogPosts[params.slug]

  if (!post) {
    notFound()
  }

  return (
    <>
      <article className="pt-24 pb-12 md:pt-32 md:pb-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag: string) => (
                <span key={tag} className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent">
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              {post.title}
            </h1>
            <div className="mt-4 flex items-center gap-4 text-sm text-text-tertiary">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span>{post.author}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDate(post.date)}</span>
              </div>
            </div>
          </div>

          <div
            className="prose prose-stone max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
      </article>

      <CtaStrip />
    </>
  )
}