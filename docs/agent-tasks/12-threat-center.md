# 12 Threat Center

> Historical manual-import task prompt. The manual advisory workflow remains
> valid, but the current product also implements public threat-feed ingestion,
> CISA KEV import, tenant feed schedules, and threat-feed alerts/correlation.
> Feed data is awareness/readiness context only; it is not validation proof
> without policy-gated validation evidence.

## Objective

Turn manually imported advisories into evidence-backed validation plans and readiness reports.

## Existing Codebase Areas Involved

Shared schemas, Prisma data model, evidence storage, graph, reports, API routes.

## Dependencies

Schemas/data model, evidence graph, policy engine.

## Files Likely Touched

`packages/shared/src/domain.ts`, `packages/db/prisma/schema.prisma`, `apps/api/src/app.ts`, `apps/api/src/runtime-services.ts`, `packages/reports`.

## Interfaces To Preserve

EvidenceArtifact, SignalEnvelope, policy decision, mission, report APIs.

## Implementation Tasks

- Manual advisory import.
- Store raw advisory as evidence.
- Extract CVE, IoC, and TTP fields.
- Map MITRE technique IDs.
- Generate missing-signal analysis.
- Generate validation plan and readiness report skeleton.

## Acceptance Criteria

- Manual advisory outputs show missing signals when proof is insufficient; public feed outputs remain awareness/readiness context and never claim validation proof by themselves.
- Advisory outputs show missing signals when proof is insufficient.
- Readiness report uses only normalized evidence and advisory data.

## Tests To Run

`pnpm --filter @periscan/shared test`, `pnpm --filter @periscan/db test`, `pnpm --filter @periscan/api test`, `pnpm --filter @periscan/reports test`.

## Safety Boundaries

Threat Center creates plans; it does not execute validation without policy approval.

## Explicitly Not Allowed

Do not pretend feed intelligence proves exploitability, detection, or fix status without evidence-backed validation. Do not add commercial/private feed vendors without customer authorization, source terms review, and tests.

## Required Environment Variables

None for manual import.

## Conflict Avoidance

Coordinate with data model and evidence graph streams before migrations.
