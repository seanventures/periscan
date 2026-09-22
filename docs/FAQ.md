# Periscan FAQ

Operator answers for Community GA. How to run the loop: [`USING.md`](./USING.md).
Offering: [`COMMUNITY.md`](../COMMUNITY.md).

Copy law: [`SETTLED.md`](./SETTLED.md),
[`DESIGN_PARTNER/PRODUCT_COPY_RULES.md`](./DESIGN_PARTNER/PRODUCT_COPY_RULES.md),
`CLAIM_LANGUAGE_CATALOG` in `packages/shared/src/claim-deny-list.ts`.

There are **zero** public customer references. This file names no logos, no ARR,
no “Fortune” claims, and no invented case studies.

---

## Product

### What is Periscan?

A self-hosted **AEV / CTEM proof layer**. You already have scanners. Periscan
proves authorized exposures are real, keeps evidence, and only marks **Fixed**
when a retest says so.

Find the path. Validate the risk. Prove it's fixed.

Full BAS and AEV are explicit product objectives. The [delivery program](BAS_AEV_PROGRAM.md)
separates shipped capabilities, local lab qualification and remaining adapter work.
Periscan integrates with existing CNAPP, RBVM and detection platforms.

### What is Community edition?

The open-core **validation slice**: verified customer-authorized scope, a
policy decision on every start (denied work never queues), the dense
**permissive SPDX** pack plus first-party checks, an evidence ledger, and
remediations whose **Fixed** requires a verification event.

**First hour** on a verified local repo is **Gitleaks-class secrets**
(`jobsQueued=1`) with a single selected engine.

Source of truth: `packages/shared/src/community-edition.ts`
(`COMMUNITY_EDITION_VALUE_LINE`).

It is a product contract, not a LICENSE flip and not “we published everything
we have.”

### What does Community do vs not do?

| Does | Does not |
| --- | --- |
| Self-host; authorize a **local clone** path | Fetch `github.com/org/repo` for you |
| First-hour **Gitleaks-class secrets** (`jobsQueued=1`) | Treat a first-hour scan as library-wide BAS qualification |
| Policy gate; denied never queues | Replace Wiz / Tenable / Nuclei CLI |
| Evidence ledger; **Fixed** only after retest | Mark Fixed from ticket close |
| Permissive Community pack as a second control | Default-start GPL/AGPL (Engine Lab + accept) |
| | Execute unqualified adapters or scenarios |
| | Hosted multi-tenant SaaS / SSO-SCIM managed product (commercial — [`OPEN_CORE.md`](../OPEN_CORE.md)) |

### Who is it for?

Security, AppSec, and platform engineers who need measured proof on systems
they **own or are contracted to test**. Teams that already run Trivy, Gitleaks,
Nuclei, Prowler and want one evidence ledger instead of a scanner dump.
Contributors adding a **safe engine adapter**
([`ADAPTER_FIRST_PR.md`](./ADAPTER_FIRST_PR.md)).

### Who is it not for?

Unauthorized scanning or destructive actions. Teams requiring already-qualified
production coverage beyond the published readiness matrix should evaluate the
remaining BAS/AEV delivery milestones. MSSP portfolio operators need the
commercial packaging described in `OPEN_CORE.md`.

### Is it open source?

**Apache-2.0 validation slice** — root [`LICENSE`](../LICENSE) is Apache-2.0.
Canonical public snapshot: `seanventures/periscan`. That is **not**
“we are OSI-everything.”

| Layer | License |
| --- | --- |
| Product (control plane, UI, API, worker, runner, first-party modules) | Apache-2.0 |
| Third-party engines and Node dependencies | **Their** SPDX — [`licenses/THIRD_PARTY_NOTICES.md`](../licenses/THIRD_PARTY_NOTICES.md) |
| Hosted SaaS / MSSP / marketplace | Commercial product, not a second LICENSE file in this repo |
| Goldeneye `seanheiney/periscan` | **Private forever** |

