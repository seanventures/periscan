# Continuous loop Slice D — Compliance, Choke, Partner residual

**Date:** 2026-08-02  
**Branch:** `main` (workspace)  
**Prior slice:** `docs/qa/SLICE_C_RESCORE_2026-08-01.md` (76.8 / 71 strict floors)  
**Scorecard edit:** **none** this slice (product + tests + honesty docs only)

## Goals

| # | Row | Goal | Status |
|---:|-----|------|--------|
| 80 | Automated Compliance Attestations | Deepen governance sign-off + multi-framework export E2E; **score &lt; 4** | **Done** |
| 4 | Choke Point Analysis | API acceptance for honesty methodology string; **score &lt; 4** | **Done** |
| 2 | Dark Web & Credential Monitoring | Partner residual honesty completeness | **Done** |
| 26 | OT/ICS Attack Packs | Partner residual honesty completeness | **Done** |
| 28 | Crowdsourced HITL | Partner residual honesty completeness | **Done** |
| 38 | A2A Artifact Exchange | Honesty inventory + UI residual pin | **Done** |
| 51 | AgentDID Integration | Honesty inventory + UI residual pin | **Done** |
| — | This report | `docs/qa/SLICE_D_COMPLIANCE_CHOKE_PARTNER.md` | **Done** |

## Forbidden (enforced)

- Score ≥ 4 on **#4** or **#80** (no min-cut solver; no program-complete catalogs)
- Certification / formal audit-opinion language from Periscan alone
- Invent **Met** without measured evidence kinds
- Invent live dark-web crawl, OT protocol speak, crowdsourced HITL marketplace
- Invent partners or Leading A2A/AgentDID joint-customer claims without proof
- Edit `docs/qa/analyst-scorecard.json` without evidence-backed rescore

---

## 80 — Automated Compliance Attestations (deepen, cap &lt; 4)

### Product depth

| Surface | Behavior |
|--------|----------|
| `GET /api/v1/compliance/governance/summary` | Multi-framework rollup; `notCertification: true`, `scorecardId: 80`, every framework `partialCatalog: true` |
| `POST /api/v1/compliance/governance/batch` | Batch owner/exception/sign-off; **Approved requires** `notCertificationAcknowledged: true` + owner + review notes |
| Single-control approve | **Approved requires accountable owner** (schema superRefine) |
| `POST /api/v1/compliance/exports/multi-framework` | One snapshot → N framework packs; response carries disclaimer + governance approved/total |
| UI | Multi-framework summary strip + “Export DORA+NIS2+PCI packs” CTA |

### Honesty

Catalogs remain **partial**. Packs are **customer evidence-support only** — not certification, not audit opinion. Scorecard #80 stays **&lt; 4** until program-complete catalogs exist.

### Tests

```bash
pnpm exec vitest run tests/acceptance/slice-d-compliance-choke-partner-flow.test.ts
# also retains Swarm S3 / governance flows:
pnpm exec vitest run tests/acceptance/compliance-evidence-support-e2e-flow.test.ts
pnpm exec vitest run tests/acceptance/compliance-governance-flow.test.ts
```

---

## 4 — Choke Point Analysis (honesty methodology acceptance)

### Product

`GET /api/v1/attack-paths/choke-points` already used evidence-weighted greedy hitting-set. Slice D adds:

| Field | Value |
|-------|--------|
| `methodology` | **literal** `GreedyHittingSetApproximation` |
| `honestyNote` | Stable pin: evidence-weighted breakers only; **not** min-cut / Leading; scorecard #4 stays &lt;4 / Partial |
| `assumptions[]` | Explicit XM-class / max-flow / Partial / revalidation language |

### Acceptance

`tests/acceptance/slice-d-compliance-choke-partner-flow.test.ts` asserts methodology string + honestyNote + assumptions on empty graph and seeded path.

**Gate preserved:** scorecard **currentScore must stay &lt; 4** until a real graph-wide min-cut/dominator solver ships.

---

## 2 / 26 / 28 / 38 / 51 — Partner residual polish

### Shared inventory

