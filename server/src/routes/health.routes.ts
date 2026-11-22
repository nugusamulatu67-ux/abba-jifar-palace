import { Router } from 'express'
import { getHealthStatus } from '../controllers/health.controller.ts'

export const healthRouter = Router()

healthRouter.get('/health', getHealthStatus)
