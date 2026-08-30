# Panel P03 — Application Security Engineer

**Date:** 2026-07-29  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Lens:** Application security — authn/z, isolation, policy PEP, runner trust, evidence integrity, SSRF, secrets  
**Sources inspected:** `SECURITY_BOUNDARIES.md`, `docs/SECURITY_BOUNDARIES.md`, `docs/THREAT_MODEL.md`, `packages/policy`, `packages/db/src/client.ts`, `apps/api/src/app.ts`, `apps/api/src/security.ts`, `apps/api/src/services/{auth,validation,runner,findings,remediation}.ts`, `packages/evidence/src/edge-receipts.ts`, `packages/policy/src/external-validation.ts`, `apps/api/src/threat-feeds.ts`, `apps/api/src/services/agent-trust.ts`, `packages/model-gateway/src/engine/policy-enforcement.ts`, `apps/web/middleware.ts`, `apps/web/app/api/v1/[...path]/route.ts`, `tests/security/*`, PREVIOUS_PANEL_SYNTHESIS  

**Method:** Adversarial code review against stated safety floor and STRIDE boundaries. Prefer code over docs. Docs write only.

---

## Verdict

**3.4 / 5.0** — **Conditional pass for design-partner / controlled pilot; not enterprise PoR without Wave-C hard gates.**

**5.0 definition (this lens):** Isolation and policy are unavoidable chokepoints (not convention); Fixed/Measured claims require cryptographic or pipeline-bound verification; runner transport is mTLS-by-default with mandatory result signing; external egress is post-resolve SSRF-safe; sessions/API keys are least-privilege with enforceable MFA policy; secrets are purpose-split and rotatable; residual risks in the threat model are either closed or explicitly accepted with compensating controls.

| Dimension | Score | Note |
|-----------|-------|------|
| Safety floor honesty | 4.5 | Real denied-never-queued, Fixed≠ticket-close, floor for destructive flags |
| Tenant isolation | 3.2 | App filters + write-path RLS; reads unbound by design |
| Dual policy gates | 3.0 | Preview strong; start gate incomplete (stale decision, no scope recheck) |
| Runner / mTLS | 3.5 | Signed tasks + mandatory result signing; mTLS still opt-in |
| Identity (JWT/session/API key/MFA) | 3.3 | Solid foundations; coarse scopes; no force-MFA; single HS256 secret |
| SSRF / external attack surface | 3.0 | Pre-request hostname guards; residual DNS rebinding |
| Evidence / Measured integrity | 2.8 | applyPathEdgeReceipt forge path undercuts proof loop |
| Enterprise auth packaging | 2.5 | Recovery routes gated (U-01); no SCIM/force-MFA |

Agrees with previous panel **Security Engineer B+ / U-20 (RLS reads, mTLS optional, DNS rebind)** and Wave C items 18–19. Dissents slightly: result signing is **no longer** merely opt-in at submit time (good); threat model residual text lags code on that point.

---

## Top 5 moves to reach 5.0

1. **Close Measured forge path** — `applyPathEdgeReceipt` must bind to a completed tenant validation run / signed runner result (or drop public write and only accept system-emitted receipts).  
2. **Make dual policy gates real** — at `startMission` (and schedule fire), re-run `evaluatePolicy` against current scope verification, offensive/destructive flips, and tenant policy; default-set and honor `expiresAt`.  
3. **RLS on reads for high-value tables** (or shared `runWithTenantRls` per request) so isolation is not “author remembered `where: { tenantId }`”.  
4. **Production defaults:** `PERISCAN_RUNNER_REQUIRE_MTLS=true`, post-resolve SSRF for external PoA + threat-feed + agent discovery, separate JWT secrets with rotation.  
5. **Enterprise identity package:** public recovery routes (U-01), force-MFA tenant policy, route-level API-key scopes (not role collapse alone).

---

## Feature-zoo / IA notes (security surface)

