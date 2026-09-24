# Changelog

Operator-facing notes for Periscan product snapshots. API contract versions live in [`docs/CHANGELOG-API.md`](docs/CHANGELOG-API.md).

## Unreleased

**After Community 1.0.0.** Do not retag `v0.12.0`. Product [`LICENSE`](LICENSE) is **Apache-2.0**. Community edition is the open-core **validation slice**.

## 1.0.0 — 2026-09-22

Community **1.0.0** of the Apache-2.0 **validation slice** — always-on proof board. Default start is Gitleaks-class secrets (`jobsQueued=1`) on an authorized local clone. **Fixed only after a retest.** Do not retag `v0.12.0`.

This tag is the next product snapshot after Community GA `v0.12.0`. Its BAS coverage is the reviewed validation slice listed below; the full BAS/AEV program remains in active development, and module-wide live Atomic / Caldera / SharpHound / Metasploit eligibility requires qualification. This release makes no Wiz or Tenable replacement or analyst 95 / Magic Quadrant / Forrester Wave claim. Cloud stays 3 until a live Connected-AWS Prowler walk. Pathless Gitleaks findings stay Open. Node floor is **24**.

- Always-on proof board: operator-facing copy drops the “first hour” demo identity. Home / Validate / help / README fold are **keep proving** — authorize local path, Gitleaks-class default start (`jobsQueued=1`), review, re-verify until Fixed, schedules. Catalog / BAS stay secondary.
- Panel 2026-09-22 follow-up: after measured Fixed, Home keeps the locator with a Fixed badge and primary **Keep on a cadence**; vendor `source_missing` stays Info; Home charts are `aria-hidden` (name on the figure); duplicate VALIDATED/FIXED chips collapsed. Public snapshot ships `docs/SETUP.md` and Keep proving (`276cefb`). OG social preview remains Settings-upload (no API). Do not retag `v0.12.0`. Cloud stays 3 until live Prowler.
- Panel open-issues closeout: Findings names **Remediation Fixed after retest** when a task has a verification event (pathless Gitleaks stay Open). Operator-attested CloudAccount paints **Attested**. Scope safety placeholders are generic (`prod-account-alias` / `production, staging`). GOVERNANCE intake matches `SECURITY.md` title-only `[SECURITY]`. Maintainer OG wizard: `scripts/github-social-preview-wizard.sh`.
- BAS/AEV: Caldera qualified discovery start is reachable from campaign Start (PERISCAN-587). Allowlisted stockpile discovery abilities queue against a customer-managed isolated Caldera URL+key (`PERISCAN_CALDERA_BASE_URL` / `PERISCAN_CALDERA_API_KEY`). Missing endpoint, public hosts, live pins, Community default, and `PERISCAN_LIVE_OFFENSIVE=1` stay `jobsQueued=0`. `caldera.advanced_adversarial` `liveSupported` stays false.
- BAS/AEV: qualified Atomic Linux argv now executes for customers (PERISCAN-586). Runner-agent runs allowlisted `/bin/hostname`, `/bin/env`, `/bin/date` with hashed stdout and fail-closed YAML/shell. Campaign bind `live=true` is customerQueueable for those three GUIDs. Other Atomic tests stay denied. Community first-hour remains Gitleaks. Detector correlation remains NotMeasured.
- BAS local qualification (PERISCAN-586): pinned Atomic T1082 Hostname Discovery in a disposable, isolated Docker container with a measured receipt; reviewed Linux-safe argv on T1082 (`/bin/hostname`, `/bin/env`) plus T1124 system time (`/bin/date`) at the same source pin; campaign-compiler adapter contract (pin, GUID, OS, prerequisites, cleanup, expected telemetry); fail-closed for non-allowlisted YAML. Unqualified Atomic stays denied (`denied starts never queue`, imports are not executions). Detector correlation remains NotMeasured.
- BAS/AEV: customer-managed isolated Caldera operations adapter foundation with a pinned stockpile discovery ability set, create/start/stop/ingest/cancel lifecycle, result normalization, and mock-HTTP tests (PERISCAN-587). `liveSupported` / `startable` stay false; denied live starts still queue nothing. Wave 2 pins one additional reviewed stockpile discovery ability: Current User (`bd527b63-9f9e-46e0-9816-b8434d2b8989`, T1033). Unreviewed abilities still cannot execute. Qualified start (`queueCalderaQualifiedStart`) queues a bounded allowlisted discovery ability against a customer-managed isolated Caldera API when the pin is startable, qualified, tenant-authorized, policy Allowed, and reviewed (`jobsQueued=1`). Unqualified, unreviewed, unauthorized, live-offensive, or not-startable pins still queue nothing. `caldera.advanced_adversarial` `liveSupported` stays false. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch.
- BAS/AEV: Metasploit reviewed check allowlist (PERISCAN-589) with exact framework pin `6.4.0`, typed `RHOSTS`/`RPORT`, and a fixture/plan compiler that distinguishes vulnerability presence from check support. Wave 2 adds one additional non-destructive presence probe: `auxiliary/scanner/http/http_version` (T1046). `liveSupported` stays false; a method named `check` is not exploitability; denied live starts still queue nothing.
- BAS/AEV: qualified Metasploit *check* start helper (`apps/api/src/services/bas-metasploit-start.ts`). When the start gate marks an allowlisted pin startable, only a fixture/lab `check` runs (`http_version` and other allowlisted rows). `claimKind` is `vulnerability_presence` or `check_supported`; `check()` alone is never `measured_exploitability`. Not startable, console, extra `THREADS`, `PAYLOAD`, or exploit/run still `jobsQueued: 0`. Global `liveSupported` stays false.
- BAS/AEV: SharpHound collection profiles compile as least-privilege LDAP-read plans with bounded targets, mandatory redaction, and GPL-3.0 RequiresLegalReview (PERISCAN-588). BloodHound graph-import edges stay hypotheses, not exploitation. Live AD collection remains default-deny. Wave 2 requires a fourth redaction bound: `redactLapsPasswords` (LAPS `ms-Mcs-AdmPwd` / gMSA `msDS-ManagedPassword` from ObjectProps). Disabling that redaction fails closed. Collector stays blocked; `liveSupported` stays false. Qualified start (`startBasSharpHoundCollection`) queues a recorded bounded collection plan only when the start gate is startable, LAPS redaction is on, and targets are scoped (`jobsQueued=1`). Startable false or LAPS false queues nothing. Live AD still requires tenant authorization and does not execute the GPL collector. SharpHound stays Engine Lab, not the Community default pack. Collection is not exploitation (no DCSync / credential theft).
- BAS/AEV: Engine Lab Infection Monkey discover remainder (PERISCAN-591). Qualified start (`queueInfectionMonkeyDiscoverStart` / `startBasInfectionMonkeyDiscover`) records a discover-only plan of verified-scope hosts as promote-to-scope candidates when the pin is startable, qualified, tenant-authorized, and policy Allowed (`jobsQueued=1`). Unqualified, Community-default, live-offensive, ransomware, and credential-harvest still `jobsQueued=0`. GPL-3.0 `RequiresLegalReview`. `liveSupported` stays false. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch. Not in the Community default pack or image.
- BAS/AEV: Strix Apache-2.0 findings-import remainder (PERISCAN-583). Qualified start (`queueStrixImportStart` / `startBasStrixImport`) records an **import-only** plan when the pin is startable, qualified, tenant-authorized, and policy Allowed (`jobsQueued=1`). Cloud-shell, live exploit, unqualified, unauthorized, Community-default, and ControlPlane still `jobsQueued=0`. Import is not executed coverage (`executed: false`, `executable: false`). `liveSupported` stays false. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch. Not Community first-hour.
- BAS/AEV: Rustinel observe/import remainder. Qualified start (`queueRustinelObserveImportStart` / `startBasRustinelObserveImport`) records an **observe/import** plan when the pin is startable, qualified, tenant-authorized, and policy Allowed (`jobsQueued=1`). Live agent, unqualified, unauthorized, YAML-eval, and Community-default still `jobsQueued=0`. Apache-2.0 Community-eligible, not Community start. DRL `rustinel-rules` stay fail-closed in the Community pack. `liveSupported` stays false. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch.
- BAS/AEV: Engine Lab Vigolium remaining (PERISCAN-591). Qualified start (`queueVigoliumImportStart` / `startBasVigoliumImport`) records an **import-only** audit plan when the pin is startable, qualified, authorized, verified-scope, and policy Allowed (`jobsQueued=1`). Live attack planning, unverified scope, unauthorized, unqualified, Community-default, and not-startable still `jobsQueued=0`. AGPL-3.0 is **Blocked** (never installable; not a RequiresLegalReview path — TruffleHog is the only named AGPL exception). Import is not executed. `liveSupported` stays false. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch. Not in the Community default pack or image.
- BAS/AEV: Nuclei safe-exposure / ZAP baseline remaining (PERISCAN-589). Qualified start (`queueNucleiZapQualifiedStart` / `startBasNucleiZapSafeScan`) records an **import/safe-scan** plan when a safe-baseline, fingerprint, headers, metadata, or zap-baseline pin is startable, qualified, tenant-authorized, and policy Allowed (`jobsQueued=1`). Unqualified, unauthorized, exploit templates, internet-wide, Community-default, and first-hour still `jobsQueued=0`. Import is not executed coverage (`executed: false`, `executable: false`). `liveSupported` stays false. Compile still does not start ExternalPoA. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch. Not Community first-hour (Gitleaks stays the first-hour door). Pins stay Nuclei **v3.8.0** / templates **v10.4.4** / ZAP **2.17.0**.
- BAS/AEV: authenticated `POST /api/v1/control-sources/:id/email-delivery-canary-proof` (PERISCAN-590 / 591). Compiles/evaluates the Wave 1 email delivery canary. Qualified + authorized + scoped + policy Allowed + MailHog lab sink records a lab-sink plan (`jobsQueued=1`) that still does not send internet mail. Denied, unscoped, Gmail/O365, live SMTP, Community start, and `PERISCAN_LIVE_OFFENSIVE=1` stay `jobsQueued=0`. `liveSupported` stays false. Not Community start. Never real mailbox or data exfil.
- BAS/AEV: Falco observe remainder (PERISCAN-590). Qualified start (`queueFalcoObserveStart` / `startBasFalcoObserve`) records **observe-only** findings from a fixture/lab Falco JSON alert load when the pin is startable, qualified, tenant-authorized, and policy Allowed (`jobsQueued=1`). Live kernel, unqualified, unauthorized, and Community-default still `jobsQueued=0`. `falco.rules_validate` stays the Community rules-lint module. Observe is not an executed exploit. `liveSupported` stays false. `PERISCAN_LIVE_OFFENSIVE=1` is not an enablement switch. Not Community first-hour (Gitleaks remains the door).

