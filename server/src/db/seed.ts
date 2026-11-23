import pg from 'pg'
import { env } from '../config/env.ts'
import { hashPassword } from '../security/password.ts'

const { Client } = pg

interface SeedPackage {
  name: string
  description: string
  priceEtb: number
  durationMinutes: number
  category: string
  includedActivities: string
  maxGroupSize: number
}

interface SeedSchedule {
  packageName: string
  startsAt: string
  endsAt: string
  maxCapacity: number
}

interface SeedGuide {
  fullName: string
  phone: string
  packageName: string
  startsAt: string
}

const packages: SeedPackage[] = [
  {
    name: 'Palace History Tour',
    description: 'A guided walk through the halls and history of Abba Jifar Palace.',
    priceEtb: 300,
    durationMinutes: 90,
    category: 'History',
    includedActivities: 'Guided walk through the palace halls',
    maxGroupSize: 20,
  },
  {
    name: 'Museum and Garden Walk',
    description: 'The palace museum collections and the garden, at a slower pace.',
    priceEtb: 200,
    durationMinutes: 60,
    category: 'Museum and garden',
    includedActivities: 'Museum collections and the garden',
    maxGroupSize: 15,
  },
  {
    name: 'Full Heritage Visit',
    description: 'The history tour plus time in the museum and garden.',
    priceEtb: 500,
    durationMinutes: 150,
    category: 'Full visit',
    includedActivities: 'History tour, museum, and garden',
    maxGroupSize: 12,
  },
]

const schedules: SeedSchedule[] = [
  {
    packageName: 'Palace History Tour',
    startsAt: '2026-12-05 09:00:00+03',
    endsAt: '2026-12-05 10:30:00+03',
    maxCapacity: 20,
  },
  {
    packageName: 'Palace History Tour',
    startsAt: '2026-12-06 09:00:00+03',
    endsAt: '2026-12-06 10:30:00+03',
    maxCapacity: 20,
  },
  {
    packageName: 'Museum and Garden Walk',
    startsAt: '2026-12-05 14:00:00+03',
    endsAt: '2026-12-05 15:00:00+03',
    maxCapacity: 15,
  },
  {
    packageName: 'Full Heritage Visit',
    startsAt: '2026-12-12 10:00:00+03',
    endsAt: '2026-12-12 12:30:00+03',
    maxCapacity: 12,
  },
]

const guides: SeedGuide[] = [
  {
    fullName: 'Alemayehu Bekele',
    phone: '0911000001',
    packageName: 'Palace History Tour',
    startsAt: '2026-12-05 09:00:00+03',
  },
  {
    fullName: 'Fatuma Ahmed',
    phone: '0911000002',
    packageName: 'Museum and Garden Walk',
    startsAt: '2026-12-05 14:00:00+03',
  },
]

export async function seed(connectionString: string): Promise<void> {
  if (env.seedAdminPassword.length < 8 || env.seedAdminPassword.includes('replace-with-')) {
    throw new Error('Set SEED_ADMIN_PASSWORD in .env to a local development password of at least 8 characters.')
  }

  const client = new Client({ connectionString })
  await client.connect()

  try {
    await client.query('BEGIN')

    await client.query(
      `INSERT INTO roles (name, description)
       VALUES
        ('tourist', 'Registers, signs in, and uses personal tourist services.'),
        ('tour_guide', 'Sees assigned tours and the visitors on those tours.'),
        ('receptionist', 'Verifies bookings and checks visitors in.'),
        ('administrator', 'Manages the system and staff accounts.')
       ON CONFLICT (name) DO NOTHING`,
    )

    const passwordHash = await hashPassword(env.seedAdminPassword)
    await client.query(
      `INSERT INTO users (role_id, full_name, email, password_hash)
       SELECT id, 'Palace Administrator', $1, $2
       FROM roles
       WHERE name = 'administrator'
       ON CONFLICT (email) DO NOTHING`,
      [env.seedAdminEmail, passwordHash],
    )

    for (const tourPackage of packages) {
      await client.query(
        `INSERT INTO tour_packages (
           name, description, price_etb, duration_minutes, category, included_activities, max_group_size
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name) DO NOTHING`,
        [
          tourPackage.name,
          tourPackage.description,
          tourPackage.priceEtb,
          tourPackage.durationMinutes,
          tourPackage.category,
          tourPackage.includedActivities,
          tourPackage.maxGroupSize,
        ],
      )
    }

    for (const schedule of schedules) {
      await client.query(
        `INSERT INTO tour_schedules (tour_package_id, starts_at, ends_at, max_capacity)
         SELECT id, $2, $3, $4
         FROM tour_packages
         WHERE name = $1
         ON CONFLICT (tour_package_id, starts_at) DO NOTHING`,
        [schedule.packageName, schedule.startsAt, schedule.endsAt, schedule.maxCapacity],
      )
    }

    for (const guide of guides) {
      await client.query(
        `INSERT INTO guides (full_name, phone)
         VALUES ($1, $2)
         ON CONFLICT (phone) DO NOTHING`,
        [guide.fullName, guide.phone],
      )
      await client.query(
        `INSERT INTO guide_assignments (tour_schedule_id, guide_id)
         SELECT tour_schedules.id, guides.id
         FROM tour_schedules
         JOIN tour_packages ON tour_packages.id = tour_schedules.tour_package_id
         JOIN guides ON guides.phone = $3
         WHERE tour_packages.name = $1
           AND tour_schedules.starts_at = $2
         ON CONFLICT (tour_schedule_id, guide_id) DO NOTHING`,
        [guide.packageName, guide.startsAt, guide.phone],
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}
