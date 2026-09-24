# Local Community compose

New installs use [`docker-compose.community-deps.yml`](./docker-compose.community-deps.yml)
for Postgres, Redis, and SeaweedFS S3 (project **`periscan-community-deps`**).
Existing installs keep [`docker-compose.yml`](./docker-compose.yml) and their
MinIO volumes until evidence is migrated and verified. The Community overlay
adds api, web, and worker to the selected dependency project.
The legacy path is `infra/docker-compose/docker-compose.yml`.

Do **not** `docker compose up` at the repo root. Use the Community scripts or
the explicit dependency file below. The root `compose.yaml` is not this local
development stack.

## Overlay (api + web + worker)

Requires Docker. First image build copies the monorepo and runs `pnpm install`.

```bash
docker compose \
  -f infra/docker-compose/docker-compose.community-deps.yml \
  -f infra/docker-compose/docker-compose.community.yml \
  up -d --build --wait
```

Or: `bash scripts/community-up.sh`

Then:

| Service    | URL                                 |
| ---------- | ----------------------------------- |
| Web        | http://127.0.0.1:3000               |
| API        | http://127.0.0.1:3001               |
| API health | http://127.0.0.1:3001/api/v1/health |

In-network `DATABASE_URL` is `postgresql://periscan:periscan@postgres:5432/periscan`.
From the host (deps published port, default 5432):

```text
postgresql://periscan:periscan@127.0.0.1:${PERISCAN_POSTGRES_PUBLISHED_PORT:-5432}/periscan
```

`PERISCAN_DEV_MODE=true` is local-only. Production forbids it
(`PERISCAN_DEPLOYMENT_ENVIRONMENT=production` fails closed). Do not copy this
overlay into a customer/production deploy.

Stop:

```bash
docker compose \
  -f infra/docker-compose/docker-compose.community-deps.yml \
  -f infra/docker-compose/docker-compose.community.yml \
  down
```

## Host toolchain (faster, no image build)

`pnpm lab:dev` is the supported path when you already have Node 24 + pnpm 9.15.0:

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.community-deps.yml up -d --wait
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_EVIDENCE_S3_ENDPOINT=http://127.0.0.1:9000
export PERISCAN_EVIDENCE_S3_BUCKET=periscan-evidence
export PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID=periscan
export PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY=periscan123
pnpm --filter @periscan/evidence exec tsx src/ensure-local-bucket.ts
pnpm --filter @periscan/db db:generate
pnpm --filter @periscan/db db:migrate:deploy
pnpm lab:dev
```

See [`USING.md`](../../USING.md) and `infra/lab/README.md` for the measured
lab loop (`lab:up` / `lab:demo-up`). That loop is not this overlay. The GitHub
fold is [`README.md`](../../README.md) (`scripts/periscan.sh`).
