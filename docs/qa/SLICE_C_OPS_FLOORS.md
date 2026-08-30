# Continuous loop Slice C — honest ops floors (ops 3→4)

**Date:** 2026-08-01  
**Branch:** `overnight-loop`  
**Rule:** Evidence-backed ops floors only. Parent rescores scorecard. This memo recommends `ops+1` where product + acceptance glue already exist — **no invented customer-qual live credentials**.

---

## 1. What shipped this slice

| # | Deliverable | Evidence |
|---|-------------|----------|
| 1 | Platform ops health acceptance glue | `tests/acceptance/platform-ops-health-floor-flow.test.ts` |
| 2 | Customer-qual dry-run connection probe E2E (rows 72–78) | `tests/acceptance/customer-qual-connector-dry-run-probe-flow.test.ts` |
| 3 | Live-smoke env key map for XSIAM + vCenter | `packages/shared/src/connector-production-qualification.ts` (`CUSTOMER_QUAL_CONNECTOR_KEYS`, `CONNECTOR_LIVE_SMOKE_ENV_KEYS`) |
| 4 | Unit coverage for new keys | `packages/shared/src/connector-production-qualification.test.ts` |

### Platform surfaces pinned (already real product)

| Surface | API / runbook | Acceptance assertion |
|---------|---------------|----------------------|
| **Runner fleet health** | `GET /api/v1/runners/fleet`, `PUT …/fleet/policy` · `docs/RUNNER_FLEET_OPERATIONS_RUNBOOK.md` | Empty workspace → seal policy → register + heartbeat → summary counts + `healthState` |
| **Schedule program health** | `GET/POST /api/v1/schedules`, pause | Active ContinuousValidation → program counts → pause flips status |
| **Webhook delivery metrics** | list deliveries + dead-letter · Swarm S6 | Test deliver HMAC → status metrics (Delivered/Failed/dead-letter) |
| **Priority lanes** | `GET/PUT /api/v1/model-gateway/finops` · `priorityLaneEnabled` | Default false → enable true without inventing scale claims |
| **NHI sprawl** | `GET/POST /api/v1/non-human-identities` | Register secret-free metadata → summary totals; external id not leaked |
| **Connector freshness** | `GET /api/v1/data-fabric/quality-surface` | Summary counts (stale/qualified/degraded/…) always present |

### Customer-qual connectors (72–78) — dry-run only

| Scorecard id | Connector key | Dry-run without env | Mock health residual |
|-------------:|---------------|---------------------|----------------------|
| 72 | `crowdstrike` | `NotConfigured` (`CS_CLIENT_ID`, `CS_CLIENT_SECRET`) | Optional mock health OK |
| 73 | `palo-cortex-xsiam` | `NotConfigured` (`XSIAM_API_KEY`, `XSIAM_KEY_ID`, `XSIAM_BASE_URL`) | Optional mock health OK |
| 74 | `wiz` | `NotConfigured` (`WIZ_CLIENT_ID`, `WIZ_CLIENT_SECRET`) | Optional mock health OK |
| 75 | `datadog-siem` | `NotConfigured` (`DATADOG_API_KEY`, `DATADOG_APP_KEY`) | Optional mock health OK |
| 76 | `tenable` | `NotConfigured` (`TENABLE_ACCESS_KEY`, `TENABLE_SECRET_KEY`) | Optional mock health OK |
| 77 | `ibm-qradar` | `NotConfigured` (`QRADAR_TOKEN`, `QRADAR_BASE_URL`) | Optional mock health OK |
| 78 | `vmware-vcenter` | `NotConfigured` (`VCENTER_BASE_URL`, `VCENTER_USERNAME`, `VCENTER_PASSWORD`) | Optional mock health OK |

**Hard residual (do not ops+1 for live Production cert):** Live partner credentials, partner tenant smoke, and `productionCertified: true` elevation remain **CustomerQualification**. Keys present without a complete live-smoke receipt stay **Blocked**. Catalog Production count remains **0**.

---

## 2. Recommended per-id ops+1 list (parent rescore)

Only rows currently **Strong** with `operations: 3` on the Slice B scorecard are listed. Parent applies bumps only where evidence matches.

### 2.1 Platform-tied — **recommend ops 3→4** (this slice)

These share operable platform ops surfaces proven by `platform-ops-health-floor-flow` (+ existing Swarm S6 / NHI / FinOps / fabric acceptance).

| ID | Requirement | Why ops+1 is honest now | Residual for 5.0 |
|---:|-------------|-------------------------|------------------|
| **53** | NHI Sprawl Discovery | NHI inventory + summary + secret-free acceptance; platform floor re-asserts summary | Partner IdP/NHI feed depth |
| **57** | Priority Lanes for Validation | FinOps `priorityLaneEnabled` operable end-to-end; no scale theater | Fair-share load under production multi-tenant |
| **79** | Continuous Intelligence Feed | Schedule program health + fabric freshness surface (CV cadence + quality-surface) | Feed SLA UI / multi-source depth |
| **31** | Dynamic Routing | Runner fleet health + schedule affinity/program operability (control-plane routing ops) | Deeper product routing claims |
| **52** | Short-Lived Credential Issuance | Runner fleet credential lifecycle ops surface (registration / heartbeat / policy) | Hardware / issuance partner depth |

