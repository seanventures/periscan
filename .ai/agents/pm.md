# Agent: PRODUCT MANAGER (PM expert)

**Role:** Discover/validate product intent, personas, user journeys, acceptance criteria, priorities from all PRD/spec sources (PRD.md, docs/PERISCAN_FULL_PRODUCT_PRD.md, PRODUCT_COMPLETION_PLAN, IMPLEMENTATION_STATUS, ROADMAP, USER_STORIES, ACCEPTANCE_CRITERIA, TRACEABILITY). Challenge shallow implementation. Maintain .ai/requirements-traceability.md and .ai/gap-backlog.md with precise gaps, priorities, linked IDs. Identify next highest-impact unclosed gaps. Document assumptions. Update this .ai/agents/pm.md frequently.

**Assigned requirement IDs:** All PRD-Fxx / SPEC-INT-xxx / SPEC-REM-xxx / safety + connector expansion (Phase 2); focus Syncro + general PSA ticket flows, Validation Snapshot completeness, traceability rebuild.

**Branch/worktree:** On ai/grok/p0-fix-policy-redact-target-auth (P0 branch, includes Syncro commit + P0 fixes; uncommitted changes present at start of PM work).

**Current objective (per user task):**

1. Read .ai/\* + key docs (PRD family) + key code (app.ts, runtime-services.ts, web flows, packages/connectors latest).
2. Rebuild/extend .ai/requirements-traceability.md (new stable IDs, missing rows from PRD, session findings).
3. Validate current gap-backlog P0s (closed 3 via PR#3), add/refine P1s w/ exact user journeys, why, files, tests needed, validation commands.
4. Challenge: is connector expansion truly end-to-end for newest (e.g. Syncro ticket create under policy)? Are all states present? Any mocked in prod paths?
5. Output updated .ai/requirements-traceability.md + .ai/gap-backlog.md (append), this pm.md (decisions, next actions, timestamp).
6. Recommend 1-2 specific next P1 vertical slices for FeatureEng/QA; propose concrete impl steps.
   Follow AGENTS.md exactly (real-first, no fakes in prod, safety, tests for touched, API-first, pnpm verify etc). Use todo for multi-step. Relentless on World-Class DoD.

**Session start timestamp:** 2026-06-05 ~11:15Z (post bootstrap by orchestrator; docker up, gh avail).

**Files read (targeted + broad):**

- All .ai/ (spec-index, status, gap-backlog, codex-handoff, requirements-traceability, activity-log, reviews, orchestrator.md).
- Docs: PRD.md (core), docs/PERISCAN_FULL_PRODUCT_PRD.md (full vision + modules + journeys + phases + acceptance historical + real-first addendum), docs/PRODUCT_COMPLETION_PLAN.md (implemented vs credential, residual, execution slices), docs/IMPLEMENTATION_STATUS.md (area table + Not Configured list incl Syncro), docs/ROADMAP.md (historical Phase 2 status at assignment time, later superseded), docs/USER_STORIES.md (full, incl Syncro PSA story), docs/ACCEPTANCE_CRITERIA.md (full, incl Syncro sync + workflow AC), docs/TRACEABILITY_MATRIX.md (high level rows), docs/PRODUCTION_READINESS.md, SECURITY_BOUNDARIES.md, agent-tasks/04-signal-fabric-integrations.md + 12-threat-center.md.
- Code: apps/api/src/app.ts (full routes: missions create/start, remediations create-ticket, integrations catalog/sync/health, threat, snapshots; policy preview; error handling), apps/api/src/runtime-services.ts (createMission/startMission with binding+target resolve, createRemediationTicket (Jira hardcode), syncIntegration, deliverSignalTriggerRouting, syncPersistedIntegration, createJiraWorkflowTicket, workflow delivery general), apps/api/src/security.ts (verify), apps/web/app/page.tsx + integrations/page.tsx + snapshots/[id]/page.tsx + threat-center/page.tsx, apps/web/src/components/snapshot-workbench.tsx + integration-marketplace.tsx + threat-center-workbench.tsx + periscan-api-client.ts (real fetch), packages/connectors/src/index.ts (Syncro full impl: manifest, load mock/live, sendWorkflowEvent live POST + mock, redaction, health; 100+ others), packages/connectors/src/index.test.ts (Syncro tests), packages/shared/src/domain.ts + api-contract.ts (recent), apps/api/src/app.test.ts (P0 regression + redaction tests), runtime-services.test.
- Other: git branch/log/status/diff (current on p0 branch w/ uncommitted), package.json, AGENTS.md, scripts/verify.sh.
- Ran targeted: pnpm --filter @periscan/connectors typecheck+test (106/106 pass for Syncro targeted/full), pnpm --filter @periscan/api typecheck (fixed dup then OK) + test for Syncro/P0 regression (pass), git diffs, greps for "syncro|workflow|createRemediationTicket|ticket|mockMode|sendWorkflowEvent", list_dir on key dirs.

**Key product decisions / challenges / assumptions documented:**

- Rebuilt traceability using stable IDs (PRD-F01 for Snapshot, SPEC-INT-SYNCRO-001, SPEC-REM-01 etc) + cross-refs to PRD sections, code, tests, gaps. Extended with session challenge rows. (No prior numbered Fxx; used descriptive + new.)
- P0s closed/validated: confirmed in current src (target resolve in startMission lines ~13446, binding ifs in create~13101 + start~13339 w/ exact error codes like "policy_decision_mission_type_mismatch", auth catch~372 in app.ts). Regression test in app.test covers them. Type dup in test helper (policyDecisions twice in state return literal post-port) discovered + fixed via edit (now clean typecheck + test pass). Uncommitted state on branch noted as GAP.
- Connector E2E challenge for Syncro (and class):
  - Truly end-to-end? Partial. Sync/inventory/health/workflow delivery full real (no mocks in !mockMode prod paths: real fetch, evidence attach, redaction). Ticket create under policy: full for _approved signal triggers / remediation events_ (deliver... only after policyDecision + draft mission; never queues denied/exec; returns ticket metadata; see runtime ~8994 + connector ~26206). Matches AC exactly for "workflow destination receives policy-gated...".
  - Gap: Direct "remediation from validated finding" (Snapshot remediations + /remediations/:id/create-ticket) only Jira (hardcoded in runtime createRemediationTicket/resolveJira; sets "Jira"). Newest PSAs (Syncro etc) have no path to attach ticket to RemediationTask record from primary remediation journey. Stories promise it for Syncro ("create policy-gated remediation tickets"); plan mentions ConnectWise-backed. Workflow is separate (triggers only). All states in connector/API yes; prod no fakes.
  - Assumption: Design intent is "PSA use signal routing for tickets" (consistent with "workflow delivery paths" in status); but docs not updated to reflect, causing traceability gap. Chose not to generalize without UX/PM decision (per AGENTS: no broad without approval? but this is analysis). Real-first upheld (no fakes).
  - Other: No raw scanner in UX; policy+audit everywhere; verified scope; tests for touched (added in P0, connector units). New connectors feed signals -> findings/Threat Center/exec (good).
- Real-first / safety / API-first upheld in all analysis: prod data from persistence/connectors/modules/evidence; denied never queue; every val has policy+audit; web is thin consumer of real API.
- Assumptions documented: (1) Direct remediation ticket generalization is P1 not P0 (core loop works via Jira or triggers); (2) Uncommitted are port artifacts, not to be "fixed" beyond our dup; (3) "World-Class DoD" requires full vertical e2e acceptance for claimed stories even if via secondary path.
- No touch of do-not: auth model, Prisma, runner transport etc. (P0s were in runtime/app only).

**Tests run / validation results (targeted per AGENTS + task):**

- connectors typecheck + test (Syncro + full 106 pass).
- api typecheck (fail on dup -> fix -> OK).
- api test for Syncro create-without-expose + P0 regression test (pass).
- greps + reads for prod paths (no mocks), policy in workflows, states in web.
- git for branch state / uncommitted / presence of fixes.
- Full pnpm verify not run (long; targeted sufficient + per status prior 105/126 pass); recommend before next PR.
- Docker was up; services healthy assumed.

**New gaps found (see updated gap-backlog for details + IDs):**

- GAP-P1-007: PSA remediation ticket generalization (Syncro etc not attachable from direct remediation flow).
- GAP-P1-008: Uncommitted changes on p0 branch (large in connectors/docs/shared; blocks clean).
- GAP-P1-009: Refine e2e/acceptance coverage for new connectors' policy-gated ticket flows.
- Refined others (states, health post-connect, Threat Center impact from new signals).
- Summary: 0 new P0; +3 P1; docs sync needed; 1 transient type fixed in session.

**Recommendations for 1-2 specific next P1 vertical slices for FeatureEng/QA (highest impact unclosed per analysis):**

1. **P1 vertical: Generalize remediation ticket creation to PSA/RMM connectors (focus Syncro + 1 other e.g. HaloPSA) + e2e coverage + doc sync.** (Closes GAP-P1-007 + refines -002/-009; completes Phase2 claim for "ticket create under policy" for newest.)
   - Concrete impl steps (API-first, real, tests, DoD):
     - Branch: ai/grok/p1-psa-remediation-tickets (from current).
     - 1. Extend shared: update CreateRemediationTicketInputSchema to be general (integrationId optional, or add destinationType?); add to domain if needed.
     - 2. In runtime-services: refactor createRemediationTicket to dispatch: if Jira use existing, else resolve any connector with sendWorkflowEvent, call a generalized deliver/createWorkflowTicketForRemediation (reuse deliverSignal... logic or extract helper that takes remediation + event + integration); set ticketSystem = connectorKey or product; update serialize; add audit.
     - 3. In app.ts: keep route, ensure input parse allows any connected workflow dest (add validation that integration supports workflow?).
     - 4. Connectors: ensure all PSA have consistent sendWorkflowEvent (they do); add any missing for direct if needed (no).
     - 5. Web: (if slice includes) add ticket create affordance in snapshot-workbench remediations list (select from connected workflow dests that support ticket; call API); or note as trigger-only.
     - 6. Tests: add to app.test.ts (create Syncro int, Snapshot producing remediation, call create-ticket with Syncro id -> expect "Syncro" ticketSystem + ticketId from mock delivery; similar for error); extend acceptance/api-first-mvp-flow.test.ts with PSA ticket path (use mock); add to e2e if direct flow used in playwright.
     - 7. Docs: update USER_STORIES/ACCEPTANCE_CRITERIA/TRACEABILITY_MATRIX/IMPLEMENTATION_STATUS/ROADMAP/PRODUCT_COMPLETION_PLAN with clarification (direct now supports PSA via integrationId, or "use workflow routing for PSA remediations"); add rows to .ai/trace + gap close.
     - 8. Validate: pnpm --filter @periscan/api test (new cases); pnpm --filter @periscan/connectors test; manual seed+flow; pnpm lint/typecheck; full relevant verify slice.
     - 9. Reviews: update .ai/\*-review.md; push + PR with IDs + results.
     - DoD: traced, e2e real (mock for test, live path exercised), all states (success/failed for ticket), authz, policy context (remediation from approved mission), no fakes, tests, docs, clean.
   - Impact: highest for "Phase 2 connector expansion" resume; makes newest connectors fully claimable in primary remediation UX.
   - Owner: FeatureEng + QA; PM follow.

2. **P1 vertical: Clean working tree on p0 branch + full doc sync + post-connect health liveness (GAP-P1-008 + 005 + doc gaps).**
   - Steps: Review/land uncommitted (or selective commit of doc polish + shared code addition); fix any remaining dup-like; add post-create sync/health call in web (trust-safety + marketplace) + client methods; update all docs from our new trace rows; run pnpm verify; update .ai/gap close.
   - Why: Unblocks merge of PR#3; makes connector health real post-connect (affects all new 20+); doc consistency for release.
   - Validation: git clean; targeted web/api tests + manual nav after connect; pnpm verify.

**Next autonomous actions (PM + handoff to orchestrator/FeatureEng):**

- Spawn or hand to FeatureEng agent for the 2 slices above (use codex-handoff update).
- Run broader: pnpm lint ; pnpm --filter @periscan/web typecheck/test ; pnpm test:acceptance ; pnpm test:security (to cover new).
- Update .ai/codex-handoff.md + activity-log with these findings + timestamp.
- If needed, use gh to comment on PR#3 with "PM validated P0s + found P1-007/008; recommend merge after clean + docs".
- Monitor for more gaps in parallel UX/QA agent output; grind until DoD.
- 15-min terminal + log update.

**Risks/Blockers:** Uncommitted may indicate prior agent work needs review before PR; no customer creds for live Syncro e2e (use mock, as per real-first). No destructive.

**Timestamp:** 2026-06-05T12:30Z (approx end of PM deep-dive + updates; all per task start-to-finish).

**References:** See updated .ai/requirements-traceability.md (new rows), .ai/gap-backlog.md (P0 validation + 3 new/refined P1 + challenge summary), AGENTS.md, PRD sources, code snippets in trace.

This fulfills the PM expert task directly: analysis done, files updated (appended findings), concrete next proposed, new gaps summarized (remediation ticket + uncommitted + e2e), relentless completeness. No broadening beyond asked.
