# Analyst execution evidence — wave 1

> **Historical evidence only.** The score counts in this document were produced
> against the retired mixed 110-row source matrix. The canonical product scope
> is now the 94-row ASV/CTEM scorecard and
> `ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`. This file remains only because retained
> core requirements cite the implementation evidence recorded here.

**Executed:** 2026-07-15
**Scope:** score governance, EASM ownership review, source qualification,
virtual-analyst workflow evaluation, Palo Alto Cortex XSIAM, help/demo
validation, and the complete release gate

## Outcome

This wave moved the evidence-based score from **1,631/2,200 (74.1)** to
**1,644/2,200 (74.7)**. Strong/Leading classifications moved from **87/110**
to **89/110**, while rows meeting the plan's stricter 4.0 floor moved from
**47/110** to **50/110**. The 2,090/2,200 target remains unchanged. No points
were added for customer qualification, independent analyst review,
marketplace availability, partner contracts, confidential-compute hardware,
or production-scale SLOs that were not actually available during this wave.

| Row | Requirement                        | Before | After | Evidence-based reason                                                                                                                                                                                                                                                                                                                                                           |
| --: | ---------------------------------- | -----: | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | External Attack Surface Management |   3.50 |  4.00 | Added a persisted, role-gated, audited candidate-review decision that cannot expand verified scope; added current source-quality/freshness qualification and browser-validated candidate UX. Product breadth remains 4 because CT/RDAP/WHOIS/ASN pivots are not all implemented.                                                                                                |
|  20 | Continually Updated Threat Library |   3.25 |  4.00 | Fresh reconciliation found the audit was stale: scheduled feeds now combine with persisted, versioned, tenant-signed scenario DAGs, ATT&CK/source/SBOM metadata, approval, exact-preview execution, branch-evidence recording, tamper rejection, UI lifecycle, and acceptance proof. Operations remains 3 until curated promotion/deprecation and external qualification exist. |
|  32 | Virtual Security Analyst           |   3.50 |  4.00 | Added a deterministic run-quality evaluator for recorder integrity, step coverage, evidence grounding, tool/policy traceability, model identity, and incomplete-run findings; exposed it through the API and flight-recorder UI with tamper acceptance coverage. No customer outcome study was claimed.                                                                         |
|  73 | Palo Alto XSIAM Integration        |   2.25 |  3.75 | Added a dedicated, connectable XSIAM manifest and read-only incident adapter using the documented incident endpoint, authorization headers, MITRE/host normalization, control observation, asset sync, health, and secret-leak contract tests. It remains below 4.0 until qualified against a customer XSIAM tenant.                                                            |

The unified data-fabric row (66) remains 4.75 rather than being inflated:
this wave materially strengthened its source-quality UI and operational
evidence, but external qualification is still needed for a 5.0 operations
score.

## Product evidence delivered

- `docs/qa/analyst-scorecard.json` is the 110-row machine-readable current and
  target ledger. `pnpm analyst:score:check` validates row coverage, score math,
  accountable roles, known dependencies, evidence paths, and the exact 95.0
  target distribution.
- Ownership reviews are stored in `AssetOwnershipReview`, tenant-isolated by
  RLS, upserted only for unattributed internet-facing candidates, and audited
  as `asset_ownership_reviewed`. Review decisions never create or verify a
  scope and are rejected after a candidate becomes attributed.
- The data-fabric quality surface derives Qualified, Degraded, Stale,
  PendingFirstSync, and Disconnected from persisted integration state, health,
  sync age/frequency budget, asset observations, and normalized signals. It
  explicitly does not present source health as blanket vendor-feature proof.
- Workflow evaluation is deterministic and evidence-driven. Broken recorder
  chains produce IntegrityFailure; incomplete steps, ungrounded claims,
  tool/policy gaps, missing model identity, and incomplete runs remain visible
  findings rather than being rounded into a success score.
- The XSIAM adapter uses the read-only
  `/public_api/v1/incidents/get_incidents` contract with `Authorization` and
  `x-xdr-auth-id`, emits redacted XSIAM-specific signal types, maps MITRE
  technique IDs and affected-host hints, and never returns configured secrets.
- The demo bootstrap now assigns the supported `safe-baseline` external
  validation profile, fixing a live `pnpm seed:demo` failure found during the
  walkthrough.
- Dashboard help now instructs operators to open the highest-ranked work item,
  starting with Now when present and then Soon. This replaces an invalid
  assumption that every tenant always has a Now item.

## Browser validation

The seeded local product was exercised through its rendered UI:

1. Signed out an existing tenant and selected **Use demo login**.
2. Completed all six isolated demo stops: Start here, Attack path, Control
   proof, Smallest fix, Re-test, and Deliver proof. The UI remained explicitly
   sample-only and did not create a customer session or claim live execution.
3. Signed into the seeded demo tenant and followed dashboard help to Findings.
4. Selected **Priority · unowned**, opened a finding, read proof/scoring/evidence
   context, recorded an Acknowledged disposition, and verified the saved value.
5. Opened Data Fabric, confirmed 4/4 sources qualified from current normalized
   output, opened contextual help, selected an unattributed candidate, recorded
   **Request verification**, and verified the UI said authorized scope had not
   changed.
6. Reseeded the deterministic demo tenant after the write-path checks.

## Automated validation

`pnpm verify` passed against PostgreSQL on port 5434 with all 126 migrations
deployed:

- lint and TypeScript checks across the workspace;
- production builds, including 53 web routes;
- 205 unit/component test files and 1,400 tests across workspace packages;
- connector contracts: 41 files / 293 tests, including XSIAM;
- browser E2E: 94/94, including isolated demo mode, mobile geometry, route
  accessibility, contextual help, shell navigation, and the first-customer
  proof loop;
- security boundary: 25/25;
- database-backed acceptance: 130 files / 167 tests;
- Prisma validation, migration deploy, and 83-enum drift gate;
- PRD audit: 42/42 source rows evidence-mapped and 203/203 requirement atoms
  implemented under the repository's PRD rubric;
- dependency audit: no high-or-higher installed advisory and no moderate-or-
  higher production advisory.

The toolchain check still honestly reports the planned `ctf-pack` and
`periscan-ot-ics-pack` as unavailable. They are not treated as installed or
qualified.

## Superseded planning context

The remaining-work counts below no longer govern product planning because they
included adjacent infrastructure and commercial requirements. Current gaps,
owners, score math, and execution order are defined only by the 94-row
scorecard and canonical ASV/CTEM plan.
