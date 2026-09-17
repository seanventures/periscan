# Periscan — Analyst Capability Matrix (WS5 / WS7)

Honest, evidence-linked scorecard mapping Periscan's *actually implemented* features
against three analyst rubrics: **Gartner Adversarial Exposure Validation (AEV) + CTEM**,
**Forrester (exposure management / BAS)**, and the **Periscan PRD**
(`PRD.md`, `docs/PERISCAN_FULL_PRODUCT_PRD.md`).

Scope of grounding: this matrix was built by reading the real codebase, not the status
docs. Primary sources inspected:
`apps/api/src/app.ts` (285-route control plane, tags counted below),
`apps/api/src/services/*.ts`, `apps/api/src/services/runner.ts`,
`apps/api/src/system-scheduler.ts`, `apps/runner-agent/src/*` (dispatch/verify/canonical),
`packages/modules/src/index.ts` (validation modules), `packages/evidence/src/*`
(storage integrity, risk scoring, attack graph), `packages/policy/src/*`,
`packages/reports/src/index.ts`, `packages/shared/src/domain.ts`, and
`packages/db/prisma/schema.prisma`.

## Status legend

- **Met** — implemented with a real measurement / real code path and durable state; not
  a fixture-only or heuristic-only stub.
- **Partial** — framework + durable state exist, but a load-bearing part is heuristic,
  fixture-defaulted, gated-off, or not yet proven end-to-end against a real target range.
- **Missing** — not implemented, or only aspirational/documentation.

The product's own gating invariant (from `docs/PRODUCTION_READINESS_PLAN.md`): *every
conclusion traces to a real measurement with a verifiable evidence chain, or is explicitly
labeled unmeasured/heuristic.* The codebase honors this with a first-class
`evidenceBasis: "Measured" | "Heuristic"` enum that **defaults to `Heuristic`**
(`packages/shared/src/domain.ts:1726,1738`) — a genuinely honest default.

---

## Rubric A — Gartner AEV + CTEM

CTEM stages: Scoping · Discovery · Prioritization · Validation · Mobilization · Verification.
AEV expectations: real attack-path validation, exploitability proof, control validation,
closed-loop remediation verification, continuous operation, safety/authorization, exec +
technical reporting.

