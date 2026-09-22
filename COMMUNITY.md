# Periscan Community edition

Authorize a **local clone** you own (or are contracted to test), run
**Gitleaks-class secrets** first (`jobsQueued=1`), keep evidence, and mark
**Fixed** only after retest. Keep this board running.

Community edition currently ships the Apache-2.0 **validation slice**. Full
BAS/AEV is an authorized [development objective](docs/BAS_AEV_PROGRAM.md);
qualified adapters and edition policy determine future pack membership.

Source is **Apache-2.0** ([`LICENSE`](./LICENSE), [`OPEN_CORE.md`](./OPEN_CORE.md)).

Need **Node 24** ([`.nvmrc`](.nvmrc)) and **Docker**. pnpm 9.15.0 via Corepack.

Contract: `packages/shared/src/community-edition.ts`
(`COMMUNITY_EDITION_VALUE_LINE`).

---

## Who it is for

- AppSec, platform, and security engineers who need measured proof on systems
  they **own or are contracted to test**
- Teams who already run Trivy, Gitleaks, Nuclei, Prowler and want one evidence
  ledger instead of a scanner dump
- Contributors adding a **safe engine adapter**
  ([`docs/ADAPTER_FIRST_PR.md`](./docs/ADAPTER_FIRST_PR.md),
  [`CONTRIBUTING.md`](./CONTRIBUTING.md))

Not for unauthorized scanning or destructive tests. BAS coverage claims require
measured evidence for the supported scenarios.

---

## Start

Need **Node 24** and **Docker**. Clone this repo, inspect it, then install:

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

Open the printed URL. Create an account. **Authorize a local clone path** —
`git clone <your-repo>` on this machine, then paste the **absolute path** —
not `github.com/org/repo`. Default start is **Gitleaks-class secrets**
(`jobsQueued=1`). Remediations stay **Open** until verify. Schedule the next run.

Secondary one-paste (inspect `install.sh` first):

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
```

Ports, fallbacks (`community-first-hour.sh`, `lab:dev` auto-shift), and HTTP:
[`USING.md`](./USING.md). Questions: [`FAQ.md`](./FAQ.md).

`pnpm seed:demo` is a **labeled fixture**. It is not this loop.

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

| Scope                   | Authorization                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------- |
| Domain / subdomain      | DNS TXT                                                                            |
| Repository              | `.periscan-authorization` token file (or Owner/Admin attestation when runner-only) |
| Cloud account           | Connected AWS match, or Owner/Admin attestation                                    |
| IP range / internal net | Audited Owner/Admin attestation                                                    |

---

## Pack (installable catalog)

Not the default start. Default start is **Gitleaks-class secrets** (`jobsQueued=1`).
The list below is a second control.

Permissive SPDX only (MIT / Apache-2.0 / BSD-3-Clause / NPSL) plus first-party
checks. Load binaries from Engine Lab with **Install + enable Community pack**.

Secrets (Gitleaks, detect-secrets, …), SCA (Trivy, OSV, Grype, …), SAST
(Bandit, gosec, …), IaC (Checkov, Terrascan, KICS, …), SBOM (Syft, cdxgen),
containers (Dockle, Trivy, kube-bench), TLS/HTTP first-party + SSLyze, ZAP,
Nuclei **second mission**, Prowler on Connected AWS, YARA / Falco **rules lint**,
recon when a runner is enrolled.

**Not Community start:** GPL/LGPL (Semgrep, testssl, Nikto, …) → Engine Lab +
license accept. Atomic, Caldera, SharpHound and Metasploit are planned BAS
adapters; current catalog/import status does not make them executable. sqlmap
is not available for live validation.

---

## Safety floor

- Only **verified, customer-authorized** scope
- Denied tasks **never** queue
- **Fixed** requires a verification event
- No destructive tests, exfil, credential theft, or persistence
- BAS adapters become executable only after implementation, scenario review,
  policy, licensing, cleanup and lab qualification gates pass
- Runner transport is **outbound HTTPS signed-task polling**

[`SECURITY_BOUNDARIES.md`](./SECURITY_BOUNDARIES.md) ·
[`SECURITY.md`](./SECURITY.md) · [`docs/SETTLED.md`](./docs/SETTLED.md)

## CTEM in Periscan

In this product, CTEM is a **proof layer on authorized scope**
(Scope → Discover → Prioritize → Validate → Mobilize → Verify). That loop maps
to operator **Authorize → Verify**. It is **not** a Microsoft CTEM replacement.
Periscan has a full BAS/AEV development program. Scenario execution requires
qualified adapters and measured evidence.

Community start is still **Gitleaks-class secrets** (`jobsQueued=1`) on an
authorized local path. Keep proving after that run. **Live Atomic** requires a qualified adapter before execution. Hosted product and MSSP
portfolio are commercial.

## Honest language

| Say                                              | Do not say                                         |
| ------------------------------------------------ | -------------------------------------------------- |
| Authorized local path + Gitleaks-class default start | Claim full BAS delivery from the current Community start |
| Fixed only after re-validation                   | Mark Fixed from ticket sync                        |
| Measured exposure validation with evidence       | Automated pentest / autonomous red team            |
| Co-exist with CNAPP (Wiz) and RBVM (Tenable)     | Replace your CNAPP / replace Tenable               |
| Apache-2.0 Community validation slice            | We are open source now                             |

CTEM program views are commercial / later — not Community start.

Contract: `CLAIM_LANGUAGE_CATALOG` in `packages/shared/src/claim-deny-list.ts`.

---

## Rails

Short map. Not a README fold. Not a LICENSE flip.

| Want | File |
| --- | --- |
| Community vs commercial (CISO / admin) | [`docs/ENTERPRISE.md`](./docs/ENTERPRISE.md) |
| FAQ | [`docs/FAQ.md`](./docs/FAQ.md) |
| How to use it | [`docs/USING.md`](./docs/USING.md) |
| Install / start / update | [`scripts/periscan.sh`](./scripts/periscan.sh) (`install`, `start`, `update`, `down`) |
| Terminal operator TUI | [`docs/TUI.md`](./docs/TUI.md) (`pnpm tui`, `PERISCAN_API_URL`) |
| First adapter PR | [`docs/ADAPTER_FIRST_PR.md`](./docs/ADAPTER_FIRST_PR.md) |
| Measured mark (not certified) | [`docs/BADGES.md`](./docs/BADGES.md) |
