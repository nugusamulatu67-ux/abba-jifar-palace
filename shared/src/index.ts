/** Name returned by the API health check. */
export const API_SERVICE_NAME = 'abba-jifar-api'

export type HealthStatus = 'ok' | 'degraded'

export type DatabaseStatus = 'connected' | 'unavailable'

export interface DatabaseHealth {
  status: DatabaseStatus
  message: string
}

/** JSON body of GET /api/health. */
export interface HealthResponse {
  status: HealthStatus
  service: string
  time: string
  database: DatabaseHealth
}

export const ROLE_NAMES = ['administrator', 'tourist', 'tour_guide', 'receptionist'] as const

export type RoleName = (typeof ROLE_NAMES)[number]

/** Account fields safe to send to the browser. Password hashes are never included. */
export interface PublicUser {
  id: number
  fullName: string
  email: string
  role: RoleName
  status: 'active' | 'inactive'
}

export const ROLE_LABELS: Record<RoleName, string> = {
  administrator: 'Administrator',
  tourist: 'Tourist',
  tour_guide: 'Tour guide',
  receptionist: 'Receptionist',
}

/** Palace local time. Ethiopia does not use daylight saving. */
export const PALACE_TIME_ZONE = 'Africa/Addis_Ababa'

export type PackageStatus = 'active' | 'inactive' | 'archived'

export type ScheduleStatus = 'scheduled' | 'cancelled' | 'completed'

export interface PublicTourPackage {
  id: number
  name: string
  description: string
  priceEtb: number
  durationMinutes: number
  category: string
  includedActivities: string
  maxGroupSize: number | null
  upcomingCount: number
  nextStartsAt: string | null
}

export interface PublicSchedule {
  id: number
  packageId: number
  startsAt: string
  endsAt: string
  maxCapacity: number
  remainingCapacity: number
  bookable: boolean
}

export interface PublicTourDetail extends PublicTourPackage {
  schedules: PublicSchedule[]
}

export interface AdminTourPackage {
  id: number
  name: string
  description: string
  priceEtb: number
  durationMinutes: number
  category: string
  includedActivities: string
  maxGroupSize: number | null
  status: PackageStatus
  createdAt: string
  updatedAt: string
}

export interface AdminSchedule {
  id: number
  packageId: number
  packageName: string
  packageStatus: PackageStatus
  startsAt: string
  endsAt: string
  maxCapacity: number
  remainingCapacity: number
  status: ScheduleStatus
  bookable: boolean
  createdAt: string
  updatedAt: string
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled'

export interface BookingView {
  reference: string
  scheduleId: number
  packageId: number
  packageName: string
  startsAt: string
  endsAt: string
  partySize: number
  totalEtb: number
  status: BookingStatus
  createdAt: string
  cancelledAt: string | null
  canCancel: boolean
  canConfirm: boolean
}

export type PaymentStatus = 'unpaid' | 'paid'

export type PaymentMethod = 'cash' | 'transfer'

export type TicketStatus = 'valid' | 'void'

export interface TicketView {
  status: TicketStatus
  issuedAt: string
  qrDataUrl: string | null
}

export interface PaymentView {
  reference: string
  packageName: string
  startsAt: string
  endsAt: string
  partySize: number
  bookingStatus: BookingStatus
  amountEtb: number
  paymentStatus: PaymentStatus
  method: PaymentMethod | null
  paidAt: string | null
  ticket: TicketView | null
}

export interface PaymentListItem {
  reference: string
  touristName: string
  packageName: string
  startsAt: string
  partySize: number
  bookingStatus: BookingStatus
  amountEtb: number
  paymentStatus: PaymentStatus
  method: PaymentMethod | null
  paidAt: string | null
}

export interface PaymentAuditEntry {
  action: string
  actorName: string | null
  createdAt: string
  method: string | null
  amountEtb: number | null
}

export interface StaffPaymentView extends PaymentView {
  touristName: string
  recordedByName: string | null
  audits: PaymentAuditEntry[]
}

export interface PublicTicketCheck {
  palace: 'Abba Jifar Palace'
  valid: boolean
  ticketStatus: TicketStatus
  reference: string
  packageName: string
  startsAt: string
  endsAt: string
  partySize: number
}

