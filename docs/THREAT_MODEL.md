# Periscan Platform Threat Model

Status: living document — reflects the code in the working tree as of this
revision. Every mitigation below is grounded in a concrete file (and where
useful, a line/function). Where a control is partial, opt-in, or a stub, this
document says so plainly rather than overstating it. Aspirational controls are
called out as residual risk, not mitigation.

## Purpose & scope

This threat model covers the Periscan control plane (`apps/api`), the
customer-hosted in-network runner (`apps/runner-agent`), the model gateway
(`packages/model-gateway`), the evidence store (`packages/evidence`), the policy
engine (`packages/policy`), and the shared data model (`packages/db`,
`packages/shared`). The web app (`apps/web`) is treated as an untrusted client
that talks to the API through a header-allowlisting proxy
(`apps/web/app/api/v1/[...path]/route.ts`).

Threats are classified **STRIDE** (Spoofing, Tampering, Repudiation,
Information disclosure, Denial of service, Elevation of privilege).

### Assets

- Tenant security data: findings, attack paths, evidence, missions, snapshots,
  audit trail (all `TenantScopedEntity`, `packages/shared/src/domain.ts:752`).
- Secrets: session-signing key, API keys, runner auth tokens + signing keys,
  BYO model-provider credentials, integration credentials.
- The **offensive-validation authorization** flag — the switch that lets a
  tenant run adversarial validation.
- Integrity/provenance of measured results produced inside a customer network.

### Trust boundaries (the six sections below)

1. Multi-tenant isolation (every request → tenant data).
2. The in-network runner (SaaS control plane ⇄ customer-network agent).
3. The Frontier / model gateway (platform data + tools ⇄ frontier models).
4. API-key & session lifecycle (client identity → authenticated context).
5. The evidence store (raw captured data → persisted, redacted, tenant-scoped).
6. The offensive-validation flip / policy floor (tenant intent → what may run).

### Architectural note that colours every boundary

Isolation and policy are enforced **primarily by convention at each call site**,
with a Postgres RLS **write-path** backstop — not a full-query chokepoint. The
Prisma client (`packages/db/src/client.ts`) binds interactive `$transaction`
mutations to `SET LOCAL ROLE periscan_rls` + `app.current_tenant` when
`enterTenantRlsContext` has run after auth. **Standalone reads** still rely on
hand-written `where: { tenantId }` filters (wrapping every read in its own
transaction exhausts the pool). The safety floor only applies to code paths that
actually call `evaluatePolicy`. Acceptance/security tests remain a load-bearing
control: they convert "every author remembered" into a checked invariant. Any
**new** route or execution path is not automatically covered.

---

## 1. Multi-tenant isolation

Every tenant-owned DTO extends `TenantScopedEntitySchema`
(`packages/shared/src/domain.ts:752`), which only guarantees a `tenantId` field
exists. Actual enforcement is:

- **Per-request tenant binding, server-side.** Two auth paths, both derive the
  tenant from trusted state, never from a raw client value:
  - Session + `x-periscan-tenant-id` header: the header is read in
    `getRequestedTenantId` (`apps/api/src/app.ts:591`) but is used only as a
    lookup key constrained to the caller's own memberships —
    `getSessionContext` does `membership.findFirst({ where: { tenantId, userId }})`
    and returns null (→ 401) when no membership matches
    (`apps/api/src/services/auth.ts:444-483`). A user can only select a tenant
    they already belong to.
  - API key: tenant is taken from the stored key record and the header is
    ignored — "API keys are bound to a single tenant; the tenant header is
    ignored" (`apps/api/src/app.ts:675`; `services/auth.ts:929-994`).
  - The resulting `AuthenticatedContext` (`apps/api/src/runtime-services.ts:355`)
    is the only tenant identity services trust.
- **Explicit `where: { tenantId }` on every query.** There is no base
  repository injecting the filter; scoping is pervasive and manual (e.g.
  `services/tenant.ts` alone has ~48 scoped query sites; `runner.ts` ~74).
- **MSSP parent/child scoping** via `parentTenantId`
  (`services/tenant.ts` `createClientTenant`/`listClientTenants`), gated on
  `MSSP_ADMIN_ROLES`.