- BAS/AEV: immutable tenant-scoped Atomic/Caldera content versions, authenticated registration/list/detail APIs, hash conflict detection, transactional audit and Postgres row-level isolation (PERISCAN-585). Imported metadata remains unreviewed and non-executable.

## 0.12.1 — 2026-09-21 (not tagged)

Panel closeout on `swarm/integrate-5-loop` after Community GA v0.12.0. **Not tagged.** Do not retag `v0.12.0`.

- In-app + public panel re-run 2026-09-21: in-app **3.9 hold**, public **2.8 hold**.
- Home omits VALIDATED as the top finding after a measured Fixed retest.
- Community mission status is explicit (`Community mission Completed`) so a parent does not look RUNNING after Gitleaks evidence.
- Full Community pack is under **More engines (catalog)** — remaining catalog engines, not first-hour `start now`.
- Node `engines.node` is `>=24.0.0` (floor unchanged).

## 0.12.1 — 2026-09-17 (not tagged)

First-hour ICP closeout (PERISCAN-490). Private tree (`swarm/ga-public-chrome`). **Not tagged.** Do not retag `v0.12.0`.

### Community first-hour proof loop

- Home **Proof eyebrow** (not Command center).
- After the first Community finding, UI keeps **one primary CTA/verb** (no competing doors).
- **Watch** polls Community runs at **1s** and stays for evidence instead of bouncing away.
- GitHub URL refuse shows **git clone** then paste the local absolute path (clone hint).
- Finding rows show **path + rule**; row click opens detail.
- Skip-link is hidden until focus and does not cover the wordmark.
- Clone-first **README** / **FAQ** (proof fold, local path + Gitleaks-class first hour).
- Public-chrome closeout (`docs/qa/ux-validation-2026-09-17.md`): README first screen is **one job** (authorized local path → Gitleaks-class first hour → Fixed after retest); clone+inspect primary; ASV/CTEM/engine mall below the fold; BAS is qualification-required, not a live exploit library.
- **SECURITY.md** first paragraph is title-only `[SECURITY]` + **72h** ack SLA. PVR unused (SETTLED).
- `install.sh` dry-run names **nvm/fnm** when the shell is Node 20; does not silently continue on 20. `package.json` `engines.node` is `>=24.0.0`.
- **SECURITY** intake first; drop proprietary Dependabot lead note.
- GHSA highs: bump **xmldom** and **deepmerge-ts**.
- Analyst **scorecard** skips missing excluded **lab-runs** evidence.
- Installer prints local-path first-hour **next-step** after install.

