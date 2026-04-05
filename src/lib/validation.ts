// Validation utilities for API input sanitization

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PHONE_REGEX = /^(\(\d{2}\)\s?\d{4,5}-\d{4}|\d{10,11})$/

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const VALID_PLAN_SLUGS = ['free', 'simples', 'profissional'] as const

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

export function validatePhone(phone: string): boolean {
  // Strip common formatting characters to be permissive
  const stripped = phone.replace(/[\s\-().+]/g, '')
  // After stripping, should be 10–11 digits (Brazilian landline or mobile)
  if (/^\d{10,11}$/.test(stripped)) return true
  // Also accept the formatted pattern directly
  return PHONE_REGEX.test(phone.trim())
}

export function validateCurrency(amount: number): boolean {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return false
  return amount > 0 && amount <= 999999.99
}

export function sanitizeString(str: string, maxLength = 500): string {
  return str
    .trim()
    .replace(/\0/g, '')
    .slice(0, maxLength)
}

export function validateUUID(id: string): boolean {
  return UUID_V4_REGEX.test(id)
}

export function validatePlanSlug(slug: string): slug is 'free' | 'simples' | 'profissional' {
  return (VALID_PLAN_SLUGS as readonly string[]).includes(slug)
}
