# Package license matrix (pre–open-source)

**Status:** working scaffold — **root `LICENSE` remains proprietary** until an
explicit founder + counsel decision (see [`OPEN_SOURCE_PROJECT_PLAN.md`](./OPEN_SOURCE_PROJECT_PLAN.md)).

Tag meanings:

| Tag | Intent |
|-----|--------|
| `core-oss` | Candidate for Apache-2.0 (or MIT) under open-core Option A |
| `commercial` | Likely remains proprietary / SaaS-only in open core |
| `lab` | Lab/demo tooling; ship with core-oss |
| `docs` | Documentation; usually same as core |
| `engines` | Third-party engines keep **upstream SPDX** (not product LICENSE) |

## Monorepo packages (proposed)

| Path | Tag | Notes |
|------|-----|-------|
| `apps/api` | `core-oss` | Control plane; strip commercial-only routes if split later |
| `apps/web` | `core-oss` / review | May later split community vs enterprise UI packs |
| `apps/worker` | `core-oss` | Job worker |
| `apps/runner` | `core-oss` | Outbound runner agent |
| `packages/shared` | `core-oss` | Public contracts |
| `packages/db` | `core-oss` | Schema/migrations |
| `packages/policy` | `core-oss` | Safety gates — must stay in OSS |
| `packages/evidence` | `core-oss` | Evidence graph helpers |
| `packages/modules` | `core-oss` + `engines` | First-party manifests OSS; tool binaries SPDX |
| `packages/connectors` | `core-oss` | Interfaces + honest NotConfigured |
| `packages/reports` | `core-oss` | Report generation |
| `infra/lab` | `lab` | Physical + Phase 3 scaffold |
| `infra/docker-compose` | `lab` / `core-oss` | Local deps |
| `docs/` | `docs` | Exclude wartime sales if desired |
| `docs/competitive/` | review | Positioning OK; deny-list stays public honesty |
| Hosted multi-tenant SaaS ops | `commercial` | Not a package yet |
| MSSP portfolio advanced | `commercial` | Review surface |
| Premium compliance catalogs | `commercial` | Catalog completeness residual |

## Engines (unchanged policy)

Governed by [`OPEN_SOURCE_POLICY.md`](../OPEN_SOURCE_POLICY.md) and
[`OPEN_SOURCE_LICENSE_POLICY.md`](./OPEN_SOURCE_LICENSE_POLICY.md):

- Allowed permissive tools: installable when certified  
- GPL/LGPL: `RequiresLegalReview`  
- AGPL/SSPL/BSL/Commons Clause/PolyForm: **Blocked**

## Next steps

1. Founder decision: open core (A) vs full OSS (B) vs source-available (C).  
2. Per-package `LICENSE` files only after decision.  
3. `pnpm licenses:check` remains CI-mandatory regardless of product LICENSE.  
4. History scrub + secret scan before any public mirror.