| Surface | Cut / merge / demote | Why |
|---------|----------------------|-----|
| Manual `applyPathEdgeReceipt` as product UX | **Demote to system/admin-only** or remove from public API | Undermines Measured honesty |
| Model-gateway “kill switch / blast radius / anomaly” stubs | **Demote or label NotImplemented** | Advertise-only controls create false assurance |
| Autonomous / Swarm / MCP primary rail | **Labs** until PEP stubs are real | Expands trust boundary before floor is complete |
| Dual threat-feed SSRF vs external-validation SSRF | **Merge one shared URL safety library** with post-resolve checks | Drift creates bypasses |
| Proof pack “RLS Pass” language | Keep, but **don’t claim full-query enforcement** | Write-path only today |

---

## What is already excellent (do not break)

1. **Hard safety floor** in `evaluatePolicy` for uncontrolled exploit chaining and destructive-class flags without destructive tier (`packages/policy/src/index.ts`).  
2. **Denied-never-queued** on hop launch and mission start (`findings.ts` launch, `validation.ts` decisionGate).  
3. **Ticket close → `ClosedWithoutEvidence`**, not Fixed (`remediation.ts` + `resolveExternalTicketClosedRemediationStatus`).  
4. **Outbound runner**, Ed25519 task envelopes, nonce replay, default-deny egress, **mandatory result signature on submit** (`services/runner.ts`).  
5. **Session JWT alg pin** HS256; prod refuses default secret; argon2id + lockout; MFA recovery codes hashed single-use.  
6. **API keys** hashed at rest, tenant-bound (header ignored), admin-create, rotate/revoke.  
7. **Evidence redaction before store** + tenant-namespaced keys.  
8. **Isolation matrix / RLS active-write tests** (`tests/acceptance/tenant-isolation-matrix.test.ts`, `tests/security/rls-tenant-isolation.test.ts`).  
9. **SSO can be enforced** (password sessions rejected when SSO enforced).  
10. **Web proxy header allowlist** (no arbitrary Authorization bleed from browser).

---

## Findings

### FINDING | P03-1 | P0 | bug | security | applyPathEdgeReceipt can forge Measured without a real validation pipeline
- **Persona:** Application Security Engineer  
- **Evidence:** `apps/api/src/services/findings.ts` `applyPathEdgeReceipt` (~1044–1218): role `SCOPE_EDITOR` only; accepts client `validationState`, `moduleId`, `outcome`, optional `missionId`/`validationRunId`/`policyDecisionId` without verifying they exist or belong to this edge; only checks `evidenceIds` are tenant-owned rows. `packages/evidence/src/edge-receipts.ts` `receiptMarksMeasured` upgrades hop to Measured when evidence IDs present and validationState not in non-upgrading set. Route: `POST` applyPathEdgeReceipt in `apps/api/src/app.ts` (~9258).  
- **Problem:** Any SecurityEngineer+ can mint arbitrary tenant evidence (or reuse unrelated artifacts), call apply, and stamp **Measured** on a path edge without a mission, runner result, or hop probe.  
- **Impact:** Breaks the product’s core integrity claim (“only say what you measured”). Auditors and CISOs treat Measured paths as proof; forged receipts become false Fixed/risk narratives and undermine U-06 / Slice 3 work.  
- **Recommendation:** Accept receipts only from control-plane completion of `launchPathEdgeValidation` / runner submit paths; require server-side linkage of `validationRunId` + module outcome; reject client-supplied Measured upgrades. Treat the public apply endpoint as admin break-glass with dual-control or remove it.  
- **Effort:** L  
- **Zoo-related:** no  
- **Previous-panel-link:** U-06 / theme proof integrity  

