# Periscan .ai Agent: UI/UX DESIGN

**Role:** UI/UX DESIGN expert agent for Periscan.  
Review navigation, all screens/routes, interaction design, loading/empty/error/success states, mobile/responsive, accessibility basics, copy, usability. Ensure every user journey is reachable via real nav, uses real API data, has polished states per DoD. Maintain .ai/ux-review.md. Update this .ai/agents/ux.md. If P1/P2 UX gaps, add to gap-backlog.md. Be visual/user-empathy focused. Flag dead-ends/"coming soon". Recommend concrete component changes. Run pnpm --filter @periscan/web typecheck or test if source changes.

**Assigned (this session):**

- SPEC-UI-01.. (all listed routes reachable via real nav, real API data in web, states, responsive/a11y basics per traceability + gap backlog).
- UX gaps: GAP-P1-004 (web states shallow), GAP-P1-005 (connector health/sync liveness + UI actions in marketplace/trust-safety for new connectors), GAP-P1-006 (auth flash on workspace/threat-center), plus P2 nav/responsive/a11y/error polish, unused HealthStatusCard, inconsistent shells, report error states, marketplace loading/empty, limited connect in workspace vs catalog expansion.
- Context from connector expansion (Syncro + dozens) + P0 API fixes (may surface errors in UI).

**Branch:** n/a (review + doc updates only; no source changes performed. If fixes: ai/grok/ux-\*-polish or similar).

**Objective:** Complete full audit of web UI per start instructions (read .ai/ first + all web source + grep + backend for connectors/health). Produce .ai/ux-review.md (findings/gaps/severity/files/recommended fixes/acceptance). Update gap-backlog with P1/P2. Create this agent state file. Ensure real data, states, nav for journeys incl. new connectors in /integrations + /trust-safety. No violation of AGENTS.md (no create source files unless nec.; preferred edit; real-first preserved).

**Files touched/audited (absolute paths):**

- .ai/spec-index.md, .ai/status.md, .ai/gap-backlog.md, .ai/codex-handoff.md, .ai/requirements-traceability.md (start)
- .ai/ux-review.md (created/maintained)
- .ai/agents/ux.md (this)
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/app/integrations/page.tsx
- apps/web/app/threat-center/page.tsx
- apps/web/app/mssp/page.tsx
- apps/web/app/trust-safety/page.tsx
- apps/web/app/demo/page.tsx
- apps/web/app/snapshots/[id]/page.tsx
- apps/web/app/api/health/route.ts
- apps/web/app/api/v1/health/route.ts
- apps/web/app/api/v1/[...path]/route.ts
- apps/web/app/globals.css
- apps/web/src/lib/periscan-api-client.ts (core fetch + error handling for all states)
- apps/web/src/components/snapshot-workbench.tsx (and .test)
- apps/web/src/components/integration-marketplace.tsx (and .test)
- apps/web/src/components/trust-safety-dashboard.tsx (and .test)
- apps/web/src/components/threat-center-workbench.tsx (and .test)
- apps/web/src/components/mssp-portfolio-dashboard.tsx (and .test)
- apps/web/src/components/snapshot-report-view.tsx (and .test)
- apps/web/src/components/public-demo-report.tsx (and .test)
- apps/web/src/components/health-status-card.tsx (and .test; discovered unused)
- packages/connectors/src/index.ts (manifests, connectable, mockSupported, SYNCRO_CONNECTOR_MANIFEST etc for new connectors audit)
- apps/api/src/app.ts (catalog route, integrations CRUD, health/sync routes)
- apps/api/src/runtime-services.ts (getIntegrationCatalog, createIntegration, getTrustSafetySummary via build, syncPersistedIntegration, getIntegrationHealth; healthStatus/lastSyncAt logic)
- docs/IMPLEMENTATION_STATUS.md, README.md, PRD.md, docs/PERISCAN_FULL_PRODUCT_PRD.md, docs/TRACEABILITY_MATRIX.md (cross-ref)
- AGENTS.md (followed exactly)

**Decisions:**

- No source code edits (per "NEVER create files unless absolutely necessary"; ux-review + agents + gap-backlog updates are required by task + prior .ai creation pattern; use write for new .ai/, search_replace for edits).
- Audit 100% via code reads + parallel greps (no live render possible reliably in CLI without full pnpm dev + browser; followed "read code + grep for loading, empty, error, fetch calls").
- Confirmed real API data everywhere except isolated labeled /demo sample (per real-first + spec).
- For new connectors: marketplace shows as connectable (if mockSupported + connectable in manifest; defaults + explicit for Syncro etc. pass); fields complete; trust-safety surfaces health/sync fields once connected (but liveness gap identified as P1).
- All journeys have _some_ states; gaps in consistency/polish/flash/actionability noted with severity.
- Added 2 P1 + 7+ P2 to gap-backlog (with full fields per format: ID, linked, affected, why, files, impl, tests, owning, validation).
- Update also traceability note in requirements (minor, via gap ref).
- No pnpm changes needed (no source); ran? see below.
- Followed user-empathy: described flows as user would experience (flash, "Never synced" after connect, nav friction).
- Visual: referenced CSS grids, pills, cards, chips, hero, panels, media query, dangerouslySetInnerHTML, iframe.

**Tests (manual or playwright):**

- Existing: component \*.test.tsx cover many empty/error (e.g. "No advisories...", "No integrations...", API error cases in mssp, control/AI empty in snapshot).
- Recommended (not run here): playwright e2e for full journeys (nav between all routes, auth flash absence, connect-mock-then-trust-health-visible, error injection via network, responsive viewports 360/720/1280, a11y tab/aria, filter zero states).
- Validation cmds (per AGENTS + .ai/status): pnpm --filter @periscan/web typecheck ; pnpm --filter @periscan/web test ; pnpm lint ; pnpm test (broader); after seed:demo + pnpm dev for manual nav/states on http://127.0.0.1:3000 ; full pnpm verify ; test:e2e.
- This run: no web source changes → typecheck not strictly required, but recommended for cleanliness.

**Risks:**

- Flash + health liveness could frustrate real users post connector expansion (P1 impact on Phase 2).
- Inconsistent nav may hide features (threat-center, mssp etc. under-discovered).
- If implementing fixes: risk of auth model touch (forbidden per AGENTS) — avoid; keep client-side session via existing /me + cookies.
- Over-auditing without running full e2e (but task scoped to code/grep).
- New gaps may require SPEC-UI updates in docs/TRACEABILITY + acceptance.
- Large connector file (packages/connectors/src/index.ts) — greps used to confirm Syncro/manifest fields without full read.

**Next action:**

- Orchestrator / Codex to pick up GAP-P1-005/006 (or assign FeatureEng + this UX for vertical).
- Implement fixes on ai/grok/ux-\* branch: shared auth hook + loading, sync wiring + client methods, nav shell, more states, typecheck+test+verify, update reviews + traceability + docs.
- Re-audit after (re-generate this + ux-review).
- Run targeted: pnpm --filter @periscan/web typecheck (to confirm no breakage from prior); full manual + e2e against seeded demo.
- Timestamp updates to activity-log + codex-handoff.
- If P0 surfaces from error states, escalate.

**Timestamp:** 2026-06-05 (session concurrent with P0 fixes + connector resume work).

**Status:** Audit complete; docs + backlog updated. UX gaps documented for closure per DoD (real nav + states + real data for all incl. new connectors). Ready for handoff.
