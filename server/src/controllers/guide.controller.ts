import type { NextFunction, Request, Response } from 'express'
import type { AppRequest } from '../middleware/authenticate.ts'
import {
  assignGuide,
  changeAssignment,
  departureBoard,
  guideDashboard,
  guideDirectory,
  guideDirectoryEntry,
  guideStatus,
  ownAssignment,
  ownAssignments,
} from '../services/guide.service.ts'

export async function getAdminGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ guides: await guideDirectory(readSearch(req.query.q)) })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function getAdminGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ guide: await guideDirectoryEntry(readId(req.params.id, 'That guide was not found.')) })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function getAdminGuideAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const guide = await guideDirectoryEntry(readId(req.params.id, 'That guide was not found.'))
    res.json({ assignments: guide.assignments })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function getAdminAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = readPage(req.query.page, req.query.pageSize)
    const assignment = readAssignmentFilter(req.query.assignment)
    res.json({
      board: await departureBoard({
        search: readSearch(req.query.q),
        date: readDate(req.query.date),
        packageId: readOptionalId(req.query.packageId),
        assignment,
        page: page.page,
        pageSize: page.pageSize,
      }),
    })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function postAdminAssignment(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    const body = asRecord(req.body)
    const scheduleId = readBodyId(body.scheduleId, 'Choose a departure.')
    const guideUserId = readBodyId(body.guideUserId, 'Choose a tour guide.')
    const departure = await assignGuide(req.user.id, scheduleId, guideUserId)
    res.status(201).json({ departure })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function patchAdminAssignment(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    const body = asRecord(req.body)
    if (!Object.prototype.hasOwnProperty.call(body, 'guideUserId')) {
      res.status(400).json({ error: 'Choose a tour guide, or clear the assignment.' })
      return
    }
    const guideUserId = body.guideUserId === null ? null : readBodyId(body.guideUserId, 'Choose a tour guide.')
    const departure = await changeAssignment(
      req.user.id,
      readId(req.params.id, 'That assignment was not found.'),
      guideUserId,
    )
    res.json({ departure })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function getGuideDashboard(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    res.json({ dashboard: await guideDashboard(req.user.id) })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function getGuideAssignments(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    res.json({ assignments: await ownAssignments(req.user.id) })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

export async function getGuideAssignment(req: AppRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Sign in to continue.' })
      return
    }
    res.json({
      assignment: await ownAssignment(req.user.id, readId(req.params.id, 'That assignment was not found.')),
    })
  } catch (error) {
    sendGuideError(res, error, next)
  }
}

function sendGuideError(res: Response, error: unknown, next: NextFunction): void {
  const known = guideStatus(error)
  if (known) {
    res.status(known.status).json({ error: known.message })
    return
  }
  if (error instanceof Error && /^(Enter|Choose|Filter|That|Request|Sign in|Provide)/.test(error.message)) {
    res.status(error.message.startsWith('Sign in') ? 401 : error.message.startsWith('That') ? 404 : 400).json({
      error: error.message,
    })
    return
  }
  next(error)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  throw new Error('Request body must be an object.')
}

function readSearch(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.replaceAll('%', '').replaceAll('_', '').replaceAll('\0', '').trim().slice(0, 80)
}

function readDate(value: unknown): string {
  if (value === undefined || value === '') {
    return ''
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Enter the tour date as YYYY-MM-DD.')
  }
  return value
}

function readAssignmentFilter(value: unknown): string {
  if (value === undefined || value === '') {
    return ''
  }
  if (value === 'assigned' || value === 'unassigned') {
    return value
  }
  throw new Error('Filter by assigned or unassigned.')
}

function readPage(pageValue: unknown, sizeValue: unknown): { page: number; pageSize: number } {
  const page = pageValue === undefined || pageValue === '' ? 1 : readQueryInt(pageValue, 'Choose a page.', 1, 1000)
  const pageSize = sizeValue === undefined || sizeValue === '' ? 20 : readQueryInt(sizeValue, 'Choose a page size.', 1, 50)
  return { page, pageSize }
}

function readOptionalId(value: unknown): number | null {
  if (value === undefined || value === '') {
    return null
  }
  return readQueryInt(value, 'Choose a tour.', 1, Number.MAX_SAFE_INTEGER)
}

function readId(value: unknown, message: string): number {
  return readQueryInt(value, message, 1, Number.MAX_SAFE_INTEGER)
}

function readBodyId(value: unknown, message: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new Error(message)
  }
  return readQueryInt(value, message, 1, Number.MAX_SAFE_INTEGER)
}

function readQueryInt(value: unknown, message: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(message)
  }
  return parsed
}
