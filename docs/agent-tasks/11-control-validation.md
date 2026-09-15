# 11 Control Validation

## Objective

Validate controls safely and expose rule/detection gaps without fake verdicts.

## Existing Codebase Areas Involved

Control source APIs, modules, validation catalog, runner.

## Dependencies

Verified control scope, policy approval, SIEM/EDR integrations or runner.

## Files Likely Touched

`apps/api/src/app.ts`, `apps/api/src/runtime-services.ts`, `packages/modules`, `packages/shared/src/validation-catalog.ts`.

## Interfaces To Preserve

Dry-run default, live-runner rejection unless approved, ATT&CK mapping.

## Implementation Tasks

- Add rule coverage and logged-but-not-alerted views from real telemetry.
- Add stale rule detection only with real rule metadata.
- Keep Atomic content dry-run by default.

## Acceptance Criteria

- Missing SIEM/EDR returns RequiresIntegration/NotConfigured.
- Control verdicts cite evidence IDs.

## Tests To Run

`pnpm --filter @periscan/api test`, `pnpm --filter @periscan/modules test`, `pnpm test:security`.

## Safety Boundaries

No live BAS execution outside approved internal-runner workflow.

## Explicitly Not Allowed

Do not fake EDR/SIEM detected or blocked verdicts.

## Required Environment Variables

SIEM/EDR credentials for live observation.

## Conflict Avoidance

Coordinate with runner before changing live execution semantics.
