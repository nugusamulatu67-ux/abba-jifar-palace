import type { PublicUser, RoleName } from '../../../shared/src/index.ts'
import { getDatabaseErrorCode } from '../db/errors.ts'
import { withTransaction } from '../db/transaction.ts'
import { pool } from '../config/database.ts'
import { findUserByEmail, findUserById, insertAccount } from '../repositories/user.repository.ts'
import { createSession, revokeSession } from '../repositories/session.repository.ts'
import {
  assertLoginAllowed,
  clearLoginFailures,
  LoginLockedError,
  recordLoginFailure,
} from '../security/login-attempts.ts'
import { hashPassword, verifyPassword } from '../security/password.ts'
import { sessionLifetimeMs } from '../security/token.ts'

export class AuthError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const INVALID_LOGIN = 'Email or password is incorrect.'

export async function registerTourist(input: {
  fullName: string
  email: string
  password: string
  phone?: string
}): Promise<{ user: PublicUser; sessionId: string; expiresAt: Date }> {
  const passwordHash = await hashPassword(input.password)
  try {
    const user = await withTransaction(pool, (client) =>
      insertAccount(client, { ...input, passwordHash, role: 'tourist' }),
    )
    return openSession(user)
  } catch (error) {
    if (getDatabaseErrorCode(error) === '23505') {
      throw new AuthError(conflictMessage(error), 409)
    }
    throw error
  }
}

export async function createStaffAccount(input: {
  fullName: string
  email: string
  password: string
  phone?: string
  role: Exclude<RoleName, 'tourist'>
}): Promise<PublicUser> {
  const passwordHash = await hashPassword(input.password)
  try {
    return await withTransaction(pool, (client) => insertAccount(client, { ...input, passwordHash }))
  } catch (error) {
    if (getDatabaseErrorCode(error) === '23505') {
      throw new AuthError(conflictMessage(error), 409)
    }
    throw error
  }
}

export async function login(input: {
  email: string
  password: string
}): Promise<{ user: PublicUser; sessionId: string; expiresAt: Date }> {
  assertLoginAllowed(input.email)
  const stored = await findUserByEmail(input.email)
  const passwordMatches = stored ? await verifyPassword(input.password, stored.passwordHash) : false
  if (!stored || !passwordMatches || stored.status !== 'active') {
    recordLoginFailure(input.email)
    throw new AuthError(INVALID_LOGIN, 401)
  }

  clearLoginFailures(input.email)
  return openSession({
    id: stored.id,
    fullName: stored.fullName,
    email: stored.email,
    role: stored.role,
    status: stored.status,
  })
}

export async function logout(sessionId: string): Promise<void> {
  await revokeSession(sessionId)
}

export async function currentUser(userId: number): Promise<PublicUser | undefined> {
  return findUserById(userId)
}

async function openSession(user: PublicUser) {
  const expiresAt = new Date(Date.now() + sessionLifetimeMs())
  const sessionId = await createSession(user.id, expiresAt)
  return { user, sessionId, expiresAt }
}

function conflictMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'constraint' in error) {
    const constraint = String(error.constraint)
    if (constraint.includes('phone')) {
      return 'That phone number is already in use.'
    }
  }
  return 'An account with that email already exists.'
}

export function authStatus(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof LoginLockedError) {
    return { status: 429, message: error.message }
  }
  if (error instanceof AuthError) {
    return { status: error.status, message: error.message }
  }
  return undefined
}