### Still not this drop

- Not a retag of `v0.12.0`. Not a `v0.12.1` tag yet.
- Live Atomic / Caldera / SharpHound adapters still require qualification.

## 0.12.0 — 2026-09-16

Community GA `v0.12.0` — first-hour Gitleaks, Fixed-only-via-verify, Apache public snapshot

### OpenClaw-style one-paste installer (PERISCAN-576)

- Root [`install.sh`](install.sh) is the curl target. `scripts/install.sh` is a thin wrapper to the same script.
- `bash install.sh` (default) install + start + health. `--dry-run` prints the plan (compose file `infra/docker-compose/docker-compose.yml`, clone `https://github.com/seanventures/periscan.git`) without compose/start.
- `bash install.sh doctor` / `repair` health + repair. `bash install.sh health` check only. Busy `:3000`/`:3001`/`:5432` remap via `lab_select_deps_publish_ports` / `PERISCAN_API_PORT` (557). Does not kill neighbor apps. Does not wipe neighbor Redis.
- `health` / `doctor` read `.periscan/community.env` for this clone's already-chosen `PERISCAN_API_PORT` / `PERISCAN_WEB_PORT` / `DATABASE_URL` and probe those. They do not remap away from a healthy running instance of this clone. Remap only when starting fresh and a foreign process owns the default port (PERISCAN-579).
- Reuses `scripts/periscan.sh`, `scripts/community-first-hour.sh`, `infra/lab/scripts/env.sh`. Never root `compose.yaml`.