| Rubric | Criterion | Status | Evidence (file/route refs) | Gap to reach "A" |
|---|---|---|---|---|
| CTEM | **Scoping** — verified scope required before validation | Met | `apps/api/src/services/scopes.ts` (`createScopeVerificationToken`, `buildVerificationMethod`, `verificationToken`); policy denies `UnverifiedScope`/`RequiresVerifiedScope` (`packages/policy/src/external-validation.ts:37,309`, `packages/policy/src/index.test.ts:55`); route tag `scopes` (8 routes). Scope-state enum incl. `Discovered` in schema. | None material. Optionally broaden verification methods (DNS/HTTP/file token all present) with UI polish. |
| CTEM | **Discovery** — enumerate assets / attack surface | Met | Real live discovery modules: `recon.host_discovery` runs live `nmap -sn` (`packages/modules/src/index.ts:7169-7239`, `runNmapGrepable`), plus `recon.service_inventory`, `recon.subdomain_enum`, `recon.http_probe`, `recon.dns_probe` (`packages/modules/src/toolchain.ts:1811-1945`), dispatched via `services/runner.ts:1916`. Posture auto-sweep runs `MEASURED_POSTURE_MODULE_IDS` against every verified scope (`services/scopes.ts:40-89`). `Asset` model (`schema.prisma:1086`) + EASM/CAASM graph nodes (`packages/evidence/src/graph.ts:1072-1117`). | Minor: the asset-graph *seed* helper is a stub (`graph.ts:1106` "Stub to seed discovery assets") though the underlying recon modules are real; fixture mode is dev-only. Wire the seed layer to recon output. |
| CTEM | **Prioritization** — explainable, context-aware ranking | Met | Real weighted multi-factor model `calculateRiskScore` (`packages/evidence/src/risk.ts:150`) with per-factor `factors[]` contributions (impact/exploitability/reachability/known-exploitation/threat-relevance/criticality/privilege/exposure/sensitive-data/control-response/remediation). `RiskScoreInputSchema` (`domain.ts:2082`) + `ValidatedFindingPriorityReasonSchema` {businessContext, controlEffectiveness, exploitability, pathContext, summary} (`domain.ts:2144`). | None material; transparency is real. Ensure inputs (exploitability/reachability) are `Measured` not defaulted for active findings. |
| CTEM/AEV | **Validation — passive/config (TLS/DNS/HTTP/email)** | Met | Native modules make real network calls: `node:tls connect`, `node:dns/promises`, `fetch` (`packages/modules/src/index.ts:4` and `:4287+`): `periscan.tls_certificate_check`, `tls_protocol_audit`, `dns_email_security_check`, `dns_resolution_check`, `dns_caa_check`, `http_health_check`, `http_cookie_security`, `http_redirect_enforcement`, `http_cors_audit`, `well_known_security_txt` — all `liveSupported: true`. | None — this is genuinely measured. |
| AEV | **Validation — active / in-network (runner-executed)** | Partial | Real infra: control-plane→runner **task** envelopes are Ed25519-signed + verified (`runner.ts:50,1175`; `apps/runner-agent/src/verify.ts:32`, canonical JSON `canonical.ts`), replay-nonce protection, real module dispatch (`apps/runner-agent/src/dispatch.ts:77`), measured signals stamped `sourceRunnerId` + projected to graph (`runner.ts:2426,2440`). Live adapters (`nuclei.external_exposure_safe`, `prowler.aws_posture`, `trivy.*`, `osv.*`, `gitleaks.repo_secrets`, `nmap`/`subfinder`) `liveSupported: true`. | Two gaps: (1) prove the loop end-to-end against a **real owned target range** (WS1); (2) **runner→server results are transport-authenticated (mTLS+bearer) but NOT cryptographically runner-signed** — `localAuditSha256` (`dispatch.ts:60`) is a self-hash the server does not verify (`runner.ts`). The "signed evidence" claim currently holds for task dispatch, not result provenance. Many offensive tools are fixture/dry-run-only by policy. |
| AEV | **Exploitability proof** (not just "vulnerable") | Partial | `ExploitabilityStateSchema`, `ObjectiveStateSchema`, validation states incl. `Exploitable` (`PRD.md:41`); `ValidatedFindingPathProof` {entryPoint, intermediateSteps, chokePoints, blastRadiusSummary, objectiveState} (`domain.ts:2152`). Attack-path verify flow is policy-gated (`AttackPathVerificationRequestSchema`, `domain.ts:2122`, status `RequiresApproval`). | Confirmed exploitability requires the active runner loop to actually reach the objective and earn `evidenceBasis=Measured`; today many paths default `Heuristic`. Gate = measured entry→objective against the range. |
| AEV | **Attack-path validation** — entry→objective, edges, choke points, blast radius | Met (model) / Partial (measured) | Full graph model: `AttackPathSchema`/`PathNode`/`PathEdge`/`PathBreaker` (`domain.ts:1708-1756`), `EvidenceGraph.createAttackPath` persists edges/nodes/basis (`packages/evidence/src/graph.ts:464,794`). UI `apps/web/app/attack-paths/[id]`. | Edges carry `evidenceBasis` but default `Heuristic`; earning `Measured` per-edge needs the active reachability probes (WS1). |
| AEV | **Control validation** — detection/blocking efficacy vs injected activity | Met (telemetry correlation) / Partial (injection loop) | Verdicts are derived from **live connector telemetry queried by MITRE technique_id**, not fixtures: CrowdStrike EDR queries `/detects/queries/detects/v1` filtered by `behaviors.technique_id` → empty=`Missed`, blocked-disposition=`Blocked` (`packages/connectors/src/index.ts:1257-1346`); Splunk SIEM live search → `Logged`/`NoEvidence` (`:587-666`); QRadar/Cortex/SentinelOne analogous. `control-ai.ts:737-819` maps `observeControl` → verdict; **`fixtureOutcome` rejected outside dev-mode** (`:673-679`). Coverage classifier refuses to promote "logged" to "detected" (`runtime-services.ts:1256-1330`). Route tag `control-sources` (49 routes). | Control-plane path is dry-run (queries telemetry without live injection); the closed **injection→telemetry→verdict** loop still requires an approved internal-runner mission (`control_live_execution_disabled` `:666`). |
| AEV | **Closed-loop fix verification** (re-run validation post-fix) | Met (honesty gate) / Partial (active) | Strong anti-fabrication gate: `buildVerificationResult` (`runtime-services.ts:7179-7264`) returns `Fixed` **only** when a real retest ran (`executedRealRetest`, the no-op compare module excluded `remediation.ts:1152-1181`) AND the prior path was `Measured` AND it no longer re-correlates; a Heuristic exposure disappearing stays `Inconclusive` (`:7224-7229`); re-correlation flips `Reopened`. `VerificationEvent` records `measuredRevalidation`/`retestMethod`/`exposureReCorrelated`; `nextVerificationAt` re-checks stale fixes (`remediation.ts:1393-1440`). Domain forbids analyst-asserted Fixed (`domain.ts:2171`). | Retest module selection is **keyword-family-based, not the literal original module set** (`packages/shared/src/fix-verification.ts:40-116`), so heuristic-only exposures resolve to `Inconclusive` rather than a measured "Fixed"; active exploit re-test rides on the (unproven) runner loop. |
| AEV/CTEM | **Continuous operation** (scheduled sweep, signal triggers) | Met | Real sweep `apps/api/src/system-scheduler.ts` ticks due integration-sync, fix re-verification, and mission schedules per tenant (idle-tenant skip, timeout guard); worker `apps/worker/src/processor.ts` + `retention.ts`. Signal triggers `apps/api/src/services/signal-triggers.ts` (`SIGNAL_TRIGGER_RULES`, routing). Route tags `schedules`(7), `signal-triggers`(6). | Sweep must be *run* by the platform (a scheduler process/cron is provided) rather than relying on an external cron per tenant; harden backpressure/poison-pill (WS2). |
| CTEM | **Mobilization** — route/ticket/track remediation | Met | `apps/api/src/services/remediation.ts` (12 routes tag `remediation`); `RemediationTicketSchema`, `CreateRemediationTicketInput` w/ `integrationId`, ticket sync (`domain.ts:1793-1806`); prescriptive planner `PrescriptivePlanSchema`/`MitigationStepSchema` (`domain.ts:1808-1825`). | None material; verify live ticketing connectors (Jira/ServiceNow) beyond fixtures. |
| AEV | **Safety / authorization controls** | Met | Policy engine `packages/policy/src/*`: `RequiresApproval`/`RequiresVerifiedScope`/`Denied` outcomes, expiry fail-closed, allowlisted-only Nuclei profiles, "no crawling beyond allowlisted paths" (`external-validation.ts:139,327,349`; `index.test.ts`). Runner signed-task + local allowlist + egress control (`apps/runner-agent/src/egress.ts`). Offensive/live paths gated off by default. | None material — this is a strength. Keep offensive kit disabled until API permits (per plan). |
| AEV | **Executive + technical reporting** | Met | `packages/reports/src/index.ts`: `ExecutiveRiskSummary` (no evidence appendix, `:161`, test `:489`), `TechnicalAppendix` (`:342`), `ControlValidationReport`, `FixVerificationReport`, `CTEMProgramSummary`, `AIAppValidationReport`, `RemediationClosurePack`, `MSSPClientQBR`, `ValidationSnapshotReport`, compliance attestations (DORA/SEC/GDPR/PCIDSS/EUAiAct). UI `apps/web/app/reports`, `/executive`. Route tag `reports`(8). | None material; verify remediation-velocity / change-over-time trends are populated from real history, not demo data. |
| AEV | **Evidence chain / chain-of-custody integrity** | Met | `packages/evidence/src/storage.ts`: SHA-256 recorded at write, recomputed at read, `integrityVerified` flag flags tampering (`:60,140-145,365`). `EvidenceLinkedSchema` cross-links all entities. Signed runner envelopes add provenance. | None material — genuine strength. |

