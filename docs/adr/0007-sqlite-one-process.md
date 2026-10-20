# ADR 0007: SQLite, One Process

## Status

Accepted

## Context

HumanRoute is a hackathon MVP with one expert, low traffic and one replica. The guarantees in ADR 0003 to 0006 rely on atomic transactions and unique indexes, not on distributed coordination.

## Decision

- API, expert inbox and payouts worker run in one Node process, started by `src/index.ts`.
- Storage is one SQLite file in WAL mode on a persistent disk. One replica only.
- Migrations are forward-only numbered files `sql/NNN_name.sql`.
  - Each file is applied in its own transaction and recorded in a `schema_migrations` table (version, applied_at).
  - Pending migrations are applied at startup, in order, before the HTTP server starts.
  - An applied migration is never edited; a change is a new file. There are no down migrations.

## Alternatives

- Postgres plus a job queue: stronger operationally, but a second service to deploy for no MVP benefit.
- Separate worker process: needs cross-process locking around the same SQLite file.
- In-memory store: loses jobs and replay protection on restart.

## Consequences

- Deployment is one process and one disk; ephemeral disks lose money records and are not allowed.
- Horizontal scaling is out of scope; moving off SQLite needs a new ADR.
- The worker loop and HTTP handlers share one database handle and serialize writes through SQLite.
