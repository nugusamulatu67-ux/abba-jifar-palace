# Database

PostgreSQL holds the application data. The table design and booking rules are in [../docs/DATABASE_DESIGN.md](../docs/DATABASE_DESIGN.md).

## Local server

`DATABASE_URL` in the root `.env` file selects the server, user, password, and database. The usual development URL uses port **5433**:

```text
postgresql://abba_jifar:your-database-password@127.0.0.1:5433/abba_jifar
```

`npm run db:up` starts a project-local cluster with the PostgreSQL programs already installed on this computer. Its files live in `database/pgdata/` and are not committed. The Windows PostgreSQL service on port 5432 is a different server and is not changed.

## Commands

From the repository root:

```powershell
npm run db:setup
```

That starts PostgreSQL, applies `database/migrations/001_init.sql`, and inserts the development rows. Details and the other commands are in [../docs/DEVELOPMENT_GUIDE.md](../docs/DEVELOPMENT_GUIDE.md).

## Phase 1 file

`database/dev.sqlite` may still be on disk from the first connection test. It has no application tables. The API does not open it anymore.