- **Proven by acceptance test.**
  `tests/acceptance/tenant-isolation-matrix.test.ts` seeds ~20 resource types in
  tenant A, creates tenant B with **identical Enterprise entitlements** (so the
  only possible cause of rejection is the tenant boundary, not a feature gate),
  then asserts: cross-tenant detail reads → **404** (existence hidden, not 403);
  27 schema-valid cross-tenant mutations → 403/404, **never 2xx** (a 2xx is
  labelled an "ISOLATION LEAK"); and B's list/`/search` endpoints never contain
  any of A's ids.

| STRIDE | Threat | Mitigation (code) |
|---|---|---|
| S | Forge tenant via header | Header is a membership-filtered lookup key (`auth.ts:444`); API keys ignore it (`auth.ts:929`) |
| T/I | Cross-tenant read/write | Per-request bound context + `where:{tenantId}` everywhere; enforced-by-test (`tenant-isolation-matrix.test.ts`) |
| I | Existence oracle | Cross-tenant reads return 404, not 403 |
| E | MSSP child escalation | `parentTenantId` scoping + `MSSP_ADMIN_ROLES` |

**Residual risk & recommendations**

- **Write-path RLS is active; reads remain correct-by-convention.** Interactive
  Prisma `$transaction` mutations bind `SET LOCAL ROLE periscan_rls` +
  `app.current_tenant` when `enterTenantRlsContext` has run after auth
  (`packages/db/src/client.ts`). **Standalone reads** still rely on hand-written
  `where: { tenantId }` (or post-fetch `tenantId` checks such as
  `getAuditExport`). A new read that forgets the filter is still a silent leak
  because RLS is not a full-query chokepoint. **Recommendation:** prefer
  `runWithTenantRls` for high-value read handlers; keep the isolation matrix as
  a CI coverage gate for every new tenant-scoped route.
- The matrix only covers enumerated routes; new endpoints are not automatically
  covered.

---

## 2. The in-network runner

The runner is split between the customer-hosted agent (`apps/runner-agent`) and
the SaaS control-plane service (`apps/api/src/services/runner.ts`, with crypto
in `apps/api/src/runtime-services.ts`).

**Outbound-only transport.** The agent long-polls the control plane and never
opens an inbound port — the poll loop (`apps/runner-agent/src/index.ts:46`,
`src/poll.ts:147`) only issues outbound POSTs to `/runners/:id/poll` and
`/tasks/:id/result`. There is no `.listen`/`createServer`/`express` anywhere in
`apps/runner-agent/src`. This removes inbound attack surface inside the customer
network.

**Ed25519-signed tasks (control plane signs, runner verifies).** The control
plane canonicalizes and signs each task envelope with the tenant's Ed25519 key —
`signRunnerTaskEnvelope` (`runtime-services.ts:4727`) attaches
`{algorithm:"EdDSA", digestSha256, keyId, nonce:taskId, signature}`. The agent
verifies before executing anything — `verifyTaskEnvelope`
(`apps/runner-agent/src/verify.ts:32`) checks runner/tenant/key ids,
`executionEnvironment==="InternalRunner"`, algorithm, nonce==taskId, expiry,
recomputed canonical digest, and the signature; on failure the task is never run
(`src/dispatch.ts:79-88`). Replay is blocked by a bounded nonce seen-set
consumed only after full validation (`verify.ts:111-115`, `index.ts:6-17`).

**Runner-signed results (runner signs, API verifies).** The agent signs each
result over its canonical `localAuditSha256` — `signResult`
(`apps/runner-agent/src/poll.ts:45`); the API verifies in `submitRunnerTaskResult`
via `verifyRunnerResultSignature` (`services/runner.ts:130`), returning **403
`runner_result_signature_required`** / **`runner_result_signature_invalid`**
when a runner that registered a public key submits a missing/invalid signature
(`services/runner.ts:2246-2291`), and persisting `resultSignatureVerifiedAt`.
This gives non-repudiable provenance for measurements produced off-platform.

