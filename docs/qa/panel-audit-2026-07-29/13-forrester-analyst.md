# Forrester Wave Panel Audit — Periscan (CTEM / ASV / Exposure Validation)

| Field | Value |
| --- | --- |
| **Persona** | Forrester Wave analyst — Continuous Threat Exposure Management (CTEM), Automated Security Validation (ASV), Exposure Management / BAS-adjacent |
| **Date** | 2026-07-29 |
| **Repo baseline** | Surface inventory git tip `beb95c49` (panel inventory); product score snapshot **79.1 / 95.9** on the 94-row ASV/CTEM matrix |
| **Mode** | Doc- and code-grounded self-audit (not a paid Wave evaluation; no customer interviews) |
| **Primary sources** | `PRD.md`, `docs/ANALYST_CAPABILITY_MATRIX.md`, `docs/ANALYST_READINESS_ASSESSMENT.md`, `docs/COMPETITIVE_COVERAGE_MATRIX.md`, `docs/COMPETITIVE_FEATURE_STRATEGY.md`, `docs/INTEGRATIONS.md`, `docs/PRODUCTION_READINESS.md`, `PRODUCTION_READINESS.md`, `docs/qa/analyst-scorecard.json`, `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`, `docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md`, `docs/qa/ux-validation-2026-07-13.md`, `docs/qa/UI_RELEASE_ICP_ROADMAP.md`, `docs/qa/panel-audit-2026-07-29/SURFACE_INVENTORY.md`, `SECURITY_BOUNDARIES.md`, `demo/DEMO_SCRIPT.md` |

---

## 1. Executive summary (Wave placement proxy)

**Wave-category fit:** Periscan is best evaluated as an **Automated Security Validation / CTEM execution platform** with exposure management, attack-path analytics, control-efficacy observation, fix verification, and evidence packs — not as pure vulnerability management (VM), pure EDR/XDR, or pure BAS. It sits at the intersection of Forrester’s exposure-management and BAS lenses and Gartner-style adversarial exposure validation (AEV).

**Proxy placement (if forced onto a Wave graphic today):**

| Wave axis (0–5) | Score | Band |
| --- | ---: | --- |
| **Current offering** | **3.3** | Strong Contender → Contender (proof-core strong; BAS injection & multi-hop measured paths partial) |
| **Strategy** | **3.8** | Strong Contender (clear “proof, not claims” wedge; disciplined honesty; sequenced roadmap) |
| **Market presence** | **1.2** | Incomplete / pre-Wave (no public customer references, no disclosed ARR, no public marketplace listing, design-partner stage) |

**Composite readiness for a formal Forrester Wave inclusion:** **Not yet.** Product strategy and a large share of current offering are Wave-discussable; market presence and reference readiness fail the bar Forrester requires for ranked vendors (customer references, revenue/customer footprint, and production deployments that customers will speak to).

**One-line analyst verdict:**  
*Periscan is a truthfulness-first CTEM/ASV platform with category-defining measured fix-verification and an unusually broad connector catalog, but it is still a first-customer / design-partner product: live BAS injection, multi-hop measured exploitability, and customer-reference proof remain incomplete — and market presence is essentially pre-commercial for Wave purposes.*

---

## 2. Methodology notes (honesty constraints)

This panel report **does not** substitute for:

- Live customer reference calls  
- Third-party pen test of the control plane  
- Production-scale performance on multi-tenant customer data  
- Paid Wave questionnaire + product demo under Forrester rules  

Scoring uses Forrester’s three classic Wave dimensions and maps documented product evidence to typical CTEM/ASV/exposure-management criteria. Scores are **conservative**: Partial / scaffold / Beta connectors / “ready for first customer” language is treated as *not production-certified*, not as market-proven.

---

## 3. Strategy (score **3.8 / 5**)

### 3.1 Vision and positioning

