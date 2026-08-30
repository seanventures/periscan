# Continuous loop Slice D — SCV · White-Label · Commercial · Dynamic paths

**Date:** 2026-08-02  
**Branch:** `main` (from `origin/main`)  
**Implementation commit:** `b2fbc3fc`  
**Prior slice:** `docs/qa/SLICE_C_RESCORE_2026-08-01.md` (76.8 / 71 strict floors)  
**Scorecard edit:** **none** this slice (product polish + acceptance + honesty docs only)

## Goals

| # | Row | Goal | Status |
|---:|-----|------|--------|
| 23 | Dynamic Attack Paths | Apply-recommendation journey polish + list recommendations API acceptance; ops depth | **Done** |
| 6 | Security Control Validation | Pull observe + coverage report UI/API; inject stays off; cannot become Strong | **Done (Partial)** |
| 97 | White-Labeling for GSIs | Branding E2E (org name / color / footer) on report HTML + acceptance | **Done** |
| 94 | Self-Serve Free Trials | Honest trial lifecycle; no fake payment processor | **Done** |
| 92 | Short-Term Assessment Licensing | Assessment pack catalog E2E (real meters/capabilities); NotConfigured payment | **Done** |

## Forbidden (enforced)

- SCV **Strong** / Leading while inject loop is disabled  
- Invent card checkout, Stripe, or self-serve bank settlement  
- Auto-queue missions from recommendation apply (Draft only)  
- Edit `docs/qa/analyst-scorecard.json` without evidence-backed rescore  

---

## 23 — Dynamic Attack Paths (apply recommendation + list API)

### Already shipped (Slice B)

| Surface | Behavior |
|--------|----------|
| Generator | `packages/operators/src/dynamic-path-missions.ts` |
| API read | `GET /api/v1/attack-paths/:id/next-mission` |
| API approve | `POST /api/v1/attack-paths/:id/next-mission/approve` → **Draft**, `queued: false` |
| UI | Path detail `data-testid="path-next-mission-panel"` |

### Slice D polish

| Change | Detail |
|--------|--------|
| Apply language | Path CTA: **Apply recommendation** (was “Approve next mission”) |
| Operators UI | `Apply recommendation` creates **Draft** only; never claims “queued” |
| List APIs | Acceptance covers `GET /operator-recommendations` + `GET /operators/recommendations` |
| Approve parity | Operator approve returns `queued: false` (matches path next-mission) |
| Journey | Applied status → Open missions link + mission id |

### Honesty

- Human gate required  
- Draft mission only — operator must start explicitly  
- Not autonomous real-time replan / full-BAS adaptation  

---

## 6 — Security Control Validation (Partial; inject off)

### Product path

1. **Pull observe** — `POST /api/v1/control-sources/:id/validate` with DryRun  
   - `connector.observeControl` → ControlObservation signals  
   - Target pins: `injectLoopAvailable: false`, `observationMode: telemetry_only`  
2. **Coverage report API**  
   - `GET /api/v1/control-sources/rule-coverage` (aggregate)  
   - `GET /api/v1/control-sources/:id/rule-coverage` (per source)  
3. **Coverage report UI** — Controls workbench  
   - `data-testid="scv-coverage-report-panel"`  
   - Explicit copy: cannot become Strong SCV while inject is off  
4. **Inject refuse** — LiveRunner / `dryRun:false` → `control_live_execution_disabled`  

### Honesty ceiling

| Claim | Allowed? |
|-------|----------|
| Telemetry-only observe | Yes |
| Rule coverage from observations | Yes |
| Closed inject→measure Strong SCV | **No** while inject disabled |
| Live Atomic/Caldera inject | **No** |

Scorecard verdict remains **Partial** until a signed inject→observe demo lands.

---

## 97 — White-Labeling for GSIs

### Product path

1. `PUT /api/v1/tenants/current/branding` with `whiteLabelEnabled: true`  
2. Fields: `organizationName`, `primaryColor`, `reportFooter`, `logoUrl`, `supportEmail`  
3. Snapshot export HTML includes:  
   - Brand name (replaces default Periscan chrome)  
   - `--accent: <primaryColor>`  
   - Footer text + support email  

### Acceptance

