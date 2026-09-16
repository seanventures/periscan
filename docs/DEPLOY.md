# Periscan Deployment Guide

How to deploy Periscan as a SaaS control plane plus one or more in-network
runners. This is the production-shape companion to the local dev setup; it
ties together the images, the database, and the validation-governance posture.

Read alongside:

- `docs/SUPPORTED_CUSTOMER_RUNNER.md` — Go LTS vs Agent (in-network) packaging.
- `docs/RUNNER_SPEC.md` / `RUNNER_ARCHITECTURE.md` — outbound signed-task runner.
- `docs/PRD_SELF_CONTAINED_RUNNER.md` — architecture (SaaS + thin in-network
  runner, hybrid execution topology).
- `docs/OFFENSIVE_KIT_LIVE_SMOKE.md` — controlled lab procedure for gated tool
  smoke tests; not a production enablement document.
- `docs/EXPORT_CONTROL_AND_AUTHORIZED_USE.md` — legal/authorized-use posture.
- `licenses/THIRD_PARTY_NOTICES.md` — bundled-tool license obligations.

## 1. Topology

**Control plane (SaaS cloud) — you operate this:**

- `apps/api` (Fastify) — `apps/api/Dockerfile`. Orchestration, governance
  (scope verification, policy decisions, approvals, audit), runner enrollment,
  task signing.
- `apps/worker` — built from `infra/docker/scan-executor.Dockerfile` (the worker
  - the server-side OSS toolkit for control-plane-approved jobs).
- `apps/web` (Next.js) — operator UI.
- Stateful backing services: PostgreSQL, Redis, S3-compatible object storage
  (evidence). Local dev uses `infra/docker-compose/docker-compose.yml`
  (postgres/redis/minio).

**In-network runner (customer network) — deployed per network segment:**

- **Supported Customer Runner (Go LTS, primary):** `apps/runner` — built from
  `apps/runner/Dockerfile`, image `ghcr.io/seanheiney/periscan-runner`. Production
  private-network package: register, mTLS, signed poll, passive internal modules.
  Deploy guide: `apps/runner/deploy/`. Publish workflow: `runner-publish.yml`.
- **Agent (in-network) — optional lab / AgentLocal companion:** `apps/runner-agent`
  — built from `apps/runner-agent/Dockerfile`, image
  `ghcr.io/seanheiney/periscan-runner-agent`. Same outbound signed-task contract
  for measured/`periscan.*` and safe recon modules. **Not** a second enterprise
  LTS SKU. Deploy guide: `apps/runner-agent/deploy/`.

Both dial **out** to the control plane, long-poll for signed tasks, verify task
signatures, enforce local scope, and return evidence. No inbound ports, no local
UI, no reverse SSH, and no arbitrary tunnel.

## 2. Build the images

```bash
# Control-plane API
docker build -f apps/api/Dockerfile -t periscan-api .

# Worker + server-side toolkit (default `runtime` stage — no GPL redistribution)
docker build -f infra/docker/scan-executor.Dockerfile -t periscan-scan-executor .

# Supported Customer Runner (Go LTS — primary customer package)
docker build -f apps/runner/Dockerfile -t periscan-runner apps/runner

# Agent (in-network) — optional AgentLocal companion
docker build -f apps/runner-agent/Dockerfile -t periscan-runner-agent .

# Operator web UI (Next.js production build)
docker build -f apps/web/Dockerfile -t periscan-web .
```

In CI these are built, smoke-tested in-image, and (on a `v*` tag) pushed to GHCR
by `.github/workflows/images-build.yml` (API, web, scan-executor, runner-agent)
and `.github/workflows/runner-publish.yml` (Supported Customer Runner /
`periscan-runner`). Validate a freshly built image with its in-image smoke before
deploying:

```bash
docker run --rm periscan-scan-executor bash infra/docker/scan-executor-smoke.sh
docker run --rm periscan-runner-agent  bash apps/runner-agent/runner-agent-smoke.sh
pnpm test:runner   # Go Supported Customer Runner unit + image checks when Docker is available
```

### Legal-review tools (Engine Lab opt-in)

The default scan-executor image ships **only permissive-license** engines
(Gitleaks, Nuclei, Trivy, OSV Scanner, Prowler, Promptfoo, PyRIT, ffuf). It does
**not** redistribute GPL-family tools marked `RequiresLegalReview`:

| Tool | License | Default image | Live product posture |
|------|---------|---------------|----------------------|
| testssl.sh | GPL-2.0 | Absent | Blocked / fixture-import only |
| sqlmap | GPL-2.0 | Absent | Blocked / dry-run only |
| nikto | GPL-2.0 | Absent | Blocked / fixture-import only |
| whatweb | GPL-3.0 | Absent | Blocked / fixture-import only |
| ScoutSuite | GPL-2.0 | Absent | Blocked / fixture-import only |

**Why:** Engine Lab strategy is customer-side (or lab-side) accept → install →
verify, not silent redistribution in SaaS `latest`/`v*` images. See
`docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md` and
`docs/OPEN_SOURCE_LICENSE_POLICY.md`.

**Lab-only rebuild that intentionally conveys those tools** (not for production
SaaS tags; honor GPL written-offer / source obligations if you distribute the
image):

