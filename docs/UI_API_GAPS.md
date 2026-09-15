# UI ↔ API Gaps

The redesigned UI is built strictly against the `/api/v1/*` contract. Where a
product surface wants a capability the API (or the bundled `PeriscanApiClient`)
does not yet expose, it is recorded here rather than faked in the frontend. A
surface in this state ships an honest **"not configured / no signal / preview"**
state, never a fabricated value.

Status: `OPEN` (no API), `WRAPPER` (backend route exists; only the client method +
UI are missing), `PARTIAL` (data exists but a field is missing), `BY-DESIGN`,
`RESOLVED` (dated note).

> **See [API_BACKEND_PLAN.md](./API_BACKEND_PLAN.md)** for the phased build-out. A
> route audit (2026-07-04) found that **most of section A is actually `WRAPPER`
> work — the backend already implements it**; only global search, findings
> lifecycle, member roster, executive time-series and the MCP server are genuine
> new backend endpoints.

_Last reviewed: 2026-07-04 — after the full new-UI build (25+ surfaces). Confirm
each against `/api/v1/api-reference` + `/openapi.json` before backend work; some
may already exist under a different namespace or just need a client wrapper._

## A. Missing API endpoints (backend work)

| # | Surface | Needed capability | Status |
|---|---------|-------------------|--------|
| 1 | Global search / ⌘K | **RESOLVED 2026-07-05**: `GET /api/v1/search?q=` (cross-entity: scopes, assets, attack paths, remediations, AI apps, evidence packs; tenant-scoped, per-type cap). ⌘K palette shows live entity results with per-type routing. Acceptance: `global-search-flow`. | RESOLVED |
| 2 | Tenant / Admin | **RESOLVED 2026-07-05**: `GET /api/v1/tenants/current/members` (TenantMemberSchema = membership⋈user, no secrets) + `PATCH`/`DELETE .../:membershipId` for role change & remove with a last-owner guard (`member.removed` audit). Admin Members panel has a role dropdown + Remove. Acceptance: `tenant-members-flow`. | RESOLVED |
| 3 | Findings | **RESOLVED 2026-07-05**: `POST /api/v1/findings/:id/transition` sets/clears an analyst DISPOSITION (accept-risk / false-positive / suppress / acknowledge / escalate) via a `FindingDisposition` overlay. Findings stay derived and the overlay CANNOT set "Fixed" (verification-only). Findings queue shows a disposition badge + control. Audit `finding.disposition_changed`. Acceptance: `finding-disposition-flow`. | RESOLVED |
| 4 | Controls | **RESOLVED 2026-07-05**: `PATCH /control-sources/:id` (`updateControlSource`) tunes a control source's expected behaviors; Controls UI has an inline "Tune" editor. Re-derives Detected/Missed on next validation. | RESOLVED |
| 5 | Evidence | Per-artifact download + redaction — **RESOLVED 2026-07-04**: `downloadEvidence`/`redactEvidence` wrapped; `/evidence` rows now have real Download + Redact actions. | RESOLVED |
| 6 | Executive | **RESOLVED 2026-07-05**: `ExecutiveMetricSnapshot` + `GET /executive-trends/series` (capture-on-read + scheduler capture); `/executive` has an interactive trend chart. | RESOLVED |
| 7 | MCP Server (`/mcp`) | **RESOLVED 2026-07-05**: real JSON-RPC 2.0 MCP server at `POST /mcp` (API-key Bearer auth, tenant-scoped), 7 read-only tools backed by existing services, every call audited (`mcp.tool_invoked`); `GET /api/v1/mcp/tools` + `/activity`; console drops the Preview banner and shows the live catalog + call log. Acceptance: `mcp-server-flow`. | RESOLVED |
| 8 | AI Apps | **RESOLVED 2026-07-04/05**: `validateAIApplication` wrapped ("Run safe validation" per app) and `createAIApplication` wrapped with a full register form (name/type/endpoint/owner/scope/RAG/tools/data/guardrails). | RESOLVED |
| 8b | Snapshot loop | **RESOLVED 2026-07-05**: `previewPolicyDecision` wrapped → the Snapshot gate now shows the real policy engine outcome + rationale; `cancelMission`/`getMissionRun` wrapped → "Recent missions & runs" panel with cancel. (The run trigger stays on `createSnapshot`, which handles module selection — `startMission` needs explicit `moduleIds`.) | RESOLVED |
| 8c | Admin / MSSP / SSO | **RESOLVED 2026-07-05**: `inviteMember`, `getSsoConfig`+`disableSso`, and full member **roster + role/remove** (see row 2) all wrapped & surfaced. Remaining (explicitly deferred, not gaps): SSO **config form** (`UpdateTenantSsoConfigInput` is a SAML/OIDC union — bigger form) and MSSP tenant *switcher* (`/tenants/current/clients` — the portfolio already lists clients). | RESOLVED (invite, SSO status, roster, roles) / DEFERRED (SSO form, switcher) |