### FINDING | P03-2 | P0 | bug | security | Dual policy gate is incomplete: startMission does not re-evaluate policy or recheck verified scope
- **Persona:** Application Security Engineer  
- **Evidence:** Gate 1: `previewPolicyDecision` → `evaluatePolicy` in `apps/api/src/services/validation.ts` (~1135–1175). Gate 2: `startMission` uses `evaluatePolicyDecisionGate(decision)` (~595–633) which only inspects `approvalState` / `outcome` / `expiresAt` (`runtime-services.ts` ~949–983). Scope loaded (~635–648) **without** requiring `verificationStatus === "Verified"`. `evaluatePolicy` is **not** re-invoked. `expiresAt` is never set on create (~1157–1174).  
- **Problem:** A decision minted when scope was Verified and tenant policy allowed BASLite remains startable after scope is revoked/unverified, after maxSafetyLevel is lowered, or after offensive/destructive flips are turned off—until someone rejects/expires the decision (which rarely expires).  
- **Impact:** Safety floor depends on frozen rows, not live authorization. Violates “every validation action must be policy-checked” spirit and residual risk called out in `docs/THREAT_MODEL.md` §6.  
- **Recommendation:** On start (and schedule fire): re-run `evaluatePolicy` with current scope + tenant flips; deny if not startable; set default `expiresAt` (e.g. 24h) on create; re-bind target/safety. Keep binding mismatch checks as secondary.  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** theme dual policy gates / U-20  

### FINDING | P03-3 | P1 | bug | security | RLS backstop enforces writes only; reads remain correct-by-convention
- **Persona:** Application Security Engineer  
- **Evidence:** `packages/db/src/client.ts` lines 72–78 explicitly: RLS extended client binds **interactive `$transaction` writes only**; standalone reads use owner role with GUC unset. Comment in `requireAuthContext` (`app.ts` ~854–858) overstates “every tenant-scoped query.” Proof pack inspects policy presence (`tenant-isolation-proof.ts`) but does not change read-path binding.  
- **Problem:** A single missing `where: { tenantId }` on a `findMany`/`findUnique` is a silent cross-tenant disclosure; DB will not stop it.  
- **Impact:** Classic multi-tenant breach class; hard to catch in code review at monorepo scale. Previous panel U-20 remains valid.  
- **Recommendation:** Request-scoped `runWithTenantRls` for authenticated handlers on high-value tables (evidence, findings, remediations, attack paths, policy decisions), or selective FORCE RLS read paths with pool budgeting; CI gate: isolation matrix covers every new route.  
- **Effort:** L  
- **Zoo-related:** no  
- **Previous-panel-link:** U-20  

### FINDING | P03-4 | P1 | improvement | runners | Runner mTLS fingerprint enforcement remains opt-in
- **Persona:** Application Security Engineer  
- **Evidence:** `apps/api/src/services/runner.ts` `shouldRequireRunnerMtls()` → `process.env.PERISCAN_RUNNER_REQUIRE_MTLS === "true"` (~124–126); `authenticateRunner` only checks cert fingerprint when `requireMtls` (~92–118). Default is bearer-token-over-TLS alone.  
- **Problem:** Long-lived `prra_` tokens remain sufficient if env not set in production compose.  
- **Impact:** Stolen token impersonates runner; can poll tasks / attempt result submit (still needs result signing key for submit—mitigates measurement forge, not task leakage/DoS).  
- **Recommendation:** Default-on when `PERISCAN_DEPLOYMENT_ENVIRONMENT=production`; fail deploy health check if unset; document rotation SLA; pin terminator-forwarded fingerprint headers.  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** U-20 / Wave C-18  

### FINDING | P03-5 | P1 | bug | security | External validation SSRF guard is pre-resolve hostname only (DNS rebinding residual)
- **Persona:** Application Security Engineer  
- **Evidence:** `packages/policy/src/external-validation.ts` `isReservedIpAddress` / `evaluateExternalValidationGuard` (~212–352) checks string host/IP, not live resolution. Contrast: `apps/api/src/services/agent-trust.ts` `assertDiscoveryTarget` **does** `dns.lookup` then `isPrivateAddress` (~558–590). Threat feeds: `assertSafeFeedUrl` hostname/IP only (`threat-feeds.ts` ~78–108); `redirect: "error"` helps but not rebind.  
- **Problem:** Hostname can be public at policy time and rebind to `169.254.169.254` / RFC1918 at fetch time.  
- **Impact:** Control-plane or executor egress to metadata/internal services under attacker-controlled DNS for in-scope-looking domains (subdomain takeover / malicious NS).  
- **Recommendation:** Shared `assertSafeOutboundUrl` with: HTTPS only, blocklist, **resolve → re-check private ranges → connect to resolved address with host header pin**, no redirects. Use for external PoA, feeds, connectors, agent discovery.  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** U-20  

