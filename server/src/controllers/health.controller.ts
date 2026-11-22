import type { Request, Response } from 'express'
import { getHealth } from '../services/health.service.ts'

export async function getHealthStatus(_req: Request, res: Response): Promise<void> {
  const health = await getHealth()
  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
}
