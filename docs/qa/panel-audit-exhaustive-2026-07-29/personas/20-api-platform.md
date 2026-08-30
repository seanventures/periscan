# Panel P20 — Platform API / Automation Engineer

**Date:** 2026-07-29  
**Persona:** Platform API / automation engineer (headless SOAR, SIEM hooks, SDK consumers, internal platform teams)  
**Lens:** Can an enterprise build reliable automation on Periscan without reverse-engineering the UI or guessing contracts?  
**Scope:** API routes (`apps/api/src/app.ts`), OpenAPI (`openapi-payloads.ts`, swagger registration), webhooks (`packages/webhooks`, `packages/shared` event catalog), MCP (`apps/api/src/mcp`), async ops, pagination, idempotency, proof-loop scriptability, engine/lab APIs  
**Method:** Code-grounded read-only audit; adversarial automation consumer posture  
**Previous panel:** ~3.9/5 — “Headless possible; webhook gaps” (U-08, U-21)

---

## Verdict

**Score: 3.6 / 5.0** (slightly lower than previous panel’s ~3.9 after exhaustive contract review)

**5.0 definition:** A platform team can (1) discover auth + security schemes in OpenAPI, (2) generate a correct client without hand-parsing live responses, (3) subscribe to a truthful, complete webhook catalog for the proof loop, (4) wait or long-poll for mission/job terminal states without busy-poll thrash, (5) run create → measure → remediate → verify as an idempotent scripted pipeline with bulk/filter pagination that matches docs, (6) use MCP as a safe read-only assistant without rate-limit holes, and (7) exercise engine/lab capabilities via first-class, policy-gated APIs—not only admin tool-intake theater.

**Why 3.6:** Real strengths—operationId discipline, signed webhooks, API-key auth, RLS binding, honest empty states, partial payload enrichment. But **contract lies** (pagination shapes), **dead catalog events** (`policy.denied`), **no wait semantics**, **no OAS security**, **thin webhook surface for the proof loop**, **idempotency only on niche mutation paths**, and **no shippable public SDK** keep this below enterprise automation grade.

---

## Top 5 moves to reach 5.0

1. **Webhook truth layer** — Emit or remove `policy.denied`; add `remediation.verified` / `verification.completed` / finding lifecycle; publish event payload schemas; add secret rotate + dead-letter redrive.  
2. **Pagination contract fix** — Document real shapes (`page`, `nextCursor`, `offset`) for every list op; stop using bare `listOf()` for paged endpoints; add cursor/offset to remaining unbounded lists (paths, remediations).  
3. **OAS security + versioning** — `components.securitySchemes` for Bearer `psk_` + session cookie; global `security`; bump API `info.version` with changelog; document required headers (`x-tenant-id` where applicable).  
4. **Async completion API** — `POST/GET …/wait` or SSE/long-poll for mission/job/run terminal states + Operation resource for multi-step proof loops.  
5. **Proof-loop automation pack** — Idempotency-Key on createMission/startMission/createRemediation/verify; bulk disposition/assign; published example scripts + thin official client (or codegen from truthful OpenAPI).

---

## Feature-zoo / IA notes (API surface)

| Action | Surface | Rationale |
|--------|---------|-----------|
| **Keep / elevate** | Missions, jobs, findings, attack-paths edge validate/receipts, remediations verify, evidence chain, webhooks, API keys, OpenAPI route, async-operations workspace | Heart of headless proof loop |
| **Demote from “platform ready” narrative** | Third-party tool intake/work-orders/promotion packages, extension developer workspace, model-gateway tool approvals, swarm/A2A theater | Huge route surface, weak customer automation ROI until loop events/pagination are fixed |
| **Merge** | Signal triggers + threat alerts + validation-ops into one “automation triggers” doc tag / event family | Fragmented event story for SOAR integrators |
| **Cut (docs/marketing)** | Claims of full webhook catalog completeness, SDK-ready OpenAPI | Docs/contracts oversell |
| **Hide behind Labs until APIs mature** | MCP on product rail (agree with Jobs/Horowitz); keep MCP API but don’t market as SOAR plane | Read-only MCP is fine; product IA oversells |

