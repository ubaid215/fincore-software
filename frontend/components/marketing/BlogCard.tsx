import Link from 'next/link'
import { Calendar, User } from 'lucide-react'
import { formatDate } from '@/shared/utils/date'

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  author: string
  date: string
  coverImage?: string
  tags: string[]
}

interface BlogCardProps {
  post: BlogPost
}

export function BlogCard({ post }: BlogCardProps) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="overflow-hidden rounded-lg border border-border bg-white transition-shadow hover:shadow-md">
        <div className="h-48 bg-surface-2 group-hover:bg-surface" />
        <div className="p-6">
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent">
                {tag}
              </span>
            ))}
          </div>
          <h3 className="text-xl font-semibold text-text-primary group-hover:text-accent transition-colors">
            {post.title}
          </h3>
          <p className="mt-2 text-text-tertiary line-clamp-2">{post.excerpt}</p>
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
      </div>
    </Link>
  )
}