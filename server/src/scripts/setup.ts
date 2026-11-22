import { env } from '../config/env.ts'
import { migrate } from '../db/migrate.ts'
import { seed } from '../db/seed.ts'
import { ensureDatabase } from './db-up.ts'

await ensureDatabase()
const applied = await migrate(env.databaseUrl)
console.log(applied.length === 0 ? 'Migrations are already up to date.' : `Applied ${applied.join(', ')}`)
await seed(env.databaseUrl)
console.log('Seed data is in place.')
