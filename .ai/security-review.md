# Periscan .ai Security Review

> Historical snapshot: this security review records the June 5 codebase state
> and is retained for audit context only. Current branch, validation, gap
> status, and release-readiness guidance live in `.ai/status.md`,
> `.ai/codex-handoff.md`, `.ai/gap-backlog.md`, `.ai/release-readiness.md`,
> and `docs/IMPLEMENTATION_STATUS.md`.

**Date:** 2026-06-05T11:30Z (final after tests + fixes)
**Reviewer:** Security Engineering agent
**Branch:** ai/grok/security-p0-test-fixes-and-redaction-audit (from codex/resume-product-completion)
**Session tests run:** See below. All focused security + api + connectors + policy now green post-fixes.
**PRD/AGENTS/SECURITY_BOUNDARIES alignment:** Yes. Prioritized no secret leak, policy enforced pre-queue, no auth bypass. Adversarial review performed.

## 1. Startup Reads Performed

- .ai/\* (activity-log, codex-handoff, gap-backlog, requirements-traceability, spec-index, status, product/ux/arch/security-review.md initial, agents/orchestrator.md)
- AGENTS.md (full), SECURITY_BOUNDARIES.md (full), PRODUCTION_READINESS.md (full)
- tests/security/security-boundaries.test.ts (5 tests: scope/policy deny, rate limits, tenant evidence authz, unsafe modules, redaction + unsigned runner envelope)
- apps/api/src/app.ts (getAuthContext, requireAuthContext, error handler, all /integrations /missions /schedules /trust-safety /reports /audit paths)
- apps/api/src/runtime-services.ts (redactIntegrationConfigForResponse + shouldRedact + serializeIntegration, createMission policy binding checks, startMission re-binding + resolvedTarget logic + external guard + serialize in responses, createRemediationTicket + createJiraWorkflowTicket (generic sendWorkflowEvent), sync/health paths, audit writes, schedule, trust-safety, report, error paths)
- packages/connectors/src/index.ts (Syncro full + recent PSA/RMM/EDR etc manifests, collect/health/sync/sendWorkflowEvent, signal redactionStatus + rawPayloadPointer only, no secret in outputs)
- packages/connectors/src/index.test.ts (106 tests, Syncro + redaction no-contain asserts)
- packages/policy/src/\* (external-validation guards, rate, killswitch, blocklist, private target, scope match)
- packages/shared/src/api-contract.ts (ApiErrorSchema), domain etc for contracts
- apps/api/src/app.test.ts (P0 regression it + 20+ "without exposing secrets" + redaction unit + in-memory harness for policy/state)
- Also: runtime-services.test, security test harnesses, error paths in reports/evidence.

## 2. P0 Fixes Inspection + Verdict (PR#3 landed)

- **getAuthContext (app.ts:358-377)**: try { verify... } catch { return null; } then require throws 401. Logout uses getAuth (not require) so clears bad cookie. **Closed P0-003**. Graceful, no 500 leak, no info in errors. Good.
- **redact fn + serializeIntegration (runtime-services.ts:2652-2724)**: recursive redactIntegrationConfigForResponse using INTEGRATION_SECRET_CONFIG_KEY_PATTERN (covers apiKey, token, secret, pat, accessKey, clientSecret, ... ) + special for connectwise publickey + urls except webhook. Applied in: list/get/sync/create responses, health return, trust-safety connected list, snapshot reports (via evidence), executive trends. **Robust central point**. No bypass paths found in audit of all integration response sites.
- **createMission binding (runtime-services:13077-13116)**: if policyDecisionId provided, fetch + enforce scopeId match, missionType match, safetyLevel match -> specific 400 codes. **Closed P0-002 part**.
- **startMission binding + resolvedTarget (runtime-services:13338-13359 + 13446-13451 + 13579-13581)**: re-fetch decision, re-enforce scope/missionType/safetyLevel match (even if drifted) -> 400 codes + DeniedByPolicy. resolvedTarget = input.target ?? (decision.target as obj) ?? {}; used for: module constraints, external guard, run create target persist, job. **Closed P0-001 + P0-002**. Denied never queues (early return before tx/queue). Target always in persisted run (even if start omitted it).
- **Error response**: handler sends {code?, error}. Updated shared ApiErrorSchema + handler (for machine codes on policy/authz errors). Good.
- **Tests for P0**: The "regresses P0 ..." it in app.test.ts + security-boundaries now cover. Was broken (wrong expects 404 vs 400, missing code, state.policyDecisions not returned so drift mutation noop). Fixed on this branch (see edits). Now green.
- **Verdict on P0s**: All three closed correctly, no regression in redaction/policy/authz. No secret ever in error messages (fixed strings or fetch status only). **No new P0s found**.

