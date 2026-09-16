# Periscan Internal Runner / Secure Validation Gateway — Specification

The Periscan Internal Runner (a.k.a. Secure Validation Gateway) is the
customer-network execution point for policy-approved validation modules that must run
close to internal assets. This is the authoritative functional spec; the transport
rationale lives in [../RUNNER_ARCHITECTURE.md](../RUNNER_ARCHITECTURE.md) and the
shared contracts in `packages/shared/src/runner.ts`.

> **Founder decision (resolves GAP-OSS-AGENT-01):** the runner is **outbound-only,
> signed-task transport**. There is **NO reverse SSH, NO arbitrary shell, NO
> unrestricted tunnel/port-forward, NO persistence/evasion/credential theft** in the
> default customer runner. Transport authentication is **mTLS client certificate plus bearer token over TLS**,
> with Ed25519 signed task envelopes for every task. A restricted task-tunnel is
> **documentation-only / disabled** (§Communication modes) and is not enabled.

## 1. Purpose

- Reach internal assets that the SaaS control plane cannot reach directly.
- Execute only narrowly-scoped, policy-approved, signed tasks (MVP: passive internal checks).
- Return redacted, normalized evidence outbound to Periscan Cloud.
- Behave like a tightly-scoped outbound worker, never a remote-access agent.

## 2. Architecture principles

1. **Outbound-only.** No inbound ports, no NAT traversal, no reverse tunnel.
2. **Three-layer trust.** Transport authentication (mTLS client certificate),
   runner bearer token over TLS, and per-task Ed25519 signed envelope.
3. **Defense in depth.** Cloud policy is necessary but not sufficient; the runner
   re-enforces identity, expiry, nonce, scope, module allowlist, and safety locally.
4. **Least privilege.** Only allowlisted modules; only verified, in-scope targets.
5. **Honest states.** `NotConfigured`, `RequiresApproval`, `DeniedByLocalPolicy`,
   `DeniedByServerPolicy` are first-class — never faked success.
6. **Fully audited.** Registration, revocation, kill switch, task accept/reject/result,
   and evidence upload all emit audit events.
7. **Customer kill switch.** A tenant admin can stop all task execution instantly,
   enforced server-side (no dispatch) and locally (env kill switch + server signal).

## 3. Lifecycle (1–19)

1. Tenant admin creates a runner intent and requests a **short-lived registration
   token** (`POST /runners/registration-tokens`).
2. Operator deploys the runner (Docker/K8s/Linux) with the token; no long-lived secret
   is embedded.
3. Runner calls `POST /runners/register` (token + capabilities + network profile).
4. Cloud validates the token, persists the `Runner`, issues `runnerId`, bearer auth
   token, control-plane URL, poll/heartbeat intervals, tenant runner CA certificate,
   runner client certificate, the stored client-certificate SHA-256 fingerprint,
   task-signing key ID, and the task-signing public key. The runner generates the
   client private key locally in its CSR flow; Periscan Cloud never receives the key.
5. Runner begins the **outbound poll loop** (`POST /runners/:id/poll`, HTTPS with
   mTLS client certificate and `Authorization: Bearer <runnerAuthToken>`).
6. Admin assigns a verified **scope** and runs a connectivity test.
7. Cloud creates a task (MVP: reachability through `POST /runners/:id/tasks/reachability`
   or DNS/TLS/HTTP checks through `POST /runners/:id/tasks/check`) after a **policy
   decision** and **audit event**; denied requests are never queued.
8. Cloud **signs** the task envelope (`signRunnerTaskEnvelope`, Ed25519) with a unique
   nonce = taskId and an `expiresAt`.
9. Runner receives the leased task on its next poll; the task is marked `Leased`.
10. Runner **verifies** the task locally (§7). Failure → `DeniedByLocalPolicy` /
    `Rejected` result with an auditable reason; no execution.
11. Runner may explicitly **accept** (`/tasks/:taskId/accept`) or **reject**
    (`/tasks/:taskId/reject`) before running.
12. Runner enforces **scope constraints** (CIDRs/hostnames/DNS suffixes/ports/forbid
    internet egress) before any network action.
