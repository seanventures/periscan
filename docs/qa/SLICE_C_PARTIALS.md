# Continuous loop Slice C — Partial / Scaffold product honesty

**Date:** 2026-08-01  
**Branch:** `overnight-loop`  
**Prior slice:** `docs/qa/SLICE_B_RESCORE_2026-08-01.md` (75.1 / 52 strict floors)  
**Scorecard edit:** **none** this slice (product + tests + honesty docs only)

## Goals

| # | Row | Goal | Status |
|---:|-----|------|--------|
| 23 | Dynamic Attack Paths | Confirm Slice B product path; residual is function/ops (not auto-replan) | **Done (Slice B)** — no further product change |
| 64 | Model Weight Extraction Tests | Multi-probe resistance suite + evidence honesty + UI + acceptance | **Done** |
| 65 | AI Kill-Switch Validation | Already Strong 4.0 | **Skip** (already ≥4) |
| 47 | Execution Integrity | Verifier-role honesty panel + API; host TEE refused | **Done** (Hardware residual remains) |
| 2 | Dark Web & Credential Monitoring | Partner honesty panel + inventory + enterprise readiness pin | **Done (honesty shell)** |
| 26 | OT/ICS Attack Packs | Partner honesty panel + inventory + enterprise readiness pin | **Done (honesty shell)** |
| 28 | Crowdsourced HITL | Partner honesty panel + inventory + enterprise readiness pin | **Done (honesty shell)** |
| 98 | Marketplace Interoperability | Connector-catalog honesty + NotConfigured residual acceptance | **Done (honesty)** |

## Forbidden (enforced)

- Invent live dark-web crawl / credential theft product
- Speak OT protocols or claim Validated OT without partner-lab
- Crowdsourced pentester marketplace theater
- Model weight / gradient / checkpoint recovery
- Host TEE / enclave workload claims (deny-list)
- Fabricate AWS Marketplace **Public** listing
- Edit `docs/qa/analyst-scorecard.json` without evidence-backed rescore

---

## 2 / 26 / 28 — Partner-gated honesty shells

### Shared inventory

`packages/shared/src/safety-equivalent-packs.ts` now includes Partner gate rows:

| ID | Requirement | claimClass | elevate? |
|---:|-------------|------------|----------|
| 2 | Dark Web & Credential Monitoring | forever_refuse | no |
| 26 | OT/ICS Attack Packs | forever_refuse | no (passive `ot_ics.protocol_exposure` only) |
| 28 | Crowdsourced Human-in-the-Loop | forever_refuse | no |

API: `GET /api/v1/safety-equivalent-packs` returns `partnerGatedScorecardIds: [2, 26, 28]`.

### Enterprise readiness pins

`apps/api/src/services/enterprise-readiness.ts` pack descriptions cite scorecard **#2 / #26 / #28** and stay **ExternallyGated**.

### UI

- `SpecialistCoverageHonesty` — partner honesty strip + `data-testid=specialist-scaffold-row-{id}` with `data-gate=Partner`
- Mounted on `/engines` and compact on Continuous hub

---

## 64 — Model Weight Extraction Tests (resistance only)

### Product path

1. Multi-probe corpus in `packages/modules` `createBoundedAIInput` for `ModelExtractionResistance`:
   - fingerprint_hold · rate_limit · excessive_detail · consistency · weight_refuse  
2. Evidence attributes always pin:
   - `weightExtractionAttempted: false`
   - `modelWeightRecovery: false`
   - `suiteId: ai.model-extraction-resistance.safe` when category is ModelExtractionResistance  
3. Shared honesty contract: `packages/shared/src/model-extraction-resistance.ts`  
4. API: `GET /api/v1/model-extraction-resistance/honesty`  
5. UI: `data-testid=model-extraction-honesty-panel` when suite selected (AI apps workbench; 5-request budget)

### Honesty

This is an **abuse-resistance control test**, not model-weight extraction. High-volume campaigns and production-scale extraction claims remain refused.

---

## 47 — Execution Integrity

### Product honesty

`packages/shared/src/execution-integrity-honesty.ts` +  
`GET /api/v1/execution-integrity/honesty`

| Surface | State |
|---------|-------|
| Evidence content integrity | Available |
| Flight-recorder chain | Available |
| Agent signed receipts | Available |
| Customer TEE verifier (Veraison) | PartnerHardware |
| Host workloads in TEE/enclave | **Refused** |

UI: `data-testid=execution-integrity-honesty-panel` on Agent Trust console.

