# Export Control and Authorized Use

Periscan bundles a full offensive security toolkit (recon, web-app testing,
identity/AD, cloud, adversary emulation, and exploitation tooling) inside two
tool-bearing container images. That capability is real. This notice states the
legal and authorized-use posture for shipping and operating it. It complements
the open-source license obligations in `licenses/THIRD_PARTY_NOTICES.md` and the
operational safety procedure in `docs/OFFENSIVE_KIT_LIVE_SMOKE.md`.

## 1. Authorized use only

Periscan's offensive capabilities are intended **exclusively** for authorized
security testing — testing systems you own or for which you hold explicit,
documented authorization (a signed engagement / rules-of-engagement). Running
recon, scanning, credential spraying, exploitation, or adversary emulation
against systems without authorization is illegal in most jurisdictions
(e.g. the US Computer Fraud and Abuse Act and equivalents elsewhere).

The platform enforces this technically — it does not rely on operator goodwill:

- Offensive/high-impact modules execute **only** against a Periscan Scope with
  `verificationStatus: "Verified"`, with explicit operator approval
  (`authorizedOffensive: true` + an `approvalId`), and with an explicit live
  opt-in. Any missing precondition results in a **denied + audited** action that
  is never queued. See `evaluateModuleStartConstraints` /
  `requireGovernedOffensiveAuthorization` in `packages/modules/src/index.ts`.
- The in-network runner-agent never makes authorization decisions; it executes
  only control-plane-signed task envelopes and enforces a per-task scope egress
  allowlist (default-deny) plus a kill switch.
- Every governed decision (allow or deny) writes an audit event.

Operators remain responsible for holding valid authorization for every target.
The technical rails reduce accidental misuse; they are not a substitute for
lawful authorization.

## 2. GPL / restricted-license conveyance

Catalog tools marked `RequiresLegalReview` remain API-visible but are **not**
enabled, and the **default** scan-executor image does **not** redistribute their
binaries:

- **SharpHound** — GPL-3.0 (`RequiresLegalReview`); collector blocked; not baked
  into default images.
- **testssl.sh**, **sqlmap**, **nikto** — GPL-2.0 (`RequiresLegalReview`); absent
  from default `scan-executor` `runtime` stage; fixture/import or dry-run only in
  product.
- **whatweb** — GPL-3.0 (`RequiresLegalReview`); same as above.
- **ScoutSuite** — GPL-2.0 (`RequiresLegalReview`); same as above.
- **nmap** — Nmap Public Source License (NPSL), a modified GPL with
  redistribution conditions (`RequiresLegalReview`-grade; not a standard OSI
  permissive license). Present in the runner-agent image for in-network recon;
  honor NPSL obligations when redistributing that image.

Distributing GPL/LGPL tools in an image triggers source-availability and
written-offer obligations. For any tool whose source is conveyed as a binary in
a shipped image, accompany the distribution with either the corresponding source
or a written offer to provide it, per the tool's license. Periscan's own module
wrappers invoke these tools as separate executables (exec boundary) and are
licensed `Proprietary`; the GPL obligation attaches to the conveyed tool, not to
Periscan's wrapper code.

**Optional lab stage:** `runtime-legal-review` on
`infra/docker/scan-executor.Dockerfile` intentionally installs the
testssl/sqlmap/nikto/whatweb/ScoutSuite set for Engine Lab or controlled lab use
only. Do not tag that stage as production SaaS `latest`/`v*`. If you distribute
it, complete conveyance obligations. Preferred long-term path is Engine Lab
accept → upstream install → verify (no silent SaaS redistribution). See
`docs/DEPLOY.md` "Legal-review tools (Engine Lab opt-in)".

CI enforces this posture: `pnpm licenses:check` fails if a GPL/LGPL tool is not
marked `RequiresLegalReview`, if a module wrapper claims a GPL license, or if the
generated notices are stale. The scan-executor smoke script fails if legal-review
GPL binaries are present when `PERISCAN_INCLUDE_LEGAL_REVIEW_TOOLS` is not `1`.

## 3. Export control

Offensive/intrusion software can be subject to export-control regimes (e.g. the
Wassenaar Arrangement "intrusion software" controls, and national
implementations such as the US EAR). Before distributing the tool-bearing images
across borders or to third parties, obtain export-control review for your
jurisdiction and intended recipients. Periscan provides the capability; export
compliance for a given distribution is the distributor's responsibility.

## 4. Operator obligations checklist

- Hold written authorization (rules of engagement) for every target before any
  active/offensive step.
- Verify the Periscan Scope and obtain operator approval before offensive
  modules will run; rely on the audit trail, not memory.
- Run against scratch/non-production environments unless production is
  separately authorized in writing.
- Comply with the GPL/NPSL source-availability obligations when redistributing
  the images.
- Obtain export-control review before cross-border or third-party distribution.

This notice is informational and not legal advice. Consult counsel for your
specific distribution and engagement circumstances.