---

## Rubric B — Forrester (exposure management / BAS lens)

| Rubric | Criterion | Status | Evidence (file/route refs) | Gap to reach "A" |
|---|---|---|---|---|
| Forrester | **Breach & Attack Simulation (BAS)** — safe control validation scenarios | Partial | `atomic.control_validation_safe` module + `ControlValidation` mission type (`control-ai.ts:311,824`); safe attack packs incl. OT/ICS (`reports/src/index.ts:443`). Guided first-run pass/fail summary is a PRD goal (`PRD.md:74`). | Live BAS execution is API-disabled/runner-gated; deliver the guided first-run "short control pass/fail + tuning" experience running against real telemetry. |
| Forrester | **Control efficacy measurement** | Met (telemetry) / Partial (injection) | Verdicts derived from **live EDR/SIEM telemetry** correlated by MITRE technique (`connectors/src/index.ts:1257-1346` CrowdStrike, `:587-666` Splunk); fixtures dev-only. `telemetryStatus` from real connector health. | Closed injection→telemetry loop is runner-gated (dry-run via control plane). |
| Forrester | **Detection-rule validation** (logged-but-not-alerted, stale/missing rules, tuning) | Met | `ControlRuleCoverageSummary` counts `blockedTechniques`/`loggedOnlyTechniques`/`missedTechniques` per MITRE technique from real observations (`runtime-services.ts:1364-1445`); classifier checks `/log/` before `/detect|alert/` so logged is never promoted to detection (`:1308-1326`). `NeedsTuning` subcategory (`modules/src/index.ts:1302`). UI renders "Logged only" vs "Covered" tiles (`controls-workbench.tsx:110-115`). | Confirm stale-rule detection from live SIEM rule state (vs. observation-derived) and auto-emitted tuning recs. |
| Forrester | **Attack-path analytics** | Met (model) / Partial (measured) | See CTEM attack-path row — full node/edge/choke-point/blast-radius model + risk assessment `assessAttackPathRisk` (`packages/risk/src/index.ts`), `countHighRiskAttackPaths`. | Measured edges (WS1). |
| Forrester | **Prioritization by real exploitability** | Met | `calculateRiskScore` weights `exploitability`, `reachability`, `knownExploitation`, `threatRelevance` with explicit factor contributions (`evidence/src/risk.ts:150-210`); `Fixed`/verified short-circuit to score 0. | Ensure exploitability inputs are measured, not defaulted `Unknown`, for active findings. |
| Forrester | **Unified validated-findings layer** (BAS/exposure/path/AI/fix share one model) | Met | Single evidence-backed findings model w/ source, evidence, impact, remediation, exploitability, lifecycle, priority rationale, cross-links (`domain.ts` `ValidatedFinding*` schemas; `PRD.md:73`); `apps/api/src/services/findings.ts`, route tag `findings`. | None material. |
| Forrester | **Threat-informed triggers / prioritization** | Met | Threat center + intel catalog services (`threat-center.ts`, `threat-intel-catalog.ts`, tags `threat-center`(11)/`threat-intel`(4)); `ThreatAdvisory`/`ThreatPackage` schemas (`domain.ts:1879+`); `threatRelevance` feeds risk score; CVE/asset-change/policy-change triggers (`PRD.md:79`). | Verify advisories drive automatic validation launches end-to-end. |