### One-command Community install (PERISCAN-560)

- `bash scripts/periscan.sh install|start|status|update|down` is the stranger clone CLI. `install` reuses `scripts/community-first-hour.sh`; `start` is `pnpm lab:dev` (557 API remap). Makefile targets and `pnpm community:*` call the same script.
- `PERISCAN_PERISCAN_SH_DRY_RUN=1` / `PERISCAN_FIRST_HOUR_DRY_RUN=1` print chosen ports and exit 0 without compose or lab:dev. `down` is `compose stop` only (no volume wipe). `update` skips `git pull` when this is not a branch checkout.

### Stranger-clone ports (PERISCAN-557)

- `pnpm lab:dev` auto-shifts `PERISCAN_API_PORT` when `:3001` is taken (same idea as web `:3000` → `3010+`) and prints the chosen URL. Worker does not bind TCP.
- `scripts/community-first-hour.sh` no longer treats a neighbor `:5434` Postgres as this clone. It honors `PERISCAN_POSTGRES_PUBLISHED_PORT` / the next free port and always `compose up`s this tree's deps.

Plane: PERISCAN-522 (Community live pack), PERISCAN-523 (copyleft opt-in), PERISCAN-524 (Engine Lab package manager).

### Engine Lab package manager (PERISCAN-524)

- 14 packs / ≥138 unique OSS tool IDs in `packages/shared/src/security-tool-packs.ts`.
- Engine Lab UI: pack tabs, per-tool Install/Uninstall, pack-level Install/Uninstall. Theater (Atomic / Caldera / SharpHound / sqlmap / Metasploit) was excluded from Community start in this release and is not installable as validation.
- Prisma `ThirdPartyToolInstallJobAction` gains `Uninstall`. `POST /api/v1/third-party-tools/:toolId/uninstall` plus `buildOpenSourceToolUninstallPlan`.

### Community live pack (PERISCAN-522)

- Default Community start stays **permissive SPDX only**. Popular blue/red-adjacent engines (detect-secrets, Bandit, Checkov, Trivy misconfig, gosec, kube-linter, KICS, Amass, YARA, Falco rules lint, …) are in `COMMUNITY_VALIDATION_SUITE` and on the runner allowlist when they have live modules.
- Catalog-only CLIs remain Planned / installable — **not every catalog ID executes live**.

### Copyleft opt-in (PERISCAN-523)

- GPL/LGPL/AGPL tools stay Engine Lab + SPDX accept. After accept, official-upstream install may proceed without an invented catalog digest (`integrity_pin_absent_user_accepted`). Periscan does not redistribute copyleft binaries.
- Live copyleft (Semgrep, testssl, Nikto, WhatWeb, ScoutSuite, TruffleHog, Hadolint, …) runs only when the mission target lists the tool in `upstreamLicenseAcceptedToolIds`. Start may pass `includeCopyleftOptIn` after accept.

