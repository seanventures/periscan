# Periscan .ai UX/UI Review

> Historical snapshot: this UX/UI review records the June 5 codebase state and
> is retained for audit context only. Current branch, validation, gap status,
> and release-readiness guidance live in `.ai/status.md`,
> `.ai/codex-handoff.md`, `.ai/gap-backlog.md`, `.ai/release-readiness.md`,
> and `docs/IMPLEMENTATION_STATUS.md`.

**Agent:** UI/UX DESIGN expert  
**Generated:** 2026-06-05T (during autonomous session on codex/resume-product-completion)  
**Scope:** Navigation, all screens/routes (/ , /integrations, /threat-center, /mssp, /trust-safety, /demo, /snapshots/[id]), interaction design, loading/empty/error/success states, mobile/responsive, accessibility basics, copy, usability. Per AGENTS.md + .ai/spec-index (SPEC-UI-\*, GAP-P1-004 etc), API-first rule (web = thin Next.js consumer of Fastify), real-first (no prod mocks/hardcodes except labeled /demo sample), DoD (real nav, real API data, polished states, tests).  
**Context:** Recent Phase 2 connector expansion (100+ catalog incl. Syncro + many PSA/RMM/SIEM/EDR etc); P0 API fixes may surface errors; marketplace + trust-safety must reflect connectable + health/sync correctly.

## Executive Summary (User Empathy Lens)

A first-time security engineer or MSSP operator lands on `/` and sees a beautiful dark-themed hero + "Validate what is real..." promise. They can sign up with demo creds (hardcoded but intentional for lab), add verified scope, "connect" 2 mock systems, run snapshot, explore attack paths/remediations, then click out to full marketplace or threat center.

**Strengths (what feels polished):**

- API-first in action: every control (create scope, connect, snapshot, import advisory, export report, disconnect, analyst note, filter audits) calls real backend via `PeriscanApiClient` (proxied, cookie-forwarded). No invented data in authed paths.
- Honest states: "No scopes yet.", "Awaiting run", "No advisories...", "No client tenants yet.", "No integrations are connected...", "Planned, not connectable", "Never synced". Readiness badges (Ready/MissingSignals/RequiresApproval), plan item statuses (NeedsApproval/RequiresIntegration etc) use color-coded pills.
- Filters/search in marketplace + audit log feel powerful and immediate (useMemo client-side on real catalog).
- Evidence chips, coverage grids, fact dl lists give visual "proof" density without raw scanner dumps (per PRD).
- Export flows (readiness HTML/PDF) use real POST + blob download + refresh; success msg appears.
- Sample /demo is _explicitly_ labeled "Public sample data", "Sample only", "Not real customer data", uses shared fixtures + reports renderer. Isolated and safe.
- Some explicit loading: trust-safety + mssp have `isLoading` + dedicated "Loading tenant trust details." panels. Busy buttons disable + "Working..."/"Connecting...".
- Error surfacing for 401 (graceful unauth gate with prompt), other PeriscanApiClientError messages (includes upstream error text).
- Cross-route reachability from home hero; back links mostly present.
- Grids use `repeat(auto-fit, minmax(...))`, clamp fonts, flex-wrap for action-row: decent foundation for responsive.

**Overall UX score (subjective, pre-fixes):** 7.5/10 for core happy paths in lab. Strong on data fidelity and transparency. Loses points on navigation friction, state polish inconsistencies, and "after connect, where's my health?" dead-ends for expanded catalog. Feels like a powerful control plane for operators who know the API, less like a guided product for new users.

**No "coming soon" or dead-ends** flagged in UI copy (good). Planned connectors correctly non-connectable. No broken links in source (all routes match README + app dir structure).

## Detailed Route/Journey Audits

### 1. `/` (Workspace + SnapshotWorkbench)