---

## What is already excellent (do not break)

1. **operationId + summary + tags on every route** — `openapi-coverage.test.ts` enforces uniqueness; prevents silent undocumented drift.  
2. **Signed webhook delivery** — HMAC `x-periscan-signature`, stable `x-periscan-idempotency-key` = deliveryId, event header, worker + dead-letter audit.  
3. **API keys as Bearer `psk_…`** mapped to role via scopes (`read`/`write`/`admin` → Viewer/SecurityEngineer/Admin).  
4. **Webhook emission isolation** — `emitWebhookEvent` swallows fan-out failures so business ops never block.  
5. **MCP tools are intentionally read-only** and tenant-scoped (comment + registry exclude mutators).  
6. **Payload enrichment philosophy** — Doc-only OpenAPI augmentation without Fastify response stripping (correct for evolving DTOs).  
7. **Async operations reconciliation** — Honest terminalization of stuck jobs/tasks without silent replay of denied work.  
8. **Mission list has real cursor pagination** (`items` + `nextCursor`) in service layer.  
9. **Findings/audit list routes implement `hasMore` via limit+1 fetch** — right pattern when documented.  
10. **Safety floor in policy package** — Denied never proceeds; aligns with product truth if webhooks ever emit it.

---

## Findings

### FINDING | P20-1 | P0 | bug | api | policy.denied is cataloged and subscribable but never emitted
- **Persona:** Platform API / automation engineer
- **Evidence:** `packages/shared/src/domain.ts` `WebhookEventTypeSchema` includes `"policy.denied"`; admin UI `apps/web/src/components/admin-console.tsx` `WEBHOOK_EVENTS` lists it; create-webhook tests accept it. Call graph of `emitWebhookEvent` / `emitTenantWebhook` only: worker `mission.completed|mission.failed`, `snapshots.ts` `snapshot.ready`, `remediation.ts` `remediation.created`. Policy denials throw `policy_denied` / gate `"Denied"` in runner/snapshots/policy — **zero** webhook emit on that path.
- **Problem:** Customers can subscribe to `policy.denied` and build SOAR “denied = open ticket / page owner” automations that **never fire**.
- **Impact:** Integration trust break; silent compliance gap (“we thought denials were exported”); matches previous panel **U-08**.
- **Recommendation:** Either (a) emit `policy.denied` with policyDecisionId, missionId/scopeId, rationale when gate is Denied / job status DeniedByPolicy, or (b) remove from schema + UI until implemented. Prefer (a). Add acceptance test: deny → delivery row.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-08

### FINDING | P20-2 | P0 | bug | api | OpenAPI list schemas omit real pagination envelopes (docs lie)
- **Persona:** Platform API / automation engineer
- **Evidence:** Runtime `listFindings` returns `{ items, page: { hasMore, limit, offset } }` (`apps/api/src/app.ts` ~8777–8807). Runtime `listAuditEvents` same shape (~8184–8191). Runtime `listMissions` returns `{ items, nextCursor }` (`services/validation.ts` ~145–148). OpenAPI `listOf()` only models `{ items: [...] }` (`openapi-payloads.ts` ~346–357); `listFindings` / `listAuditEvents` / `listMissions` all use `listOf(...)` without `page` or `nextCursor`. Findings OpenAPI lacks `offset` query param entirely; audit OpenAPI documents `limit` but not `offset` though handler supports offset.
- **Problem:** Generated clients and integrators that trust OAS miss pagination and mis-parse responses or infinite-loop on first page.
- **Impact:** Headless automation against large tenants is **incorrect by contract**; previous panel **U-21**.
- **Recommendation:** Introduce shared `PageEnvelope` / `CursorEnvelope` JSON Schemas; map each list op honestly; document `offset`/`cursor`/`limit`; add contract tests comparing swagger schema required properties to fixture responses.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-21