## 3. New Connectors Audit (Syncro + recent spree e.g. HaloPSA, Autotask, N-central, Proofpoint etc)

- **Manifest pattern**: All declare authMethods with fields: secret:true for keys/tokens (apiKey, clientSecret, token, pat, ...); requiredPermissions read-only + "POST /tickets for workflow delivery only"; supportedMissionTypes include Continuous etc but workflow gated; healthCheckMethod explicit "read-only ...".
- **Syncro specifics (index.ts:25493-26252)**: apiKey secret:true; collect/load live only read paths (assertSyncroReadOnlyPath denies mutation paths); signals always: redactionStatus:"Redacted", rawPayloadPointer:"syncro://..." (no secret values, no full response); health: only GET /customers page=1 least-priv, detail says "No ... mutation endpoints were called"; sendWorkflowEvent: parses only needed, POST /tickets with payload from event (no echo of secret), returns only {status, ticketId, latency, ...} -- test asserts !contain secret in liveResult + liveDelivery.
- **Redaction in API layer covers**: apiKey etc matched by pattern (even "apiKey" -> apikey matches /api.?key/iu). create "without exposing" tests for Syncro + ~20 recent (Halo, Autotask, N-central, ...). All assert config.apiKey:"[redacted]", JSON.stringify no secret, 201 response.
- **Health no leak**: never returns config or secret in health object.
- **Workflow delivery only approved?**: sendWorkflowEvent invoked only from createRemediationTicket (requires SCOPE_EDITOR, remediation must exist from prior allowed mission/run/evidence). No direct public route for arbitrary workflow. Connector called with full config (secret) but impl never leaks it back (return is delivery result only). Policy decision + audit on original mission.
- **No raw secret in signals**: all recent use redactionStatus + pointers only. Evidence normalized later redacts again if needed.
- **Other paths (sync, list, get, trust-safety, reports)**: all go through serializeIntegration which redacts.
- **Verdict**: Follow redaction pattern. No leaks. Good. (20+ "without exposing" + connector 106 tests cover recent.)

## 4. Other Exposure Audit

- **Audit logs**: writeAuditEvent calls use fixed metadata (missionType, scopeId, moduleIds, outcome, rationale, denial codes) -- never full config, never secrets. Tenant/user scoped.
- **Error messages**: AppServiceError msgs are static (e.g. "Policy decision must match...", "Integration not found"). No secret interpolation. Global 500: "Internal server error." (no stack in prod). Connector health errors: "XXX health check failed: ${status}" -- status only.
- **Integration responses all paths**: list, get/:id, create (returns redacted), health (serialize after), sync (serialize + signals redacted), delete: all use serialize or omit config. Trust-safety: "connectedIntegrations": serialize list. Executive trends/snapshots: no secrets.
- **Schedule configs**: CreateSchedule stores audience/freq/scopeIds/missionType -- no integration config or secrets. runSchedule etc delegate to mission flows (policy gated).
- **Reports / evidence / remediation**: redactionLevel, redactEvidenceArtifact, evidence from redacted signals/runs. Shared report token no auth but content pre-redacted. No raw secrets.
- **Runner**: registration returns token only once (plain) at issue (to admin over session); stored hashed. Tasks signed (no secrets in envelope). Poll/result use tokens validated server side. No secret in responses.
- **Trust & Safety / CTEM / billing**: use serialize for integrations; operational readiness has no-secret labels only.
- **Client (web)**: all via real API (no secrets in UI state per real-first). No direct secret handling.
- **Verdict**: No exposure paths. Central redaction + "real data never raw" enforced. GAP-P0-004 effectively closed by audit (no other variants found leaking).

## 5. Rate Limits / Kill Switches / Abuse

- **External validation (runtime + policy/external-validation.ts)**: env-driven (PERISCAN*EXTERNAL_VALIDATION*\*): killSwitch, tenant/global limits + window, blockedTargets list, private/reserved IP/hostname denial (localhost, 10/127/192.168, fc00 etc), scope type/verified match, templateProfile safe only, executionEnv match. evaluate before queue; rate state mutated only on allow. Security test exercises tenant/global rate + kill + denied no queue.
- **Runner registration**: No hard rate-limiter middleware (Fastify default none), but: requires valid short-lived (issued) registration token (hashed, single-use via status/expiry), issued only by RUNNER_ADMIN role over auth session. registerRunner validates token server-side, issues short creds. Abuse limited by auth + token issuance audit. Signed tasks + scope on poll/result.
- **Other**: policy preview/decision per scope; RBAC on all mutating; tenant isolation in all prisma queries. No unauth paths to sensitive.
- **Verdict**: Kill switches/rates present and tested for external (high abuse surface). Runner gated by tokens. No bypass.