### FINDING | P03-6 | P1 | improvement | auth | API key “scopes” collapse to roles; no per-route least privilege
- **Persona:** Application Security Engineer  
- **Evidence:** `apiKeyRoleForScopes` (`runtime-services.ts` ~4892–4904): `admin`→Admin, `write`→SecurityEngineer, else Viewer. Auth path uses that role for all `requireRole` checks; no `requireScope("…")` on routes.  
- **Problem:** A CI key that only needs “create mission + read findings” still gets full SecurityEngineer surface if granted `write`.  
- **Impact:** Over-privileged automation keys expand blast radius after leak; fails enterprise least-privilege RFPs.  
- **Recommendation:** Persist fine scopes (missions:write, evidence:read, …); enforce at route layer; keep role mapping only as default ceiling.  
- **Effort:** L  
- **Zoo-related:** no  
- **Previous-panel-link:** U-19 enterprise identity  

### FINDING | P03-7 | P1 | feature | auth | No tenant force-MFA / step-up policy for privileged actions
- **Persona:** Application Security Engineer  
- **Evidence:** MFA is per-user optional (`auth.ts` login second factor only when `user.mfaEnabledAt` ~315–336). Endpoints for enroll/activate/disable exist (`app.ts` ~2106–2170). No tenant setting requiring MFA for Owner/Admin or for policy approval / API key create / offensive flip. SSO enforce exists; MFA enforce does not.  
- **Problem:** Admins can run full tenant without second factor.  
- **Impact:** Session cookie theft (XSS, device theft) yields full admin without MFA friction; enterprise buyers expect force-MFA (U-19).  
- **Recommendation:** Tenant policy `requireMfa: true`; block non-MFA sessions for admin roles; step-up for destructive config (offensive/destructive flips, API keys, kill switch).  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** U-19  

### FINDING | P03-8 | P1 | bug | auth | Auth recovery routes gated by Next middleware (session presence)
- **Persona:** Application Security Engineer  
- **Evidence:** `apps/web/middleware.ts` PUBLIC_PREFIXES = login, signup, demo, api, brand, _next, favicon — **not** `/reset-password`, `/accept-invite`, `/verify-email`. Unauthenticated users redirected to login with `?next=`. API password-reset/verify/invite endpoints exist as Public (`app.ts` ~1083–1086) but UI routes may be unreachable.  
- **Problem:** Self-serve recovery/onboarding broken without a pre-existing cookie.  
- **Impact:** Account lockout recovery and invite acceptance fail in production UX; security ops burden + social-engineering workarounds.  
- **Recommendation:** Add recovery/invite/verify paths to PUBLIC_PREFIXES; keep API public; honor `?next=` after login (U-10).  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** U-01  

### FINDING | P03-9 | P1 | improvement | auth | Single HS256 secret signs sessions and report-share tokens; no kid/rotation
- **Persona:** Application Security Engineer  
- **Evidence:** `apps/api/src/security.ts` `createSessionToken` / `createReportShareToken` both HS256 with caller secret; `app.ts` passes same `PERISCAN_JWT_SECRET` (~1410–1448) including as `interventionSigningSecret`. Prod only blocks default string (~1416–1419).  
- **Problem:** One secret compromise forges sessions **and** share links; no key versioning for rotation without global logout/share invalidation design.  
- **Impact:** High-value single point of failure; fails crypto hygiene for enterprise.  
- **Recommendation:** Separate secrets (session / report-share / intervention); add `kid` + dual-verify rotation window; store in KMS/SSM.  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** none  

