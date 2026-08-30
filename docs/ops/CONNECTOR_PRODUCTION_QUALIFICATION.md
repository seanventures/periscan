# Connector Production Qualification Runbook

Operator and design-partner runbook for elevating a connector from **Beta**
(dedicated live client, connectable with credentials) to **Production**
(customer-credential live-smoke certified).

This document is the **qualification gate**. It does **not** elevate any
catalog entry. Fixture contract tests, recorded payloads, and mock observers
are **never** sufficient for Production.

Companion docs:

| Doc | Role |
| --- | --- |
| [`docs/CONNECTOR_LIVE_SMOKE.md`](../CONNECTOR_LIVE_SMOKE.md) | How to run live create → health → sync → observe against a vendor API |
| [`docs/INTEGRATIONS.md`](../INTEGRATIONS.md) | Generated catalog honesty table (Production / Beta / Planned counts) |
| [`SECURITY_BOUNDARIES.md`](../../SECURITY_BOUNDARIES.md) | Read-only, authorized-scope, no destructive actions |
| [`docs/ops/PLANE.md`](PLANE.md) | Plane is the system of record for evidence and state |

---

## 1. Current honesty (do not invent Production)

As of catalog generation (`scripts/generate-integrations.ts` / Wave F honesty):

| External tier | Count | Meaning |
| --- | ---: | --- |
| **Production** | **0** | Customer-credential live-smoke certified |
| **Beta** (`ReadyForCredentials`) | **126** | Dedicated live client; connectable with credentials; **not** Production-certified |
| **Planned** (`NotConnectable`) | **141** | Catalog / StandardizedCatalog scaffolds only — **not connectable** |

Total catalog ≈ **267** (126 + 141). The contract-tested subset (recorded
fixtures in CI) remains a **Beta** honesty signal (`ContractTestedOnly` on the
top-10 cert board) — **not** Production.

**Hard rule:** Do **not** elevate any connector’s catalog `availability` to
`Production`, set `certificationLevel: Certified`, or pass
`productionCertified: true` into
`resolveExternalIntegrationTier` /
`buildTop10ProductionCertBoard` **without live partner smoke evidence**
documented in Plane (see §4).

Enforced by tests:

- `packages/connectors/src/catalog-production-honesty.test.ts` — zero
  Production / Certified in catalog; Planned / StandardizedCatalog stay
  `NotConnectable`; ReadyForCredentials only on dedicated connectable clients
- `packages/shared/src/integration-external-tiers.test.ts` — external tier
  never mints Production without `productionCertified: true`
- API create path requires `executionReadiness === "ReadyForCredentials"` and
  `connectable` (Planned scaffolds cannot receive live credentials)

---

## 2. Design-partner Production checklist (priority connectors)

Primary residual targets for design-partner Production cert (Wave F / PERISCAN-467):

| Connector key | Product | Stack | Typical cert board status today |
| --- | --- | --- | --- |
| `crowdstrike` | CrowdStrike Falcon | EDR | Beta / ContractTestedOnly |
| `wiz` | Wiz | CNAPP | Beta / NotCertified |
| `tenable` | Tenable | CNAPP | Beta / ContractTestedOnly |
| `datadog-siem` | Datadog Cloud SIEM | SIEM | Beta (dedicated client) |
| `ibm-qradar` | IBM QRadar | SIEM | Beta / contract-tested path |

Use the same checklist for any other Beta connector before elevation. Every
item is **required**. Partial success stays **Beta**.

### 2.1 Health probe (live vendor API)

- [ ] Integration created with **live** auth (not `mock` / not `mockMode`)
- [ ] `GET /api/v1/integrations/:id/health` returns `health.status: "Healthy"`
- [ ] Health uses the connector’s real `healthCheckMethod` against the partner
      tenant (token validate, server info, incidents list, etc.)
- [ ] Failure path returns `Unhealthy` / `Degraded` without leaking secrets in
      response body or logs