| Criterion | Score | Evidence | Analyst note |
| --- | ---: | --- | --- |
| Category definition clarity | 4.5 | PRD north star: “Find the path. Validate the risk. Prove it's fixed.” CTEM-native modules (snapshot, exposure, control, attack path, AI app, fix verification, evidence packs, signal fabric, runner). | Crisp, buyer-relevant outcome language. Avoids pure scanner positioning. |
| Differentiation | 4.5 | Explicit wedge: **proof, not claims** — `evidenceBasis` Measured vs Heuristic, Fixed only on re-measurement, Ed25519 runner provenance, anti-fabrication gates, real-first rule. | Best strategic asset. Aligns with Forrester buyer fatigue around overclaimed “exploitable” and “FP-free” BAS marketing. |
| Competitive framing honesty | 4.5 | `COMPETITIVE_COVERAGE_MATRIX.md` self-scores Fully-E2E / Partial / Scaffold / Missing against Picus, Pentera, XM Cyber, Cymulate, RidgeBot, Tenable, Horizon3, SafeBreach. | Unusually analyst-friendly self-discipline; rare in vendor docs. |
| Roadmap coherence | 3.5 | Sequenced plan: honesty cleanup → measured multi-hop edges → SCV stimulus + DRV inject-and-observe → compliance mapping → fabric importers → breadth. 94-row ASV/CTEM score plan with 79.1→95.9 target. | Roadmap is engineering-credible. Commercial GTM, packaging, and partner strategy are thinner. |
| Safety / ethics as strategy | 4.5 | `SECURITY_BOUNDARIES.md`: verified scope, no destructive tests, no exfil/persistence/credential theft, outbound-only runner, policy-gated missions, kill switch. | Strong enterprise trust story for regulated buyers; differentiates from aggressive autonomous pentest narratives. |
| Commercial strategy | 2.5 | Public pricing language only: “Pay for what you validate.” Metering catalog real; `paymentProcessorStatus: NotConfigured`. AWS Marketplace app-side ready, listing state not Public. | Strategy understands usage packaging but is not market-executable yet. |

**Strategy strengths**

1. **Proof architecture as the product**, not a marketing claim — Measured/Heuristic, Fixed-only-on-retest, signed runner tasks/results (post readiness program), SHA-256 evidence integrity.  
2. **CTEM full-loop intent** — Scoping → Discovery → Prioritization → Validation → Mobilization → Verification is mapped and largely instrumented.  
3. **API-first, replaceable UI** — large OpenAPI control plane; automation-ready for platform teams and MSSPs.  
4. **Governed offensive posture** — default safe; offensive flip is admin-attested, audited, hard floor intact — positions well vs uncontrolled “autonomous red team.”  
5. **MSSP as scale wedge** — parent/child tenants, portfolio rollups, white-label/QBR report types, PSA/RMM connector class.

**Strategy risks / gaps**

1. **Breadth vs wedge tension** — 50+ web routes, AI gateway, MCP/A2A, confidential compute, swarm-adjacent surfaces risk diluting the “prove the path and fix” story for Wave evaluators who reward focused offering depth.  
2. **BAS parity gap acknowledged but incomplete** — live stimulus→detect/block loop and inject-and-observe detection-rule validation remain Build-next; competitors lead demos on this.  
3. **Compliance as strategy is aspirational** — attestation pack types exist; control-catalog mapping to measured evidence still incomplete for DORA/NIS2/PCI/ISO-style buyers.  
4. **No disclosed partner ecosystem strategy** (SI, GSI, MSSP channel program metrics) beyond product multi-tenancy and ConnectWise/Kaseya-class connectors.

### 3.2 Strategy score rationale

Strategy earns a **Strong Contender** band (**3.8**) because vision, honesty architecture, and competitive self-assessment are Wave-grade. It loses points for pre-commercial packaging, incomplete BAS closed-loop roadmap execution, and platform sprawl risk. If measured multi-hop + SCV stimulus + DRV inject land with references, Strategy can approach **Leader-band product strategy** without changing the wedge.

---

## 4. Current offering (score **3.3 / 5**)

Scores below use a 0–5 scale: 5 = production-proven leader behavior; 4 = strong, real, some residual; 3 = real core with material gaps; 2 = partial/scaffold; 1 = missing or demo-only.

### 4.1 Forrester-relevant capability scorecard (CTEM / exposure / BAS lens)

