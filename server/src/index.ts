import { createApp } from './app.ts'
import { env } from './config/env.ts'

const app = createApp()

app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`)
  console.log(`Health check: http://localhost:${env.port}/api/health`)
})
