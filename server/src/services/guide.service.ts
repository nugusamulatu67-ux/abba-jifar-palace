import type {
  DepartureAssignment,
  DepartureAssignmentPage,
  GuideAccount,
  GuideAccountDetail,
  GuideAssignmentDetail,
  GuideAssignmentSummary,
  GuideDashboard,
} from '../../../shared/src/index.ts'
import { pool } from '../config/database.ts'
import { getDatabaseErrorCode, getDatabaseErrorMessage } from '../db/errors.ts'
import { withTransaction } from '../db/transaction.ts'
import {
  closeAssignment,
  findAssignableGuide,
  findAssignmentForGuide,
  findGuideAccount,
  guideOverlaps,
  listAssignmentsForGuide,
  listDepartures,
  listGuideAccounts,
  listVisitors,
  lockActiveAssignment,
  lockAssignmentById,
  lockSchedule,
  saveActiveAssignment,
  writeAssignmentAudit,
  type AssignmentRow,
} from '../repositories/guide.repository.ts'

export class GuideError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'GuideError'
    this.status = status
  }
}

export function guideStatus(error: unknown): { status: number; message: string } | undefined {
  if (error instanceof GuideError) {
    return { status: error.status, message: error.message }
  }
  return undefined
}

export async function guideDirectory(search: string): Promise<GuideAccount[]> {
  const guides = await withTransaction(pool, (client) => listGuideAccounts(client, search))
  return guides.map(toAccount)
}

export async function guideDirectoryEntry(userId: number): Promise<GuideAccountDetail> {
  return withTransaction(pool, async (client) => {
    const guide = await findGuideAccount(client, userId)
    if (!guide) {
      throw new GuideError('That guide was not found.', 404)
    }
    const assignments = await listAssignmentsForGuide(client, userId)
    return { ...toAccount(guide), assignments: assignments.map(toSummary) }
  })
}

export async function departureBoard(input: {
  search: string
  date: string
  packageId: number | null
  assignment: string
  page: number
  pageSize: number
}): Promise<DepartureAssignmentPage> {
  const rows = await withTransaction(pool, (client) =>
    listDepartures(client, {
      ...input,
      limit: input.pageSize,
      offset: (input.page - 1) * input.pageSize,
    }),
  )
  return {
    departures: rows.map((row) => ({
      scheduleId: row.scheduleId,
      packageId: row.packageId,
      packageName: row.packageName,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      scheduleStatus: row.scheduleStatus,
      assignmentId: row.assignmentId,
      guideUserId: row.guideUserId,
      guideName: row.guideName,
      confirmedVisitors: row.confirmedVisitors,
      checkedInVisitors: row.checkedInVisitors,
      expectedVisitors: row.expectedVisitors,
    })),
    page: input.page,
    pageSize: input.pageSize,
    total: rows[0]?.total ?? 0,
  }
}

export async function assignGuide(administratorId: number, scheduleId: number, guideUserId: number): Promise<DepartureAssignment> {
  await withTransaction(pool, async (client) => {
    const schedule = await lockSchedule(client, scheduleId)
    if (!schedule) {
      throw new GuideError('That departure was not found.', 404)
    }
    assertScheduleOpen(schedule)
    const current = await lockActiveAssignment(client, scheduleId)
    if (current) {
      throw new GuideError('This departure already has a guide. Change the assignment instead.', 409)
    }
    const guide = await requireActiveGuide(client, guideUserId)
    if (await guideOverlaps(client, guide.guideId, schedule.startsAt, schedule.endsAt, null)) {
      throw new GuideError('That guide is already assigned to another departure at this time.', 409)
    }
    try {
      await saveActiveAssignment(client, { scheduleId, guideId: guide.guideId, assignedBy: administratorId })
    } catch (error) {
      throw mapAssignmentError(error)
    }
    await writeAssignmentAudit(client, {
      administratorId,
      action: 'guide.assign',
      scheduleId,
      previousGuideUserId: null,
      guideUserId,
    })
  })
  return loadDeparture(scheduleId)
}

export async function changeAssignment(
  administratorId: number,
  assignmentId: number,
  guideUserId: number | null,
): Promise<DepartureAssignment> {
  const scheduleId = await withTransaction(pool, async (client) => {
    const current = await lockAssignmentById(client, assignmentId)
    if (!current || current.status !== 'active') {
      throw new GuideError('That assignment was not found.', 404)
    }
    const schedule = await lockSchedule(client, current.scheduleId)
    if (!schedule) {
      throw new GuideError('That departure was not found.', 404)
    }
    if (guideUserId === null) {
      await closeAssignment(client, current.id, 'removed')
      await writeAssignmentAudit(client, {
        administratorId,
        action: 'guide.unassign',
        scheduleId: current.scheduleId,
        previousGuideUserId: current.guideUserId,
        guideUserId: null,
      })
      return current.scheduleId
    }
    assertScheduleOpen(schedule)
    if (current.guideUserId === guideUserId) {
      throw new GuideError('That guide is already assigned to this departure.', 400)
    }
    const guide = await requireActiveGuide(client, guideUserId)
    if (await guideOverlaps(client, guide.guideId, schedule.startsAt, schedule.endsAt, current.id)) {
      throw new GuideError('That guide is already assigned to another departure at this time.', 409)
    }
    try {
      await closeAssignment(client, current.id, 'replaced')
      await saveActiveAssignment(client, {
        scheduleId: current.scheduleId,
        guideId: guide.guideId,
        assignedBy: administratorId,
      })
    } catch (error) {
      throw mapAssignmentError(error)
    }
    await writeAssignmentAudit(client, {
      administratorId,
      action: 'guide.reassign',
      scheduleId: current.scheduleId,
      previousGuideUserId: current.guideUserId,
      guideUserId,
    })
    return current.scheduleId
  })
  return loadDeparture(scheduleId)
}