---

## Rubric C — Periscan PRD (`PRD.md`, `docs/PERISCAN_FULL_PRODUCT_PRD.md`)

| Rubric | Criterion | Status | Evidence (file/route refs) | Gap to reach "A" |
|---|---|---|---|---|
| PRD | **Validation Snapshot** (fixture-first first-run) | Met | `apps/api/src/services/snapshots.ts` (route tag `snapshots`), `packages/shared/src/demo-snapshot.ts`; UI `apps/web/app/snapshots/[id]`. | None material. |
| PRD | **Exposure Validation** | Met (passive) / Partial (active) | Native exposure modules + external `nuclei.external_exposure_safe`; `apps/api/src/services/validation.ts`. | Active/in-network exposure = WS1. |
| PRD | **Control Validation** | Met (telemetry) / Partial (injection) | Live EDR/SIEM telemetry correlation (see AEV/Forrester rows). | Closed injection→telemetry loop (runner). |
| PRD | **Attack-Path Validation** | Met (model) / Partial (measured) | Graph model + UI (see above). | Measured edges. |
| PRD | **AI App Validation** | Partial | `ai_app.safe_validation` module using `promptfoo`/`pyrit`/`garak` harnesses; `harness_report` = parsed real run, else fixture (`modules/src/index.ts:1762,1772,1785`); route tag `ai-applications`(6); UI `apps/web/app/ai-apps`. | Default path is fixture; prove real harness runs against a live AI endpoint (scope-gated). |
| PRD | **Fix Verification** | Partial | `remediation.ts` + `VerificationEvent` measured re-test (see AEV row). | Active measured re-test loop. |
| PRD | **Evidence Packs** | Met | `packages/evidence` + `packages/reports` pack builders; audience-targeted packs; integrity-verified artifacts; route tag `evidence`(5). | None material. |
| PRD | **Periscan Operators** (operator recommendations) | Met | `packages/operators`, prescriptive planner (`domain.ts:1808`), tag `operators`(3). | None material. |
| PRD | **Signal Fabric** (normalized signals + triggers) | Met | Normalized `Signal` model, `signalCategory/subcategory`, super-feed (`super-feed.ts`), signal triggers; runner projects measured signals. | None material. |
| PRD | **Internal Runner** (outbound signed-task, allowlists, scoped targets, evidence upload) | Met (mechanism) / Partial (proven E2E) | Signed Ed25519 **task** envelopes + runner-side verify/replay (`verify.ts:32`), egress/allowlist (`apps/runner-agent/src/egress.ts`), real module dispatch, evidence upload; server forces authenticated `tenantId` + mints fresh `signalId`s (`runner.ts:2392-2405`); route tag `runners`(20). | (1) Prove full measured loop vs real range (WS1). (2) Runner **results** authenticated by transport (mTLS+bearer) only — not runner-signed; add result signing to close the provenance chain. |
| PRD | **Third-Party Tool Governance Center** | Met | Extensive: intake/validate, candidates, readiness, review, work-orders, promotion-packages, upstream-version-checks, update-recommendations, runner-eligibility/dispatch, certifications (`services/third-party-tools.ts`, `packages/modules/src/tool-*.ts`; `PRD.md:82-110`). UI `apps/web/app/registries`. Disabled/legal-review tools cannot run. | None material — this is a deep, real surface. |
| PRD | **Every capability API-addressable** (UI replaceable, customer automation) | Met | 285-route control plane in `apps/api/src/app.ts` with OpenAPI; UI consumes the same API; API-keys (tag `api-keys`(4)) w/ scopes. | None material. |
| PRD | **Evidence-first, no fabrication** (measured vs heuristic labeled) | Met (invariant honored) / Partial (consolidated enforcement) | `evidenceBasis` defaults `Heuristic`; persistence **throws** rather than mint a placeholder asset (`runtime-services.ts:9307-9313`); Fixed impossible without measured retest; observer outcomes default to `NoEvidence` (`parse-observer-outcome.test.ts`); report layer renders explicit "N of M closures rest on heuristic" caveats (`reports/src/index.ts:740-766`). Property is enforced by several concrete tests. | No single test suite literally named/gated as "anti-fabrication" (WS1 gate) that asserts the invariant across *every* conclusion type. |
| PRD | **Multi-tenant / MSSP** | Met | `TenantScopedEntitySchema` on all entities; MSSP portfolio (`services/tenant.ts:953` `buildMSSPClientPortfolio`, `MSSP_ADMIN_ROLES`); UI `apps/web/app/mssp`, tag `tenant`(21). | Systematic cross-tenant isolation test matrix is WS3 (not yet proven for every route). |
| PRD | **SSO / enterprise auth** | Met | Real SAML + OIDC via `@node-saml/node-saml` (`services/sso.ts`); MFA (`mfa_repro.mts`), API-key lifecycle; UI `apps/web/app/admin`, `/account-security`, tag `auth`(15). | Deferred SSO config *form* UX polish (WS5 delta). |
| PRD | **Model Gateway / AI operators** | Met | `packages/model-gateway` (adapters, credentials, engine, tool-catalog); tag `model-gateway`(32); UI `apps/web/app/model-gateway`. | None material. |
| PRD | **Audit / activity history** | Met | Audit events across governance/runner/validation flows; tag `audit`(3); UI `apps/web/app/audit`; activity timelines per tool (`PRD.md:83`). | None material. |

