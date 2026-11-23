import type { NextFunction, Request, Response } from 'express'
import type { PaymentMethod } from '../../../shared/src/index.ts'
import type { AppRequest } from '../middleware/authenticate.ts'
import {
  adminPayment,
  paymentStatus,
  recordPayment,
  staffPayments,
  verifyTicket,
  viewPayment,
} from '../services/payment.service.ts'

export async function getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AppRequest).user
    if (!user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    res.json({ payment: await viewPayment(user, readReference(req.params.reference)) })
  } catch (error) {
    sendPaymentError(res, error, next)
  }
}

export async function getReceptionPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = readSearch(req.query.q)
    res.json({ payments: await staffPayments(search, '', '') })
  } catch (error) {
    sendPaymentError(res, error, next)
  }
}

export async function postReceptionPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  await postRecordedPayment(req, res, next)
}

export async function getAdminPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = readQuery(req.query.status)
    if (status && status !== 'unpaid' && status !== 'paid') {
      res.status(400).json({ error: 'Filter by unpaid or paid.' })
      return
    }
    const method = readQuery(req.query.method)
    if (method && method !== 'cash' && method !== 'transfer') {
      res.status(400).json({ error: 'Filter by cash or transfer.' })
      return
    }
    const search = readSearch(req.query.q)
    res.json({ payments: await staffPayments(search, status, method) })
  } catch (error) {
    sendPaymentError(res, error, next)
  }
}

export async function getAdminPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ payment: await adminPayment(readReference(req.params.reference)) })
  } catch (error) {
    sendPaymentError(res, error, next)
  }
}

export async function postAdminPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  await postRecordedPayment(req, res, next)
}

export async function getTicketVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readToken(req.params.token)
    res.json({ ticket: await verifyTicket(token) })
  } catch (error) {
    sendPaymentError(res, error, next)
  }
}

async function postRecordedPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = (req as AppRequest).user
    if (!user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    const body = asRecord(req.body)
    const payment = await recordPayment(user.id, readReference(body.reference), readMethod(body.method))
    res.status(201).json({ payment })
  } catch (error) {
    sendPaymentError(res, error, next)
  }
}

function readReference(value: unknown): string {
  const text = Array.isArray(value) ? value[0] : value
  if (typeof text !== 'string' || !/^AJ-[A-Z0-9]{6,12}$/.test(text)) {
    throw new Error('Enter a booking reference.')
  }
  return text
}

function readToken(value: unknown): string {
  const text = Array.isArray(value) ? value[0] : value
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]{32,80}$/.test(text)) {
    throw new Error('That ticket was not found.')
  }
  return text
}

function readMethod(value: unknown): PaymentMethod {
  if (value === 'cash' || value === 'transfer') {
    return value
  }
  throw new Error('Choose cash or bank transfer.')
}

function readSearch(value: unknown): string {
  return readQuery(value).replaceAll('%', '').replaceAll('_', '')
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

function sendPaymentError(res: Response, error: unknown, next: NextFunction): void {
  if (error instanceof Error && error.message === 'That ticket was not found.') {
    res.status(404).json({ error: error.message })
    return
  }
  if (error instanceof Error && isValidationMessage(error.message)) {
    res.status(error.message.startsWith('Sign in') ? 401 : 400).json({ error: error.message })
    return
  }
  const known = paymentStatus(error)
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
