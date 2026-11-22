import type { RoleName } from '../../../shared/src/index.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AccountInput {
  fullName: string
  email: string
  password: string
  phone?: string
}

export function readAccountInput(body: unknown): AccountInput {
  const record = asRecord(body)
  return {
    fullName: readName(record.fullName),
    email: readEmail(record.email),
    password: readPassword(record.password),
    phone: readOptionalPhone(record.phone),
  }
}

export function readLoginInput(body: unknown): { email: string; password: string } {
  const record = asRecord(body)
  return {
    email: readEmail(record.email),
    password: typeof record.password === 'string' ? record.password : '',
  }
}

export function readStaffRole(body: unknown): Exclude<RoleName, 'tourist'> {
  const record = asRecord(body)
  const role = record.role
  if (role === 'administrator' || role === 'tour_guide' || role === 'receptionist') {
    return role
  }
  throw new Error('Choose a staff role: administrator, tour guide, or receptionist.')
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}

function readName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Enter a full name.')
  }
  const name = clean(value)
  if (name.length < 2 || name.length > 120) {
    throw new Error('Full name must be 2 to 120 characters.')
  }
  return name
}

function readEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('Enter an email address.')
  }
  const email = clean(value).toLowerCase()
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new Error('Enter a valid email address.')
  }
  return email
}

function readPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
    throw new Error('Password must be 8 to 72 characters.')
  }
  return value
}

function readOptionalPhone(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  if (typeof value !== 'string') {
    throw new Error('Enter a phone number or leave it blank.')
  }
  const phone = clean(value)
  if (phone.length < 7 || phone.length > 30) {
    throw new Error('Phone number must be 7 to 30 characters.')
  }
  return phone
}

function clean(value: string): string {
  return value.replaceAll('\0', '').trim()
}
