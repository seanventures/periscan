# Settled decisions

Append-only. Closed questions are axioms, not priors to re-weigh.
Format: CLAIM / NOT / TELL.

These exist so agents cannot re-derive them after a handoff. Mechanical
gates (analyst-score-gate, `pnpm settled:check`, claim-deny-list tests,
security-boundaries, fix-verification) are the enforcement. This file is the ledger.

---

- CLAIM: Shippable GA is open-core-ready packaging + a working authorized
  proof loop + honest claim language + house-method UX evidence. It is
  **not** analyst 95, Magic Quadrant, or Forrester Wave progress.
  (settled 2026-08-14, Plane PERISCAN-490, residual inventory 2026-08-03)
  NOT: “we are at 95 / Leaders / Wave ready because the scorecard moved.”
  TELL: `95+` / `MQ` / `Wave progress` / invent panel mean `5.0` as a ship
  gate → STOP. Internal index ceiling without partners/inject/market is
  mid-high 70s to low 80s.

- CLAIM: **Fixed** requires a measured verification event.
  (`packages/shared` fix-verification; ticket close is ClosedWithoutEvidence.)
  (settled 2026-07, proven by find-fix-verify-closed-loop + anti-fab tests)
  NOT: mark Fixed from ticket sync, operator toggle, or severity.
  TELL: `mark Fixed` / `status = Fixed` without verify → STOP.

- CLAIM: Path words **validated / measured / reachable / exploitable /
  proven** come from weakest-hop evidence, never from risk band.
  (settled 2026-07-16 Slice 1, claim-language + claim-deny-list)
  NOT: “Validated high-impact path” from Critical severity alone.
  TELL: claim language derived from severity/risk only → STOP.

- CLAIM: Live Atomic, Caldera, SharpHound, ransomware, and uncontrolled
  exploit chaining stay **off** without a separate legal SOW.
  (settled in SECURITY_BOUNDARIES.md + AGENTS.md)
  NOT: enable live offensive packs to “complete BAS” or raise a score.
  TELL: `enable Atomic` / `live Caldera` / `inject-on SCV` without SOW
  (Plane 460) → STOP.

- CLAIM: Public Community source is **Apache-2.0** (founder decision
  2026-08-30, PERISCAN-529). Canonical public repo is `seanventures/periscan`. The goldeneye `seanheiney/periscan` tree stays
  **private forever**. Hosted SaaS / MSSP / marketplace remain commercial
  product, not a second LICENSE file in this repo.
  NOT: claim full BAS, live offensive, or that private goldeneye files
  were published. NOT: re-proprietary the public snapshot without counsel.
  TELL: enable live Atomic/Caldera/SharpHound without SOW → still STOP.

- CLAIM: Standardized catalog connectors without live vendor behavior are
  Planned / NotConnectable. Do not offer Configure.
  (settled 2026-07-16)
  NOT: make a stub connectable to look complete.
  TELL: `ReadyForCredentials` on StandardizedCatalog → STOP.

- CLAIM: Runner transport is outbound HTTPS signed-task polling.
  NOT: inbound management plane / reverse SSH as the default.
  TELL: “open inbound runner port” / replace poll with SSH → STOP.

- CLAIM: Zero public customer references. Do not fabricate names, logos,
  ARR, or Production connector certification.
  (Plane 431 / 374 / 183 / 126 remain open on purpose)
  NOT: close those issues from code or a demo tenant.
  TELL: invented ref / “Production certified” without live keys → STOP.

- CLAIM: House UX validation uses ICP-grounded reviewers, not celebrity
  personas. Do not fix until Layer 1–3 evidence exists for that slice.
  (ux-validation skill; 2026-07-29 celebrity panel is retired method)
  NOT: Jobs/Horowitz/Einstein scorecards as evidence.
  TELL: celebrity persona panel as a gate → STOP; use house funnel.

- CLAIM: Community edition is the open-core *validation slice* (authorized
  scope + policy + safe OSS/first-party engines + evidence). It is not a
  LICENSE flip and not full-BAS. Default start omits ExternalPoA Nuclei so a
  first Domain run is not blocked by the PoA kill switch.
  (settled 2026-08-15, Plane PERISCAN-500)
  NOT: “we are open source” / include live Atomic in Community.
  TELL: rewrite LICENSE or ship Community as live-offensive kit → STOP.

- CLAIM: Default Community pack is **permissive SPDX only** (MIT / Apache-2.0 /
  BSD-3-Clause / NPSL) plus first-party checks. Popular blue-team and safe
  red-adjacent engines (detect-secrets, Bandit, gosec, Checkov, Terrascan,
  KICS, kube-linter, kube-bench, YARA, Falco *rules lint*, Amass passive,
  SSLyze, naabu, …) start from Validate. GPL/LGPL/AGPL (Semgrep, testssl,
  Nikto, WhatWeb, ScoutSuite, TruffleHog, osquery, Wazuh) stay Engine Lab +
  license accept. Live Atomic/Caldera/SharpHound/sqlmap/Metasploit/ffuf stay
  catalog theater. FixtureMode must not invent findings.
  (settled 2026-08-15, Plane PERISCAN-522)
  NOT: ship GPL into the default start / enable live BAS to “complete the pack”.
  TELL: Semgrep or Atomic on the Community start button → STOP.

- CLAIM: Community non-DNS scopes verify without `devModeManual`: Repository
  via `.periscan-authorization` token file (or Owner/Admin attestation when
  the path is runner-only), CloudAccount via Connected AWS account match or
  Owner/Admin attestation, IPRange/InternalNetwork via audited Owner/Admin
  attestation. Domain/Subdomain stay DNS TXT.
  (settled 2026-08-15, Plane PERISCAN-506)
  NOT: skip DNS for domains / silent auto-verify of CIDRs.
  TELL: “repo/Prowler/nmap need lab-only verify” → STOP.

