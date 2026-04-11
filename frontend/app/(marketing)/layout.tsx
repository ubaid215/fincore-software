/**
 * app/(marketing)/layout.tsx
*/

import type { Metadata } from 'next'
import { MarketingNavbar } from '@/components/marketing/MarketingNavbar'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

export const metadata: Metadata = {
  title: {
    default: 'Fincore — Modern Accounting & ERP Platform',
    template: '%s | Fincore',
  },
  description:
    'Streamline your finances with Fincore. Invoicing, expense tracking, payroll, inventory, and financial reporting in one powerful platform.',
  keywords: ['accounting', 'ERP', 'invoicing', 'payroll', 'finance', 'business management'],
  openGraph: {
    title: 'Fincore — Modern Accounting & ERP Platform',
    description: 'Streamline your finances with Fincore. All-in-one business management platform.',
    url: 'https://fincore.app',
    siteName: 'Fincore',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Fincore - Modern Accounting Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fincore — Modern Accounting & ERP Platform',
    description: 'Streamline your finances with Fincore.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNavbar />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  )
}
