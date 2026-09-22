# FAQ

Short answers. Claim contract: `CLAIM_LANGUAGE_CATALOG` in
`packages/shared/src/claim-deny-list.ts`. Ledger: [`docs/SETTLED.md`](docs/SETTLED.md).
Longer operator FAQ: [`docs/FAQ.md`](docs/FAQ.md).

## Is Periscan open source?

Source is **Apache-2.0**. Community edition is the open-core **validation slice**
(authorized scope + policy + qualified engines + evidence). Full BAS/AEV is
the product development objective; the shipped coverage is documented per
adapter. Third-party engines keep their own SPDX.

## Who is this for?

AppSec, platform, and security engineers who **own** the target or are
**contracted to test** it.

## Who is this not for?

Anyone without authorization. Periscan combines BAS/AEV development with
measured exposure and fix verification; it co-exists with Wiz and Tenable.

## What does Community do vs not do?

**Does (Community start):** verified **local clone** path → policy gate →
**Gitleaks-class secrets** (`jobsQueued=1`) → evidence → Fixed only after
retest. Then keep proving: review, re-verify, schedule the next run.

**Does not:** hosted `github.com/org/repo` fetch, full BAS, CNAPP/RBVM
replacement, live Atomic / Caldera / SharpHound / sqlmap / Metasploit, or
multi-tenant MSSP packaging. The broader Community pack is a second control
(permissive SPDX + first-party checks), not the default start.

## Can I authorize `github.com/org/repo`?

No. Hosted GitHub URLs are not a control-plane path. `git clone <your-repo>`
on the machine running Periscan, then paste the **absolute path**. Prove
authorization with `.periscan-authorization` (or Owner/Admin attestation when
the path is runner-only).

## Why not paste `github.com/org/repo`?

The plane (or an enrolled runner) reads a **local filesystem path**. It does
not clone github.com for you. Add / Verify / Attest refuse hosted URLs
(`hosted_github_url_not_verifiable`). Clone first, then paste the absolute
path.

## What does Community start run?

On a verified **local clone path**, default start is **Gitleaks-class secrets**
(`jobsQueued=1`). Not the full Community pack. Keep that board running. Need **Node 24** and **Docker**.
`git clone <your-repo>` on the machine running Periscan, then paste the
**absolute path**.

## Why does Node 20 (or anything below 24) fail?

Install and `scripts/periscan.sh` require **Node 24+** (see [`.nvmrc`](.nvmrc)).
Node 20 / 22 fail the major check before compose or migrate. Use Node 24 via
nvm, fnm, or your package manager, then Corepack for pnpm 9.15.0. Docker is
also required for Postgres / Redis / MinIO.

## curl|bash or clone-first?

**Clone-first.** Inspect the tree, then:

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

`curl|bash` is **secondary** (first-time / one-paste). Read
[`install.sh`](install.sh) before piping. Node 24 + Docker still apply.

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
```

## How do I install?

Need **Node 24** ([`.nvmrc`](.nvmrc)) and **Docker**. Prefer clone + inspect
above. Secondary one-paste is the `curl|bash` line in the previous answer.

## When is a finding Fixed?

Only after a **measured retest** (`verifiedAt`, `verifiedBy`,
`verificationEvidenceId`). Opening a remediation or closing a ticket is
`ClosedWithoutEvidence`, not Fixed. Fixed can demote if the exposure returns.

## Does this replace my scanners / CNAPP / RBVM?

No. Trivy, Nuclei, Gitleaks, and peers **find**. Periscan **proves** on
authorized scope and re-proves fixes. Co-exist with Wiz-class CNAPP and
Tenable-class RBVM.

## CTEM in Periscan

In this product, CTEM is a **proof layer on authorized scope**
(Scope → Discover → Prioritize → Validate → Mobilize → Verify). That loop maps
to operator **Authorize → Verify**. It is **not** a Microsoft CTEM replacement.
Periscan has a full BAS/AEV development program. Scenario execution requires
qualified adapters and measured evidence.

Community start is still **Gitleaks-class secrets** (`jobsQueued=1`) on an
authorized local path. Keep proving after that run. **Live Atomic** requires a qualified adapter before execution. Hosted product and MSSP
portfolio are commercial.

## Will Community start run Semgrep or Atomic?

No. Default start is **Gitleaks-class secrets** (`jobsQueued=1`). The full pack is
a second control (permissive SPDX + first-party checks). GPL / LGPL engines
are Engine Lab + license accept. Atomic, Caldera, SharpHound and Metasploit are in the BAS/AEV program; each adapter must pass qualification before live execution. Community start does not run them.

## Multi-user / tenants?

Community GA is **self-hosted**. One local tenant after signup is the designed
Community start. Hosted multi-tenant SaaS and **SSO/SCIM as a managed product** stay
**commercial** — see [`docs/ENTERPRISE.md`](docs/ENTERPRISE.md) and
[`OPEN_CORE.md`](OPEN_CORE.md). Routes in the monorepo are not a Community SKU.

## Are you SOC 2 certified?

**No.** Periscan does not currently publish a vendor SOC 2 Type II report
(`soc2TypeIiStatus` None / NotClaimed). Community can emit a **customer SOC 2
support evidence pack** mapping measured validation evidence to a partial TSC
catalog for *your* auditor follow-up — not certification, not an audit opinion.
Details: [`docs/SOC2.md`](docs/SOC2.md).

## How do I back up?

Postgres data lives in the compose volume `postgres_data` (project
`periscan-deps`). Snapshot that volume, or run `pnpm db:backup` /
`bash scripts/db-backup.sh` against `DATABASE_URL` (custom-format `pg_dump`).
Restore with `scripts/db-restore.sh` (destructive; confirm) or drill with
`pnpm db:restore-drill`. Evidence objects in MinIO need their own retention.

## Why does Dependabot alert on a security product?

Engines and Node dependencies keep **upstream** SPDX and CVEs. Alerts on this
repo are normal supply-chain hygiene, not a claim that Periscan is “insecure by
design.” Triage highs; report product/vuln intake via a title-only `[SECURITY]`
issue (see below) — do not invent a mailbox.

## Is a queued run “measured”?

No. A job in flight is Watch. **Measured** means a completed authorized
Community run produced evidence. This repository’s README badge stays
**not-measured** until that exists here. See [`docs/BADGES.md`](docs/BADGES.md).

## How do I report a vulnerability?

[`SECURITY.md`](SECURITY.md). **No** public security mailbox — do not invent one.
**No** public PoC, payloads, or credentials in the issue body.

1. Open a **title-only** `[SECURITY]` issue on
   [seanventures/periscan](https://github.com/seanventures/periscan/issues).
2. Maintainers follow up privately (component/version, repro on **your** lab or
   written-authorized systems, impact, suggested fix).
3. Ack target **72 hours**; fix or disclose **90 days** unless a longer embargo
   is agreed. GitHub private vulnerability reporting is **not** intake.

## Where do I file issues?

Product/bugs:
[seanventures/periscan](https://github.com/seanventures/periscan/issues).
Security: title-only `[SECURITY]` — [`SECURITY.md`](SECURITY.md).

How to run the loop: [`USING.md`](USING.md) and [`docs/USING.md`](docs/USING.md).
