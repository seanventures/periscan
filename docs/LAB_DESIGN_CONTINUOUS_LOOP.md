# Periscan Continuous-Loop Lab Design

**Status:** Design + **Phase 1 scaffold** + **Phase 2 canary/SIEM wire-up** (`infra/lab/`) — 2026-08-02  
**Purpose:** Close the residual proof that acceptance tests still label **lab-only**: in-network FullyMeasured multi-hop, runner fleet affinity, DRV/DNS canary with live SIEM observe, optional cloud fix-verify, design-partner dogfood.  
**Does not:** enable live Atomic/Caldera/SharpHound, real ransomware, credential theft, or invent customer references.

**Builds on (already shipped):**

| Asset | Role |
|-------|------|
| `infra/test-range/` + `docs/MEASURED_TEST_RANGE.md` | Exposed↔hardened **single-host** posture (TLS/HTTP/DNS) → Measured → Fixed |
| Go LTS runner (`apps/runner`) | Outbound signed-task polling |
| Acceptance multi-hop / FFV / DRV / DNS canary / schedules | Product path proven with **mocks** |
| Continuous-loop scorecard | **78.2** / 1471 pts; still needs lab evidence for 95 |

---

## 1. Why a lab (and what “done” means)

| Gap today | What the lab proves | Scorecard rows helped |
|-----------|---------------------|------------------------|
| Multi-hop FullyMeasured only via mock correlation + receipts | **Runner-executed** hop probes against real TCP/TLS/DNS hops on a known topology | **3 APV**, **23 dynamic**, **5** graphs |
| Posture Fixed loop is control-plane inline | Same loops via **InternalRunner** + signed evidence | **47 integrity**, **1 ASV**, **9/10 cloud/k8s** (phase 3) |
| DRV/DNS canary often fixture SIEM | **Live** emit → observe into mock SIEM with real HTTP | **8 DRV**, **19 DNS**, **6 SCV** (still Partial — no inject library) |
| Customer-qual connectors NotConfigured | Optional **wiremock** / sandbox tenants only — never fake Production cert | **72–78** ops floors only |
| Multi-node reaper is unit/acc only | 2+ runners, lease steal, site affinity | **13/24** scheduling ops, runner ops |
| Blind rescore / demo | Reproducible **golden path** demo tenant script | Slice 10 gates |

**Lab Definition of Done (release-qual lab gate):**

1. `RANGE_PROFILE=exposed` → live posture findings Measured.  
2. Flip hardened → auto-revalidate → Fixed with `measuredRevalidation`.  
3. **Multi-hop path** (edge0→edge1→edge2) reaches `measurement-state.fullyMeasured=true` with **runner** evidence IDs on every hop.  
4. Detection-marker + DNS-exfil canary close loop against **mock SIEM** with `measured:true` only when emit+observe both live.  
5. Two runners: plant site vs hq site; schedule fire pins plant.  
6. Scripted teardown leaves no secrets; all claims still claim-safe.

---

## 2. Architecture overview

```
                    ┌─────────────────────────────────────────┐
                    │  Control plane (api + web + postgres)   │
                    │  host network or compose network A      │
                    └───────────────┬─────────────────────────┘
                                    │ outbound HTTPS only
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
     ┌────────────────┐   ┌─────────────────┐   ┌──────────────────┐
     │ Runner HQ      │   │ Runner Plant    │   │ (optional) API   │
     │ site=hq        │   │ site=plant      │   │ in-lab container │
     │ segment=corp   │   │ segment=ot-dmz  │   │ for UDP DNS mac  │
     └───────┬────────┘   └────────┬────────┘   └──────────────────┘
             │                     │
             │    docker network: lab-edge / lab-core / lab-dmz
             ▼                     ▼
     ┌──────────────────────────────────────────────────────────┐
     │  Tier-0 Edge:  edge.lab.range.test (nginx + TLS)         │
     │  Tier-1 App:   app.lab.range.test  (existing range+)     │
     │  Tier-2 Data:  data.lab.range.test (postgres fake API)   │
     │  DNS:          CoreDNS lab.range.test zone               │
     │  SIEM mock:    mocksiem (ingest + query API)             │
     │  Optional:     localstack / kind / wiremock connectors   │
     └──────────────────────────────────────────────────────────┘
```

**Networks (docker compose):**

