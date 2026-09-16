# Periscan Architecture

This document adapts the Periscan PRD to the current repository. Do not replace this architecture without an explicit migration plan.

## Current Runtime

- `apps/web`: Next.js App Router UI and API proxy consumer.
- `apps/api`: Fastify API, OpenAPI, session auth, tenant context, RBAC, public `/api/v1` routes.
- `apps/worker`: TypeScript module worker.
- `apps/runner`: Go internal runner using outbound polling and signed tasks (full spec: [RUNNER_SPEC.md](RUNNER_SPEC.md); outbound-only, no reverse SSH).
- `packages/shared`: Zod schemas, API constants, runner contracts, validation catalogs.
- `packages/db`: Prisma/PostgreSQL schema, migrations, seeds, environment resolution.
- `packages/policy`: safety decisions and external validation guards.
- `packages/evidence`: storage, graph, correlation, risk, remediation helpers.
- `packages/connectors`: connector manifests and interfaces.
- `packages/modules`: validation modules, manifests, OSS runtime readiness.
- `packages/reports`: evidence pack HTML/PDF rendering.
- `packages/operators`: policy-bounded workflow recommendations and evidence-grounded summaries.
- `packages/model-gateway`: Frontier Gateway engine — provider adapters (BYO keys), credential encryption, code-defined tool catalog, context broker, policy enforcement point, tool executors, and the turn orchestrator.

## Control Plane Boundaries

The Fastify API is the product control plane. It owns auth, tenant context, policy, integration registry, validation missions, evidence graph access, remediations, reports, runner task issuance, billing meters, and admin/trust surfaces.

The web app must remain a client of API data. Product logic should not move into UI-only state.

## Data Boundaries

PostgreSQL is the system of record for tenant-scoped metadata. Evidence artifact content lives behind the evidence storage abstraction. Raw scanner output must not be a primary UX surface.

## Validation Flow

1. Scope is created and verified.
2. Integration or runner capability is configured.
3. Mission receives a policy decision.
4. Worker or runner executes an approved module.
5. Raw/redacted evidence is stored.
6. Signals and graph entries are normalized.
7. Findings, attack paths, reports, and remediations are generated from evidence.

## Frontier Gateway

The Frontier Gateway is a policy-controlled orchestration layer that lets a customer's own frontier model (BYO OpenAI-compatible / Anthropic-compatible API key) reason over redacted evidence and request typed Periscan tools. It adds no new way to touch customer systems — every tool routes through existing services (evidence reads, `previewPolicyDecision` -> `createMission` -> `startMission`, operators, reports). Its core rule: the model thinks, Periscan controls, evidence proves.

Components (all in `packages/model-gateway`, invoked by both the API and the worker via dependency injection):

- Provider adapters implement a single `ModelProviderAdapter` interface (`testConnection`, `createTurn`). A future specialized cyber model is a new adapter only; the core loop is unchanged.
- Credential storage encrypts BYO API keys at rest with AES-256-GCM. Keys are never logged, never sent to the model, and never returned on read.
- The context broker assembles a minimal `ContextBundle` from session scopes and runs everything through `redactEvidenceArtifact` before any model input.
- The code-defined tool catalog (not the DB) is the authoritative source for each tool's input/output schema, safety class, safety level, required role, approval default, and allowed session modes. The DB holds only per-tenant `ModelTool` overrides.
- The Policy Enforcement Point evaluates every tool request against the session's policy profile and tenant overrides to yield `Allowed` / `RequiresApproval` / `Denied`. Denied requests are recorded and never queue an underlying action.
- The turn orchestrator runs on the `model-gateway-turns` BullMQ queue: assemble context + tool schemas -> call the provider -> for each tool call create a `ModelToolRequest` -> PEP -> execute allowed read-only/plan tools inline and return redacted results, or pause the session for approval, or return a denial. Kill switch and session timeout abort the loop.

Session modes (`PlanOnly`, `ReadOnlyEvidence`, `SafeValidation`, `GuidedRemediation`, `HighAssurance`) gate which tools are available. Action tools (validation, remediation, reporting) are approval-gated and reuse the existing mission/approval machinery; the model can never mark a risk fixed without a real verification event.

Endpoints live under `/api/v1/model-gateway/*` (providers, policies, sessions, context-bundles, tools, tool-requests, turns, audit-events, kill-switch).

## Real-First Rule

Product-visible tenant outcomes must be backed by persisted evidence or honest not-configured states. Fixtures are for tests and isolated sample/demo routes only.

## Extension Points

- Add connectors through `packages/connectors`.
- Add validation modules through `packages/modules`.
- Add shared contracts in `packages/shared`.
- Add persistence through Prisma migrations in `packages/db`.
- Add API routes in `apps/api/src/app.ts` and service logic in `apps/api/src/runtime-services.ts`.
