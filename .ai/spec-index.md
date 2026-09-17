# Periscan .ai Spec Index

## 2026-06-27 Current Addendum

This file started as a June 5 autonomous discovery artifact. Treat this addendum
as authoritative over the historical discovery sections below.

- Current active branch for Codex work is `codex/integrate-validated-pr-stack`,
  tracking `origin/codex/integrate-validated-pr-stack`.
- GitHub PR #36 (`codex/module-manifest-safety-metadata`) is closed as
  superseded. Its head commit `f84925f` is already contained in the active
  integration branch, so do not reopen or duplicate that work.
- `gh pr status --repo seanheiney/periscan` showed no open pull requests after
  the PR #36 supersession cleanup.
- The old "current branch", open PR, and connector-expansion notes below are
  historical context, not current work selection guidance.
- Threat Center external feed status is current: manual advisory
  import, readiness planning, missing-signal intelligence, HTML/PDF readiness
  export, public super-feed ingestion, CISA KEV ingestion, and tenant recurring
  feed schedules are implemented and tested. Commercial/private feed onboarding
  remains a customer/business decision.
- MSSP/Billing/Executive foundation is implemented for API-first parent/child
  tenants, tenant switching, usage meters, client portfolio, executive metrics,
  branded HTML reports, and first-party `/mssp` report-branding settings.
  Payment processor/checkout packaging remains out of scope for this phase.
- Connector expansion after this addendum includes Datto RMM, Kaseya VSA,
  Oracle Cloud Infrastructure, and Alibaba Cloud as Beta connectable read-only
  connectors. Current generated integration docs distinguish 126 dedicated live
  integrations from 141 standardized catalog entries that are Planned and
  non-connectable until a vendor-specific client is certified.
- Connected integration records, the Integration Marketplace, and Trust & Safety
  now expose API-backed implementation tier, execution readiness, readiness
  reason, dedicated-client posture, and live-support status. Use those fields
  instead of inferring connector maturity from historical prose.
- Module manifest safety metadata is part of the active integration branch:
  `/api/v1/modules` and `/registries` expose runtime, license, network,
  destructive-potential, data-sensitivity, target-write, target-modify,
  code-execution, exfiltration, redaction, maintainer, and status fields from
  the shared manifest contract.
- Planned roadmap entries must remain catalog-only and non-connectable until a
  real connector implementation, tests, and safety review land together.
- Live Atomic non-dry-run, SharpHound collection, Caldera execution, and other
  offensive/adversarial workflows remain intentionally blocked unless future
  legal/safety approval, verified customer scope, runner workflow, and approval
  windows exist.
- `docs/PRD_SELF_CONTAINED_RUNNER.md` is historical/superseded context, not an
  authority to enable reverse SSH, arbitrary tunnels, SharpHound collection, or
  live Caldera/Atomic execution. Use `docs/RUNNER_SPEC.md`,
  `SECURITY_BOUNDARIES.md`, and `AGENTS.md` for current runner boundaries.
- Customer-live use of real connectors and validation modules still requires
  customer-supplied credentials, verified scopes, test accounts where needed,
  and deployment-managed production secrets/infrastructure.

## Historical Discovery Metadata

The metadata below is from the original 2026-06-05 autonomous discovery pass and
is retained for audit context only. It is not current branch, PR, or work
selection guidance.

**Generated:** 2026-06-05T15:15:00Z (autonomous discovery)
**Product:** Periscan
**Repo:** https://github.com/seanheiney/periscan.git (private)
**Repo root:** /Volumes/DataSSD1/test/periscan
**Discovery branch:** codex/resume-product-completion (up to date with origin)
**Discovery base branch:** main (origin/HEAD)
**Discovery git status:** clean (after safe commit of pending Syncro connector work on the branch)

## Discovered Product Identity

- Name: Periscan
- One-liner (README): "self-service Automated Security Validation platform"
- Tagline (PRD): "Find the path. Validate the risk. Prove it's fixed."
- Category: Automated Security Validation (converging BAS, exposure management, attack path, control validation, AI app validation, fix verification, evidence packs)
- Key constraint: API-first (Fastify API is source of truth; Next.js web is consumer; external automation supported)
- Monorepo: pnpm workspaces (apps/api, apps/web, apps/worker, apps/runner; packages/shared, db, policy, evidence, connectors, modules, reports, operators)
- Safety: verified scope required; no destructive; policy gates; audit everywhere; external validation kill-switches and allowlists.

## Primary Source-of-Truth Documents (ordered by explicitness + recency for product behavior)

1. **PRD.md** (root) - High confidence. Short core PRD defining modules, outcomes, validation states, first-customer direction, and platform deltas.
2. **docs/PERISCAN_FULL_PRODUCT_PRD.md** - Highest confidence long-form. Vision, principles (proof over findings, self-service not low-end, AI grounded, safety is product), detailed modules (Validation Snapshot as wedge, exposure, control, attack-path, AI app, fix verification, evidence, operators, signal fabric, runner), personas, journeys, non-goals.
3. **docs/PRODUCT_COMPLETION_PLAN.md** - High. Current status (implemented vs credential-dependent vs residual risks), explicit "what is done", "needs credential".
4. **docs/IMPLEMENTATION_STATUS.md** - High. Area-by-area `Done` table plus detailed `Not Configured / Requires Integration` customer/deployment prerequisite list.
5. **docs/ROADMAP.md** - High. Phased: 0 Foundation (done), 1 Validation Snapshot (done for the current first-customer surface), 2 Real-First Connector Expansion (implemented for the current first-customer connector set, live use credential-gated), 3 BAS/detection (dry-run done, live gated), 4 Threat Center (manual import, public feeds, readiness, and schedules implemented; private feeds business-gated), 5 Signal-Driven Triggers (API done, execution policy-gated), 6 Internal Runner (core done, customer deployment validation is environment-specific), 7 MSSP/Billing/Executive (foundation and white-label UI done; payments out of scope).
6. **docs/TRACEABILITY_MATRIX.md** - High. Row-level PRD requirement labels to files/tests/status.
7. **docs/USER_STORIES.md** - Medium-High. "As a [persona]..." stories grouped by area (runner, first-customer, operational, evidence, design partner, trust/safety, marketplace, etc.).
8. **docs/ACCEPTANCE_CRITERIA.md** - Medium-High. Given/When/Then covering happy, empty, error, validation, authz, role, persistence, edge.
9. **PRODUCTION_READINESS.md** - High for gates. Ready-in-repo vs deployment-managed vs first-customer checklist + known prerequisites.
10. **ARCHITECTURE.md**, **SECURITY_BOUNDARIES.md**, **OPEN_SOURCE_POLICY.md**, **RUNNER_ARCHITECTURE.md** - High for constraints.

