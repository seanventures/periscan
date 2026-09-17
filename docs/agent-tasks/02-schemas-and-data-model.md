# 02 Schemas And Data Model

## Objective

Extend shared schemas and Prisma models only where the PRD requires new first-class entities.

## Existing Codebase Areas Involved

`packages/shared/src/domain.ts`, `packages/shared/src/domain.test.ts`, `packages/db/prisma/schema.prisma`, Prisma migrations.

## Dependencies

Codebase foundation docs and migration review.

## Files Likely Touched

`packages/shared/src/domain.ts`, `packages/shared/src/index.ts`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`, tests under `packages/shared` and `packages/db`.

## Interfaces To Preserve

Existing entity names, tenant-scoped IDs, validation states, evidence IDs, route DTOs, and Prisma model naming conventions.

## Implementation Tasks

- Add Threat Center schemas: advisory, package, impact assessment, missing signal, validation plan, plan item, readiness report.
- Extend validation-state support without breaking existing reports.
- Add migration only after schema review.

## Acceptance Criteria

- Schemas parse representative examples.
- Migrations validate and deploy.
- No duplicate entity exists where an equivalent model already exists.

## Tests To Run

`pnpm --filter @periscan/shared test`, `pnpm --filter @periscan/db test`, `pnpm --filter @periscan/db db:validate`.

## Safety Boundaries

Threat advisory objects must not imply live feed ingestion or validation execution.

## Explicitly Not Allowed

Do not replace Prisma or add another ORM.

## Required Environment Variables

`DATABASE_URL` for migration deploy checks.

## Conflict Avoidance

Coordinate with API, reports, evidence graph, and Threat Center streams before changing shared types.
