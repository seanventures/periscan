# Local Community compose

Postgres, Redis, and MinIO live in [`docker-compose.yml`](./docker-compose.yml)
(project name **`periscan-deps`**). The Community overlay adds api, web, and
worker so a clone can run the control plane against those deps.

Do **not** `docker compose up` at the repo root. Root `compose.yaml` is the
goldeneye production stack (private tailnet registry + Traefik).

## Overlay (api + web + worker)

Requires Docker. First image build copies the monorepo and runs `pnpm install`.

```bash
docker compose \
  -f infra/docker-compose/docker-compose.yml \
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
  -f infra/docker-compose/docker-compose.yml \
  -f infra/docker-compose/docker-compose.community.yml \
  down
```

## Host toolchain (faster, no image build)

`pnpm lab:dev` is the supported path when you already have Node 24 + pnpm 9.15.0:

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d --wait
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm --filter @periscan/db db:generate
pnpm --filter @periscan/db db:migrate:deploy
pnpm lab:dev
```

See the repo README first-run section and `infra/lab/README.md` for the measured
lab loop (`lab:up` / `lab:demo-up`). That loop is not this overlay.
