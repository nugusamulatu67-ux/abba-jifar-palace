# Development guide

## Required software

| Tool | Version used here | Why it is required |
| --- | --- | --- |
| Node.js | 24, minimum 22.13 | Runs the API and the Vite dev server. SQLite is built in from 22.13 onward (`node:sqlite`). |
| npm | 11, comes with Node.js | Installs dependencies and runs the scripts below. |
| Git | Already initialized in this folder | Shares changes. The branch is `master`. There is no commit and no remote yet. |
| A current browser | Chrome, Edge, or Firefox | Opens the site at `http://localhost:5173`. |

PostgreSQL, Docker, and a global TypeScript install are not required for this phase. Docker Desktop is present on the setup machine and was not running. The app uses SQLite instead, as explained in [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md).

## Install

From the repository root (`abba-jifar`):

```powershell
copy .env.example .env
npm install
```

`npm install` installs the root tools and the `client` and `server` workspaces. Run it once per machine, and again after `package.json` changes.

A `.env` file is already present on the machine where Phase 1 was set up. Anyone who clones the repository later still needs to copy `.env.example` to `.env`.

## Environment variables

Edit `.env` in the repository root. Safe local values:

```text
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
DATABASE_PATH=database/dev.sqlite
```

| Variable | Meaning |
| --- | --- |
| `PORT` | Port for the Express API. |
| `NODE_ENV` | `development` while building locally. |
| `CLIENT_ORIGIN` | Browser origin allowed to call the API directly. |
| `DATABASE_PATH` | SQLite file. A relative path starts at the repository root. |

The server reads `.env` from the repository root even when the command runs inside `server/`. If `.env` is missing, those defaults are used.

Do not put real passwords or API keys in source files or in `.env.example`. Do not commit `.env`. Authentication will add `JWT_SECRET` later. The example file mentions it and the server ignores it for now.

## Start the development environment

From the repository root, start the API and the website together:

```powershell
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

Stop both with `Ctrl+C` in the terminal that ran `npm run dev`.

## Connect to the database

There is no separate database server to start. The API opens `database/dev.sqlite` when it handles `/api/health` or when the tests run.

A successful health response looks like this:

```json
{
  "status": "ok",
  "service": "abba-jifar-api",
  "time": "2026-11-22T12:00:00.000Z",
  "database": {
    "status": "connected",
    "message": "SQLite connection succeeded."
  }
}
```

The file appears after the first successful connection. It is gitignored. Delete `database/dev.sqlite` if you want a fresh local file. Tables do not exist yet, so there is nothing to browse except the empty database file.

To confirm the connection without the browser:

```powershell
curl.exe http://localhost:4000/api/health
```

## Commands

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `npm install` | Installs dependencies for the root, client, and server. |
| `npm run dev` | Starts the API and the website together. |
| `npm run dev:server` | Starts only the API, with reload on save. |
| `npm run dev:client` | Starts only the website. |
| `npm run typecheck` | Type-checks the server and the client. |
| `npm test` | Opens a temporary database and requests `/api/health`. |
| `npm run lint` | Lints the client with oxlint. |
| `npm run build` | Type-checks, then builds the client into `client/dist`. |

Server-only variants, from `server/`:

```powershell
npm run dev
npm test
npm run typecheck
```

## Folder map

| Path | Contents |
| --- | --- |
| `client/` | React frontend |
| `server/src/routes/` | URL routes |
| `server/src/controllers/` | Request and response handlers |
| `server/src/services/` | Business logic |
| `server/src/config/` | Environment and database connection |
| `server/tests/` | API and database checks |
| `shared/src/` | Types used by the client and the server |
| `database/` | Local SQLite file (generated) and a short readme |
| `docs/` | Project documentation |

Uploaded files and authentication modules are not folders yet. Add them in the phase that first needs them.

## Git workflow

The repository is already a Git repo on `master`, with no commits and no remote. Do not push or change remotes until the team asks.

Recommended daily workflow:

1. Keep `master` in a state that installs and runs.
2. Create a branch for one piece of work: `git switch -c feature/short-name`.
3. Make small commits on that branch. Suggested prefixes: `feat`, `fix`, `docs`, `chore`.
4. Open a pull request and ask one teammate to read it before merging.
5. Update your branch from `master` before you continue a long task.

Do not commit `.env`, `node_modules/`, `client/dist/`, or `*.sqlite`. The root `.gitignore` already excludes them.

Avoid rewriting published history. Do not force-push `master`.

## If something fails

- **`npm run dev` cannot find a script.** Run it from the repository root, after `npm install`.
- **The page says it cannot reach the API.** The API is not running, or port 4000 is taken. Start `npm run dev:server`, or change `PORT` in `.env` and the proxy target in `client/vite.config.ts` together.
- **`http://127.0.0.1:5173` does not connect.** On this Windows setup Vite listens on `localhost` (IPv6). Open `http://localhost:5173`. The API on port 4000 accepts both `localhost` and `127.0.0.1`.
- **Port 5173 is taken.** Stop the other Vite process, or start the client with `npm run dev -w client -- --port 5174`.
- **`PORT must be an integer`.** Fix `PORT` in `.env`.
- **Health database status is `unavailable`.** Read `database.message` in the JSON. Check that `DATABASE_PATH` points at a folder the user can write to.
