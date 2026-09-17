# 06 Evidence Graph Risk

## Objective

Improve evidence graph, missing-signal intelligence, attack paths, and explainable prioritization.

## Existing Codebase Areas Involved

`packages/evidence`, shared graph schemas, findings API.

## Dependencies

Shared schemas and SignalEnvelope inputs.

## Files Likely Touched

`packages/evidence/src/*`, `packages/shared/src/domain.ts`, `apps/api/src/runtime-services.ts`, evidence tests.

## Interfaces To Preserve

Evidence IDs on conclusions, graph node/edge contracts, risk factor output, unified findings shape.

## Implementation Tasks

- Add missing-signal objects.
- Reduce confidence when signals are missing.
- Ensure every graph edge has evidence or is marked candidate.

## Acceptance Criteria

- Unsupported conclusions say what evidence is missing.
- Findings show priority rationale across control, exploitability, path, and asset context.

## Tests To Run

`pnpm --filter @periscan/evidence test`, `pnpm --filter @periscan/api test`.

## Safety Boundaries

Do not invent graph edges or validated paths without evidence.

## Explicitly Not Allowed

Do not add scoring without explainability.

## Required Environment Variables

None for unit tests.

## Conflict Avoidance

Coordinate with reports and Threat Center before changing graph semantics.
