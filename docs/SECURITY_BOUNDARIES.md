# Security Boundaries

Periscan is safe-by-default. These boundaries apply to every connector, module, runner task, report, and UI surface.

## Non-Negotiable Rules

- Only validate customer-authorized verified scope.
- No destructive actions.
- No real data exfiltration.
- No persistence, credential theft, evasion logic, or uncontrolled exploit chaining.
- No unauthorized third-party testing.
- External validation runs only against verified external scope.
- Internal validation runs only through an approved runner with signed tasks.
- BAS/control validation must be safe, scoped, policy-controlled, and auditable.
- Every validation run needs a policy decision and audit event.
- Denied tasks must never be queued.
- A risk cannot be marked fixed without a verification event.
- Raw scanner output must not be primary UX.

## Honest Capability States

When a product capability is not available, use one of these states instead of fake data:

- `NotConfigured`
- `RequiresIntegration`
- `RequiresVerifiedScope`
- `RequiresInternalRunner`
- `RequiresApproval`
- `NotImplemented`

## Wave D optional lab inject (SOW-gated, default off)

Closed inject→measure is **hard-disabled** on the control-plane API
(`control_live_execution_disabled`). Default product is **observe-only** control
validation. Optional lab inject requires a signed SOW
([WAVE_D_INJECT_SOW_TEMPLATE.md](./competitive/WAVE_D_INJECT_SOW_TEMPLATE.md))
**and** dual runtime gates (tenant flag + operator approval). Atomic / Caldera /
SharpHound live, ransomware, and real exfil stay never-build. See root
[SECURITY_BOUNDARIES.md](../SECURITY_BOUNDARIES.md) and
[DEMO_OFFENSIVE_GUARDRAILS.md](./competitive/DEMO_OFFENSIVE_GUARDRAILS.md).

## Runner Boundary

The runner is outbound-only (full spec: [RUNNER_SPEC.md](RUNNER_SPEC.md); GAP-OSS-AGENT-01 resolved — no reverse SSH / arbitrary shell / tunnel in MVP). It verifies signed task envelopes (identity, tenant, expiry, signature, nonce-replay), enforces a local module allowlist, a safety-level allowlist, and local scope, writes local audit records, respects kill-switch state (server dispatch block + local signal), and executes only approved safe modules. There is no arbitrary-shell/exec module. The customer kill switch is enforced server-side (no task dispatch, no poll leasing) and locally.

## OSS Boundary

OSS tools are internal engines wrapped by Periscan module manifests. Legal-review or deferred tools stay visible only as blocked/deferred catalog entries and cannot be executed.

## Frontier Gateway Boundary

The Frontier Gateway lets a customer-supplied (BYO-key) frontier model reason over Periscan data without ever trusting the model with direct access. The model thinks, Periscan controls, evidence proves:

- No model gets direct network or shell access; it can only request typed, code-defined tools.
- The model never receives raw secrets and only sees context redacted by `redactEvidenceArtifact`; `allowRawEvidence` defaults to false.
- A Policy Enforcement Point evaluates every tool request against the session policy profile and tenant overrides, yielding `Allowed`, `RequiresApproval`, or `Denied`. Denied requests are recorded and never queue an underlying action.
- BYO API keys are encrypted at rest (AES-256-GCM), never logged, never sent to the model, and never returned on read.
- Action tools (validation/remediation/reporting) are approval-gated and reuse the existing policy/mission/approval machinery; a risk can only be marked fixed by a real verification event.
- Tenant isolation and verified-scope enforcement apply to every tool; a per-tenant kill switch terminates all active sessions and blocks pending requests, and sessions expire on timeout.
