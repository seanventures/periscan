# 15 CI Security Hardening

## Objective

Keep validation gates comprehensive and release-oriented.

## Existing Codebase Areas Involved

`.github/workflows/ci.yml`, `scripts/verify.sh`, security/acceptance/e2e tests, license scripts.

## Dependencies

All streams when their tests enter the verify gate.

## Files Likely Touched

`.github/workflows/ci.yml`, `scripts/*`, `tests/security`, `tests/acceptance`, `tests/e2e`.

## Interfaces To Preserve

`pnpm verify`, license checks, OSS checks, Prisma checks, Playwright E2E.

## Implementation Tasks

- Add real local lab E2E targets where possible.
- Keep fixture-only tests as unit/integration tests, not product proof.
- Add regression tests for new safety boundaries.

## Acceptance Criteria

- CI passes without real customer secrets.
- Security tests cover policy denial, tenant isolation, redaction, runner signatures, and evidence authorization.

## Tests To Run

`pnpm verify`.

## Safety Boundaries

No CI job should run real external validation against third-party targets.

## Explicitly Not Allowed

Do not require customer secrets for CI.

## Required Environment Variables

CI-local database and Redis URLs.

## Conflict Avoidance

Coordinate with all streams before adding slow or environment-sensitive gates.