## 6. Tests Run (all green post fixes)

- pnpm test:security : 5/5 passed (security-boundaries.test.ts)
- pnpm --filter @periscan/api test : 128/128 passed (incl full app.test 126 + runtime 2; P0 regression + redaction + binding + auth + 20+ connector secret tests)
- pnpm --filter @periscan/connectors test : 106/106 passed (Syncro + redaction no-contain + workflow)
- pnpm --filter @periscan/policy test : 12/12 passed (guards + external-validation)
- pnpm --filter @periscan/shared test : 24/24 passed
- pnpm --filter @periscan/api typecheck : passed (post state literal fix)
- pnpm licenses:check : passed (38 node + tools + modules)
- pnpm audit --prod : 8 vulns (1 crit 3 high all transitive fast-xml-parser via @aws-sdk/\* in connectors; 1 mod postcss; low). Not direct; aws xml for trusted responses. Noted.
- pnpm --filter @periscan/api lint : 2 pre-existing any in app.test (unrelated to our changes)
- Manual: confirmed no secret in error responses, redaction in /integrations responses via test asserts.

## 7. Risks Closed (by P0 + this review)

- Secret leak in integration responses (P0 + central redact + tests): CLOSED
- Policy bypass on create/start (binding + revalidate + pre-queue deny): CLOSED
- External target omission (resolved + persist to run): CLOSED
- Auth error amplification / stuck sessions (catch->401): CLOSED
- Workflow delivery without approval (gated behind remediation from allowed mission): CLOSED
- New connectors leaking (pattern + per-connector + api redaction tests): CLOSED
- Error responses leaking (static + now with code): CLOSED

## 8. Open Risks / New Findings / P0/P1

- **Dep vuln (P2)**: fast-xml-parser (crit/high DoS/injection) via transitive @aws-sdk (bedrock/credential in connectors pkg, used by AWS/AI/cloud connectors). 381 paths. Not attacker-controlled input (aws responses). **Recommend**: upgrade @aws-sdk/\* when patched versions available; monitor. Not P0 (no secret exfil path).
- **P0 regression test fragility (fixed here)**: The added P0 it had incorrect status/code expects (404 vs 400 from binding errors; .code before handler/schema consistent) + state not exposing policyDecisions (drift noop, typecheck fail). Fixed (state literal+type, schema, handler already good). Added to traceability. No other P0.
- **Error code exposure (enhancement, not risk)**: Now {code, error} consistent. Good for clients (policy mismatch etc). Updated shared schema.
- **No other**: rate/kill/scope/authz/tenant/redact/runner signing all enforced + tested. No injection (zod+prisma), no log secrets, schedules/reports safe. No raw in primary UX per rule.
- **GAP-P0-004**: effectively closed (full audit of paths, all covered by serialize or no config). Remove from backlog?
- New P0: none. New P1: none from sec (dep is P2).

## 9. Recommendations

- Land this branch + PR (after full verify if time). Update gap-backlog/trace to mark P0 test fix + dep note.
- Add pnpm audit (or better, osv/trivy on lock) to verify.sh or CI (beyond licenses).
- For connectors using aws-sdk: consider pinning or optional dep if bedrock not core for MVP.
- Enhance security test with explicit .code checks now that ApiError includes it.
- Before first-customer: one real (non-mock) connector end-to-end with live creds + verified scope + remediation ticket (policy approved) to re-spot-check redaction + workflow.
- Monitor: any new connector must add "creates X without exposing" + connector test no-contain secret.
- No changes to auth model/runner/Prisma per AGENTS.

## 10. Assumptions Documented

- All product paths use the mocked/real services through Fastify (no bypass).
- Secrets only in integration.config (DB); never in signals/evidence/reports unless redacted.
- "Approved" workflow = remediation exists from prior policy-allowed mission (enforced by role + existence + original mission policy).
- Dep vulns low risk due to trust boundary (aws sdk internal).
- Tests cover the "in-memory" paths which mirror real for security properties.

P0 fixes + this review strengthen safety is product. All high priority (no secret leak, policy pre-queue, auth fail-closed) verified + hardened. Ready for orchestrator handoff.
P1-007 PSA tickets: added audit event on ticket create; authz/role still enforced server-side; no exfil (delivery detail redacted); reviewed in runtime + tests (no-leak asserts); compliant with safety (policy context from rem, denied never reach, verified scope implicit). No blocker.

**Timestamp:** 2026-06-05 (post all runs + fixes on branch)
**Next for sec:** Poll orchestrator; if green, update gap/trace; note dep in backlog.
