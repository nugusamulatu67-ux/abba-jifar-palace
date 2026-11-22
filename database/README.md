# Database

Phase 1 configures a local SQLite database and checks that the API can open it. The table design is described in [../docs/DATABASE_DESIGN.md](../docs/DATABASE_DESIGN.md). The `CREATE TABLE` statements are intentionally not written yet.

## File

`DATABASE_PATH` in the root `.env` file selects the database file. The default is:

```text
database/dev.sqlite
```

The server creates the file and its folder the first time it connects. Database files are listed in `.gitignore`, so each developer gets a local database and nothing private is committed.

## Why SQLite for now

Node.js 22.13 and later include SQLite in the standard library (`node:sqlite`). This machine has Node.js, and it does not have a running PostgreSQL server. SQLite is relational, free, and needs no extra database service, so the connection can be installed and tested in this phase.

PostgreSQL remains a possible production database. Moving to it is a later decision, after the schema exists. The conceptual model in the design document uses ordinary tables and relationships and does not depend on a SQLite-only feature.