Do not say “we are open source now.” Say Community edition / open-core
validation. Details: [`OPEN_CORE.md`](../OPEN_CORE.md).

### Does it replace Wiz, Tenable, Nuclei, or the Gitleaks CLI?

**No.** Co-exist.

| You already run | Periscan’s job |
| --- | --- |
| Wiz / CNAPP | Inventory and cloud graph. Periscan proves path + fix on authorized scope. |
| Tenable / RBVM | Vuln system of record. Periscan re-proves fixes. |
| Nuclei CLI | First-class **engine** (second mission, allowlisted safe profiles). Periscan is not a Nuclei wrapper and does not compete on template count. |
| Gitleaks CLI | First-hour Community engine. Periscan adds authorize → policy → evidence → Fixed-only-via-verify. |

Scanners find. Tickets close. Periscan is the missing loop: **authorize →
policy → Community pack → evidence → retest → Fixed**.

---

## Authorization

### Why can't I paste a GitHub URL?

`git clone <your-repo>` on the machine running Periscan, then paste the
**absolute path**. Hosted `github.com/org/repo` URLs are not a control-plane
path — Add / Verify / Attest refuse them (`400`
`hosted_github_url_not_verifiable`). The plane (or an enrolled runner) reads a
local clone via `.periscan-authorization`; it does not fetch github.com for
you. Attest is runner-only for a path the plane cannot see — not a skip for
github.com.

### How do I prove a repository?

1. `git clone <your-repo>` (or use an existing clone). Paste the **absolute
   path** (`/opt/customer/repo`).
2. Write the token the UI shows to `.periscan-authorization` at that repo
   root: `periscan-verification=<token>`.
3. Verify. Status **Verified** (`repository_token_file`).

Owner/Admin attest is allowed only when the path is runner-only.

### How do I prove an AWS account?

Paste a **12-digit** account id. Verify by Connected AWS account match **or**
Owner/Admin attest. Attest authorizes the *name*. **Prowler does not start
without AWS connected.** That is honest, not a bug.

### How do I prove a domain?

DNS TXT on `_periscan.<scope>`. Domain / subdomain do **not** skip DNS.
`devModeManual` is lab-only.

### Can I scan systems I don't own?

**No.** Only verified, customer-authorized scope. Denied tasks never queue.
Do not use Periscan to probe third-party hosts. See
[`SECURITY.md`](../SECURITY.md) and
[`SECURITY_BOUNDARIES.md`](../SECURITY_BOUNDARIES.md).

---

## Engines

### What engines start on first run?

On a verified **local repository**, first hour is **Gitleaks-class secrets**
(pin `gitleaks.repo_secrets`). Copy “N engines start now” is engines that
**will queue on this Run**, not catalog size. A pinned Gitleaks POST is
`jobsQueued=1`. Historically the unpinned repo startable set is dozens of
permissive engines; deferred Prowler without AWS is **not** in that count.

HTTP 200 is not jobs queued. Read `jobsQueued`.

### First run vs full pack vs Engine Lab vs BAS qualification?

| Bucket | What | Starts from Validate? |
| --- | --- | --- |
| **First hour** | Gitleaks-class secrets on a verified repo (pin `g`) | Yes, if the binary exists |
| **Community pack** | Permissive SPDX only (MIT / Apache-2.0 / BSD-3-Clause / NPSL) + first-party DNS/TLS/HTTP. Secrets, SCA, SAST, IaC, SBOM, containers, TLS, ZAP, Prowler-on-Connected-AWS, kube CIS, YARA / Falco *rules lint*, recon when a runner is enrolled. Nuclei = **second mission**. | Yes, for engines that match this scope and are startable |
| **Engine Lab** | Package manager for 100+ OSS tools. Copyleft (GPL/LGPL: Semgrep, testssl, Nikto, WhatWeb, ScoutSuite, TruffleHog, …) after SPDX accept. Catalog size ≠ Community start. | Not from the Community start button |
| **BAS qualification** | Atomic Red Team, Caldera, SharpHound, sqlmap, Metasploit | Currently unqualified for execution; BAS adapters are under development. |

