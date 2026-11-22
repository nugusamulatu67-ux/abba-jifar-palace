import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { databaseSettings, env, projectRoot } from '../config/env.ts'

const { Client } = pg

const dataDir = path.join(projectRoot, 'database', 'pgdata')
const logFile = path.join(projectRoot, 'database', 'postgres.log')

function pgBin(): string {
  if (process.env.PG_BIN && fs.existsSync(path.join(process.env.PG_BIN, 'initdb.exe'))) {
    return process.env.PG_BIN
  }

  for (const version of [18, 17, 16]) {
    const bin = path.join('C:\\Program Files\\PostgreSQL', String(version), 'bin')
    if (fs.existsSync(path.join(bin, 'initdb.exe'))) {
      return bin
    }
  }

  throw new Error('PostgreSQL binaries were not found. Install PostgreSQL or set PG_BIN to its bin folder.')
}

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed with exit code ${result.status ?? 'unknown'}.`)
  }
}

function startCluster(port: number): void {
  const bin = pgBin()
  run(path.join(bin, 'pg_ctl.exe'), [
    '-D',
    dataDir,
    '-l',
    logFile,
    'start',
    '-o',
    `-p ${port} -c listen_addresses=127.0.0.1`,
  ])
}

function initCluster(user: string, password: string): void {
  const bin = pgBin()
  const passwordFile = path.join(os.tmpdir(), `abba-jifar-pw-${process.pid}`)
  fs.writeFileSync(passwordFile, `${password}\n`, 'utf8')
  try {
    run(path.join(bin, 'initdb.exe'), [
      '-D',
      dataDir,
      '-U',
      user,
      '--pwfile',
      passwordFile,
      '--auth-local=scram-sha-256',
      '--auth-host=scram-sha-256',
      '--encoding=UTF8',
      '--locale-provider=builtin',
      '--builtin-locale=C',
    ])
  } finally {
    fs.rmSync(passwordFile, { force: true })
  }
}

async function connectionError(connectionString: string): Promise<string | undefined> {
  const client = new Client({ connectionString })
  try {
    await client.connect()
    await client.query('SELECT 1')
    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : 'connection failed'
  } finally {
    await client.end().catch(() => undefined)
  }
}

function maintenanceUrl(): string {
  const url = new URL(env.databaseUrl)
  url.pathname = '/postgres'
  return url.toString()
}

function clusterIsRunning(): boolean {
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    return false
  }
  const result = spawnSync(path.join(pgBin(), 'pg_ctl.exe'), ['-D', dataDir, 'status'], {
    stdio: 'ignore',
  })
  return result.status === 0
}

async function ensureAppDatabase(): Promise<void> {
  const settings = databaseSettings()
  if (!/^[a-z_][a-z0-9_]*$/.test(settings.database)) {
    throw new Error('DATABASE_URL database name must be a simple lowercase identifier.')
  }

  const admin = new Client({ connectionString: maintenanceUrl() })
  await admin.connect()
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [settings.database])
    if ((existing.rowCount ?? 0) === 0) {
      await admin.query(`CREATE DATABASE ${settings.database}`)
      console.log(`Created database ${settings.database}.`)
    }
  } finally {
    await admin.end()
  }
}

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const error = await connectionError(maintenanceUrl())
    if (!error) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`PostgreSQL did not accept connections. See ${logFile}`)
}

export async function ensureDatabase(): Promise<void> {
  const settings = databaseSettings()
  if (!settings.password) {
    throw new Error('DATABASE_URL must include a password.')
  }

  const existing = await connectionError(env.databaseUrl)
  if (!existing) {
    console.log(`PostgreSQL is already accepting connections on port ${settings.port}.`)
    return
  }

  const serverUp = clusterIsRunning()
  if (!serverUp && fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('Starting the project PostgreSQL cluster.')
    startCluster(settings.port)
  } else if (!serverUp && settings.port === 5432) {
    throw new Error(
      `${existing} The PostgreSQL service on port 5432 refused this DATABASE_URL. Use that server's password, or point DATABASE_URL at port 5433 for a project-local cluster.`,
    )
  } else if (!serverUp) {
    console.log('Creating a project-local PostgreSQL cluster.')
    initCluster(settings.user, settings.password)
    startCluster(settings.port)
  }

  await waitForServer()
  if (existing.includes('does not exist') || (await connectionError(env.databaseUrl))?.includes('does not exist')) {
    await ensureAppDatabase()
  }

  const finalError = await connectionError(env.databaseUrl)
  if (finalError) {
    throw new Error(finalError)
  }
  console.log(`PostgreSQL is accepting connections for ${settings.database} on port ${settings.port}.`)
}

const entry = process.argv[1]?.replaceAll('\\', '/')
if (entry?.endsWith('/db-up.ts')) {
  await ensureDatabase()
}
