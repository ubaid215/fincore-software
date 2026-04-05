/**
 * Truncate a string to max length and add ellipsis
 */
export function truncate(str: string, maxLength: number, ellipsis: string = '…'): string {
  if (!str || str.length <= maxLength) return str
  return str.slice(0, maxLength - ellipsis.length) + ellipsis
}

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Capitalize each word in a string
 */
export function capitalizeWords(str: string): string {
  if (!str) return ''
  return str.split(' ').map(capitalize).join(' ')
}

/**
 * Generate a URL-friendly slug from a string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove special chars
    .replace(/[\s_-]+/g, '-')   // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '')    // Trim hyphens from ends
}

/**
 * Get initials from a name (max 2 characters)
 */
export function getInitials(firstName: string, lastName?: string | null): string {
  const first = firstName?.charAt(0) || ''
  const last = lastName?.charAt(0) || ''
  return (first + last).toUpperCase().slice(0, 2)
}

/**
 * Format a string as a phone number (placeholder — adjust per country)
 */
export function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`
  }
  return value
}

/**
 * Mask sensitive data (e.g., email, bank account)
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : local[0] + '*'
  return `${maskedLocal}@${domain}`
}