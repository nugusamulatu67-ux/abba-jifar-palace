import pg from 'pg'
import { env } from '../config/env.ts'
import { migrate } from '../db/migrate.ts'
import { seed } from '../db/seed.ts'

const { Client } = pg
const client = new Client({ connectionString: env.databaseUrl })
await client.connect()
await client.query('DROP SCHEMA public CASCADE')
await client.query('CREATE SCHEMA public')
await client.end()

const applied = await migrate(env.databaseUrl)
console.log(applied.length === 0 ? 'Migrations are already up to date.' : `Applied ${applied.join(', ')}`)
await seed(env.databaseUrl)
console.log('Local database recreated from migrations and seed data.')