## Supporting / Context Docs

- docs/COMPLETION_REPORT.md (prior report)
- docs/CODEBASE_ASSESSMENT.md
- docs/AGENT_WORKSTREAMS.md , docs/agent-tasks/\*.md (historical slices)
- README.md (commands, routes, API surface list, demo bootstrap)
- demo/DEMO_SCRIPT.md
- .env.example (no committed secrets)
- packages/db/prisma/schema.prisma + migrations
- apps/api/src/app.ts (full public route surface)
- tests/acceptance/_ , tests/e2e/_ , tests/security/\*
- .github/workflows/ci.yml
- scripts/verify.sh (the single gate: lint+typecheck+test+build+oss+license+prisma+playwright+e2e+security)
- AGENTS.md (this session's guardrails)

## Historical GitHub State at Discovery

- No open issues.
- 2 open PRs (both cursor/\* branches, not yet merged to main):
  - #2: "Fix external validation target persistence" (cursor/critical-bug-investigation-682f)
  - #1: "Fix mission policy binding and redact integration secrets" (cursor/critical-bug-investigation-3246)
- Recent activity on codex branches heavily focused on Phase 2 connector expansion (many "feat: add X connector" commits: autotask, halopsa, ninjaone, connectwise, snowflake, gmail security, armis, cortex xpanse, orca, prisma cloud, abnormal, mimecast, proofpoint, zia, fortigate, panorama, imperva, akamai, ... and now syncro).
- Current branch (codex/resume-product-completion) just landed Syncro connector + test + doc updates (committed during session bootstrap for clean state; 105 connector tests + 126 api tests passed).
- gh CLI available and authenticated for this user.

## .ai Coordination Files (created by this run)

All under .ai/ (new directory; was absent at start):

- spec-index.md (this file)
- status.md
- activity-log.md
- codex-handoff.md
- requirements-traceability.md
- gap-backlog.md
- product-review.md
- ux-review.md
- architecture-review.md
- security-review.md
- qa-review.md
- release-readiness.md
- agents/ (per-agent state)

## Key Product Assumptions / Conventions (from sources, no conflicts)

- Real-first / API-first / no fake in primary UX (fixtures only in tests or clearly labeled demo).
- Every validation requires policy decision + audit.
- Raw scanner output never primary UX/report surface.
- Connectors: catalog 100+ entries; "beta"/implemented vs planned/non-connectable until real impl+tests.
- Live adversarial (Atomic non-dry, SharpHound, Caldera full, etc.) intentionally blocked.
- Payment processing explicitly out-of-scope for this phase.
- Threat Center public feed ingestion is implemented; commercial/private feed onboarding remains a customer/business decision.
- Supabase-compatible aliases supported.

## Ambiguities / Conflicts / Resolutions

- Cursor PRs open on main: will monitor; do not duplicate fixes; coordinate via codex-handoff. Prefer preserving most complete PRD-compliant behavior.
- Connector expansion is the active slice on this branch: treat as continuing Phase 2 work; new work will branch from here (ai/grok/\*).
- No formal contradiction in PRDs; "MVP" vs "full" clearly differentiated by "credential dependent" and "policy gated".
- If underspecified: choose safest production-grade, evidence-backed, auditable, server-enforced behavior; document assumption.

## Confidence Levels

- Core PRD/roadmap/implementation status: 95% (multiple cross-referenced sources + running tests + code match current claims).
- Exact remaining P0 UI/edge gaps: 80% (will be validated by agents reading live routes + running e2e + manual nav).
- Connector completeness for newly added (e.g. Syncro): high (tests pass, typecheck pass, follows established pattern of prior connectors).

## Next Autonomous Steps (per mission)

1. Create/maintain all .ai/ coordination files with traceability.
2. Spawn parallel expert agents (orchestrator, PM, UX, architect, security, QA, devops, codex-coord, feature eng).
3. Rebuild full requirements traceability from sources + current code.
4. Identify/prioritize P0/P1/P2/P3 gaps (close P0 immediately).
5. Implement vertical slices on focused ai/grok/\* branches or worktrees.
6. Validate with pnpm verify (or targeted), reviews, push/PRs where possible.
7. Keep codex-handoff.md live.
8. 15-min terminal + activity-log updates.
9. Grind until all feasible discovered requirements are complete per World-Class Definition of Done (no mocks in prod paths, end-to-end, tests, reviews, docs).

If blocked on secrets/approvals/destructive/prod DB: document exactly and stop only that workstream.

Reference: AGENTS.md (follow exactly: pnpm install, docker compose up, pnpm verify, real-first, safety, no touch auth/runner transport/Prisma wholesale without approval).

This index is the living discovery artifact; update on new findings.
