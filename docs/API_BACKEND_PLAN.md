# API / Backend Build-Out Plan

Companion to [UI_API_GAPS.md](./UI_API_GAPS.md). Scope: everything the redesigned
UI wants that isn't fully served today.

## TL;DR — the important finding

**Most "gaps" are client-wrapper gaps, not backend gaps.** A route-existence
audit of `apps/api/src/app.ts` (2026-07-04) shows the backend already implements
the majority of what the UI needs; the reference `PeriscanApiClient` just doesn't
wrap those routes yet. Only ~5 items are genuine new backend work, and only one
(MCP server) is a real epic.

Verify any route below with `/api/v1/api-reference` before starting.

---

## Phase 0 — Client wrappers (NO backend work; unblocks UI) — ~0.5–1 day

These routes exist server-side. Add a `PeriscanApiClient` method + a shared
type/schema import + surface in the relevant UI. Each is minutes of work.

| Route (exists) | Client method to add | UI to light up |
|---|---|---|
| `GET /evidence/:id/download` | `downloadEvidence(id)` | Evidence ledger: real Download action |
| `POST /evidence/:id/redact` | `redactEvidence(id)` | Evidence ledger: Redact action |
| `POST /ai-apps`, `PATCH/DELETE /ai-apps/:id` | `createAIApp/updateAIApp/deleteAIApp` | AI Apps: register/edit/remove |
| `POST /ai-apps/:id/validate`, `GET /ai-apps/:id/history`, `GET /ai-apps/validation-suites` | `validateAIApp/getAIAppHistory/listAIAppValidationSuites` | AI Apps: run safe validation + history |
| `POST /scopes/:id/policy-decisions/preview` | `previewPolicyDecision(scopeId, input)` | Validation Snapshot: real policy-gate preview step |
| `POST /missions`, `POST /missions/:id/start`, `POST /missions/:id/cancel`, `GET /missions/:id/runs/:runId` | `startMission/cancelMission/getMissionRun` (createMission exists) | Snapshot/Missions: drive the full mission loop + live run polling |
| `POST /tenants/current/invite` | `inviteMember(input)` | Admin: invite teammates |
| `GET /tenants/current/clients`, `POST /tenants/current/clients` | `listClientTenants/createClientTenant` | MSSP tenant switcher + client onboarding |
| `GET/PUT/DELETE /tenants/current/sso` (+ `authorization-url`, `metadata`) | `getSso/updateSso/...` | Trust & Safety / Admin: SSO (SAML/OIDC) config |
| `POST /control-sources`, `POST /control-sources/:id/validate`, `GET /:id/history` | `createControlSource/validateControlSource/getControlHistory` | Controls: register a source + run validation |
| `GET /remediations/trends` | already wrapped (`getFixTrends`) | Executive/Remediation: real fix-trend series |

Exit criteria: each wrapper is Zod-validated, tenant-scoped by the existing key,
and the UI's honest "not configured" state is replaced with the live action.

---

## Genuine backend work

Every new endpoint follows the repo's established route recipe (see bottom).

### Phase 1 — Findings lifecycle transitions — ~2–3 days (BIGGER THAN FIRST SCOPED)
> **Correction (2026-07-05):** findings are **derived, not stored.** There is no
> Prisma `Finding` model or `status` column — `getValidatedFinding` =
> `listValidatedFindings().find(...)`, computed from signals + remediations +
> missing-signals. So a lifecycle *write* can't just `UPDATE` a row.

- **Design decision required**: introduce a new `FindingStatusOverride` table
  keyed by the derived `findingId` (tenantId, findingId, status, note, actorId,
  createdAt) that the finding builder consults + applies when it assembles each
  `ValidatedFinding`. This is the real work: new model + migration + builder
  integration in `services/findings.ts` (`listValidatedFindings`), not a simple
  status update. The derived `findingId` must be stable enough to key an override.
- **Endpoint**: `POST /api/v1/findings/:id/transition`
  body `{ action: "Triage" | "Route" | "Investigate" | "Reopen", note? }` (map to
  the real `ValidatedFindingStatus` enum: NeedsReview / Routed / InProgress /
  Reopened — **never `Fixed`**, which stays verification-only).
- **Audit**: new `finding.transitioned` action (+ enum + `AUDIT_ACTION_TO_DB` +
  Prisma enum + migration).
- Because of the derived-finding wrinkle, do **Member roster (Phase 2)** FIRST —
  it uses existing models with no migration and is the genuinely-clean first
  backend endpoint.

