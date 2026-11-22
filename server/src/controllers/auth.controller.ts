import type { NextFunction, Request, Response } from 'express'
import { authStatus, createStaffAccount, currentUser, login, logout, registerTourist } from '../services/auth.service.ts'
import type { AppRequest } from '../middleware/authenticate.ts'
import { clearSessionCookie, sessionCookie, signSessionToken } from '../security/token.ts'
import { readAccountInput, readLoginInput, readStaffRole } from '../validation/auth.ts'

export async function postRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = readAccountInput(req.body)
    const result = await registerTourist(input)
    sendSession(res, result.user.id, result.sessionId, result.expiresAt)
    res.status(201).json({ user: result.user })
  } catch (error) {
    sendAuthError(res, error, next)
  }
}

export async function postLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = readLoginInput(req.body)
    if (!input.password) {
      res.status(401).json({ error: 'Email or password is incorrect.' })
      return
    }
    const result = await login(input)
    sendSession(res, result.user.id, result.sessionId, result.expiresAt)
    res.status(200).json({ user: result.user })
  } catch (error) {
    sendAuthError(res, error, next)
  }
}

export async function postLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = (req as AppRequest).sessionId
    if (sessionId) {
      await logout(sessionId)
    }
    res.setHeader('Set-Cookie', clearSessionCookie())
    res.status(200).json({ message: 'Signed out.' })
  } catch (error) {
    next(error)
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req as AppRequest).user?.id
    if (!userId) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    const user = await currentUser(userId)
    if (!user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    res.status(200).json({ user })
  } catch (error) {
    next(error)
  }
}

export async function postStaffAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = readAccountInput(req.body)
    const role = readStaffRole(req.body)
    const user = await createStaffAccount({ ...account, role })
    res.status(201).json({ user })
  } catch (error) {
    sendAuthError(res, error, next)
  }
}

function sendSession(res: Response, userId: number, sessionId: string, expiresAt: Date): void {
  const token = signSessionToken(userId, sessionId, expiresAt)
  res.setHeader('Set-Cookie', sessionCookie(token))
}

function sendAuthError(res: Response, error: unknown, next: NextFunction): void {
  if (error instanceof Error && error.message.startsWith('Enter') || error instanceof Error && (
    error.message.startsWith('Full name') ||
    error.message.startsWith('Password') ||
    error.message.startsWith('Phone') ||
    error.message.startsWith('Request body') ||
    error.message.startsWith('Choose a staff')
  )) {
    res.status(400).json({ error: error.message })
    return
  }
  const known = authStatus(error)
  if (known) {
    res.status(known.status).json({ error: known.message })
    return
  }
  next(error)
}
