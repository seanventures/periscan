# Local / self-host setup (Community)

Enterprise-class setup for a **clone** of [`seanventures/periscan`](https://github.com/seanventures/periscan).
The GitHub fold stays in [`README.md`](../README.md). The operator loop is
[`USING.md`](../USING.md) and [`docs/USING.md`](./USING.md).

This is the Apache-2.0 **validation slice**: authorized local clone, policy,
**Gitleaks-class secrets** (`jobsQueued=1`), evidence. **Fixed** only after a
retest. Full BAS/AEV development follows [the program](BAS_AEV_PROGRAM.md);
current adapter coverage and runtime readiness are documented per engine.

---

## Prerequisites

| Need             | Notes                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node 24**      | [`.nvmrc`](../.nvmrc). `nvm install 24 && nvm use`                                                                                                      |
| **pnpm 9.15.0**  | Corepack: `corepack enable && corepack prepare pnpm@9.15.0 --activate`                                                                                  |
| **Docker**       | Engine + **Compose plugin** (`docker compose version`)                                                                                                  |
| Gitleaks runtime | A host `gitleaks` binary is optional. With Docker available, the pinned image runs on first scan. If neither runtime works, the result is Inconclusive. |

Do **not** run `docker compose` at the repo root.

---

## Compose honesty

Local Postgres, Redis, and MinIO live in
[`infra/docker-compose/docker-compose.yml`](../infra/docker-compose/docker-compose.yml)
(default project name **`periscan-deps`**). The install script selects a
checkout-specific project if another checkout already owns that name, and
stores the choice in `.periscan/community.env`. That is the only Community
deps file.

Root `compose.yaml`, if present, is **not** Community deps. A public clone may
not have that file. Always pass `-f infra/docker-compose/docker-compose.yml`
for local dependencies instead of running a bare `docker compose up` at the
repo root.

Bare bring-up (host toolchain; scripts below do this for you):

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d --wait
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export REDIS_URL=redis://127.0.0.1:6379
```

Do not `docker compose down -v` unless you intend to wipe **this clone's**
volumes. Neighbor Redis / Postgres on the host are never this clone.

---

## Two CLIs (do not mix the contracts)

Need **Node 24** and **Docker**. Clone this repo, inspect it, then install.

### Preferred: already cloned — `scripts/periscan.sh`

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

| Command                            | What it does                                                                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bash scripts/periscan.sh install` | Node / pnpm / Docker checks, compose `periscan-deps`, Prisma migrate. **Does not** start the control plane. Not `seed:demo`. Not `lab:up`. Not `pnpm verify`. |
| `bash scripts/periscan.sh start`   | `pnpm lab:dev` (API + **worker** + web). Prints URLs. Auto-shifts off `:3000` / `:3001` when busy.                                                            |
| `bash scripts/periscan.sh status`  | `GET /api/v1/health` on the chosen API port. Down is honest, not a fake pass.                                                                                 |
| `bash scripts/periscan.sh update`  | `git pull` (if on a branch) + `pnpm install` + migrate. Does **not** restart. You run `start` again.                                                          |
| `bash scripts/periscan.sh down`    | Stop tracked `lab:dev` children; `compose stop` only this checkout's deps. Volumes stay.                                                                      |

`install` does **not** start the apps. `start` does. `pnpm dev` is api+web
only and **cannot** finish Community runs.

### Secondary: one-paste — `install.sh`

Inspect `install.sh` first. Safer: download, then `bash install.sh`.

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
```

| Command                     | What it does                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `bash install.sh` (default) | Toolchain, clone to `$PERISCAN_HOME` (default `~/periscan`) if needed, `periscan.sh install` + **start** + health |
| `bash install.sh doctor`    | health + repair (compose, migrate, restart if API down, clone-owned queue drain)                                  |
| `bash install.sh health`    | check only (no compose / start)                                                                                   |
| `bash install.sh --dry-run` | print the plan                                                                                                    |
| `bash install.sh repair`    | alias for `doctor`                                                                                                |

`scripts/install.sh` is a thin wrapper to the same root file. Pipe help:
`bash -s -- --help`.

---

## Ports, `DATABASE_URL`, Redis

`lab:dev` / `periscan.sh start` auto-shift web off `3000` and API off `3001`
when those binds are taken. Chosen values are printed and stored in
`.periscan/community.env`.

| Service  | Compose / `.env.example` default                         | First-hour scripts                  | Override                                                  |
| -------- | -------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Web      | `http://127.0.0.1:3000`                                  | next free (`3010+` if `:3000` busy) | `PERISCAN_WEB_PORT`                                       |
| API      | `http://127.0.0.1:3001`                                  | next free                           | `PERISCAN_API_PORT` / `PERISCAN_API_URL`                  |
| Postgres | host **5432** (`PERISCAN_POSTGRES_PUBLISHED_PORT:-5432`) | prefer **5434**, then next free     | `PERISCAN_POSTGRES_PUBLISHED_PORT` **and** `DATABASE_URL` |
| Redis    | host **6379**                                            | same, then next free                | `PERISCAN_REDIS_PUBLISHED_PORT` **and** `REDIS_URL`       |
| MinIO    | host **9000**                                            | same, then next free                | `PERISCAN_MINIO_PUBLISHED_PORT`                           |

Two Postgres numbers on purpose:

1. The compose file default is **5432** so a manual
   `docker compose -f infra/docker-compose/docker-compose.yml up` matches
   [`.env.example`](../.env.example).
2. `scripts/community-first-hour.sh` / `scripts/periscan.sh install` call
   `lab_select_deps_publish_ports`, which prefers **5434** so a neighbor
   `:5432` is not treated as this clone.

Prisma migrate needs `DATABASE_URL` exported. A compose published-port
override does **not** rewrite it by itself. The install scripts do rewrite
`DATABASE_URL` / `REDIS_URL` to the ports they selected. If you compose by
hand, export both:

```text
postgresql://periscan:periscan@127.0.0.1:${PERISCAN_POSTGRES_PUBLISHED_PORT}/periscan
redis://127.0.0.1:${PERISCAN_REDIS_PUBLISHED_PORT:-6379}
```

Inside the compose network the hostname is always `postgres` on **5432**.
Do not kill neighbor apps. Do not wipe a neighbor Redis.

Full env catalog: [`.env.example`](../.env.example).
`PERISCAN_DEV_MODE=true` is local-only; production forbids it.

---

## Health / doctor

Confirm the plane you actually started:

```bash
API="${PERISCAN_API_URL:-http://127.0.0.1:3001}"
curl -fsS "$API/api/v1/health"
curl -fsS "$API/api/v1/health/ready"
bash scripts/periscan.sh status
bash install.sh health    # check only
bash install.sh doctor    # health + repair
```

`GET /health` 307s to `/api/v1/health`. OpenAPI: `GET /openapi.json`.
`status` / `health` failing is a real down — not a green theater check.

---

## Community start (after the plane is up)

1. Open the printed web URL. **Sign up** (password ≥ 12). Do **not** use
   `demo@periscan.local` — that tenant is a labeled fixture after
   `pnpm seed:demo`, not measured proof.
2. **Authorize a local clone path** — `git clone <your-repo>` on this
   machine, then paste the **absolute path**. A hosted `github.com/org/repo`
   URL is **not a control-plane path** (`hosted_github_url_not_verifiable`).
3. Prove the repo with `.periscan-authorization` (or Owner/Admin attestation
   when the path is runner-only). Unverified scopes are inventory, not
   runnable.
4. Run Community validation. Default start is **Gitleaks-class secrets**
   (`jobsQueued=1`). Not the full pack. HTTP 200 is not “jobs queued” — read
   `jobsQueued` and `mission.status`. Keep proving after that run.
5. Remediations stay **Open** until a retest produces a verification event.
   Creating a ticket is not Fixed.

A host `gitleaks` binary is optional; Docker can run the pinned image. If
neither runtime succeeds, the result is Inconclusive rather than a clean bill
of health.

Step-by-step loop (UI + curl): [`USING.md`](./USING.md).

---

## Identity / SSO (not Community start)

Local setup is email signup on a new tenant. SSO is **API-first** tenant
config after that tenant exists — `PUT /api/v1/tenants/current/sso` (OIDC or
SAML). Users must already be invited. JIT create-on-first-login and inbound
SCIM are **NotConfigured**.

This is not a local-setup wizard. Mapping: [`SSO_ROLE_CLAIM_MAPPING.md`](./SSO_ROLE_CLAIM_MAPPING.md).
Honest lifecycle: [`ENTERPRISE_IDENTITY_LIFECYCLE.md`](./ENTERPRISE_IDENTITY_LIFECYCLE.md).

---

## Optional: Docker overlay (api + web + worker)

Instead of host `lab:dev`:

```bash
bash scripts/community-up.sh
```

That is
`docker compose -f infra/docker-compose/docker-compose.yml -f infra/docker-compose/docker-compose.community.yml up -d --build --wait`.
First image build copies the monorepo. Do not copy this overlay into a
customer production deploy. Production topology: [`DEPLOY.md`](./DEPLOY.md).

---

## What this setup is not

| Temptation                                 | Honest answer                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docker compose` at repo root              | Wrong file. Use `-f infra/docker-compose/docker-compose.yml`.                                                                                          |
| Hosted `github.com/org/repo` as the target | Refused. Clone locally, paste the absolute path.                                                                                                       |
| Full pack / Nuclei on first start          | Default start is Gitleaks (`jobsQueued=1`). Nuclei is a second mission.                                                                                |
| Atomic / Caldera / Metasploit / SharpHound | BAS/AEV adapters are under development; live execution requires scenario qualification and bound authorization. See [the program](BAS_AEV_PROGRAM.md). |
| `pnpm seed:demo` / `/demo`                 | Labeled fixture / sample. Not measured proof.                                                                                                          |
| `pnpm lab:up`                              | Measured lab hops (`*.lab.range.test`). Not Community OSS start.                                                                                       |
| `pnpm verify` as Community start           | Release gate. Too heavy for install.                                                                                                                   |
| Invented security mailbox                  | Intake is title-only `[SECURITY]` issues — [`SECURITY.md`](../SECURITY.md).                                                                            |

Ledger: [`SETTLED.md`](./SETTLED.md).

---

## Troubleshooting

| Symptom                                    | Check                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `docker compose` errors at repo root       | You omitted `-f infra/docker-compose/docker-compose.yml`.                                              |
| Migrate / API cannot reach Postgres        | Published port ≠ `DATABASE_URL`. Print `.periscan/community.env` or `bash scripts/periscan.sh status`. |
| `:5432` / `:5434` / `:3000` / `:3001` busy | Scripts remap. Do not kill the neighbor. Export the printed ports.                                     |
| `Node 24 is required`                      | This shell is not 24. See `.nvmrc`.                                                                    |
| Community run stays empty                  | `pnpm dev` has no worker. Use `start` / `lab:dev`. Confirm `jobsQueued`.                               |
| Secrets run is Inconclusive                | `gitleaks` missing → `tool_unavailable`.                                                               |
| Hosted GitHub URL on Add / Verify          | Paste the absolute clone path instead.                                                                 |

Repair path: `bash install.sh doctor`. Check only: `bash install.sh health`.
