import { env } from '../config/env.ts'
import { seed } from '../db/seed.ts'

await seed(env.databaseUrl)
console.log('Seed data is in place.')
