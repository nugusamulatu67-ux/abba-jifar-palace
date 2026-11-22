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