Hardware residual (partner/lab qualification of customer-supplied TEE evidence) remains — do not score Leading.

---

## 98 — Marketplace Interoperability honesty

- Integrations catalog panel: `data-testid=marketplace-interoperability-honesty-panel`  
  — connector catalog ≠ public AWS listing  
- Status API residual (from Slice B): bare env → `listingState: NotConfigured`; never invent Public  

---

## 23 / 65

| ID | Note |
|---:|------|
| 23 | Slice B shipped path-scoped next mission + human approve Draft-only. Product dim already 4. Residual: measured adaptive replan loop (function/ops), not honesty panels. |
| 65 | Slice B AI kill-switch Strong 4.0 — no Slice C work. |

---

## Tests

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"

# Unit
pnpm --filter @periscan/shared exec vitest run \
  src/safety-equivalent-packs.test.ts \
  src/execution-integrity-honesty.test.ts \
  src/model-extraction-resistance.test.ts
pnpm --filter @periscan/api exec vitest run src/services/enterprise-readiness.test.ts
pnpm --filter @periscan/web exec vitest run \
  src/components/specialist-coverage-honesty.test.tsx \
  src/components/integrations-marketplace.test.tsx \
  src/components/agent-trust-console.test.tsx

# Acceptance
pnpm exec vitest run tests/acceptance/slice-c-partials-honesty-flow.test.ts
```

### Green evidence (this slice)

| Suite | Result |
|-------|--------|
| shared safety + integrity + model-extraction unit | pass |
| enterprise-readiness unit | pass |
| web specialist / marketplace / agent-trust unit | pass |
| `slice-c-partials-honesty-flow` acceptance (4 cases) | **pass** |

---

## Recommended scorecard deltas (do **not** auto-apply)

Apply only after a formal rescore agent reviews green acceptance.

| ID | Current (approx) | Suggested ceiling after Slice C | Cap |
|---:|------------------|----------------------------------|-----|
| 2 | 1.75 Scaffold | product 3 / function 2 / ux 3 / ops 2 → **~2.5** | Partner: never Leading; no live feed |
| 26 | 1.75 Scaffold | product 3 / function 2 / ux 3 / ops 2 → **~2.5** | Partner-lab; no protocol speak |
| 28 | 1.5 Scaffold | product 3 / function 2 / ux 3 / ops 2 → **~2.5** | No crowd marketplace |
| 47 | 3.75 Partial | product 4 / function 4 / ux 4 / ops 4 → **4.0** if ops evidence cited | Hardware residual; host TEE refused |
| 64 | 3.0 Partial | product 4 / function 4 / ux 4 / ops 3 → **3.75–4.0** | SafetyEquivalent; not weight theft |
| 98 | 2.75 Scaffold | product 3 / function 3 / ux 3 / ops 3 → **3.0** | NotConfigured until Public proven |
| 23 | 3.5 Partial | hold or +function if lab proves next-mission path | Not autonomous replan |
| 65 | 4.0 Strong | hold | — |

---

## Implementation map

| Layer | Path |
|-------|------|
| Partner + safety packs | `packages/shared/src/safety-equivalent-packs.ts` |
| Execution integrity honesty | `packages/shared/src/execution-integrity-honesty.ts` |
| Model extraction honesty | `packages/shared/src/model-extraction-resistance.ts` |
| Multi-probe suite | `packages/modules/src/index.ts` (`createBoundedAIInput`, evidence attrs) |
| Validation catalog copy | `packages/shared/src/validation-catalog.ts` |
| Enterprise readiness | `apps/api/src/services/enterprise-readiness.ts` |
| Service methods | `apps/api/src/services/control-ai.ts` |
| Routes | `GET /api/v1/execution-integrity/honesty`, `GET /api/v1/model-extraction-resistance/honesty` |
| UI partner | `apps/web/src/components/specialist-coverage-honesty.tsx` |
| UI model extraction | `apps/web/src/components/ai-apps-workbench.tsx` |
| UI execution integrity | `apps/web/src/components/agent-trust-console.tsx` |
| UI marketplace | `apps/web/src/components/integrations-marketplace.tsx` |
| Acceptance | `tests/acceptance/slice-c-partials-honesty-flow.test.ts` |

## Not claimed

- Partner dark-web feed, OT Validated packs, or crowd HITL network  
- Model weight theft or high-volume extraction campaigns  
- Host confidential compute / TEE hosting  
- Public AWS Marketplace listing without ops attestation  
- Scorecard point lifts (rescore is a subsequent continuous-loop step)
