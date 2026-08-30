# Periscan

**Prove authorized exposures are real — and only mark them Fixed when a retest says so.**

Periscan is a self-service Automated Security Validation platform.

Find the path. Validate the risk. Prove it's fixed.

Policy-gated security validation. Community OSS engines. Evidence receipts, not scanner dumps. Periscan validates exposure, controls, attack paths, AI applications, and fixes, then turns the results into proof customers can use.

[Community edition](COMMUNITY.md) ·
[Open core](OPEN_CORE.md) ·
[Safety](SECURITY_BOUNDARIES.md) ·
[Contributing](CONTRIBUTING.md) ·
[Governance](GOVERNANCE.md) ·
[Security](SECURITY.md)

[![CI](https://img.shields.io/badge/verify-pnpm%20verify-black)](#verify)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](#license-and-open-core)
[![Engines](https://img.shields.io/badge/engines-upstream%20SPDX-blue)](licenses/THIRD_PARTY_NOTICES.md)

![Not measured by Periscan](docs/images/badge-not-measured.svg)

This repo has no dogfood Community evidence yet, so the mark is **not-measured**.
Swap to [`docs/images/badge-measured.svg`](docs/images/badge-measured.svg) only after an authorized Community run produces evidence. Never recolor it Fixed-green without a verification event. See [docs/BADGES.md](docs/BADGES.md).

> **Not a scanner UI. Not full BAS. Not automated pentest.** Periscan is the
> AEV / CTEM *proof layer* on **verified, authorized scope**. It co-exists with
> CNAPP (e.g. Wiz) and RBVM (e.g. Tenable). It does not replace them.

---

## Why this exists (60 seconds)

You already run **Trivy, Nuclei, Gitleaks, ZAP, Prowler**. They are excellent at *finding*.

What they do not do:

1. **Refuse to start** when the target is not a verified authorized scope.
2. **Normalize** dozens of engines into one evidence ledger (no raw tool JSON as the product).
3. **Stop ticket theater** — `Fixed` only after a measured re-validation event.
4. **Keep the safety floor on** when someone asks for live Atomic / ransomware / auto-pentest.

Scanners emit findings. Tickets get closed. Nobody can prove the path was real, or that the fix held.

Periscan is the missing loop: **authorize → policy → Community pack → evidence → retest → Fixed**.

Offering page: [COMMUNITY.md](COMMUNITY.md). Category contract: [docs/competitive/POSITIONING.md](docs/competitive/POSITIONING.md).

---

## First run (copy-paste)

Requires **Node 24** (see `.nvmrc`), **pnpm 9.15.0** (Corepack), and **Docker**.
Do **not** run `docker compose up` at the repo root — that file is the goldeneye
production stack. Local deps are `infra/docker-compose/docker-compose.yml`.

**1. Dependencies + migrate**

```bash
corepack enable && corepack prepare pnpm@9.15.0 --activate
pnpm install
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d --wait
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm --filter @periscan/db db:generate
pnpm --filter @periscan/db db:migrate:deploy
```

Or: `make first-run` (defaults Postgres publish port `5434`).

One script: `bash scripts/community-first-hour.sh` (Docker + migrate; does **not** run `seed:demo` or `lab:up`).

Want api + web + worker in Docker instead of `pnpm lab:dev`?

```bash
bash scripts/community-up.sh
```

That merges `infra/docker-compose/docker-compose.yml` with `docker-compose.community.yml` (project `periscan-deps`). Not root `compose.yaml`. `PERISCAN_DEV_MODE=true` is local-only.

**2. Measured lab loop** (this is the designed proof, not a fixture tenant)

```bash
pnpm lab:up && pnpm lab:smoke
pnpm lab:dev          # API + worker + web; LAB_MODE=1
# other terminal, same DATABASE_URL / ports:
PERISCAN_LAB_STRICT=1 pnpm lab:demo-up
```

Open `http://127.0.0.1:3000` (`lab:dev` binds `3010` if `3000` is taken).
Login comes from `infra/lab/.lab-demo.env` (gitignored).

Then in the UI: add a **verified scope** → **Run Community validation**. Watch
the mission. Queueing is not a measured result.

Details: [docs/DEMO_LAB_SITE.md](docs/DEMO_LAB_SITE.md), [infra/lab/README.md](infra/lab/README.md).

**Fixture workspace (labeled, not proof)**

```bash
pnpm seed:demo
pnpm dev:worker       # api+web only (`pnpm dev`) cannot finish Community runs
```

Login `demo@periscan.local` / `periscan-demo-password` is a **fixture** tenant.
Sample report at `/demo` is labeled sample. Neither is a measured lab result.

---

## Proof loop

```mermaid
flowchart LR
  A[Verify authorized scope] --> B{Policy decision}
  B -->|Denied| C[Never queued + audit event]
  B -->|Allow| D[Community pack]
  D --> E[Evidence receipts]
  E --> F[Findings intersected by evidence IDs]
  F --> G[Remediate]
  G --> H[Re-validate]
  H -->|Still exposed| F
  H -->|Measured clear| I[Fixed]
```

| Scope | How you prove authorization |
| --- | --- |
| Domain / subdomain | DNS TXT |
| Repository | `.periscan-authorization` token file (or Owner/Admin attestation when runner-only) |
| Cloud account | Connected AWS account match, or Owner/Admin attestation |
| IP range / internal net | Audited Owner/Admin attestation |

`devModeManual` is lab-only. Denied tasks **never queue**. A finding with no
evidence for that mission is an **empty list**, not theater. **Fixed** requires
a verification event; ticket close is `ClosedWithoutEvidence`.

```bash
GET  /api/v1/community/validation-suite?scopeId=
POST /api/v1/community/validation-runs
GET  /api/v1/findings?missionId=
POST /api/v1/community/validation-runs/:missionId/remediations
```

HTTP 200 on start is not “jobs queued” — read `jobsQueued` and `mission.status`.
Nuclei is a **second mission** (External PoA). Do not put it in the primary `moduleIds`.
Community-as-code intent: [`.periscan.example.yaml`](.periscan.example.yaml)
([docs/PERISCAN_YAML.md](docs/PERISCAN_YAML.md)). The control plane does **not**
load that file.

---

## Community pack

Community edition is the **self-hosted validation slice**: verified scope +
policy + the dense **permissive SPDX** pack + first-party checks + evidence.
Load binaries in **Engine Lab → Install + enable Community pack**.

It is **not** live Atomic / Caldera /
Metasploit / sqlmap.

| Pack | Default Community start | SPDX | Lane |
| --- | --- | --- | --- |
| Secrets | Gitleaks, detect-secrets, git-secrets, secretlint, Talisman, Whispers | MIT / Apache-2.0 | Control plane |
| SCA | Trivy, OSV-Scanner, Grype, pip-audit, govulncheck, cargo-audit, retire.js, Nancy, Dependency-Check | Apache-2.0 / MIT / BSD-3 | Control plane |
| SAST | Bandit, gosec, Brakeman, Horusec, Sobelow | MIT / Apache-2.0 | Control plane |
| IaC | Checkov, Terrascan, KICS, kube-linter, kube-score, Kubescape, Conftest, tfsec, cfn-nag, Polaris, kubeaudit, Trivy misconfig | MIT / Apache-2.0 | Control plane |
| SBOM / provenance | Syft, cdxgen, slsa-verifier | Apache-2.0 | Runner for Syft / cdxgen |
| Containers / Kubernetes | Dockle, Trivy, kube-bench, Popeye | Apache-2.0 | Mixed |
| TLS | SSLyze, tlsx, first-party cert + protocol | Apache-2.0 / MIT | Mixed |
| Web | ZAP baseline, Katana | Apache-2.0 / MIT | Mixed |
| Cloud | Prowler on **Connected** AWS, cloudlist | Apache-2.0 / MIT | Cloud / runner |
| Recon *(runner enrolled)* | nmap, naabu, Amass *passive*, Subfinder, httpx, dnsx | NPSL / MIT / Apache-2.0 | Internal runner |
| Detection *content* | YARA repo rules, Falco **rules lint** | BSD-3 / Apache-2.0 | Control plane |
| First-party | DNS (SPF/DMARC/CAA), security.txt, HTTP headers / cookies / CORS / redirects, TCP reachability | Product modules | Control plane |
| Nuclei | Safe external exposure | MIT | **Second mission** |

Stock clone: first-party DNS/TLS/HTTP on a verified Domain is live. Popular
CLIs need Engine Lab install (or scan-executor). Missing binaries are
`tool_unavailable` / Inconclusive — not invented findings.

**Engine Lab, not Community start**

| Class | Examples | How |
| --- | --- | --- |
| Copyleft opt-in | Semgrep, testssl.sh, Nikto, WhatWeb, ScoutSuite, Hadolint, Lynis, RustScan | Review licenses → accept SPDX → official-upstream pin |
| Theater (never validation) | Atomic Red Team, Caldera, SharpHound, sqlmap, Metasploit | Catalog only |

---

## Safety floor (this is a feature)

| Guarantee | What it means |
| --- | --- |
| Authorized scope only | No third-party scanning without verified authorization |
| Denied never queued | Policy `Denied` fails closed before the job queue |
| No destructive actions | No exfil, persistence, credential theft, or uncontrolled exploit chaining |
| Live offensive packs off | Atomic, Caldera, SharpHound, ransomware, Metasploit stay off without a legal SOW |
| Runner is outbound | HTTPS signed-task polling. No inbound management plane as the default |
| Fixed is earned | Status `Fixed` requires a measured verification event |
| Path words are earned | `validated` / `measured` / `reachable` / `exploitable` follow weakest-hop evidence |
| Raw scanners stay backstage | Tool JSON is evidence, not the UX or the report |

See [SECURITY_BOUNDARIES.md](SECURITY_BOUNDARIES.md) and [SECURITY.md](SECURITY.md).

---

## Compared to what you already run

| | CLI scanners | Aggregators (DefectDojo) | CNAPP / RBVM | BAS / auto-pentest | **Periscan** |
| --- | --- | --- | --- | --- | --- |
| Job | Find issues | Dedup imports | Inventory / vuln SoR | Attack libraries | **Prove** exposure and **re-prove** fixes |
| Starts without verified scope? | Usually | N/A | Connectors | Often | **No** |
| Policy deny never queues? | Exit codes | N/A | Tickets | Varies | **Product guarantee** |
| `Fixed` | Re-run the tool | Ticket workflow | SLA / close | Sometimes retest | **Only after verification** |
| Live ransomware / kill-chain | Unrelated | Unrelated | Unrelated | Often the demo | **Hard no** |
| Replace Wiz / Tenable? | No | No | They *are* those | No | **No — co-exist** |
| Product LICENSE | Usually Apache/MIT | BSD (DefectDojo OS) | Proprietary | Proprietary | **Apache-2.0 + upstream engine SPDX** |

Nuclei is a first-class **engine** (second mission, allowlisted safe profiles).
Periscan is not a Nuclei wrapper and does not compete on template count.

---

## Contributing ladder

This repo is **Apache-2.0** with an **open-source engine-adapter** surface.
Read [CONTRIBUTING.md](CONTRIBUTING.md), [docs/ADAPTER_FIRST_PR.md](docs/ADAPTER_FIRST_PR.md),
[GOVERNANCE.md](GOVERNANCE.md), and [OPEN_SOURCE_POLICY.md](OPEN_SOURCE_POLICY.md).

| Rung | What to send | Done looks like |
| --- | --- | --- |
| 0. Hygiene | Typo, claim-language nit | Matches the [claim deny-list](packages/shared/src/claim-deny-list.ts) |
| 1. First useful PR | Module **adapter + fixture** for a permissive engine ([cfn-lint](https://github.com/seanheiney/periscan/issues/74), [tflint](https://github.com/seanheiney/periscan/issues/75), [parliament](https://github.com/seanheiney/periscan/issues/76)) | `pnpm --filter @periscan/modules test`, `pnpm licenses:check` |
| 2. Pack honesty | License row, Engine Lab metadata, notices | `pnpm licenses:write` then `pnpm licenses:check` |
| 3. Policy / Fixed | Denied never queues, or Fixed cannot flip without verify | Hits policy / `fix-verification` tests |
| 4. Intake (no binary) | `POST /api/v1/third-party-tools/intake/validate` | Certification report; not an unreviewed runtime |
| 5. Ask first | Live Atomic/Caldera/SharpHound, Prisma wholesale, runner transport, **LICENSE** | Closed. Founder + counsel + legal SOW |

Issue forms: bug, feature, engine-adapter. PR template encodes SETTLED TELLs.

GitHub proof Action (comments measured evidence on a PR, denied never queued):
[`actions/community-proof`](actions/community-proof/README.md). Example:
`.github/workflows/community-proof-example.yml` (`workflow_dispatch` only).
The Action calls your Periscan API — it does not run scanners on GitHub-hosted runners.

SARIF 2.1.0: `GET /api/v1/findings.sarif` (`Content-Type: application/sarif+json`, optional `missionId`). Mapper: `@periscan/reports` `findingsToSarif`. Empty evidence is dropped. `Fixed` is a SARIF pass only with a measured verification event. Not a certification or pentest report.

---

## License and open-core

Root [`LICENSE`](./LICENSE) is **Apache-2.0**. See [OPEN_CORE.md](OPEN_CORE.md)
and [NOTICE](./NOTICE). Hosted SaaS / MSSP / marketplace stay commercial
product. The goldeneye `seanheiney/periscan` remote stays **private**.

| Layer | License | Notes |
| --- | --- | --- |
| Product (control plane, UI, API, worker, runner, first-party modules) | Apache-2.0 | Public Community snapshot |
| Third-party engines and Node dependencies | Their SPDX | [licenses/THIRD_PARTY_NOTICES.md](licenses/THIRD_PARTY_NOTICES.md) |
| Community edition | Apache-2.0 *slice* | Feature gates + pack freeze + honest claims |

---

## Verify

```bash
pnpm verify
```

That is the **release** gate (lint, typecheck, tests, build, runner, licenses,
Prisma, Playwright, security, acceptance). Before a PR, the useful subset is:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm licenses:check
```

GitHub Actions runs `pnpm verify` on `main`, tags `v*`, and pull requests
(Postgres, Redis, MinIO). Force-push cancels in-progress runs.

Optional working-tree secret scan (needs a local `gitleaks` binary): `pnpm secrets:scan`.
History before a public flip: `gitleaks detect --log-opts='--all'` (see [docs/PUBLIC_TREE.md](docs/PUBLIC_TREE.md)).

---

## Workspace and local ports

```text
apps/{api,web,worker,runner}   packages/{shared,db,policy,evidence,connectors,modules,reports}
infra/docker-compose/          local Postgres / Redis / MinIO (project name: periscan-deps)
```

| Service | Default | Override |
| --- | --- | --- |
| API | `http://127.0.0.1:3001` | `PERISCAN_API_PORT` |
| Web | `http://127.0.0.1:3000` | `PERISCAN_WEB_PORT` (`lab:dev` auto-shifts to 3010 if busy) |
| Postgres | `127.0.0.1:5432` | `PERISCAN_POSTGRES_PUBLISHED_PORT` **and** `DATABASE_URL` |
| Redis | `127.0.0.1:6379` | `PERISCAN_REDIS_PUBLISHED_PORT` **and** `REDIS_URL` |
| MinIO | `127.0.0.1:9000` | `PERISCAN_MINIO_PUBLISHED_PORT` |

`pnpm dev` is api+web only. Community validation needs `pnpm dev:worker` or
`pnpm lab:dev`. Prisma migrate needs `DATABASE_URL` exported — compose port
overrides do not rewrite it automatically.

Agent / architecture notes: [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md),
[docs/SETTLED.md](docs/SETTLED.md).

Integration marketplace (`/integrations`): 267-entry connector catalog: 126 dedicated live integrations and 141 planned, non-connectable catalog entries. Planned entries stay NotConnectable.

## Operator docs (not the GitHub fold)

Long-form product reference: [docs/PERISCAN_FULL_PRODUCT_PRD.md](docs/PERISCAN_FULL_PRODUCT_PRD.md) (internal vision — not shipped claims).
Execution status: [docs/PRODUCT_COMPLETION_PLAN.md](docs/PRODUCT_COMPLETION_PLAN.md).
Traceability: [docs/TRACEABILITY_MATRIX.md](docs/TRACEABILITY_MATRIX.md), [docs/USER_STORIES.md](docs/USER_STORIES.md), [docs/ACCEPTANCE_CRITERIA.md](docs/ACCEPTANCE_CRITERIA.md).
Source-first PRD audit: [docs/PRD_AUDIT_PROTOCOL.md](docs/PRD_AUDIT_PROTOCOL.md), the PRD source coverage ledger [docs/PRD_SOURCE_COVERAGE_LEDGER.md](docs/PRD_SOURCE_COVERAGE_LEDGER.md), and the atomic requirement ledger [docs/PRD_REQUIREMENT_LEDGER.md](docs/PRD_REQUIREMENT_LEDGER.md).
The current full-PRD implementation completion report lives in [docs/COMPLETION_REPORT.md](docs/COMPLETION_REPORT.md). Use `pnpm prd:audit` for the current source-led audit status and `pnpm prd:audit:strict` before making or refreshing any final full-product completion claim.