### FINDING | P03-10 | P2 | improvement | security | CSRF reliance on SameSite=Lax alone; no double-submit token for cookie sessions
- **Persona:** Application Security Engineer  
- **Evidence:** Cookie options `httpOnly`, `sameSite: "lax"`, `secure` in prod (`app.ts` ~680–685, 1428–1433). No CSRF middleware or token on state-changing routes. CORS only when `PERISCAN_CORS_ORIGINS` set (~1578–1586). Browser uses cookie via same-origin proxy.  
- **Problem:** Lax blocks classic cross-site POSTs, but subdomain XSS, lax+GET side effects, or mis-set CORS+credentials can still create CSRF-like abuse. No defense-in-depth.  
- **Impact:** Medium in same-site deployment; rises if multi-subdomain or CORS widened for direct browser API.  
- **Recommendation:** Prefer `SameSite=Strict` for session where UX allows; add CSRF token for mutating cookie-auth routes; keep API keys Bearer-only (already).  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** none  

### FINDING | P03-11 | P2 | improvement | security | Web middleware treats any cookie presence as authenticated shell
- **Persona:** Application Security Engineer  
- **Evidence:** `apps/web/middleware.ts` ~28–38: `request.cookies.has(SESSION_COOKIE)` only — no signature/expiry check. Expired/malformed cookies still pass shell; API returns 401.  
- **Problem:** UX/auth confusion; potential cache of authenticated layout with empty data; logout/clear paths must be solid.  
- **Impact:** Low direct exploit; operational confusion; pairs with recovery route gating.  
- **Recommendation:** Lightweight JWT exp/nbf check in middleware (no DB), or edge call to `/me`; clear bad cookie.  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** U-01 / U-10  

### FINDING | P03-12 | P1 | bug | ai-agents | Model-gateway kill switch / anomaly / blast-radius are stubs returning safe defaults
- **Persona:** Application Security Engineer  
- **Evidence:** `packages/model-gateway/src/engine/policy-enforcement.ts` `getKillSwitchStatus` always `{ active: false }` (~59–63); `detectBehavioralAnomaly` regex heuristic (~89+); threat model §3 residual. Docs/UI may still describe kill switch as real.  
- **Problem:** False sense of emergency stop for frontier sessions; real PEP is allow/block lists + safety ceiling only.  
- **Impact:** If advertised in enterprise security questionnaires, this is a honesty/compliance gap; residual model tool abuse harder to stop mid-session.  
- **Recommendation:** Wire to real tenant kill-switch storage used by runner/AI validation, or mark NotImplemented and remove from readiness claims.  
- **Effort:** M  
- **Zoo-related:** yes  
- **Previous-panel-link:** theme AI surface demote  

### FINDING | P03-13 | P2 | improvement | security | pathEdge update in applyPathEdgeReceipt lacks tenantId in WHERE (defense-in-depth)
- **Persona:** Application Security Engineer  
- **Evidence:** `findings.ts` ~1167–1187: `prisma.pathEdge.update({ where: { pathEdgeId: edgeId }})` and `attackPath.update({ where: { pathId }})` without tenant compound key (relies on prior path lookup + write-path RLS).  
- **Problem:** If IDOR ever reaches this point or RLS GUC is unset, PK-only updates are broader than necessary.  
- **Impact:** Latent isolation bug class under regression.  
- **Recommendation:** Always use compound `where: { pathEdgeId, tenantId }` (or path relation filter); prefer `updateMany` with tenant scope.  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** U-20  

### FINDING | P03-14 | P2 | improvement | security | Fixed-without-verify is mostly closed for tickets; keep risk-band & UI honesty under regression
- **Persona:** Application Security Engineer  
- **Evidence:** Ticket close → `ClosedWithoutEvidence` (`remediation.ts` ~869–924); executive trends separate Fixed vs measuredClosureEvents (`runtime-services.ts` ~1879–1893); ACCEPTANCE_CRITERIA risk-band rule; SECURITY_BOUNDARIES “cannot be marked fixed without verification.” Risk remains if any future API allows direct status patch to Fixed or if finding status mapping ignores verification events.  
- **Problem:** Integrity is distributed across mappers; one new write path can reintroduce false Fixed.  
- **Impact:** Trust regression of flagship honesty claim.  
- **Recommendation:** Single `assertRemediationFixedAllowed(verificationEvent)` chokepoint used by all writers; security test forbids Fixed without measured verification event; UI must never paint Fixed from ticket state alone.  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** theme Fixed honesty  

