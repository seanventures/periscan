# Settled decisions

Current product decisions.
Format: CLAIM / NOT / TELL.

These exist so agents cannot re-derive them after a handoff. Mechanical
gates (analyst-score-gate, `pnpm settled:check`, claim-deny-list tests,
security-boundaries, fix-verification) are the enforcement. This file is the ledger.

---

- CLAIM: Operator-facing product identity is an always-on proof board
  (authorize local path, Gitleaks-class default start, review, re-verify
  until Fixed, schedules). “First hour” is not the product. Gitleaks
  remains Community default start (`jobsQueued=1`).
  (settled 2026-09-21, operator correction)
  NOT: a 15-minute first-hour demo as the thing you ship.
  TELL: operator-facing “first hour” as the product job → STOP; say
  Community start / keep proving / the board. Do not change the Gitleaks
  default start to the full pack or Prowler.

- CLAIM: Shippable GA is open-core-ready packaging + a working authorized
  proof loop + honest claim language + house-method UX evidence. It is
  **not** analyst 95, Magic Quadrant, or Forrester Wave progress.
  (settled 2026-08-14, Plane PERISCAN-490, residual inventory 2026-08-03)
  NOT: “we are at 95 / Leaders / Wave ready because the scorecard moved.”
  TELL: `95+` / `MQ` / `Wave progress` / invent panel mean `5.0` as a ship
  gate → STOP. Internal index ceiling without partners/inject/market is
  mid-high 70s to low 80s.

- CLAIM: T1486, unscoped spray, credential harvest, kill-chain
  impact, persistence, and unrestricted Metasploit PAYLOAD live in a
  **High-danger** catalog section (extra acknowledgement +
  qualification + tenant authorization). They are not Community
  first-hour and not unmarked Validate.
  (settled 2026-09-17)
  NOT: hide them as forever Forbidden; NOT: present them as Gitleaks
  first-hour.
  TELL: `forever Forbidden` hiding T1486/spray/harvest/persistence/PAYLOAD → STOP.
  TELL: unmarked Community ransomware/spray/payload → STOP.

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


- CLAIM: Public Community source is **Apache-2.0** (founder decision
  2026-08-30, PERISCAN-529). Canonical public repo is `seanventures/periscan`. The goldeneye `seanheiney/periscan` tree stays
  **private forever**. Hosted SaaS / MSSP / marketplace remain commercial
  product, not a second LICENSE file in this repo.
  NOT: claim private goldeneye files were published or re-proprietary the
  public snapshot without counsel.
  TELL: assert publication without checking the public release → STOP.

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

- CLAIM: “Do not print 4.0 / 5.0” and “Cloud stays 3 while first hour is
  Gitleaks” are **scoreboard honesty** rules only. They are not a work
  freeze. Captain fires must still spawn implementers on remaining **code**
  punchlist items (optional Cloud path when AWS is connected without
  replacing Gitleaks as the first-hour door, remaining a11y, qualified pack
  start, mission-complete-on-evidence, campaign DAG UI, High-danger planner
  alignment, TUI/API coverage). Idle fires that skip spawning because the
  published mean is not 4.0 are a loop bug.
  (settled 2026-09-18, user correction after captain fires 21–29)
  NOT: treat Cloud-3 or “do not print 4.0” as “nothing left to ship.”
  TELL: `Did **not** spawn` / `No unfinished implementers` used as a hold
  while remaining code punchlist exists → STOP; spawn remaining code.
  Scoreboard still must not invent 4.0/5.0 or average Cloud to 4.

- CLAIM: Community edition is the open-core *validation slice* (authorized
  scope + policy + safe OSS/first-party engines + evidence). It is not a
  LICENSE flip. BAS expansion follows qualified adapters and edition policy. Default start omits ExternalPoA Nuclei so a
  first Domain run is not blocked by the PoA kill switch.
  (settled 2026-08-15, Plane PERISCAN-500)
  NOT: claim a license change or qualified runtime without release evidence.
  TELL: bypass scenario qualification to expand Community → STOP.

