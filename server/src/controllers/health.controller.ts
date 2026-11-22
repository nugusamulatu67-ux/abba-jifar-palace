import type { Request, Response } from 'express'
import { getHealth } from '../services/health.service.ts'

export function getHealthStatus(_req: Request, res: Response): void {
  const health = getHealth()
  const statusCode = health.status === 'ok' ? 200 : 503
  res.status(statusCode).json(health)
}
