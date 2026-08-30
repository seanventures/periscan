# Deploy pipeline (WS6)

The **automated** deploy pipeline for Periscan: a gated, reproducible,
safe-by-default GitHub Actions workflow. This is the CI/CD companion to the
manual, topology-focused [`docs/DEPLOY.md`](DEPLOY.md) (images, runners,
governance) — read that for what the system is; read this for how a release is
gated, deployed, smoke-tested, and rolled back.

Pipeline files:

- [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) — the workflow
- [`scripts/smoke-test.sh`](../scripts/smoke-test.sh) — standalone post-deploy smoke test

## TL;DR

- The workflow runs the release gate on every trigger, then a **deploy** job
  that is **gated behind a GitHub Environment** (default `production`).
- By default the deploy job runs a **non-destructive dry-run** (compose config
  validation + `terraform validate`) and exits green. It **never** runs
  `terraform apply` or any destructive command unless a maintainer explicitly
  opts in.
- A real apply requires the environment var `PERISCAN_DEPLOY_ENABLED=true` **and**
  a configured SSH deploy target. Absent either, you get the safe dry-run.

## Triggers

| Trigger              | When                                    | Environment                          |
| -------------------- | --------------------------------------- | ------------------------------------ |
| `workflow_dispatch`  | Manual run from the Actions tab         | chosen via the `environment` input   |
| `push` tag `v*`      | Pushing a version tag (e.g. `v1.4.0`)   | `production`                         |

Tagging is the intended release path: version tags also drive
[`images-build.yml`](../.github/workflows/images-build.yml), which builds and
pushes control-plane images to GHCR (`ghcr.io/seanheiney/periscan-api`,
`-web`, `-scan-executor`, and optional Agent (in-network) `-runner-agent`), and
[`runner-publish.yml`](../.github/workflows/runner-publish.yml), which publishes
the Supported Customer Runner Go LTS image (`ghcr.io/seanheiney/periscan-runner`).

## Stages

### 1. Release gate (`gate` job)

Reproducible: it stands up the same Postgres / Redis / MinIO service containers
and env as [`ci.yml`](../.github/workflows/ci.yml), then runs the core release
checks:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build` (production artifacts)
- `pnpm --filter @periscan/db db:migrate:deploy` (migrations apply cleanly from
  the committed migration history)
- `pnpm test:acceptance`

The full `pnpm verify` superset (runner checks, license/OSS gates, E2E,
security, dependency audit, etc.) runs in `ci.yml` on every push/PR; the deploy
gate runs the focused subset so it is fast and does not require Docker-in-Docker.
The deploy job `needs: gate`, so a failing gate blocks the deploy.

### 2. Deploy (`deploy` job) — gated + safe by default

The job declares `environment: production` (or the dispatch input). That means:

- GitHub enforces the environment's **required reviewers / wait timer** before
  the job starts, and
- only the environment's secrets/vars are visible to the job.

Inside the job, the **deploy mode** is resolved:

- **`apply`** — only when `vars.PERISCAN_DEPLOY_ENABLED == 'true'` **and** the
  secret `PERISCAN_DEPLOY_SSH_HOST` is present.
- **`dry-run`** — every other case (the default).

**Dry-run** (safe default) does:

- `docker compose -f infra/production/docker-compose.prod.yml config` with
  placeholder env — validates the production compose file interpolates and is
  well-formed. Starts nothing.
- `terraform init -backend=false && terraform validate` in `infra/terraform`.
  (`terraform plan` slots in here once provider modules exist; today that
  directory only pins versions, per its README.)

**Apply** (opt-in) does, over SSH to the configured host:

- `docker compose ... pull` the GHCR images for this tag,
- `docker compose ... run --rm api ... db:migrate:deploy` (forward-only,
  idempotent migrations before swapping traffic),
- `docker compose ... up -d`.

This mirrors the manual procedure in
[`infra/production/README.md`](../infra/production/README.md).

### 3. Post-deploy smoke tests

After an apply (or whenever `PERISCAN_SMOKE_BASE_URL` is set), the job runs
[`scripts/smoke-test.sh`](../scripts/smoke-test.sh), which fails the deploy on
any non-200:

1. `GET /api/v1/health` → 200
2. `GET /api/v1/health/ready` → 200 (DB, queue, evidence store all ok)
3. authed round-trip: `POST /api/v1/auth/signup` → 201, then
   `GET /api/v1/tenants/current` with the returned session cookie → 200
4. `GET WEB_BASE_URL/` → 200 (when `PERISCAN_SMOKE_WEB_BASE_URL` is set)

Run it locally against any deployment:

```bash
BASE_URL=https://api.example.com \
WEB_BASE_URL=https://app.example.com \
  bash scripts/smoke-test.sh