| Capability (Wave-style) | Score | Status in docs | Notes for evaluators |
| --- | ---: | --- | --- |
| **Verified scope & safe authorization** | 4.5 | Met | Policy denies unverified scope; DNS/HTTP/file verification; denied tasks not queued. Enterprise trust strength. |
| **External attack surface / EASM** | 3.5–4.0 | Strong (scorecard row ~4.0) | Real recon (subfinder/httpx/dnsx/nmap via runner); continuous living map / CT seed expansion still partial. External validation workbench completed 2026-07-26. |
| **Exposure validation & risk scoring (EXV)** | 4.5 | Fully-E2E / Leading | Explainable multi-factor risk; trends; Fixed short-circuit. Inputs still often heuristic upstream. |
| **Attack-path validation (APV)** | 3.5–4.25 | Leading model; Partial measured | Full graph, choke points, blast radius model; multi-hop edges often Heuristic; measured per-edge still Slice 3 next work. |
| **Choke-point analysis** | 3.5–4.5 | Leading scorecard; Partial engineering honesty | Product scorecard 4.5; competitive matrix notes pattern-attached breakers vs true min-cut/dominator solver. Treat as strong UX + partial graph science. |
| **Security control validation (SCV)** | 3.5–4.5 | Met telemetry / Partial injection | Live EDR/SIEM correlation by MITRE technique (CrowdStrike, Splunk, etc.). Does **not** yet fully execute safe stimulus and measure block/detect as default. |
| **Detection rule validation (DRV)** | 3.0–4.25 | Mixed docs | Capability matrix “Met” for coverage classification; competitive matrix historically “Scaffold” for inject-and-observe. Scorecard 4.25 — treat as **strong observation, incomplete rule-firing proof**. |
| **Cloud / K8s / container validation** | 3.5–3.75 | Strong / Partial | Prowler/Trivy real; DO measured loops; no full CIS/kube-bench E2E claim. |
| **Breach & attack simulation (safe scenarios)** | 2.5–3.0 | Partial | Atomic safe modules + ControlValidation mission type; live BAS gated/disabled by default; guided first-run BAS experience incomplete. |
| **Agent / agentless execution** | 3.5–4.0 | Strong agent; Partial APT | Outbound signed-task runner (Go + TS agent); agentless HTTP/TLS/DNS; agentless APT / ransomware / identity abuse largely gated or low scorecard scores (2–2.25). |
| **Automated scheduling & continuous validation** | 4.5 | Fully-E2E | Per-tenant sweeps, revalidation that can demote stale Fixed. Cadence Daily/Weekly/Monthly; blackout/timezone gaps noted in UX audit. |
| **Prioritization by exploitability** | 4.0–4.5 | Met / Fully-E2E design | Weighted factors + priority rationale objects; honesty on Heuristic. |
| **Unified validated findings layer** | 4.5 | Met | Single findings model across pillars; cross-links. Dedup/root-cause grouping still a historical P0 concern (gap audit). |
| **Threat-informed triggers** | 3.5–4.0 | Met framework | Threat center, super-feeds (KEV, NVD, EPSS, etc.); auto-launch remains policy-gated / partial E2E proof. |
| **Find → fix → verify loop** | 4.5 (Verify) | Verify Fully-E2E | Crown jewel: Fixed only on measured retest; automated revalidation can reopen. Auto-mitigate does not push config. |
| **Remediation / ITSM mobilization** | 3.5–4.0 | Met / Partial live | Jira/ServiceNow/GitHub Issues clients; ticket + prescriptive plans. Live ticketing depth uneven; no IaC push. |
| **Executive + technical reporting / evidence packs** | 4.0–4.5 | Met | Audience-specific packs, CTEM program summary, MSSP QBR types, integrity-aware evidence. Compliance control mapping incomplete. |
| **Evidence integrity / chain of custody** | 4.0–4.5 | Met backend | SHA-256 write/read integrity; some UX audit residual on in-product chain verification surface. |
| **Integrations / data fabric** | 3.5–4.0 | Breadth Fully-E2E | **126 dedicated live** + **141 Planned/NotConnectable** of 267 catalog; ~29 contract-tested subset. Mostly read-only telemetry/inventory. No scan-file importers (`.nessus`/CSV/SARIF) as first-class fabric path. |
| **MSSP multi-tenancy** | 4.0–4.5 | Fully-E2E architecture | Hierarchy, isolation, portfolio, metering foundation; payment not configured. |
| **Enterprise auth (SSO/OIDC/SAML)** | 3.5–4.0 | API ready; UI residual | Backend complete; self-serve SSO form historically incomplete; IdP still customer-deployed. |
| **AI app validation** | 3.0–4.0 | Partial / Strong scorecard rows | Safe harnesses; some suites fixture-default; EU AI Act mapping label-heavy. |
| **OT/ICS, dark web, phishing, malware vectors** | 1.5–2.0 | Scaffold / Missing | Explicit competitive gaps. |
| **UI / operator usability** | 3.0–3.5 | Mixed | See §6. Primary proof loop improved; historical TaskSuccess 2.6; release UI phases A–D shipped but design-partner session evidence not claimed. |

