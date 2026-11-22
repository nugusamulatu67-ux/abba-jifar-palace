import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import bcrypt from 'bcryptjs'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64
const BCRYPT_ROUNDS = 12

export function assertPasswordLength(password: string): void {
  if (password.length < 8 || password.length > 72) {
    throw new Error('Password must be 8 to 72 characters.')
  }
}

/** New passwords are bcrypt hashes. The password itself is never stored. */
export async function hashPassword(password: string): Promise<string> {
  assertPasswordLength(password)
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    return bcrypt.compare(password, stored)
  }
  if (stored.startsWith('scrypt$')) {
    return verifyScrypt(password, stored)
  }
  return false
}

async function verifyScrypt(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$')
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) {
    return false
  }

  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const actual = (await scrypt(password, salt, expected.length)) as Buffer
  if (actual.length !== expected.length || actual.length !== KEY_LENGTH) {
    return false
  }
  return timingSafeEqual(actual, expected)
}