- CLAIM: Community policy preview matches the *primary* start set. Runner-lane
  engines preview InternalRunner; Nuclei stays a second mission and does not
  make the primary preview ExternalPoA. A ControlPlane decision cannot start
  InternalRunner modules (`community_environment_mismatch`).
  (settled 2026-08-15, Plane PERISCAN-508)
  NOT: always preview ControlPlane / requireInternalRunner false.
  TELL: queue runner modules under a ControlPlane ticket → STOP.

- CLAIM: ValidationSnapshot schedules stay snapshot-only unless
  `config.communityValidation === true`, which calls `startCommunityValidation`
  per verified scope. Denied / empty-suite starts do not fall back to a report.
  (settled 2026-08-15, Plane PERISCAN-509)
  NOT: every schedule starts engines / silent change of existing schedules.
  TELL: “schedules already run Community” without the flag → STOP.

- CLAIM: Findings for a Community mission are those whose `evidenceIds`
  intersect that mission’s run evidence. No evidence → empty list, not theater.
  (settled 2026-08-15, Plane PERISCAN-512)
  NOT: invent missionId on derived findings / show the tenant-wide queue as “this pack”.
  TELL: `/findings` without missionId as “these Community results” → STOP.

- CLAIM: `prowler.aws_posture` uses stored Connected AWS integration
  credentials at execution time. Secrets are not written onto `validationRun.target`.
  (settled 2026-08-15, Plane PERISCAN-513)
  NOT: Prowler always uses the worker process env / fixture when an integration is attached.
  TELL: persist AWS keys on the target JSON → STOP.

- CLAIM: `MeasuredResult` stays a completed run with evidence. An in-flight
  Community mission changes the first-run CTA to Watch, not to a fake measured state.
  A finished Community run without evidence is Review, not another Start.
  (settled 2026-08-15, Plane PERISCAN-516 / 519)
  NOT: mark first proof done because a Community job queued.
  TELL: MeasuredResult from start-only → STOP.

- CLAIM: Nuclei skip is reconstructable from the second-mission DeniedByPolicy
  run errorSummary (or the canned PoA deny). Companion GET does not invent skip.
  (settled 2026-08-15, Plane PERISCAN-517)
  NOT: silent Nuclei absence after a recorded deny.
  TELL: companion skip always null after a deny run exists → STOP.

- CLAIM: Origin `main` last commit is lab Phase 1 scaffold (`7107afdb`).
  Slice E/F, lab demo site, hybrid plant, UI de-slop, OSS plan, and
  2026-08-03 QA memos live in the **uncommitted working tree** until a
  real SHA exists. (settled 2026-08-14, git status)
  NOT: “shipped on main” for those artifacts.
  TELL: cite Slice F as committed/released without a SHA → STOP.

- CLAIM: Copyleft (GPL/LGPL) engines are tenant-opt-in via Engine Lab license
  accept + official-upstream download. Periscan does not redistribute them
  and does not invent image digests. After accept, install may proceed
  without a catalog digest (`integrity_pin_absent_user_accepted`). Live
  Semgrep/testssl/Nikto/WhatWeb/ScoutSuite may run only when the mission
  target lists that tool in `upstreamLicenseAcceptedToolIds`. sqlmap /
  SharpHound / Atomic / Caldera / Metasploit stay blocked.
  (settled 2026-08-15, Plane PERISCAN-523)
  NOT: bake GPL into the default image / skip the accept checkbox / lift
  offensive tools because they are also GPL.
  TELL: “Community now includes Semgrep by default” or “accept license
  enables sqlmap” → STOP.

- CLAIM: Engine Lab is the install/uninstall package manager for 100+ OSS
  security tools grouped by pack. Permissive SPDX tools are auto-listed and
  one-click installable. Copyleft tools are click-installable only after
  SPDX accept. Theater (Atomic/Caldera/SharpHound/sqlmap/Metasploit) is
  never Community-start and is not installable as validation.
  (settled 2026-08-15, Plane PERISCAN-524)
  NOT: ship 100 live-offensive scanners / invent 100 licenses.
  TELL: “Community start now runs sqlmap because it is in the catalog” → STOP.

- CLAIM: Runner task results are fail-closed on provenance. Missing/invalid
  result signature or `localAuditSha256` mismatch is **403** and the result is
  never accepted. Unsigned or unbound hashes never reach evidence ingestion.
  Inline unverified evidence (no prior redacting upload) is **400**
  `runner_evidence_not_uploaded` only after a valid signed audit hash.
  (settled 2026-09-02, `submitRunnerTaskResult` + security-boundaries)
  NOT: reorder result submit to return 400 for unsigned/dummy-hash inline
  evidence; unsigned results are not a mere evidence-shape error.
  TELL: expect `400 runner_evidence_not_uploaded` on an unsigned or
  hash-mismatched result → STOP; 403 first.

- CLAIM: First clean / honest fix-verification may be **Inconclusive**.
  `Fixed` still requires a measured originating retest. Compare-only,
  heuristic-path disappearance, and tool-absent hosts stay Inconclusive.
  (settled 2026-09-14, Plane PERISCAN-571 / PERISCAN-580)
  NOT: stamp RemediationTask or VerificationEvent Fixed to make the
  API-first proof loop look closed.
  TELL: `expect(["Fixed", "StillExposed"])` without Inconclusive, or
  mint fake Fixed on first clean → STOP.
