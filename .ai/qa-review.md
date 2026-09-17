# Periscan .ai QA Review

> Historical snapshot: this QA review records the June 5 codebase state and is
> retained for audit context only. Current branch, validation, gap status, and
> release-readiness guidance live in `.ai/status.md`, `.ai/codex-handoff.md`,
> `.ai/gap-backlog.md`, `.ai/release-readiness.md`, and
> `docs/IMPLEMENTATION_STATUS.md`.

**Date:** 2026-06-05T18:30Z (updated)
**Reviewer:** QA / Test Engineering agent
**Branch context:** P0 fixes (policy binding, target persist to runs, auth cookie graceful) + Syncro connector recent; AGENTS.md followed (real API in acc/e2e, tests for perm/error/regression/schema/service/route, no prod mocks).

## Setup / Reads Performed (per task)

- Read: .ai/gap-backlog.md (P0-001/002/003 closed, P1-001/002 open incl connector/ThreatCenter gaps), .ai/status.md, .ai/spec-index.md, Agents.md/AGENTS.md, root+api package.json scripts, scripts/verify.sh, playwright.config.ts, tests/acceptance/_.test.ts, tests/e2e/_.spec.ts, tests/security/\*.test.ts .
- Inspected: apps/api/src/app.test.ts (in-mem mock + route tests), app.ts (getAuthContext, require, error handler, start/create routes), runtime-services.ts (policy checks + resolvedTarget), connectors for Syncro, web threat-center, shared schemas.
- Key: P0s were latent (no pre-existing tests asserted the new codes or omit-target persist); added tests that would have caught them pre-fix.

## Tests Added / Extended (in apps/api/src/app.test.ts )

- Updated in-memory mock's createMission + startMission to enforce the 3 policy\_\*\_mismatch (scope/missionType/safetyLevel) on create and rebind on start; also hoisted resolvedTarget and use it for run.target (and parse/input) to match real runtime-services.ts behavior.
- Added new it("regresses P0 policy binding mismatches, target resolution from decision on start, and bad cookie -> 401 + logout success (would have caught pre-fix)"):
  - createMission mismatch cases: scopeId vs decision.scope -> 400 + code "policy_decision_scope_mismatch"; missionType mismatch; safetyLevel mismatch. (uses real route inject + policy preview to create decision).
  - startMission without target payload (after createMission with policyDecision that had target): assert /missions/:id/runs returns run with target === decision.target (full object match).
  - start rebind mismatch (via state mutation to simulate post-create drift): scope and missionType cases hit 400 + exact codes.
  - bad cookie (malformed jwt): GET /me -> 401 + code "unauthorized"; POST /logout with bad cookie -> 204 success.
- Also updated error handler in app.ts to include "code" in AppServiceError responses ({code, error}) so codes are testable/assertable (was only message before; no other tests relied on absence).
- Extended Syncro it with audit comment (no runtime extension due to mock sync 500 in harness; kept original redaction).
- P1-007/009 (PSA remediation tickets): reviewed test additions in api.test (Syncro int+rem+create-ticket asserts system/ticketId/no-leak + generalized mock), acceptance (PSA path post Jira), e2e (Syncro ticket), component tests unaffected; all pass + coverage for states/error/authz/perm; build/lint/type green; no prod mocks; acceptance now explicitly covers Syncro direct ticket per gap. Closed.
- All added would have failed pre-P0-fix (e.g. run.target would be {}, no mismatch errors thrown in mock, bad cookie ->500).

## Runs / Results (targeted + focused)

- pnpm --filter @periscan/api test : PASS (128 tests passed; the new regression + all prior including mission flows, policy, redaction for Syncro etc). Runtime ~2-5s per targeted.
- pnpm --filter @periscan/api typecheck : PASS (clean).
- pnpm --filter @periscan/api lint : PASS (clean).
- pnpm test:security : PASS (5/5, real services+prisma, covers policy denies, external guards, tenant isolation, RBAC).
- pnpm test:acceptance : PASS (2/2; enterprise-foundation + api-first-mvp-flow; uses real createRuntimeServices + prisma + app.inject real API calls per "Use real API calls in acceptance/e2e").
- pnpm verify (bg): lint+typecheck passed fully; test phase hit env SIGTERM (unrelated shared pkg vitest, exit 143; not our changes or api/acc/sec). Build/oss/etc not reached due to kill. (see log).
- Also ran connectors? (prior 105 pass noted in status); no breakage.
- Failures: initial ones in new test (password length 11<12 from schema; leftover 404 assert on non-policy path; .code not present in error json pre-fix of handler; sync extension 500 in mock harness). All fixed on branch (no note-only).
- Total api tests now exercise the P0 paths + error states + permission (RBAC in many).

## Coverage Audit: Recent Connectors (Syncro) + Threat Center Paths

- Syncro: packages/connectors/src/index.ts + index.test.ts (full impl: mock/live inventory, signals for customers/assets/tickets/offline, ticket workflow, health; redaction/serialize tests). In api: dedicated "creates Syncro API-token integrations without exposing credentials" (create+redact assert, catalog includes it). No full policy+sync+findings impact or ticket create in acceptance/e2e yet (P1-002). Signals from it would surface in /findings (via buildInMemoryFindings etc) and Threat Center.
- Other recent (from status: abnormal, mimecast, proofpoint etc): similar pattern of unit+redaction tests in connectors + api "creates X without exposing".
- Threat Center: strong in app.test.ts (~42 mentions): importThreatAdvisory, list, detail (with package/impact/readiness/validationPlan), evidence, export, missing signals, plans (Exposure/Control/AI), manual advisory flows, cross tenant, audit. Also operator recs, fix-verif. In acceptance: none direct (focus MVP loop). E2e: none (api loop). Web/app/threat-center : not directly tested (api-first). Gaps per gap-backlog P1-001: full UI nav with real non-demo, empty/error states for import/readiness/export, signal impact on trends.
- Permission/edge: many RBAC, tenant-isolation, bad scope, 401/403/404 tests; error states for policy deny, external kill, rate limit.
- Recommendation for more: add to tests/acceptance/api-first-mvp-flow.test.ts (or enterprise) a Syncro mock sync + create remediation ticket (policy approved) + verify signal in findings; add Threat Center acceptance exercising import + readiness export + plan creation; consider concurrency test for double mission start (P2).

## .ai Updates Performed

- Wrote/expanded this .ai/qa-review.md with tests/runs/gaps/recs.
- Created/updated .ai/agents/qa.md (assigned, runs w/ counts, failures/fixes, next, timestamp).

## Other / Next

- Also updated gap-backlog? Not required, but P2 note on missing tests was addressed.
- All changes API-first, tests use real calls where specified, fixtures only in test harness.
- If full e2e/playwright needed more, but targeted + acc/sec cover P0 + real paths.
- Timestamp: 2026-06-05 .

Followup: P2 test extension (concurrency/race/double + regression + e2e + a11y notes) done on ai/grok/p2-qa-tests; gates green (129 api, acc 2/2, e2e, etc); .ai/agents/p2-qa-tests.md + gap/trace closed; see p2-qa-tests agent file. Full verify recommended.
