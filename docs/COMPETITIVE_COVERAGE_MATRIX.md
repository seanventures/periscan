# Periscan — Competitive Capability Coverage Matrix (honest, code-verified)

Date: 2026-07-05 (code audit baseline). **Honesty refresh: 2026-07-30**
(scorecard↔matrix alignment A8 — Leading export freeze, vCenter Partial note).
**Wave A stamp: 2026-07-29** (APV / multi-hop / choke remain **Partial** —
reports claim-safe path state; multi-hop Measure help present; no Fully-E2E
all-hops lab path proven for APV promotion).
This is a **ground-truth** audit of Periscan against the exhaustive ASV/CTEM
competitor feature set (Picus, Pentera, XM Cyber, Cymulate, RidgeBot, Tenable,
et al.). Every verdict was verified against real code — endpoints, modules
(`packages/modules/src/index.ts`), services (`apps/api/src/services`), the
schema (`packages/db/prisma/schema.prisma`), connectors (`packages/connectors`),
and tests — **not** marketing or comments.

Verdict legend:
- **Fully-E2E** — real working capability: endpoint + service + persistence +
  test, and it actually measures/does the thing.
- **Partial** — works but limited, heuristic, narrow, or read-only.
- **Scaffold** — types/models/handlers exist but not functional end-to-end
  (fixture-only, or live path disabled).
- **Missing** — not present.

Periscan's honesty convention is load-bearing here: the code explicitly labels
`evidenceBasis = Measured` vs `Heuristic`, and `liveSupported: false` /
fixture / dry-run states. The gaps below are **self-documented in the source**,
not hidden — that discipline is itself the core differentiator (see the honesty
note at the end).

**Category framing for GTM (not a capability claim):** Periscan’s market home is
**AEV/CTEM proof**, not full multi-vector BAS, CNAPP, or automated pentest.
External language and battlecards: [competitive/POSITIONING.md](competitive/POSITIONING.md).

## Scorecard

| Bucket | Count | Capabilities |
|---|---|---|
| **Fully-E2E** | 7 | Exposure Validation (EXV) risk scoring + trends; Automated Scheduling; Automated Revalidation (measured); Prescriptive Planner (advisory); Integration breadth (~106 clients); MSSP multi-tenancy; Exploitability-driven prioritization framework |
| **Partial** | 19 | ASV/EASM; APV; SCV; CSV; Threat library/MITRE; Agent+agentless exec; Virtual Analyst (LLM gateway); Find-Fix-Verify; ITSM/SOAR/IaC; Business-impact scoring; AI control validation; Unified data fabric; SSPM; Identity-centric; SSCS; Choke-point; Hybrid-network modeling; **VMware vCenter (read-only connector)**; **DNS-exfil detection canary class** (not bulk exfil) |
| **Scaffold** | 7 | Detection Rule Validation (DRV); AI-powered BAS; Dynamic attack paths; APT/autonomous pentest (peer); Auto-Mitigate (fix push); Compliance attestations; OT/ICS |
| **Missing** | 2 | phishing/email vector; malware vector (DNS-exfil **real bulk exfil** still Missing; **detection canary** is Partial — see multi-vector row) |

**2026-07-30 note:** `vmware-vcenter` read-only inventory connector + contract tests
exist in-repo (CustomerQualification for live vSphere). Formerly listed Missing;
honest label is **Partial**, never Fully-E2E / Leading until live customer
qualification and product path are demonstrated.

**Headline: Periscan is _not_ "all features fully E2E."** It has a genuinely
strong, honest **measured-validation + exposure/risk + MSSP + integration**
core, and a **simulation-only offensive/BAS surface** with several
competitor-headline features still scaffold or missing.

---

## The 6 validation pillars

