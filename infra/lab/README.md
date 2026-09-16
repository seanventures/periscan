# Periscan continuous-loop lab (Phase 1–2 / demo site)

Multi-tier local range for **measured multi-hop**, dual runners, and **mock SIEM** canaries (including product Splunk observe). Built to back a **full demo site** (Wave spine on live lab data).

| Doc | Role |
|-----|------|
| [`docs/DEMO_LAB_SITE.md`](../../docs/DEMO_LAB_SITE.md) | **Demo site operator guide** |
| [`docs/LAB_DESIGN_CONTINUOUS_LOOP.md`](../../docs/LAB_DESIGN_CONTINUOUS_LOOP.md) | Full design |
| [`docs/MEASURED_TEST_RANGE.md`](../../docs/MEASURED_TEST_RANGE.md) | Original single-host posture range (`infra/test-range`) |
| [`demo/DEMO_SCRIPT.md`](../../demo/DEMO_SCRIPT.md) | Wave spine narrative |

**Safety:** passive probes + allowlisted canaries only. No Atomic/Caldera/SharpHound live inject.

---

## Demo site (full)

```sh
# Pane 1 — lab range
pnpm lab:up

# Pane 2 — control plane
pnpm lab:dev          # api + worker + web, PERISCAN_LAB_MODE=1

# Pane 3 — seed + measure + runners + spine check
pnpm lab:demo-up
# optional: PERISCAN_LAB_RUN_FIXED=1 pnpm lab:demo-up
pnpm lab:walk-spine   # 17 Wave API surfaces

# When done (stops compose + :3000/:3001)
pnpm lab:stop
```

Writes `infra/lab/.lab-demo.env` (session + tenant email) and lab-run artifacts under `docs/qa/lab-runs/`.  
Sign in at http://127.0.0.1:3000/login with that email / `periscan-lab-password-ok`.

---

## What stands up

| Service | Host port | Role |
|---------|-----------|------|
| **edge** nginx | 8081 / **8443** | Hop 0 — external entry |
| **app** nginx | 8082 / **8444** | Hop 1 — application |
| **data** nginx | **8083** | Hop 2 — data tier (plant-only network) |
| **CoreDNS** | **5355** | `lab.range.test` zone |
| **mocksiem** | **9200** | Lab ingest/search + **Splunk export** |
| **runner-plant** (profile) | — | site=plant, networks edge+app+data |
| **runner-hq** (profile) | — | site=hq, **no** data network |

`LAB_PROFILE=exposed` (default) vs `hardened` flips weak→strong posture (closed-loop Fixed story).

---

## Quickstart

```sh
cd infra/lab
chmod +x scripts/*.sh gen-certs.sh

# 1. Start lab (exposed)
./scripts/up.sh

# 2. Map hostnames (sudo once)
echo "127.0.0.1 edge.lab.range.test app.lab.range.test data.lab.range.test siem.lab.range.test marker.lab.range.test" \
  | sudo tee -a /etc/hosts

# 3. Physical smoke (no control plane)
./scripts/smoke.sh

# 4. Phase 2 canary (native search + Splunk export)
./scripts/canary-loop.sh

# 5. Golden artifact (smoke + canary)
./scripts/golden-path.sh
```

### Product wire-up (API + mocksiem)

```sh
# API (Postgres on published 5434 if host 5432 is taken)
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_DEV_MODE=true PERISCAN_JWT_SECRET=periscan-dev-session-secret
export REDIS_URL=redis://127.0.0.1:6379
export PERISCAN_LAB_MODE=1   # maps edge/app/data.lab.range.test → :8081/:8082/:8083
pnpm --filter @periscan/api dev
# Worker required for hop FullyMeasured (auto-applies hop receipts):
pnpm --filter @periscan/worker dev
# If hop jobs stuck on "missing mission context", drain stale BullMQ keys:
# PERISCAN_LAB_DRAIN_QUEUE=1 ./scripts/drain-validation-queue.sh

# After signup/login, export both session cookie AND CSRF (mutating APIs):
export PERISCAN_API_URL=http://127.0.0.1:3001
export PERISCAN_API_TOKEN='periscan_session=...'
export PERISCAN_CSRF_TOKEN='...'   # value of periscan_csrf cookie

# Seed: scopes, Splunk→mocksiem, control source, runner tokens, multi-hop path material
./scripts/seed-tenant.sh
# writes .lab-state.json + .lab-runner.env (gitignored)
# local lab auto-bumps billing_package_key→ControlValidation when docker postgres is available

./scripts/canary-loop.sh      # physical + product DRV/DNS (injectMockObservation=false)
./scripts/posture-lab.sh      # LiveSafe posture on edge/app/data
./scripts/measure-hops.sh     # launch safe hop probes; FullyMeasured needs worker/receipts
./scripts/golden-path.sh

# Runners (affinity)
set -a; source .lab-runner.env; set +a
docker compose --profile runners up -d
./scripts/affinity-fire.sh
```

### Harden (remediation flip)

