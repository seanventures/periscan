# Periscan Ops Runbooks (WS2)

Operational runbooks for the top failure modes, grounded in the real behavior of
this system (not aspirational). Each entry: how to detect, immediate mitigation,
root-cause, and prevention.

Observability inputs referenced below:
- `GET /api/v1/metrics` — JSON ops snapshot incl. `lastValidationSweep`
  (continuous-validation sweep outcome + per-runner failure counts).
- `GET /api/v1/metrics/prometheus` — Prometheus exposition.
- `GET /api/v1/health` / `GET /api/v1/health/ready` — liveness / readiness.
- Structured logs (pino/`app.log`) — search by the `op` field (e.g.
  `op=validation.sweep.failures`, `op=runner.marked_offline`).

Backups: `pnpm db:backup` (compressed pg_dump, retained). Restore drill:
`pnpm db:restore-drill` (dump→restore→row-count parity→cleanup; the DR gate).

---

## 1. Disk full (Postgres crash-loop) — HIGH

**We hit this on 2026-07-05.** Postgres logged `PANIC: could not write to file … No
space left on device`, then crash-looped (`FATAL: the database system is in
recovery mode` → `could not write lock file "postmaster.pid"`), and every API
request 500'd at signup/queries.

**Detect**
- API 500s on writes; `GET /api/v1/health/ready` fails.
- `docker ps` shows the postgres container `unhealthy` or `Exited (1)`.
- `docker logs <pg-container>` shows `No space left on device`.
- On Docker Desktop the HOST disk can be fine while Docker's VM disk is full —
  check `docker system df`, not just `df -h`.

**Mitigate (fastest first)**
1. Reclaim space: `docker image prune -af && docker builder prune -af`
   (this recovered ~80 GB for us; it does NOT touch named data volumes).
2. Restart Postgres: `docker restart <pg-container>` (or
   `docker compose -f infra/docker-compose/docker-compose.yml up -d postgres`).
3. Confirm recovery: `docker exec <pg-container> pg_isready -U periscan -d periscan`
   then `pnpm --filter @periscan/db exec prisma migrate status`.

**Root cause**: unbounded local growth (images/build cache in dev; WAL/logs/backups
in prod).

**Prevent**: disk-usage alerting (< 15% free → page); log/WAL rotation; put
backups on separate storage; cap Docker Desktop disk in dev.

---

## 2. Database unavailable / connection refused — HIGH

**Detect**: API 500s with Prisma `P1001`/connection errors;
`GET /api/v1/health/ready` fails; acceptance/`probeDatabaseConnection` throws
"Acceptance tests require a reachable periscan postgres".

**Mitigate**
1. Is it up? `docker exec <pg-container> pg_isready -U periscan -d periscan`.
2. Not running → start it (compose up); recovering → wait, watch `docker logs`.
3. Data corruption / unrecoverable → **restore from backup**:
   - Verify a good backup restores: `pnpm db:restore-drill`.
   - Restore into the target: `PERISCAN_RESTORE_URL=<url> PERISCAN_RESTORE_CONFIRM=yes
     bash scripts/db-restore.sh <.backups/periscan-…dump>`.
4. Re-apply any pending migrations: `pnpm --filter @periscan/db exec prisma migrate deploy`.

**Prevent**: connection-pool sizing, DB health checks in the deploy target,
automated `pnpm db:backup` on a schedule, periodic `pnpm db:restore-drill`.

---

## 3. Runner offline / tasks stranded — MEDIUM

**Detect**: `lastValidationSweep` in `/api/v1/metrics` shows runner failures;
logs `op=runner.marked_offline` / `op=runner.tasks.expired`; in-network
validations stay `Running` and never complete.

**Behavior that already self-heals** (system-scheduler sweep): stale runner tasks
are expired and their runs failed (`expireStaleRunnerTasks`), stuck running jobs
are failed (`failStuckRunningJobs`), and silent Active/Degraded runners are marked
`Offline` (`markStaleRunnersOffline`). A runner's next poll restores it to Active.

**Mitigate**
1. Confirm the sweep is ticking (metrics `lastValidationSweep.ranAt` is recent).
2. On the runner host: check the agent process, its outbound reachability to the
   control plane, and clock skew (task envelopes are time-bounded + Ed25519
   signed; large skew rejects tasks).
3. Re-pair the runner if its credential/cert expired (registration flow).
4. Kill switch: an offline/rogue runner can be stopped server-side (runner
   `killSwitchActive`) so it stops receiving work.

**Prevent**: alert on `lastValidationSweep.failuresByRunner`; monitor runner
heartbeats; certificate-expiry alerts.

---

## 4. Migration drift (22P02 invalid-enum) — MEDIUM

**Detect**: runtime `22P02 invalid input value for enum …` on code paths that use
a schema enum value never added by a migration. In-memory unit tests miss it;
acceptance/real-DB surfaces it.

**Mitigate / Prevent**: `pnpm db:check-drift` (the enum-drift gate, now in
`verify`) fails fast on any schema enum value with no migration. Add an
`ALTER TYPE "<Enum>" ADD VALUE IF NOT EXISTS '<value>'` migration for each gap.