**Egress allowlist (default-deny).** `evaluateEgress`
(`apps/runner-agent/src/egress.ts:97`) denies by default: kill switch denies
all; port must be in `approvedPorts`; host allowed only by exact hostname,
DNS suffix, or IPv4 CIDR; else denied. The policy is built from the **signed**
envelope's `scopeConstraints` (`egress.ts:42-53`; missing constraints ⇒
deny-all + `forbidInternetEgress`), and enforced at the SOCKS proxy CONNECT
before any upstream socket opens (`src/proxy.ts:172-179`). Server-side,
constraints are derived only from verified scope
(`runtime-services.ts:5841 buildScopeConstraints`,
`isHostnameTargetAllowedByScope` at `:5816`) before a task is even signed.

**Identity lifecycle.** Registration uses a single-use hashed token and issues an
opaque `prra_` auth token stored only as SHA-256 hash, plus an mTLS cert +
task-signing keypair with 90-day expiry (`services/runner.ts:271-333`). Every
agent call runs `authenticateRunner` with a **constant-time** token compare
(`timingSafeEqualHex`, `services/runner.ts:54,77`), revoke check, and optional
mTLS fingerprint match. Credential rotation (`:790`), a two-layer kill switch
(server `setRunnerKillSwitch` `:470`, fail-closed dispatch `:911-927`, agent-local
`poll.ts:154-161`), and heartbeat (`:755`) are all present.

| STRIDE | Threat | Mitigation (code) |
|---|---|---|
| S | Rogue task injection | Ed25519 verify before execute (`verify.ts:32`, `dispatch.ts:79`) |
| T/R | Forged/altered results | Runner-signed results verified server-side (`services/runner.ts:2246`) |
| I | Lateral movement / exfil | Default-deny egress from signed scope only (`egress.ts:97`, `proxy.ts:172`) |
| S | Impersonate runner | Hashed `prra_` token, constant-time compare, mTLS default-on in production (`shouldRequireRunnerMtls`) |
| E/DoS | Rogue/hung runner | Kill switch + revoke, fail-closed dispatch (`services/runner.ts:470,911`) |
| T | Replay a valid task | Nonce seen-set post-validation (`verify.ts:111`) |

**Residual risk & recommendations**

- **mTLS is default-on in production.** Fingerprint enforcement engages when
  `PERISCAN_RUNNER_REQUIRE_MTLS==="true"`, or when the flag is unset and
  `NODE_ENV=production` (`shouldRequireRunnerMtls` in `services/runner.ts`).
  Explicit `PERISCAN_RUNNER_REQUIRE_MTLS=false` opts out (not recommended for
  production). Non-production remains opt-in. Document token-rotation SLAs and
  ensure the TLS terminator forwards the verified cert fingerprint header.
- **Result signing is mandatory on submit.** Control-plane
  `submitRunnerTaskResult` rejects runners without a registered
  `resultSigningPublicKeyPem` and requires a valid signature over the result
  (`apps/api/src/services/runner.ts`). Transport auth alone is not sufficient
  for result acceptance. Registration may still occur without a key, but those
  runners cannot submit measured results until a key is registered.
- **Egress CIDR matching supports IPv4 and IPv6 allow lists** (`egress.ts`).
  Hostname allows still trust DNS resolution without post-resolve IP pin →
  DNS-rebinding consideration inside customer networks remains residual.
- The SOCKS proxy transport multiplexing over the poll connection is an
  **unfinished seam** (`apps/runner-agent/src/proxy.ts:14-16`).

---

## 3. The Frontier / model gateway

Package `packages/model-gateway`; API surface `apps/api/src/services/model-gateway.ts`.
The gateway lets customer-configured frontier/cyber models reason over tenant
data and call tools — without ever letting a model touch customer systems
directly.

**Context is id-only.** `buildModelContextBundle`
(`packages/model-gateway/src/engine/context-broker.ts:76`) stores only entity/
evidence **ids + redaction status, never raw evidence content** (explicit
invariant: "no secret can reach a model through the bundle", `:62-75`).
Evidence above the policy sensitivity ceiling is `Blocked` (`:145-186`); the
ceiling derives from `allowSensitiveContext`. All loads are tenant-scoped.

