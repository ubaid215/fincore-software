import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Fincore',
    template: '%s · Fincore',
  },
  description: 'Modern accounting & ERP platform for growing businesses',
  keywords: ['accounting', 'invoicing', 'ERP', 'finance', 'payroll'],
  authors: [{ name: 'Fincore' }],
  creator: 'Fincore',
  robots: { index: false, follow: false }, // private SaaS — no indexing
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#FAFAF9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}