13. Runner executes the allowlisted passive/non-invasive module.
14. Runner uploads redacted evidence outbound (`/runners/:id/evidence` or the per-task
    artifact endpoint), with SHA-256 + size verified server-side.
15. Runner submits the result (`/tasks/:taskId/result`) with a local audit hash and
    evidence manifest.
16. Cloud verifies identity/expiry/evidence linkage, persists the result, updates the
    `ValidationRun`, and emits audit + (where relevant) Threat Center signals.
17. Runner heartbeats (`/runners/:id/heartbeat`); cloud updates runner health/last-seen.
18. On revocation or kill switch, future tasks are blocked server-side; the runner
    surfaces the state locally, stops executing, and tolerates network partitions
    without unsafe fallback.

## 4. Runner states

Logical states surfaced in the product (persisted via `RunnerStatus` + runner fields):

| State                 | Meaning                                             | Persisted as                                 |
| --------------------- | --------------------------------------------------- | -------------------------------------------- |
| `Created`             | Runner intent exists; no registration yet.          | (token issued)                               |
| `PendingRegistration` | Registration token issued, awaiting first register. | `Provisioning`                               |
| `Registered`          | Registered, not yet seen polling.                   | `Provisioning`                               |
| `Healthy`             | Recent heartbeat/poll within interval.              | `Active`                                     |
| `Degraded`            | Missed heartbeats / soft errors.                    | `Degraded`                                   |
| `Offline`             | No contact beyond threshold.                        | `Offline`                                    |
| `Revoked`             | Admin revoked; bearer auth + tasks blocked.         | `Revoked`                                    |
| `KillSwitchActive`    | Tenant kill switch engaged; no dispatch/execution.  | `KillSwitchActive` + `killSwitchActive=true` |
| `UpdateRequired`      | Runner version below minimum supported.             | `version` + derived flag                     |
| `PolicyOutOfDate`     | Local policy/module allowlist stale.                | derived flag                                 |

`KillSwitchActive` is an additive `RunnerStatus` enum value. `UpdateRequired` and
`PolicyOutOfDate` are derived/surfaced flags layered on the persisted status to avoid a
wholesale schema rewrite.

## 5. Task states

| State                  | Meaning                                          |
| ---------------------- | ------------------------------------------------ |
| `Created`              | Task constructed server-side (pre-sign).         |
| `Signed`               | Envelope signed (Ed25519).                       |
| `Delivered`            | Leased to a runner on poll (persisted `Leased`). |
| `Accepted`             | Runner acknowledged and will execute.            |
| `Rejected`             | Runner declined (with reason).                   |
| `Running`              | Execution in progress.                           |
| `Completed`            | Finished with result + evidence.                 |
| `Failed`               | Execution error.                                 |
| `Expired`              | Lease/envelope expired before completion.        |
| `Cancelled`            | Cancelled server-side.                           |
| `DeniedByLocalPolicy`  | Runner local checks blocked execution.           |
| `DeniedByServerPolicy` | Server policy/kill switch blocked dispatch.      |

Persisted via `RunnerTaskStatus`. `Created`/`Signed`/`Delivered` map to the existing
`Queued`/`Leased` lifecycle; `Accepted`, `DeniedByLocalPolicy`, `DeniedByServerPolicy`
are additive enum values.

## 6. Field tables

### Runner (additive fields this slice)

| Field                   | Type       | Purpose                          |
| ----------------------- | ---------- | -------------------------------- |
| `killSwitchActive`      | boolean    | Tenant kill switch engaged.      |
| `killSwitchReason`      | string?    | Why the kill switch was engaged. |
| `killSwitchActivatedAt` | timestamp? | When engaged.                    |
| `killSwitchActivatedBy` | uuid?      | Admin who engaged it.            |

### RunnerTask (existing + additive)

Existing: `taskId, tenantId, runnerId, missionId, runId, scopeId, moduleId,
safetyLevel, status, target, inputs, scopeConstraints, envelope, nonce, issuedAt,
expiresAt, leasedAt, completedAt, result, errorSummary`.

Additive this slice:

