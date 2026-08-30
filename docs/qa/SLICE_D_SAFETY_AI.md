# Continuous loop Slice D — Safety scaffolds 16/21/22 + AI ops floors 59/61/64

**Date:** 2026-08-02  
**Branch:** `main`  
**Prior slice:** `docs/qa/SLICE_C_RESCORE_2026-08-01.md` (76.8 / 71 strict floors)  
**Scorecard edit:** **none** this product commit (parent rescore applies recommended floors)

## Goals

| # | Area | Goal | Status |
|---|------|------|--------|
| 1 | Safety 16/21/22 | Inventory API + UI complete; claim classes honest | **Done** |
| 2 | Ransomware (#21) | Forever refuse impact (T1486); detection canaries not sold as ransomware | **Done** |
| 3 | APT (#16) | Plan-only kill-chain substitute; never live agentless APT | **Done** |
| 4 | Identity (#22) | Exposure-only; live spray/harvest refused | **Done** |
| 5 | AI 59/61/64 | Ops acceptance glue; safe canaries only | **Done** |
| 6 | This memo | `docs/qa/SLICE_D_SAFETY_AI.md` | **Done** |

## Forbidden (enforced)

- Live ransomware encryption / mass lock / shadow-copy delete  
- Live credential spray, token theft, SharpHound collector  
- Live agentless APT / kill-chain execution / Caldera / Atomic live inject  
- Live harmful jailbreak corpora / unrestricted injection banks  
- Model weight / gradient / checkpoint recovery  

---

## 1. Safety packs 16 / 21 / 22

### Shared inventory (source of truth)

`packages/shared/src/safety-equivalent-packs.ts`

| ID | Requirement | claimClass | honestSubstitute | elevate? |
|---:|-------------|------------------|------------------|----------|
| **16** | Agentless APT Execution | `plan_only` | Partial (planner + safe hand-offs) | yes (substitute only) |
| **19** | Data Exfiltration over DNS | `benign_marker_only` | Partial/Strong canary class | yes (canary class) |
| **21** | Ransomware Emulation | `forever_refuse` | ForeverRefuse | **no** |
| **22** | Identity Abuse & Credential Harvesting | `exposure_only` | Partial (secrets + dry-run) | yes (exposure only) |

### API envelope (completed fields)

`GET /api/v1/safety-equivalent-packs`

| Field | Value |
|-------|--------|
| `packs` | Full inventory (2, 16, 19, 21, 22, 26, 28) |
| `partnerGatedScorecardIds` | `[2, 26, 28]` |
| `safetyEquivalentScorecardIds` | `[16, 19, 21, 22]` **(Slice D)** |
| `scaffoldCoreScorecardIds` | `[16, 21, 22]` **(Slice D)** |
| `note` | Pins `16=plan_only`, `21=forever_refuse`, `22=exposure_only` |

Helpers: `listSafetyScaffoldCorePacks`, `listSafetyEquivalentGatePacks`, `listScaffoldGatedPacks`.

### UI

`apps/web/src/components/specialist-coverage-honesty.tsx`

- **Single source of truth** — rows derived from shared `listScaffoldGatedPacks()` (no duplicated catalog).  
- `data-testid=safety-scaffold-core-honesty-strip` documents 16/21/22 claim classes.  
- Each row: `data-claim-class`, `data-can-elevate-substitute`, forever-refuse list.  
- Mounted on `/engines` and compact Continuous hub (unchanged).

### Module catalog honesty

| Module | Pin |
|--------|-----|
| `exploitation.killchain.engine` | **Catalog-only** (P05-12) — **not** in `GET /api/v1/modules` executable registry; plan-only body never runs as attack engine |
| `identity.cred_spray` | In executable catalog with `liveSupported: false` — dry-run/fixture; live auth disabled |
| `caldera.advanced_adversarial` (if present) | `liveSupported: false` |
| T1486 playbook | Forbidden, `safeLiveModuleId: null` |

---

## 2. AI ops floors 59 / 61 / 64

Product already Strong from Slice B/C. Slice D adds **ops acceptance glue** so ops 3→4 is evidence-backed without inventing live jailbreak banks or weight theft.

| ID | Requirement | Ops surface | Safe residual |
|---:|-------------|-------------|----------------|
| **59** | AI Control Validation | AI app validate fixture `measured:false` + bounded live pass + evidence download | Safe suite only — not full adversarial corpus |
| **61** | Prompt Injection Emulation | PromptInjection LiveSuite with `periscan-benign-v1`; external jailbreak corpus not productized | Policy deny+log in `@periscan/policy`; no live jailbreak bank |
| **64** | Model Weight Extraction Tests | `GET …/model-extraction-resistance/honesty` + 5-probe LiveSuite | `weightExtractionAttempted:false` always |

Related product (already shipped):

- Slice B: `docs/qa/SLICE_B_AI_CONTROLS.md` (kill-switch, measured honesty, prompt-injection policy)  
- Slice C: multi-probe extraction suite + honesty API  

---

## 3. Tests

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL=$DATABASE_URL

pnpm --filter @periscan/shared test -- safety-equivalent-packs
pnpm --filter @periscan/web test -- specialist-coverage-honesty
pnpm --filter @periscan/api test -- dns-exfil-canary-proof

pnpm exec vitest run \
  tests/acceptance/slice-d-safety-ai-flow.test.ts \
  --testTimeout=90000
```

| Suite | Asserts |
|-------|---------|
| `packages/shared/src/safety-equivalent-packs.test.ts` | Core helpers + response ids + claim classes |
| `apps/web/…/specialist-coverage-honesty.test.tsx` | UI lockstep with shared; scaffold core strip |
| `tests/acceptance/slice-d-safety-ai-flow.test.ts` | API inventory + module liveSupported pins + AI 59/61/64 ops path |

Complementary (already green on tip):

- `tests/acceptance/ai-control-validation-honesty-flow.test.ts`  
- `tests/acceptance/slice-c-partials-honesty-flow.test.ts` (model extraction)  
- `packages/policy/src/prompt-injection.test.ts`  

---

## 4. Recommended score deltas (parent rescore)

Apply only after this commit is on tip and focused tests are green. **Do not invent Leading.**

### 4.1 Safety scaffolds (substitute honesty — not peer BAS)

| ID | Current (Slice C) | Recommended | Rationale |
|---:|------------------:|------------:|-----------|
| **16** APT plan-only | 2.5 Scaffold (3/2/3/2) | **3.25 Partial** (4/3/3/3) | Inventory+UI+API+catalog plan-only; still not live APT |
| **21** Ransomware | 2.25 Scaffold (2/2/3/2) | **2.75 Scaffold** (3/2/4/2) or hold 2.25 | Honesty/UX complete; **never** elevate as ransomware emulation |
| **22** Identity exposure | 2.5 Scaffold (3/2/3/2) | **3.25 Partial** (4/3/3/3) | Exposure inventory + liveSupported:false catalog pin |

**Honesty ceilings:** 16/22 Partial = *substitute* language only. Matrix peer APT / identity harvest remain Scaffold/Missing for live offense. Row 21 stays Scaffold/gated forever for Impact.

Dim-point estimate if 16→3.25 (+3), 22→3.25 (+3), 21→2.75 (+2): **+8 dimension points**.

### 4.2 AI Strong cluster ops floors

| ID | Current | Recommended | Rationale |
|---:|--------:|------------:|-----------|
| **59** AI Control Validation | 3.75 (4/4/4/**3**) | **4.00** (4/4/4/**4**) | Ops acceptance floor |
| **61** Prompt Injection | 3.75 (4/4/4/**3**) | **4.00** (4/4/4/**4**) | Ops acceptance + safe canary path |
| **64** Model extraction resistance | 3.75 (4/4/4/**3**) | **4.00** (4/4/4/**4**) | Honesty API + multi-probe ops path |

Dim-point estimate: **+3** (one ops point each).

### 4.3 Combined arithmetic (if parent accepts all)

| Metric | Slice C | If all Slice D recs applied |
|--------|--------:|----------------------------:|
| Dimension points | 1444 | **~1455** (+11) |
| Score /100 | 76.8 | **~77.4** |
| Strict ≥4.0 | 71 | **74** (+59/61/64) |
| Strong+Leading | 79 | **79** (16/22 may enter Partial, not Strong) |

Exact gate recompute: update `docs/qa/analyst-scorecard.json` + `scripts/analyst-score-gate.mjs` floors in a follow-up rescore commit (pattern: Slice A/B/C).

---

## 5. Not claimed

- Full BAS / multi-vector peer parity  
- Live ransomware emulation  
- Live credential spray or agentless APT  
- Universal prompt-injection / jailbreak resistance  
- Model weight theft product capability  
- MQ/Wave progress or 95+ external readiness  

---

## 6. Commit scope

| Path | Role |
|------|------|
| `packages/shared/src/safety-equivalent-packs.ts` (+ test) | Inventory fields + scaffold core helpers |
| `apps/web/src/components/specialist-coverage-honesty.tsx` (+ test) | UI from shared; core strip |
| `apps/api/src/services/dns-exfil-canary-proof.test.ts` | Inventory assertion align |
| `tests/acceptance/slice-d-safety-ai-flow.test.ts` | Acceptance |
| `docs/qa/SLICE_D_SAFETY_AI.md` | This memo |

**Plane:** ops/Plane key not available in this agent environment (empty `OPS_*`); file/close issue when tailnet creds present.
