import { Card } from '@/shared/ui'

export const metadata = {
  title: 'Authentication',
  description: 'Sign in or create an account',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto w-10 h-10 bg-accent rounded-lg flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="8" height="8" rx="2" />
              <rect x="13" y="3" width="8" height="8" rx="2" />
              <rect x="3" y="13" width="8" height="8" rx="2" />
              <rect x="13" y="13" width="8" height="8" rx="2" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Fincore</h1>
          <p className="text-sm text-text-tertiary mt-1">Modern accounting & ERP</p>
        </div>
        {children}
      </Card>
    </div>
  )
}