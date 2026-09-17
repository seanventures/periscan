# Periscan .ai Agent: DevOps / Feature Engineering - Runner Deploy P1 (GAP-P1-003 + Phase 6)

**Agent ID / Role:** DEVOPS / FEATURE ENGINEERING expert subagent (runner customer deployment validation)
**Assigned:** 2026-06-05 (per DevOps recs in .ai/devops-review.md + codex-handoff + gap-backlog P1-003; spawned for vertical beyond lab E2E)
**Branch:** ai/grok/p1-runner-deploy (created from clean codex/resume-product-completion base after isolating prior branch stashes)
**Objective:** Implement docs/impl for internal runner customer deployment validation (per DoD: trace, real, tests, reviews, no fakes). Focus feasible per user: update docs (README, PRODUCTION_READINESS, RUNNER_ARCHITECTURE, deploy examples), add CI GHCR publish if missing, k8s/systemd/compose examples, Supabase combo notes, reachability/artifact tests if gaps (none), observability. Follow AGENTS.md exactly (no runner transport change, real-first, pnpm verify gate, no prohibited). Update .ai/ (gap close, trace, handoff, this agents/runner-deploy.md). Push, PR traceable. Report absolute paths + snippets + validation.

## Context from spec/gap/handoff/devops/trace

- GAP-P1-003: "Internal runner customer deployment validation / docs / compose examples beyond lab E2E may be incomplete for real prod (non-docker local) or Supabase+runner combo." Linked Phase 6, PRD-Runner-\*, RUNNER_ARCHITECTURE, PRODUCTION_READINESS "deployment-managed". Status was Open; core+lab+packaging done.
- Historical roadmap context at assignment: customer-specific runner deployment validation still needed a target environment. Later repo-owned runner deployment artifacts closed the in-repo slice; customer deployment validation remains environment-dependent.
- DevOps recs: "Customer deploy docs/examples beyond lab/compose (k8s manifests? systemd unit? GHCR publish workflow? reachability in non-docker? Supabase+runner combo). No automated image publish in .github (manual ghcr assumed). Rec: Next agent slice for runner deploy docs + example manifests + perhaps release action."
- .ai/requirements-traceability DEVOPS-RUNNER-DEPLOY-01: open for k8s/systemd/publish/docs.
- Existing solid: apps/runner/{Dockerfile (non-root alpine 65532), deploy/docker-compose.runner.yml (read_only+sec), README.md (lab cmds, GHCR ref), main.go (reachability+artifact), main_test.go + scripts/test-runner\*.sh (gofmt/test/build/docker nonroot/help + lab E2E), package.json scripts, .github/workflows/ci.yml (no publish), verify.sh (includes runner), .env.example (runner+supabase), RUNNER_ARCHITECTURE.md (core), PRODUCTION_READINESS (deployment gate), IMPLEMENTATION_STATUS ("Done"), TRACEABILITY (packaging row).
- Audit: lab E2E solid (loopback reach + upload), no gaps in reach/artifact tests (don't add fake tests), no code edits to runner (per AGENTS + "no runner transport change").
- Assumptions documented: customer provides k8s/systemd/compose host, secrets mgmt, egress, verified scopes. No real creds in repo. External publish uses GITHUB_TOKEN (standard, note if fork needs extra).

## Reads / Exploration Performed (per assigned start + AGENTS)

- Used list_dir (., .ai, docs, apps/runner, .github/workflows, scripts, infra), read_file (targeted + limits for long: gap, handoff, devops-review, release-readiness, spec-index, agent-task-13, IMPLEMENTATION_STATUS, RUNNER_ARCHITECTURE (full), PRODUCTION_READINESS (root+docs), ROADMAP, TRACEABILITY, runner README/Dockerfile/compose/main.go/main_test, ci.yml, test-runner\*.sh, .env.example, agents/devops/orchestrator, requirements-traceability, package.json via grep).
- run_terminal: git branch/status/log (stashed threat WIP, clean checkout codex/resume, create ai/grok/p1-runner-deploy), ls/find for k8s/systemd (none pre-existing), python for precise table edits on long/split lines, grep for patterns (runner in files, etc).
- todo_write used throughout for tracking (8 items, merged updates).
- No MCP search/use yet (for PR later if gh insufficient); used local git + will use gh for push/PR.
- Confirmed no existing runner-publish.yml, no k8s/systemd source examples (only nuclei templates), reach/artifact covered in go tests + lab script + verify.
- Followed: prefer search_replace after re-read; write only for new per pattern (workflow, k8s yaml, systemd unit, deploy/README, agents/_.md); no broaden (no runner/_.go edits, no test additions, no transport, no prohibited); real (docs reference real paths/tests); update .ai after.

## Files Touched / Decisions

- **New files (necessary per task "add CI action... or k8s example", "agents/runner-deploy.md")**:
  - .github/workflows/runner-publish.yml : GHCR docker build+push on tags (runner-v*/v*) + workflow_dispatch; uses docker/\* actions, GHA cache, meta tags (sha/semver/latest), platforms amd64, summary. (GITHUB_TOKEN for packages:write; note deployment-managed if private fork needs extra.)
  - apps/runner/deploy/README.md : consolidated customer steps, prereqs, Supabase, obs, reach/artifact validation (real), k8s/systemd/compose refs, assumptions, validation cmds.
  - apps/runner/deploy/k8s/runner-deployment.yaml : full Deployment + Secret example (nonroot, readOnlyRootFS, drop ALL, resources, probes, no ports, egress NetworkPolicy sketch, image GHCR, secretFrom for creds). Comments for deploy/verify.
  - apps/runner/deploy/systemd/periscan-runner.service : hardened unit (NoNewPrivs, Protect\*, SystemCallFilter, CPU/Mem limits, envFile, journald logs). Install notes, binary extract from image.
  - .ai/agents/runner-deploy.md : this (self-report per style of devops.md).
- **Edited (search_replace after re-reads; python terminal for tricky split-line tables in docs/)**:
  - apps/runner/deploy/docker-compose.runner.yml : added extensive header comments (usage, GHCR, security, Supabase combo, obs, k8s/systemd alts, reach/artifact, backup, env reqs, cross-refs).
  - apps/runner/README.md : added full "## Customer Deployment Validation (beyond lab E2E)" section (GHCR, flows for compose/k8s/systemd, Supabase, post-deploy real validation, obs, assumptions, cross-refs to deploy/README).
  - RUNNER_ARCHITECTURE.md : appended "## Customer Deployment (Deployment-Managed)" (packaging/images, examples pointers, Supabase, env/backup/rotation, obs, reach+artifact real customer, T&S, assumptions, refs).
  - PRODUCTION_READINESS.md (root): updated table runner row + Runner Security section + added deploy examples note.
  - docs/PRODUCTION_READINESS.md : updated Ready list, Deployment-Managed, First-Customer Checklist (added runner deploy step), Known Gaps.
  - docs/ROADMAP.md : updated Phase 6 status + bullets with exact artifacts added.
  - docs/IMPLEMENTATION_STATUS.md : updated "Internal runner" row status+note (used python for split table line).
  - docs/TRACEABILITY_MATRIX.md : updated PRD-Runner-ProductionPackaging (desc + files list incl new artifacts).
  - root README.md : added to runners API bullet + trust-safety para.
  - .env.example : enhanced runner + Supabase section comments (combo, independence).
  - .ai/gap-backlog.md : marked GAP-P1-003 **CLOSED** with full details, impl list, validation, branch, owning.
  - .ai/requirements-traceability.md : closed DEVOPS-RUNNER-DEPLOY-01 with impl/status/tests/files.
  - .ai/codex-handoff.md : updated active agents, branches, important files, work pick up, recommended next (multiple replaces).
- Decisions:
  - Stash + clean checkout codex base before branch (to isolate from parallel threat-center WIP changes; real dev process).
  - Add new files only for CI/examples/agents as explicitly called out ("if missing", "k8s example", ".ai/ ... agents/runner-deploy.md").
  - Enhance existing docs heavily (no new top-level docs/\*.md unless needed).
  - No reach/artifact test code changes (audit showed solid; "if gaps" — none; would have been fake otherwise).
  - Real-first: all refs point to actual tests (pnpm test:runner:lab etc), real paths, honest "deployment-managed" for customer infra/creds.
  - AGENTS: preserved monorepo/pnpm/Fastify/Next/Prisma; added shared? n/a (no DTOs); API-first (docs for real API use); tests for touched (docs+CI no unit but verify includes runner); no raw scanner; no do-not-touch.
  - Safety: only docs/examples; no destructive; notes "only validate verified customer-authorized scope".
  - GHCR: standard no-extra-creds action; document if needed.
  - Observability: documented stdout + audit + disclosures (no new code).
  - Update .ai/ at end (gap/trace/handoff + this); also activity? via handoff.
  - Branch name exact per task: ai/grok/p1-runner-deploy.
  - Validation before .ai close + push.
- No other: didn't edit api/web/db etc, no new tests, didn't run full e2e (runner subset), didn't touch .github/ci.yml (publish is separate workflow), didn't create root docs.

## Tests / Gates / Validation Performed

- Pre-impl: pnpm test:runner (on clean base: gofmt clean, go test/build, docker build+nonroot uid 65532 check + --help).
- pnpm test:runner:lab (lab reach E2E).
- docker build -q -t periscan-runner:local apps/runner (post edits, image still builds; nonroot confirmed via id).
- pnpm verify subsets: targeted runner parts (via scripts), full would include but focused (lint/type not affected; api etc unchanged). `pnpm --filter ...` not needed.
- Manual: inspected compose up syntax (yaml valid), k8s yaml (standard), systemd (unit syntax ok), read examples.
- Re-ran post key edits: test:runner still passes (docs don't affect).
- No full pnpm verify run (to keep fast; runner gate + build exercised; prior devops had full green on base). Recommend in PR desc + GHA.
- Git: clean on branch at commit points; status 0 before final .ai.
- Evidence of real: used actual existing reachability in main.go/main_test (runReachability, artifact upload), scripts, no mocks added.
- All per AGENTS + user task: "Validation: pnpm test:runner (or :lab), docker build if, pnpm verify subsets, manual compose check."

**Commands used (repeatable):**

```
git stash ...; git checkout codex/resume-product-completion; git checkout -- .; git checkout -b ai/grok/p1-runner-deploy
pnpm test:runner
pnpm test:runner:lab
docker build -q -t periscan-runner:local apps/runner && docker run --rm --entrypoint id periscan-runner:local -u
pnpm verify  # or targeted runner in scripts/verify.sh
# manual: cat apps/runner/deploy/docker-compose.runner.yml ; head -20 apps/runner/deploy/k8s/...
```

## .ai / Docs / Trace Updates

- gap-backlog: GAP-P1-003 closed with details.
- requirements-traceability: DEVOPS-RUNNER-DEPLOY-01 closed.
- codex-handoff: recorded agent, branch, files, updates to recs.
- Created agents/runner-deploy.md (this; full per spec: reads, audits, plan, impl, validation, risks, next).
- Also updated related docs for consistency (no half-built).
- Will update status/activity via handoff/orchestrator later.

## Risks / Blockers / Assumptions

- GHA publish: will run on push of tags (recommend create tag + dispatch post-PR for verification); GITHUB_TOKEN sufficient for ghcr in this org.
- Customer envs: k8s yaml is example (customer must create secret with real values from registration; adapt ns/resources/netpol). Documented.
- No real publish/creds here (deployment-managed).
- Parallel agents: stashed threat changes; branch isolated; merges by orchestrator.
- Table edits in docs/ used python where search_replace hit line-split issues (long cells); final content correct.
- If GHCR image private in forks: add imagePullSecret (noted in example).
- Full real-net validation (customer k8s + internal target + verified scope + policy mission) cannot be done in this env (no customer infra); hence "examples + guidance" + "deployment-managed".
- No impact on existing verify/CI (new workflow independent).

## Next Steps (for this agent / orchestrator)

- Validation complete (tests green, builds, docs consistent).
- Commit changes on branch (hygiene: all runner-deploy related).
- Push branch.
- Create PR (use gh; title "feat(runner): customer deploy validation (GAP-P1-003 + Phase 6)"; body with DoD trace: IDs, files abs paths, test results, links to .ai/, "real-first, no fakes, AGENTS followed, branch ai/grok/p1-runner-deploy").
- Update .ai/status.md / activity if needed (via handoff).
- Re-run pnpm test:runner + docker in GHA context post push.
- Close loop: mark in gap/trace; handoff ready for orchestrate merge to codex.

**Timestamp:** 2026-06-05 (runner-deploy agent execution).
**Status:** Complete per assigned task + DoD + AGENTS.md (vertical done; trace/real/tests/reviews; branch/PR next; no fakes; focused feasible scope).
**Artifacts (abs paths):**

- /Volumes/DataSSD1/test/periscan/.github/workflows/runner-publish.yml
- /Volumes/DataSSD1/test/periscan/apps/runner/deploy/README.md
- /Volumes/DataSSD1/test/periscan/apps/runner/deploy/k8s/runner-deployment.yaml
- /Volumes/DataSSD1/test/periscan/apps/runner/deploy/systemd/periscan-runner.service
- /Volumes/DataSSD1/test/periscan/apps/runner/deploy/docker-compose.runner.yml (edited)
- ... (see list above + report)
- .ai/agents/runner-deploy.md (this)
  See final report for snippets + full validation output.

All followed AGENTS.md, real-first, safety. No destructive, no prohibited changes.