### FINDING | P20-3 | P1 | feature | api | No wait / long-poll / Operation-status endpoints for async proof work
- **Persona:** Platform API / automation engineer
- **Evidence:** Mission lifecycle: `POST /api/v1/missions`, `POST …/start`, `GET …/jobs/:jobId`, `GET …/missions/:id/runs/:runId` — all synchronous request/response; no `/wait`, no `202 + Location`, no SSE completion stream. `async-operations` only offers workspace/policy/reconcile/recovery-decisions — ops reconciliation, not customer wait-for-run. MCP stream GET returns 405 (no SSE).
- **Problem:** Automation must busy-poll missions/jobs with no server-guided backoff, etag, or terminal-event subscription beyond thin webhooks.
- **Impact:** Rate-limit pressure (600/min default), flaky pipelines, hard to compose “create → start → wait → snapshot → remediate → verify” in CI/SOAR.
- **Recommendation:** Add `GET /api/v1/missions/:id/wait?timeoutMs=` (or job-level) returning 200 terminal body or 408; optionally `AsyncOperation` resource with status URL; document poll interval headers (`Retry-After`).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (API platform / headless)

### FINDING | P20-4 | P0 | improvement | api | OpenAPI lacks securitySchemes — auth is discoverable only by tribal knowledge
- **Persona:** Platform API / automation engineer
- **Evidence:** Swagger registration (`app.ts` ~1624–1630) only sets `info.title` + `info.version: "0.2.0"` — no `components.securitySchemes`, no per-operation `security`. Auth is cookie session or `Authorization: Bearer psk_…` (`getApiKeyToken` / `getAuthContext`). `openapi-payloads` never injects security. API reference consumers get paths without “how to call”.
- **Problem:** Codegen clients ship unauthenticated; RFP/enterprise API packs fail security section completeness.
- **Impact:** Blocks “API-first” enterprise narrative; every integrator re-reads source.
- **Recommendation:** Declare `ApiKeyBearer` (http bearer, description: `psk_` prefix) + `SessionCookie`; default security on non-system routes; document tenant header behavior (API keys ignore tenant header).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-21 (adjacent contract honesty)

### FINDING | P20-5 | P1 | improvement | api | Webhook catalog is thin vs product event vocabulary
- **Persona:** Platform API / automation engineer
- **Evidence:** Only five enum values: `mission.completed`, `mission.failed`, `snapshot.ready`, `remediation.created`, `policy.denied` (`domain.ts` ~878–884). Audit map includes `verification.run`, `remediation.ready_for_verification`, ticket events, etc. (`runtime-services.ts` audit action map) but none are webhook types. `verifyRemediation` writes `verification.run` audit and updates state — **no** `emitTenantWebhook`.
- **Problem:** Proof-loop automation cannot subscribe to “Fixed only after retest” outcome—the product’s flagship claim—via webhooks.
- **Impact:** SOAR must poll remediations/verification-events; previous panel **U-21** “no remediation.verified”.
- **Recommendation:** Add at least: `remediation.verified` (payload: remediationId, outcome, evidenceIds), `finding.updated` (status/disposition), `mission.started`, `job.denied_by_policy` (or fold into fixed `policy.denied`). Version the catalog.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-21