AGPL / SSPL / BSL / Commons Clause / PolyForm are **Blocked**. No install path.

Missing binaries are `tool_unavailable` / Inconclusive — not invented findings.
Stock first-party DNS/TLS/HTTP on a verified Domain still runs without CLIs.

### Why isn't Semgrep (or other GPL) on the start button?

GPL / LGPL stay **Engine Lab + license accept**. Periscan does not
redistribute those binaries and does not bake them into the default image.
After accept, live copyleft runs only when the mission target lists the tool
in `upstreamLicenseAcceptedToolIds`. Accepting a license does **not** enable
sqlmap, SharpHound, Atomic, Caldera, or Metasploit.

### Do I need a runner?

**Not for first-hour Gitleaks** (ControlPlane / worker). You **do** need an
enrolled internal runner for runner-lane engines (nmap, naabu, Amass passive,
Subfinder, httpx, dnsx, Syft/cdxgen, …). Policy preview for those is
`InternalRunner`. A ControlPlane ticket cannot start them
(`community_environment_mismatch`).

Runner transport is **outbound HTTPS signed-task polling**. Do not open an
inbound management plane as the default. Supported customer runner:
[`SUPPORTED_CUSTOMER_RUNNER.md`](./SUPPORTED_CUSTOMER_RUNNER.md).

You always need a **worker**. `pnpm dev` is api+web only. `periscan.sh start`
/ `pnpm lab:dev` includes the worker.

### Why didn't Prowler start?

No Connected AWS integration. Attesting a 12-digit account id verifies the
scope; it does not attach credentials. Prowler uses stored integration
credentials at execution time — never written onto `validationRun.target`.

### Why is Nuclei a second mission?

So an External PoA kill-switch cannot block the rest of the pack. Do not put
Nuclei in primary `moduleIds`. Reconstruct with
`GET /api/v1/community/validation-runs?missionId=` (`nucleiMissionId` /
`nucleiSkipReason`).

### What if Gitleaks isn't installed?

The run is Inconclusive / `tool_unavailable`. Install the official upstream
binary (Engine Lab **Install + enable Community pack**, or put `gitleaks` on
PATH for host `lab:dev`). Periscan will not fabricate secret findings.

---

## Proof loop

### Why is Fixed not a checkbox?

**Fixed requires a measured verification event.** Ontology law L3. Ticket
close, PR merge, owner assertion, and severity are not Fixed. Ticket close
becomes `ClosedWithoutEvidence`. Remediations open **Open**. Verify
(`POST /api/v1/remediations/:id/verify` or the UI) re-runs the engine. Fixed
can demote if the exposure returns.

### Why does HTTP 200 not mean jobs queued?

Start can 200 with `jobsQueued=0` (deny, empty suite, missing AWS, missing
runner, pin that does not intersect startable). The gate is `jobsQueued` and
`mission.status`. Denied never queues.

### Why are findings empty after a run?

Findings for a Community mission are evidence IDs **intersected with that
run**. No evidence → empty list, not theater, not the tenant-wide queue.
Do not call `GET /findings` without `missionId` “these Community results.”
An empty list is not a clean bill of health.

### Is demo login real proof?

**No.** `demo@periscan.local` / `periscan-demo-password` after `pnpm seed:demo`
is a **labeled fixture** tenant. `/demo` sample reports are sample. Lab hops
from `pnpm lab:demo-up` are a **different** path (SIEM canary / range), not
the Community pack. Sign up a unique account and authorize a real local clone.
See [`USING.md`](./USING.md).

### Can I mark Fixed from Jira / a ticket sync?

No. External close is `ClosedWithoutEvidence`. Automation signal is webhook
`remediation.verified` after a real retest.

---

## Install, ports, update