**Every tool call goes through a Policy Enforcement Point that never executes.**
`createGatewayToolRequest`
(`packages/model-gateway/src/engine/policy-enforcement.ts:397`) — "It NEVER
executes the tool and NEVER queues an underlying action; denied requests are
recorded and never acted upon" (`:390`). It checks tenant enable/disable,
session-mode, profile allow/block lists, and a safety-level ceiling
(`engine/safety.ts`), escalating to approval where required. Input is
schema-validated and **secret-redacted before persistence**
(`prepareGatewayToolInput` `:325`, `SENSITIVE_INPUT_KEY_PATTERN` `:301`); only a
hash + redacted payload is stored. Every decision is dual-audited (`:526-598`).
Read-only tool execution (`engine/tool-execution.ts:67`) reads only
tenant-scoped data and redacts output before returning it to the model; action
tools are never auto-executed (orchestrator contract, `orchestrator.ts:101-120`).

**Provider credentials are encrypted at rest.** `packages/model-gateway/src/credentials.ts`
uses AES-256-GCM with a scrypt-derived per-record key (`:45,54`), self-describing
`v1.salt.iv.tag.ciphertext` reference, and **fails closed in production** without
`PERISCAN_MODEL_CREDENTIAL_KEY` (`:32-36`); plaintext is never logged or
persisted. Provider create/update encrypts (`services/model-gateway.ts:191,247`);
decrypt happens only for an explicit connection test (`:339`). Provider creation
is gated on `TENANT_ADMIN_ROLES`.

| STRIDE | Threat | Mitigation (code) |
|---|---|---|
| I | Secret leak to model | Id-only context + sensitivity ceiling + I/O redaction (`context-broker.ts:62`, `policy-enforcement.ts:301`) |
| E | Model triggers real action | PEP records but never executes/queues (`policy-enforcement.ts:390`); action tools not auto-run |
| I/T | BYO provider key theft | AES-256-GCM, scrypt per-record key, fail-closed (`credentials.ts:32-54`) |
| R | Dispute a tool decision | Dual audit of every decision (`policy-enforcement.ts:526`) |

**Residual risk & recommendations**

- **The blast-radius / kill-switch / anomaly / consent layer is stubs.**
  `getKillSwitchStatus` always returns `{active:false}`
  (`policy-enforcement.ts:59`), so the per-session kill check never fires;
  `detectBehavioralAnomaly` is a regex heuristic (`:89`); `blastRadiusControl`
  uses a synthetic radius (`:33`); scope-consent is assumed and compliance preset
  hardcoded (`:485`). **The real enforced controls are the allow/block lists,
  the mode gate, the safety-level ceiling, and redaction** — the "advanced
  safety" layer must not be relied upon until implemented.
- Redaction is regex best-effort (see §5) — novel key formats can slip through.

---

## 4. API-key & session lifecycle

**Secret storage.** All bearer-style secrets (API keys, session/reset/verify/
invite tokens, MFA recovery codes) are stored only as **unsalted SHA-256**
hashes — `hashSecret` (`apps/api/src/runtime-services.ts:4324`). Raw values are
never persisted. This is acceptable *because these are 256-bit CSPRNG tokens*
(`createOpaqueToken` = `prefix + randomBytes(32).base64url`, `:4343`), not
low-entropy passwords.

**Passwords use a real KDF.** Signup/login use **argon2id**
(`services/auth.ts` `argon2.hash`/`argon2.verify`), with per-account lockout
after `PERISCAN_LOGIN_MAX_ATTEMPTS` (default 5) for
`PERISCAN_LOGIN_LOCKOUT_MINUTES` (default 15). Unknown emails return a generic
null (no user enumeration). MFA (TOTP window ±1 + single-use hashed recovery
codes) is enforced after the password when enrolled.

**API keys.** `psk_`-prefixed, admin-only creation
(`services/auth.ts:996`, gated on `TENANT_ADMIN_ROLES`), stored as
`keyHash` + a non-secret 12-char `keyPrefix` for display; raw secret returned
exactly once. Rotation (`:1096`), revocation (`:1050`, idempotent), and
expiry are enforced in `authenticateApiKey` (`:929`), which only accepts
`Authorization: Bearer psk_…` (`app.ts:654`). Every lifecycle action writes an
audit event (`api_key.created/revoked/rotated`).

