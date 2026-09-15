# Periscan Lab Demo Site

**Purpose:** Spin up a **functional, measured** local demo environment on the continuous-loop lab (`infra/lab`) for Wave / board / design-partner walks — not fixture theater alone.

**Honesty floors (non-negotiable):**

- Product-visible data from real lab probes, real SIEM observe against mocksiem, real hop receipts, or honest empty states  
- **No** inventing FullyMeasured, Fixed, Production connectors, customer refs, or analyst scores  
- Fixed only after re-measure (posture LiveSafe after harden)  
- Sample report at `/demo` remains labeled sample when used  

Companion: [`demo/DEMO_SCRIPT.md`](../demo/DEMO_SCRIPT.md) (Wave spine), [`infra/lab/README.md`](../infra/lab/README.md), [`LAB_DESIGN_CONTINUOUS_LOOP.md`](LAB_DESIGN_CONTINUOUS_LOOP.md).

---

## Architecture (demo site)

```
Browser :3000  ──►  API :3001  ──►  Postgres / Redis
                      │
                      ├── worker (validation-missions queue)
                      │
                      ├── lab mocksiem :9200  (Splunk-export canaries)
                      ├── edge :8081 / app :8082 / data :8083
                      └── runners plant (edge+app+data) + hq (no data)
```

`PERISCAN_LAB_MODE=1` maps `*.lab.range.test` hop probes to published host ports so FullyMeasured works without `/etc/hosts` DNS.

---

## One-shot operator path

### Terminal A — dependencies + lab range

```bash
# Postgres/redis (if not already)
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d

pnpm lab:up && pnpm lab:smoke
```

### Terminal B — control plane (API + worker + web)

```bash
# Single process group (or open 3 panes yourself):
pnpm lab:dev
```

`lab:dev` sets `PERISCAN_LAB_MODE=1`, `DATABASE_URL` (prefers :5434), and starts **api + worker + web**.

### Terminal C — demo seed + measure + runners + spine check

```bash
# optional: clear polluted BullMQ jobs from prior local work
pnpm lab:drain-queue

pnpm lab:demo-up
# or with closed-loop Fixed flip:
PERISCAN_LAB_RUN_FIXED=1 pnpm lab:demo-up

# re-verify Wave API surfaces after login:
set -a; source infra/lab/.lab-demo.env; set +a
pnpm lab:walk-spine
```

Outputs:

| File | Content |
|------|---------|
| `infra/lab/.lab-demo.env` | Session, CSRF, tenant email, pathId (gitignored) |
| `infra/lab/.lab-state.json` | Scopes, SIEM control source, pathId, runners |
| `infra/lab/.lab-runner.env` | Plant/hq auth tokens after enroll |
| `docs/qa/lab-runs/*-demo-up-summary.json` | fullyMeasured + spine |

Sign in (lab demo tenant, **not** fixture `demo@periscan.local` unless you also ran `pnpm seed:demo`):

- Email: printed by demo-up / `.lab-demo.env` (`PERISCAN_LAB_EMAIL`)  
- Password: `periscan-lab-password-ok`

---

## Wave spine on lab data

| Step | Route | Lab-backed proof |
|------|-------|------------------|
| 1 Needs you | `/dashboard` | Real tenant activation from seed |
| 2 Connect honesty | `/integrations` | Live Splunk → mocksiem + mock GH/AWS |
| 3 Scope | `/scopes` | edge/app/data.lab.range.test **Verified** |
| 4 Validate | `/missions` | ControlValidation canaries + hop missions |
| 5 Path measured | `/attack-paths` | `fullyMeasured` when worker completed hops |
| 6 Findings | `/findings` | LiveSafe posture exposures |
| 7 Remediation | `/remediation` | Harden flip + re-measure → Fixed path |
| 8 Evidence | `/evidence` / `/reports` | Receipt evidence IDs |

**Do not** open Labs zoo routes unless asked (see DEMO_SCRIPT).

---

## Scripts map

| Command | Script |
|---------|--------|
| `pnpm lab:up` | Physical lab compose |
| `pnpm lab:smoke` | Physical smoke |
| `pnpm lab:dev` | API + worker + web with LAB_MODE |
| `pnpm lab:demo-up` | Full seed + canary + measure + runners + golden + spine walk |
| `pnpm lab:walk-spine` | Wave spine API checks (17 surfaces) |
| `pnpm lab:hybrid-plant` | Hybrid compiler (#30) → plant runner queue (Partial only) |
| `pnpm lab:demo-fixed` | Exposed→hardened→LiveSafe Fixed loop |
| `pnpm lab:enroll-runners` | Register plant/hq + compose profile |
| `pnpm lab:schedule-plant` | Best-effort plant-affinity schedule |
| `pnpm lab:drain-queue` | Obliterate stale validation-missions keys |

---

## Runners (affinity)

After seed:

```bash
# needs image: docker images | grep periscan-runner
# or: pnpm runner:docker:build && export PERISCAN_RUNNER_IMAGE=periscan-runner:local
pnpm lab:enroll-runners
```

Plant joins `lab_data`; HQ does not — affinity falsification via `affinity-fire.sh`.

Compose env expects **post-register auth tokens** (enroll-runners rewrites `.lab-runner.env`).

---

## Fixed closed loop

```bash
set -a; source infra/lab/.lab-demo.env; set +a
pnpm lab:demo-fixed
# or leave hardened for walkthrough:
PERISCAN_LAB_LEAVE_HARDENED=1 pnpm lab:demo-fixed
```

Physical gate: hardened data `/api/records` → 401. Product Fixed requires LiveSafe checks returning `validationState=Fixed` after harden.

---

## Relationship to `pnpm seed:demo`

| | `seed:demo` | `lab:demo-up` |
|--|-------------|---------------|
| Tenant | Fixed `demo@periscan.local` | Fresh `lab-*@periscan.test` |
| Data | Fixture bootstrap | Live lab probes + SIEM |
| Paths | Scenario package | Correlated + hop-measured |
| Use | Offline UI fixtures | Measured demo site |

Both may run on the same DB; different tenants. Prefer **lab:demo-up** for honesty-critical demos.

---

## Teardown

```bash
pnpm lab:stop
# equivalent: bash infra/lab/scripts/stop.sh
# stops lab compose + frees :3000/:3001 (api/web)
```

---

## Success criteria (demo site functional)

- [x] Lab smoke green  
- [x] Product DRV canary closed loop against mocksiem  
- [x] Multi-hop `fullyMeasured:true` with worker + LAB_MODE  
- [x] Harden physical 401  
- [x] Plant/hq runners polling (creds via named volumes; Colima-safe)  
- [x] Affinity: plant reaches data tier; hq isolated  
- [x] Fixed-loop script pass (physical 401 + LiveSafe re-run)  
- [x] Wave spine API walk (`pnpm lab:walk-spine` — 17/17 when seeded)  
- [x] Web UI `/login` 200 with `pnpm lab:dev` / web dev  
- [x] Plant schedule create (`pnpm lab:schedule-plant`)  

Do **not** claim Production connectors, customer references, or full BAS.

### UI sign-in

1. Open http://127.0.0.1:3000/login  
2. Email from `infra/lab/.lab-demo.env` (`PERISCAN_LAB_EMAIL`)  
3. Password: `periscan-lab-password-ok`  
4. Walk Wave spine routes (Operate rail only).

If Next shows `Can't resolve './domain.js'` from `@periscan/shared`, restart web after shared package import fixes (extensionless imports + `next.config` transpilePackages).
