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
