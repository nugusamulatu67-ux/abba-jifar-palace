const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000

interface Attempt {
  count: number
  lockedUntil: number
}

const attempts = new Map<string, Attempt>()

export class LoginLockedError extends Error {
  constructor() {
    super('Too many sign-in attempts. Try again in 15 minutes.')
  }
}

export function assertLoginAllowed(email: string): void {
  const attempt = attempts.get(email)
  if (attempt && attempt.lockedUntil > Date.now()) {
    throw new LoginLockedError()
  }
}

export function recordLoginFailure(email: string): void {
  const attempt = attempts.get(email) ?? { count: 0, lockedUntil: 0 }
  const count = attempt.count + 1
  attempts.set(email, {
    count,
    lockedUntil: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0,
  })
}

export function clearLoginFailures(email: string): void {
  attempts.delete(email)
}
