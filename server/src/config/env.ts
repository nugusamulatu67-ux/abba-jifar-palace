import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

function findProjectRoot(start: string): string {
  let current = start

  while (true) {
    const packagePath = path.join(current, 'package.json')
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as { name?: string }
        if (pkg.name === 'abba-jifar') {
          return current
        }
      } catch {
        // Keep walking if a package.json cannot be read.
      }
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return start
    }
    current = parent
  }
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url))
export const projectRoot = findProjectRoot(moduleDir)

const envFile = path.join(projectRoot, '.env')
if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile, quiet: true })
}

function parsePort(value: string | undefined, fallback: number): number {
  const port = Number(value ?? fallback)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer from 1 to 65535. Received: ${value}`)
  }
  return port
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value || value.includes('replace-with-')) {
    throw new Error(`${name} must be set to a real local value in .env. Copy .env.example and replace the placeholders.`)
  }
  return value
}

function requiredSecret(name: string): string {
  const value = requiredEnv(name)
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters.`)
  }
  return value
}

export const env = {
  port: parsePort(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: requiredEnv('DATABASE_URL'),
  jwtSecret: requiredSecret('JWT_SECRET'),
  seedAdminEmail: (process.env.SEED_ADMIN_EMAIL ?? 'admin@abba-jifar.local').trim().toLowerCase(),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD?.trim() ?? '',
}

export function databaseSettings(connectionString: string = env.databaseUrl) {
  const url = new URL(connectionString)
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ''),
  }
}
