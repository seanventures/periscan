# 04 Signal Fabric Integrations

## Objective

Expand real connector support while preserving honest planned/not-configured marketplace states.

## Existing Codebase Areas Involved

`packages/connectors`, integration APIs, trust/safety API.

## Dependencies

Shared SignalEnvelope contracts and integration manifests.

## Files Likely Touched

`packages/connectors/src/index.ts`, `apps/api/src/runtime-services.ts`, `apps/api/src/app.ts`, connector tests.

## Interfaces To Preserve

Connector manifest shape, health/sync contract, SignalEnvelope output, planned connector denial.

## Implementation Tasks

- Add real connector auth flows only when credentials/config are available.
- Keep planned integrations non-connectable.
- Add not-configured setup instructions for missing credentials.

## Acceptance Criteria

- Connector health is real or explicitly not configured.
- Sync emits real SignalEnvelope records or returns a clear unavailable state.

## Tests To Run

`pnpm --filter @periscan/connectors test`, `pnpm --filter @periscan/api test`.

## Safety Boundaries

Connectors must use least privilege and avoid storing secrets in raw evidence.

## Explicitly Not Allowed

Do not fake EDR/SIEM/cloud verdicts.

## Required Environment Variables

Connector-specific credentials for live modes; tests use fixtures only.

## Conflict Avoidance

Coordinate with validation modules before adding connector-required module behavior.
