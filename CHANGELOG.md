# Changelog

Operator-facing notes for Periscan product snapshots. API contract versions live in [`docs/CHANGELOG-API.md`](docs/CHANGELOG-API.md).

## Unreleased

**Community catalog expansion on `main` after v0.11.0. Not a new tagged snapshot. Not GA.** Product [`LICENSE`](LICENSE) stays proprietary. Community edition is still the open-core *validation slice*, not a public LICENSE flip.

Plane: PERISCAN-522 (Community live pack), PERISCAN-523 (copyleft opt-in), PERISCAN-524 (Engine Lab package manager).

### Engine Lab package manager (PERISCAN-524)

- 14 packs / ≥138 unique OSS tool IDs in `packages/shared/src/security-tool-packs.ts`.
- Engine Lab UI: pack tabs, per-tool Install/Uninstall, pack-level Install/Uninstall. Theater (Atomic / Caldera / SharpHound / sqlmap / Metasploit) is never Community-start and is not installable as validation.
- Prisma `ThirdPartyToolInstallJobAction` gains `Uninstall`. `POST /api/v1/third-party-tools/:toolId/uninstall` plus `buildOpenSourceToolUninstallPlan`.

### Community live pack (PERISCAN-522)

- Default Community start stays **permissive SPDX only**. Popular blue/red-adjacent engines (detect-secrets, Bandit, Checkov, Trivy misconfig, gosec, kube-linter, KICS, Amass, YARA, Falco rules lint, …) are in `COMMUNITY_VALIDATION_SUITE` and on the runner allowlist when they have live modules.
- Catalog-only CLIs remain Planned / installable — **not every catalog ID executes live**.

### Copyleft opt-in (PERISCAN-523)

- GPL/LGPL/AGPL tools stay Engine Lab + SPDX accept. After accept, official-upstream install may proceed without an invented catalog digest (`integrity_pin_absent_user_accepted`). Periscan does not redistribute copyleft binaries.
- Live copyleft (Semgrep, testssl, Nikto, WhatWeb, ScoutSuite, TruffleHog, Hadolint, …) runs only when the mission target lists the tool in `upstreamLicenseAcceptedToolIds`. Start may pass `includeCopyleftOptIn` after accept.

### Still not this drop

- Public LICENSE flip, declared GA, live Atomic / Caldera / SharpHound / sqlmap / Metasploit.
- All 138 catalog tools as live execute modules.
- Prisma `Uninstall` enum applied on every operator database (migration `20260815220000_add_tool_uninstall_action` must be run).

## 0.11.0 — 2026-08-15

**Community edition snapshot of current `main`, not GA.** It is not analyst 95, not Magic Quadrant, and not Forrester Wave progress. Product [`LICENSE`](LICENSE) stays proprietary. Community edition is the open-core *validation slice* (authorized scope + policy + safe OSS/first-party engines + evidence), not a public LICENSE flip.

Long-diverged Codex/AI histories (500–1000 unique commits, ~1300 behind `main`) were **not** merged. One unique reaper CAS test (`ecb7aa7c`) was cherry-picked. Stale-login and superseded first-run/nav agent branches were skipped.

### Community start path

- `GET /api/v1/community/validation-suite` lists the safe pack for a scope. `POST /api/v1/community/validation-runs` starts a Validation Snapshot that queues worker/runner work (not a report-only snapshot).
- Validate primary CTA is **Run Community validation**. Compose snapshot report stays secondary. After start, Validate polls live runs.
- Policy preview matches the *primary* start set. Runner-lane engines preview InternalRunner. A ControlPlane ticket cannot start runner modules (`community_environment_mismatch`). Nuclei is a second mission so a PoA deny cannot block the worker pack.

### Authorize more than domains

- Repository: `.periscan-authorization` token file, or Owner/Admin attest if the path is runner-only.
- CloudAccount: Connected AWS account match or Owner/Admin attest.
- CIDR / internal network: audited Owner/Admin attest.
- Domain/Subdomain stay DNS TXT. `devModeManual` is lab-only.
- Validate can add and verify those types without leaving the page.

### Engines and honesty

- Default pack: Gitleaks, Trivy, OSV, Grype, Syft, first-party DNS/TLS/HTTP depth, ZAP, Nuclei (second mission), Prowler on Connected AWS (`product === "AWS"`), MIT recon/nmap when a runner is enrolled.
- Engine Lab labels Community / Legal review / Catalog only. Atomic, Caldera, SharpHound, sqlmap, and Metasploit are never Community.
- Prowler uses stored Connected AWS integration credentials at execution time. Secrets are not written onto `validationRun.target`.
- Live `periscan.dns_resolution_check` against `example.com` (no fixtureMode) produces evidence.

### After start

- Findings for a mission: `GET /findings?missionId=` (evidence intersection). Empty if nothing measured.
- Mission detail names the Community pack from run module IDs. Nuclei sibling reconstructs via `GET /community/validation-runs?missionId=`. Deny skip is persisted on the second-mission run.
- `POST /community/validation-runs/:missionId/remediations` opens remediations from that mission’s findings. Fixed still requires a verification event.
- First-run: Watch an in-flight Community mission; Review a finished run without evidence. `MeasuredResult` stays evidence-only.
- Schedules stay snapshot-only unless `config.communityValidation === true` (create and edit). Denied/empty starts do not fall back to a report.