### 4.2 Pillar summary (six validation pillars)

| Pillar | Offering grade | Wave interpretation |
| --- | --- | --- |
| ASV / EASM | Contender | Real discovery + external workbench; not yet continuous autonomous terrain map of leaders. |
| APV | Strong Contender (model) / Contender (measured) | Graph + risk UX competitive; measured multi-hop still the inclusion risk. |
| SCV | Contender | Telemetry-first efficacy is real; classic BAS “simulate and measure control” demo incomplete. |
| DRV | Contender | Coverage honesty (logged-only vs detected) is strong; inject proof weak. |
| CSV | Contender | Solid cloud/code scanners; enterprise cloud-tenant measured E2E uneven. |
| EXV | Strong Contender / Leader-band core | Risk + trends + honesty labels are ready for Wave demos. |

### 4.3 Current offering — top 5 strengths for a Wave demo

1. **Measured fix verification that can demote its own Fixed** — rare, defensible differentiator.  
2. **Honest evidence basis** (Measured vs Heuristic) enforced in models, anti-fabrication tests, and claim-language fixes (Slice 1).  
3. **Explainable prioritization + unified findings** — CTEM prioritization story without raw scanner dumps.  
4. **Integration breadth with real-first gating** — 126 connectable dedicated clients; planned connectors not falsely connectable.  
5. **Safety-by-architecture runner** — outbound HTTPS signed tasks, scope allowlists, no reverse shell default, non-destructive floor.

### 4.4 Current offering — top 5 blockers for Leader-band Current Offering

1. **Closed-loop BAS / control injection** not default-proven (stimulus → SIEM/EDR → verdict).  
2. **Multi-hop attack paths still largely heuristic** despite rich graph UI (Slice 3 open).  
3. **Offensive / APT / multi-vector simulation surface** gated or scaffold (ransomware, identity abuse, DNS exfil historically weak).  
4. **Compliance attestation depth** insufficient for regulated Wave buyers without control→evidence matrix.  
5. **Operations residual** — external pen test not claimed; production-scale perf/deploy customer-dependent; payment/Marketplace not public.

**Current offering score 3.3** = Contender with Strong Contender spikes in EXV, fix verification, safety, and findings unification. Not Leader without measured path closure + live control validation demos that customers will reference.

---

## 5. Market presence (score **1.2 / 5**)

Forrester Market Presence typically weights: revenue, customer count, geographic distribution, partner ecosystem, employee base, brand/awareness, and customer retention/satisfaction. **Repo docs provide almost no production commercial footprint.** Proxies only:

| Presence proxy | Evidence in docs | Score impact |
| --- | --- | --- |
| **Public customer references** | None named. Demo uses `demo@periscan.local` fixtures; public `/demo` is explicitly sample. | Critical fail for Wave inclusion |
| **Design-partner program** | API + UI design-partner mode, checklist, analyst notes; ICP research protocol exists; UI roadmap says “external design-partner evidence **in progress**” and **claims no participant results**. | Early-stage only |
| **First-customer readiness (product)** | Root `PRODUCTION_READINESS.md`: multiple areas “Ready for first customer”; ops backups/alerts deployment-managed. | Product-ready ≠ market-present |
| **Revenue / ARR / growth** | Not disclosed. Billing meters/packages only; no payment processor. | Zero evidence |
| **Pricing transparency** | “Pay for what you validate.” No public price points (intentional). | Neutral for strategy; weak for market presence metrics |
| **Distribution / marketplace** | AWS Marketplace integration runbook: app-side metering/entitlements; listing not Public; seller ops external. | Pre-listing |
| **Partner channel** | MSSP product architecture + PSA/RMM connectors; no partner count, SI program, or co-sell metrics. | Architecture only |
| **Brand / analyst mindshare** | Internal analyst scorecard program (94 ASV/CTEM rows); no public Forrester/Gartner recognition claimed. | Internal maturity only |
| **Employees / geography / install base** | Not disclosed in product docs. | Zero evidence |
| **Customer satisfaction / NPS / retention** | Not disclosed. | Zero evidence |