### FINDING | P03-15 | P2 | improvement | runners | Runner egress DNS trust / IPv6 gap remains
- **Persona:** Application Security Engineer  
- **Evidence:** `apps/runner-agent/src/egress.ts` hostname/suffix/CIDR IPv4-only (~71–136); threat model residual: no IP pin after DNS. SOCKS CONNECT evaluates host string, not resolved A/AAAA set.  
- **Problem:** Allowlisted hostname can resolve to unexpected targets inside customer network; IPv6 never matches CIDR allow (deny-safe but incomplete allow path).  
- **Impact:** Scope confusion / potential internal pivot if DNS is attacker-influenced inside customer env.  
- **Recommendation:** Resolve, require all addresses in approved CIDRs, dual-stack policy; optional DNS pinning from control-plane signed constraints.  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** U-20  

### FINDING | P03-16 | P2 | improvement | security | Threat-model doc lag: claims no Prisma RLS while write-path RLS exists; understates result-signing mandate
- **Persona:** Application Security Engineer  
- **Evidence:** `docs/THREAT_MODEL.md` intro (~43–50) and residual (~436–442) still say isolation is convention-only / mTLS & result signing opt-in. Code: `packages/db/src/client.ts` RLS write binding; `runner.ts` mandatory result signing on submit (~2420–2442).  
- **Problem:** Operators and auditors following threat model under- or over-estimate residual risk.  
- **Impact:** Wrong control selection; false confidence or unnecessary panic.  
- **Recommendation:** Refresh threat model to: write-path RLS active, reads still conventional; result signing mandatory; mTLS still opt-in.  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** none  

### FINDING | P03-17 | P2 | feature | security | Secrets at rest for integrations/evidence encryption are env-optional
- **Persona:** Application Security Engineer  
- **Evidence:** Isolation proof reports `PERISCAN_EVIDENCE_ENCRYPTION_AT_REST` and `PERISCAN_INTEGRATION_CREDENTIAL_KEY` as NotConfigured when unset (`tenant-isolation-proof.ts` ~140–149). Model credentials fail closed in production without key (threat model §3) — good pattern not universal.  
- **Problem:** Production can run with connector secrets only partially protected depending on env.  
- **Impact:** Credential dump from DB backup more valuable.  
- **Recommendation:** Fail boot in production if integration credential key missing; require evidence encryption config for GA; document key rotation.  
- **Effort:** M  
- **Zoo-related:** no  
- **Previous-panel-link:** none  

### FINDING | P03-18 | P2 | improvement | api | `policy.denied` webhook catalog honesty (emit or remove)
- **Persona:** Application Security Engineer  
- **Evidence:** PREVIOUS_PANEL_SYNTHESIS U-08; audit writes `policy.decision` with Denied outcomes, but dedicated webhook event emission for `policy.denied` not consistently wired (grep shows limited emit paths).  
- **Problem:** Subscribers believe they receive deny events for SIEM correlation; silence looks like “no denials.”  
- **Impact:** Detection gap for abuse of policy surface; integration trust issue.  
- **Recommendation:** Emit `policy.denied` on denied start/preview with tenant isolation, or remove from catalog.  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** U-08  

### FINDING | P03-19 | P3 | improvement | ops | Rate limiter keying and trustProxy not proven in app path
- **Persona:** Application Security Engineer  
- **Evidence:** Threat model residual: limiter keys `request.ip` (`docs/THREAT_MODEL.md` §4). Auth rate 20/min exists (`app.ts` rate limit allowlist ~793+). Without correct `trustProxy`, all clients share one IP behind reverse proxy → shared lockout / ineffective limit.  
- **Problem:** DoS of legitimate users or ineffective brute-force protection.  
- **Recommendation:** Explicit `trustProxy` config in prod compose; document XFF trust only from edge; per-account lockout (already) remains primary.  
- **Effort:** S  
- **Zoo-related:** no  
- **Previous-panel-link:** none  

