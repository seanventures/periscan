# Using Periscan (local)

Operator notes for a clone. The GitHub fold lives in [`README.md`](README.md).
Local/self-host (Node 24, pnpm, Docker, compose, ports, doctor):
[`docs/SETUP.md`](docs/SETUP.md). Offering copy: [`COMMUNITY.md`](COMMUNITY.md).
Step-by-step loop: [`docs/USING.md`](docs/USING.md).

## Preferred start

Need **Node 24** (`.nvmrc`), **pnpm 9.15.0** (Corepack), and **Docker**.
Do **not** run `docker compose up` at the repo root — local deps are
`infra/docker-compose/docker-compose.yml`.

Clone this repo, inspect it, then install:

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

Open the printed URL. Create an account. **Authorize a local clone path** —
`git clone <your-repo>` on this machine, then paste the **absolute path**
(not a hosted `github.com/org/repo` URL). Default start is **Gitleaks-class
secrets** (`jobsQueued=1`). Remediations stay Open until a retest verifies. Keep proving.

Secondary one-paste (inspect `install.sh` first):

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
```

Safer: download, inspect, `bash install.sh`. `bash install.sh --dry-run` prints the plan. Repair: `bash install.sh doctor`. Check only: `bash install.sh health`.

## Fallback (installer not in this clone)

If `scripts/periscan.sh` is not on disk yet:

```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
bash scripts/community-first-hour.sh
pnpm lab:dev
```

`community-first-hour.sh` is compose + migrate. It does **not** run
`seed:demo`, `lab:up`, or `pnpm verify`.

Docker overlay instead of `lab:dev` (api + web + worker):

```bash
bash scripts/community-up.sh
```

`pnpm dev` is api+web only and cannot finish Community runs. Use
`pnpm lab:dev` or `pnpm dev:worker`.

## Ports (`lab:dev` auto-shift)

`lab:dev` auto-shifts web off `3000` and API off `3001` if those binds are
taken; it prints the chosen ports (`PERISCAN_WEB_PORT`, `PERISCAN_API_PORT`).
If `:3001` is taken, it binds the next free API port.

| Service  | Default                 | Override                                                     |
| -------- | ----------------------- | ------------------------------------------------------------ |
| API      | `http://127.0.0.1:3001` | `PERISCAN_API_PORT` (`lab:dev` auto-shift)                   |
| Web      | `http://127.0.0.1:3000` | `PERISCAN_WEB_PORT` (`lab:dev` auto-shifts to 3010+ if busy) |
| Postgres | `127.0.0.1:5432`        | `PERISCAN_POSTGRES_PUBLISHED_PORT` **and** `DATABASE_URL`    |
| Redis    | `127.0.0.1:6379`        | `PERISCAN_REDIS_PUBLISHED_PORT` **and** `REDIS_URL`          |
| MinIO    | `127.0.0.1:9000`        | `PERISCAN_MINIO_PUBLISHED_PORT`                              |

Prisma migrate needs `DATABASE_URL` exported — compose port overrides do not
rewrite it automatically.

## Proof loop (HTTP)

Same loop as the UI. OpenAPI: `GET /openapi.json` or `/api-reference`.

```text
GET  /api/v1/community/validation-suite?scopeId=
POST /api/v1/community/validation-runs
GET  /api/v1/findings?missionId=
POST /api/v1/community/validation-runs/:missionId/remediations
```

HTTP 200 on start is not “jobs queued” — read `jobsQueued` and `mission.status`.
Default start on a verified repo is **Gitleaks-class secrets** (`jobsQueued=1`).
Nuclei is a **second mission** (External PoA). Do not put it in the primary
`moduleIds`. Changelog: [`docs/CHANGELOG-API.md`](docs/CHANGELOG-API.md).

Community-as-code intent: [`.periscan.example.yaml`](.periscan.example.yaml)
([docs/PERISCAN_YAML.md](docs/PERISCAN_YAML.md)). The control plane does **not**
load that file.

## Fixture workspace (labeled, not proof)

```bash
pnpm seed:demo
pnpm dev:worker
```

Login `demo@periscan.local` / `periscan-demo-password` is a **fixture** tenant.
Sample report at `/demo` is labeled sample. Neither is a measured lab result.

## Lab hops (not the Community pack)

```bash
pnpm lab:up && pnpm lab:smoke
pnpm lab:dev
PERISCAN_LAB_STRICT=1 pnpm lab:demo-up
```

That seed measures `*.lab.range.test` hops. It is not Community OSS start.
[`docs/DEMO_LAB_SITE.md`](docs/DEMO_LAB_SITE.md),
[`infra/lab/README.md`](infra/lab/README.md).

## Workspace

```text
apps/{api,web,worker,runner}   packages/{shared,db,policy,evidence,connectors,modules,reports}
infra/docker-compose/          local Postgres / Redis / MinIO (project name: periscan-deps)
```

Map: [`ARCHITECTURE.md`](ARCHITECTURE.md).

Integration marketplace (`/integrations`): 267-entry connector catalog: 126 dedicated live integrations and 141 planned, non-connectable catalog entries. Planned entries stay NotConnectable. Directory: [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Verify

```bash
pnpm verify
```

Useful PR subset: `pnpm lint && pnpm typecheck && pnpm test && pnpm licenses:check`.

GitHub Actions runs `pnpm verify` on `main`, tags `v*`, and pull requests
(Postgres, Redis, MinIO). Optional secret scan: `pnpm secrets:scan`.

## Operator / PRD audit index

Long-form product reference: [docs/PERISCAN_FULL_PRODUCT_PRD.md](docs/PERISCAN_FULL_PRODUCT_PRD.md) (internal vision — not shipped claims).
Execution status: [docs/PRODUCT_COMPLETION_PLAN.md](docs/PRODUCT_COMPLETION_PLAN.md).
Traceability: [docs/TRACEABILITY_MATRIX.md](docs/TRACEABILITY_MATRIX.md), [docs/USER_STORIES.md](docs/USER_STORIES.md), [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).
Source-first PRD audit: [docs/PRD_AUDIT_PROTOCOL.md](docs/PRD_AUDIT_PROTOCOL.md), the PRD source coverage ledger [docs/PRD_SOURCE_COVERAGE_LEDGER.md](docs/PRD_SOURCE_COVERAGE_LEDGER.md), and the atomic requirement ledger [docs/PRD_REQUIREMENT_LEDGER.md](docs/PRD_REQUIREMENT_LEDGER.md).
The current full-PRD implementation completion report lives in [docs/COMPLETION_REPORT.md](docs/COMPLETION_REPORT.md). Use `pnpm prd:audit` for the current source-led audit status and `pnpm prd:audit:strict` before making or refreshing any final full-product completion claim.
