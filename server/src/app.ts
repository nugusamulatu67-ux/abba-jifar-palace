import cors from 'cors'
import express from 'express'
import { env } from './config/env.ts'
import { healthRouter } from './routes/health.routes.ts'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: env.clientOrigin }))
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.json({
      service: 'abba-jifar-api',
      message: 'API placeholder. GET /api/health reports server and database status.',
    })
  })

  app.use('/api', healthRouter)

  return app
}
