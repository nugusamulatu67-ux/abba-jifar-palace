# Abba Jifar Palace

Tour booking and visitor management website for Abba Jifar Palace, a historical heritage site in Jimma, Ethiopia.

Phase 1 set up the environment and a health check. Phase 2 adds the PostgreSQL schema, migrations, and seed data. Booking, sign-in, and the dashboard are not built yet.

## Stack

- **Frontend:** React, TypeScript, Vite (`client/`)
- **Backend:** Node.js, Express, TypeScript (`server/`)
- **Database:** PostgreSQL (`database/migrations/`, connection in `server/src/config/database.ts`)
- **Shared types:** `shared/src/`

Details are in [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md).

## Quick start

Requirements: Node.js 22.13 or newer (Node.js 24 was used here) and npm. Full notes are in [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).

```powershell
copy .env.example .env
npm install
npm run db:setup
npm run dev
```

- Website: http://localhost:5173
- API health: http://localhost:4000/api/health

The home page requests `/api/health` and shows the result. `status` and `database.status` should both be successful (`ok` and `connected`).

## Documentation

| Document | Contents |
| --- | --- |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | Purpose, users, scope, modules |
| [docs/SYSTEM_REQUIREMENTS.md](docs/SYSTEM_REQUIREMENTS.md) | Requirements, roles, constraints |
| [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) | How the client, API, and database connect |
| [docs/DATABASE_DESIGN.md](docs/DATABASE_DESIGN.md) | Entities and relationships |
| [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md) | Install, configuration, commands |
| [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md) | Phases for the 24-hour build |

## Layout

```text
client/                 React website
server/src/config/      Environment and PostgreSQL connection
server/src/routes/      API routes
server/src/controllers/ Request handlers
server/src/services/    Business logic
server/src/repositories/ Table access, including booking writes
server/src/db/          Migrations, seed data, and transactions
server/tests/           Health and database checks
shared/src/             Types shared by client and server
database/migrations/    SQL schema
database/pgdata/        Local PostgreSQL files, not committed
docs/                   Project documents
```

## Team workflow

The project is on `main` and tracks https://github.com/nugusamulatu67-ux/abba-jifar-palace.

1. Copy `.env.example` to `.env`, set the local passwords, then run `npm install` and `npm run db:setup`.
2. Work on a branch such as `feature/booking-create`.
3. Keep commits small. Use prefixes such as `feat`, `fix`, `docs`, and `chore`.
4. Open a pull request and have a teammate read it before it joins `main`.
5. Leave `.env`, `node_modules/`, build output, `database/pgdata/`, and `*.sqlite` untracked. `.gitignore` covers them.

`main` should stay in a state where `npm install`, `npm run db:setup`, and `npm run dev` succeed.

## Current status

Phase 1: project structure, documentation, a placeholder page, and `GET /api/health`.

Phase 2: PostgreSQL schema, migrations, seed data, and booking integrity rules. Sign-in and booking screens are still later phases. See the roadmap.