| Capability | Verdict | What's real | Honest gap |
|---|---|---|---|
| **ASV / EASM** | Partial | Real recon modules that `execFile` real tools (subfinder/httpx/dnsx) via the signed runner; assets persisted; discover-task flow tested | Seeds from **user-declared verified scopes**, not autonomous discovery (no cert-transparency/whois pivot); runner + tool binary required; the "continuous living map / terrain" is a fixture stub (`graph.ts` `seedDiscoveryAssetsForASVEASM`, "change detection stub") |
| **APV** | Partial (**not Fully-E2E**) | Real `GraphNode/GraphEdge/AttackPath` model, real BFS `findPathsInDirectedGraph`, correlation engine that honestly labels heuristic vs measured; UI graph canvas + multi-hop Measure journey; hop edge receipts + claim-language gates (`deriveAttackPathClaim` / `projectPathValidationState`); HTML/PDF exports remap stale Validated→claim-safe when hops are not fully measured | Chaining is **mostly heuristic** pattern-correlation; only narrow measured paths (e.g. DO open port). **Do not promote to Fully-E2E** until ≥1 lab/customer path has **all hops Measured** end-to-end with receipts. Severity / risk band alone never validates a path. "Choke points" on paths are evidence-backed breakers (see choke row), **not** XM-class min-cut |
| **SCV** | Partial | `validateControlSource` → `connector.observeControl` pulls real EDR/SIEM telemetry, correlates by MITRE technique, persists health/coverage; tested E2E | **Closed inject→measure is hard-disabled on the control-plane API** (`control_live_execution_disabled`). Observers *pull* existing telemetry only; `atomic.control_validation_safe` is dry-run scenario import (`liveSupported:false`), not live inject BAS. Governed endpoint benign-marker is a limited safe stimulus path, not full BAS. |
| **DRV** | Partial (benign-marker class Fully-E2E; full ATT&CK library still Scaffold) | Sigma rule import → `ControlObservation`; OCSF mapping; technique coverage counting; **Wave B signed loop** `periscan.detection_marker_emit_observe` + `POST /api/v1/control-sources/:id/detection-marker-proof` chains allowlisted emit → mock/live SIEM observe into one evidence chain; macOS/Linux analytics share marker correlation | **Not full ATT&CK library BAS.** Closed loop is **benign marker class only** (allowlisted `periscan-*` process canary). Correlation-only probe remains for half-loops. Do not claim full detection-rule library inject-and-observe or Atomic live. |
| **CSV** | Partial | Real Prowler/Trivy `execFile` + JSON parse; live cloud config parsing (DigitalOcean firewall→internet-open, K8s LB/NodePort, AWS/Azure/GCP); DO measured fix-verification loop | **No measured E2E against a real/containerized cloud tenant** (DO test stubs `fetch`); the only truly measured loop is HTTP/TLS/DNS. ScoutSuite disabled; **no K8s CIS/kube-bench** |
| **EXV** | **Fully-E2E** | Real explainable, validation-aware, exploitability-driven `calculateRiskScore`; `ExecutiveMetricSnapshot` trend persistence; executive/fix trend endpoints + dashboards; tested | Only as "validation-aware" as upstream pillars — inputs are often heuristic today. The machinery itself is complete and honest |

## Advanced threat simulation & attack emulation

