import type { NextFunction, Request, Response } from 'express'
import type { AppRequest } from '../middleware/authenticate.ts'
import {
  adminHistory,
  adminSummary,
  checkIn,
  checkInStatus,
  previewByReference,
  previewByToken,
  receptionHistory,
} from '../services/checkin.service.ts'

export async function getCheckInPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readQuery(req.query.token)
    const reference = readQuery(req.query.reference)
    if (token && reference) {
      res.status(400).json({ error: 'Search by a ticket or a booking reference.' })
      return
    }
    if (token) {
      res.json({ preview: await previewByToken(readToken(token)) })
      return
    }
    res.json({ preview: await previewByReference(readReference(reference)) })
  } catch (error) {
    sendCheckInError(res, error, next)
  }
}

export async function postCheckIn(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AppRequest).user
    if (!user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    const body = asRecord(req.body)
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const reference = typeof body.reference === 'string' ? body.reference.trim() : ''
    if ((token && reference) || (!token && !reference)) {
      res.status(400).json({ error: 'Provide a ticket or a booking reference.' })
      return
    }
    const saved = await checkIn(user.id, {
      token: token ? readToken(token) : undefined,
      reference: reference ? readReference(reference) : undefined,
    })
    res.status(201).json({ checkIn: saved })
  } catch (error) {
    sendCheckInError(res, error, next)
  }
}

export async function getReceptionCheckIns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = readPage(req.query)
    res.json({
      history: await receptionHistory(readSearch(req.query.q), readDate(req.query.date), page.page, page.pageSize),
    })
  } catch (error) {
    sendCheckInError(res, error, next)
  }
}

export async function getAdminCheckIns(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = readPage(req.query)
    const packageId = readOptionalId(req.query.tourId)
    res.json({
      history: await adminHistory(readSearch(req.query.q), readDate(req.query.date), packageId, page.page, page.pageSize),
    })
  } catch (error) {
    sendCheckInError(res, error, next)
  }
}

export async function getAdminCheckInSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ summary: await adminSummary(readDate(req.query.date)) })
  } catch (error) {
    sendCheckInError(res, error, next)
  }
}

function readReference(value: string): string {
  if (!/^AJ-[A-Z0-9]{6,12}$/.test(value)) {
    throw new Error('Enter a booking reference.')
  }
  return value
}

function readToken(value: string): string {
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(value)) {
    throw new Error('That code is not a palace ticket.')
  }
  return value
}

function readDate(value: unknown): string {
  const text = readQuery(value)
  if (text && !/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new Error('Enter the visit date as YYYY-MM-DD.')
  }
  return text
}

function readSearch(value: unknown): string {
  return readQuery(value).replaceAll('%', '').replaceAll('_', '')
}

function readOptionalId(value: unknown): number | null {
  const text = readQuery(value)
  if (!text) {
    return null
  }
  const parsed = Number(text)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Choose a tour.')
  }
  return parsed
}

function readPage(query: Request['query']): { page: number; pageSize: number } {
  const page = readPositive(query.page, 1, 1000, 'Enter a valid page.')
  const pageSize = readPositive(query.pageSize, 20, 50, 'Enter a page size from 1 to 50.')
  return { page, pageSize }
}

function readPositive(value: unknown, fallback: number, max: number, message: string): number {
  const text = readQuery(value)
  if (!text) {
    return fallback
  }
  const parsed = Number(text)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
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

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new Error('Request body must be a JSON object.')
  }
  return body as Record<string, unknown>
}

function sendCheckInError(res: Response, error: unknown, next: NextFunction): void {
  if (error instanceof Error && isValidationMessage(error.message)) {
    const status = error.message.startsWith('Sign in') ? 401 : error.message.startsWith('That ticket') ? 404 : 400
    res.status(status).json({ error: error.message })
    return
  }
  const known = checkInStatus(error)
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
    message.startsWith('Provide') ||
    message.startsWith('Search by') ||
    message.startsWith('Request body') ||
    message.startsWith('That code') ||
    message.startsWith('That ticket') ||
    message.startsWith('Sign in')
  )
}