| Network | Who joins | Intent |
|---------|-----------|--------|
| `lab_core` | Control plane (optional), CoreDNS, mock SIEM, minio | Always-on services |
| `lab_edge` | edge nginx, plant runner | “Internet-facing” hop |
| `lab_app` | app nginx (test-range), plant runner | Application tier |
| `lab_data` | data API, plant runner only (hq runner **cannot** reach) | Forces multi-hop / segment affinity |

Plant runner is on `lab_edge` + `lab_app` + `lab_data`.  
HQ runner is on `lab_core` + `lab_edge` only — **cannot** open data tier.  
That makes schedule **site/segment affinity** falsifiable.

---

## 3. Lab profiles (compose projects)

### 3.1 `infra/test-range` (existing) — keep

- Single-hop / posture Fixed loop.  
- **No change required** for baseline WS1; lab design **extends** it.

### 3.2 `infra/lab` (new) — Continuous-loop lab

Proposed layout:

```text
infra/lab/
  README.md                 # operator quickstart
  docker-compose.yml        # core + multi-hop + siem + runners
  docker-compose.cloud.yml  # optional LocalStack / kind
  docker-compose.wiremock.yml
  .env.example
  coredns/
  nginx/
    edge/
    app/          # can vendor/symlink from test-range
    data/
  mocksiem/
    Dockerfile
    server.mjs      # POST /ingest, GET /search?q=
  scripts/
    up.sh
    down.sh
    seed-tenant.sh  # scopes, runners, SIEM connector
    golden-path.sh  # fully measured multi-hop + FFV
    affinity-fire.sh
    canary-loop.sh
  fixtures/
    scopes.json
    expected-outcomes.json
```

### 3.3 Environment variables (API host)

| Variable | Purpose |
|----------|---------|
| `NODE_EXTRA_CA_CERTS` | Lab CA (same pattern as test-range) |
| `NODE_OPTIONS=--import …/dns-preload.mjs` | Point DNS modules at lab CoreDNS |
| `RANGE_DNS_SERVER` | When API runs in-compose |
| `PERISCAN_LAB_MODE=1` | Enables lab seed helpers / allows LiveSafe defaults in scripts only |
| `PERISCAN_RUNNER_IMAGE` | `ghcr.io/…/periscan-runner` or local build |

---

## 4. Topology and hop model

### 4.1 Hosts (authoritative DNS `lab.range.test`)

| Hostname | Tier | Exposed posture | Hardened posture | Hop role |
|----------|------|-----------------|------------------|----------|
| `edge.lab.range.test` | 0 | Open 443, weak TLS/headers | Hardened headers + TLS1.2+ | Hop 0: external entry |
| `app.lab.range.test` | 1 | Same as test-range exposed | Hardened | Hop 1: app |
| `data.lab.range.test` | 2 | HTTP API on :8080 “sensitive list” without auth | Auth required / closed | Hop 2: data (plant-only) |
| `siem.lab.range.test` | core | Mock SIEM always on | n/a | Observe target for canaries |
| `marker.lab.range.test` | core | Process/HTTP canary sink | n/a | DRV emit target |

### 4.2 Multi-hop path the product must measure

Seed (or correlate) an attack path with **exactly three edges**:

```text
Internet → edge.lab.range.test → app.lab.range.test → data.lab.range.test
```

| Edge | Safe module class (allowlisted) | Measured means |
|------|----------------------------------|----------------|
| e0 | `periscan.tls_*` / `http_health` via **runner plant** | Receipt + evidence IDs from runner |
| e1 | `periscan.http_*` app | Same |
| e2 | `periscan.http_health` or custom `periscan.lab_data_reachability` (read-only GET `/health`) | Same; **hq runner must fail eligibility or timeout** (segment) |

**Claim law unchanged:** FullyMeasured only when all three receipts Measured with evidence; never invent Validated from correlation alone.

### 4.3 Closed-loop Fixed (extends test-range)

1. Path FullyMeasured (exposed).  
2. Operator opens remediations / breakers.  
3. Flip compose profile `LAB_PROFILE=hardened` (or per-tier).  
4. `auto-revalidate` / verifyRemediation → Fixed with measured revalidation.  
5. Optional: re-expose one hop → finding reopens / path demotes honesty.

---

## 5. Mock SIEM (DRV + DNS canary)

