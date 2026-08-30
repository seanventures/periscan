# Continuous loop Slice B — IaC, ITSM, compliance catalogs, marketplace honesty

**Date:** 2026-08-01  
**Branch:** `overnight-loop`  
**Prior slice:** `docs/qa/SLICE_A_RESCORE_2026-08-01.md` (73.6 / 45 strict floors)

## Goals

| # | Goal | Status |
| --- | --- | --- |
| 70 | IaC: real PR issue comment + optional GitHub file suggestion path; never silent push to main | **Done** |
| 71 | ITSM/SOAR depth | **Already 4.0 Strong** (S6 E2E) — no product change this slice |
| 81–88 | Expand SEC / HIPAA / ISO 27001 / GDPR / EU AI Act / ISO 42001 catalogs (existing evidence kinds only; Partial honesty) | **Done** |
| 98 | Marketplace NotConfigured honesty E2E; never invent Public listing | **Done** |
| — | This report | **Done** |

## Forbidden (still enforced)

- Certification / formal attestation claims from Periscan alone
- Inventing **Met** without measured evidence kinds
- Silent merge/push to default branch for IaC
- Fabricated AWS Marketplace **Public** listing without ops attestation

---

## 70 — Infrastructure-as-Code Updates

### Product path (already present + Slice B depth)

Source: `apps/api/src/services/infrastructure-changes.ts`

1. Preview exact file before/after + unified diff + preview hash  
2. Human approve with matching hash  
3. Execute: create branch → commit file → open PR (**never merges**)  
4. **Slice B:** post a **real PR issue comment** with remediation id, preview hash, and exact diff excerpt  
5. **Slice B (optional):** when the changed span is contiguous and ≤ `IAC_SUGGESTION_MAX_LINES` (40), post a GitHub **review comment** with a ```` ```suggestion` ```` block for reviewer accept-in-UI  
6. Refresh CI / merge state; merge → `MergedAwaitingVerification` (Fixed only via measured revalidation)  
7. Rollback closes unmerged PR + deletes branch  

Helpers (unit-tested):

- `buildInfrastructurePullRequestIssueComment`
- `buildInfrastructureFileSuggestion`
- `buildInfrastructureUnifiedDiff` / `findUnsafeInfrastructureContent`

Receipt fields: `issueCommentId`, `suggestionPosted`, `suggestionCommentId`.

### Tests

```bash
pnpm --filter @periscan/api test -- infrastructure-changes
pnpm test:acceptance -- infrastructure-change-pull-request-flow
```

Acceptance asserts:

- Issue comments contain ` ```diff ` and Fixed/merge gates  
- Review comments contain ` ```suggestion ` and never call merge APIs  
- No push to `refs/heads/main`

### Honesty note

Scorecard still may lag until a formal rescore: product is no longer “static hint only.” Export-only Terraform locals in `generateReviewableRemediationTemplates` remain review-only exports; the governed path is the PR loop above.

---

## 71 — ITSM/SOAR Automation

**Already Strong 4.0** (`docs/qa/analyst-scorecard.json`, evidence `E2E_SWARM_S6_PLATFORM.md`).

- Ticket create → `InProgress` + `verificationRequired`  
- External ticket close → `ClosedWithoutEvidence` (never Fixed)  
- Jira / ServiceNow / GitHub Issues / PagerDuty acceptance flows exist  

No Slice B code change. Residual to 5.0 is deeper live SOAR playbooks / partner qual — out of honesty ceiling for this slice.

---

## 81–88 — Compliance catalog expansion (Partial)

Source: `packages/reports/src/compliance-catalog.ts`  
Catalog version for Slice B packs: **`periscan-2026.08.slice-b`**

| Framework (rows) | New controls (representative) | Evidence kinds (existing only) |
| --- | --- | --- |
| **SEC** (85) | Item 106(c) Governance; Item 1.05 detection support; expanded risk assessment | measured-exposure, continuous, fix-verification, control-detection, evidence-integrity, attack-path |
| **HIPAA** (87) | §164.308(a)(6) response; §164.312(a)(1) access; §164.312(c)(1) integrity; risk management | same set |
| **ISO 27001** (88) | A.8.7 malware; A.5.26 incident response; A.8.15 logging; A.8.9 configuration | same set |
| **GDPR** (89*) | Art. 32(1)(c) restore; Art. 32(2) risk; Art. 5(1)(f) integrity | same set |
| **EU AI Act** (81) | Art. 14 oversight; Art. 12 record-keeping; Art. 15(5) cybersecurity | + ai-control-validation |
| **ISO 42001** (82) | A.6.1.2 risk; A.8.4 performance; A.9.2 internal audit support | + ai-control-validation |

\*GDPR also appears as a pack type supporting related scorecard/compliance surfaces; packs remain **evidence support**, not certification.

All retain **(partial)** in `displayName`. `COMPLIANCE_PACK_DISCLAIMER` unchanged.

DORA / NIS2 / PCI stay on Swarm S3 version `periscan-2026.07.s3`.

### Tests

```bash
pnpm --filter @periscan/reports test -- compliance-catalog
```

---

## 98 — Marketplace Interoperability honesty

### Product honesty (unchanged core + deeper E2E)

- `resolveAwsMarketplaceListingState` / `awsMarketplaceConfigFromEnv`  
  - No product code → **NotConfigured**  
  - `LISTING_STATE=Public` without `PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN=true` → **IntegrationReady** (never invent Public)  
- Status API exposes `listingState` + `publicMarketplaceAvailabilityProven`

### Tests

```bash
pnpm --filter @periscan/api test -- aws-marketplace.config
pnpm --filter @periscan/shared test -- aws-marketplace.honesty
pnpm test:acceptance -- aws-marketplace-saas-flow
```

New acceptance case: env bare → API **NotConfigured**; Public-without-proof config → API **IntegrationReady**; register fails closed when NotConfigured.

---

## How to re-run Slice B gates

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
# docker compose -f infra/docker-compose/docker-compose.yml up -d
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"

pnpm --filter @periscan/api test -- infrastructure-changes
pnpm --filter @periscan/reports test -- compliance-catalog
pnpm --filter @periscan/api test -- aws-marketplace.config
pnpm test:acceptance -- infrastructure-change-pull-request-flow
pnpm test:acceptance -- aws-marketplace-saas-flow
```

## Rescore note

This slice ships **product + tests + honesty docs**. Formal analyst scorecard rescore (points / floors) is a subsequent continuous-loop step after evidence review — do not invent Leading on row 70/98 without the gate.