### FINDING | P20-6 | P1 | improvement | ai-agents | MCP is correctly read-only but incomplete for analyst copilots and rate-limit bypassed
- **Persona:** Platform API / automation engineer
- **Evidence:** `mcp/tools.ts` documents READ-ONLY; tools: findings list/get, attack paths, control coverage, scopes, executive posture, search — **no** remediations, missions, jobs, evidence, verification events. `POST /mcp` registers `config: { rateLimit: false }` (`app.ts` ~2374–2377) while global API limit is 600/min.
- **Problem:** Good safety (no mutators) undermined by (1) incomplete read surface for the proof loop and (2) unlimited MCP JSON-RPC throughput per key/IP.
- **Impact:** Copilots cannot answer “what’s waiting verify?”; abused MCP can DoS DB more easily than REST.
- **Recommendation:** Keep write ban forever; add read tools for remediations, open missions, evidence-by-finding; re-enable rate limit (or lower dedicated MCP budget); require API key scopes include `read`.
- **Effort:** M
- **Zoo-related:** yes (MCP product rail oversell — demote to Labs until complete)
- **Previous-panel-link:** theme (Jobs/Horowitz hide MCP; API prior ~3.9)

### FINDING | P20-7 | P1 | feature | api | Idempotency is local, body-only, and missing from core proof-loop POSTs
- **Persona:** Platform API / automation engineer
- **Evidence:** Idempotency keys exist for remediation **actions** and **infrastructure changes** (body field `idempotencyKey`, unique per tenant) and some agent-trust paths. `createMission`, `startMission`, `createRemediation`, `verifyRemediation`, scope create, ticket create — no `Idempotency-Key` header support, no body key. Webhook outbound has delivery idempotency headers (good) but inbound API mutations mostly do not.
- **Problem:** Network retries double-create missions/remediations; automation frameworks (Temporal, Step Functions) cannot safely at-least-once POST.
- **Impact:** Duplicate validation spend, duplicate tickets, confused audit trails.
- **Recommendation:** Standard `Idempotency-Key` header middleware for selected POSTs; store hash of canonical body; return first response on replay; document in OAS.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P20-8 | P1 | feature | api | No first-class proof-loop scripts / SDK package for automation consumers
- **Persona:** Platform API / automation engineer
- **Evidence:** Hand-written client lives inside web app (`apps/web/src/lib/periscan-api-client.ts`) — not a published workspace package. Root `package.json` has no SDK/codegen pipeline. `infra/terraform/periscan-provider` README describes openapi-generator **sim**. Lab scripts (`scripts/qualify-oss-proof-engines.ts`, `test-runner-lab.sh`) qualify engines offline, not customer API loops. Acceptance tests exist but are not shippable customer examples.
- **Problem:** External platform teams have no supported Python/TS SDK or “hello proof loop” script against the public API contract.
- **Impact:** Integration tax high; support burden; Wave/RFP “API ecosystem” weak.
- **Recommendation:** Extract `@periscan/client` from shared schemas + truthful OpenAPI; add `examples/proof-loop.sh` (create scope → mission → poll/wait → remediate → verify); pin to `info.version`.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (API-first breadth without consumability)

### FINDING | P20-9 | P1 | improvement | api | Async operations API is operator reconciliation, not a general async jobs fabric
- **Persona:** Platform API / automation engineer
- **Evidence:** Routes: `GET /async-operations/workspace`, `PUT …/policy`, `POST …/reconcile`, `POST …/recovery-decisions`. Service intentionally: “Reconciliation only marks objectively stale work terminal. Recovery creates a new Draft mission… never directly replays work.” No per-job Operation ID returned from `startMission`.
- **Problem:** Name suggests Azure/AWS-style async operations API; reality is admin stuck-work tooling.
- **Impact:** Integrators searching OpenAPI for “async” wire the wrong product; still need custom pollers.
- **Recommendation:** Rename tags/docs to `async-operations-reconciliation`; introduce separate `operations` resource if wait semantics land; document non-goals in API reference.
- **Effort:** S (docs) / L (real operations resource)
- **Zoo-related:** yes (naming zoo)
- **Previous-panel-link:** none