**Market presence score 1.2** reflects a **pre-Wave commercial stage**: engineering and first-customer checklists are advanced; **customer reference readiness is not**.

### 5.1 Customer reference readiness (Wave gate)

| Gate | Status | Detail |
| --- | --- | --- |
| ≥3 production customers willing to speak | **Not evidenced** | No reference names, logos, or case studies in repo |
| Production deploy outside lab | **Not evidenced** | Lab/test-range E2E proven; production deploy remains operational/external |
| Reference scenario matches Wave criteria | **Partial capability only** | Can demo EXV + fix verify + integrations + MSSP architecture; struggle on full BAS + multi-hop measured exploit |
| Independent usability / multi-customer sessions | **Explicitly unclaimed** | UI roadmap and implementation status repeatedly refuse to claim design-partner session outcomes |
| Security third-party assessment | **Open** | Analyst readiness notes external pen test still required for A-grade security |

**Reference readiness verdict:** **Not Wave-ready.** Product can support a *confidential* design-partner narrative and a *lab* proof narrative; it cannot yet support a Forrester-style customer reference pack.

---

## 6. Integration ecosystem (Wave sub-score **3.6 / 5**)

| Dimension | Assessment |
| --- | --- |
| **Catalog breadth** | **High** — 267 enterprise platforms catalogued; 126 dedicated live clients spanning SIEM, EDR/XDR, CNAPP/VM, cloud, identity, code/DevSecOps, ITSM, threat intel, email, WAF, MSSP PSA/RMM, AI stack. |
| **Honesty of depth** | **High** — 141 planned entries **NotConnectable** (design-partner path, not Configure). Aligns with real-first rule and Forrester’s distrust of “integration theater.” |
| **Contract / smoke proof** | **Moderate** — ~29 contract-tested; live-smoke runbook exists; all dedicated listed **Beta**, none Production/Certified in `INTEGRATIONS.md`. |
| **Directionality** | **Mostly inbound / observer** — telemetry, inventory, ticket create. Bidirectional control tuning / IaC push limited. |
| **Data fabric** | **Partial** — live API correlation (e.g. Tenable, Wiz); missing file importers for incumbent VM tools (`.nessus`, CSV, SARIF) hurts VM-adjacent Wave narratives. |
| **MSSP ecosystem** | **Strong product shape** — ConnectWise, Autotask, Halo, NinjaOne, N-able, Syncro, Datto, etc. |

**Wave implication:** Ecosystem is a **Contender→Strong Contender** story on breadth + honesty. It is **not** yet a Leader story on certified production depth, bi-directional remops, or file-based VM interoperability.

---

## 7. UI / UX usability for Wave criteria (sub-score **3.2 / 5**)

### 7.1 Surface coverage

Panel surface inventory lists a full operational suite: dashboard, findings, attack-paths, controls, remediation, evidence, reports/executive, integrations, runners, schedules, missions, external-validation, threat-center, compliance, getting-started, MSSP, trust-safety, registries, validation-ops, etc. (**50+ routes**). That breadth is impressive and risky: Wave demos reward a **tight Validate → Remediate → Re-validate → Prove** journey more than route count.

### 7.2 Usability evidence timeline

| Date | Finding | Impact on Wave demo |
| --- | --- | --- |
| 2026-07-13 UX panel | Mean TaskSuccess **2.6**, Trust **3.7**; not F1000-ready; silent failures on some governance actions; evidence chain hard to verify in UI; bulk triage gaps | Weak operator productivity story |
| 2026-07-14 UI release | Phases A–D shipped (persona onboarding, Needs-you queue, proof composer, WCAG A/AA gates); design-partner evidence **not** claimed | Improved structure; still no customer usability proof |
| 2026-07-16 core gap audit | Truth language / connector honesty P0s closed; external workbench and measured path gaps called | Truthfulness improved — critical for Wave |
| 2026-07-26 | External validation workbench task-complete (policy preflight → launch → evidence → re-test) | Stronger ASV demo path |
| 2026-07-29 | Surface inventory score snapshot **79.1/95.9** | Capability breadth still below internal 95.9 target |