### curl|bash or clone-first?

**Clone-first.** Inspect the tree, then install. `curl|bash` is **secondary**
(first-time / one-paste). Node **24** and Docker must be understood before any
curl line. Read [`install.sh`](../install.sh) before piping.

### How do I install and start?

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

Contract (PERISCAN-560): `install` = Node/pnpm/Docker checks, compose deps,
migrate. `start` = `pnpm lab:dev` (API+worker+web) and print URLs. `status`,
`update`, `down`, `help` as in [`USING.md`](./USING.md). Do not
`docker compose up` at the repo root.

Secondary one-paste (inspect `install.sh` first):

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
```

### Why does Node 20 (or anything below 24) fail?

`scripts/periscan.sh` / `install.sh` require **Node 24+** ([`.nvmrc`](../.nvmrc)).
Node 20 / 22 fail the major check before compose or migrate — that is intentional,
not a surprise after start. Use Node 24 (nvm / fnm / package manager), then
Corepack for pnpm **9.15.0**. Docker is required for Postgres / Redis / MinIO.

### Which ports? What if 5434 or 3001 is busy?

| Service | Default | If busy |
| --- | --- | --- |
| Web | `:3000` | `lab:dev` binds `3010+` and prints it |
| API | `:3001` | next free; printed as `PERISCAN_API_PORT` / `PERISCAN_API_URL` |
| Postgres (published) | **5434** recommended (`PERISCAN_POSTGRES_PUBLISHED_PORT`) | next free; **never** skip compose because a neighbor already has 5434 |
| Redis | `:6379` | `PERISCAN_REDIS_PUBLISHED_PORT` |
| MinIO | `:9000` | `PERISCAN_MINIO_PUBLISHED_PORT` |

Internal compose hostname is always `postgres` on 5432. Host `DATABASE_URL`
must match the **published** port. Compose port env does not rewrite
`DATABASE_URL` by itself.

Point the TUI at the printed API:

```bash
pnpm tui -- --api http://127.0.0.1:3001
```

If start remapped off 3001, pass that origin. `bash scripts/periscan.sh status`
prints what is actually up.

### How do I update?

```bash
bash scripts/periscan.sh update
bash scripts/periscan.sh start
```

`update` is git pull (if git) + `pnpm install` + migrate. It tells you to
restart with `start`. It does not live-reload a running plane.

### Do I need Docker? A worker? Node 24?

Yes, yes, and yes. Docker for Postgres/Redis/MinIO (and optional Community
overlay). Worker to finish Community jobs. Node 24 + pnpm 9.15.0 via Corepack.
Anything below Node 24 fails install (see above).

### How do I back up?

Community state is primarily **Postgres**. Compose pins project `periscan-deps`
and volume `postgres_data` (`infra/docker-compose/docker-compose.yml`). Snapshot
that volume, or dump via `pnpm db:backup` /
[`scripts/db-backup.sh`](../scripts/db-backup.sh) against `DATABASE_URL`
(custom-format `pg_dump`). Restore is destructive and confirmed:
[`scripts/db-restore.sh`](../scripts/db-restore.sh). Non-destructive drill:
`pnpm db:restore-drill`. MinIO evidence objects need separate retention —
database dump alone is not a full DR story. See
[`docs/runbooks/README.md`](./runbooks/README.md).

### TUI or web?

Same product. Same `/api/v1` routes. Web is the default operator UI. TUI
(`apps/tui`) is Ink on a TTY. `g` pins Gitleaks. See [`TUI.md`](./TUI.md).

### Do schedules already run Community?

No. ValidationSnapshot schedules stay snapshot-only unless
`config.communityValidation === true`. Denied / empty-suite starts do not
fall back to a report.

---

## License, commercial, safety

### What is the license of engines vs the product LICENSE?

Product LICENSE is **Apache-2.0**. Engines keep **upstream SPDX**. First-party
modules may show `Proprietary` SPDX for Periscan-authored checks; wrapped
third-party tools must keep upstream SPDX. CI: `pnpm licenses:check`. Notices:
[`licenses/THIRD_PARTY_NOTICES.md`](../licenses/THIRD_PARTY_NOTICES.md).
Policy: [`OPEN_SOURCE_POLICY.md`](../OPEN_SOURCE_POLICY.md).

Accepting GPL in Engine Lab does not change root `LICENSE`.

### MSSP / multi-tenant?

**Community GA is not an MSSP SKU.** It is **self-hosted**. Hosted multi-tenant
SaaS, **SSO/SCIM as a managed product**, MSSP portfolio, and marketplace stay
**commercial** — see [`ENTERPRISE.md`](./ENTERPRISE.md) and
[`OPEN_CORE.md`](../OPEN_CORE.md). Routes may exist in the
monorepo; presence in the tree does not make them Community-supported or a
second open-source grant. One local tenant after signup is the designed first
hour.

### Are you SOC 2 certified?

**No.** Periscan does not currently publish a vendor SOC 2 Type II report
(`soc2TypeIiStatus` None / NotClaimed). Community can emit a **customer SOC 2
support evidence pack** mapping measured validation evidence to a partial TSC
catalog for *your* auditor follow-up — not certification, not an audit opinion.
Details: [`SOC2.md`](./SOC2.md).

### Why does Dependabot alert on a security product?

Third-party **engines** and **Node dependencies** keep upstream SPDX and CVEs.
Dependabot / GHSA banners on this repo are supply-chain hygiene, not a claim
that the validation loop is “insecure by design.” Triage highs; bump when tests
can accompany the pin. Product or dependency vulns that need private intake go
through a title-only `[SECURITY]` issue (below) — not a guessed mailbox.

### Can I enable live Atomic / Caldera / SharpHound?

These adapters, together with Metasploit, are part of the [BAS/AEV development
program](BAS_AEV_PROGRAM.md). Current content imports and fixtures do not enable
live execution. Each live adapter must pass scenario qualification, bind an
approved plan to verified scope, and produce measured evidence. Installation
or a signed agreement alone does not establish those capabilities.

### How do I report a vulnerability?

[`SECURITY.md`](../SECURITY.md). There is **no** `security@` mailbox. Do not
guess one. Do not post exploit details, payloads, or credentials in a public
issue.

1. Open a **title-only** GitHub issue on
   [seanventures/periscan](https://github.com/seanventures/periscan/issues)
   prefixed `[SECURITY]` (no PoC in the body).
2. Maintainers follow up privately: component/version, repro against **your
   own** lab or written-authorized systems, impact, suggested fix.
3. Do not attach live exploit PoCs, ransomware, credential dumps, or
   weaponized payloads.

Ack target: 72 hours. Fix or disclose: 90 days unless a longer embargo is
agreed. GitHub private vulnerability reporting is **not** intake.

### Is there a hosted SaaS I can just log into?

Not as Community GA. This snapshot is self-hosted. Hosted SaaS remains
commercial product.

### How do I contribute an engine?

Adapter + fixture + license row. Ladder: [`CONTRIBUTING.md`](../CONTRIBUTING.md),
[`ADAPTER_FIRST_PR.md`](./ADAPTER_FIRST_PR.md), [`GOVERNANCE.md`](../GOVERNANCE.md).
BAS adapters are welcome under [BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md).
Prisma wholesale rewrites, runner transport changes and LICENSE changes retain
their separate review requirements.

---

## Related

| Want | File |
| --- | --- |
| End-to-end operator path | [`USING.md`](./USING.md) |
| Community pack tables | [`COMMUNITY.md`](../COMMUNITY.md) |
| SOC 2 honesty | [`SOC2.md`](./SOC2.md) |
| Category language | [`competitive/POSITIONING.md`](./competitive/POSITIONING.md) |
| Settled axioms | [`SETTLED.md`](./SETTLED.md) |