`packages/shared/src/partner-capability-honesty.ts` → `buildPartnerCapabilityHonesty()`

| ID | Requirement | Gate | State |
|---:|-------------|------|-------|
| 2 | Dark Web & Credential Monitoring | Partner | ExternallyGated |
| 26 | OT/ICS Attack Packs | Partner | ExternallyGated |
| 28 | Crowdsourced HITL | Partner | ExternallyGated |
| 38 | A2A Artifact Exchange | ProductWithPartnerResidual | AvailableWithHonesty |
| 51 | AgentDID Integration | ProductWithPartnerResidual | AvailableWithHonesty |

API: `GET /api/v1/partner-capabilities/honesty`

Cross-check retained:

- `GET /api/v1/safety-equivalent-packs` → `partnerGatedScorecardIds: [2,26,28]`
- Enterprise readiness packs `credential-exposure` / `ot-ics` / `human-validation` stay **ExternallyGated**

### UI

- Specialist coverage strip cites partner-capabilities honesty endpoint
- Agent Trust console: `data-testid="partner-capability-honesty-panel"` for #2/#26/#28/#38/#51

---

## Implementation map

| Layer | Path |
|-------|------|
| Schemas | `packages/shared/src/domain.ts` (batch/summary/multi-export + choke `honestyNote`) |
| Partner honesty | `packages/shared/src/partner-capability-honesty.ts` |
| Compliance services | `apps/api/src/services/compliance-governance.ts` |
| Choke response | `apps/api/src/services/findings.ts` |
| Partner route service | `apps/api/src/services/control-ai.ts` |
| Routes | `apps/api/src/app.ts` |
| OpenAPI payloads | `apps/api/src/openapi-payloads.ts` |
| Web client | `apps/web/src/lib/periscan-api-client.ts` |
| Compliance UI | `apps/web/src/components/compliance-workbench.tsx` |
| Agent Trust UI | `apps/web/src/components/agent-trust-console.tsx` |
| Specialist UI | `apps/web/src/components/specialist-coverage-honesty.tsx` |
| Acceptance | `tests/acceptance/slice-d-compliance-choke-partner-flow.test.ts` |

## Tests (how to run)

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
# docker compose -f infra/docker-compose/docker-compose.yml up -d
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"

# Unit
pnpm --filter @periscan/shared exec vitest run \
  src/partner-capability-honesty.test.ts
pnpm --filter @periscan/web exec vitest run \
  src/components/compliance-workbench.test.tsx \
  src/components/specialist-coverage-honesty.test.tsx \
  src/components/agent-trust-console.test.tsx

# Acceptance
pnpm exec vitest run tests/acceptance/slice-d-compliance-choke-partner-flow.test.ts
```

## Recommended scorecard deltas (do **not** auto-apply)

Apply only after a formal rescore agent reviews green acceptance.

| ID | Current | Suggested ceiling after Slice D | Cap |
|---:|---------|----------------------------------|-----|
| 80 | 3.25 Scaffold/gated | product 4 / function 3–4 / ux 4 / ops 3 → **~3.5–3.75** | **&lt; 4** without program-complete catalogs |
| 4 | 3.25 Partial | product 4 / function 3–4 / ux 3–4 / ops 3 → **~3.5 max** | **&lt; 4** without min-cut solver |
| 2 | 2.5 Scaffold | hold ~2.5–2.75 | Partner forever without feed |
| 26 | 2.5 Scaffold | hold ~2.5–2.75 | Partner-lab |
| 28 | 2.5 Scaffold | hold ~2.5–2.75 | No crowd marketplace |
| 38 | 3.5 Strong | hold or +ux if panel cited | Partner residual on Leading |
| 51 | 3.75 Strong | hold | Federation residual |

## Not claimed

- Program-complete compliance certification catalogs  
- Exact global min-cut / XM Cyber choke parity  
- Live dark-web credential product  
- Validated OT attack packs  
- Crowdsourced pentester marketplace  
- Leading A2A multi-vendor interchange without joint customer proof  
- Scorecard point lifts (rescore is a subsequent continuous-loop step)
