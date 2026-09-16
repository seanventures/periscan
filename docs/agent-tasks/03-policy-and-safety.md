# 03 Policy And Safety

## Objective

Keep all validation policy decisions explicit, auditable, and enforced before queueing.

## Existing Codebase Areas Involved

`packages/policy`, `apps/api/src/runtime-services.ts`, security tests.

## Dependencies

Shared schemas for any new mission or trigger type.

## Files Likely Touched

`packages/policy/src/index.ts`, `packages/policy/src/external-validation.ts`, `apps/api/src/runtime-services.ts`, `tests/security`.

## Interfaces To Preserve

Policy decision outcomes, audit event behavior, verified-scope requirement, module start constraints.

## Implementation Tasks

- Add policy paths for Threat Center validation plans.
- Add missing-signal and approval-required states.
- Strengthen tests for denied tasks never queueing.

## Acceptance Criteria

- Every mission path requires a policy decision.
- Level 2+ and runner-required work is approval gated.
- Denied tasks create audit evidence and zero jobs.

## Tests To Run

`pnpm --filter @periscan/policy test`, `pnpm test:security`, `pnpm verify:api`.

## Safety Boundaries

No destructive, exfiltration, persistence, credential theft, evasion, or uncontrolled exploit chaining behavior.

## Explicitly Not Allowed

Do not bypass policy checks for demo, fixtures, or local lab runs.

## Required Environment Variables

None for unit tests.

## Conflict Avoidance

Coordinate with validation modules and runner work before changing execution-environment semantics.