### 7.3 Wave UX criteria mapping

| Wave-style UX criterion | Score | Comment |
| --- | ---: | --- |
| Time-to-first-value / guided setup | 3.5 | Getting-started + design-partner mode + demo script; fixture connectors hidden by default (good). SSO self-serve historically incomplete. |
| Operator task completion | 3.0 | Proof loop increasingly complete; historical TaskSuccess low; bulk ops / some dead-ends residual. |
| Executive storytelling | 3.5–4.0 | Executive reports, risk dashboards, evidence packs without raw scanner dump. |
| Truthfulness of UI language | 4.0+ (post Slice 1) | Weakest-hop claim contract; connector Planned states — major improvement for analyst trust. |
| Accessibility | 3.5–4.0 | Playwright axe WCAG A/AA in verify; responsive work ongoing. |
| Admin / enterprise config | 3.0 | API-strong; UI forms for SSO/billing/ops uneven. |
| MSSP operator UX | 3.5 | Portfolio route; multi-client proof loop is strategic wedge. |

**UI usability sub-score 3.2:** Contender. Trust/honesty UX is above category average; task throughput and customer-validated usability are not Leader-grade.

---

## 8. Wave dimension scores (summary table)

| Dimension | Weight (typical Wave) | Score (0–5) | Weighted contribution (illustrative 50/30/20) |
| --- | ---: | ---: | ---: |
| Current offering | 50% | **3.3** | 1.65 |
| Strategy | 30% | **3.8** | 1.14 |
| Market presence | 20% | **1.2** | 0.24 |
| **Composite** | 100% | | **3.03 / 5** |

**Illustrative Wave band:** **Contender** (composite ~3.0). Strategy pulls up; market presence pulls hard down. Pure product evaluators might rate closer to Strong Contender on strategy + offering spikes; inclusion in a published Wave still fails on references/presence.

---

## 9. Comparison lens vs named competitors (doc-grounded)

Periscan’s own competitive matrix positions it against Picus, Pentera, XM Cyber, Cymulate, RidgeBot, Tenable, Horizon3, SafeBreach:

| Theme | Leaders typically show | Periscan today | Wave takeaway |
| --- | --- | --- | --- |
| Autonomous / agentic attack | Flashy multi-vector simulation | Governed, often passive; offensive gated; honesty over theater | Safer enterprise story; weaker “wow” BAS demo |
| Control validation | Stimulus + detect/block | Strong telemetry pull; incomplete inject loop | Must close for BAS Wave parity |
| Attack path | Measured lateral graphs | Model strong; multi-hop measured partial | Slice 3 is the product-critical Wave bet |
| Exposure prioritization | Risk + business context | Real EXV + honest labels | Competitive / lead with this |
| Fix verification | Re-scan or ticket close | **Measured retest that can demote Fixed** | Differentiator — lead every demo |
| Integrations | Deep platform + SI | Very broad Beta clients; depth uneven | Breadth strong; certify top 15 deeply |
| Honesty | Often marketing-forward | Architectural anti-fabrication | Category-defining narrative for Forrester buyers |

---

## 10. What must be true before a formal Forrester Wave participation

### 10.1 Inclusion prerequisites (Market Presence + references)

1. **≥3 production customers** (not lab-only) completing weekly Validate→Remediate→Re-validate, willing to be confidential references.  
2. **Case studies** with measurable outcomes (MTTR to verified Fixed, % measured vs heuristic, control miss discoveries, audit pack acceptance).  
3. **Public or limited commercial availability** (Marketplace Limited/Public or equivalent SaaS offers with real entitlements).  
4. **Independent security assessment** of control plane + runner.  
5. **Support/SLO narrative** customers will repeat (runbooks exist; externally reviewed ops unclaimed).

### 10.2 Current Offering prerequisites (to exit Contender)

