'use client'

import { useState }                from 'react'
import { useRouter }               from 'next/navigation'
import { useAuthStore }            from '@/modules/auth'
import { apiClient }               from '@/shared/lib/api-client'
import { Card, Button }            from '@/shared/ui'
import { Building2, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { OrganizationMembership } from '@/shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)
}

function setClientCookie(name: string, value: string, maxAgeSecs = 7 * 24 * 60 * 60) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSecs}; SameSite=Lax`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FieldError {
  name?:    string
  slug?:    string
  general?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateOrganizationPage() {
  const router = useRouter()
  const { userMemberships, setUserMemberships, setActiveOrganizationId } = useAuthStore()

  const [name,               setName]               = useState('')
  const [slug,               setSlug]               = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [errors,             setErrors]             = useState<FieldError>({})
  const [isLoading,          setIsLoading]          = useState(false)
  const [success,            setSuccess]            = useState(false)

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugManuallyEdited) setSlug(toSlug(value))
    setErrors((prev) => ({ ...prev, name: undefined, general: undefined }))
  }

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
    setSlugManuallyEdited(true)
    setErrors((prev) => ({ ...prev, slug: undefined, general: undefined }))
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const next: FieldError = {}
    if (!name.trim()) {
      next.name = 'Organization name is required'
    } else if (name.trim().length < 2) {
      next.name = 'Name must be at least 2 characters'
    } else if (name.trim().length > 100) {
      next.name = 'Name must be 100 characters or fewer'
    }
    if (!slug) {
      next.slug = 'Slug is required'
    } else if (!isValidSlug(slug)) {
      next.slug = 'Slug must be 3–50 lowercase letters, numbers, or hyphens, and cannot start or end with a hyphen'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!validate()) return
    setIsLoading(true)
    setErrors({})

    try {
      const data = await apiClient.post<{
        id:        string
        name:      string
        slug:      string
        createdAt: string
      }>('/organizations', { name: name.trim(), slug })

      // 1. Build new membership record
      const newMembership: OrganizationMembership = {
        organizationId:   data.id,
        organizationName: data.name,
        organizationSlug: data.slug,
        role:             'OWNER',
        isDefault:        false,
      }

      // 2. Update Zustand store with new membership list
      const updatedMemberships = [...(userMemberships ?? []), newMembership]
      setUserMemberships(updatedMemberships)

      // 3. Set new org as active
      setActiveOrganizationId(data.id)

      // 4. CRITICAL: Update fincore_orgs cookie so the proxy allows /:newOrgId
      //    Without this the proxy sees the new orgId is not in the allowed list
      //    and redirects back to /select immediately after navigation.
      const orgIds = updatedMemberships.map((m) => m.organizationId).join(',')
      setClientCookie('fincore_orgs', orgIds)

      setSuccess(true)

      // 5. Navigate to the new org dashboard
      setTimeout(() => router.push(`/${data.id}`), 900)

    } catch (err: unknown) {
      const apiError = err as { statusCode?: number; message?: string }
      if (apiError.statusCode === 409) {
        setErrors({ slug: 'This slug is already taken. Please choose another.' })
        return
      }
      if (apiError.statusCode === 400) {
        setErrors({ general: apiError.message ?? 'Invalid request' })
        return
      }
      setErrors({ general: apiError.message ?? 'Something went wrong. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-canvas via-surface to-canvas flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center animate-fade-up">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-accent-subtle flex items-center justify-center mb-6">
            <CheckCircle2 className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Organization created!</h2>
          <p className="text-sm text-text-tertiary">Taking you to your dashboard…</p>
        </Card>
      </div>
    )
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-canvas via-surface to-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-up">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-4">
            <span className="text-white text-xl font-bold">F</span>
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Create Organization</h1>
          <p className="text-sm text-text-tertiary mt-2">Set up a new workspace for your team</p>
        </div>

        {/* Form Card */}
        <Card className="p-6 space-y-5">

          {errors.general && (
            <div className="flex items-start gap-3 rounded-lg border border-danger-subtle bg-danger-subtle px-4 py-3">
              <AlertCircle className="h-4 w-4 text-danger mt-0.5 shrink-0" />
              <p className="text-sm text-danger-text">{errors.general}</p>
            </div>
          )}

          {/* Organization Name */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Organization Name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Acme Corp"
              maxLength={100}
              disabled={isLoading}
              className={[
                'w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-text-primary',
                'placeholder:text-text-disabled outline-none transition-all',
                'focus:border-accent focus:ring-2 focus:ring-accent/20',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                errors.name ? 'border-danger focus:border-danger focus:ring-danger-subtle' : 'border-border',
              ].join(' ')}
            />
            {errors.name
              ? <p className="text-xs text-danger-text">{errors.name}</p>
              : <p className="text-xs text-text-tertiary">Display name shown across your workspace.</p>
            }
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-primary">
              Slug <span className="text-danger">*</span>
            </label>
            <div className={[
              'flex items-center rounded-lg border bg-white transition-all',
              'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20',
              errors.slug ? 'border-danger' : 'border-border',
            ].join(' ')}>
              <span className="select-none pl-3.5 text-sm text-text-tertiary whitespace-nowrap">
                fincore.app/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="acme-corp"
                maxLength={50}
                disabled={isLoading}
                className="flex-1 rounded-r-lg bg-transparent py-2.5 pr-3.5 text-sm text-text-primary placeholder:text-text-disabled outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            {errors.slug
              ? <p className="text-xs text-danger-text">{errors.slug}</p>
              : <p className="text-xs text-text-tertiary">Lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.</p>
            }
          </div>

          {/* Owner notice */}
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Building2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <p className="text-xs text-text-tertiary leading-relaxed">
              You will be assigned as <span className="font-medium text-text-primary">Owner</span> of
              this organization and can invite team members afterward.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !name.trim() || !slug}
              className="flex-1 gap-2"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
              ) : (
                <><Building2 className="h-4 w-4" />Create Organization</>
              )}
            </Button>
          </div>
        </Card>

        <p className="text-center text-xs text-text-tertiary mt-8">
          Already part of an organization?{' '}
          <button onClick={() => router.push('/select')} className="text-accent underline-offset-2 hover:underline">
            Select it here
          </button>
        </p>
      </div>
    </div>
  )
}

// Sprint note: S5-create-org — proxy fix (organization in nonTenantSegments) + fincore_orgs update