`tests/acceptance/slice-d-scv-wl-commercial-flow.test.ts` — branding case asserts all three surface properties on real HTML export.

---

## 94 / 92 — Free trials + assessment licensing

### Free trials (94)

| API | Behavior |
|-----|----------|
| `POST /api/v1/billing/trial/start` | Once; grants Enterprise entitlement for trial window |
| `GET /api/v1/billing/trial` | Status / remaining days / retention |
| `POST /api/v1/billing/trial/convert` | Requires `approvalReference` — **no payment processor** |
| Audit | `trial_converted` metadata includes `paymentProcessorUsed: false` |

### Assessment licensing (92)

| Surface | Behavior |
|---------|----------|
| Catalog | `GET /api/v1/billing/packages` |
| Packs | `MSSPPartner` + `Enterprise` include `ShortTermAssessments` meter + short-term assessment capability language |
| Payment | Every package: `paymentProcessorStatus: "NotConfigured"` |
| Convert path | Trial → MSSPPartner via approval-reference only |

### Honesty

- Metering and entitlements are real  
- Card checkout / tax / automated invoice settlement remain **NotConfigured**  
- Do not claim self-serve purchase complete  

---

## Tests

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"

# Unit / component
pnpm --filter @periscan/web exec vitest run \
  src/components/operators-workbench.test.tsx \
  src/components/controls-workbench.test.tsx \
  src/components/attack-path-detail.test.tsx

# Acceptance (Slice D)
pnpm exec vitest run tests/acceptance/slice-d-scv-wl-commercial-flow.test.ts

# Related prior suites (still green)
pnpm exec vitest run \
  tests/acceptance/dynamic-path-next-mission-flow.test.ts \
  tests/acceptance/control-source-observe-flow.test.ts \
  tests/acceptance/trial-lifecycle-flow.test.ts
```

### Green evidence (this slice)

| Suite | Result |
|-------|--------|
| `operators-workbench.test.tsx` | **2 passed** |
| `controls-workbench.test.tsx` | **7 passed** |
| `slice-d-scv-wl-commercial-flow` acceptance (4 cases) | **pass** |

---

## Recommended scorecard deltas (do **not** auto-apply)

Apply only after acceptance green and a rescore agent reviews evidence.

| ID | Requirement | Current | Suggested after Slice D | Rationale | Cap |
|---:|-------------|---------|-------------------------|-----------|-----|
| 23 | Dynamic Attack Paths | 3.5 (4/3/4/3) | **3.75** e.g. ops **4**, function 3–4 | List recs API acceptance + apply journey polish + Draft honesty | Still Partial until measured adaptive replan is lab-proven |
| 6 | Security Control Validation | 3.75 (4/3/4/4) Partial | **hold 3.75** (maybe function +0 if coverage report ops is stronger) | Observe + coverage report E2E; inject still off | **≠ Strong** until inject→observe demo |
| 97 | White-Labeling for GSIs | 3.75 (4/4/4/3) | **4.0** e.g. ops **4** | Full branding HTML E2E (name/color/footer) acceptance | Leading only with partner GSI field evidence |
| 94 | Self-Serve Free Trials | 3.75 (4/4/4/3) | **4.0** e.g. ops **4** | Trial + convert honesty + NotConfigured payment acceptance | Not Leading without real processor |
| 92 | Short-Term Assessment Licensing | 3.5 (4/4/3/3) | **3.75–4.0** e.g. ux/ops **4** | Catalog E2E + convert onto MSSPPartner assessment meters | Not Leading commercial path while payment NotConfigured |

### Do not

- Set id **6** verdict to Strong/Leading while inject disabled  
- Invent payment processor Available / card checkout  
- Claim autonomous dynamic replan on id 23  

---

## Score delta recommendation (aggregate)

| Metric | Slice C | Suggested after D (if deltas applied) |
|--------|--------:|--------------------------------------:|
| Points | 1444 | ~1460–1470 (depends on which dim bumps land) |
| Score | 76.8 | ~77.5–78.2 |
| Strict ≥4.0 | 71/94 | 73–75/94 if 97/94/92 hit 4.0 floors |

Honesty ceiling still blocks true 5.0 floors on partner/inject/marketplace rows.
