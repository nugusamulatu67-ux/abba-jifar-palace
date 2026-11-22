import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.ts'

const SESSION_SECONDS = 60 * 60 * 24 * 7

export interface SessionToken {
  sub: number
  sid: string
  exp: number
}

export function sessionLifetimeMs(): number {
  return SESSION_SECONDS * 1000
}

export function signSessionToken(userId: number, sessionId: string, expiresAt: Date): string {
  const payload: SessionToken = {
    sub: userId,
    sid: sessionId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  }
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = sign(`${header}.${body}`)
  return `${header}.${body}.${signature}`
}

export function readSessionToken(token: string): SessionToken | undefined {
  const parts = token.split('.')
  if (parts.length !== 3) {
    return undefined
  }
  const [header, body, signature] = parts
  if (!header || !body || !signature || !signaturesMatch(signature, sign(`${header}.${body}`))) {
    return undefined
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<SessionToken>
    if (typeof payload.sub !== 'number' || typeof payload.sid !== 'string' || typeof payload.exp !== 'number') {
      return undefined
    }
    if (payload.exp * 1000 <= Date.now()) {
      return undefined
    }
    return { sub: payload.sub, sid: payload.sid, exp: payload.exp }
  } catch {
    return undefined
  }
}

export const SESSION_COOKIE = 'abba_session'

export function sessionCookie(token: string): string {
  const secure = env.nodeEnv === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_SECONDS}${secure}`
}

export function clearSessionCookie(): string {
  const secure = env.nodeEnv === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined
  }
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) {
      continue
    }
    const key = part.slice(0, separator).trim()
    if (key === name) {
      return decodeURIComponent(part.slice(separator + 1).trim())
    }
  }
  return undefined
}

function sign(value: string): string {
  return createHmac('sha256', env.jwtSecret).update(value).digest('base64url')
}

function signaturesMatch(received: string, expected: string): boolean {
  const actualBuffer = Buffer.from(received)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}
