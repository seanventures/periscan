# 08 Reports Evidence Packs

## Objective

Generate audience-specific reports from normalized evidence only.

## Existing Codebase Areas Involved

`packages/reports`, evidence artifacts, report APIs, web report views.

## Dependencies

Snapshot/finding/evidence contracts.

## Files Likely Touched

`packages/reports/src/index.ts`, `apps/api/src/runtime-services.ts`, report tests, web report components.

## Interfaces To Preserve

EvidencePack schema, HTML/PDF export APIs, redaction behavior.

## Implementation Tasks

- Maintain Advisory Readiness Report HTML/PDF exports from normalized Threat Center data.
- Add trend/change language from real historical data only.
- Keep sample reports isolated.

## Acceptance Criteria

- Reports include evidence IDs and no raw secret values.
- Leadership reports do not expose raw module dumps.

## Tests To Run

`pnpm --filter @periscan/reports test`, `pnpm --filter @periscan/api test`.

## Safety Boundaries

No unsupported AI-generated or analyst claims without evidence references.

## Explicitly Not Allowed

Do not mix sample/demo data with tenant reports.

## Required Environment Variables

Evidence storage variables for integration testing.

## Conflict Avoidance

Coordinate with Snapshot and Threat Center streams before changing report inputs.