1. **Measured multi-hop path validation** with edge receipts and before/after breaker proof (Slice 3).  
2. **Governed SCV stimulus** + **DRV inject-and-observe** with signed evidence of detect/block/log.  
3. **Connector certification program** — top SIEM/EDR/CNAPP/ITSM connectors Production-certified, not only Beta.  
4. **Scan-file import path** for VM incumbents (Tenable/Qualys export reality).  
5. **Compliance control matrix** for at least 2–3 frameworks with measured evidence links.  
6. **Wave demo script** limited to 7–10 screens that complete the north-star journey without visiting swarm/AI-adjacent detours.

### 10.3 Strategy prerequisites (to approach Leader strategy band)

1. **Published wedge narrative** externally matching internal honesty docs.  
2. **Narrow ICP packaging** (Security leader + engineer proof loop; MSSP pack) — de-emphasize non-core route sprawl.  
3. **Partner program metrics** (MSSP + 2–3 SIs) with trained delivery playbooks.  
4. **Clear BAS vs AEV positioning** so evaluators do not score “missing malware pack” as a strategy failure if intentionally out of scope.

---

## 11. Recommended Wave narrative (if briefing Forrester today)

**Do say**

- We are a CTEM execution platform that **proves** exposure, control gaps, and fix closure with measured evidence.  
- Fixed is not a human disposition; it is a **re-measurement**.  
- Every conclusion is labeled Measured or Heuristic; we refuse fabricated exploit metrics.  
- Scope, policy, and outbound runners make us safe for production networks.  
- One findings model unifies exposure, paths, controls, AI apps, and remediations.  
- Integration catalog is broad and **honest about Planned vs live**.

**Do not say (docs forbid or contradict)**

- “False-positive-free” without measured basis.  
- Full autonomous APT/ransomware/identity abuse as live default.  
- Production-certified connectors for the entire 267 list.  
- Customer logos or ROI without design-partner evidence.  
- Public pricing numbers or “GA at scale” without deploy/reference proof.  
- That compliance packs assert certification status (reports disclaim).

---

## 12. Final scores card (print-ready)

| Area | Score | Band |
| --- | ---: | --- |
| Strategy | **3.8 / 5** | Strong Contender |
| Current offering | **3.3 / 5** | Contender (spikes Strong Contender) |
| Market presence | **1.2 / 5** | Incomplete / pre-Wave |
| Customer reference readiness | **Fail** | Design-partner / lab only |
| Integration ecosystem | **3.6 / 5** | Contender–Strong Contender |
| UI usability (Wave demo fitness) | **3.2 / 5** | Contender |
| **Composite (50/30/20)** | **~3.0 / 5** | **Contender** |
| **Formal Wave inclusion readiness** | **No** | Need references + closed BAS/path loops |

---

## 13. Panel confidence and limits

| Claim type | Confidence |
| --- | --- |
| Strategy / architecture from PRD + competitive docs | High |
| Capability Met/Partial from matrices + implementation status | Medium–High (some matrices predate later slices; scorecard 79.1 not fully rescored after 2026-07-26) |
| Market presence / revenue / references | High confidence **in absence** — no contrary commercial evidence in repo |
| Live UI polish relative to 2026-07-13 audit | Medium — substantial ship notes; no independent 2026-07-29 usability re-score |

---

## 14. Bottom line for product leadership

Periscan already behaves like a vendor that **could** win Forrester Strategy points and selected Current Offering criteria (proof integrity, fix verification, prioritization, safety, API breadth). It does **not** yet behave like a vendor that survives Wave **Market Presence** or customer-reference due diligence.

**Highest ROI for Wave trajectory (ordered):**

1. Three real customer proof-loop references.  
2. Slice 3 measured attack-path edges.  
3. Closed SCV/DRV inject loops customers can show.  
4. Certify top integrations Production.  
5. One ruthless Wave demo path; park platform sprawl.

Until then, the accurate analyst label is:

> **Strong product strategy and Contender-grade offering in CTEM/ASV, pre-commercial market presence — Contender composite, not yet Wave-includable.**

---

*End of panel audit `13-forrester-analyst.md`. Companion inventory: `docs/qa/panel-audit-2026-07-29/SURFACE_INVENTORY.md`.*
