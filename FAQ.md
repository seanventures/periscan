# FAQ

Short answers. Claim contract: `CLAIM_LANGUAGE_CATALOG` in
`packages/shared/src/claim-deny-list.ts`. Ledger: [`docs/SETTLED.md`](docs/SETTLED.md).

## Is Periscan open source?

Source is **Apache-2.0**. Community edition is the open-core **validation slice**
(authorized scope + policy + permissive engines + evidence). That is not
OSI-theater and not a promise of full BAS or live offensive packs. Third-party
engines keep their own SPDX.

## Who is this for?

AppSec, platform, and security engineers who **own** the target or are
**contracted to test** it.

## Who is this not for?

Anyone without authorization. It is not a Nuclei wrapper, not a Wiz / Tenable
replacement, not full multi-vector BAS, and not live Atomic / Caldera /
Metasploit / sqlmap.

## Can I authorize `github.com/org/repo`?

No. Hosted GitHub URLs are not a control-plane path. `git clone <your-repo>`
on the machine running Periscan, then paste the **absolute path**. Prove
authorization with `.periscan-authorization` (or Owner/Admin attestation when
the path is runner-only).

## What is the first hour?

On a verified **local clone path**, first hour is **Gitleaks-class secrets**
(`jobsQueued=1`). Not the full Community pack. Need **Node 24** and **Docker**.
`git clone <your-repo>` on the machine running Periscan, then paste the
**absolute path**.

## How do I install?

Need **Node 24** ([`.nvmrc`](.nvmrc)) and **Docker**. Clone this repo, inspect
it, then install:

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
bash scripts/periscan.sh install
bash scripts/periscan.sh start
```

Secondary one-paste (inspect `install.sh` first):

```bash
curl -fsSL --proto '=https' --tlsv1.2 https://raw.githubusercontent.com/seanventures/periscan/main/install.sh | bash
```

## When is a finding Fixed?

Only after a **measured retest** (`verifiedAt`, `verifiedBy`,
`verificationEvidenceId`). Opening a remediation or closing a ticket is
`ClosedWithoutEvidence`, not Fixed.

## Does this replace my scanners / CNAPP / RBVM?

No. Trivy, Nuclei, Gitleaks, and peers **find**. Periscan **proves** on
authorized scope and re-proves fixes. Co-exist with Wiz-class CNAPP and
Tenable-class RBVM.

## Will Community start run Semgrep or Atomic?

No. First hour is **Gitleaks-class secrets** (`jobsQueued=1`). The full pack is
a second control (permissive SPDX + first-party checks). GPL / LGPL engines
are Engine Lab + license accept. Atomic / Caldera / SharpHound / sqlmap /
Metasploit stay catalog theater.

## Is a queued run “measured”?

No. A job in flight is Watch. **Measured** means a completed authorized
Community run produced evidence. This repository’s README badge stays
**not-measured** until that exists here. See [`docs/BADGES.md`](docs/BADGES.md).

## Where do I file issues?

[seanventures/periscan](https://github.com/seanventures/periscan/issues).
Security: title-only `[SECURITY]` issue — [`SECURITY.md`](SECURITY.md).

Longer operator FAQ: [`docs/FAQ.md`](docs/FAQ.md). How to run the loop: [`USING.md`](USING.md) and [`docs/USING.md`](docs/USING.md).
