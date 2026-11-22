# Development guide

## Required software

| Tool | Version used here | Why it is required |
| --- | --- | --- |
| Node.js | 24, minimum 22.13 | Runs the API and the Vite dev server. |
| npm | 11, comes with Node.js | Installs dependencies and runs the scripts below. |
| PostgreSQL | 18 | Stores bookings, visitors, payments, and accounts. The programs are installed with PostgreSQL. A separate server does not have to be downloaded. |
| Git | Already connected to GitHub | The working branch is `main`. |
| A current browser | Chrome, Edge, or Firefox | Opens the site at `http://localhost:5173`. |

## Install

From the repository root (`abba-jifar`):

```powershell
copy .env.example .env
npm install
```

Edit `.env` before the next command. Replace both `replace-with-` passwords with local values. Then create the database, tables, and sample rows:

```powershell
npm run db:setup
```

`npm install` installs the root tools and the `client` and `server` workspaces. Run it once per machine, and again after `package.json` changes.

## Environment variables

The API reads `.env` from the repository root. Use local values like these, with your own passwords:

```text
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://abba_jifar:your-database-password@127.0.0.1:5433/abba_jifar
SEED_ADMIN_EMAIL=admin@abba-jifar.local
SEED_ADMIN_PASSWORD=your-admin-password
```

| Variable | Meaning |
| --- | --- |
| `PORT` | Port for the Express API. |
| `NODE_ENV` | `development` while building locally. |
| `CLIENT_ORIGIN` | Browser origin allowed to call the API directly. |
| `DATABASE_URL` | PostgreSQL user, password, host, port, and database name. |
| `SEED_ADMIN_EMAIL` | Email of the development administrator. |
| `SEED_ADMIN_PASSWORD` | Local password for that account. At least 8 characters. The database stores only a hash. |

Do not put real passwords in source files or in `.env.example`. Do not commit `.env`. `JWT_SECRET` is reserved for the authentication phase and is ignored for now.

## Database setup

`npm run db:up` connects with `DATABASE_URL`.

- If that connection works, it leaves the server alone.
- If a project cluster already exists in `database/pgdata`, it starts that cluster.
- Otherwise it creates a new cluster on the port in `DATABASE_URL` and creates the named database.

On this computer, PostgreSQL 18 is installed as a Windows service on port 5432. That service asks for a password the project does not have, so the local URL uses port **5433**. `db:up` uses the PostgreSQL 18 programs already installed and does not change the service on 5432.

After a restart of the computer, run `npm run db:up` again before `npm run dev`. The data in `database/pgdata` remains.

| Command | What it does |
| --- | --- |
| `npm run db:up` | Starts the local PostgreSQL cluster if it is not already accepting connections. |
| `npm run db:down` | Stops the project-local cluster. It does not stop the Windows service on port 5432. |
| `npm run db:migrate` | Applies SQL files in `database/migrations` that have not run yet. |
| `npm run db:seed` | Inserts roles, the administrator, tour packages, schedules, and guides. Running it again does not duplicate those rows. |
| `npm run db:setup` | Runs up, migrate, and seed. |
| `npm run db:reset` | Deletes the local tables and rows, then migrates and seeds again. Use this only when you mean to wipe the local database. |

A successful health response looks like this:

```json
{
  "status": "ok",
  "service": "abba-jifar-api",
  "database": {
    "status": "connected",
    "message": "PostgreSQL connection succeeded."
  }
}
```

The seed administrator can be checked later when sign-in exists. The email is `SEED_ADMIN_EMAIL`. The password is the value in `.env`, not a value stored in Git.

## Start the development environment

From the repository root:

```powershell
npm run db:up
npm run dev
```

- Website: `http://localhost:5173`
- API: `http://localhost:4000`
- Health check: `http://localhost:4000/api/health`

The website calls `/api/health`. Vite forwards that path to the API, and the page shows the JSON fields.

Start one side only when you are working there:

```powershell
npm run dev:server
npm run dev:client
```

Stop the website and API with `Ctrl+C` in the terminal that ran `npm run dev`. Stop the database with `npm run db:down` when you are finished for the day.

## Commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies for the root, client, and server. |
| `npm run dev` | Starts the API and the website together. |
| `npm run dev:server` | Starts only the API, with reload on save. |
| `npm run dev:client` | Starts only the website. |
| `npm run typecheck` | Type-checks the server and the client. |
| `npm test` | Checks migrations, constraints, transactions, seed data, and `/api/health`. PostgreSQL must already be accepting connections. |
| `npm run lint` | Lints the client with oxlint. |
| `npm run build` | Type-checks, then builds the client into `client/dist`. |

## Folder map

| Path | Contents |
| --- | --- |
| `client/` | React frontend |
| `server/src/routes/` | URL routes |
| `server/src/controllers/` | Request and response handlers |
| `server/src/services/` | Business logic for a request |
| `server/src/repositories/` | Table reads and writes |
| `server/src/validation/` | Checks on input values |
| `server/src/security/` | Password hashing |
| `server/src/db/` | Migrations, seed data, transactions, and database errors |
| `server/src/config/` | Environment variables and the connection pool |
| `server/src/scripts/` | Commands for starting, migrating, seeding, and resetting the database |
| `server/tests/` | API and database checks |
| `shared/src/` | Types used by the client and the server |
| `database/migrations/` | SQL schema files |
| `database/pgdata/` | Local PostgreSQL files, created on this machine and not committed |
| `docs/` | Project documentation |

## Git workflow

The repository is on `main` and tracks https://github.com/nugusamulatu67-ux/abba-jifar-palace.

1. Keep `main` in a state that installs and runs.
2. Create a branch for one piece of work: `git switch -c feature/short-name`.
3. Make small commits on that branch. Suggested prefixes: `feat`, `fix`, `docs`, `chore`.
4. Open a pull request and ask one teammate to read it before merging.
5. Update your branch from `main` before you continue a long task.

Do not commit `.env`, `node_modules/`, `client/dist/`, `database/pgdata/`, or `*.sqlite`. The root `.gitignore` already excludes them.

Avoid rewriting published history. Do not force-push `main`.

## If something fails

- **`npm run dev` cannot find a script.** Run it from the repository root, after `npm install`.
- **`DATABASE_URL must be set`.** Copy `.env.example` to `.env` and replace the placeholder passwords.
- **The page says it cannot reach the API.** The API is not running, or port 4000 is taken. Start `npm run dev:server`, or change `PORT` in `.env` and the proxy target in `client/vite.config.ts` together.
- **`http://127.0.0.1:5173` does not connect.** On this Windows setup Vite listens on `localhost` (IPv6). Open `http://localhost:5173`. The API on port 4000 accepts both `localhost` and `127.0.0.1`.
- **Port 5173 is taken.** Stop the other Vite process, or start the client with `npm run dev -w client -- --port 5174`.
- **Health database status is `unavailable`.** Run `npm run db:up`. Read `database.message` in the JSON. If the computer was restarted, the project cluster on port 5433 needs to be started again.
- **`password authentication failed`.** The password in `DATABASE_URL` does not match the cluster. For a new local cluster, delete `database/pgdata` only when you can afford to lose that local data, set the password, and run `npm run db:setup` again.
