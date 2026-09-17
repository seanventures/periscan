# Periscan Deploy Requirements

Derived from the actual repo (package.json scripts, `.env.example`, prisma, worker/runner). Authoritative complement to `PRODUCTION_READINESS.md` / `RUNNER_SPEC.md`.

## Runtime

- **Node** `>=20.0.0`
- **Package manager** `pnpm@9.15.0` (monorepo, `pnpm -r`; no turbo)
- **Datastores**: PostgreSQL (Prisma), Redis (BullMQ queues), S3-compatible object storage (MinIO/`MINIO_ENDPOINT` or `PERISCAN_EVIDENCE_S3_ENDPOINT`) for evidence artifacts.

## Build / run

- Install: `pnpm install`
- Build: `pnpm build` (`pnpm -r --if-present build`)
- DB migrate (prod): `pnpm --filter @periscan/db db:migrate:deploy` (`prisma migrate deploy`)
- Seed (demo/optional): `pnpm seed:demo`
- API start: `pnpm --filter @periscan/api start` (Fastify; `PERISCAN_API_PORT`)
- Web start: `pnpm --filter @periscan/web start` (Next.js; `PERISCAN_WEB_PORT`, `PERISCAN_API_URL`)
- Worker: `apps/worker` BullMQ processor (validation jobs, webhook delivery, model-gateway turns) — needs Redis + DB.
- Runner (optional, customer-side): Go, outbound-only signed-task polling; `apps/runner`, image via `pnpm runner:docker:build`.

## Required environment / secrets (from `.env.example`)

- **Core**: `DATABASE_URL`, `REDIS_URL`, `PERISCAN_JWT_SECRET`, `PERISCAN_API_URL`, ports.
- **Security (prod must set real values; dev fallbacks refuse in production — v0.1.125)**: `PERISCAN_JWT_SECRET`, `PERISCAN_INTEGRATION_CREDENTIAL_KEY`, `PERISCAN_MODEL_CREDENTIAL_KEY`, `PERISCAN_DEPLOYMENT_ENVIRONMENT=production`, `PERISCAN_COOKIE_SECURE=true`, `PERISCAN_CORS_ORIGINS`.
- **Object storage**: `PERISCAN_EVIDENCE_S3_ENDPOINT` / `MINIO_ENDPOINT`, `PERISCAN_OBJECT_STORAGE_RETENTION_DAYS`.
- **Queues**: `PERISCAN_QUEUE_MAX_ATTEMPTS`, `PERISCAN_QUEUE_BACKOFF_MS`, `PERISCAN_WORKER_CONCURRENCY`.
- **Rate limits**: `PERISCAN_RATE_LIMIT_MAX/WINDOW`, `PERISCAN_AUTH_RATE_LIMIT_MAX`.
- **Ops/observability (deployment-readiness gated)**: `PERISCAN_DATABASE_BACKUP_CADENCE`, `PERISCAN_LOG_AGGREGATION_TARGET`, `PERISCAN_ALERT_ROUTING_TARGET`, `PERISCAN_INCIDENT_CONTACT`.
- **Runner (customer install)**: `PERISCAN_RUNNER_*` (control-plane URL, runner ID, bearer auth token, `PERISCAN_RUNNER_MTLS_CA_FILE`, `PERISCAN_RUNNER_MTLS_CLIENT_CERT_FILE`, `PERISCAN_RUNNER_MTLS_CLIENT_KEY_FILE`, task-signing key ID/public key, optional outbound proxy, kill switch). The default runner transport is mTLS client certificate plus bearer token over TLS and signed task envelopes; reverse SSH, inbound listeners, and arbitrary tunnels remain disallowed.
- **Model gateway (BYO key, per-tenant via UI)**: customer-supplied provider API key stored encrypted (`PERISCAN_MODEL_CREDENTIAL_KEY` derives the cipher).

## External services

- Postgres, Redis, S3/MinIO (required). All connector live syncs and model-gateway turns require **customer-supplied** credentials entered per-tenant (encrypted at rest) — none are platform secrets.

## Background work

- Worker timers: evidence retention purge; system validation sweep (`runSystemValidationSweep` — integration sync, fix re-verification, mission schedules, threat-feed ingestion) on `PERISCAN_VALIDATION_SWEEP_INTERVAL_MS` (default 15m). No external cron required (in-process).

## Not in scope / blockers requiring human authorization

- Payment processing (out of scope per Phase 7).
- Live BAS/Atomic/Caldera/SharpHound execution (policy-gated; legal review).
- Live connector/model credentials (customer-provided).
- Actual deployment (do not deploy without explicit authorization).

## Migrations & rollback

- **Apply (prod):** `pnpm --filter @periscan/db db:migrate:deploy` (`prisma migrate deploy`). Applies pending migrations in order; does NOT reset or check drift. Run before starting the API/worker.
- **History integrity:** `prisma migrate status` must report "up to date" before deploy. (Pre-existing enum-drift was backfilled in v0.1.153; `migrate dev` is usable again.)
- **Migration style:** all migrations to date are ADDITIVE (new columns are nullable, new enum values use `ADD VALUE IF NOT EXISTS`). Additive deploys are safe to roll forward and require no data backfill.
- **Rollback approach:** Prisma has no auto-down. To roll back, deploy the prior application image first (new nullable columns / unused enum values are ignored by old code — forward-compatible), then, only if necessary, hand-author a reverse migration (`DROP COLUMN` / leave enum values — Postgres cannot drop an enum value, so leave it). Never `prisma migrate reset` in production (drops all data).
- **Destructive changes:** none to date. Any future destructive migration (drop/rename/non-null-without-default) MUST ship with a documented down-path + a backup taken via `PERISCAN_DATABASE_BACKUP_CADENCE` policy before apply.

## E2E (Playwright) — CI-only

- Command: `pnpm test:e2e` (`playwright test`, `testDir: tests/e2e`).
- Auto-starts the stack via `webServer`: `@periscan/api dev` (waits on `/health`) + `@periscan/web dev` (waits on `/api/v1/health`).
- **Prerequisites:** Postgres + Redis reachable, env configured, and Playwright browsers installed (`pnpm exec playwright install`). Not run in the local sandbox here (no browser/Redis); designated for CI with the full stack.
- Coverage (3 specs): `first-customer-proof-loop.spec.ts` (signup → scope → verify → snapshot/findings journey), `web-app-shell.spec.ts` (global nav/shell + routing), `web-accessibility.spec.ts` (a11y of key surfaces).

## Prelaunch smoke checklist

1. `pnpm install && pnpm build` clean.
2. `db:migrate:deploy` against the target Postgres; `migrate status` up to date.
3. API `/health/ready` returns ready (deps: DB, Redis, validation sweep).
4. Web loads, signup → create scope → verify (dev) / DNS-or-file (prod) → snapshot renders real data.
5. Connect a connector with real creds (scratch tenant) → sync → signal appears in findings.
6. Worker drains a validation job; evidence artifact stored + integrity-verified.
7. Run a scope posture check → measured findings appear; confirm it enrolls in continuous monitoring (cadence shown).
