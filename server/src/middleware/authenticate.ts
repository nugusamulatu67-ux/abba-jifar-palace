import type { NextFunction, Request, Response } from 'express'
import type { PublicUser, RoleName } from '../../../shared/src/index.ts'
import { findUserById } from '../repositories/user.repository.ts'
import { findActiveSession } from '../repositories/session.repository.ts'
import { readCookie, readSessionToken, SESSION_COOKIE } from '../security/token.ts'

export type AppRequest = Request & {
  user?: PublicUser
  sessionId?: string
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AppRequest
  const token = readCookie(req.header('cookie'), SESSION_COOKIE)
  const session = token ? readSessionToken(token) : undefined
  if (!session) {
    res.status(401).json({ error: 'Sign in to continue.' })
    return
  }

  const active = await findActiveSession(session.sid, session.sub)
  if (!active) {
    res.status(401).json({ error: 'Sign in to continue.' })
    return
  }

  const user = await findUserById(session.sub)
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: 'Sign in to continue.' })
    return
  }

  authReq.user = user
  authReq.sessionId = session.sid
  next()
}

export function authorize(...roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AppRequest).user
    if (!user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: 'You do not have access to this action.' })
      return
    }
    next()
  }
}