### FINDING | P20-10 | P2 | improvement | api | OpenAPI product version stuck at 0.2.0 without changelog discipline
- **Persona:** Platform API / automation engineer
- **Evidence:** `app.register(swagger, { openapi: { info: { title: "Periscan API", version: "0.2.0" }}})` only. No `servers`, no `externalDocs` to changelog, no deprecation headers policy in OAS. Payload registry is partial-by-design (honest comment) but version never bumps when catalogs change.
- **Problem:** Consumers cannot pin compatibility or detect breaking webhook/schema changes.
- **Impact:** Enterprise change-management fail; “0.2.0” signals pre-product.
- **Recommendation:** Semver `info.version` from package/release; `CHANGELOG-API.md`; sunset headers for retired routes (e.g. asset valuation 410 already exists—document pattern).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P20-11 | P1 | feature | api | No bulk mutation APIs for findings/remediations/assignments
- **Persona:** Platform API / automation engineer
- **Evidence:** Findings: list/get/approve-risk (individual). Remediations: per-id ticket/action/verify. Only true “batch” import is third-party tool candidate intake (`…/intake/candidates/import`) — engine governance, not SOC queue ops. No bulk disposition, bulk owner assign, bulk reverify.
- **Problem:** SOC automation and MSSP multi-tenant scripts N+1 every finding.
- **Impact:** Hits rate limits; poor for 1k+ finding tenants; weak vs RBVM/SOAR peers on queue hygiene APIs.
- **Recommendation:** `POST /api/v1/findings/bulk` (disposition, owner, max 100 ids, partial results); `POST /remediations/reverify-due` already exists—extend with explicit id list bulk verify preview.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-11 / Slice 4 (findings ops)

### FINDING | P20-12 | P1 | feature | engines | Engine / Lab API needs are under-served for customer automation
- **Persona:** Platform API / automation engineer
- **Evidence:** Module catalog `GET /api/v1/modules` is list-only. Third-party tool surface is deep (intake, work orders, promotion, certification, runner dispatch) but oriented to **catalog governance**, not “run nuclei profile X on scope Y and stream evidence.” External validation has profiles/attempts (`/api/v1/external-validation/*`) — good Slice 2 workbench, but not generalized engine lab. Offline `scripts/qualify-oss-proof-engines.ts` runs modules in-process/docker—not via tenant API. Path edge validate exists (`…/edges/:edgeId/validate`) but no unified Lab Run DTO.
- **Problem:** Platform teams cannot script engine qualification or multi-module lab campaigns as first-class tenant-scoped jobs with policy decisions.
- **Impact:** Runner/lab ops stay human-UI; slows design-partner “show us your engines” diligence.
- **Recommendation:** `POST /api/v1/lab/runs` (moduleIds[], scopeId, safetyLevel, policyDecisionId required) → job + evidence; status in jobs API; webhook `lab.run.completed`. Keep destructive modules gated.
- **Effort:** L
- **Zoo-related:** yes (tool-intake zoo vs lab run wedge)
- **Previous-panel-link:** theme (Slice 9 scaffold engines gated)

### FINDING | P20-13 | P2 | bug | api | Unbounded list endpoints for core entities (paths, remediations)
- **Persona:** Platform API / automation engineer
- **Evidence:** `GET /api/v1/attack-paths` returns full `listAttackPaths` with no limit (`app.ts` ~9037–9054). `GET /api/v1/remediations` same (~9420–9437). Contrast findings/missions which paginate. OpenAPI still `listOf` only.
- **Problem:** Large tenants serialize entire graphs into one response; memory + latency cliffs for API clients and UI.
- **Impact:** Production automation timeouts; encourages clients to cache stale full dumps.
- **Recommendation:** Cursor/limit+hasMore on paths and remediations; default limit 50; filters by status/validationState.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-21