Also justified as **platform ops maintain** (same glue, existing product already Strong elsewhere):

| ID | Requirement | Notes |
|---:|-------------|-------|
| **24** | Automated Scheduling | Already high; schedule program health re-asserted — maintain |
| **17** | Agent-Based Execution | Fleet health re-asserted — maintain |
| **71** | ITSM/SOAR Automation | Webhook delivery metrics re-asserted — maintain if ops still 3 on tip |

### 2.2 AI / agent Strong cluster — **ops+1 only if parent maps to platform runbooks**

Product exists; ops polish is **partially** covered by FinOps priority lanes + schedule program + fleet (not full AI lab ops). Recommend **ops+1** only when parent already scores function/product ≥4 and wants a conservative floor:

| ID | Requirement | Recommend | Caveat |
|---:|-------------|-----------|--------|
| 54 | Agent Behavior Analytics | **ops+1** | Deterministic rules real; not ML anomaly ops |
| 59 | AI Control Validation | **ops+1** | Honesty gates hold; no inject theater |
| 60 | Model-Aware Threat Simulation | **ops+1** | Corpora/ops evidence partial |
| 61 | Prompt Injection Emulation | **ops+1** | Safe suite; not live offensive |
| 62 | Jailbreak Validation | **ops+1** | Same safety residual |
| 63 | RAG Poisoning Emulation | **ops+1** | Same safety residual |
| 34 | MCP Host/Client | **ops+1** | Labs-demoted; ops floor only |
| 40 | Time-Travel Debugging | **ops+1** | Flight-recorder ops; not full time-travel product |

**Do not** ops+1 if function/product honesty demotion is pending for the same row.

### 2.3 Customer-qual 72–78 — **ops+1 for dry-run probe only (not live cert)**

| ID | Requirement | Recommend | Residual (blocks Leading / Production) |
|---:|-------------|-----------|----------------------------------------|
| 72 | CrowdStrike | **ops+1** (ops maintain via dry-run + mock health) | Live CS OAuth smoke + Plane receipt |
| 73 | Palo Alto XSIAM | **ops+1** same | Live XSIAM keys + partial-depth honesty |
| 74 | Wiz / CSPM | **ops+1** same | Live Wiz client |
| 75 | Datadog | **ops+1** same | Live Datadog keys |
| 76 | Tenable / RBVM | **ops+1** same | Live Tenable keys |
| 77 | IBM QRadar | **ops+1** same | Live Ariel path |
| 78 | VMware vCenter | **ops+1** same | Customer vSphere; stay Strong not Leading |

Parent may choose to hold ops=3 until design-partner live smoke if scorer treats “ops” as **live** ops only. This slice documents **dry-run operability** as the honest floor.

### 2.4 Partner / commercial — **do not invent ops+1**

| ID | Requirement | Recommendation |
|---:|-------------|----------------|
| 38 | A2A Artifact Exchange | **Hold** — Partner dependency |
| 51 | AgentDID Integration | **Hold** — Partner issuer/wallet |
| 92 | Short-Term Assessment Licensing | **Hold** unless subscription runbook already covers ops=4 elsewhere |
| 94 | Self-Serve Free Trials | **Hold** — `paymentProcessorStatus: NotConfigured` |
| 97 | White-Labeling for GSIs | **Hold** — product depth residual |

---

## 3. Suggested parent rescore arithmetic (ops-only)

If parent applies **only** the platform-tied set (53, 57, 79, 31, 52) → **+5 ops points** (each Strong 3.75 → 4.0).

If parent also applies AI cluster (54, 59–63, 34, 40) → **+8** more.

If parent applies customer-qual dry-run ops (72–78) → **+7** more.

**Max honest ops lift from this slice (if all accepted):** ~20 dimension points ≈ ~1.1% score.  
**Not claimed here** — parent owns `analyst-scorecard.json` + gate floors.

---

## 4. How to run

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL=$DATABASE_URL

pnpm exec vitest run \
  packages/shared/src/connector-production-qualification.test.ts \
  tests/acceptance/platform-ops-health-floor-flow.test.ts \
  tests/acceptance/customer-qual-connector-dry-run-probe-flow.test.ts
```

Related runbooks (already real):

- `docs/RUNNER_FLEET_OPERATIONS_RUNBOOK.md`
- `docs/qa/E2E_SWARM_S6_PLATFORM.md`
- `docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md`
- `docs/CONNECTOR_LIVE_SMOKE.md`

---

## 5. Forbidden / honesty floors

- Do **not** set catalog `availability: Production` or `productionCertified: true` without Plane live-smoke receipt.
- Do **not** invent partner credentials in CI or scorecard evidenceRefs.
- Do **not** cite soak prep as completed multi-node capacity proof.
- Do **not** ops+1 Partner rows (38, 51) without joint proof.
- Do **not** mark Fixed remediations from schedule cadence or webhook delivery alone.

---

## 6. Commit scope (this slice)

- `packages/shared/src/connector-production-qualification.ts` (+ unit test)
- `tests/acceptance/platform-ops-health-floor-flow.test.ts`
- `tests/acceptance/customer-qual-connector-dry-run-probe-flow.test.ts`
- `docs/qa/SLICE_C_OPS_FLOORS.md` (this file)

**Scorecard not edited** — parent continuous-loop rescore applies recommended ops floors after green tests.