| Capability | Verdict | What's real | Honest gap |
|---|---|---|---|
| **AI-powered BAS** (multi-agent + conversational builder) | Scaffold | An LLM gateway exists (below) | `runAgenticSwarmLoop`/`planKillChain` are **in-memory fixtures** (`Math.random()`, canned steps, `simulated:true`); "conversational builder" = two UI buttons that pre-fill a prompt. No scenario is auto-generated to an executable artifact; nothing executes |
| **Threat library → MITRE** | Partial | Real CISA KEV feed fetch (SSRF-guarded), `ThreatAdvisory`/`ThreatIntelItem` with `techniqueIds`, cross-feed dedup + provenance | **One** real feed (CISA KEV); technique IDs are **regex-scraped from free text**; no curated technique→**scenario** library; advisories self-disclaim "not validation proof" |
| **Agent + agentless exec** (+ web-app sim, autonomous pentest) | Partial | Go runner (9 passive probes, no shell/exec by design) + TS runner-agent (allowlist-gated); agentless control-plane HTTP/TLS/DNS + safe OSS scanners | Only **passive/non-invasive** checks run. `web.zap_baseline` is the only live web module (baseline, not attack); sqli/nikto/fingerprint are `liveSupported:false`; no autonomous pentest |
| **Multi-vector** (malware/email/identity/**DNS exfil**) | Partial (DNS canary class); Missing (malware/phishing) | **DNS-exfil detection canary** `periscan.dns_exfil_canary` + product path `POST …/dns-exfil-canary-proof` (allowlisted label only; `realDataExfiltrated:false`; measured only with emit + liveTelemetry). Identity modules exist as dry-run/fixture (`liveSupported:false`). Inventory: `GET /api/v1/safety-equivalent-packs` | **Not multi-vector BAS.** Malware + phishing/email vectors still Missing. DNS path is **benign canary / detection class only** — never bulk customer-data tunnel. Identity spray/harvest stay disabled. Do not claim Cymulate-class multi-vector library |
| **Dynamic attack paths** | Scaffold | Signal-triggers produce advisory "next recommended mission" (human-approval-gated) | No autonomous real-time path adaptation; replan logic lives only in the swarm fixture |
| **Automated scheduling** | **Fully-E2E** | `MissionSchedule` + `ScheduleFrequency`, `runSystemValidationSweep` ticks due schedules per tenant, recomputes `nextRunAt`; tested | Recurs only the **safe live** modules; granularity Daily/Weekly/Monthly. Claim **scheduled + revalidation + signal-triggered** — not unqualified “always-on continuous BAS” |
| **APT / autonomous pentest / kill-chain** | Scaffold (peer APT); Partial (plan-only substitute) | Governed offensive flip (`setOffensiveValidation`, scope+approval+audit) is real; safe-stage playbooks map ATT&CK → Exposure/Detection/Config/Forbidden with optional safe modules | `exploitation.killchain.engine` is a **plan-only coverage planner** (`liveSupported:false`, always `Inconclusive` / `measured:false`); ransomware Impact (T1486) is **forever Forbidden** (`safeLiveModuleId: null`); **live kill-chain never runs even with approval**. Partial language applies only to the planner + canary hand-offs — never agentless APT execution |

## Agentic AI & RemOps

| Capability | Verdict | What's real | Honest gap |
|---|---|---|---|
| **Virtual Security Analyst** | Partial | Genuine PEP-governed LLM gateway with **working Anthropic/OpenAI adapters**, typed grounded tool catalog (triage/plan/remediate/report), per-call policy + audit, kill-switch | Session-based approval-gated gateway, not an always-on copilot; report text is **deterministic operator content**, not LLM-authored; the "Competitive Swarm" chat path is a fixture stub |
| **Find-Fix-Verify** | Partial (**Verify = Fully-E2E measured**) | `verifyRemediation` stands up a real mission/run, re-syncs authoritative connector config, re-correlates, gates "Fixed" behind `executedRealRetest` + `measuredRevalidation` | Not an autonomous loop; Find is heuristic/connector-derived, LLM reasoning optional, no real exploitation stage |
| **Auto-revalidate** (legacy name: Auto-Mitigate) | Scaffold for *fix push*; Fully-E2E for *revalidate* | Preferred `POST /remediations/:id/auto-revalidate` (legacy `/auto-mitigate` deprecated alias) chains planner→mark-ready→verify→audit | **No config change is ever pushed** — "exec" is the re-validation run. Product language: **auto-revalidate**, not auto-mitigate, until control push ships |
| **Prescriptive Planner** | Fully-E2E (advisory) | `generatePrescriptivePlanFromVerdict` emits ordered mitigation steps + revalidation step | Fully **templated/keyword-branched**; `iacHint` is a static string; LLM refinement is optional, not default |
| **Automated Revalidation** | **Fully-E2E (measured)** | `runDueReverifications` re-runs measured verify on cadence and can honestly flip a stale "Fixed"→StillExposed; proven by `measured-loop.test.ts` against a live Docker range | Cadence is periodic (cron/scheduler), not event-driven on signal drift |
| **ITSM / SOAR / IaC** | Partial | Real Jira / ServiceNow / GitHub Issues API clients (credential-gated) + PagerDuty/Opsgenie/Slack; ticket persistence | Tests exercise mock paths; SOAR = notify (not playbook orchestration); **IaC push absent** (only a comment + static hint) |

## Compliance, risk quantification & data fabric

| Capability | Verdict | What's real | Honest gap |
|---|---|---|---|
| **Compliance attestations** (DORA/NIS2/SEC/GDPR/PCI/ISO 27001) | Scaffold | 8 attestation pack **types** enumerated + report-generatable via `getEvidencePack` | **No framework control catalog, no control→requirement mapping** — all 8 collapse to one generic evidence-linking renderer; source labels them "Stubs"; report disclaims "does not assert certification status" |
| **Business-impact scoring** | Partial | `risk.ts` computes a weighted financial/regulatory/operational contribution + crown-jewel `$` heuristic | The three dimensions are **optional, default 0, and never populated** in the live path — effectively technical severity + criticality band today |
| **AI control validation** (EU AI Act / ISO 42001) | Partial | Real `AIApplication` model + `control-ai.ts` drift detection (guardrail-bypass/leakage/unauth-retrieval); catalog of AI test categories | Every suite is **`.safe`/benign** (no jailbreak/injection payload corpus, no real tool execution); AI-Act/42001 alignment is **label-only**, no control mapping |
| **Unified data fabric** | Partial | Real `correlateAttackPathsFromSignals` fuses normalized signals; real **Tenable vuln+asset** and **Wiz inventory** API ingestion; "real-first" guard against fabricated assets | Ingestion is **live-API-per-connector only**; **no scan-file importers** (`.nessus`/CSV upload); every inventory client ships a fixture fallback |
| **Deep native integrations** | **Fully-E2E (breadth)** | ~**106 dedicated connector clients** with real API/SDK calls + per-vendor contract tests: CrowdStrike, Wiz, Datadog, Tenable, QRadar, Splunk, Sentinel, Chronicle, Cortex XDR, Okta/Entra/CyberArk, AWS/Azure/GCP/K8s, GitHub/GitLab/Snyk, **vmware-vcenter (read-only)**, and dozens more | "Deep" is uneven — most are **read-only telemetry/inventory pulls**; `market-leaders.ts` (~dozen NDR/SOAR/SASE/MDM) are **mock-only scaffolds**; **vCenter is Partial** (read-only inventory; live needs customer vSphere — not Leading); Palo XSIAM only via Cortex XDR |

## Emerging / edge & differentiators

| Capability | Verdict | What's real | Honest gap |
|---|---|---|---|
| **SSPM / SaaS validation** | Partial | Ingests Obsidian/AppOmni SSPM findings as exposure signals; `SaaSApp` asset type | **No native** M365/Workspace/Salesforce/Okta config testing — re-badges other vendors' findings |
| **Identity-centric validation** | Partial | `identity.cred_spray`, `kerberos_userenum`, `bloodhound.identity_pathing` modules; governed offensive gating | All `liveSupported:false` simulations; no live directory collection/spray |
| **SSCS (supply chain)** | Partial | Real Trivy/OSV/Grype dependency+SBOM, Gitleaks secrets, Semgrep SAST; repo-secret→cloud-role correlation | **Dependency+code scanning, not CI/CD pipeline security** — no GH Actions/GitLab/Jenkins config audit, no build provenance |
| **OT/ICS attack packs** | Scaffold | `ot_ics.protocol_exposure` passively classifies observed ports (never speaks OT); `ot_ics.safe_baseline` is fixture-only / `liveSupported:false` | No runner OT payload; fixture never Validated; partner-lab required for any Validated OT claim; no Modbus/DNP3 speak |
| **MSSP multi-tenancy** | **Fully-E2E (arch)** | Real `TenantType {Client,MSSP}`, `parentTenantId` hierarchy, pervasive per-tenant isolation, MSSP-gated child creation, portfolio rollups, metered assessment-pack catalog | Billing catalog real but `paymentProcessorStatus: NotConfigured` (entitlement → safe default); no live billing |
| **Choke-point analysis** | Partial (**not Leading / not Fully-E2E**) | Real greedy hitting-set / betweenness ranking over persisted paths (`computeChokePointAnalysis`) + per-path `pathBreakers[]` labeled evidence-backed | **Evidence-backed path breakers**, not XM Cyber/Wiz-class graph min-cut. Approximate decision support; quality limited by mostly-Heuristic path edges and Partial APV multi-hop measurement. Do not market as “Leading choke science” until a real solver ships **and** path evidence is predominantly Measured |
| **Hybrid-network modeling** | Partial | Asset graph type-tagged (Cloud/K8s/EASM/Internal), cross-domain repo→cloud-role→datastore correlation | Hybrid via **node tags + a few hard-coded patterns**, not a first-class topology/trust-zone reachability model |
| **Exploitability prioritization / "near FP-free"** | **Fully-E2E (design)** | `validationState`/`reachability`/`exploitability` drive scoring; `deriveExploitability` only returns Exploitable when actually Exploitable; heuristic paths carry `heuristic:true` + `methodology` + `heuristic` tag | The framework is genuinely honest and real — but today's "Exploitable" evidence base is often **fixture/simulated** because live offensive execution is disabled repo-wide |

---

## Scorecard ↔ matrix claim freeze (2026-07-30)

Internal `docs/qa/analyst-scorecard.json` is **not** an external MQ / Wave
self-score (`scoreGovernance.isMagicQuadrantProgress=false`,
`isForresterWaveProgress=false` — **P12-16**). After honesty passes
(P12-3 / P13-2 / P13-4 / P19-r1 / P05-11 / A8):

- **Leading** is reserved for matrix **Fully-E2E** (or clearly equivalent)
  capabilities only: Exposure Validation scoring machinery, automated
  scheduling, measured revalidation, MSSP multi-tenancy architecture, and
  dynamic / CISO risk dashboards backed by real trend persistence.
  Machine allowlist in `scripts/analyst-score-gate.mjs`: rows **11, 13, 24,
  69, 90, 91**.
- Rows the matrix marks **Partial / Scaffold / Missing** must not be sold or
  exported as Leading. Sales and RFP language must use this matrix’s verdict
  labels, not inflated scorecard words.
- **SCV** remains **Partial** (observe/telemetry only; closed inject hard-
  disabled). **APV / multi-hop** remains **Partial** (Wave A 2026-07-29 stamp:
  claim honesty + Measure help landed; still no all-hops Fully-E2E lab proof).
  **Choke-point** remains **Partial (not Leading)**. Do not re-inflate.
- **Market presence:** zero named customer references; public marketplace
  listing **NotConfigured**. Do not fabricate ARR, logos, or MQ progress
  (P08-2 / P12-6 / P13-1).
- Current honest internal aggregate: **71.6** (1,347/1,880). Prior ~75.7 /
  ~79 internal figures are retired as trust-poison for external use until
  measured multi-hop + (optional) SCV inject demos + blind rescore land.

## ✅ Honesty flag — RESOLVED (2026-07-05)

The audit surfaced a **"Competitive Swarm / kill-chain" fixture layer** in
production code that emitted fabricated metrics (`templatesCount: 50000 +
Math.random()*1000`, `swarms: 12`, placeholder ATT&CK id `T1000`, `autonomy =
0.95`, 16 fictional agents, canned "Virtual Analyst" replies). This conflicted
with the no-fabrication stance.

**Fixed** (commit `790adf2b`): 547 lines of fabrication were excised from
`orchestrator.ts`; the `exploitation.killchain.engine` module now emits an honest
simulation-only plan mapped to **real** ATT&CK technique ids
(`measured:false/executed:false`, verdict `Inconclusive`); and the model-gateway
"swarm" path is grounded in **real** tenant state (actual engagement + mission
counts) pointing to the governed **Engagement engine** (`POST
/api/v1/engagements/run`) — Periscan's genuine, tested, end-to-end autonomous
validator (passive steps execute with real evidence; offensive steps are denied
under the policy floor). The real turn engine and safety/kill-switch helpers were
preserved. A repo scan confirms **zero remaining `Math.random`/fabricated-metric
sites in production code**. This is why AI-BAS is honestly re-scored around the
real Engagement engine rather than the removed theater.

## The honest bottom line

Periscan's real, defensible strength is a **measured, evidence-backed,
no-fabrication validation core** (the HTTP/TLS/DNS measured loop, measured
fix-verification, cryptographic runner provenance, explicit heuristic-vs-measured
labeling) wrapped in a **strong exposure/risk/trend layer, real MSSP
multi-tenancy, and unusually broad real integrations**. Where competitors
overclaim autonomous exploitation and "false-positive-free" results, Periscan can
win by **proving** — but only if the simulation/scaffold surface is either made
real or honestly labeled. The strategy for turning each gap into a differentiated
answer is in [COMPETITIVE_FEATURE_STRATEGY.md](COMPETITIVE_FEATURE_STRATEGY.md).
