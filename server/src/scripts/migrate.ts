import { env } from '../config/env.ts'
import { migrate } from '../db/migrate.ts'

const applied = await migrate(env.databaseUrl)
if (applied.length === 0) {
  console.log('Migrations are already up to date.')
} else {
  console.log(`Applied ${applied.join(', ')}`)
}
