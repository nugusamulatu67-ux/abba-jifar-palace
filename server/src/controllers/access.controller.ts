import type { Request, Response } from 'express'
import { postStaffAccount } from './auth.controller.ts'

export function getAdministratorAccess(_req: Request, res: Response): void {
  res.json({
    area: 'administrator',
    message: 'Administrator access is allowed.',
  })
}

export function getGuideAccess(_req: Request, res: Response): void {
  res.json({
    area: 'guide',
    message: 'Tour guide access is allowed. Assigned tours will appear in a later phase.',
  })
}

export function getReceptionAccess(_req: Request, res: Response): void {
  res.json({
    area: 'reception',
    message: 'Reception access is allowed. Check-in will be added in a later phase.',
  })
}

export { postStaffAccount }