**Sessions.** `createSessionToken`/`verifySessionToken`
(`apps/api/src/security.ts`) issue **HS256** JWTs (7-day expiry) signed with
`PERISCAN_JWT_SECRET`; the verify path **pins `algorithms:["HS256"]`** (no
`alg:none`/confusion). Production refuses to boot with the default dev secret
(`app.ts:1074-1082`). The session cookie is `httpOnly`, `sameSite=lax`, and
`secure` is forced true in production (`app.ts:556,1101`).

**Rate limiting.** Global 600/min, auth routes 20/min
(`app.ts:1220-1250`), keyed `key:<apiKey>` → `tenant:<id>` → `ip:<request.ip>`.

| STRIDE | Threat | Mitigation (code) |
|---|---|---|
| S | Forged session JWT | HS256 + pinned verify alg; prod refuses default secret (`security.ts`, `app.ts:1074`) |
| S | Stolen/guessed API key | 256-bit token, hashed at rest, Bearer-only, expiry+revocation (`auth.ts:929`) |
| S | Credential stuffing | argon2id + account lockout + 20/min auth limit (`auth.ts`, `app.ts:1224`) |
| I | Raw key leak | Only hash + 12-char prefix stored; secret returned once (`auth.ts:996`) |
| R | Deny key/login actions | Audit events + `lastUsedAt` tracking |
| E | Over-privileged key | Creation gated to admin roles; scope→role mapping (`runtime-services.ts:3851`) |

**Residual risk & recommendations**

- **Purpose-split secrets with kid + dual-verify rotation.** Sessions use
  `PERISCAN_JWT_SECRET` (kid `sess-v1` by default; optional
  `PERISCAN_JWT_SECRET_PREVIOUS` for rotation). Public report-share tokens use
  dedicated `PERISCAN_REPORT_SHARE_SECRET` (required in production; kid
  `share-v1`). Residual: intervention signing still reuses the session secret
  ring; manage secrets in a real secrets manager (Vault/KMS/SSM) for enterprise
  deployments.
- **API-key scopes are coarse.** Scopes are collapsed to a role
  (`apiKeyRoleForScopes`, `runtime-services.ts:3851`); there is no per-endpoint
  `requireScope`, so a "scoped" key is not least-privilege.
  **Recommendation:** enforce scopes at the route.
- **Rate limiter trusts `request.ip`** with no visible `trustProxy` config;
  behind the web proxy all traffic can share one source IP unless
  `X-Forwarded-For` is honored. **Recommendation:** verify trustProxy/XFF
  handling in production.
- Account lockout can be weaponized to keep a known email locked (targeted DoS).
- SHA-256 hash equality lookups are not constant-time (low severity given
  256-bit tokens).

---

## 5. The evidence store

Package `packages/evidence/src/storage.ts`.

**Redaction before storage.** `putEvidenceArtifact` (`:1164`) runs
`redactEvidenceArtifact` (`:334`) **before the blob is ever written**, and the
stored body + hash are computed over the *redacted* content (`:1171-1188`).
`SECRET_REDACTION_PATTERNS` (`:157-208`) cover private-key blocks, GitHub/AWS/
GCP/Slack/Azure keys, JWTs, bearer tokens, and generic `secret|token|password|
api_key=value`; High/Restricted sensitivity is redaction-required even with no
pattern match (`:350-361`). The runner artifact-upload path routes through this
same service (`services/runner.ts:1906-1918`), so off-platform evidence is
redacted server-side, and the same redactor is reused for model-gateway tool I/O.

**Tenant scoping.** The storage key is tenant-namespaced
(`storageKey = ${tenantId}/…`, `:1175`); the read guard
`getEvidenceArtifact(evidenceId, tenantId?)` returns null when
`artifact.tenantId !== tenantId` (`:1110-1115`). Runner result ingestion forces
the authenticated runner's `tenantId` onto persisted signals and mints fresh
server-side ids — "never trust submitted identity/ids" (`services/runner.ts:2466-2510`).

