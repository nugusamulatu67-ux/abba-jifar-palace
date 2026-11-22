import { pool } from '../config/database.ts'

export async function createSession(userId: number, expiresAt: Date): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO sessions (user_id, expires_at) VALUES ($1, $2) RETURNING id::text`,
    [userId, expiresAt],
  )
  const id = result.rows[0]?.id
  if (!id) {
    throw new Error('The session could not be created.')
  }
  return id
}

export async function findActiveSession(sessionId: string, userId: number): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM sessions
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [sessionId, userId],
  )
  return (result.rowCount ?? 0) === 1
}

export async function revokeSession(sessionId: string): Promise<void> {
  await pool.query(
    `UPDATE sessions SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId],
  )
}