> **Verification note:** every backend phase requires the test Postgres on port
> **5434** to run acceptance tests (`PERISCAN_POSTGRES_PUBLISHED_PORT=5434`). Bring
> it up before/while implementing, or changes can only be typecheck/mock-verified.

### Phase 2 — Tenant members & roles — IN PROGRESS
Invite-create + accept already exist; the roster + role management did not.

- **`GET /api/v1/tenants/current/members` — DONE 2026-07-05** (the first genuine
  backend endpoint). `TenantMemberSchema` (membership ⋈ user, secrets stripped) in
  shared; `listTenantMembers` in `services/tenant.ts` + `AppServices`; route with
  `operationId: listTenantMembers`; in-memory impl + a new acceptance test
  (`tests/acceptance/tenant-members-flow.test.ts`) that passed against the 5434 DB;
  client `listTenantMembers()` + Admin **Members** panel. Verified: API typecheck,
  302 API unit tests, acceptance, web build.
- **Remaining**: `PATCH /members/:membershipId { role }`,
  `DELETE /members/:membershipId` (with "can't demote/remove the last owner" +
  `membership.role_changed`/`membership.removed` audit actions — these DO need a
  migration for the new audit-action enum values).
- **Persistence**: existing `Membership` + `User` models — no schema change.
- **RBAC**: admin/owner only; cannot demote the last owner.
- **Audit**: `membership.role_changed`, `membership.removed`.
- **UI**: Admin → Members panel (list, change role, remove, plus the existing
  invite flow).

### Phase 3 — Global cross-entity search — ~2 days
Powers ⌘K (currently nav-only).

- **Endpoint**: `GET /api/v1/search?q=&limit=` → typed union results
  `{ type: "AttackPath"|"Finding"|"Evidence"|"Asset"|"Advisory"|"Remediation",
  id, title, subtitle, href }[]`, ranked.
- **Persistence**: no new tables; add Postgres `pg_trgm` GIN indexes on the
  searchable text columns for speed. A `similarity()` / `ILIKE` query per entity,
  merged + ranked in the service, all tenant-scoped.
- **RBAC**: reader+.
- **UI**: swap the command palette's nav-filter for live results.

### Phase 4 — Executive time-series — ~2–3 days
`executive-trends` returns current-vs-previous **deltas only**; the UI wants a
historical series for trend charts.

- **Persistence**: new `TrendMetricPoint` model
  `(tenantId, metricId, value, unit, capturedAt)`, written once per period by the
  existing sweep/snapshot scheduler (append a capture step). Migration.
- **Endpoint**: `GET /api/v1/tenants/current/executive-trends/series?metricId=&window=`
  → `{ metricId, points: [{ capturedAt, value }] }[]`.
- **UI**: add an interactive SVG line/area chart to `/executive` (a `TrendChart`
  primitive with crosshair + tooltip per the data-viz spec) fed by the series.
- Note: until this lands, the exec surface's delta metrics + distributions are the
  honest representation — no fabricated line.

### Phase 5 — Control rule tuning (optional) — ~0.5 day
`/control-sources/:id/validate` runs validation; there's no "apply a tuning
recommendation" action.