**Per-artifact SHA-256 integrity.** Write records
`sha256 = hashEvidenceArtifact(redactedContent)` (`:1188`); read recomputes and
compares, setting `integrityVerified` (`:1119-1128`) — the chain-of-custody
check. The runner additionally carries a signed canonical `localAuditSha256`
per result (§2), persisted as `runnerTask.localAuditHash`.

| STRIDE | Threat | Mitigation (code) |
|---|---|---|
| I | Secrets/PII persisted | Redaction before write, hash over redacted content (`storage.ts:1164-1188`) |
| E/I | Cross-tenant evidence read | Tenant-namespaced key + read guard (`storage.ts:1110`); forced runner tenantId (`runner.ts:2466`) |
| T | Tamper a stored artifact | Recompute-and-compare SHA-256 on read (`storage.ts:1119`) |

**Residual risk & recommendations**

- **Integrity is per-record, not a linked chain.** Despite "chain-of-custody"
  language, there is **no `prevHash`/genesis/Merkle** linking evidence records or
  audit events (`AuditEvent` has no chaining field, `schema.prisma:1894`).
  Per-record hashing detects mutation of an object vs. its own recorded hash but
  **does not detect deletion or reordering**, and an actor able to write both the
  blob and the metadata row can recompute a consistent hash.
  **Recommendation:** if append-only tamper-evidence is a requirement, implement
  a linked hash chain (or external WORM/notary) over evidence + audit events.
- **Redaction is regex best-effort** — novel secret formats and unstructured PII
  (names, addresses) are not covered. **Recommendation:** layer an
  entropy/ML-based secret detector and treat redaction as defense-in-depth, not
  a guarantee.
- The read-time tenant guard is optional (defaulted off for legacy callers);
  cross-tenant safety depends on the API layer passing `tenantId`.

---

## 6. The offensive-validation flip / policy floor

The policy engine `packages/policy/src/index.ts` is the Policy Enforcement
Point. `evaluatePolicy` (`:113`) produces one of
`Allowed / Denied / RequiresApproval / RequiresVerifiedScope /
RequiresInternalRunner / RequiresTimeWindow`.

**The hard safety floor that never lifts.** The very first branch of
`evaluatePolicy` (`:118-131`), before any other check, unconditionally denies any
action flagged `destructive`, `realDataExfiltration`, `persistence`,
`credentialTheft`, or `uncontrolledExploitChaining`:

```ts
return { outcome: "Denied", approvalState: "Rejected",
  rationale: "Requested action violates Periscan safety boundaries and is denied." };
```

Because it returns first and unconditionally, no downstream flag — offensive
authorization, admin approval, role, or tenant policy — can reach or override it.
The `AdvancedAdversarial` branch documents this: the floor "was already enforced
above and never lifts" (`:267-269`).

**What the flip actually does — raise a ceiling, not the floor.** Enabling
offensive validation (`setOffensiveValidation`, `services/tenant.ts:638-686`)
requires `TENANT_ADMIN_ROLES`, a non-empty `authorizationReference`, records
`authorizedBy/At/Ref`, and writes an audit event. Its only effect on the engine
is to raise the max safety **ceiling** (`index.ts:164-177`):

```ts
const effectiveMaxSafetyLevel = input.offensiveValidationAuthorized
  ? "AdvancedAdversarial" : input.tenantPolicy.maxSafetyLevel; // default BASLite
```

Even when authorized, `AdvancedAdversarial` still requires per-run admin approval
(`index.ts:258-283`). At execution time, `resolvePolicyDecisionGate` (`:364-397`)
re-checks the stored decision and **fails closed** — rejected or expired
decisions become `Denied`.

**Proven by acceptance test.**
`tests/acceptance/offensive-validation-flip-flow.test.ts`: default OFF ⇒ ceiling
`BASLite`, adversarial preview `Denied`; enabling without a reference ⇒ 400;
enabling with a reference ⇒ ceiling `AdvancedAdversarial`; authorized + approved
⇒ `Allowed`; **but a `destructive` action is still `Denied` even authorized +
approved** — the load-bearing proof that the floor never lifts; the change is
audited; revoking returns to denied-by-default.