Minimal Node service (`mocksiem`):

| Endpoint | Behavior |
|----------|----------|
| `POST /v1/events` | Store event `{ ts, marker, host, source }` |
| `GET /v1/events?marker=` | Return matching events |
| `GET /health` | 200 |

**Connector profile:** lab-only “Generic HTTP SIEM” or reuse existing SIEM connector with base URL `http://siem.lab.range.test:9200` and API key from seed.

**Canary loops:**

1. **DRV:** Controls → detection-marker-proof → allowlisted `periscan-*` process/HTTP emit to marker host → mock SIEM receives → observe correlates → `benign_marker_only`, `measured:true` only with both legs live.  
2. **DNS canary:** emit canary label to CoreDNS log or HTTP sink → SIEM search → same honesty fields (`realDataExfiltrated:false`).

**Never:** full ATT&CK library inject, Atomic live, real customer data.

---

## 6. Runners

### 6.1 Images

- Primary: production Go runner (LTS).  
- Compose services: `runner-hq`, `runner-plant`.

### 6.2 Enrollment

`scripts/seed-tenant.sh`:

1. Create lab tenant (or use local dev).  
2. Issue runner tokens with labels:
   - HQ: `site=hq`, `networkSegment=corp`  
   - Plant: `site=plant`, `networkSegment=ot-dmz`  
3. `docker compose up runner-hq runner-plant` with env:
   - `PERISCAN_CONTROL_PLANE_URL`  
   - `PERISCAN_RUNNER_TOKEN`  
   - site/segment env matching seed  

### 6.3 Affinity falsification

| Schedule | preferredSite / segment | Expected runner |
|----------|-------------------------|-----------------|
| Plant CV | plant / ot-dmz | plant |
| HQ CV | hq / corp | hq |
| Mis-pin plant task to hq-only network | — | Fail or no lease (honest) |

Acceptance already has affinity unit/acc; lab makes it **physical**.

---

## 7. Optional phase-3 add-ons

| Addon | Compose file | Score rows | Notes |
|-------|--------------|------------|-------|
| LocalStack (S3/IAM misconfig) | `docker-compose.cloud.yml` | 9 CSV | Only if modules can target LocalStack endpoints |
| kind / k3d | same | 10 K8s | Optional; heavy |
| Wiremock CrowdStrike/Wiz | `docker-compose.wiremock.yml` | 72–78 | **Dry-run / contract only** — never set Production cert |
| Mailhog | core | email DNS is already CoreDNS | Optional |

---

## 8. Seed and golden-path scripts

### 8.1 `seed-tenant.sh`

- Org + admin user  
- Verified scopes for edge/app/data (+ TXT in CoreDNS or dev Verified)  
- SIEM integration pointing at mocksiem  
- Two runners registered  
- Optional: seed path graph if correlation insufficient (must still measure hops live)

### 8.2 `golden-path.sh` (release lab gate)

```text
1. up lab (exposed)
2. seed tenant
3. connect SIEM
4. enroll runners; wait heartbeat
5. posture-check LiveSafe on app scope (control-plane or runner)
6. measure hops e0,e1,e2 via product API (runner plant)
7. assert fullyMeasured
8. create remediations / flip hardened
9. verify → Fixed
10. run marker proof + dns canary; assert measured with SIEM
11. print JSON report of evidence IDs + claim-safe path state
12. exit non-zero on any soft claim (Heuristic presented as Measured)
```

Artifact: `docs/qa/lab-runs/YYYYMMDD-HHMM-golden.json` (gitignored or CI artifact).

---

## 9. Safety boundaries (lab must not erode product)

| Allowed | Forbidden |
|---------|-----------|
| Passive probes (TLS/HTTP/DNS) | Live exploit chaining |
| Allowlisted `periscan-*` markers | Atomic/Caldera/SharpHound live |
| Mock SIEM / wiremock | Real customer data exfil |
| Segment isolation demos | Cross-tenant mutate tests against real tenants |
| Hardened flip for Fixed | Config-push to production systems |

Lab compose **must not** set product flags that enable Wave D inject or `control_live_execution` by default.

---

## 10. Mapping to continuous-loop / analyst score