- [ ] Procedure follows [`docs/CONNECTOR_LIVE_SMOKE.md`](../CONNECTOR_LIVE_SMOKE.md)
      (scratch or authorized partner tenant only)

### 2.2 Technique observe (control / signal observation)

- [ ] Sync (`POST …/integrations/:id/sync`) returns normalized signals or an
      honest empty result — no fixture-only “Validated” theater
- [ ] Where the connector is a **control observer**, run an authorized
      control-validation / observe path and record the outcome class
      (`Detected` / `Blocked` / `Logged` / `NoEvidence` / etc.)
- [ ] Technique / ATT&CK context (if claimed) is populated from real vendor
      fields or honestly omitted — never invented from mocks in Production cert
- [ ] Observer never writes, isolates, remediates, or changes vendor policy

### 2.3 Redaction

- [ ] Secret config fields (API keys, client secrets, tokens) are **not**
      returned on `GET` integration read
- [ ] Health / sync / error payloads never echo raw credentials
- [ ] Evidence / signal bodies redacted per connector `dataSensitivity` and
      shared redaction rules (`RedactionStatus` / evidence package policy)
- [ ] Operator can confirm redaction by inspecting a sample evidence item and
      API responses from the smoke run

### 2.4 Rate limits

- [ ] Connector respects vendor rate limits (backoff / retry with jitter where
      implemented; no tight loops on 429)
- [ ] Smoke run does not hammer production partner tenants (use bounded
      windows, small page sizes, disposable scratch where possible)
- [ ] Document observed throttle behavior (429 / Retry-After) in the Plane
      evidence note if encountered

### 2.5 Tenant isolation

- [ ] Integration is bound to a single Periscan tenant; API key / session from
      tenant A cannot read tenant B’s integration or evidence
- [ ] Vendor credential for partner tenant A is never used for partner tenant B
- [ ] No cross-tenant cache bleed on health/sync results
- [ ] Multi-tenant design-partner runs use separate Periscan tenants and
      separate vendor credentials

### 2.6 Audit

- [ ] `integration.connected` (or equivalent) audit event on create
- [ ] Health / sync / observe paths produce audit-relevant events as designed
      (mission / validation run / evidence where applicable)
- [ ] Policy decision recorded when control validation is part of the smoke
- [ ] Smoke evidence packet includes: tenant id, connector key, integration
      id, timestamp, operator, and **no secrets**

### 2.7 Safety and Real-First (always)

- [ ] Verified customer-authorized scope only
- [ ] Read-only vendor permissions; no destructive scopes
- [ ] No mockMode, no recorded-fixture-only “Production” claim
- [ ] Credentials revoked or rotated after scratch runs when appropriate

---

## 3. Explicit non-elevation rule

**Never elevate the catalog to Production without live partner smoke evidence.**

| Action | Allowed only when… |
| --- | --- |
| Set manifest `availability: "Production"` | Live partner smoke completed + Plane issue evidence (§4) |
| Set `certificationLevel: "Certified"` | Same |
| Pass `productionCertified: true` to tier board / generators | Same |
| Claim “Production-certified” in UI, GTM, or reports | Same |

**Not sufficient alone:**

- Recorded-fixture contract tests (`*.contract.test.ts`)
- Mock-mode demos or StandardizedCatalog scaffolds
- Health green in unit tests with mocked `fetch`
- Marketing or design-partner interest without a smoke receipt

Planned / `NotConnectable` entries **cannot** be Production; they need a
dedicated live client + this qualification path first.

---

## 4. How to document evidence in Plane when elevating

Plane is mandatory (`goldeneye` / project **periscan**). Git commits alone are
not tracked work.

### 4.1 Before elevation

1. **Dedupe** — find or create an issue (parent residual often **PERISCAN-467**
   Design-partner Production connectors, or a child per connector).
