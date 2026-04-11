// src/app/(auth)/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in' };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (hidden on mobile) ─────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[480px] xl:w-[560px] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--color-accent)' }}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 20%, #ffffff 1px, transparent 1px),
                              radial-gradient(circle at 70% 80%, #ffffff 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">FinCore</span>
          </div>
        </div>

        {/* Testimonial / value prop */}
        <div className="relative z-10 space-y-8">
          <blockquote className="space-y-4">
            <p className="text-white/90 text-xl font-light leading-relaxed">
              &quot;FinCore replaced three tools overnight. Invoicing, expenses, payroll — all in one clean dashboard.&quot;
            </p>
            <footer>
              <p className="text-white font-semibold text-sm">Ahmad Saeed</p>
              <p className="text-white/60 text-sm">CFO, Nexus Technologies</p>
            </footer>
          </blockquote>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
            {[
              { value: '2,400+', label: 'Businesses' },
              { value: '₨ 4B+', label: 'Invoiced' },
              { value: '99.9%', label: 'Uptime' },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-white font-bold text-xl">{s.value}</p>
                <p className="text-white/60 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right content area ────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10"
        style={{ background: 'var(--color-canvas)' }}
      >
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--color-accent)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white">
              <path
                d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            FinCore
          </span>
        </div>

        <div className="w-full max-w-[420px]">
          {children}
        </div>
      </div>
    </div>
  );
}