# 10 AI App Validation

## Objective

Validate customer-authorized AI apps with safe, scoped, evidence-backed tests.

## Existing Codebase Areas Involved

AI app APIs, validation catalog, modules, reports.

## Dependencies

Verified AI app scope, policy approval, safe test harness.

## Files Likely Touched

`apps/api/src/app.ts`, `apps/api/src/runtime-services.ts`, `packages/modules`, `packages/shared/src/validation-catalog.ts`.

## Interfaces To Preserve

AI app registry schema, fixture/live-safe mode distinction, redaction rules.

## Implementation Tasks

- Keep fixture mode for tests.
- Add live-safe endpoint execution only with customer endpoint and approval.
- Add missing-signal states for unavailable AI scope.

## Acceptance Criteria

- No harmful prompt payload libraries are embedded.
- Evidence is redacted and linked to findings/reports.

## Tests To Run

`pnpm --filter @periscan/api test`, `pnpm --filter @periscan/modules test`.

## Safety Boundaries

No unauthorized data access, no destructive tool invocation, no credential theft.

## Explicitly Not Allowed

Do not fake AI failures in tenant product data.

## Required Environment Variables

Customer-provided endpoint credentials/test account for live-safe mode.

## Conflict Avoidance

Coordinate with reports and unified findings when adding output fields.