2. Move issue **Backlog → Todo → In Progress** when smoke starts.
3. Run the checklist in §2 against an authorized design-partner or scratch
   tenant. Prefer scripts/patterns in `docs/CONNECTOR_LIVE_SMOKE.md`.

### 4.2 Evidence packet (issue body / comment)

Paste a structured receipt (HTML or markdown converted to `description_html`
as needed). Minimum fields:

```text
## Production qualification receipt — <connectorKey>

- Date (UTC):
- Operator:
- Periscan tenant id:
- Partner / scratch vendor tenant:
- Connector key:
- Integration id:
- Auth method used (no secrets):
- Commit SHA (code under test):

### Checklist results
- Health probe: PASS/FAIL — notes
- Technique observe: PASS/FAIL — outcome class + notes
- Redaction: PASS/FAIL — notes
- Rate limits: PASS/FAIL — notes
- Tenant isolation: PASS/FAIL — notes
- Audit: PASS/FAIL — event ids / notes

### Explicit
- Live credentials used: yes
- mockMode: no
- Fixture-only path: no

### Follow-ups / residual
- …
```

Attach or link non-secret artifacts only (redacted health JSON status,
validation run id, evidence ids). **Never** paste API keys, client secrets, or
tokens into Plane.

### 4.3 After elevation (code + issue)

Only after the receipt is on the issue:

1. Code change (small, reviewable):
   - Catalog: set `availability: "Production"` only for that connector if
     product policy uses catalog availability for Production.
   - Cert board: pass `productionCertified: true` (and honest `evidenceNote`)
     for that key into `buildTop10ProductionCertBoard` overrides in
     `scripts/generate-integrations.ts` (or the shared helper call site).
   - Keep honesty tests green: if elevating one connector, update
     `catalog-production-honesty.test.ts` expectations carefully so
     **unqualified** connectors remain non-Production.
2. Regenerate docs: `npx tsx scripts/generate-integrations.ts`.
3. Commit with message referencing the Plane issue and connector key.
4. Patch the Plane issue: state → **Done**, description includes:
   - Path to this runbook: `docs/ops/CONNECTOR_PRODUCTION_QUALIFICATION.md`
   - Commit SHA
   - Evidence packet summary
   - New external-tier counts if totals changed

### 4.4 Plane API sketch

```bash
# Fetch key (do not ask humans to paste tokens)
PLANE_API_KEY=$(curl -s -H "X-Ops-Token: $OPS_TOKEN" "$OPS_API/secret?key=PLANE_API_KEY" | jq -r .value)
PLANE_PROJECT_ID=$(curl -s -H "X-Ops-Token: $OPS_TOKEN" "$OPS_API/secret?key=PLANE_PROJECT_ID" | jq -r .value)
# or on goldeneye: cat /root/projects/infra/plane/.plane-api-token

# Update issue description / state (replace ISSUE_ID and state id)
curl -s -X PATCH \
  -H "X-API-Key: $PLANE_API_KEY" \
  -H "Content-Type: application/json" \
  "https://plane.local.sean.network/api/v1/workspaces/goldeneye/projects/$PLANE_PROJECT_ID/issues/$ISSUE_ID/" \
  -d '{"description_html":"<p>…receipt…</p>"}'
```

See `skills/using-plane/SKILL.md` and `docs/ops/PLANE.md`.

---

## 5. Qualification harness (receipt schema + dry-run + gate)

Machine-checkable companion to this runbook (PERISCAN-467):

| Path | Role |
| --- | --- |
| [`packages/shared/src/connector-production-qualification.ts`](../../packages/shared/src/connector-production-qualification.ts) | Receipt Zod schema, checklist automation, `assertCanElevateToProduction`, fail-closed dry-run (`NotConfigured` when live keys missing) |
| [`packages/shared/src/connector-production-qualification.test.ts`](../../packages/shared/src/connector-production-qualification.test.ts) | Certification gate tests — cannot elevate without required receipt fields |
| [`scripts/connector-production-qual-dry-run.ts`](../../scripts/connector-production-qual-dry-run.ts) | CLI dry-run: `pnpm connectors:qual:dry-run <connectorKey> [--receipt file.json]` |