---

## "A-grade musts" — what MUST be Met (with real measurement, not heuristic)

For an analyst to rate this an **A-grade AEV product**, these are the non-negotiables.
The product's whole claim is *"we measured it — here's the evidence,"* so anything that
resolves to heuristic/fixture/dry-run at the load-bearing moment cannot be an "A."

| # | A-grade must | Current status | Why it's a must |
|---|---|---|---|
| 1 | **Active, in-network validation runs against a real target and returns measured evidence** (not fixtures). | **Partial** | The entire AEV differentiator. Signed *task* dispatch, verify, real module execution, provenance-stamped signals are real; the end-to-end run against a real owned range is unproven (WS1 gate). |
| 2 | **Runner result provenance is cryptographically verifiable** (runner-signed, server-verified), not just transport-trusted. | **Partial** | Task envelopes are Ed25519-signed; runner→server results are mTLS+bearer authenticated only, `localAuditSha256` is an unverified self-hash. "Signed evidence" is not yet true for results — a real gap in the proof chain. |
| 3 | **Attack paths carry per-edge measured reachability/exploitability** (entry→objective confirmed), not `Heuristic` defaults. | **Partial** | 5 of 6 path families are honestly-labeled heuristic templates (`validationState: Discovered`); only DigitalOcean firewall paths are Measured, and cap at "Reachable" (never "Exploitable"). |
| 4 | **Control validation closes the loop**: derives verdicts from *injected* activity ↔ SIEM/EDR telemetry, not dry-run. | **Partial** | Verdict derivation from *real connected telemetry* is already Met (live CrowdStrike/Splunk queries); the missing half is live adversary-activity injection, which is runner-gated. |
| 5 | **Closed-loop fix verification flips "Fixed" only on measured absence of exposure.** | **Met (gate) / Partial (active)** | Honesty gate is genuinely strong and enforced (Heuristic exposures can't become Fixed; no analyst-asserted Fixed). Active exploit re-test rides on the (unproven) runner loop; retest is family-keyword not literal same-module. |
| 6 | **Consolidated anti-fabrication test gate** asserting no conclusion without a measured chain or explicit unmeasured label. | **Partial** | Property enforced by multiple concrete tests + honest defaults, but no single named CI gate covering every conclusion type (WS1). |
| 7 | **Exploitability proof surfaced to the analyst** (objective reached + blast radius), measured. | **Partial** | `ValidatedFindingPathProof` model is complete; depends on #1/#3 being measured. |

### Already-Met musts (real strengths to lead with)

- **Scoping before validation** (verified scope, policy-gated) — Met.
- **Passive/config validation is genuinely measured** (real TLS/DNS/HTTP/email probes) — Met.
- **Explainable prioritization** (transparent weighted risk model + priority-reason object) — Met.
- **Safety/authorization** (policy engine, allowlists, signed runner, fail-closed) — Met.
- **Exec + technical + compliance reporting** with evidence-appendix separation — Met.
- **Evidence chain-of-custody integrity** (SHA-256 verify-on-read) — Met.
- **Third-party tool governance** (deep, real intake→certify→dispatch lifecycle) — Met.
- **API-addressable everything** (285-route OpenAPI control plane) — Met.

### Known honest stubs to disclose (not "A" blockers, but flag them)

- Kill-switch state is a hardcoded safe default (`packages/policy/src/index.ts:416-424`, "Real impl would consult tenant+session state") — the state store isn't wired.
- Discovery asset-graph *seed* helper is a stub (`packages/evidence/src/graph.ts:1106`) even though the recon modules feeding it are real.
- Fix-verification retest module selection is keyword-family-based, not the literal original module set (`packages/shared/src/fix-verification.ts:40-116`).
- Several offensive tools (sqlmap, nikto, ScoutSuite, Metasploit, ffuf, testssl, kerbrute…) are fixture/dry-run-only by policy; their "Measured" labels are fixture-driven where a fixture supplies the outcome.

### Bottom line

Everything *except the active adversarial measurement loop and its result-provenance
chain* is at or near A — and it is more real than a first pass suggests: discovery
(live nmap/recon), control-efficacy verdicts (live EDR/SIEM telemetry), prioritization,
fix-verification honesty gates, scoping, scheduling, safety, and reporting are all
genuinely measured/enforced, and the codebase is unusually candid about labeling
inferred reach as `Heuristic`. The gating theme across the musts is the one the
production-readiness plan already identifies as WS1, plus one addition it should
absorb: **(a) make the active, in-network, runner-executed loop real and proven against
a target range; (b) add cryptographic signing of runner *results* (not just tasks) so
result provenance is verifiable end-to-end; and (c) lock both with a consolidated
anti-fabrication test gate.** The architecture, honesty scaffolding (`evidenceBasis`,
SHA-256 integrity, throw-don't-fabricate, "never fabricated" verification), and every
surrounding capability are already built to receive it.
