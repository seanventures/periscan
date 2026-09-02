# Periscan Agent Instructions

Read these before changing the repo.

## Plane is the mandatory system of record (goldeneye)

**Track all work as Plane issues** — tasks, bugs, features, waves, residuals, PRDs.
Git commits and markdown alone are **not** tracked work.

| Item | Value |
| --- | --- |
| Workspace | `goldeneye` |
| Project | **periscan** (`PERISCAN`) |
| Project ID | `c6549620-33ca-46d1-a8b3-d24dc09a033e` |
| UI | `https://plane.local.sean.network/goldeneye/projects/c6549620-33ca-46d1-a8b3-d24dc09a033e` |
| API base | `https://plane.local.sean.network/api/v1` |
| Auth | `X-API-Key: $PLANE_API_KEY` (tailnet-only) |

**Fetch key (do not ask human to paste Plane token):**

```bash
PLANE_API_KEY=$(curl -s -H "X-Ops-Token: $OPS_TOKEN" "$OPS_API/secret?key=PLANE_API_KEY" | jq -r .value)
PLANE_PROJECT_ID=$(curl -s -H "X-Ops-Token: $OPS_TOKEN" "$OPS_API/secret?key=PLANE_PROJECT_ID" | jq -r .value)
# or on goldeneye: cat /root/projects/infra/plane/.plane-api-token
# or: plane-issue periscan "title" "body"
```

**Every unit of work:**

1. Dedupe: list issues first  
2. Create issue if missing (`POST …/issues/`)  
3. Move state: Backlog → Todo → In Progress → **Done** when shipped (include commit SHA)  
4. Ops `/request`s auto-file — do not duplicate  

Skill: `skills/using-plane/SKILL.md` · Platform docs: `docs/ops/PLANE.md`

## Setup

- Install dependencies: `pnpm install`
- Start local dependencies: `docker compose -f infra/docker-compose/docker-compose.yml up -d`
  - Postgres published port is configurable to dodge conflicts with another local postgres process: `export PERISCAN_POSTGRES_PUBLISHED_PORT=5434` before the compose up. (Default 5432 for compat; internal hostname in compose is always 'postgres'.)
- Run the app: `pnpm dev`
- Run all validation: `pnpm verify`
  - If acc/verify hit DB auth early: see .env.example for exact multi-step: export PERISCAN_POSTGRES_PUBLISHED_PORT=5434 ; compose up -d ; export DATABASE_URL=...5434... (or PERISCAN_TEST_DATABASE_URL) ; pnpm test:acceptance . The acc tests now have early actionable probe (instead of deep 500 "Internal server error").
- Run focused checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`

## Architecture

- API routes live in `apps/api/src/app.ts`.
- API business logic lives in `apps/api/src/runtime-services.ts`.
- Shared Zod schemas and public types live in `packages/shared/src`.
- Prisma schema, migrations, and seeds live in `packages/db`.
- Connector manifests and interfaces live in `packages/connectors`.
- Validation modules and OSS toolchain metadata live in `packages/modules`.
- Evidence storage, graph, risk, and remediation helpers live in `packages/evidence`.
- Report generation lives in `packages/reports`.
- Web UI routes live in `apps/web/app`; reusable components live in `apps/web/src/components`.
- Runner code lives in `apps/runner`.

## Conventions

- Preserve the current monorepo, Fastify API, Next.js web app, Prisma data layer, and `pnpm` workspace.
- Add shared contracts in `packages/shared` before duplicating DTOs in apps.
- Keep product behavior API-first. UI components consume real API data.
- Add tests for schema, service, route, module, policy, and evidence behavior touched by a change.
- Keep raw scanner output out of primary UX and reports.

## Do Not Touch Without Approval

- Do not replace the auth/session model.
- Do not rewrite the Prisma schema or migrations wholesale.
- Do not change runner transport away from outbound HTTPS signed-task polling.
- Do not enable SharpHound, Caldera live execution, Atomic live execution, or other legally/safety-sensitive capabilities.
- Do not make planned integrations connectable without real connector implementation and tests.

## Safety Rules

- Only validate verified customer-authorized scope.
- No destructive actions.
- No real data exfiltration.
- No persistence, credential theft, evasion logic, or uncontrolled exploit chaining.
- Every validation run needs a policy decision and audit event.
- Denied tasks must never be queued.
- A risk cannot be marked fixed without a verification event.

## Real-First Rule

Product-visible data must come from real persistence, real integrations, real local lab systems, real validation modules, real evidence storage, or honest empty/not-configured states. Fixtures are allowed in tests. Sample reports are allowed only when clearly isolated and labeled as sample/demo content.

## Ontology Five Laws & claim deny-list

- Five Laws (schema/API gates): `docs/ONTOLOGY_LAWS.md` and `packages/shared/src/claim-deny-list.ts` (`ONTOLOGY_LAWS`).
- Customer-facing prove / integrate / refuse language: `CLAIM_LANGUAGE_CATALOG` in the same module. Do not invent full-BAS, live ransomware, or certification claims in UI, reports, or GTM.
- Path certainty and Fixed-only-via-verification: `packages/shared/src/claim-language.ts`, `packages/shared/src/fix-verification.ts`.

Settled decisions (do not re-derive): `docs/SETTLED.md`.
GA program (open-core shippable, not 95/MQ): `docs/qa/GA_PROGRAM_2026-08-14.md`, Plane PERISCAN-490.

Reference docs:

- `PRD.md`
- `docs/PERISCAN_FULL_PRODUCT_PRD.md`
- `docs/CODEBASE_ASSESSMENT.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TRACEABILITY_MATRIX.md`
- `SECURITY_BOUNDARIES.md`
- `docs/ONTOLOGY_LAWS.md` (Five Laws + composition gates for schema/API PRs)

## DataSSD1 staging (agent write path)

If `.git` or volume TCC blocks tools, edit under `~/periscan-staging` then:

```bash
bash ~/periscan-staging/scripts/sync-staging-to-datassd1.sh
# or from checkout: pnpm lab:sync
```

Refresh staging from volume: `bash ~/periscan-staging/scripts/pull-from-datassd1.sh`  
Details: `docs/STAGING_WORKFLOW.md`, `~/periscan-staging/STAGING_README.md`.