- **Endpoint**: `POST /api/v1/control-sources/:id/rule-coverage/tune`
  `{ techniqueId, recommendation }` → records the tuning intent (it does not mutate
  the customer's SIEM/EDR; it tracks a work item + audit).
- Low priority; the read-only tuning recommendations already ship in the UI.

### Phase 6 — MCP Server (new subsystem; the only epic) — ~1–2 weeks
Expose Periscan's governed, read-only tools to external AI clients over the Model
Context Protocol, reusing the Frontier Gateway's safety machinery.

- **Transport**: a streamable-HTTP MCP endpoint (e.g. `/mcp`), authenticated with a
  tenant API key (Bearer). Implement the MCP handshake + `tools/list` + `tools/call`.
- **Tool surface**: reuse the code-defined `model-gateway` tool catalog; expose only
  `enabled`, non-offensive, read-oriented tools.
- **Governance (reuse, don't rebuild)**: every `tools/call` runs through the SAME
  Policy Enforcement Point (`Allowed`/`RequiresApproval`/`Denied`), the SAME
  `redactEvidenceArtifact` on outputs, and writes `ModelGatewayAuditEvent`-style
  records. Approval-gated tools reuse the mission/approval queue.
- **Management API**: `GET/PATCH /api/v1/mcp/config` (exposed-tool overrides),
  `GET /api/v1/mcp/sessions`, `GET /api/v1/mcp/audit-events`; wire a per-tenant
  kill switch (reuse the model-gateway one).
- **Persistence**: `McpSession` + reuse gateway audit events. Migration.
- **UI**: the `/mcp` console is already built as a preview — swap its static config
  for live session/telemetry once the endpoints exist.

---

## The route-add recipe (apply to every new endpoint above)

Codified from the repo's conventions (see the `periscan-*` memories / AGENTS.md):

1. **Shared schema** — add request/response Zod to `packages/shared/src/domain.ts`
   (+ inferred `type`). This is the source of truth.
2. **Service method** — implement in the right `apps/api/src/services/*.ts` module,
   expose via `AppServices`; keep every query tenant-scoped.
3. **Route** — register in `apps/api/src/app.ts` with `schema.{operationId,summary,tags}`
   (the `openapi-coverage.test.ts` enforces full coverage + unique operationIds).
4. **OpenAPI payloads** — add request/response to `apps/api/src/openapi-payloads.ts`.
5. **New audit action?** — add to `AuditEventActionSchema` + `AUDIT_ACTION_TO_DB`
   + the Prisma `AuditEventAction` enum + a migration (`ALTER TYPE … ADD VALUE`).
   New entity kind? also `RelatedEntityTypeSchema` + Prisma `RelatedEntityType`.
6. **Migration** — hand-authored additive SQL under `packages/db` (test DB on
   port **5434**).
7. **Tests** — unit (service) + acceptance (`tests/acceptance/*flow.test.ts`),
   including a cross-tenant isolation case; run gated (`pnpm verify`).
8. **Client + UI** — add the `PeriscanApiClient` wrapper and surface it, replacing
   the honest empty/preview state.

---

## Suggested sequence & rough effort

| Phase | Item | Effort | Value |
|---|---|---|---|
| 0 | Client wrappers (10+ routes) | 0.5–1d | High — unlocks evidence/AI-apps/missions/policy/invite/MSSP/SSO immediately |
| 1 | Findings lifecycle | ~1d | High |
| 2 | Members & roles | ~1d | High (admin completeness) |
| 3 | Global search | ~2d | Medium–High (⌘K) |
| 4 | Executive time-series | ~2–3d | Medium (charts) |
| 5 | Control tuning apply | ~0.5d | Low |
| 6 | MCP server | 1–2wk | Strategic (new capability) |

Start with **Phase 0** — it's the cheapest, highest-leverage work and turns most
of the ledger green without touching the backend. Then Phases 1–2 for admin/queue
completeness, 3–4 for polish, and schedule the MCP epic separately.

---

## Status — 2026-07-05 (Phases 1–5 COMPLETE + verified)

All of Phases 1–5 are implemented end-to-end (shared schema → service → route →
in-memory impl → acceptance test vs the 5434 DB → client wrapper → UI) and
verified. Unit baselines green: shared 119, api 302, web 169.

| Phase | Item | Endpoint(s) | Acceptance test |
|---|---|---|---|
| 1 | Findings lifecycle | `POST /findings/:id/transition` (analyst disposition overlay; never sets Fixed) | `finding-disposition-flow` |
| 2 | Members & roles | `GET/PATCH/DELETE /tenants/current/members[/:id]` (last-owner guard) | `tenant-members-flow` |
| 3 | Global search | `GET /search?q=` (6 entity types, tenant-scoped) + ⌘K live results | `global-search-flow` |
| 4 | Executive time-series | `GET /tenants/current/executive-trends/series` (capture-on-read + scheduler capture) + interactive chart | `executive-trend-series-flow` |
| 5 | Control tuning apply | `PATCH /control-sources/:id` (expected-behaviors yardstick) | `control-source-tuning-flow` |

New tables: `ExecutiveMetricSnapshot`, `FindingDisposition`. New audit action:
`finding.disposition_changed`. New migrations under `packages/db`.

**Bug uncovered + fixed during Phase 4:** several Prisma enum values existed in
the schema/code but were never added by a migration (`EvidencePackType` ×13,
`ScopeType.Physical`, `SignalCategory.Detection`,
`AuditEventAction.remediation_auto_mitigated`) — any from-scratch DB 22P02'd on
those code paths. Reconciled in `20260705020000_reconcile_enum_drift`.

**Known PRE-EXISTING failure (not from this work):** `non-snap-journey.test.ts`
(3 cases) asserts the API report-export HTML for non-snapshot pack types renders
an explicit Fixed / Still-Exposed verdict section. It fails identically on the
un-modified baseline (verified by stash). The report-verdict rendering for
non-snapshot packs is an in-progress feature — left for its owners rather than
guessed at. Phase 6 (MCP server) remains the separate epic.