### Still not this snapshot

- Public LICENSE flip or “we are open source.”
- Declared GA (PERISCAN-490). A full lab pack walk through worker + Postgres is still operator-run (PERISCAN-500).
- Live Atomic / Caldera / SharpHound / sqlmap / Metasploit.
- Customer references or Production connector certification.
- Payments / AWS Marketplace.

## 0.10.0 — 2026-08-15

**This is a GA-readiness snapshot of current `main`, not GA.** It is not analyst 95, not Magic Quadrant, and not Forrester Wave progress. Product [`LICENSE`](LICENSE) stays proprietary. Open-core work in this snapshot is preflight only (matrix, notices, `SECURITY.md`) — the repo is not open source.

Scope is what landed on `main` after `origin/main` (`7107afdb`, lab Phase 1 scaffold), including unique security/honesty commits cherry-picked from `cursor/critical-bug-investigation-*` and residual work from the 2026-08-15 GA agents. Long-diverged Codex/AI histories (500–1000 unique commits, 461–1246 behind `main`) were **not** merged.

### Lab demo site

- Operator path for a measured local range walk: `pnpm lab:up` → `pnpm lab:dev` → `pnpm lab:demo-up`. Optional `PERISCAN_LAB_STRICT=1` fails unless the seed is `fullyMeasured`. If `:3000` is taken, `lab:dev` binds `3010`.
- Runbook: [`docs/DEMO_LAB_SITE.md`](docs/DEMO_LAB_SITE.md). `pnpm dev` + `pnpm seed:demo` remains a **fixture** workspace, not lab proof.
- Worker hop auto-apply is on so lab hop receipts persist without a separate apply step.

### Live Gitleaks / Grype

- `gitleaks.repo_secrets` runs the real Gitleaks image (`detect --pipe`). Docker does not bind-mount the repo (avoids Desktop file-sharing failures).
- `grype.repo_vulnerability_scan` is a live repo CVE inventory (PassiveReadOnly). Catalog sims (`grype.cve_scan`, Semgrep planning modules) stay **non-executable**.
- Missing engines return `ToolUnavailable` / Inconclusive. They do not invent findings. Offensive packs (live Atomic, Caldera, SharpHound) stay off.

### `startMission` runner routing

- Modules with `executionMode: InternalRunner` are queued as signed runner tasks. They are not sent to the BullMQ worker (the worker fail-closes rather than fabricate in-network results).
- If no enrolled runner exists, those runs fail honestly. A caller-supplied `runnerId` is used only when that runner is enrolled in the same tenant (unknown/foreign/revoked ids fail closed instead of minting a task or 500).
- Offensive InternalRunner module ids are failed inside the create transaction (not patched after commit).
- Runner-agent default allowlist now includes Gitleaks, Trivy, OSV, Grype, Syft, Cosign, and ZAP baseline. Dispatch still requires the module to be on the safe allowlist.
- Nuclei docker collects JSONL from stdout via a named volume (no `/out` bind-mount).

### Integrity / CAS honesty (unique cursor branches)

- Runner result submit and lease claim use compare-and-swap; evidence ids are unioned, not replaced. Hybrid multi-run missions reconcile under a mission-scoped advisory lock.
- MFA recovery codes, last-owner demotion/removal, runner registration tokens, schedule fire, mission start, model-gateway tool execute, and reaper terminals use CAS / serializable guards.
- Admin/ClientAdmin cannot assign or remove Owner. `audit:read` API keys no longer elevate to Admin. Active MFA cannot be re-enrolled from a hijacked session.
- Reports no longer fabricate non-snapshot evidence from unrelated tenant signals. Retention purge tombstones evidence so the hash chain stays contiguous.

### SETTLED / GA program

- [`docs/SETTLED.md`](docs/SETTLED.md) is the append-only axiom ledger (Fixed only via verification, path words from weakest-hop evidence, LICENSE flip needs founder + counsel).
- `pnpm settled:check` (`scripts/settled-tripwire.mjs`) is the first `pnpm verify` gate.
- [`docs/qa/GA_PROGRAM_2026-08-14.md`](docs/qa/GA_PROGRAM_2026-08-14.md) defines shippable GA as packaging + authorized proof loop + honest claims + house UX evidence — **not** 95 / MQ / Wave.

### First-run de-slop

- One first-run surface: Home `GetStarted`. `/getting-started` redirects there. Aurora / `onb-pulse` glow is gone.
- Slim Proof OS rail for a new tenant (Home · Connect · Scope · Validate). This is a first-run cleanup, not a finished “highest quality” UX.
- One visible first-run meter (3 setup steps, then 9-loop). Extra scores live under “How the full loop works”.
- `/getting-started` is no longer a New-tenant rail alias. SecurityLeader New/Activating can open Executive without widening the engineer rail.
- Primary CTA hover is a darker fill (`#1d4ed8`) so contrast stays AA. Rail tagline stacks so “The Hacker On Your Side” is not clipped. Empty findings is Snapshot chrome only.

### GetStarted while loading

- Home mounts `GetStarted` until a snapshot, path, or finding actually exists. Empty/loading lists no longer paint Command Center skeletons first.

### Still not this snapshot

- Public LICENSE flip or “we are open source.”
- Full live-engine clone→Fixed loop as a single proven GA gate.
- Customer references or Production connector certification.
- Payments / AWS Marketplace.