### FINDING | P20-14 | P2 | improvement | integrations | Webhook secret rotation and dead-letter redrive missing
- **Persona:** Platform API / automation engineer
- **Evidence:** `createWebhook` issues one-time `whsec_` secret; `updateWebhook` can change url/events/enabled only — **no rotate**. `listDeadLetteredWebhookDeliveries` is read-only (take 100); no `POST …/deliveries/:id/redrive` or replay.
- **Problem:** Secret compromise or endpoint migration requires delete+recreate; permanent failures need manual DB/ops.
- **Impact:** Ops burden; security hygiene gap for enterprise webhook receivers.
- **Recommendation:** `POST /webhooks/:id/rotate-secret` (returns new secret once); `POST /webhooks/deliveries/:id/redrive` resetting attempts under admin role; document signing verification samples.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-21

### FINDING | P20-15 | P2 | security | api | Rate-limit key uses raw API key material
- **Persona:** Platform API / automation engineer
- **Evidence:** `keyGenerator` returns `` `key:${apiKey}` `` with full Bearer `psk_…` token (`app.ts` ~1605–1609). Fastify rate-limit stores keys in memory/redis depending on config—full secret becomes cache key.
- **Problem:** Token material appears in rate-limit stores, logs of store dumps, or debug metrics labels.
- **Impact:** Credential leakage surface; violates common API key handling guidance.
- **Recommendation:** Hash key (SHA-256) or use apiKeyId after auth; never store raw secret as rate-limit identity.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P20-16 | P2 | improvement | api | Webhook payload schemas not published (type-only catalog)
- **Persona:** Platform API / automation engineer
- **Evidence:** Event body envelope in `packages/webhooks/src/signing.ts` (`id`, `type`, `tenantId`, `createdAt`, `data`) is implementation detail; OAS does not document per-event `data` shapes. Emitters send ad-hoc payloads (e.g. mission: `{ missionId, status }`; remediation: ids only).
- **Problem:** Receivers cannot generate typed handlers; breaking field changes go unnoticed.
- **Impact:** Fragile SOAR mappings; support tickets.
- **Recommendation:** Zod schemas per event type in `@periscan/shared`; export JSON Schema under `/api/v1/webhooks/event-catalog`; contract tests on emit payload parse.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-21

### FINDING | P20-17 | P2 | improvement | api | API key scopes are role-coarse; not capability-scoped for automation least privilege
- **Persona:** Platform API / automation engineer
- **Evidence:** Scopes enum only `read|write|admin` → membership roles Viewer/SecurityEngineer/Admin (`apiKeyRoleForScopes`). A “write” key can create missions **and** manage many engineer-level mutations. No scope for `webhooks:manage`, `missions:run`, `findings:read`.
- **Problem:** SOAR integrations over-privileged or blocked; cannot give a key that only posts verification results or only reads findings.
- **Impact:** Enterprise IAM review friction; blast radius on key leak.
- **Recommendation:** Expand scopes (or resource permissions) for mission:run, remediation:write, webhook:admin, audit:read; enforce in `requireRole` sites or dedicated guards.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (enterprise buyer / CISO)

### FINDING | P20-18 | P2 | request | api | Partial OpenAPI payload coverage without machine-readable “undocumented payload” marker
- **Persona:** Platform API / automation engineer
- **Evidence:** `openapi-payloads.ts` header: coverage “partial-but-honest”; many operations have only operationId/summary from Fastify schema. Coverage tests enforce operationId presence, **not** request/response schema presence. Consumers cannot distinguish “schema omitted intentionally” vs “forgot.”
- **Problem:** False confidence when some ops have rich schemas and neighbors have none.
- **Impact:** Codegen quality uneven; platform team cannot set SLOs on doc completeness.
- **Recommendation:** Emit `x-periscan-payload-documented: true|false` extension per op; CI metric % documented; prioritize proof-loop ops to 100%.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme (API-first)

