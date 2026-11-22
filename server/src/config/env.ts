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

function resolveFromRoot(value: string | undefined, fallback: string): string {
  const raw = value && value.trim() !== '' ? value : fallback
  return path.isAbsolute(raw) ? raw : path.resolve(projectRoot, raw)
}

export const env = {
  port: parsePort(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  databasePath: resolveFromRoot(process.env.DATABASE_PATH, path.join('database', 'dev.sqlite')),
}
