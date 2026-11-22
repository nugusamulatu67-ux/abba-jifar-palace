import { API_SERVICE_NAME, type HealthResponse } from '../../../shared/src/index.ts'
import { checkDatabaseConnection } from '../config/database.ts'

export async function getHealth(): Promise<HealthResponse> {
  const database = await checkDatabaseConnection()

  return {
    status: database.status === 'connected' ? 'ok' : 'degraded',
    service: API_SERVICE_NAME,
    time: new Date().toISOString(),
    database,
  }
}