| Field                 | Type       | Purpose                                        |
| --------------------- | ---------- | ---------------------------------------------- |
| `taskType`            | string?    | Logical task type (e.g. `reachability`).       |
| `moduleVersion`       | string?    | Module/adapter version dispatched.             |
| `inputPayloadHash`    | string?    | SHA-256 of canonical inputs (tamper-evidence). |
| `acceptedAt`          | timestamp? | When the runner accepted.                      |
| `rejectedReason`      | string?    | Reason for `Rejected`/`DeniedByLocalPolicy`.   |
| `localAuditHash`      | string?    | Local audit SHA-256 from the result.           |
| `resourceUsage`       | json?      | Reported CPU/mem/duration.                     |
| `normalizedOutput`    | json?      | Normalized outcome summary.                    |
| `redactedEvidenceIds` | string[]   | Linked redacted evidence IDs.                  |

### RunnerTaskResult (wire)

`completedAt, startedAt, status, outcome?, validationState?, errorSummary?,
localAuditSha256, evidenceManifest[], runId, runnerId, taskId, tenantId`.

### Local runner config (Go)

`runnerId, tenantId, authToken, apiBaseURL, mtlsCAFile, mtlsCertFile,
mtlsKeyFile, signingKeyId, signingPublicKey, controlPlaneProxy, killSwitch (env)`.

## 7. Scope-constraint model + verification checks

Every task carries `scopeConstraints { approvedCidrs, approvedHostnames,
approvedDnsSuffixes, approvedPorts, forbidInternetEgress }`. The runner rejects a task
when ANY of these fail (server denies before dispatch; runner denies before execution):

- `runnerId` mismatch
- `tenantId` mismatch (envelope tenant vs. issued credentials)
- `executionEnvironment != InternalRunner`
- unsupported signature algorithm / invalid signature / digest mismatch
- expired `expiresAt`
- reused `nonce` (replay)
- module not locally allowlisted
- safety level not locally permitted
- target host/port outside approved scope (or public IP when `forbidInternetEgress`)
- kill switch active (env or server signal)

## 8. Allowed initial modules

| Module                         | Status                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `runner.reachability_check`    | **Implemented** (TCP reachability; `ActiveNonInvasive`).                                                  |
| `runner.dns_resolution_check`  | **Implemented** (scope-bounded DNS resolution; `PassiveReadOnly`).                                        |
| `runner.tls_certificate_check` | **Implemented** (presented-cert inspection: issuer/subject/SANs, expiry, chain-trust; `PassiveReadOnly`). |
| `runner.http_health_check`     | **Implemented** (HTTP GET status + latency; `PassiveReadOnly`).                                           |
| `runner.http_header_check`     | **Implemented** (passive header collection; `PassiveReadOnly`).                                           |
| `runner.cert_expiry_check`     | **Implemented** (TLS cert validity/expiry; `PassiveReadOnly`).                                            |
| `runner.tcp_banner_check`      | **Implemented** (TCP connect + bounded banner read for service fingerprint; `PassiveReadOnly`).           |
| `runner.tls_info_check`        | **Implemented** (TLS handshake version/cipher/chain details; `PassiveReadOnly`).                          |

All modules are passive/non-invasive, scope-enforced reads. No `runner.shell`,
`runner.exec`, or arbitrary-command module exists or may be added.

The control plane dispatches these via `POST /api/v1/runners/:id/tasks/check`
(reachability keeps its dedicated `/tasks/reachability` endpoint). Every check
goes through the same verified-scope check, Policy Enforcement Point + policy
decision, audit event, signed task envelope (Ed25519), and per-task scope
constraints as reachability; the runner re-enforces scope locally before any
network read.

The same runner API namespace also exposes `POST /api/v1/runners/:id/tasks/measured`
and `POST /api/v1/runners/:id/tasks/discover` for the TypeScript runner-agent
AgentLocal module framework. Those endpoints create policy-gated signed tasks for
allowlisted `periscan.*` measured modules and safe `recon.*` discovery modules. They
require the runner-agent runtime/tooling and are not Go runner binary modules.

## 9. Communication modes

