import { API_SERVICE_NAME, type HealthResponse } from '../../../shared/src/index.ts'
import { checkDatabaseConnection } from '../config/database.ts'

export function getHealth(): HealthResponse {
  const database = checkDatabaseConnection()

  return {
    status: database.status === 'connected' ? 'ok' : 'degraded',
    service: API_SERVICE_NAME,
    time: new Date().toISOString(),
    database,
  }
}