### FINDING | P03-20 | P3 | innovation | security | Make PEP unavoidable: policy proxy / interceptor for all execution entrypoints
- **Persona:** Application Security Engineer  
- **Evidence:** Architecture relies on each service calling `evaluatePolicy` / gates; threat model residual “no mandatory policy proxy.” New modules (schedules, stimuli, agent-trust, scenarios) each reimplement binding checks.  
- **Problem:** Future path can skip PEP accidentally (regression class).  
- **Impact:** Safety floor only as strong as newest author.  
- **Recommendation:** Single `executeValidationIntent({...})` that always previews+gates+queues; forbid direct missionQueue from services; lint/architecture test that queue producers only call that chokepoint.  
- **Effort:** XL  
- **Zoo-related:** no  
- **Previous-panel-link:** theme safety floor  

---

## Crosswalk to previous panel (U-series)

| Previous | This panel |
|----------|------------|
| U-01 recovery routes | **P03-8** confirmed, still P1 |
| U-08 policy.denied webhook | **P03-18** |
| U-19 SCIM/force-MFA | **P03-7** (force-MFA); SCIM still gap, not re-audited in depth |
| U-20 RLS/mTLS/SSRF | **P03-3, P03-4, P03-5, P03-15** refined with code line evidence |
| U-06 receipt durability | **P03-1** is the security-critical sibling: forge vs durability |

**Dissent / update:** Prior synthesis listed result signing as opt-in; **submit path now mandates** `resultSigningPublicKeyPem` + signature (`runner.ts` ~2420–2442). Keep that closed; do not re-open keyless submit.

---

## Ship / no-ship (security lens)

| Gate | Status |
|------|--------|
| Denied never queued on mission/hop start | Hold green |
| Ticket close ≠ Fixed | Hold green |
| Result signature required on runner submit | Hold green |
| applyPathEdgeReceipt cannot forge Measured | **Fail until P03-1** |
| Dual gate re-eval + verified scope at start | **Fail until P03-2** |
| mTLS default-on production | **Fail until P03-4** |
| Auth recovery public | **Fail until P03-8** (also product UX) |
| Force-MFA for admin (enterprise) | Soft fail for pilot; hard for 5k PoR |

**Recommendation:** Design-partner OK with documented residuals; **do not** claim enterprise multi-tenant isolation “by construction” or Measured-path integrity as absolute until P03-1/2 land.

---

## Appendix — primary files reviewed

| Area | Path |
|------|------|
| Contract | `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md` |
| Prior synthesis | `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` |
| Boundaries | `SECURITY_BOUNDARIES.md`, `docs/SECURITY_BOUNDARIES.md` |
| Threat model | `docs/THREAT_MODEL.md` |
| Policy PEP | `packages/policy/src/index.ts`, `external-validation.ts` |
| RLS client | `packages/db/src/client.ts` |
| Auth / JWT | `apps/api/src/services/auth.ts`, `apps/api/src/security.ts`, `apps/api/src/app.ts` |
| Dual gates | `apps/api/src/services/validation.ts`, `runtime-services.ts` `evaluatePolicyDecisionGate` |
| Receipts | `apps/api/src/services/findings.ts`, `packages/evidence/src/edge-receipts.ts` |
| Runner | `apps/api/src/services/runner.ts`, `apps/runner-agent/src/egress.ts` |
| SSRF samples | `apps/api/src/threat-feeds.ts`, `agent-trust.ts` |
| Security tests | `tests/security/rls-tenant-isolation.test.ts`, `security-boundaries.test.ts` |
| Web gate | `apps/web/middleware.ts`, `apps/web/app/api/v1/[...path]/route.ts` |

---

*End of P03 Application Security Engineer exhaustive panel.*