```bash
# Explicit Dockerfile stage
docker build --target runtime-legal-review \
  -f infra/docker/scan-executor.Dockerfile \
  -t periscan-scan-executor:legal-review .

docker run --rm periscan-scan-executor:legal-review \
  bash infra/docker/scan-executor-smoke.sh

# Or compose profile (alongside datastores)
docker compose \
  -f infra/docker-compose/docker-compose.yml \
  -f infra/docker-compose/docker-compose.scan-executor.yml \
  --profile legal-review-tools up -d --build
```

**Future Engine Lab path (preferred for tenants):** do not bake GPL binaries into
the shared SaaS image. Operators accept upstream license terms, install from
allowlisted coordinates via third-party tool governance / Engine Lab install APIs,
verify digests, then enable under policy. Until that product surface ships, keep
legal-review modules fixture/import-only and use `runtime-legal-review` only in
isolated lab environments with documented authorization.

## 3. Database

Apply migrations with the deploy-safe command (never `migrate dev` in
production):

```bash
PERISCAN_POSTGRES_PUBLISHED_PORT=5432 \
DATABASE_URL=postgresql://USER:PASS@HOST:5432/periscan \
pnpm --filter @periscan/db db:migrate:deploy
```

`db:generate` runs during image build. Confirm schema state with
`pnpm --filter @periscan/db db:status`.

## 4. Control-plane configuration

Provide (via your secret manager / orchestrator, never committed):

- `DATABASE_URL`, Redis URL, object-storage credentials.
- Auth/session signing secrets.
- The runner **task-signing keypair** (the control plane signs every task
  envelope; runners verify with the public half).
- Model-gateway provider credentials (for autonomous engagements).

The worker (scan-executor image) needs only outbound access to Redis and to the
targets/cloud APIs it scans. It exposes no inbound port.

## 5. Deploy a runner (per network)

### 5a. Supported Customer Runner (Go LTS — preferred)

1. **Enroll** from the control plane (`/runners` UI pairing or registration-token
   API). Primary install snippets use
   `ghcr.io/seanheiney/periscan-runner` with `PERISCAN_REGISTRATION_TOKEN` +
   `register` (see `apps/runner/README.md` and `apps/runner/deploy/`).
2. **Run** the issued credentials inside the target network (compose / k8s /
   systemd examples under `apps/runner/deploy/`).
3. **Verify** the runner shows as polling in `/runners`, then dispatch a passive
   signed check (`runner.reachability_check` or peer modules in `docs/RUNNER_SPEC.md`).
4. **Outbound-only:** DNS + HTTPS egress to the control plane; **no inbound** to
   the runner.

### 5b. Agent (in-network) — optional lab / AgentLocal

Use only when the site needs AgentLocal measured or safe recon modules.

1. Prefer enrollment via the Supported Customer Runner path (or equivalent issued
   runner id + auth token + mTLS + task-signing public key).
2. **Run** `ghcr.io/seanheiney/periscan-runner-agent` with those issued credentials
   (`apps/runner-agent/deploy/`). Do not treat this image as the production LTS
   package.
3. Keep the local module allowlist and safety levels narrow. Advanced adversarial,
   credential, exploitation, and collector modules remain disabled unless a later
   approved PRD/legal/security gate explicitly enables them.
4. **Verify** polling in `/runners` and Stage A–B of
   `docs/OFFENSIVE_KIT_LIVE_SMOKE.md` when exercising the agent image.

## 6. Governance posture (must hold in production)

- Validation modules run only against a `Verified` scope, with policy decisions,
  operator approval where required, and auditable denials before any dispatch.
- Live adversarial, credential, exploitation, SharpHound collection, and Caldera
  execution are not production-enabled by this guide.
- The runner enforces a default-deny per-task egress allowlist and the kill
  switch; it never decides authorization.
- CI never runs live offensive tools. Any controlled lab smoke must follow
  `docs/OFFENSIVE_KIT_LIVE_SMOKE.md`, verified scope, and written authorization.
- Honor the GPL/NPSL and export-control obligations
  (`docs/EXPORT_CONTROL_AND_AUTHORIZED_USE.md`) before redistributing images.
  The default scan-executor image does not convey legal-review GPL tools; if you
  build `runtime-legal-review` or redistribute runner-agent nmap (NPSL), complete
  written-offer / source obligations for those tools.

## 7. Customer Environment Prerequisites

These are not repo implementation gaps. They must be satisfied by the customer
or deployment operator before production validation:

- Customer-issued runner credentials and task-signing material.
- Outbound HTTPS egress from each runner segment to the Periscan control plane.
- Verified internal scopes and approved validation windows.
- Customer-provided integration credentials for live connector use.
- Legal/security approval before any future high-impact or advanced-adversarial
  capability is enabled. Do not treat Caldera live execution, SharpHound
  collection, credential-spray, exploitation, or arbitrary tunneling as enabled
  by this deployment guide.

The `apps/web` production image (`apps/web/Dockerfile`) and engagement
persistence (`POST` persists; `GET /api/v1/engagements` + `GET
/api/v1/engagements/:id`) are now shipped.
