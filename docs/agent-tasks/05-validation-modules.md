# 05 Validation Modules

## Objective

Wrap real safe validation tools as policy-gated Periscan modules.

## Existing Codebase Areas Involved

`packages/modules`, `apps/worker`, `packages/evidence`, OSS scripts.

## Dependencies

Policy rules, shared schemas, evidence storage.

## Files Likely Touched

`packages/modules/src/index.ts`, `packages/modules/src/toolchain.ts`, `apps/worker/src/processor.ts`, module tests.

## Interfaces To Preserve

Module manifest shape, runtime readiness fields, safety levels, fixture tests, normalized ModuleOutput.

## Implementation Tasks

- Prefer real tool execution or honest unavailable states.
- Add parsers and redaction tests.
- Keep raw output outside primary UX.

## Acceptance Criteria

- Missing tools return unavailable, not fake success.
- Every module emits normalized evidence and signals when it runs.

## Tests To Run

`pnpm --filter @periscan/modules test`, `pnpm --filter @periscan/worker test`, `pnpm tools:check`.

## Safety Boundaries

Only safe, scoped, approved validation. No exploit modules.

## Explicitly Not Allowed

Do not enable Caldera live execution, SharpHound collection, or Atomic live execution by default.

## Required Environment Variables

Tool-specific runtime env vars only when live execution is supported.

## Conflict Avoidance

Coordinate with policy, OSS license, and worker streams before changing manifests.
