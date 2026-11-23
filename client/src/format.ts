import { PALACE_TIME_ZONE } from '../../shared/src/index.ts'

export function formatPrice(etb: number): string {
  return `${etb.toLocaleString('en-GB')} ETB`
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours > 0 && rest > 0) {
    return `${hours} h ${rest} min`
  }
  if (hours > 0) {
    return `${hours} h`
  }
  return `${rest} min`
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: PALACE_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function palaceDateAndTime(iso: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PALACE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = read('hour') === '24' ? '00' : read('hour')
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    time: `${hour}:${read('minute')}`,
  }
}