| Lab gate | Enables honest rescore discussion for |
|----------|----------------------------------------|
| Golden multi-hop runner FullyMeasured | APV (3) toward **4.5** Strong (still not Leading without policy) |
| Posture Fixed via runner | Revalidation (69), auto-revalidate (67) ops |
| Mock SIEM canary measured | DRV (8), DNS (19) ops/function |
| Affinity fire physical | Scheduling (24), multi-site |
| Wiremock only | Connector ops floors — **not** Production elevation |
| Full golden artifact + blind memo | Slice 10 blind rescore input |

**Still not unblocked by lab alone:** partner dark-web/OT/HITL, public refs, SCIM Production, vendor Type II, marketplace Public, full BAS.

---

## 11. Implementation phases

### Phase 0 — Documented (this doc)  
### Phase 1 — Multi-hop + runners (1–2 eng days) — **scaffold landed** (`infra/lab/`, 2026-08-02)

1. Scaffold `infra/lab/docker-compose.yml` reusing test-range nginx/coredns patterns.  
2. Add edge + data tiers + networks.  
3. Runner-hq / runner-plant services.  
4. `seed-tenant.sh` + `golden-path.sh` skeleton.  
5. CI optional job `lab-golden` on Linux runners only (UDP DNS).

### Phase 2 — Mock SIEM canaries (1 eng day) — **landed** 2026-08-02

1. mocksiem **Splunk-compatible** `POST /services/search/jobs/export` + lab native ingest.  
2. `canary-loop.sh` physical + optional product `detection-marker-proof` / `dns-exfil-canary-proof` with `injectMockObservation:false`.  
3. `seed-tenant.sh` automation: scopes, Splunk→mocksiem integration, control source, runner tokens → `.lab-state.json`.  
4. Optional acceptance `tests/acceptance/lab-mocksiem-canary-e2e.test.ts` behind `PERISCAN_LAB_E2E=1`.  
5. CI workflow `.github/workflows/lab-golden.yml` (dispatch / weekly) physical gate.

**Live product proof (2026-08-02, local):**

| Proof | Result |
|-------|--------|
| DRV canary | `detection_marker_emit_observe_detected`, closedLoop against mocksiem |
| DNS canary | `dns_exfil_detected`, `measured:false`, `realDataExfiltrated:false` |
| Queue hygiene | `drain-validation-queue.sh` obliterates stale BullMQ jobs |
| Multi-hop | `measure-hops.sh` + worker → **`fullyMeasured:true`**, `pathEvidenceBasis=Measured`, hop fraction 1.0 |
| Claim-safe | `claimSafeValidationState=Discovered` (does **not** invent Validated path certainty) |
| Harden physical | `LAB_PROFILE=hardened` → data `/api/records` **401** |

**Requirements for FullyMeasured lab gate:** `PERISCAN_LAB_MODE=1` (maps lab hostnames → published ports), clean Redis queue, worker running with hop **auto-apply receipts** (P05-1 parity).

**Demo site package (2026-08-02):** `docs/DEMO_LAB_SITE.md` + `pnpm lab:demo-up` / `lab:dev` / `lab:walk-spine` — dual runners polling, affinity physical, Wave spine 17/17. Closeout memo: `docs/qa/LAB_DEMO_SITE_CLOSEOUT_2026-08-02.md`.

### Phase 3 — Cloud/k8s optional (as needed for rows 9/10)

LocalStack or kind; only if modules can target them without product hacks.  
**Scaffold 2026-08-03:** `infra/lab/docker-compose.cloud.yml`, `infra/lab/kind/`, `infra/lab/PHASE3_CLOUD.md`. No analyst score lift from scaffold alone.

### Phase 4 — Design-partner dogfood profile

`docs/DESIGN_PARTNER/LAB_DOGFOOD.md`: one BU uses lab golden path weekly; session log; **no public ref fabrication**.  
**Process doc + first internal log 2026-08-03** (`docs/qa/dogfood/2026-08-03-weekly.md`). Lab tooling remains ready; market presence still separate.

---

## 12. Compose sketch (illustrative)

