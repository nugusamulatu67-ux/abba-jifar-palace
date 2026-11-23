import type { NextFunction, Request, Response } from 'express'
import {
  adminPackage,
  adminPackages,
  adminSchedule,
  adminSchedules,
  cancelDeparture,
  createPackage,
  createSchedule,
  editPackage,
  editSchedule,
  publicPackage,
  publicPackages,
  publicSchedule,
  publicSchedules,
  setPackageStatus,
  tourStatus,
} from '../services/tour.service.ts'
import { readOptionalQuery, readPackageInput, readPackageStatus, readScheduleInput } from '../validation/tour.ts'

export async function getPublicPackages(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ packages: await publicPackages() })
  } catch (error) {
    next(error)
  }
}

export async function getPublicPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = readRouteId(req.params.id)
    res.json({ package: await publicPackage(id) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function getPublicSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const packageId = readOptionalId(req.query.packageId)
    res.json({ schedules: await publicSchedules(packageId) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function getPublicSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = readRouteId(req.params.id)
    res.json({ schedule: await publicSchedule(id) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function getAdminPackages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const search = readOptionalQuery(req.query.q).replaceAll('%', '').replaceAll('_', '')
    const status = readOptionalQuery(req.query.status)
    if (status && status !== 'active' && status !== 'inactive' && status !== 'archived') {
      res.status(400).json({ error: 'Filter by active, inactive, or archived.' })
      return
    }
    res.json({ packages: await adminPackages(search, status) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function getAdminPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ package: await adminPackage(readRouteId(req.params.id)) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function postAdminPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = await createPackage(readPackageInput(req.body))
    res.status(201).json({ package: created })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function patchAdminPackage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await editPackage(readRouteId(req.params.id), readPackageInput(req.body))
    res.json({ package: updated })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function postAdminPackageStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await setPackageStatus(readRouteId(req.params.id), readPackageStatus(req.body))
    res.json({ package: updated })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function getAdminSchedules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = readOptionalQuery(req.query.status)
    if (status && status !== 'scheduled' && status !== 'cancelled' && status !== 'completed') {
      res.status(400).json({ error: 'Filter by scheduled, cancelled, or completed.' })
      return
    }
    res.json({ schedules: await adminSchedules(readOptionalId(req.query.packageId), status) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function getAdminSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ schedule: await adminSchedule(readRouteId(req.params.id)) })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function postAdminSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const created = await createSchedule(readScheduleInput(req.body))
    res.status(201).json({ schedule: created })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function patchAdminSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const updated = await editSchedule(readRouteId(req.params.id), readScheduleInput(req.body))
    res.json({ schedule: updated })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

export async function postCancelSchedule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cancelled = await cancelDeparture(readRouteId(req.params.id))
    res.json({ schedule: cancelled })
  } catch (error) {
    sendTourError(res, error, next)
  }
}

function readRouteId(value: string | string[] | undefined): number {
  const text = Array.isArray(value) ? value[0] : value
  if (!text || !/^\d+$/.test(text)) {
    throw new Error('Choose a valid record.')
  }
  return Number(text)
}

function readOptionalId(value: unknown): number | undefined {
  if (value === undefined || value === '') {
    return undefined
  }
  const text = Array.isArray(value) ? value[0] : value
  if (typeof text !== 'string' || !/^\d+$/.test(text)) {
    throw new Error('Choose a valid package.')
  }
  return Number(text)
}

function sendTourError(res: Response, error: unknown, next: NextFunction): void {
  if (error instanceof Error && isValidationMessage(error.message)) {
    res.status(400).json({ error: error.message })
    return
  }
  const known = tourStatus(error)
  if (known) {
    res.status(known.status).json({ error: known.message })
    return
  }
  next(error)
}

function isValidationMessage(message: string): boolean {
  return (
    message.startsWith('Enter') ||
    message.startsWith('Use ') ||
    message.startsWith('Choose') ||
    message.startsWith('The ending') ||
    message.startsWith('Included activities') ||
    message.startsWith('Request body') ||
    message.startsWith('Filter by')
  )
}
