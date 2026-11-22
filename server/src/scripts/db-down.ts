import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { projectRoot } from '../config/env.ts'

const dataDir = path.join(projectRoot, 'database', 'pgdata')

function pgCtl(): string {
  if (process.env.PG_BIN) {
    return path.join(process.env.PG_BIN, 'pg_ctl.exe')
  }
  for (const version of [18, 17, 16]) {
    const command = path.join('C:\\Program Files\\PostgreSQL', String(version), 'bin', 'pg_ctl.exe')
    if (fs.existsSync(command)) {
      return command
    }
  }
  throw new Error('pg_ctl was not found. Install PostgreSQL or set PG_BIN.')
}

if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
  console.log('No project-local PostgreSQL cluster is present.')
} else {
  const result = spawnSync(pgCtl(), ['-D', dataDir, 'stop'], { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`pg_ctl stop failed with exit code ${result.status ?? 'unknown'}.`)
  }
}
