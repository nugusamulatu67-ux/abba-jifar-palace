import type { PoolClient } from 'pg'
import type { PublicUser, RoleName } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'

interface UserRow {
  id: string | number
  full_name: string
  email: string
  role: RoleName
  status: 'active' | 'inactive'
  password_hash?: string
}

export interface StoredUser extends PublicUser {
  passwordHash: string
}

const publicColumns = `
  users.id,
  users.full_name,
  users.email,
  users.status,
  roles.name AS role
`

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const result = await pool.query<UserRow>(
    `SELECT ${publicColumns}, users.password_hash
     FROM users
     JOIN roles ON roles.id = users.role_id
     WHERE users.email = $1`,
    [email],
  )
  const row = result.rows[0]
  if (!row?.password_hash) {
    return undefined
  }
  return { ...toPublicUser(row), passwordHash: row.password_hash }
}

export async function findUserById(id: number): Promise<PublicUser | undefined> {
  const result = await pool.query<UserRow>(
    `SELECT ${publicColumns}
     FROM users
     JOIN roles ON roles.id = users.role_id
     WHERE users.id = $1`,
    [id],
  )
  const row = result.rows[0]
  return row ? toPublicUser(row) : undefined
}

export async function insertAccount(
  client: PoolClient,
  input: { fullName: string; email: string; passwordHash: string; role: RoleName; phone?: string },
): Promise<PublicUser> {
  const user = await client.query<UserRow>(
    `INSERT INTO users (role_id, full_name, email, password_hash)
     SELECT id, $1, $2, $3 FROM roles WHERE name = $4
     RETURNING id, full_name, email, status, $4::text AS role`,
    [input.fullName, input.email, input.passwordHash, input.role],
  )
  const row = user.rows[0]
  if (!row) {
    throw new Error('The selected role does not exist.')
  }

  if (input.role === 'tourist') {
    await client.query(
      `INSERT INTO tourists (user_id, full_name, email, phone) VALUES ($1, $2, $3, $4)`,
      [Number(row.id), input.fullName, input.email, input.phone ?? null],
    )
  }

  if (input.role === 'tour_guide') {
    await client.query(`INSERT INTO guides (user_id, full_name, phone) VALUES ($1, $2, $3)`, [
      Number(row.id),
      input.fullName,
      input.phone ?? null,
    ])
  }

  return toPublicUser(row)
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: Number(row.id),
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
  }
}
