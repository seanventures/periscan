# Unified Customer Agent (internal-network runner) — Resolved Architecture

> **RESOLVED (GAP-OSS-AGENT-01).** The founder mandated the **outbound-only, signed-task
> transport with NO reverse SSH and NO arbitrary shell/tunnel** for MVP — exactly the
> existing `apps/runner` design. The runner authenticates with an mTLS client
> certificate plus bearer token over TLS; any restricted task-tunnel remains
> documentation-only / future and is not implemented. The unified customer agent IS the Internal Runner;
> see the full spec in [docs/RUNNER_SPEC.md](../../RUNNER_SPEC.md).

This file originally captured an open architecture decision; it is retained as the
resolved customer-agent workstream record.

## Goal

One Dockerized customer agent that runs inside the customer's network and lets Periscan
execute internal-network validation tools (the tools that cannot run from the SaaS
control plane), returning redacted, normalized evidence.

## Resolved decision (do not silently override)

The current internal runner (`apps/runner`, Go) is **outbound-only by design**:

- Outbound HTTPS long-poll with mTLS client certificate plus bearer-token auth for signed task envelopes (Ed25519-verified).
- No inbound ports; runs as non-root.
- Explicitly **no reverse shell / no general remote access** (docs/agent-tasks/13-internal-runner.md).
- It performs signed, scope-enforced internal checks: TCP reachability,
  DNS resolution, TLS certificate inspection, and HTTP health checks.
- The API also exposes allowlisted runner-agent task dispatch for safe measured
  `periscan.*` modules and non-invasive internal discovery modules.

This posture is a security feature: it minimizes attack surface, avoids inbound firewall
changes, and prevents the agent from becoming a foothold. It is also referenced in
SECURITY_BOUNDARIES.md and AGENTS.md ("Do not change runner transport away from outbound
HTTPS signed-task polling").

## The tension

The product request is for a unified agent that can "reverse SSH tunnel or similar tech
to us to get around firewalling" and run all tools internally. A reverse SSH tunnel
**conflicts** with the existing decision and the safety rules ("no persistence,
credential theft, evasion logic"). Reverse tunnels are also commonly flagged by customer
security teams as malware-like behavior.

## Implemented design (preserves the secure transport)

Extend the existing outbound signed-task model instead of adding a reverse tunnel:

1. **One agent, capability-scoped.** Single Docker image; capabilities (reachability,
   tool execution) toggled by signed task type + policy, not by adding a new transport.
2. **Outbound-only task pull.** Agent long-polls Periscan over HTTPS, verifies Ed25519
   signatures, runs only allowlisted module/tool tasks for verified in-scope targets.
3. **Tool execution sandbox.** Tools run in the hardened container profile
   (TOOL_RUNTIME_SECURITY.md §3): `--network` restricted to in-scope targets, `cap-drop
ALL`, read-only rootfs + scratch, resource limits from the manifest, pinned digests.
4. **Evidence return path.** Agent pushes redacted evidence outbound (same channel);
   redaction happens before anything leaves the customer network where feasible.
5. **Kill switch + audit.** Honors `PERISCAN_EXTERNAL_VALIDATION_KILL_SWITCH`; every task
   has a policy decision and audit event; denied tasks are never dispatched.
6. **No live BASLite+/disallowed execution** until separately approved.

This delivers "run tools inside the network" without inbound ports or a reverse shell.

## Resolved decisions

- **D1:** Accepted the outbound-only signed-task extension. Reverse SSH, arbitrary shell,
  and arbitrary tunnels are disallowed in the baseline product.
- **D2:** Initial runner modules are implemented for reachability, DNS resolution, TLS
  certificate inspection, HTTP health, safe measured `periscan.*` checks, and
  non-invasive internal discovery modules.
- **D3:** Egress is constrained by verified scope, signed task scope constraints, local
  module allowlists, safety-level allowlists, rate limits, and the customer kill switch.

Remaining work is customer-specific deployment validation after runner credentials,
firewall egress, verified internal scope, and approval windows are available.

## Safe future expansion

- Add more internal modules only through manifest-declared safety metadata,
  policy decisions, local allowlists, and fixture-backed certification.
- Keep any future restricted task-tunnel design outbound-initiated, per-task,
  time-boxed, destination-locked to in-scope targets, auditable, and kill-switchable.
- Do not enable live BASLite+ or adversarial workflows without explicit legal/safety
  approval and customer authorization.
