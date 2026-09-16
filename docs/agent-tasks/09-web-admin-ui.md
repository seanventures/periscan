# 09 Web Admin UI

## Objective

Expose API-backed product workflows with honest empty and not-configured states.

## Existing Codebase Areas Involved

`apps/web/app`, `apps/web/src/components`, web API client.

## Dependencies

API contracts from shared schemas and Fastify routes.

## Files Likely Touched

`apps/web/app/*`, `apps/web/src/components/*`, `apps/web/src/lib/*`, component tests.

## Interfaces To Preserve

The UI remains an API consumer. Do not implement product logic in component-only state.

## Implementation Tasks

- Add navigation for Threat Center and unified findings when APIs exist.
- Show honest empty states.
- Avoid isolated module dashboards.

## Acceptance Criteria

- UI never presents fake product data as real.
- Every visible metric is API-backed or clearly sample-labeled.

## Tests To Run

`pnpm --filter @periscan/web test`, `pnpm --filter @periscan/web build`.

## Safety Boundaries

Do not expose confidential market context in product copy.

## Explicitly Not Allowed

No fake dashboards or fake validation results.

## Required Environment Variables

`NEXT_PUBLIC_API_BASE_URL` if using a non-default API URL.

## Conflict Avoidance

Wait for API/shared schema changes before adding dependent UI.