```sh
LAB_PROFILE=hardened docker compose build --build-arg LAB_PROFILE=hardened coredns edge app data
LAB_PROFILE=hardened docker compose up -d
./scripts/smoke.sh   # data /api/records should 401 without Authorization
```

---

## Multi-hop product path

1. Create verified scopes: `edge|app|data.lab.range.test` (`seed-tenant.sh`).  
2. Correlate or seed path: **edge → app → data**.  
3. With **plant** runner healthy, **Measure hop (safe)** on each edge.  
4. Assert `GET …/attack-paths/:id/measurement-state` → `fullyMeasured: true` only with receipts + evidence IDs.  
5. Flip hardened → re-validate → Fixed only via measured verification.

Acceptance with mocks already covers API law; this lab makes hops **physical**.

---

## Canary / mock SIEM (Phase 2)

**Lab native**

```sh
curl -sS -X POST http://127.0.0.1:9200/v1/events \
  -H 'content-type: application/json' \
  -d '{"marker":"periscan-lab-canary","host":"marker.lab.range.test"}'

curl -sS 'http://127.0.0.1:9200/v1/events?marker=periscan-lab-canary'
```

**Splunk-compatible export** (product `splunk` connector `observeControl`)

```sh
curl -sS -X POST http://127.0.0.1:9200/services/search/jobs/export \
  -H 'content-type: application/x-www-form-urlencoded' \
  -H 'authorization: Bearer lab-token' \
  --data-urlencode 'search=search index=* ("periscan-lab-canary") | head 1' \
  --data-urlencode 'output_mode=json'
```

Seed creates a **live** Splunk integration (`mockMode: false`, `baseUrl: http://127.0.0.1:9200`).  
Canary product path uses `injectMockObservation: false` so observe hits real HTTP.

Honesty: `realDataExfiltrated: false`; full BAS inject remains off.

Optional acceptance (skip-if-down unless flagged):

```sh
PERISCAN_LAB_E2E=1 pnpm exec vitest run tests/acceptance/lab-mocksiem-canary-e2e.test.ts
```

---

## Scripts

| Script | Role |
|--------|------|
| `up.sh` / `down.sh` | Compose lifecycle |
| `smoke.sh` | Physical health (edge/app/data/siem/dns) |
| `canary-loop.sh` | Emit→search + Splunk export; optional product proofs |
| `seed-tenant.sh` | Scopes, SIEM, control source, runner tokens, multi-hop path seed |
| `lab-session.sh` | Signup + export session/CSRF (`eval "$(./scripts/lab-session.sh)"`) |
| `posture-lab.sh` | LiveSafe posture-check on lab Domain scopes |
| `measure-hops.sh` | Launch safe hop validation; poll fullyMeasured |
| `drain-validation-queue.sh` | Wipe stale `bull:validation-missions*` (explicit consent) |
| `golden-path.sh` | Smoke + canary + posture + measure + asserts |
| `affinity-fire.sh` | Dual-runner affinity checklist |
| `enroll-runners.sh` | Register plant/hq and start Go `apps/runner` compose. Community InternalRunner OSS (nmap, syft) still needs runner-agent — that image does not execute them. |
| `lab-auth.sh` | Cookie CSRF double-submit helper (sourced by scripts) |

### FullyMeasured lab gate (proven 2026-08-02)

With `PERISCAN_LAB_MODE=1`, drained queue, and worker: hop probes hit lab HTTP ports, outcomes like `http_insecure_transport` / `Validated` auto-apply receipts → **`fullyMeasured:true`**. Claim-safe path state stays **Discovered** unless path certainty supports higher labels — no invented Validated.

---

## Platform notes

| Issue | Mitigation |
|-------|------------|
| macOS Docker **UDP** publish flaky for CoreDNS | Run DNS checks on Linux CI, or run API in-compose on `lab_core` |
| Port 80/443 busy | Lab uses **8081/8443**, **8082/8444**, **8083** |
| Runner image pull | Set `PERISCAN_RUNNER_IMAGE` to a local build if GHCR unavailable |
| Colima / remote Docker + `/Volumes/...` bind mounts empty | Nginx/CoreDNS configs **baked into images** via `LAB_PROFILE` |
| Phase 1 mocksiem without Splunk export | `docker compose build mocksiem && docker compose up -d mocksiem` |

---

## Phase status

| Phase | Status |
|-------|--------|
| **1** Multi-tier + mock SIEM + scripts + optional runners | Done |
| **2** Product canary E2E wired to mocksiem (export + seed + canary-loop) | Done |
| **3** LocalStack/kind optional | Scaffold (`docker-compose.cloud.yml`, `kind/`, `PHASE3_CLOUD.md`) |
| **4** Design-partner dogfood cadence | Process doc + first log (`docs/DESIGN_PARTNER/LAB_DOGFOOD.md`) |
| Hybrid plant signed complete | `pnpm lab:hybrid-plant` → mission **Completed** (Partial honesty); needs result-signing enroll/`lab:patch-signing` + runner image with `periscan.*` aliases |

CI: `.github/workflows/lab-golden.yml` (workflow_dispatch / weekly) — physical only.

---

## Teardown

```sh
./scripts/down.sh
# remove hosts line if added
```