```yaml
# infra/lab/docker-compose.yml (sketch — not production)
name: periscan-lab
networks:
  lab_core:
  lab_edge:
  lab_app:
  lab_data:

services:
  coredns:
    image: coredns/coredns
    networks: [lab_core]
    ports: ["5355:53/udp", "5355:53/tcp"]
    volumes: ["./coredns:/config:ro"]
    command: ["-conf", "/config/Corefile"]

  edge:
    image: nginx:alpine
    networks: [lab_edge]
    # SNI edge.lab.range.test — weak vs hardened profiles via config mount

  app:
    image: nginx:alpine
    networks: [lab_app]
    # reuse test-range configs

  data:
    image: nginx:alpine
    networks: [lab_data]
    # /health open vs auth-gated

  mocksiem:
    build: ./mocksiem
    networks: [lab_core]
    ports: ["9200:9200"]

  runner-plant:
    image: ${PERISCAN_RUNNER_IMAGE}
    networks: [lab_edge, lab_app, lab_data, lab_core]
    environment:
      PERISCAN_CONTROL_PLANE_URL: ${CONTROL_PLANE_URL}
      PERISCAN_RUNNER_TOKEN: ${PLANT_TOKEN}
      PERISCAN_SITE: plant
      PERISCAN_NETWORK_SEGMENT: ot-dmz

  runner-hq:
    image: ${PERISCAN_RUNNER_IMAGE}
    networks: [lab_core, lab_edge]
    environment:
      PERISCAN_CONTROL_PLANE_URL: ${CONTROL_PLANE_URL}
      PERISCAN_RUNNER_TOKEN: ${HQ_TOKEN}
      PERISCAN_SITE: hq
      PERISCAN_NETWORK_SEGMENT: corp
```

---

## 13. Host / CI requirements

| Constraint | Guidance |
|------------|----------|
| macOS Docker Desktop UDP | Prefer **Linux CI** or API container on lab network (same as test-range caveat) |
| Ports | Avoid 53 on host; use 5355; document 80/443 conflicts |
| Resources | 2 CPU / 4 GB RAM baseline; +2 GB with LocalStack/kind |
| Secrets | Lab tokens in `.env` gitignored; rotate via seed |

---

## 14. Success metrics (lab, not scorecard invent)

| Metric | Pass |
|--------|------|
| Golden path exit code | 0 |
| `fullyMeasured` | true with 3 runner evidence IDs |
| Fixed after harden | `measuredRevalidation: true` |
| Canary measured | true only with SIEM hit |
| Affinity | plant schedule → plant runner id |
| Claim safety | zero Heuristic-as-Validated in golden JSON |

Scorecard bumps happen **only after** golden artifacts + memo in a dedicated rescore pass (same discipline as continuous loop A–D).

---

## 15. Relationship to design partners

| Mode | Lab role |
|------|----------|
| Internal dogfood | Golden path weekly |
| Design partner onsite | Same compose on air-gapped laptop; scopes = partner authorized hosts **or** lab hostnames only |
| Public reference | Still requires NDA + real production proof — **lab alone does not create refs** |

---

## 16. Recommended next implementation PR

1. ~~`infra/lab/` scaffold + README + compose (Phase 1).~~  
2. ~~Phase 2 scripts seed + canary-loop + golden-path + Splunk export.~~  
3. ~~CI workflow `lab-golden.yml` (Linux, optional manual).~~  
4. Link from `docs/MEASURED_TEST_RANGE.md` § “Continuous-loop multi-hop lab” (if not already).  
5. ~~FullyMeasured multi-hop with worker hop auto-apply + LAB_MODE~~ (artifact class `*-golden-fullymeasured.json`).  
6. ~~Plant/hq runners + affinity physical~~ (demo-up enroll; plant→data / hq isolated).  
7. ~~Demo site operator package~~ (`DEMO_LAB_SITE.md`, `lab:demo-up`, `lab:walk-spine` 17/17).  
8. **Remaining (score/process only):** Slice E rescore for rows 3/8/19/67/69 **only** with artifact refs — **never invent 5.0 / 95**; Phase 3 cloud optional; design-partner weekly dogfood cadence.

---

## 17. Non-goals (explicit)

- Replacing production PaaS (goldeneye) with lab  
- Full BAS peer scenario library  
- Real OT protocol speak  
- Crowd HITL network  
- Payment processor or AWS Marketplace live listing  
- Fabricating analyst 95 without blind rescore  

---

**Summary:** Keep the existing **measured test-range** for single-host Fixed loops; add **`infra/lab`** multi-tier topology + dual runners + mock SIEM so multi-hop FullyMeasured, affinity, and canary observe become **physical, reproducible evidence** — without crossing safety or real-first floors.
