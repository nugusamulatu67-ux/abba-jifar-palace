import { randomBytes } from 'node:crypto'
import { toDataURL } from 'qrcode'
import type { PaymentListItem, PaymentMethod, PaymentView, PublicTicketCheck, PublicUser, StaffPaymentView } from '../../../shared/src/index.ts'
import { env } from '../config/env.ts'
import { pool } from '../config/database.ts'
import { getDatabaseErrorCode, getDatabaseErrorMessage } from '../db/errors.ts'
import { withTransaction } from '../db/transaction.ts'
import {
  findPayment,
  findTicketByToken,
  insertTicket,
  listPaymentAudits,
  listPayments,
  lockPayment,
  markPaid,
  writePaymentAudit,
  type PaymentRecord,
} from '../repositories/payment.repository.ts'

export class PaymentError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function paymentStatus(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof PaymentError) {
    return { status: error.status, message: error.message }
  }
  return undefined
}

export async function viewPayment(user: PublicUser, reference: string): Promise<PaymentView | StaffPaymentView> {
  if (user.role === 'tour_guide') {
    throw new PaymentError('You do not have access to this action.', 403)
  }
  const row = await findPayment(reference)
  if (!row || !canRead(user, row)) {
    throw new PaymentError('That booking was not found.', 404)
  }
  if (user.role === 'tourist') {
    return toPaymentView(row)
  }
  return toStaffView(row, false)
}

export async function staffPayments(search: string, status: string, method: string): Promise<PaymentListItem[]> {
  return listPayments(search, status, method)
}

export async function adminPayment(reference: string): Promise<StaffPaymentView> {
  const row = await findPayment(reference)
  if (!row) {
    throw new PaymentError('That booking was not found.', 404)
  }
  return toStaffView(row, true)
}

export async function recordPayment(userId: number, reference: string, method: PaymentMethod): Promise<StaffPaymentView> {
  await withTransaction(pool, async (client) => {
    const row = await lockPayment(client, reference)
    if (!row) {
      throw new PaymentError('That booking was not found.', 404)
    }
    if (row.bookingStatus === 'cancelled') {
      throw new PaymentError('A cancelled booking cannot be paid.', 400)
    }
    if (row.paymentStatus === 'paid') {
      throw new PaymentError('This booking is already paid.', 409)
    }
    const amountEtb = row.priceEtb * row.partySize
    if (!Number.isSafeInteger(amountEtb) || amountEtb < 0 || amountEtb > 1_000_000) {
      throw new PaymentError('The payable amount could not be calculated.', 400)
    }

    try {
      await markPaid(client, row.bookingId, method, amountEtb, userId)
      const token = newTicketToken()
      let ticketId: number
      try {
        ticketId = await insertTicket(client, row.bookingId, token)
      } catch (error) {
        if (getDatabaseErrorCode(error) !== '23505') {
          throw error
        }
        ticketId = await insertTicket(client, row.bookingId, newTicketToken())
      }
      await writePaymentAudit(client, userId, 'payment.record', 'payment', reference, {
        method,
        amountEtb,
        bookingReference: reference,
      })
      await writePaymentAudit(client, userId, 'ticket.issue', 'ticket', reference, {
        ticketId,
      })
    } catch (error) {
      throw mapPaymentError(error)
    }
  })

  return adminPayment(reference)
}

export async function verifyTicket(token: string): Promise<PublicTicketCheck> {
  const ticket = await findTicketByToken(token)
  if (!ticket) {
    throw new PaymentError('That ticket was not found.', 404)
  }
  return {
    palace: 'Abba Jifar Palace',
    valid: ticket.status === 'valid',
    ticketStatus: ticket.status,
    reference: ticket.reference,
    packageName: ticket.packageName,
    startsAt: ticket.startsAt.toISOString(),
    endsAt: ticket.endsAt.toISOString(),
    partySize: ticket.partySize,
  }
}

export function ticketUrl(token: string): string {
  return `${env.clientOrigin}/tickets/verify/${token}`
}

function canRead(user: PublicUser, row: PaymentRecord): boolean {
  if (user.role === 'tourist') {
    return row.touristUserId === user.id
  }
  return user.role === 'receptionist' || user.role === 'administrator'
}

async function toPaymentView(row: PaymentRecord): Promise<PaymentView> {
  const paid = row.paymentStatus === 'paid'
  return {
    reference: row.reference,
    packageName: row.packageName,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    partySize: row.partySize,
    bookingStatus: row.bookingStatus,
    amountEtb: paid ? row.amountEtb : row.priceEtb * row.partySize,
    paymentStatus: row.paymentStatus,
    method: paid ? row.method : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    ticket: await ticketView(row),
  }
}

async function toStaffView(row: PaymentRecord, withAudits: boolean): Promise<StaffPaymentView> {
  return {
    ...(await toPaymentView(row)),
    touristName: row.touristName,
    recordedByName: row.paymentStatus === 'paid' ? row.recordedByName : null,
    audits: withAudits ? await listPaymentAudits(row.reference) : [],
  }
}

async function ticketView(row: PaymentRecord): Promise<PaymentView['ticket']> {
  if (!row.ticketStatus || !row.ticketIssuedAt) {
    return null
  }
  const qrDataUrl = row.ticketStatus === 'valid' && row.ticketToken ? await ticketQr(row.ticketToken) : null
  return {
    status: row.ticketStatus,
    issuedAt: row.ticketIssuedAt.toISOString(),
    qrDataUrl,
  }
}

async function ticketQr(token: string): Promise<string> {
  return toDataURL(ticketUrl(token), { margin: 1, width: 280, errorCorrectionLevel: 'M' })
}

function newTicketToken(): string {
  return randomBytes(32).toString('base64url')
}

function mapPaymentError(error: unknown): unknown {
  if (error instanceof PaymentError) {
    return error
  }
  const message = getDatabaseErrorMessage(error)
  if (message.includes('payment_already_recorded')) {
    return new PaymentError('This booking is already paid.', 409)
  }
  if (message.includes('payment_booking_cancelled')) {
    return new PaymentError('A cancelled booking cannot be paid.', 400)
  }
  if (message.includes('staff_actor_required')) {
    return new PaymentError('Only reception or an administrator can record a payment.', 403)
  }
  return error
}