export async function guideDashboard(guideUserId: number): Promise<GuideDashboard> {
  return withTransaction(pool, async (client) => {
    const guide = await findGuideAccount(client, guideUserId)
    const assignments = (await listAssignmentsForGuide(client, guideUserId)).filter((row) => row.status === 'active')
    const now = Date.now()
    const todayKey = palaceDate(new Date())
    const upcoming = assignments.filter((row) => row.scheduleStatus === 'scheduled' && row.endsAt.getTime() > now)
    const today = assignments.filter(
      (row) => row.scheduleStatus !== 'cancelled' && palaceDate(row.startsAt) === todayKey,
    )
    const completed = assignments
      .filter((row) => row.endsAt.getTime() <= now && row.scheduleStatus !== 'cancelled')
      .slice(0, 8)
    return {
      guideName: guide?.fullName ?? 'Guide',
      upcomingCount: upcoming.length,
      today: today.map(toSummary),
      upcoming: upcoming.map(toSummary),
      completed: completed.map(toSummary),
    }
  })
}

export async function ownAssignments(guideUserId: number): Promise<GuideAssignmentSummary[]> {
  const rows = await withTransaction(pool, (client) => listAssignmentsForGuide(client, guideUserId))
  return rows.filter((row) => row.status === 'active').map(toSummary)
}

export async function ownAssignment(guideUserId: number, assignmentId: number): Promise<GuideAssignmentDetail> {
  return withTransaction(pool, async (client) => {
    const assignment = await findAssignmentForGuide(client, assignmentId, guideUserId)
    if (!assignment || assignment.status !== 'active') {
      throw new GuideError('That assignment was not found.', 404)
    }
    const visitors = await listVisitors(client, assignment.scheduleId)
    return { ...toSummary(assignment), visitors }
  })
}

async function requireActiveGuide(
  client: Parameters<typeof findAssignableGuide>[0],
  guideUserId: number,
): Promise<{ guideId: number }> {
  const guide = await findAssignableGuide(client, guideUserId)
  if (!guide || guide.role !== 'tour_guide' || guide.guideId === null) {
    throw new GuideError('Choose a registered tour guide.', 400)
  }
  if (!guide.active) {
    throw new GuideError('An inactive guide cannot be assigned.', 400)
  }
  return { guideId: guide.guideId }
}

function assertScheduleOpen(schedule: { status: string; startsAt: Date }): void {
  if (schedule.status === 'cancelled') {
    throw new GuideError('A cancelled departure cannot be assigned.', 400)
  }
  if (schedule.status !== 'scheduled' || schedule.startsAt.getTime() <= Date.now()) {
    throw new GuideError('A completed or past departure cannot be assigned.', 400)
  }
}

function mapAssignmentError(error: unknown): Error {
  const code = getDatabaseErrorCode(error)
  const message = getDatabaseErrorMessage(error)
  if (code === '23P01' || message.includes('assignment_overlap')) {
    return new GuideError('That guide is already assigned to another departure at this time.', 409)
  }
  if (code === '23505') {
    return new GuideError('This departure already has a guide.', 409)
  }
  if (message.includes('assignment_schedule_closed')) {
    return new GuideError('A completed or past departure cannot be assigned.', 400)
  }
  if (message.includes('assignment_guide_unavailable')) {
    return new GuideError('Choose an active tour guide.', 400)
  }
  return error instanceof Error ? error : new GuideError('The assignment could not be saved.', 500)
}

function toAccount(guide: { userId: number; fullName: string; email: string; status: 'active' | 'inactive'; upcomingAssignments: number }): GuideAccount {
  return {
    id: guide.userId,
    fullName: guide.fullName,
    email: guide.email,
    status: guide.status,
    upcomingAssignments: guide.upcomingAssignments,
  }
}

function toSummary(row: AssignmentRow): GuideAssignmentSummary {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    packageId: row.packageId,
    packageName: row.packageName,
    description: row.description,
    includedActivities: row.includedActivities,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    scheduleStatus: row.scheduleStatus,
    status: row.status,
    guideUserId: row.guideUserId,
    guideName: row.guideName,
    assignedByName: row.assignedByName,
    assignedAt: row.assignedAt.toISOString(),
    confirmedVisitors: row.confirmedVisitors,
    checkedInVisitors: row.checkedInVisitors,
    expectedVisitors: row.expectedVisitors,
  }
}

async function loadDeparture(scheduleId: number): Promise<DepartureAssignment> {
  const rows = await withTransaction(pool, (client) =>
    listDepartures(client, {
      search: '',
      date: '',
      packageId: null,
      assignment: '',
      scheduleId,
      limit: 1,
      offset: 0,
    }),
  )
  const saved = rows[0]
  if (!saved) {
    throw new GuideError('The assignment could not be loaded.', 500)
  }
  return {
    scheduleId: saved.scheduleId,
    packageId: saved.packageId,
    packageName: saved.packageName,
    startsAt: saved.startsAt.toISOString(),
    endsAt: saved.endsAt.toISOString(),
    scheduleStatus: saved.scheduleStatus,
    assignmentId: saved.assignmentId,
    guideUserId: saved.guideUserId,
    guideName: saved.guideName,
    confirmedVisitors: saved.confirmedVisitors,
    checkedInVisitors: saved.checkedInVisitors,
    expectedVisitors: saved.expectedVisitors,
  }
}

function palaceDate(value: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
