import type { NextFunction, Request, Response } from 'express'
import type { AppRequest } from '../middleware/authenticate.ts'
import {
  adminBooking,
  adminBookings,
  bookingStatus,
  cancelAdminBooking,
  cancelTouristBooking,
  confirmBooking,
  createTouristBooking,
  touristBooking,
  touristBookings,
} from '../services/booking.service.ts'

export async function getMyBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ bookings: await touristBookings(userId(req)) })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function getMyBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ booking: await touristBooking(userId(req), readReference(req.params.reference)) })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function postMyBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = asRecord(req.body)
    const scheduleId = readInteger(body.scheduleId, 'Choose a departure.')
    const partySize = readInteger(body.partySize, 'Enter the number of visitors.')
    const created = await createTouristBooking(userId(req), scheduleId, partySize)
    res.status(201).json({ booking: created })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function postCancelMyBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cancelled = await cancelTouristBooking(userId(req), readReference(req.params.reference))
    res.json({ booking: cancelled })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function getAdminBookings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = readQuery(req.query.status)
    if (status && status !== 'pending' && status !== 'confirmed' && status !== 'cancelled') {
      res.status(400).json({ error: 'Filter by pending, confirmed, or cancelled.' })
      return
    }
    const date = readQuery(req.query.date)
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Enter the tour date as YYYY-MM-DD.' })
      return
    }
    const search = readQuery(req.query.q).replaceAll('%', '').replaceAll('_', '')
    res.json({ bookings: await adminBookings(search, status, date) })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function getAdminBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ booking: await adminBooking(readReference(req.params.reference)) })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function postConfirmBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const confirmed = await confirmBooking(userId(req), readReference(req.params.reference))
    res.json({ booking: confirmed })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

export async function postCancelAdminBooking(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cancelled = await cancelAdminBooking(userId(req), readReference(req.params.reference))
    res.json({ booking: cancelled })
  } catch (error) {
    sendBookingError(res, error, next)
  }
}

function userId(req: Request): number {
  const id = (req as AppRequest).user?.id
  if (!id) {
    throw new Error('Sign in to continue.')
  }
  return id
}

function readReference(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] : value
  if (!text || !/^AJ-[A-Z0-9]{6,12}$/.test(text)) {
    throw new Error('Enter a booking reference.')
  }
  return text
}

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}

function readInteger(value: unknown, message: string): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(message)
  }
  return parsed
}

function readQuery(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.replaceAll('\0', '').trim().slice(0, 80)
}

function sendBookingError(res: Response, error: unknown, next: NextFunction): void {
  if (error instanceof Error && isValidationMessage(error.message)) {
    res.status(error.message.startsWith('Sign in') ? 401 : 400).json({ error: error.message })
    return
  }
  const known = bookingStatus(error)
  if (known) {
    res.status(known.status).json({ error: known.message })
    return
  }
  next(error)
}

function isValidationMessage(message: string): boolean {
  return (
    message.startsWith('Enter') ||
    message.startsWith('Choose') ||
    message.startsWith('Request body') ||
    message.startsWith('Filter by') ||
    message.startsWith('Sign in')
  )
}
