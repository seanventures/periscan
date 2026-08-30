# Swarm S3 — Compliance evidence-support E2E (not certification)

**Date:** 2026-07-31  
**Branch:** `overnight-loop`  
**Charter:** Finish compliance evidence-support E2E for regulated-buyer packs without claiming certification or inventing Met status.

## Goals

| # | Goal | Status |
| --- | --- | --- |
| 1 | Expand DORA / NIS2 / PCI catalogs only with **real** measured evidence kinds already in product | **Done** |
| 2 | Full E2E: snapshot with evidence → Met/Partial/Unmet derive → govern owner/exception → export PDF/HTML with disclaimer → evidence deep-links | **Done** |
| 3 | Acceptance coverage: export disclaimer + Met only when evidence present | **Done** |
| 4 | This report | **Done** |

## Forbidden (still enforced)

- Claim certification, formal SOC 2 Type II / PCI attestation, or audit opinion from Periscan alone
- Invent **Met** without measured evidence kinds present
- Remove `COMPLIANCE_PACK_DISCLAIMER` / partial-catalog honesty from UI, HTML, or PDF

## Catalog expansion (representative, partial)

Source of truth: `packages/reports/src/compliance-catalog.ts`  
Catalog version for wave-priority packs: **`periscan-2026.07.s3`**

| Framework | New controls (Swarm S3) | Evidence kinds (existing only) |
| --- | --- | --- |
| **DORA** | Art. 8 Protection/prevention; Art. 10 Detection; Art. 13 Learning and evolving | measured-exposure, fix-verification, control-detection, continuous-validation, attack-path |
| **NIS2** | Art. 21(2)(c) Business continuity; 21(2)(d) Supply chain; 21(2)(e) Network/system security | same set |
| **PCI DSS** | Req. 6.3 Secure software; Req. 11.5.1 Change-detection; Req. 2.2 Configuration standards | same set |

All three frameworks retain **(partial)** in `displayName`. Coverage remains derived: **Met** only when every `evidencedBy` kind is present on the snapshot (plus optional continuous-validation / evidence-integrity options).

### Measured evidence kinds (product primitives)

```
measured-exposure-validation
control-detection-validation
fix-verification
ai-control-validation
attack-path-analysis
continuous-validation
evidence-integrity
```

No new kinds were invented for this swarm.

## E2E path

Acceptance test: `tests/acceptance/compliance-evidence-support-e2e-flow.test.ts`

```
signup + billing package
  → create Domain scope + devMode verify
  → POST /api/v1/snapshots  (real evidence IDs)
  → computeSnapshotComplianceTrace (empty strip → all Unmet; full snapshot → honest Met/Partial/Unmet)
  → POST /api/v1/compliance/governance  (owner + exception + InReview)
  → POST /api/v1/reports { packType: DORAAttestation }
  → export HTML + PDF  (must contain COMPLIANCE_PACK_DISCLAIMER)
  → also export NIS2 + PCI packs (disclaimer + partial)
  → GET /api/v1/evidence/:id for pack evidence IDs (deep-link target)
  → other tenant 404 on same evidence id
```

Companion coverage:

- `tests/acceptance/compliance-governance-flow.test.ts` — catalog version + owner/exception/sign-off history
- `packages/reports/src/compliance-catalog.test.ts` — Met-only-with-evidence, expansions, disclaimers
- `packages/reports/src/index.test.ts` — HTML/PDF disclaimer on all `*Attestation` packs
- `apps/web/src/components/compliance-workbench.test.tsx` — UI banner, `/evidence?q=` deep-links, export CTA

## UI deep-links

Workbench (`apps/web/src/components/compliance-workbench.tsx`) links control evidence IDs to:

```
/evidence?q=<evidenceId>
```

API deep-link for the same IDs:

```
GET /api/v1/evidence/:id
```

Reports embed evidence IDs in the control-trace table (HTML/PDF) for auditor follow-up; they do not assert certification.

## How to run

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
# compose up if needed
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"

pnpm --filter @periscan/reports test
pnpm test:acceptance -- compliance-evidence-support-e2e-flow
pnpm test:acceptance -- compliance-governance-flow
```

## Files touched

- `packages/reports/src/compliance-catalog.ts`
- `packages/reports/src/compliance-catalog.test.ts`
- `tests/acceptance/compliance-governance-flow.test.ts`
- `tests/acceptance/compliance-evidence-support-e2e-flow.test.ts` *(new)*
- `docs/qa/E2E_SWARM_S3_COMPLIANCE.md` *(this file)*

## Residual

- SEC / GDPR / EU AI Act packs remain thinner (~2 controls) — deepen only when real evidence kinds map cleanly
- Program-complete framework catalogs are **out of scope**; Partial honesty stays
- Scorecard / GTM must continue to refuse “Leading compliance certification” language
- Live continuous-validation kind still requires an active schedule last-run tied to the snapshot (optional input), not invented by the pack renderer