| STRIDE | Threat | Mitigation (code) |
|---|---|---|
| E | Run destructive ops via the flip | Unconditional first-branch floor (`policy/index.ts:118`); flip only raises a ceiling |
| T/S | Forge the authorization | Admin role + attestation reference + audit (`tenant.ts:638`) |
| R | Deny authorizing offense | Audit event `offensive_validation.changed` (`tenant.ts:672`) |
| E | Revoked/expired decision reused | Fail-closed gate at execution (`policy/index.ts:364`) |

**Residual risk & recommendations**

- **`authorizationReference` is unverified free text** (`domain.ts:3097`) — an
  attestation of convenience, not cryptographic proof of customer consent.
  **Recommendation:** bind it to a real SOW/authorization record and require
  countersignature.
- **Enforcement depends on routing through `evaluatePolicy`.** A future
  execution path that reaches runners without calling `evaluatePolicy` /
  `resolvePolicyDecisionGate` would sidestep both floor and gate. The safety
  helpers at `policy/index.ts:399-609` (`blastRadiusControl`,
  `getKillSwitchStatus` hardcoded `active:false`, `zeroDisruptionGuaranteeCheck`,
  `detectBehavioralAnomaly`) are **self-labelled stubs** and are not active
  controls. **Recommendation:** make the PEP an unavoidable chokepoint and
  implement the stubbed controls before advertising them.

---

## Cross-cutting residual risks & recommendations

1. **Isolation is write-path RLS + app-filter reads.** Interactive transactions
   bind `periscan_rls` + `app.current_tenant`; standalone reads remain
   correct-by-convention. No mandatory policy proxy. Tests remain a load-bearing
   control. → Prefer `runWithTenantRls` for high-value read handlers; keep CI
   isolation-matrix coverage on new routes.
2. **Production defaults improved; residual stubs remain.** Runner mTLS is
   default-on when `NODE_ENV=production` (explicit `false` opts out); result
   signing is mandatory on submit. Model-gateway "advanced safety" (kill switch /
   anomaly / blast-radius) layers are still stubs. External validation and
   threat-feed SSRF now post-resolve DNS; runner egress still trusts hostname
   allowlists without IP pin. → Implement or remove advertised stubs; pin egress
   DNS for internal runner.
3. **Secret management / encryption at rest.** Sessions and report-share use
   purpose-split HS256 secrets with `kid` + optional previous-key dual-verify.
   Integration credential encryption fails closed in production without
   `PERISCAN_INTEGRATION_CREDENTIAL_KEY` (`integration-credentials.ts`). Evidence
   encryption-at-rest status is **env-declared** via
   `PERISCAN_EVIDENCE_ENCRYPTION_AT_REST` (trust surfaces report Configured vs
   NotConfigured/DeploymentManaged) — not a hard boot gate. Intervention
   signing still reuses the session secret. Multiple secrets live in env vars.
   → Adopt a secrets manager (Vault/KMS/SSM); require evidence encryption config
   for GA; document key rotation SLAs.
4. **Tamper-evidence is per-record, not append-only.** → Implement a linked hash
   chain or external WORM/notary over evidence and audit events if the product
   claims chain-of-custody.
5. **Redaction is best-effort regex.** → Treat as defense-in-depth; add an
   entropy/ML secret scanner.
6. **Independent validation.** These are internal, code-grounded assertions.
   → Commission an **external penetration test** (with emphasis on
   cross-tenant isolation, the runner egress boundary, and the offensive-flip
   floor) and a secrets-management review before GA.

## Out of scope / assumptions

- TLS termination, host/OS hardening, and network segmentation of the SaaS
  deployment are assumed provided by the platform (see `docs/DEPLOY.md`).
- Supply-chain integrity of third-party OSS modules is governed separately
  (`docs/OPEN_SOURCE_LICENSE_POLICY.md`, `docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`).
- Physical security and cloud-provider trust are out of scope.
- Prose-level companions to this document: `SECURITY_BOUNDARIES.md`,
  `RUNNER_SPEC.md`, `docs/PRODUCTION_READINESS.md`, `docs/ARCHITECTURE.md`.
</content>
</invoke>
