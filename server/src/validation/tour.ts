import type { PackageStatus } from '../../../shared/src/index.ts'
import { PALACE_TIME_ZONE } from '../../../shared/src/index.ts'

export interface PackageInput {
  name: string
  description: string
  priceEtb: number
  durationMinutes: number
  category: string
  includedActivities: string
  maxGroupSize: number | null
}

export interface ScheduleInput {
  packageId: number
  startsAt: Date
  endsAt: Date
  maxCapacity: number
}

const NAME_LIMIT = 120
const CATEGORY_LIMIT = 80

export function readPackageInput(body: unknown): PackageInput {
  const record = asRecord(body)
  return {
    name: readText(record.name, 'Enter a package name.', 2, NAME_LIMIT),
    description: readText(record.description, 'Enter a description.', 10, 2000),
    priceEtb: readInteger(record.priceEtb, 'Enter a price in whole birr.', 0, 1_000_000),
    durationMinutes: readInteger(record.durationMinutes, 'Enter the duration in minutes.', 15, 1440),
    category: readText(record.category, 'Enter a tour category.', 2, CATEGORY_LIMIT),
    includedActivities: readOptionalText(record.includedActivities, 2000),
    maxGroupSize: readOptionalInteger(record.maxGroupSize, 'Enter a maximum group size.', 1, 500),
  }
}

export function readPackageStatus(body: unknown): PackageStatus {
  const record = asRecord(body)
  if (record.status === 'active' || record.status === 'inactive' || record.status === 'archived') {
    return record.status
  }
  throw new Error('Choose active, inactive, or archived.')
}

export function readScheduleInput(body: unknown): ScheduleInput {
  const record = asRecord(body)
  const packageId = readInteger(record.packageId, 'Choose a tour package.', 1, Number.MAX_SAFE_INTEGER)
  const startsAt = readPalaceDateTime(record.date, record.startTime, 'start')
  const endsAt = readPalaceDateTime(record.date, record.endTime, 'end')
  if (endsAt <= startsAt) {
    throw new Error('The ending time must be later than the starting time.')
  }
  return {
    packageId,
    startsAt,
    endsAt,
    maxCapacity: readInteger(record.maxCapacity, 'Enter a visitor capacity.', 1, 500),
  }
}

export function readOptionalQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.replaceAll('\0', '').trim().slice(0, 80)
}

function readPalaceDateTime(dateValue: unknown, timeValue: unknown, label: string): Date {
  if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    throw new Error('Enter the tour date.')
  }
  if (typeof timeValue !== 'string' || !/^\d{2}:\d{2}$/.test(timeValue)) {
    throw new Error(`Enter the ${label} time.`)
  }
  const parsed = new Date(`${dateValue}T${timeValue}:00+03:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Enter a real tour date and time.')
  }
  const shown = palaceParts(parsed)
  if (shown.date !== dateValue || shown.time !== timeValue) {
    throw new Error('Enter a real tour date and time.')
  }
  return parsed
}

function palaceParts(value: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PALACE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    time: `${read('hour')}:${read('minute')}`,
  }
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}

function readText(value: unknown, missing: string, min: number, max: number): string {
  if (typeof value !== 'string') {
    throw new Error(missing)
  }
  const text = value.replaceAll('\0', '').trim()
  if (text.length < min || text.length > max) {
    throw new Error(missing.replace('Enter ', 'Use ').replace('.', ` of ${min} to ${max} characters.`))
  }
  return text
}

function readOptionalText(value: unknown, max: number): string {
  if (value === undefined || value === null || value === '') {
    return ''
  }
  if (typeof value !== 'string') {
    throw new Error('Enter the included activities as text.')
  }
  const text = value.replaceAll('\0', '').trim()
  if (text.length > max) {
    throw new Error(`Included activities must be ${max} characters or fewer.`)
  }
  return text
}

function readInteger(value: unknown, message: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(message)
  }
  return parsed
}

function readOptionalInteger(value: unknown, message: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  return readInteger(value, message, min, max)
}
