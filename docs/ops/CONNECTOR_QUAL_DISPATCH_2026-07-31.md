# Connector Production qualification — dispatch note (2026-07-31)

**Plane:** PERISCAN-467 — Design-partner Production connectors + live keys  
**Agent group:** G3  
**Goal:** Advance connector production qualification **without** marking
connectors Production-certified without real design-partner live-smoke receipts.

---

## Shipped this dispatch

### 1. Qualification harness (shared)

| Artifact | Purpose |
| --- | --- |
| `packages/shared/src/connector-production-qualification.ts` | Receipt Zod schema (v1), checklist automation, elevation gate, dry-run |
| `packages/shared/src/connector-production-qualification.test.ts` | Gate + dry-run unit tests |
| `scripts/connector-production-qual-dry-run.ts` | CLI: `pnpm connectors:qual:dry-run <key> [--receipt file]` |
| `package.json` script `connectors:qual:dry-run` | Operator entrypoint |

**Receipt required fields:** connectorKey, dateUtc, operator, periscanTenantId,
partnerVendorTenant, integrationId, authMethodUsed (no secrets), commitSha,
planeIssueRef, full checklist (health_probe, technique_observe, redaction,
rate_limits, tenant_isolation, audit) all **PASS**, plus honesty literals
`liveCredentialsUsed: true`, `mockMode: false`, `fixtureOnlyPath: false`.

**Gate:** `assertCanElevateToProduction` / `evaluateProductionElevation` —
incomplete or failing receipts → `Blocked` / `InvalidReceipt`; never
`EligibleForElevation`.

**Dry-run fail-closed:** missing live env keys → decision **`NotConfigured`**
(honest). Unknown connector keys stay NotConfigured (no invented key maps).
Keys present without receipt → `Blocked`. Does **not** call vendor APIs and
does **not** mutate catalog.

### 2. UI / docs honesty (0 Production)

- Integrations marketplace depth summary now includes
  `data-testid="integration-production-honesty"` and states
  **0 Production-certified** when no catalog entry has
  `availability: Production` or `certificationLevel: Certified`.
- `scripts/generate-integrations.ts` emits
  `summarizeCatalogProductionHonesty` into `docs/INTEGRATIONS.md` and
  `docs/integrations.json` (`hasAnyProductionCertified`,
  `productionHonestySummary`).
- Catalog honesty test still enforces **zero** Production/Certified manifests.

### 3. Runbook

- `docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md` §5 harness + §7 residual
  updated; elevation still blocked pending partner receipts.

---

## Explicit non-actions (Real-First)

- **Did not** set `productionCertified: true` on any connector.
- **Did not** set catalog `availability: "Production"` or
  `certificationLevel: "Certified"`.
- **Did not** invent design-partner credentials or smoke receipts.
- **Did not** claim live vendor API success from fixtures.

Current external-tier honesty remains: **Production = 0**; dedicated clients
**Beta**; Planned scaffolds **NotConnectable**.

---

## How to use (operators)

```bash
# Expect NotConfigured until real keys are in the environment
pnpm connectors:qual:dry-run crowdstrike

# After authorized live smoke + receipt JSON (see runbook §4.2)
pnpm connectors:qual:dry-run crowdstrike --receipt ./path/to/receipt.json

# Unit gates
pnpm --filter @periscan/shared exec vitest run src/connector-production-qualification.test.ts
pnpm --filter @periscan/connectors test -- catalog-production-honesty
```

Priority env maps (names only — never commit values):

| Connector | Env keys |
| --- | --- |
| crowdstrike | `CS_CLIENT_ID`, `CS_CLIENT_SECRET` |
| tenable | `TENABLE_ACCESS_KEY`, `TENABLE_SECRET_KEY` |
| wiz | `WIZ_CLIENT_ID`, `WIZ_CLIENT_SECRET` |
| ibm-qradar | `QRADAR_TOKEN`, `QRADAR_BASE_URL` |
| datadog-siem | `DATADOG_API_KEY`, `DATADOG_APP_KEY` |
| splunk | `SPLUNK_TOKEN`, `SPLUNK_BASE_URL` |
| okta | `OKTA_API_TOKEN`, `OKTA_DOMAIN` |

---

## Remaining for true Production elevation

These are **blocked on design-partner live work**, not on harness code:

1. **Authorized partner or scratch tenant** + read-only vendor credentials for
   each target (CrowdStrike, Wiz, Tenable, Datadog SIEM, IBM QRadar, …).
2. **Live smoke** per `docs/CONNECTOR_LIVE_SMOKE.md` (create → health → sync →
   observe where applicable).
3. **Complete checklist** (§2 of production qualification runbook) with all
   PASS and redaction / rate-limit / tenant-isolation / audit evidence.
4. **Plane receipt** on PERISCAN-467 (or per-connector child) — no secrets in
   issue body.
5. **Code elevation** only after `assertCanElevateToProduction(receipt)`:
   - catalog availability / certificationLevel for that key only
   - `buildProductionCertifiedOverrideFromReceipt` →
     `buildTop10ProductionCertBoard` overrides in generate-integrations
   - regenerate `docs/INTEGRATIONS.md` / `docs/integrations.json`
   - update honesty tests carefully so **other** connectors stay non-Production
6. **Plane Done** with commit SHA + evidence packet.

Until step 5 lands for a key, UI and docs must continue to show **0
Production-certified**.

---

## Verification performed this dispatch

- Shared package tests for qualification harness (gate + dry-run).
- Connectors catalog Production honesty still zero Production.
- Marketplace UI test: 0 Production-certified copy when Beta/Planned only.
- Dry-run CLI exits non-zero with NotConfigured when keys absent.

---

## Commits

See git log for this branch/worktree after land: harness + UI honesty +
dispatch note under PERISCAN-467.
