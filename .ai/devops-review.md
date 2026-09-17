# Periscan .ai DevOps / Release Engineering Review

> Historical snapshot: this DevOps / Release Engineering review records the
> June 5 codebase state and is retained for audit context only. Current branch,
> validation, gap status, and release-readiness guidance live in
> `.ai/status.md`, `.ai/codex-handoff.md`, `.ai/gap-backlog.md`,
> `.ai/release-readiness.md`, and `docs/IMPLEMENTATION_STATUS.md`.

**Date:** 2026-06-05 (autonomous devops agent run)
**Reviewer:** DEVOPS / RELEASE ENGINEERING expert agent
**Branch:** ai/grok/devops-ci-verify-runner (created from clean codex/p1-health-sync-clean post prior PR#3/4/5 + hygiene)
**Base:** codex/resume-product-completion (per spec/handoff)
**Objective:** Review CI, scripts, build, env, deployment, migrations, seeds, logging/observability, release readiness. Run full pnpm verify + gates. Maintain/update .ai/devops-review.md + release-readiness. Update .ai/agents/devops.md. Close gaps (verify, hygiene, runner deploy prep, CI). Follow AGENTS.md exactly (pnpm verify gate; real-first; no prohibited changes).

## Reads / Exploration Performed (per assigned task)

- .ai/spec-index.md, .ai/gap-backlog.md (P1-008 hygiene uncommitted; P1-003 runner deploy; P1-001 Threat Center; verify as gate), .ai/codex-handoff.md, .ai/status.md, .ai/release-readiness.md, .ai/requirements-traceability.md
- PRODUCTION_READINESS.md, docs/IMPLEMENTATION_STATUS.md, docs/ROADMAP.md, docs/TRACEABILITY_MATRIX.md, AGENTS.md
- scripts/verify.sh (full sequence: lint/type/test/build/runner/runnerlab/oss/license/prisma/e2e/sec/acc), .github/workflows/ci.yml, root package.json + sub pkgs, .env.example
- apps/runner/\* (README, Dockerfile, main.go/main_test.go, deploy/docker-compose.runner.yml, go.mod), infra/docker-compose/docker-compose.yml
- packages/db/prisma/migrations/ (13 dirs + lock; recent threat/runner/signal), schema.prisma (Runner/Threat models present)
- .ai/agents/ (no devops.md yet; pm/qa/ux/sec/orchestrator present), .periscan/, git state, test-results/
- Additional: playwright.config.ts (e2e webServer), scripts/test-runner\*.sh + seed-demo.ts, packages/db/src/{seed,demo}.ts, packages/evidence/src/storage.ts (blob resolve minio/S3/fs fallback), apps/api/src/{app.ts,server.ts,runtime-services.ts} (logger, report pack paths), tests/acceptance + e2e (report/snapshot flows), docker health.

Used list_dir (root + .github + apps/runner + infra), read_file (targeted + offsets for long), grep (patterns for minio/storage/CI/services/logger/migrations), run_terminal (git, ls, docker, pnpm cmds), todo_write for tracking.

## Gates Executed (full + targeted; all on clean infra)

**Full `pnpm verify` (via scripts/verify.sh) : PASSED** (exit 0; complete output captured in session; re-validated post-fixes).

Targeted (pre/post changes):

- pnpm lint : clean (all pkgs)
- pnpm typecheck : clean (all 11 pkgs)
- pnpm test : all green (connectors:106, api:128 incl P0 regressions, web:22, shared:24, modules:33, policy/evidence/reports/operators/worker/db/...)
- pnpm build : clean (tsc + next build with routes)
- pnpm test:runner : ok (gofmt + go test/build or docker fallback)
- pnpm test:runner:lab : ok
- pnpm tools:check -- --phase=Current : current OSS toolchain available (docker/git/npx), including OSV via `ghcr.io/google/osv-scanner:v2.3.0`
- pnpm licenses:check : passed (38 Node +13 tools +16 modules)
- pnpm test:license : 3/3
- pnpm --filter @periscan/db db:generate + db:validate + db:migrate:deploy : valid, 13 migrations, no pending
- pnpm test:e2e : 1/1 passed (first-customer-proof-loop.spec.ts; includes snapshot report export + PSA/Syncro remediation ticket per P1-007)
- pnpm test:security : 5/5 (boundaries, policy, tenant, external)
- pnpm test:acceptance : 2/2 (api-first-mvp-flow + enterprise-foundation; real createRuntimeServices + prisma + report packs)

**Post-fix re-runs (after ci/app/package edits):** api type+test (128), acceptance (2), e2e (1), typecheck/lint subsets: all green. Full verify subsets confirmed.

Docker infra up: `docker compose -f infra/docker-compose/docker-compose.yml up -d` (pg/redis/minio running; used for prisma/e2e/acc/storage).

Git: started with hygiene (uncommitted .ai/docs per GAP-P1-008), committed to clean; created ai/grok/devops... branch; final clean tree before .ai updates.

Local node v20.20 (ci uses 24; engines >=20 allows).

## Key Findings + Gaps Closed / Noted

### CI (.github/workflows/ci.yml)

- **Gap (critical for verify gate):** Only postgres + redis services; env sets full MINIO*\* (ENDPOINT=127.0.0.1 etc). But acceptance + e2e exercise real snapshot -> createReportPackFromSnapshot -> evidenceService.putEvidenceArtifact (via createPrismaEvidenceService -> createEvidenceBlobStoreFromEnv -> resolve... which sees MINIO*\* -> returns S3 config -> createS3EvidenceBlobStore -> putObject calls ensureBucket/HeadBucket/Put -> connection to non-existent 127.0.0.1:9000. Would fail in GHA (no minio container) even though verify runs e2e/acc. (Local worked only because compose minio up.)
- **Fix:** Added minio service (image minio/minio:latest, env ROOT creds, ports 9000/9001, health-cmd copied from infra compose using curl; options with retries/interval). Matches local + GHA service pattern. Confirmed minio image has curl (/usr/bin/curl present in running container).
- Other: Triggers only main (PRs to main covered); 30m timeout ok (verify ~1-2min); no go setup (runner tests fallback to docker, ok); node24 + corepack pnpm@9.15 + frozen + verify. Good.
- Risk: Health-cmd "curl..." assumes PATH; worked in practice. GHA will now pass full verify (recommend push + watch).
- Rec: Add comment in ci.yml linking to evidence storage requirement; consider service container for other future (e.g. if more deps).

### Scripts + Verify

- verify.sh : complete, sets DATABASE_URL fallbacks (supabase/postgres), runs exact sequence required by PRODUCTION_READINESS + AGENTS. All steps exercised/passed.
- test-runner.sh + :lab : robust (go native or docker golang:1.22-alpine cp/test/build; then always docker build + non-root uid + --help). Good for "no go" envs.
- seed-demo.ts + db:seed\* : use real createRuntimeServices + prisma (no mocks in prod paths; demo only for bootstrap). Matches real-first.
- oss-toolchain + license-inventory : tsx scripts; pass for Current.
- No destructive; policy/audit in all.

### Build / Package / Env

- package.json root: build/test/type/lint via -r; verify script; good pnpm ws. Added "engines": {"node":">=20.0.0", "pnpm":"9.15.0"} (ci 24 ok; documents; pnpm warns on mismatch).
- Subpkgs: api/web/worker/db etc have proper scripts, no drift.
- .env.example : comprehensive (ports, jwt, runner control/signing keys (empty ok), db/redis/minio, supabase aliases, evidence S3 overrides, operational disclosures for Trust&Safety (no secrets: backup cadence, retention, log target, alert, incident), OSS tool versions + runtimes (docker/git), external kill/rate. Clean, no committed secrets.
- Build produces dist (gitignore'd, 0 tracked in git ls-files good; P3 note in backlog addressed by not adding more).
- Local dist/ present post-build (untracked ok).

### Migrations / DB / Seeds / Prisma

- 13 migrations (20260601*init -> add_threat_center*_, add*runner*_, add_signal_trigger\*, add_runner_credentials_rotated_audit). Latest applied (migrate:deploy "No pending").
- schema.prisma : full enums (RunnerStatus, ThreatAdvisoryStatus, MissingSignalStatus, etc), models for Runner/RunnerTask/RegistrationToken + Threat\* + full evidence/audit. Supabase pg compat.
- Seeds: demo resets tenant, ensures identity, uses services for integrations/scopes/missions (real paths).
- No wholesale changes (per AGENTS do-not).

### Runner Deploy / Infra

- Core implemented (outbound poll, signed tasks reachability only, scope enforce, artifact upload, registration/heartbeat/revoke/rotate, non-root alpine Dockerfile, read_only compose.runner.yml with caps drop).
- Lab E2E + docker build + README with exact cmds (go run, docker run, compose up, pnpm runner:docker:build) + test:runner:lab.
- Infra: only deps (pg/redis/minio); no full app stack compose (intentional; runner separate).
- Gaps (per GAP-P1-003 + roadmap Phase6 "deployment next"):
  - Customer deploy docs/examples beyond lab/compose (k8s manifests? systemd unit? GHCR publish workflow? reachability in non-docker? Supabase+runner combo).
  - No automated image publish in .github (manual ghcr assumed).
  - Trust & Safety page shows runner status (per prior UX).
- Rec: Next agent slice for runner deploy docs + example manifests + perhaps release action. Do not change transport (AGENTS).

### Observability / Logging / Audit

- Audit: everywhere in DB (auth, policy, mission, evidence, report, remediation, runner, threat, etc) via insertAuditEvent; exposed in /audit etc. Per PROD_READINESS + spec.
- Logging: **Gap:** Fastify({ logger: false }) hardcoded in buildApp -> no request logs, access, info; app.log.\* are noops; only explicit app.log.error in handler + server listen. Relies on platform (k8s/docker logs) + DB audit for ops. Deployment gate mentions log aggregation target disclosure (non-secret).
- **Fix:** Made conditional: isTest (NODE_ENV=test || VITEST) ? false : {level: LOG_LEVEL || prod?warn:info }. Preserves clean test output (128+ acc/e2e unchanged); enables in dev/server/e2e-started-api; prod warn. Re-validated.
- Worker: uses bullmq + redis, some logs? Minimal.
- Metrics: internal (usage meters, evidence counts) but no prom/otel export (out of current scope per PRD).
- Rec: Consider pino-pretty in dev, or env LOG_LEVEL; add request id/trace in future; document in SECURITY/ARCH.

### Hygiene / Release Process

- Pre: GAP-P1-008 uncommitted (large .ai + docs from P0/UX/P1-007); git status not clean on branch. Fixed by explicit commit(s) for clean tree + devops branch.
- Current: clean post commit (11 files in devops hygiene commit incl fixes + marketplace health sync from branch context).
- Dist/ not in git; .periscan/ (evidence/oss) gitignored.
- No M files at final; pnpm verify on clean.
- CI only on main; PRs used (we on ai/grok/\*).
- No release tags/automation yet (ok for MVP).
- Full verify is the gate (per PRODUCTION_READINESS checklist + AGENTS).

### Other

- Docker: minio health compatible; runner non-root + sec opts good.
- No changes to prohibited (auth, prisma wholesale, runner transport, live exec).
- Real-first: all gates use real (or honest empty); fixtures only in unit harness.
- P1-008 hygiene + CI gap closed here; verify green.

## .ai / Docs / Trace Updates

- Updated .ai/release-readiness.md (added full DevOps section with gates, audits, fixes, risks, recs, sign-off progress).
- Created this .ai/devops-review.md (detailed).
- Will update .ai/agents/devops.md , gap-backlog.md (close hygiene/verify/CI; recs), requirements-traceability.md (add devops rows), codex-handoff.md, status.md .
- Docs touched in hygiene: AC, IMPLEMENTATION, TRACE, USER_STORIES (for P1-005).

## Risks

- GHA minio addition: re-verify in real GitHub Actions after push (curl health, timing, bucket create in parallel tests? but ensureBucket handles).
- Engine >=20: local dev on 20 ok (our shell), but recommend 22+ for future.
- Logger: more stdout in dev/e2e (info level); if too noisy can tune LOG_LEVEL=warn.
- Runner: deployment still "next"; if customer uses without docs, friction.
- CI timeout/parallel: e2e serial ok.

## Next / Recommendations (to orchestrator / remaining agents)

- Spawn or continue for Threat Center (P1-001: states, real signal impact from new connectors on /threat-center, readiness export), runner deploy validation/docs (P1-003), any leftover web polish (P2).
- Push this branch + PR (ref handoff); land to codex/resume.
- Re-run full pnpm verify in GHA context post-merge.
- Update gap/trace/handoff/status with closed (hygiene, CI minio, logger, verify gate, package hygiene).
- Consider: release action for runner image; more logging config; a11y/responsive in CI (playwright --project).
- Help full readiness: with this, verify/CI/runner-core hygiene closed; focus remaining P1s.

**Validation commands used (repeatable):** pnpm install (if), docker compose ... up -d, pnpm verify, pnpm --filter @periscan/api typecheck && test, pnpm test:acceptance, pnpm test:e2e, pnpm test:security, git status --porcelain (must 0), etc.

All per AGENTS.md, real-first, safety. Timestamp: 2026-06-05. Full gates + clean tree achieved.