| Mode                                                                       | Status                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outbound HTTPS long-poll + mTLS client certificate + bearer token over TLS | **Primary.** Production requires mTLS: `PERISCAN_RUNNER_REQUIRE_MTLS=true` (compose/env templates set this; code also defaults on when `NODE_ENV=production` unless explicitly `false`). Deploy the API behind a TLS terminator that forwards `x-periscan-runner-client-cert-sha256` or `x-forwarded-client-cert-sha256`. |
| WebSocket over HTTPS                                                       | Supported later (streaming/logs); optional.                                                                                                                                                          |
| Restricted task-tunnel                                                     | **Design-only / disabled**; narrowly-scoped, per-task, time-boxed, audited; NOT SSH; not enabled.                                                                                                    |
| Reverse SSH / arbitrary tunnel                                             | **Disallowed** (see RUNNER_ARCHITECTURE.md §"Why not reverse SSH").                                                                                                                                  |

### Reverse-tunnel policy

Reverse SSH and arbitrary port-forwarding are permanently disallowed as product
transport. Any future restricted task-tunnel must be: outbound-initiated, per-task,
time-boxed to the task lease, destination-locked to in-scope targets, fully audited, and
killable by the customer kill switch. It is a documented future option only.

## 10. Model Gateway integration rules

The Model Gateway may **request** an internal reachability/validation task through the
runner only via the normal policy-gated, approval-gated tool path. The model never gets
direct runner access, never bypasses scope/policy, and only receives **redacted**
evidence references. Runner tasks originating from a model session carry the session's
policy decision and are subject to the same kill switch and audit.

## 11. Threat Center MissingSignal rule

If a control or detection expectation requires internal evidence that only a runner can
collect and **no healthy runner / no successful task** exists, the Threat Center records
an honest **MissingSignal** (not a pass). A reachability/validation gap is surfaced as a
readiness gap, never as a silent success.

## 12. Runtime controls

- Bounded task expiry + lease; expired tasks auto-transition to `Expired`.
- Per-task scope envelope + local enforcement.
- Module allowlist + safety-level allowlist on the runner.
- Nonce-replay rejection (unique `(runnerId, nonce)` server-side; local replay cache).
- Kill switch (server dispatch block + local env/server signal).
- Resource ceilings (timeouts, bounded ports, artifact size limits).
- Redaction before evidence leaves the customer network where feasible.

## 13. Telemetry

- Heartbeat: version, status, queue depth, active task, last completed, observed-at.
- Audit events for every state transition and security decision.
- Runner health/last-seen surfaced in the API and Runners UI.

## 14. Auto-update (future)

Version reporting exists today (`UpdateRequired` is derived from a minimum supported
version). Signed auto-update delivery is a future capability; for MVP, updates are
operator-driven (redeploy the pinned image).

## 15. API surface

`POST /runners/registration-tokens`, `POST /runners/register`, `GET /runners`,
`GET /runners/:id`, `POST /runners/:id/revoke`, `POST /runners/:id/heartbeat`,
`POST /runners/:id/credentials/rotate`, `POST /runners/:id/poll`,
`POST /runners/:id/kill-switch`, `GET /runners/:id/tasks`,
`POST /runners/:id/tasks/reachability`,
`POST /runners/:id/tasks/check`, `POST /runners/:id/tasks/measured`,
`POST /runners/:id/tasks/discover`,
`POST /runners/:id/tasks/:taskId/accept`, `POST /runners/:id/tasks/:taskId/reject`,
`POST /runners/:id/tasks/:taskId/result`, `POST /runners/:id/evidence`,
`POST /runners/:id/tasks/:taskId/artifacts`.

Admin endpoints require RBAC (`RUNNER_ADMIN_ROLES`) + tenant binding; runner endpoints
require the runner auth token + identity match. All mutate paths emit audit events.

## 16. PR slices

1. Docs + data model + API skeleton + signing + reachability + tests (much exists).
2. Docker packaging + Deploy/List/Detail UI + local lab E2E.
3. Module execution framework + more modules (dns/tls/http).
4. WebSocket + restricted-tunnel **design only** (no implementation).
