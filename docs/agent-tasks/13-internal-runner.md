# 13 Internal Runner

> Full specification: [docs/RUNNER_SPEC.md](../RUNNER_SPEC.md). Transport rationale:
> [RUNNER_ARCHITECTURE.md](../../RUNNER_ARCHITECTURE.md). Founder decision
> (GAP-OSS-AGENT-01) mandates **outbound-only signed-task transport, NO reverse SSH /
> arbitrary shell / tunnel** in MVP; runner authentication uses mTLS client
> certificate plus bearer token over TLS, and any restricted task-tunnel remains
> docs-only/future.

## Objective

Keep the runner real, limited, outbound-only, and scope-enforcing.

## Existing Codebase Areas Involved

`apps/runner`, runner shared schemas, runner API routes.

## Dependencies

Policy engine, verified internal scope, signed task envelope schema.

## Files Likely Touched

`apps/runner/main.go`, `packages/shared/src/runner.ts`, `apps/api/src/app.ts`, `apps/api/src/runtime-services.ts`.

## Interfaces To Preserve

Runner registration, heartbeat, poll, task result, signed envelope, local scope constraints.

## Implementation Tasks

- Keep CSR-backed runner client certificate issuance/rotation covered by API,
  security, and audit tests.
- Maintain non-root Docker packaging and compose deployment example.
- Maintain scoped evidence upload for larger artifacts.
- Maintain local lab E2E target for reachability checks.
- Keep the local module allowlist + safety-level allowlist + nonce-replay cache + server
  kill-switch handling in the Go runner (`runner.reachability_check`,
  `runner.dns_resolution_check`, `runner.tls_certificate_check`, and
  `runner.http_health_check` implemented).
- Keep the customer kill switch enforced server-side (no dispatch / no poll leasing) and
  locally (env + poll signal); keep task accept/reject and runner task listing.

## Acceptance Criteria

- Unsigned, expired, wrong-runner, wrong-tenant, replayed, out-of-scope, disallowed-module,
  or disallowed-safety-level tasks are rejected and audited.
- The customer kill switch blocks task dispatch and poll leasing server-side and stops
  local execution; no arbitrary-shell/exec module exists on the runner.
- Runner executes only approved safe modules.
- Runner credential rotation issues fresh client-certificate material, task-signing key material, certificate fingerprint metadata, and credential-expiry metadata, does not issue a new bearer auth token, and audits rotation or identity mismatch rejection.
- Runner production image builds, runs as non-root, defaults to outbound polling, and exposes no inbound ports.
- Runner artifact uploads enforce signed size limits, raw hash validation, evidence redaction, and uploaded evidence IDs in result manifests.
- Local lab E2E validates loopback reachability and artifact upload without external targets.

## Tests To Run

`pnpm test:runner`, `pnpm --filter @periscan/api test`, `pnpm test:security`.

## Safety Boundaries

No exploit checks, no scanning outside assigned scope.

## Explicitly Not Allowed

No reverse-shell or general remote access behavior.

## Required Environment Variables

Runner gateway/API URL, registration token, mTLS CA/client certificate/client key file paths, and task-signing public key material.

## Conflict Avoidance

Coordinate with control-validation stream before enabling any live BAS path.