```

Set `SMOKE_SKIP_SIGNUP=1` for environments where open signup is disabled.

## What a maintainer must provide to actually deploy

Configure these on the **GitHub Environment** (`Settings → Environments →
production`). Nothing here is invented — the app's own runtime requirements come
from [`infra/production/.env.production.example`](../infra/production/.env.production.example),
and the deploy-target values are the ones `deploy.yml` reads.

### Environment protection (required for a safe gate)

- Add **required reviewers** and/or a **wait timer** to the `production`
  environment so the deploy job pauses for approval.

### Environment **variables** (non-secret)

| Var                             | Required for | Purpose                                                        |
| ------------------------------- | ------------ | -------------------------------------------------------------- |
| `PERISCAN_DEPLOY_ENABLED`       | apply        | Must be exactly `true` to allow a real apply. Absent → dry-run |
| `PERISCAN_DEPLOY_PATH`          | apply        | Directory on the host holding the repo + `.env.production`      |
| `PERISCAN_SMOKE_BASE_URL`       | smoke        | Deployed API base URL, e.g. `https://api.example.com`          |
| `PERISCAN_SMOKE_WEB_BASE_URL`   | optional     | Deployed web base URL, e.g. `https://app.example.com`          |
| `PERISCAN_SMOKE_SKIP_SIGNUP`    | optional     | `1` to skip the signup round-trip (open signup disabled)       |

### Environment **secrets**

Deploy target (SSH apply path):

| Secret                        | Required for | Purpose                                    |
| ----------------------------- | ------------ | ------------------------------------------ |
| `PERISCAN_DEPLOY_SSH_HOST`    | apply        | Target host for `docker compose up -d`     |
| `PERISCAN_DEPLOY_SSH_USER`    | apply        | SSH user                                   |
| `PERISCAN_DEPLOY_SSH_KEY`     | apply        | Private key (PEM) for the SSH user         |

Application runtime secrets live in the host's `.env.production` (see
`infra/production/.env.production.example`) and are **not** injected by the
workflow. They are: `DATABASE_URL`, `REDIS_URL`, `PERISCAN_JWT_SECRET`,
`PERISCAN_EVIDENCE_S3_ENDPOINT`, `PERISCAN_EVIDENCE_S3_BUCKET`,
`PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID`, `PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY`,
`PERISCAN_EVIDENCE_S3_REGION`, plus `PERISCAN_DEPLOYMENT_ENVIRONMENT=production`.
The API refuses to start in production if `PERISCAN_JWT_SECRET` is the dev
default.

GHCR pull uses the built-in `GITHUB_TOKEN` (images are org-scoped); no extra
secret is required for the workflow itself. If the host pulls the images
directly, give it a read-only GHCR token out of band.

> Until `PERISCAN_DEPLOY_ENABLED=true` and the SSH secrets are set, every run is
> a dry-run — this is intentional and safe.

## Rollback

Deploys are forward-only migrations plus an image swap, so rollback is a
**redeploy of the previous good tag** and, if a migration must be undone, a
**database restore**.

1. **Redeploy the previous tag.** Re-run `deploy.yml` via `workflow_dispatch`
   from the previous good tag, or push/re-point the deployment to it. On the
   host this is equivalent to:

   ```bash
   export PERISCAN_IMAGE_TAG=v1.3.0   # previous good tag
   docker compose -f infra/production/docker-compose.prod.yml \
     --env-file .env.production pull
   docker compose -f infra/production/docker-compose.prod.yml \
     --env-file .env.production up -d
   ```

2. **Verify** with the smoke test:

   ```bash
   BASE_URL=https://api.example.com bash scripts/smoke-test.sh
   ```

3. **Restore the database** only if a bad migration corrupted data. Backups come
   from [`scripts/db-backup.sh`](../scripts/db-backup.sh); restore with
   [`scripts/db-restore.sh`](../scripts/db-restore.sh) (destructive — guarded by
   an explicit confirmation):

   ```bash
   PERISCAN_RESTORE_URL=postgres://user:pass@host:5432/periscan \
   PERISCAN_RESTORE_CONFIRM=yes \
     bash scripts/db-restore.sh .backups/periscan-<stamp>.dump
   ```

   [`scripts/db-restore-drill.sh`](../scripts/db-restore-drill.sh) is the
   non-destructive drill (restore into a throwaway DB and assert parity) — run
   it periodically so a real restore is trusted.

## Safety summary

- Deploy is gated behind a GitHub Environment (approval + scoped secrets).
- Dry-run is the default; a real apply requires an explicit opt-in var **and** a
  configured target.
- No `terraform apply` / destructive command runs without that opt-in.
- Post-deploy smoke tests fail the deploy if health/readiness/authed-read regress.