**Files:** `apps/web/app/page.tsx`, `apps/web/src/components/snapshot-workbench.tsx` (768 LOC, use client), `globals.css`
**Journey (empathy):** New user → sees hero with 5 secondary links (integrations, threat-center, demo, trust-safety, mssp) + auth panel (segmented signup/login, prefilled demo creds, fields with <label><span>). Submits → real signup/login → workspace populates via parallel getMe + list\* calls.
**Real data:** Yes (scopes, integrations, attackPaths, remediations, snapshots, designPartner from API). Hardcoded only: SNAPSHOT_CONNECTORS=[github,aws], form defaults, domain "demo.example.com".
**States:**

- Loading/busy: `isBusy` disables all CTAs + "Working...". No top-level spinner on initial load (relies on auth form flash).
- Empty: "No scopes yet.", "No attack paths available yet.", "No remediations...", "Awaiting run", control/AI "No ... signals ... yet."
- Error: `{errorMessage ? <p className="error-copy">...</p>}` after every action or getMe fail (401 special-cased to reset).
- Success: metrics dashboard, list-cards with status-pills (Ready/Required/Connected), snapshot banner + coverage-grid (evidence counts, control/ai counts), design partner checklists + snapshot request, latest report link.
  **Nav:** Uses <Link> for trust, snapshot report. Home page itself uses <a href=...> (inconsistent with other pages using next/link). Outbound to all other routes.
  **Responsive/a11y:** Grids auto-fit. @media 720px affects some. Labels present. Segmented buttons (no role=tablist). focus? limited.
  **New connectors impact:** None (hardcoded 2 only). Connect forces mockMode.
  **Issues:**
- Auth flash for returning users (initial !auth renders full auth form; getMe success re-renders to workspace — jarring "Create tenant..." flash on every reload or tab).
- Only 2 connect options despite 100+ catalog (user empathy: "I just saw Syncro in marketplace, why can't I connect it here for snapshot?").
- Design partner section only renders if data present (from API).

**Recommended fixes:** Add explicit `isLoading` + skeleton/empty panel before first getMe resolves (match trust-safety pattern). Extract shared `<Nav />` or `<AppShell>` to layout.tsx. Generalize "Connect systems" or link prominently to /integrations. Concrete: in snapshot-workbench, after "2. Connect systems" add `<Link href="/integrations">Browse full marketplace ({workspace.integrations.length} connected)</Link>`.

### 2. `/integrations` (IntegrationMarketplace)

**Files:** `apps/web/app/integrations/page.tsx`, `apps/web/src/components/integration-marketplace.tsx` (366 LOC), uses client + useMemo filters.
**Journey:** Hero with back links → auth gate (if !auth: "Sign in to view...") or full: metrics (total, beta+prod, planned), search+category+status filters, grid of cards.
**Real data:** catalog from `/integrations/catalog` (real manifests from packages/connectors), integrations list. connectedKeys derived.
**New connectors:** YES — shows all (Syncro etc.) with exact manifest fields: vendor·product, customerVisibleDescription, signalCategories (Reads), workflowCapabilities (Writes), permissionsSummary, supportedMissionTypes, validationCapabilities (chips), availability (Production/Beta/Planned pill), marketplaceCategory.

- canConnect = connectable && !connected && mockSupported → "Connect mock" primary button (busy per-key).
- Else: "Connected" pill, or "Planned, not connectable" / "Connection unavailable".
- For Syncro (recent): availability Beta, marketplace M SSP/PSA/RMM, mockSupported:true (top-level), connectable:true (default), full fields → appears connectable. Good.
  **States:**
