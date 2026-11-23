import type { AdminSchedule, AdminTourPackage, PackageStatus, PublicSchedule, PublicTourDetail, PublicTourPackage } from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'
import { getDatabaseErrorCode } from '../db/errors.ts'
import { withTransaction } from '../db/transaction.ts'
import {
  bookedSeats,
  cancelSchedule,
  findAdminPackage,
  findAdminSchedule,
  findPublicPackage,
  findPublicSchedule,
  insertPackage,
  insertSchedule,
  listAdminPackages,
  listAdminSchedules,
  listPublicPackages,
  listPublicSchedules,
  lockPackage,
  updatePackage,
  updatePackageStatus,
  updateSchedule,
} from '../repositories/tour.repository.ts'
import type { PackageInput, ScheduleInput } from '../validation/tour.ts'

export class TourError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function tourStatus(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof TourError) {
    return { status: error.status, message: error.message }
  }
  return undefined
}

export async function publicPackages(): Promise<PublicTourPackage[]> {
  return listPublicPackages()
}

export async function publicPackage(id: number): Promise<PublicTourDetail> {
  const tour = await findPublicPackage(id)
  if (!tour) {
    throw new TourError('That tour is not available.', 404)
  }
  return tour
}

export async function publicSchedules(packageId?: number): Promise<PublicSchedule[]> {
  return listPublicSchedules(packageId)
}

export async function publicSchedule(id: number): Promise<PublicSchedule> {
  const schedule = await findPublicSchedule(id)
  if (!schedule) {
    throw new TourError('That departure is not available.', 404)
  }
  return schedule
}

export async function adminPackages(search: string, status: string): Promise<AdminTourPackage[]> {
  return listAdminPackages(search, status)
}

export async function adminPackage(id: number): Promise<AdminTourPackage> {
  const tour = await findAdminPackage(id)
  if (!tour) {
    throw new TourError('That package was not found.', 404)
  }
  return tour
}

export async function createPackage(input: PackageInput): Promise<AdminTourPackage> {
  try {
    return await insertPackage(input)
  } catch (error) {
    throw mapPackageError(error)
  }
}

export async function editPackage(id: number, input: PackageInput): Promise<AdminTourPackage> {
  try {
    const updated = await updatePackage(id, input)
    if (!updated) {
      throw new TourError('That package was not found.', 404)
    }
    return updated
  } catch (error) {
    throw mapPackageError(error)
  }
}

export async function setPackageStatus(id: number, status: PackageStatus): Promise<AdminTourPackage> {
  const updated = await updatePackageStatus(id, status)
  if (!updated) {
    throw new TourError('That package was not found.', 404)
  }
  return updated
}

export async function adminSchedules(packageId: number | undefined, status: string): Promise<AdminSchedule[]> {
  return listAdminSchedules(packageId, status)
}

export async function adminSchedule(id: number): Promise<AdminSchedule> {
  const schedule = await findAdminSchedule(id)
  if (!schedule) {
    throw new TourError('That schedule was not found.', 404)
  }
  return schedule
}

export async function createSchedule(input: ScheduleInput): Promise<AdminSchedule> {
  const id = await withTransaction(pool, async (client) => {
    const tourPackage = await lockPackage(client, input.packageId)
    if (!tourPackage) {
      throw new TourError('Choose an existing tour package.', 400)
    }
    if (tourPackage.status !== 'active') {
      throw new TourError('Activate the package before adding a schedule.', 400)
    }
    assertCapacityFits(input.maxCapacity, tourPackage.maxGroupSize)
    try {
      return await insertSchedule(client, input)
    } catch (error) {
      throw mapScheduleError(error)
    }
  })
  return adminSchedule(id)
}

export async function editSchedule(id: number, input: ScheduleInput): Promise<AdminSchedule> {
  await withTransaction(pool, async (client) => {
    const current = await findAdminSchedule(id)
    if (!current || current.status !== 'scheduled') {
      throw new TourError('Only a scheduled departure can be edited.', 400)
    }
    const tourPackage = await lockPackage(client, input.packageId)
    if (!tourPackage || tourPackage.status === 'archived') {
      throw new TourError('Choose an active or inactive package that is not archived.', 400)
    }
    const taken = await bookedSeats(client, id)
    if (input.maxCapacity < taken) {
      throw new TourError('Capacity cannot be lower than the seats already booked.', 400)
    }
    if (input.packageId !== current.packageId && taken > 0) {
      throw new TourError('A departure with bookings cannot be moved to another package.', 400)
    }
    assertCapacityFits(input.maxCapacity, tourPackage.maxGroupSize)
    try {
      const updated = await updateSchedule(client, id, input)
      if (!updated) {
        throw new TourError('Only a scheduled departure can be edited.', 400)
      }
    } catch (error) {
      throw mapScheduleError(error)
    }
  })
  return adminSchedule(id)
}

export async function cancelDeparture(id: number): Promise<AdminSchedule> {
  const existing = await findAdminSchedule(id)
  if (!existing) {
    throw new TourError('That schedule was not found.', 404)
  }
  if (existing.status === 'cancelled') {
    return existing
  }
  if (existing.status !== 'scheduled') {
    throw new TourError('Only a scheduled departure can be cancelled.', 400)
  }
  const cancelled = await cancelSchedule(id)
  if (!cancelled) {
    throw new TourError('That schedule was not found.', 404)
  }
  return cancelled
}

function assertCapacityFits(capacity: number, maxGroupSize: number | null): void {
  if (maxGroupSize !== null && capacity > maxGroupSize) {
    throw new TourError(`Capacity cannot be higher than the package group size of ${maxGroupSize}.`, 400)
  }
}

function mapPackageError(error: unknown): unknown {
  if (error instanceof TourError) {
    return error
  }
  if (getDatabaseErrorCode(error) === '23505') {
    return new TourError('A package with that name already exists.', 409)
  }
  return error
}

function mapScheduleError(error: unknown): unknown {
  if (error instanceof TourError) {
    return error
  }
  if (getDatabaseErrorCode(error) === '23505') {
    return new TourError('That package already has a departure at this start time.', 409)
  }
  if (getDatabaseErrorCode(error) === '23514') {
    return new TourError('The ending time must be later than the starting time.', 400)
  }
  return error
}