## B. API exists — client wrapper / field missing (frontend-adjacent)

| # | Surface | Gap | Status |
|---|---------|-----|--------|
| 9 | Audit | `POST /audit-events/export` — **RESOLVED 2026-07-04**: `createAuditExport(format)` wrapped; Export JSON/CSV buttons on `/audit` open the download path. | RESOLVED |
| 10 | Auth | MFA-at-login — **RESOLVED 2026-07-04**: `login` now accepts `totpCode`/`recoveryCode`; `/login` reveals an authenticator-code field when the API asks for MFA. | RESOLVED |
| 11 | Webhooks | `/tenants/current/webhooks*` — **RESOLVED 2026-07-04**: list/create/update/delete/test + deliveries wrapped; Webhooks manager added to `/admin`. | RESOLVED |
| 12 | Billing | `GET /billing/limits` — **RESOLVED 2026-07-04**: `getBillingLimits()` wrapped; `/billing` shows usage-vs-limit bars + within-limits badge. | RESOLVED |
| 13 | MSSP | Tenant switcher needs a "tenants I belong to" list to populate `x-periscan-tenant-id`; no such endpoint surfaced. | PARTIAL |
| 14 | Reports | Analyst-note authoring (`getReportAnalystNote`/`updateReportAnalystNote` exist) is not yet surfaced on the reports UI. | PARTIAL |
| 15 | Schedules | `lastDiff` is an untyped `LooseObject`; a typed diff (reopened count, deltas) would let the UI stop defensively probing keys. | PARTIAL |

## C. Composition / ergonomics (no new endpoint required)

| # | Surface | Note | Status |
|---|---------|------|--------|
| 16 | Dashboard / Executive | The command center composes ~6 list calls client-side. A single server-side rollup would cut latency + N round-trips. | PARTIAL |
| 17 | Validation Snapshot | The guided loop drives scope→verify→`createSnapshot`. `policy-decisions/preview` and `missions/:id/start` aren't wrapped, so the gate is represented by verified-scope status and the "run" is the snapshot (createMission exists but is unused). | BY-DESIGN (verify) |

## D. Intentional (BY-DESIGN — not gaps)

- **Runner pairing** has no server-side "approve" step: enrollment completes when
  the runner dials in (`/runners/register` + `/runners/:id/heartbeat`). The UI
  confirms by auto-detecting check-in and showing the cert fingerprint (TOFU).
- **Offensive tools** (SharpHound, Caldera, etc.) stay disabled in Tool Governance
  and are excluded from MCP exposure unless the API explicitly permits them.
- **A risk is only "Fixed"** via a real verification event; the UI never offers a
  UI-only fixed status.

## Process

1. Before building/altering a surface, resolve its rows against `/api/v1/api-reference`.
2. If a capability exists, delete the row (or mark `RESOLVED` with the route).
3. If not, the UI keeps its honest empty/preview state and the row stays `OPEN`.
