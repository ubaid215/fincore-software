'use client';
// src/components/auth/AuthCard.tsx

interface AuthCardProps {
  title:       string;
  description?: string;
  children:    React.ReactNode;
  footer?:     React.ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.025em' }}
        >
          {title}
        </h1>
        {description && (
          <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {description}
          </p>
        )}
      </div>

      {/* Form content */}
      <div
        className="rounded-xl border p-6 shadow-sm"
        style={{
          background:   'var(--color-white)',
          borderColor:  'var(--color-border)',
          boxShadow:    '0 1px 3px 0 rgba(26,25,22,0.06), 0 1px 2px -1px rgba(26,25,22,0.04)',
        }}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

// ── Reusable form field wrapper ────────────────────────────────────────────────

interface FieldProps {
  label:    string;
  htmlFor:  string;
  error?:   string;
  hint?:    string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium tracking-wide"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{hint}</p>
      )}
      {error && (
        <p className="text-xs font-medium" style={{ color: 'var(--color-danger)' }}>{error}</p>
      )}
    </div>
  );
}

// ── Primary button ─────────────────────────────────────────────────────────────

interface AuthButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  fullWidth?: boolean;
}

export function AuthButton({
  loading, children, variant = 'primary', fullWidth = true, disabled, ...props
}: AuthButtonProps) {
  const base = `
    inline-flex items-center justify-center gap-2 font-medium text-sm
    rounded-lg transition-all duration-120 cursor-pointer select-none
    focus-visible:outline-2 focus-visible:outline-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
    active:scale-[0.98]
    h-10 px-4
    ${fullWidth ? 'w-full' : ''}
  `;

  const variants = {
    primary: `text-white`,
    outline: `border`,
    ghost:   ``,
  };

  const styles = {
    primary: {
      background: loading ? 'var(--color-accent-hover)' : 'var(--color-accent)',
      outline:    `2px solid var(--color-accent)`,
    } as React.CSSProperties,
    outline: {
      background:  'var(--color-white)',
      borderColor: 'var(--color-border)',
      color:       'var(--color-text-primary)',
    } as React.CSSProperties,
    ghost: {
      background: 'transparent',
      color:      'var(--color-text-secondary)',
    } as React.CSSProperties,
  };

  return (
    <button
      className={`${base} ${variants[variant]}`}
      style={styles[variant]}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ── Divider with text ──────────────────────────────────────────────────────────

export function AuthDivider({ text }: { text: string }) {
  return (
    <div className="relative flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
        {text}
      </span>
      <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
    </div>
  );
}

// ── Input component ───────────────────────────────────────────────────────────

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function AuthInput({ error, leftIcon, rightElement, className = '', ...props }: AuthInputProps) {
  return (
    <div className="relative">
      {leftIcon && (
        <div
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {leftIcon}
        </div>
      )}
      <input
        className={`
          w-full h-10 rounded-lg border text-sm transition-all
          ${leftIcon ? 'pl-9' : 'pl-3'}
          ${rightElement ? 'pr-10' : 'pr-3'}
          ${className}
        `}
        style={{
          background:   'var(--color-white)',
          borderColor:  error ? 'var(--color-danger)' : 'var(--color-border)',
          color:        'var(--color-text-primary)',
          boxShadow:    error ? '0 0 0 3px rgba(184,48,48,0.10)' : undefined,
        }}
        {...props}
      />
      {rightElement && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {rightElement}
        </div>
      )}
    </div>
  );
}