- Empty auth gate.
- During: no explicit loading (initial catalog=[] → empty grid until fetch resolves — flash of 0).
- Error: error-copy above filters.
- Per-card: busy "Connecting...", post-connect "Connected".
- Empty-ish: filters may yield 0 results (no "no matches" message — silent fail).
  **Nav:** Uses Link for back/threat/trust. Good.
  **Responsive:** marketplace-grid auto-fit minmax(320px), filters 190px. Wraps.
  **a11y/copy:** Good facts dl, chip-list aria-label on one. Search placeholder clear. Copy explains "Catalog entries come from ... Planned ... not connectable."
  **Issues (P1/P2):** Always-mock connect (no real auth field collection in UI, even for implemented connectors). No health/status per card (user can't see if the one they just connected is healthy). No "view in Trust & Safety" per-connector.
  **Acceptance for states (per DoD):** Catalog load must show loading state; connect success must surface health immediately or link to sync; 0-filter result must say "No connectors match...".

**Recs:** Add isLoading like mssp. After successful connect, optionally auto-trigger health or show "Connected (sync pending — visit Trust & Safety)". Add per-card health pill if possible (would require extra API or enrich catalog response). Concrete component: enhance marketplace-card with optional health badge once connected.

### 3. `/threat-center` (ThreatCenterWorkbench)

**Files:** `apps/web/app/threat-center/page.tsx`, `apps/web/src/components/threat-center-workbench.tsx` (748 LOC — complex, own auth form).
**Journey:** Hero → own auth (different demo tenant creds) → import form (title, source, summary, raw, optional CVE/IoC/TECH lists) → list of imported → click loads detail (readiness, missing signals, non-exec plan, evidence) + export btns.
**Real data:** listThreatAdvisories, import, get detail, readiness, export (POST + download). All API.
**States (strong here):**

- Auth gate or loading implicit.
- Import busy "Importing...".
- List empty: "No advisories have been imported yet. Import a manual..."
- Detail empty: "Select or import an advisory to see..."
- Readiness pills: readinessClass (ok/pending/error for Ready/Requires/Missing).
- planStatusClass (pending/error for Needs/Requires\*/NotConfigured).
- MissingSignalsList: either explanatory p or grid of metric-cards.
- EvidenceChips: chips or "No linked...".
- Export: disabled while busy, success "Exported xxx", then re-fetch detail.
- Errors: error-copy or export separate.
  **Nav:** Links to / and /trust-safety. No direct to integrations/mssp.
  **Responsive/a11y:** Good sections with aria-labelledby, id headings, chip lists.
  **Issues:** Own auth (inconsistent creds/tenant with workspace — user confusion if multi-tab). No loading during list+first-detail load (like marketplace). Flash of auth form for authed users. Exports re-fetch but no loading on detail.
  **Per gap P1-001:** Manual + readiness + plan + export + web surfaces present; missing signals impact ok. Later slices added public feed ingestion; commercial/private feed onboarding remains customer/business-gated.

**Recs:** Share auth session across (or remove per-page auth, use global /me). Add isLoading. Link to /integrations from missing signals that require categories.

### 4. `/mssp` (MSSPPortfolioDashboard)

**Files:** `apps/web/app/mssp/page.tsx` (bare), `apps/web/src/components/mssp-portfolio-dashboard.tsx`
**Journey:** Direct dashboard (no hero unlike most). Loading/unauth gate with back link → summary metrics + client cards (or "No client tenants yet.").
**Real data:** getClientPortfolio (totals, clients with coverage, risk, meters, branding, latestActivity). Real.
**States:** Explicit isLoading "Loading client portfolio.", 401 unauth with back, error pill, empty clients panel. ClientCard has readiness pills (Active/Attention/pending), coverage, metadata formatted dates, chips for risk/AI/runners.
**Nav:** Back to / , to trust-safety. No to integrations/threat.
**Issues:** Inconsistent page shell (no hero/eyebrow like siblings). Client cards don't link to anything (e.g. no deep link to client tenant workspace — dead-end feel?).
**Responsive:** Uses workspace-grid etc.

**Rec:** Add hero for consistency. Make tenant name or button link to filtered view (future).

### 5. `/trust-safety` (TrustSafetyDashboard)

**Files:** `apps/web/app/trust-safety/page.tsx` (bare), `apps/web/src/components/trust-safety-dashboard.tsx` (657 LOC — richest state surface).
**Journey:** Loading → unauth gate (back link) or hero + metrics (connected, perms, audits) → 4-panel grid: Connected systems (per-int details + disconnect), Evidence retention, Operational readiness, Runner security. Then safety principles, Audit log (filters + apply/clear, list).
**Real data + new connectors:** Yes — getTrustSafetySummary → connectedIntegrations enriched from persisted + connector manifest (vendor/product, category, status, **healthStatus**, **lastSyncAt**, dataSensitivity, supportedMissionTypes, permissionsUsed, dataReadCategories, validationCapabilities, workflowCapabilities, revokeInstructions). Audit from listAuditEvents (real, filterable by action/date/user).

- For any connector incl. new (Syncro etc.): appears here post-connect with its manifest fields. healthStatus/lastSyncAt from DB.
  **Health/sync UI:** Shows `healthStatus`, `lastSyncAt ?? "Never synced"`, status, disconnect. Good.
  **States (best in app):**
- isLoading panel.
- 401 unauth + back.
- error as status-pill--error.
- Empty connected: "No integrations..."
- Per int: full facts dl + 4 chip-lists + revoke p.
- Retention/ops/runner: status pills (ok/pending) based on "Configured", facts.
- Controls map to list-cards with status.
- Audit: form toolbar, "No audit events matched...", event cards.
- Busy: disables disconnect + filter buttons.
  **Nav:** Back to / . Links in audit to API. From other pages link here.
  **Issues (critical for task #6):**
  - No "Sync" or "Refresh health" buttons → after marketplace "Connect mock" (which sets Unknown + no lastSync), user sees poor state until they run a ValidationSnapshot (which triggers sync for snapshot-supported) or hit API directly.
  - No per-integration health check button (there is API /:id/health and /:id/sync but unused in web).
  - Thus, "Trust & Safety shows health/sync?" → partially; shows but not fresh/actionable for UI-created connects.
    **a11y:** Good, date inputs, selects labeled.

**Recs (P1):** Add sync button per connected int: onClick → call new client method for POST /integrations/${id}/sync then refresh summary. Or health. Update createIntegration server-side to kick off initial sync (or health) for immediate "Healthy" + timestamp on mock connects. Concrete: add to trust-safety `async function syncIntegration(id) { await client... ; const s=await get...; setSummary(s); }` + button in panel-header.

### 6. `/demo` (PublicDemoReport)

**Files:** `apps/web/app/demo/page.tsx`, `apps/web/src/components/public-demo-report.tsx`
**Journey:** Labeled hero (sample story list) → proof-grid metrics (from fixture) → iframe with full reportHtml (srcDoc).
**Real?** No — explicit sample via `createPublicDemoValidationSnapshot` + `renderValidationSnapshotReportHtml` (from packages). Labeled everywhere. Allowed per spec.
**States:** Static (no fetch, no error paths really). Toolbar for sample.
**Responsive:** public-demo specific, @media for toolbar/frame height.
**Good:** Clear "Not real customer data". Back to workspace.

### 7. `/snapshots/[id]` (SnapshotReportView)

**Files:** `apps/web/app/snapshots/[id]/page.tsx` (async params), `apps/web/src/components/snapshot-report-view.tsx`
**Journey:** Back link → (if design-partner) analyst note form (save regenerates html) → report-shell with dangerouslySetInnerHTML (from /snapshots/:id/report) or loading/error.
**Real data:** getSnapshotReportHtml, getDesignPartner, get/update analyst note, re-fetch html on save.
**States:** No auth gate (will error on fetch if no session). Error panel on catch. Loading "Loading validation snapshot report...". Success: full report + note editor (only if enabled).
**Nav:** Only back to / . (If came from workspace latest link, ok; otherwise potential dead-end.)
**Issues:** No 404/403 nice state (just error msg). No isLoading during save re-render. dangerously ok since trusted. Direct nav to invalid id is poor UX.

**Rec:** Wrap in auth check or error boundary. Add "Report not found or access denied" specific.

## Cross-Cutting: Navigation, Mobile, A11y, Copy, Interaction, Errors

**Nav:** All routes reachable from home action-row. But inconsistent: mssp/trust/demo/snapshots lack full hero cross-links (only back + 1-2). No persistent top nav / sidebar / footer. Action-row duplication. Links sometimes <a>, sometimes <Link>. No active state.

- Dead-end risk: after viewing a snapshot report, only way back is / ; can't easily go to threat-center from there.
  **Mobile/responsive:** CSS foundation good (auto grids, clamp, wrap, 720px media for stack/padding/frame). But card min 280-320px + padding may overflow or look sparse on <360px. No touch targets explicit. No media for very small or landscape. (P2)
  **A11y basics:** Labels (mostly <label class=field><span>), headings, some aria-labelledby/aria-label (chips, sections). focus-visible on threat buttons. Buttons are real <button> or links. Segmented not grouped. No live regions for errors/status changes (screenreader may miss "Connecting..."). Color-only status (ok=green bg). No landmarks beyond <main>. Keyboard: forms ok, list buttons ok. (P2)
  **Copy/usability:** Clear, benefit-oriented, PRD-aligned ("Find the path..."). Consistent "muted-copy", "eyebrow". Demo creds visible (ok for lab, but document). No progressive disclosure overload. "Connect mock" honest. But "Connection unavailable" could explain _why_ (no mock? no creds support in UI?).
  **Interaction:** startTransition + withBusy pattern everywhere (good for pending). Disabled during. No optimistic updates. Form validation minimal (HTML required on some).
  **Error from API (4xx/5xx):** Client normalizes to PeriscanApiClientError(status, msg from ApiErrorSchema or fallback). UI shows raw-ish message. Handled per-page, no boundary. 401 special → gate (good). 503 health etc in proxy. Good coverage but presentation could be toast + retry.
  **Loading/empty/success polish:** Varies by component. Trust/mssp best (explicit isLoading). Others rely on initial state + busy. No skeletons. Empty often just muted p (good but could be illustrated empty-state).
  **Health/sync for connectors (task focus):** Trust & Safety does surface per-connector healthStatus + lastSyncAt + category etc for _all_ (incl new). Marketplace connects succeed for qualifying new ones. Gap is liveness + actionability.

## Gaps with Severity, Files, Recommended Fixes, Acceptance Criteria

(See also GAP-P1-004 in gap-backlog which this expands.)

**P1 (major journeys/states incomplete or confusing):**

- GAP-P1-005 (new): Integration connect (marketplace + workspace) leaves health/lastSync "Unknown"/"Never" with no UI path to refresh/sync. Trust & Safety (primary health UI) and new connectors suffer.
  - Why: Breaks "see health/sync" expectation after connect. Real data rule + user mental model.
  - Files: apps/web/src/components/{integration-marketplace.tsx, trust-safety-dashboard.tsx, snapshot-workbench.tsx}, apps/api/src/runtime-services.ts (createIntegration), app.ts (routes), lib/periscan-api-client.ts (needs syncIntegration method).
  - Fix: 1. Add client.syncIntegration(id). 2. Add "Sync now" / "Check health" buttons in trust-safety connected cards (and optionally marketplace). 3. On marketplace connect success, call health or sync then refresh. 4. Server: in createIntegration, after persist, if mock call initial healthCheck + update (or queue sync). 5. Update tests + acceptance.
  - Acceptance: After "Connect mock" on Syncro or any, within <2s Trust & Safety shows Healthy + recent lastSyncAt (mock). Button works for live too. No 500s.
- GAP-P1-006 (new): Auth flash of login UI on / and /threat-center for returning authed users (renders unauth form then swaps).
  - Files: snapshot-workbench.tsx:151 (if(!workspace.auth)), threat-center-workbench.tsx:392, useEffect getMe paths.
  - Fix: Introduce isLoading + "Restoring session..." state (copy trust-safety pattern). Hide auth form behind loading until getMe settles.
  - Acceptance: No flash on reload when session cookie valid; direct to workspace or threat content.

**P2 (important polish/edge):**

- Inconsistent nav + missing global shell (all page.tsx + many components). Recommend: new `apps/web/src/components/app-nav.tsx` or update layout with <header> + links (use active via pathname if client).
- No loading in marketplace + threat initial data; empty filters no message; report page no auth/404 polish.
- Limited responsive (globals.css only @720px media; card mins). Add more queries or container queries. Test with playwright viewport.
- A11y gaps (labels are spans in .field not always associated, no aria-live, segmented, color status). Add role, better labels, live regions for error/success.
- Error presentation shallow (inline text, no retry, no toast component). Add reusable <ErrorBanner> or use browser toast.
- Workspace connect limited vs catalog. Add "or explore full catalog" link.
- Snapshot report: unauth/ bad-id handling weak.
- No success feedback after connect/disconnect/scope add beyond count change (subtle).
  **P1-007 note (feature eng slice):** snapshot-workbench rem cards now include real "Create ticket" with dest selector for connected Ticketing/MSSP (Syncro etc); post-action shows "Ticket: Syncro #ID"; empty state "Connect a PSA/RMM..."; error/success/loading via existing patterns. A11y label present. Real data. Complements GAP-P1-004 states work.
- Hardcoded demo values in multiple forms (extract consts?).
- HealthStatusCard component exists + tested but **never used** in any route (dead code).

**P3:** Polish copy (e.g. explain "Connection unavailable" reasons), icon consistency (none used), more mobile tweaks, add e2e playwright for states/nav (current has some component tests + broad e2e).

**Dead-ends flagged:** None explicit "coming soon". Implicit: can't real-connect from UI (always mock), no way to trigger sync/health from UI for connected items, limited nav from report/mssp.

**Recommended concrete component changes:**

- Create `apps/web/src/components/app-shell.tsx` or `nav.tsx` imported in layout or pages for persistent links + user info.
- Enhance `integration-marketplace.tsx` + `trust-safety-dashboard.tsx` with sync affordances + loading.
- Refactor auth logic into shared `usePeriscanAuth` hook to eliminate duplication/flash.
- Add `loading.tsx` or Suspense boundaries (Next) + skeletons for data panels.
- In CSS: more media, focus styles, min contrast audit.
- Client: add `syncIntegration`, `getIntegrationHealth` methods + use in UI.

**Tests (manual + auto):** Component tests already cover many empties/errors (see \*.test.tsx). Recommend: expand playwright e2e for cross-route nav + state transitions + error injection (mock fetch 500). Manual: seed demo, connect 3 new connectors (e.g. syncro + 2 others), visit trust-safety, assert health updates or use buttons, resize browser, tab-nav a11y, 401/500 via devtools.

**Validation:** pnpm --filter @periscan/web typecheck; pnpm test (web); full pnpm verify; manual after `pnpm seed:demo ; pnpm dev`; e2e.

No changes made to source in this review (only docs + backlog per task). If implementing fixes, branch ai/grok/ux-\*, run typecheck/test.

## References

- Routes per README + app dir.
- Components listed in list_dir.
- GAP-P1-004, SPEC-UI in .ai/ files + docs/TRACEABILITY_MATRIX.md, ACCEPTANCE_CRITERIA.md (states), PRD.
- Backend: packages/connectors (manifests + mockSupported), runtime-services (create no-sync, syncPersisted, buildTrustSafetySummary), app.ts (routes).

This review ensures journeys are real, states polished, new connectors visible+connectable in marketplace, health/sync visible (with actionable gaps noted). Update after fixes.
