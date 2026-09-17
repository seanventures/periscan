# Periscan .ai Architecture Review (Initial)

> Historical snapshot: this initial architecture review records the June 5 codebase state and is retained for audit context only. Current branch, validation, gap status, and release-readiness guidance live in `.ai/status.md`, `.ai/codex-handoff.md`, `.ai/gap-backlog.md`, `.ai/release-readiness.md`, and `docs/IMPLEMENTATION_STATUS.md`.

**Date:** 2026-06-05
**Reviewer:** Orchestrator (Architect agent spawned)

## Structure

- Monorepo pnpm, Fastify API (src/app.ts routes + runtime-services business), Next web consumer, worker (bullmq), Go runner (outbound poll only), Prisma db, packages for shared/evidence/policy/connectors/modules/reports.
- Preserved per AGENTS.md.

## Data Flow

- API first: all mutations/queries via Fastify, web calls API (or /api proxy?).
- Evidence: storage (S3 compat/MinIO), graph (pg), correlation/risk/remediation in packages/evidence.
- Missions -> jobs -> worker/processor -> modules/connectors -> evidence -> runs.
- Runner: signed tasks, artifact upload, result callback (scope enforced on both sides).

## Extensibility

- Connectors: manifest + impl in packages/connectors, registered, exposed via catalog API.
- Modules: similar in packages/modules.
- Policy: pluggable constraints, external validation guards.
- Good for expansion (evident from 100+ connectors added incrementally).

## P0 Fix Notes (Architecture)

- Target resolution: computed once, passed to constraints/guard/persist/run/job. Clean, no dup after fix.
- Binding: early checks in create/start before side effects (queue, runs). Good fail-fast.
- Auth context: centralized, now resilient.

## Risks / Maintainability

- Large runtime-services.ts and app.test.ts (monolithic; tests > production LOC in places). Refactor opportunity but P3.
- No obvious hot paths or N+1 (but review with load in mind).
- Migrations safe (14 in db); seeds demo deterministic.
- Observability: audit events good; structured logs? metrics? (P2).

## Deployment

- Supabase aliases supported.
- Runner Docker non-root, compose example.
- CI via verify script + GHA.

## Recommendations (Architect agent to expand)

- Extract small helpers for repeated target/decision resolve if grows.
- Consider rate limit / queue backpressure explicit for high-volume connectors.
- Confirm no cross-tenant leakage in any new connector path (already in security).

Full from spawned Architect if separate; this bootstrap ok for now.
**P1-007 PSA tickets arch:** Added shared Zod+type in domain (per convention), generalized service without duplicating logic (reused sendWorkflow + payload), route light, web client+UI. Preserves monorepo/Fastify/Next/Prisma. No runner/auth change. Good.
