# Periscan Community edition

You already have scanners. You do not have **proof**.

Community edition is the self-hosted **AEV/CTEM proof layer**: authorize a
scope, run a dense safe OSS pack under policy, keep evidence, and only mark
**Fixed** when a re-measurement says so.

Source is **Apache-2.0** ([`LICENSE`](./LICENSE), [`OPEN_CORE.md`](./OPEN_CORE.md)).
It is **not** full BAS, automated pentest, or a Wiz / Tenable replacement.

Source of truth: `packages/shared/src/community-edition.ts`
(`COMMUNITY_EDITION_VALUE_LINE`).

---

## Who it is for

- Security and platform engineers who need measured proof on systems they **own
  or are contracted to test**
- AppSec teams who already run Trivy, Gitleaks, Nuclei, Prowler and want one
  evidence ledger instead of a scanner dump
- Contributors adding a **safe engine adapter**
  ([`docs/ADAPTER_FIRST_PR.md`](./docs/ADAPTER_FIRST_PR.md),
  [`GOVERNANCE.md`](./GOVERNANCE.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md))

Not for: unauthorized scanning, live ransomware theater, or “make us look like
Cymulate.”

---

## 60-second why

1. **Authorize first.** Domain (DNS TXT), repository (`.periscan-authorization`
   token file), AWS (Connected account match or Owner/Admin attest), CIDR
   (audited Owner/Admin attest). `devModeManual` is lab-only.
2. **Run the Community pack.** Validate → **Run Community validation**. That
   queues worker / runner work. Nuclei is a **second mission** so a PoA
   kill-switch cannot block the rest.
3. **Read evidence, not JSON dumps.** Findings for a mission are those whose
   evidence intersects that run. No evidence → empty list, not theater.
4. **Fix, then prove.** Remediations open from the mission. **Fixed requires a
   verification event.** Closing a ticket is `ClosedWithoutEvidence`.

That is the product. Category home: AEV / CTEM proof layer. Co-exist with CNAPP
and RBVM; do not replace them. See
[`docs/competitive/POSITIONING.md`](./docs/competitive/POSITIONING.md).

---

## Proof loop

```text
verified scope
    → policy decision (deny never queues)
    → Community engines (permissive SPDX + first-party)
    → evidence
    → findings?missionId=
    → remediations
    → revalidate
    → Fixed only via verification
```

`pnpm seed:demo` is a **labeled fixture** workspace. It is not measured lab
proof. Use clone-to-proof below.

Schedules stay snapshot-only unless you opt in with
`config.communityValidation: true`.

---

## Engine pack (default start)

Permissive SPDX only (MIT / Apache-2.0 / BSD-3-Clause / NPSL) plus first-party
checks. Load binaries from Engine Lab with **Install + enable Community pack**.

| Job | Engines (default Community) |
| --- | --- |
| Secrets | Gitleaks, detect-secrets, git-secrets, secretlint, Talisman |
| SCA | Trivy, OSV, Grype, pip-audit, govulncheck, cargo-audit, retire.js, OWASP Dependency-Check |
| SAST | Bandit, gosec, Brakeman, Horusec |
| IaC / k8s manifests | Checkov, Terrascan, KICS, kube-linter, kube-score, Kubescape, Conftest, Trivy misconfig |
| SBOM / provenance | Syft, cdxgen, slsa-verifier |
| Containers | Dockle, Trivy |
| TLS / HTTP | SSLyze, tlsx, first-party DNS/TLS/HTTP |
| Web | ZAP baseline; Nuclei safe exposure (**second mission**) |
| Cloud | Prowler on a **Connected** AWS account |
| Kube CIS | kube-bench, first-party Kubernetes CIS |
| Detection rules | YARA repo rules, Falco **rules lint** (not Falco-as-runtime) |
| Recon (runner enrolled) | nmap, naabu, amass (passive), subfinder, httpx, dnsx |

**Not in the default start**

| Kind | What happens |
| --- | --- |
| GPL / LGPL / AGPL (Semgrep, testssl, Nikto, WhatWeb, ScoutSuite, TruffleHog, osquery, Wazuh, …) | Engine Lab + license accept. Not Community start. |
| AGPL / SSPL / BSL / Commons Clause / PolyForm | **Blocked.** No install path. |
| Atomic, Caldera, SharpHound, sqlmap, Metasploit | Catalog theater. Never Community. Never installable as validation. |

Engine Lab is the package manager for 100+ OSS tools. Catalog size is not
Community start. First-party modules may show `Proprietary` SPDX; wrapped
third-party tools must keep upstream SPDX.

---

## Safety floor

Non-negotiable. Public community does not relax these.

- Only **verified, customer-authorized** scope
- No destructive tests, real data exfiltration, credential theft, or persistence
- Denied tasks **never** queue
- **Fixed** requires a verification event
- Live Atomic / Caldera / SharpHound / sqlmap / Metasploit stay off without a
  separate legal SOW
- Runner transport is **outbound HTTPS signed-task polling** (no inbound
  management plane as default)
