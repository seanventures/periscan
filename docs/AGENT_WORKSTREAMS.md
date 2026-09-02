# Agent Workstreams

Parallel work can start only after `docs/CODEBASE_ASSESSMENT.md`, `AGENTS.md`, and these task files exist.

## Coordination Rules

- Preserve the existing stack and package boundaries.
- Keep API contracts in `packages/shared` before adding app-specific DTOs.
- Do not assign two agents to the same core file without explicit coordination.
- Product-visible data must be real, persisted, lab-backed, or honestly not configured.
- Planned integrations remain non-connectable.
- Denied validation tasks must never be queued.

## Workstreams

| Workstream                    | Primary owner files                           | Avoid overlapping with                                 |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------ |
| 01 Codebase Foundation        | `docs/`, `README.md`, `AGENTS.md`             | All implementation streams when docs are being updated |
| 02 Schemas and Data Model     | `packages/shared`, `packages/db/prisma`       | Policy, API routes, reports until schemas land         |
| 03 Policy and Safety          | `packages/policy`, API policy paths           | Validation modules and runner                          |
| 04 Signal Fabric Integrations | `packages/connectors`, integration API routes | Modules and evidence graph                             |
| 05 Validation Modules         | `packages/modules`, worker processor          | Policy and OSS license work                            |
| 06 Evidence Graph Risk        | `packages/evidence`, graph/risk APIs          | Reports and unified findings                           |
| 07 Validation Snapshot        | Snapshot API/service/report wiring            | Reports and evidence graph                             |
| 08 Reports Evidence Packs     | `packages/reports`, report API/UI             | Snapshot and analyst notes                             |
| 09 Web Admin UI               | `apps/web`                                    | API contract changes until merged                      |
| 10 AI App Validation          | AI app routes/modules/catalogs                | Control validation                                     |
| 11 Control Validation         | Control source routes/modules/catalogs        | AI validation and runner                               |
| 12 Threat Center              | Threat advisory schemas/API/reports           | Data model and evidence graph                          |
| 13 Internal Runner            | `apps/runner`, runner API/shared contracts    | Control validation live execution                      |
| 14 MSSP Billing               | Tenant/admin/billing APIs and UI              | Reports branding                                       |
| 15 CI Security Hardening      | `.github`, `scripts`, tests/security          | All streams when changing verify gate                  |

## Historical Parallel Prompts

The prompts below were the June 2026 manual-import workstream bootstrap. They are
kept for traceability, not current work selection. Current Threat Center scope
also includes the implemented public super-feed, CISA KEV ingestion, tenant feed
schedules, and threat-feed alert/correlation APIs. Do not add commercial/private
feed vendors until customer authorization, source terms, and tests exist.

- Workstream 02: Add Threat Center shared schemas and Prisma migration review notes; keep this historical prompt limited to manual import.
- Workstream 03: Extend policy tests for advisory-triggered validation plans and missing-signal states.
- Workstream 06: Add missing-signal graph representation and confidence impact tests.
- Workstream 09: Add honest empty/not-configured UI states for unified findings and Threat Center navigation.
- Workstream 12: Implement manual advisory import API, evidence storage, extracted CVE/IoC/TTP fields, validation plan generation, and readiness report skeleton.
