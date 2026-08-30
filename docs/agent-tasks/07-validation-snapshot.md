# 07 Validation Snapshot

## Objective

Keep the first sellable Snapshot workflow real-first and evidence-backed.

## Existing Codebase Areas Involved

Snapshot API, runtime services, reports, evidence graph, connectors/modules.

## Dependencies

Scope verification, integrations, modules, evidence graph.

## Files Likely Touched

`apps/api/src/runtime-services.ts`, `apps/api/src/app.ts`, `packages/reports`, `tests/acceptance`.

## Interfaces To Preserve

`POST /api/v1/snapshots`, snapshot schema, report export APIs, unified findings.

## Implementation Tasks

- Show not-configured states when required integrations are missing.
- Use real persisted evidence only.
- Keep sample/demo reports isolated.

## Acceptance Criteria

- Snapshot refuses unverified scope.
- Every top result has evidence IDs and remediation/verification guidance.

## Tests To Run

`pnpm --filter @periscan/api test`, `pnpm test:acceptance`, `pnpm test:e2e`.

## Safety Boundaries

External validation only against verified scope.

## Explicitly Not Allowed

Do not generate fake attack paths or fake evidence for tenant snapshots.

## Required Environment Variables

Real connector credentials for live runs.

## Conflict Avoidance

Coordinate with reports and evidence graph before changing snapshot payloads.
