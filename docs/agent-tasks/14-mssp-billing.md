# 14 MSSP Billing

## Objective

Expand MSSP/client management and metering without adding payment processing prematurely.

## Existing Codebase Areas Involved

Tenant APIs, billing APIs, report branding, web admin UI.

## Dependencies

Tenant isolation, RBAC, report branding.

## Files Likely Touched

`apps/api/src/runtime-services.ts`, `apps/api/src/app.ts`, `apps/web`, `packages/shared/src/domain.ts`.

## Interfaces To Preserve

Tenant header switching, parent/child isolation, meter definitions, report branding.

## Implementation Tasks

- Maintain portfolio/client dashboards from real data.
- Add QBR workflows from evidence packs.
- Keep payment integration out until design decision.

## Acceptance Criteria

- Parent users can view child summaries.
- Client users cannot see parent or sibling data.
- Usage meters are tenant-scoped and auditable.
- The portfolio dashboard consumes `/api/v1/tenants/current/client-portfolio` instead of calculating readiness in UI-only state.

## Tests To Run

`pnpm --filter @periscan/api test`, `pnpm test:acceptance`.

## Safety Boundaries

No cross-tenant data leaks.

## Explicitly Not Allowed

Do not add a payment processor without approval.

## Required Environment Variables

None for metering foundation.

## Conflict Avoidance

Coordinate with reports before changing white-label output.
