# 01 Codebase Foundation

## Objective

Keep repository docs, assessment, agent instructions, traceability, and status current as implementation evolves.

## Existing Codebase Areas Involved

`docs/`, `README.md`, `AGENTS.md`, root PRD/security/roadmap docs.

## Dependencies

None.

## Files Likely Touched

`docs/CODEBASE_ASSESSMENT.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/TRACEABILITY_MATRIX.md`, `docs/USER_STORIES.md`, `docs/ACCEPTANCE_CRITERIA.md`, `README.md`, `AGENTS.md`.

## Interfaces To Preserve

Do not change runtime code, schemas, API contracts, or package structure from this workstream.

## Implementation Tasks

- Keep docs aligned with actual code.
- Mark capabilities honestly as done, not configured, blocked, or not started.
- Record decisions and assumptions.

## Acceptance Criteria

- Docs match current repository behavior.
- No stale claim presents fixture/demo behavior as real product functionality.

## Tests To Run

`pnpm lint` when Markdown or docs linting is introduced; otherwise run no code tests unless runtime files change.

## Safety Boundaries

Do not weaken product safety language.

## Explicitly Not Allowed

Do not scaffold or reorganize the app.

## Required Environment Variables

None.

## Conflict Avoidance

Coordinate before editing docs generated or owned by another active stream.