### 5.1 Dry-run (fail closed)

```bash
# Missing keys → decision NotConfigured, exit 2 (never pretends ready)
pnpm connectors:qual:dry-run crowdstrike

# Keys in env + complete receipt JSON → EligibleForElevation only if gate passes
# (still does NOT mutate catalog; elevation is a separate code+Plane step)
pnpm connectors:qual:dry-run crowdstrike --receipt ./receipts/crowdstrike.json
```

Env key maps for priority connectors live in
`CONNECTOR_LIVE_SMOKE_ENV_KEYS` (e.g. `CS_CLIENT_ID` / `CS_CLIENT_SECRET` for
CrowdStrike). Unknown connectors stay **NotConfigured** until a key map is
declared — the harness never invents partner credentials.

### 5.2 Elevation gate (code path)

Before setting `productionCertified: true` or catalog `availability:
"Production"`:

1. Build a receipt matching §4.2 (or parse from Plane / JSON).
2. Call `assertCanElevateToProduction(receipt)` (throws
   `ProductionElevationBlockedError` if incomplete).
3. Prefer `buildProductionCertifiedOverrideFromReceipt(receipt)` when wiring
   `buildTop10ProductionCertBoard` overrides.
4. Complete Plane evidence (§4) and regenerate integrations docs.

---

## 6. Catalog honesty tests (links)

| Path | What it guards |
| --- | --- |
| [`packages/connectors/src/catalog-production-honesty.test.ts`](../../packages/connectors/src/catalog-production-honesty.test.ts) | No Production/Certified without cert path; Planned blocked; ReadyForCredentials inventory |
| [`packages/shared/src/integration-external-tiers.ts`](../../packages/shared/src/integration-external-tiers.ts) | `resolveExternalIntegrationTier` / top-10 cert board; Production only with `productionCertified` |
| [`packages/shared/src/integration-external-tiers.test.ts`](../../packages/shared/src/integration-external-tiers.test.ts) | Unit tests for tier resolver and board honesty |
| [`packages/shared/src/connector-production-qualification.ts`](../../packages/shared/src/connector-production-qualification.ts) | Receipt gate — elevation impossible without full PASS checklist + honesty flags |
| [`packages/connectors/src/market-leaders.ts`](../../packages/connectors/src/market-leaders.ts) | Market-leader scaffolds stay Planned / non-connectable |
| [`scripts/generate-integrations.ts`](../../scripts/generate-integrations.ts) | Regenerates `docs/INTEGRATIONS.md` + `docs/integrations.json` with honest tier counts |
| Integrations UI depth summary | Shows **0 Production-certified** when catalog has no Production/Certified entries |

Run:

```bash
pnpm --filter @periscan/connectors test -- catalog-production-honesty
pnpm --filter @periscan/shared exec vitest run src/integration-external-tiers.test.ts src/connector-production-qualification.test.ts
npx tsx scripts/generate-integrations.ts
pnpm connectors:qual:dry-run crowdstrike
```

---

## 7. Residual status (PERISCAN-467)

| Item | Status |
| --- | --- |
| Catalog honesty (0 Production, Beta dedicated + Planned scaffolds) | Shipped and test-guarded |
| Live-smoke procedure for several vendors | `docs/CONNECTOR_LIVE_SMOKE.md` |
| Production qualification checklist + Plane evidence process | **This document** |
| Receipt schema + certification gate + dry-run NotConfigured | **Shipped** (harness; no elevation) |
| CrowdStrike / Wiz / Tenable / Datadog / QRadar Production elevation | **Blocked** on design-partner live-smoke receipts — no fake elevation |

When the first partner smoke lands, follow §4–§5 — do not edit counts in this
section until code + Plane evidence agree.