### FINDING | P20-19 | P3 | innovation | api | Dual auth modes undocumented for multi-tenant automation (cookie vs key + tenant header)
- **Persona:** Platform API / automation engineer
- **Evidence:** Session path uses cookie + optional tenant selection via `getRequestedTenantId`; API keys force single tenant and **ignore** tenant header (`getAuthContext` comment). MSSP portfolio uses cross-tenant patterns with RLS opt-out. None of this appears in OAS `parameters` as global headers.
- **Problem:** MSSP automation writers guess header names and multi-tenant sequencing.
- **Impact:** Slow MSSP integrations—otherwise a competitive strength.
- **Recommendation:** Document `x-periscan-tenant-id` (or actual header name) globally; MSSP examples for portfolio → client tenant key pattern; forbid session cookies for pure machine clients in docs.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme (MSSP multi-tenant architecture excellence)

### FINDING | P20-20 | P3 | improvement | ops | Evidence list is limit-only without hasMore/cursor
- **Persona:** Platform API / automation engineer
- **Evidence:** `GET /api/v1/evidence` uses `parseLimit` only; returns `{ items }` with no `hasMore`/`offset`/`cursor` (`app.ts` ~10817–10838). OpenAPI: `withLimitQuery(listOf(...))`.
- **Problem:** Clients cannot know if more evidence exists; proof-export automations silently truncate.
- **Impact:** Incomplete evidence packs for auditors via API.
- **Recommendation:** Same page envelope as findings; cursor by evidenceId/createdAt.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** Slice 7 (evidence explorer)

---

## Cross-walk to previous panel

| Prior ID / theme | This panel |
|------------------|------------|
| U-08 policy.denied dead | **P20-1** confirmed with full emit call graph |
| U-21 thin webhook + pagination lies | **P20-2**, **P20-5**, **P20-13**, **P20-16** |
| API ~3.9/5 headless possible | Revised **3.6/5** — headless possible for happy path; contracts unreliable at scale |
| Wave A #10 webhook truth | Still top priority; expand to verified events |
| Protect operationId discipline | Reaffirmed excellence; extend to payload + security completeness |

**Dissent:** Previous panel slightly over-scored OAS maturity (“operationId discipline” ≠ consumable OpenAPI). Auth model itself is sound; documentation of it is not.

---

## Scorecard (automation readiness)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Auth & tenancy | 4.0 | Keys + RLS real; scopes coarse; OAS silent |
| Contract honesty | 2.5 | Pagination/envelope lies dominate |
| Webhooks | 2.8 | Delivery engine solid; catalog/emit truth weak |
| Async / wait | 2.0 | Poll-only + misnamed async-ops |
| Idempotency | 2.5 | Islands of goodness |
| MCP | 3.5 | Safe reads; incomplete; rateLimit false |
| Bulk / scale lists | 2.5 | Findings ok; paths/remediations unbounded |
| Engine lab API | 2.5 | Modules exist; no customer lab-run API |
| SDK / examples | 2.0 | Web client only |
| **Overall** | **3.6** | Design-partner automation OK; not platform-of-record |

---

## Suggested acceptance tests (for implementers)

1. Subscribe `policy.denied` → force deny → assert delivery + signature.  
2. Snapshot OpenAPI JSON Schema for `listFindings` requires `page.hasMore`.  
3. `listMissions` schema requires `nextCursor`.  
4. OAS `components.securitySchemes` non-empty.  
5. MCP POST subject to rate limit (expect 429 under flood in test env).  
6. `verifyRemediation` emits `remediation.verified` when subscribed.  
7. Idempotent double `POST /missions` with same Idempotency-Key returns one missionId.

---

## Bottom line

Periscan is **API-first in architecture** (routes, shared Zod, runner poll, signed webhooks) but **not yet automation-first in contracts**. The single highest-ROI trust fix remains **webhook truth** (`policy.denied` + verification events) paired with **honest pagination OpenAPI**. Without wait semantics and idempotent proof-loop POSTs, every serious SOAR integration reinvents brittle pollers—and will mis-attribute flakiness to the product’s safety model rather than the missing platform glue.

**Ship posture for platform/API:** safe for design-partner scripts written by people who read the code; **not** ready as an enterprise integration platform-of-record.