- Product-visible data is real, honest-empty, or clearly labeled sample/demo

Full floor: [`SECURITY_BOUNDARIES.md`](./SECURITY_BOUNDARIES.md),
[`SECURITY.md`](./SECURITY.md).

---

## Clone to proof (local lab)

Three honest paths. Do not sequence `pnpm lab:demo-up` as the Community
pack. Community edition is the validation slice, **not** a LICENSE flip.
`pnpm seed:demo` is a labeled fixture. Not this loop.

**1. Bring up the stack.** Deps + api + worker + web. Pick one:

```bash
bash scripts/community-first-hour.sh
pnpm lab:dev                 # host toolchain; LAB_MODE=1
```

or Docker overlay instead of `lab:dev`:

```bash
bash scripts/community-up.sh
```

`community-first-hour.sh` is compose + migrate. It does **not** run
`seed:demo`, `lab:up`, or `pnpm verify`. Plain `pnpm dev` has no worker
and cannot finish Community runs. If `:3000` is taken, `lab:dev` binds
`3010`. Overlay details:
[`infra/docker-compose/README.md`](./infra/docker-compose/README.md).

**2. `pnpm lab:demo-up` is hops + SIEM canary.** It is **not** the
Community pack.

That seed measures `*.lab.range.test` hops and mocksiem.
`fullyMeasured` is lab spine, not Community OSS. Do not treat
`PERISCAN_LAB_STRICT=1` as a Community gate.

Lab spine (separate path): [`docs/DEMO_LAB_SITE.md`](./docs/DEMO_LAB_SITE.md),
[`infra/lab/README.md`](./infra/lab/README.md),
[`demo/DEMO_SCRIPT.md`](./demo/DEMO_SCRIPT.md).

**3. Community pack** is Validate → **Run Community validation** on a
**verified** authorized scope.

Authorize first. Wait for evidence. Open remediations from **that**
mission. Re-run. **Fixed** only via verification. HTTP 200 is not
“jobs queued.” Hop missions from demo-up are not this pack.

Verify the tree (heavy): `pnpm verify`. License gate: `pnpm licenses:check`.

---

## API surface

API-first. UI consumes these routes; so can you.

| Method | Path | Job |
| --- | --- | --- |
| `GET` | `/api/v1/community/validation-suite?scopeId=` | Engines for that verified scope |
| `POST` | `/api/v1/community/validation-runs` | Start a Validation Snapshot that **queues work** |
| `GET` | `/api/v1/community/validation-runs?missionId=` | Reconstruct pack + Nuclei sibling |
| `POST` | `/api/v1/community/validation-runs/:missionId/remediations` | Open remediations from **that** mission’s findings |
| `GET` | `/api/v1/findings?missionId=` | Findings whose evidence intersects the mission |

Prowler uses the Connected AWS integration’s stored credentials at execution
time. Secrets are not written onto `validationRun.target`.

Policy preview matches the **primary** start set. Runner-lane engines preview
`InternalRunner`. A ControlPlane ticket cannot start runner modules
(`community_environment_mismatch`).

Bootstrap: `GET /api/v1/health`, `GET /openapi.json`. Example automation:
[`examples/proof-loop.sh`](./examples/proof-loop.sh).

---

## Honest language

| Say | Do not say |
| --- | --- |
| AEV / CTEM **proof layer** on authorized scope | Full BAS platform / multi-vector BAS like Cymulate |
| Measured exposure validation with evidence | Automated pentest / autonomous red team |
| Co-exist with CNAPP (Wiz) and RBVM (Tenable) | Replace your CNAPP / replace Tenable |
| Fixed only after re-validation | Mark Fixed from ticket sync |
| Community edition / open-core validation slice | We are open source now |

Contract: `CLAIM_LANGUAGE_CATALOG` in `packages/shared/src/claim-deny-list.ts`.

---

## Rails

Short map. Not a README fold. Not a LICENSE flip.

| Want | File |
| --- | --- |
| First hour (deps, not proof) | [`scripts/community-first-hour.sh`](./scripts/community-first-hour.sh) then `pnpm lab:dev`, or [`scripts/community-up.sh`](./scripts/community-up.sh) |
| Lab hops (not Community pack) | `pnpm lab:demo-up` — [`demo/DEMO_SCRIPT.md`](./demo/DEMO_SCRIPT.md) |
| First adapter PR | [`docs/ADAPTER_FIRST_PR.md`](./docs/ADAPTER_FIRST_PR.md) |
| `.periscan.yaml` (intent only) | [`docs/PERISCAN_YAML.md`](./docs/PERISCAN_YAML.md) |
| GitHub proof Action | [`actions/community-proof/README.md`](./actions/community-proof/README.md) |
| Fast PR checks | [`.github/workflows/pr-fast.yml`](./.github/workflows/pr-fast.yml) |
| Measured mark (not certified) | [`docs/BADGES.md`](./docs/BADGES.md) |
| Private-tree exclude | [`docs/PUBLIC_TREE.md`](./docs/PUBLIC_TREE.md) |