- CLAIM: Default Community pack is **permissive SPDX only** (MIT / Apache-2.0 /
  BSD-3-Clause / NPSL) plus first-party checks. Popular blue-team and safe
  red-adjacent engines (detect-secrets, Bandit, gosec, Checkov, Terrascan,
  KICS, kube-linter, kube-bench, YARA, Falco *rules lint*, Amass passive,
  SSLyze, naabu, …) start from Validate. GPL/LGPL/AGPL (Semgrep, testssl,
  Nikto, WhatWeb, ScoutSuite, TruffleHog, osquery, Wazuh) stay Engine Lab +
  license accept. BAS adapters require scenario and runtime qualification.
  FixtureMode must not invent findings.
  (settled 2026-08-15, Plane PERISCAN-522)
  NOT: ship an engine into the default pack without license and runtime review.
  TELL: start unqualified scenarios from Community → STOP.

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
  target lists that tool in `upstreamLicenseAcceptedToolIds`. BAS adapters need
  both license disposition and scenario qualification.
  (settled 2026-08-15, Plane PERISCAN-523)
  NOT: bake GPL into the default image / skip the accept checkbox / lift
  offensive tools because they are also GPL.
  TELL: “Community now includes Semgrep by default” or “accept license
  enables sqlmap” → STOP.

- CLAIM: Engine Lab is the install/uninstall package manager for 100+ OSS
  security tools grouped by pack. Permissive SPDX tools are auto-listed and
  one-click installable. Copyleft tools are click-installable only after
  SPDX accept. Catalog membership does not authorize execution: only qualified
  adapters and scenarios may enter the Community start pack.
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

## BAS / AEV product direction (PERISCAN-583)

- CLAIM: Full BAS/AEV is an authorized product objective. Build qualified Atomic,
  Caldera, SharpHound/BloodHound and Metasploit integrations plus complementary
  OSS engines under [BAS_AEV_PROGRAM.md](BAS_AEV_PROGRAM.md).
  NOT: library availability or fixture results prove working execution.
  TELL: enable an unimplemented adapter, bypass tenant scope/policy, or claim
  measured outcomes without receipts → STOP. Qualify scenarios with pinned
  content, bounded execution, cleanup, cancellation and real lab evidence.

- CLAIM: Customer execution requires a qualified adapter and scenario-specific
  authorization under [BAS_EXECUTION_AUTHORIZATION.md](competitive/BAS_EXECUTION_AUTHORIZATION.md).
  The current module-level `PERISCAN_LIVE_OFFENSIVE` / `sowId` preflight is not
  an execution implementation. The policy service still denies unqualified live
  packs before queueing, even when that preflight passes.
  NOT: a flag, license acceptance or signed agreement proves runtime readiness.
  TELL: claim a qualified runtime without adapter tests, cleanup/cancellation
  evidence and measured receipts → STOP. Continue development under PERISCAN-583.

- CLAIM: `identity.cred_spray` is startable only as an owned-account
  password-policy test against verified-scope owned identities. Internet spray
  stays Forbidden forever. Unscoped spray, credential harvest, persistence, and
  unrestricted Metasploit PAYLOAD are High-danger kill-chain pins (extra
  acknowledgement + qualification + tenant authorization), not forever-Forbidden
  hide. Stolen credentials are never persisted. Starts are rate-limited and
  require an audit/policy event. The kill-chain engine is startable only as a
  DAG of already-qualified non-Forbidden pins plus High-danger catalog pins
  after the extra-ack triad. T1486 and remaining High-danger catalog pins are
  not forever-Forbidden hide; ransomware planner remains `measured: false`.
  NOT: internet spray, live ransomware, live APT kill-chain execution, or
  Community first-hour spray/harvest/persistence/PAYLOAD.
  `PERISCAN_LIVE_OFFENSIVE=1` does not unlock spray, harvest, persistence,
  PAYLOAD, or T1486. NOT: re-derive kill-chain T1486/spray/harvest/persistence/
  PAYLOAD as forever-Forbidden — High-danger extra acknowledgement is the path.
  TELL: enable internet spray / hide T1486/spray/harvest/persistence/PAYLOAD as
  forever Forbidden / claim ransomware measured → STOP.

- CLAIM: Connected Entra, Okta, and JumpCloud inventory is CAASM candidates
  (user, group, app records with source + externalId). Sync does not auto-add
  identities to verified scope and does not enable live spray. Promote-to-scope
  is required before identity abuse modules. Unscoped spray stays High-danger.
  NOT: auto-scope from IdP sync, directory-wide spray, or inbound SCIM
  provisioning.
  TELL: treat IdP inventory as verified scope or start spray from unpromoted
  candidates → STOP.
