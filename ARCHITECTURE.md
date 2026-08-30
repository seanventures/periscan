# Periscan Architecture

## Core components

- Control plane web app for tenant workflows, validation orchestration, reports, and evidence review
- Fastify API for auth, tenant-scoped APIs, orchestration, and policy enforcement
- Worker process for jobs, modules, normalization, and evidence persistence
- Connectors for cloud, identity, code, controls, ticketing, and AI systems
- Module registry for safe validation engines and parsers
- Evidence graph backed by Postgres
- Raw evidence store backed by S3-compatible object storage
- Policy and safety engine for scope, approval, safety level, and execution gating
- Reports package for HTML and later PDF evidence packs
- Internal runner for outbound-only internal validation
- Frontier Gateway for policy-controlled, BYO-key model reasoning over redacted evidence via typed tools
- Runner transport and trust model documented in [RUNNER_ARCHITECTURE.md](RUNNER_ARCHITECTURE.md)

## Monorepo structure

```text
apps/
  api/
  web/
  worker/
  runner/
packages/
  shared/
  db/
  policy/
  evidence/
  connectors/
  modules/
  reports/
  operators/
  webhooks/
  model-gateway/
infra/
  docker-compose/
scripts/
```

## Initial stack

- Next.js App Router + TypeScript
- Fastify + TypeScript
- BullMQ + Redis
- Prisma + Postgres
- MinIO for local S3-compatible evidence storage
- Zod for shared runtime validation

## Architectural rules

- `packages/shared` owns shared schemas and cross-service contracts.
- `packages/db` owns Prisma schema, migrations, and shared data access helpers.
- The product is API-first: customer-visible capabilities must exist in the Fastify API before or alongside UI flows.
- Public routes live under a versioned namespace, starting with `/api/v1`.
- The web app may only consume product data through API contracts; it must not read the database or worker/package internals directly.
- Next route handlers must stay thin: auth/session adaptation and proxying are allowed, but product business logic belongs in the Fastify API.
- Every validation workflow must pass policy before queueing execution.
- Raw evidence and normalized evidence remain separate.
- UI must read real backend data, even when that data comes from fixtures.
