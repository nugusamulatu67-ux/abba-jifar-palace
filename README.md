# Abba Jifar Palace

Tour booking and visitor management website for Abba Jifar Palace, a historical heritage site in Jimma, Ethiopia.

Visitors will book tours. Staff will record who arrives and whether a booking is paid. Administrators will manage tours, bookings, and access. Phase 1 sets up the environment and a health check. Those features are not built yet.

## Stack

- **Frontend:** React, TypeScript, Vite (`client/`)
- **Backend:** Node.js, Express, TypeScript (`server/`)
- **Database:** SQLite through Node’s built-in `node:sqlite`
- **Shared types:** `shared/src/`

Details and the reason for SQLite are in [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md).

## Quick start

Requirements: Node.js 22.13 or newer (Node.js 24 was used here) and npm. Full notes are in [docs/DEVELOPMENT_GUIDE.md](docs/DEVELOPMENT_GUIDE.md).

```powershell
copy .env.example .env
npm install
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
server/src/config/      Environment and database connection
server/src/routes/      API routes
server/src/controllers/ Request handlers
server/src/services/    Business logic
server/tests/           Health and database checks
shared/src/             Types shared by client and server
database/               Local SQLite file, created on first connection
docs/                   Project documents
```

## Team workflow

Git is already initialized on `master`. There is no commit and no remote yet. Do not push until the team decides to.

1. Copy `.env.example` to `.env` and run `npm install`.
2. Work on a branch such as `feature/booking-create`.
3. Keep commits small. Use prefixes such as `feat`, `fix`, `docs`, and `chore`.
4. Open a pull request and have a teammate read it before it joins `master`.
5. Leave `.env`, `node_modules/`, build output, and `*.sqlite` untracked. `.gitignore` covers them.

`master` should stay in a state where `npm install` and `npm run dev` succeed.

## Phase 1 status

Included: project structure, documentation, configuration, a placeholder page, `GET /api/health`, and a SQLite connection check.

Next, after review: confirm the assumptions in the requirements, then add the database tables. See the roadmap.
