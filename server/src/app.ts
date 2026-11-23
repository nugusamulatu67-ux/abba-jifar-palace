import cors from 'cors'
import express from 'express'
import { env } from './config/env.ts'
import { accessRouter } from './routes/access.routes.ts'
import { authRouter } from './routes/auth.routes.ts'
import { healthRouter } from './routes/health.routes.ts'
import { bookingRouter } from './routes/booking.routes.ts'
import { checkInRouter } from './routes/checkin.routes.ts'
import { guideRouter } from './routes/guide.routes.ts'
import { paymentRouter } from './routes/payment.routes.ts'
import { tourRouter } from './routes/tour.routes.ts'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: env.clientOrigin, credentials: true }))
  app.use(express.json({ limit: '20kb' }))

  app.get('/', (_req, res) => {
    res.json({
      service: 'abba-jifar-api',
      message: 'API placeholder. GET /api/health reports server and database status.',
    })
  })

  app.use('/api', healthRouter)
  app.use('/api/auth', authRouter)
  app.use('/api', accessRouter)
  app.use('/api', tourRouter)
  app.use('/api', bookingRouter)
  app.use('/api', paymentRouter)
  app.use('/api', checkInRouter)
  app.use('/api', guideRouter)

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Request body must be JSON.' })
      return
    }
    console.error(error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Something went wrong. Please try again.' })
    }
  })

  return app
}