### Still not this drop

- Live Atomic / Caldera / SharpHound / sqlmap / Metasploit.
- All 138 catalog tools as live execute modules.
- Prisma `Uninstall` enum applied on every operator database (migration `20260815220000_add_tool_uninstall_action` must be run).

## 0.11.0 — 2026-08-15

**Community edition snapshot of then-`main`, not GA.** It is not analyst 95, not Magic Quadrant, and not Forrester Wave progress. **At this snapshot** the product LICENSE was still proprietary — current [`LICENSE`](LICENSE) is **Apache-2.0** (flipped in 0.12.0). Community edition here is the open-core *validation slice* (authorized scope + policy + safe OSS/first-party engines + evidence); the public LICENSE flip had not landed yet.

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
- Engine Lab labels Community / Legal review / Catalog only. Atomic, Caldera, SharpHound, sqlmap, and Metasploit were excluded from this Community release.
- Prowler uses stored Connected AWS integration credentials at execution time. Secrets are not written onto `validationRun.target`.
- Live `periscan.dns_resolution_check` against `example.com` (no fixtureMode) produces evidence.

### After start

- Findings for a mission: `GET /findings?missionId=` (evidence intersection). Empty if nothing measured.
- Mission detail names the Community pack from run module IDs. Nuclei sibling reconstructs via `GET /community/validation-runs?missionId=`. Deny skip is persisted on the second-mission run.
- `POST /community/validation-runs/:missionId/remediations` opens remediations from that mission’s findings. Fixed still requires a verification event.
- First-run: Watch an in-flight Community mission; Review a finished run without evidence. `MeasuredResult` stays evidence-only.
- Schedules stay snapshot-only unless `config.communityValidation === true` (create and edit). Denied/empty starts do not fall back to a report.

### Still not this snapshot

- At release time: public LICENSE was still proprietary (Apache-2.0 as of 0.12.0); do not read this as “we are open source.”
- Declared GA (PERISCAN-490; landed in 0.12.0). A full lab pack walk through worker + Postgres is still operator-run (PERISCAN-500).
- Live Atomic / Caldera / SharpHound / sqlmap / Metasploit.
- Customer references or Production connector certification.
- Payments / AWS Marketplace.

## 0.10.0 — 2026-08-15

**GA-readiness snapshot of then-`main`, not GA.** It is not analyst 95, not Magic Quadrant, and not Forrester Wave progress. **At this snapshot** the product LICENSE was still proprietary — current [`LICENSE`](LICENSE) is **Apache-2.0** (flipped in 0.12.0). Open-core work here is preflight only (matrix, notices, `SECURITY.md`); the public LICENSE flip had not landed yet.

Scope is what landed on `main` after `origin/main` (`7107afdb`, lab Phase 1 scaffold), including unique security/honesty commits cherry-picked from `cursor/critical-bug-investigation-*` and residual work from the 2026-08-15 GA agents. Long-diverged Codex/AI histories (500–1000 unique commits, 461–1246 behind `main`) were **not** merged.

### Lab demo site

- Operator path for a measured local range walk: `pnpm lab:up` → `pnpm lab:dev` → `pnpm lab:demo-up`. Optional `PERISCAN_LAB_STRICT=1` fails unless the seed is `fullyMeasured`. If `:3000` is taken, `lab:dev` binds `3010`.
- Runbook: [`docs/DEMO_LAB_SITE.md`](docs/DEMO_LAB_SITE.md). `pnpm dev` + `pnpm seed:demo` remains a **fixture** workspace, not lab proof.
- Worker hop auto-apply is on so lab hop receipts persist without a separate apply step.

### Live Gitleaks / Grype

- `gitleaks.repo_secrets` runs the real Gitleaks image (`detect --pipe`). Docker does not bind-mount the repo (avoids Desktop file-sharing failures).
- `grype.repo_vulnerability_scan` is a live repo CVE inventory (PassiveReadOnly). Catalog sims (`grype.cve_scan`, Semgrep planning modules) stay **non-executable**.
- Missing engines return `ToolUnavailable` / Inconclusive. They do not invent findings. Atomic, Caldera and SharpHound live adapters were not qualified in this release.

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

- At release time: public LICENSE was still proprietary (Apache-2.0 as of 0.12.0); do not read this as “we are open source.”
- Full live-engine clone→Fixed loop as a single proven GA gate.
- Customer references or Production connector certification.
- Payments / AWS Marketplace.
