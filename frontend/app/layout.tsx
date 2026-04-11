// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { DM_Sans, DM_Mono }       from 'next/font/google';
import { Toaster }                 from 'sonner';
import { AuthProvider }            from '../components/layout/AuthProvider';
import './globals.css';

const dmSans = DM_Sans({
  subsets:  ['latin'],
  variable: '--font-sans',
  weight:   ['300', '400', '500', '600', '700'],
  display:  'swap',
});

const dmMono = DM_Mono({
  subsets:  ['latin'],
  variable: '--font-mono',
  weight:   ['300', '400', '500'],
  display:  'swap',
});

export const metadata: Metadata = {
  title:       { default: 'FinCore', template: '%s — FinCore' },
  description: 'Modern finance software for SMEs, freelancers, and growing businesses.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'),
};

export const viewport: Viewport = {
  themeColor:     '#2A7D6F',
  width:          'device-width',
  initialScale:   1,
  maximumScale:   1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily:   'var(--font-sans)',
              fontSize:     '0.875rem',
              borderRadius: '8px',
              border:       '1px solid var(--color-border)',
            },
          }}
        />
      </body>
    </html>
  );
}