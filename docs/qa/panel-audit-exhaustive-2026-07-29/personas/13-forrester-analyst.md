# P13 — Forrester Wave Analyst (Exhaustive)

| Field | Value |
| --- | --- |
| **Persona** | Forrester Wave analyst — CTEM / Automated Security Validation (ASV) / Exposure Management / BAS-adjacent |
| **Date** | 2026-07-29 |
| **Repo** | `/Volumes/DataSSD1/test/periscan` |
| **Baseline** | Surface inventory git tip `beb95c49`; internal ASV/CTEM score **79.1 / 95.9** (94 rows); live app `https://app.periscan.com` |
| **Mode** | Exhaustive doc + code grounded audit (not a paid Wave; no customer interviews) |
| **Contract** | `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md` |
| **Previous panel** | `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` · prior P13 `docs/qa/panel-audit-2026-07-29/13-forrester-analyst.md` |

---

## 1. Verdict (Wave lens)

| Dimension | Score (0–5) | Band |
| --- | ---: | --- |
| **Strategy** | **3.8** | Strong Contender |
| **Current offering** | **3.25** | Contender (EXV / fix-verify spikes Strong Contender) |
| **Market presence** | **1.15** | Pre-Wave / Incomplete |
| **Integration ecosystem (sub)** | **3.55** | Contender → Strong Contender on honesty; Contender on depth |
| **UI TaskSuccess / Wave demo fitness (sub)** | **3.1** | Contender (Trust high; operator completion lag) |
| **Customer reference readiness** | **Fail** | Design-partner / lab only |
| **Composite (illustrative 50/30/20)** | **~2.98** | **Contender** |
| **Formal Wave inclusion readiness** | **No** | Presence + references + closed BAS/path demos |

### 5.0 definition (this lens)

A **5.0** Forrester Wave Contender→Leader trajectory vendor would:

1. Sit in a published Wave (or clear inclusion shortlist) with **≥3 production customer references** willing to speak under NDA/public rules.  
2. Deliver a **demo-tight** Validate → Prioritize → Remediate → Re-validate → Prove journey (≤10 screens) without platform detours.  
3. Prove **measured multi-hop** attack paths and **governed SCV/DRV inject-and-observe** with signed evidence customers can show.  
4. Ship **Production-certified** top-tier integrations (not all-Beta catalog theater) plus honest Planned entries.  
5. Hold **Strategy** on a defensible wedge (proof, not claims) without score inflation or feature-zoo dilution.  
6. Present **market presence** proxies (commercial availability, partner/channel, support narrative) that survive analyst diligence.

**Today:** Strategy is already Strong Contender. Offering is Contender with flagship spikes. Presence and references fail inclusion. Composite ≈ Contender; **not Wave-includable**.

**One-line analyst verdict:**  
*Periscan is a truthfulness-first CTEM/ASV platform with category-defining fix verification and integration honesty — trapped in a pre-commercial presence stage and a feature zoo that weakens Wave demos. Contender product; not Leader; not includable until references, measured multi-hop, and certified integration depth land.*

**Agreement with previous panel:** Confirms synthesis U-25 (no customer references → Wave/MQ presence fail), Contender ~3.0 composite, and “not Wave-includable.” **Dissent (mild):** Market presence scored slightly lower here (1.15 vs prior 1.2) given zero disclosed ARR, logos, Marketplace Public listing, or partner counts — Forrester presence is binary-harsh. Offering slightly lower (3.25 vs 3.3) until Slice 3 multi-hop is default-demoable and score inflation is blind-rescored.

---

## 2. Wave dimension analysis (condensed)

### 2.1 Strategy — 3.8 / 5

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Category clarity | 4.5 | PRD / score plan north star: Discover → validate path/control → remediate → revalidate → evidence (`docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`) |
| Differentiation | 4.5 | Proof not claims; `evidenceBasis` Measured vs Heuristic; Fixed only after retest; anti-fabrication gates; real-first rule (`Agents.md`, competitive matrix honesty note) |
| Competitive honesty | 4.5 | `docs/COMPETITIVE_COVERAGE_MATRIX.md` Fully-E2E / Partial / Scaffold / Missing vs Picus, Pentera, XM Cyber, Cymulate, et al. |
| Roadmap coherence | 3.5 | Slices 1–2 complete; Slice 3 next; 79.1→95.9 plan — engineering-credible; GTM/partner thinner |
| Safety as strategy | 4.5 | `SECURITY_BOUNDARIES.md`: verified scope, denied-never-queued, outbound signed runner, non-destructive floor |
| Commercial strategy | 2.4 | “Pay for what you validate”; `paymentProcessorStatus: NotConfigured` in runtime services / acceptance criteria; AWS Marketplace app-side, listing not Public |

**Strategy risk:** Breadth (swarm, MCP, model gateway, confidential compute narratives, 50+ routes) competes with wedge depth. Forrester rewards focused execution stories; zoo dilutes Strategy *presentation* even when Strategy *intent* is excellent.

### 2.2 Current offering — 3.25 / 5

| Wave-style capability | Score | Grounding |
| --- | ---: | --- |
| Verified scope & safe authorization | 4.5 | Policy + denied-never-queued |
| External ASV / EASM | 3.7 | Slice 2 external workbench complete 2026-07-26; continuous living map still partial (competitive matrix) |
| EXV risk / prioritization | 4.4 | Fully-E2E machinery; upstream often heuristic |
| Attack-path validation (APV) | 3.4 | Graph + UX strong; multi-hop edges largely heuristic; Slice 3 open |
| Choke-point analysis | 3.5 | Pattern-attached breakers, not true min-cut (competitive matrix) |
| Security control validation (SCV) | 3.3 | Telemetry pull real; stimulus→detect/block incomplete |
| Detection rule validation (DRV) | 2.9 | Inject-and-observe scaffold historically |
| Cloud / K8s / CSV | 3.5 | Prowler/Trivy real; full CIS E2E uneven |
| Safe BAS / multi-vector | 2.6 | Live gated; APT/ransomware/phishing/DNS-exfil scaffold/missing |
| Continuous scheduling | 4.3 | Fully-E2E; blackout/timezone residual (UX audit) |
| Find → fix → **verify** | 4.5 | Crown jewel: Fixed only on measured retest; can demote Fixed |
| Remediation / ITSM | 3.6 | Jira/ServiceNow/GitHub Issues; IaC push absent |
| Evidence integrity | 4.2 | SHA-256 / chain backend; UI verify residual historically |
| Integrations fabric | 3.55 | See § findings on catalog |
| MSSP multi-tenancy | 4.2 | Hierarchy + portfolio; billing processor not configured |
| Compliance attestation depth | 2.7 | Pack types exist; control→evidence matrix thin / scaffold |
| Enterprise identity (SCIM/SSO ops) | 3.2 | API strong; buyer residual (previous panel U-19) |
| OT / dark web / phishing vectors | 1.7 | Scaffold/Missing rows (scorecard row 2, competitive matrix) |

**Offering blockers for Leader band:** (1) multi-hop measured paths, (2) closed SCV/DRV inject demos, (3) connector Production certification, (4) compliance depth, (5) zoo-diluted demo surface.

### 2.3 Market presence — 1.15 / 5

| Presence proxy | Status in repo |
| --- | --- |
| Named customer references / logos / case studies | **None** |
| Design-partner program | API/UI modes exist; **session outcomes not claimed** (UI roadmap, previous Forrester report) |
| ARR / customer count / geography | **Not disclosed** |
| Payment / commercial checkout | **NotConfigured** |
| AWS Marketplace listing | App metering ready; **not Public** |
| Partner / SI / MSSP channel metrics | Architecture only |
| Brand / analyst mindshare | Internal 94-row scorecard only |
| NPS / retention | None |
| Third-party control-plane pen test | **Still open** for A-grade security (`docs/ANALYST_READINESS_ASSESSMENT.md`) |

**Forrester inclusion is presence-gated.** Product excellence cannot compensate for zero reference pack.

### 2.4 UI TaskSuccess (Wave demo fitness) — 3.1 / 5

| Signal | Value |
| --- | --- |
| Historical mean TaskSuccess (2026-07-13) | **2.6** (`docs/qa/ux-validation-2026-07-13.md`) |
| Trust (same panel) | **3.7** (category strength) |
| Post-release improvements | Needs-you queue, external workbench, claim-language Slice 1 — still **no claimed design-partner usability study results** |
| Surface sprawl | `SURFACE_INVENTORY.md` **50+ web routes**; dual nav (`primary-nav.tsx` + `app-navigation.ts`) |
| Primary rail zoo | `PRIMARY_NAV` exposes **Autonomous** group (Swarm, Workflows, Operators, Engagements, MCP) alongside proof loop |

Wave evaluators score **task completion on the category journey**, not route count. Trust language is Leader-adjacent; TaskSuccess is Contender-at-best until a single demo path is inevitable.

---

## 3. Findings (machine-parseable)

### FINDING | P13-1 | P0 | request | gtm | Zero customer reference pack blocks Wave inclusion
- **Persona:** Forrester Wave analyst
- **Evidence:** No named logos, case studies, or production reference customers in PRD, readiness, or QA docs; previous synthesis **U-25**; prior P13 reference readiness **Fail**; demo tenant `demo@periscan.local` / public `/demo` labeled sample
- **Problem:** Forrester Market Presence and inclusion diligence require production customers willing to speak. Lab E2E and design-partner checklists are not substitutes.
- **Impact:** Formal Wave participation is **blocked regardless of product quality**. Composite dragged to ~3.0 Contender; MQ/Wave narratives stay internal-only.
- **Recommendation:** Land ≥3 design-partner production tenants on weekly Validate→Remediate→Re-validate; produce NDA reference one-pagers (MTTR to verified Fixed, % Measured vs Heuristic, audit pack acceptance). Do not pursue Wave questionnaire until pack exists.
- **Effort:** XL
- **Zoo-related:** no
- **Previous-panel-link:** U-25

### FINDING | P13-2 | P0 | improvement | competitive | Scorecard inflation vs engineering honesty undermines analyst trust
- **Persona:** Forrester Wave analyst
- **Evidence:** `docs/qa/analyst-scorecard.json` scores Attack Path Validation **4.25 Leading** and Choke Point **4.5 Leading** while `docs/COMPETITIVE_COVERAGE_MATRIX.md` rates APV **Partial** and choke-points as pattern-attached (not min-cut); score remains **79.1** with note that completing slices does **not** auto-rescore (`ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`); synthesis **U-07**
- **Problem:** Internal “Leading” rows conflict with code-verified Partial/Scaffold verdicts. Analysts punish score theater harder than honest Partial.
- **Impact:** Sales decks and Wave answers built on inflated rows create diligence risk and credibility burn after demo.
- **Recommendation:** Blind independent rescore of all 94 rows against competitive matrix + Slice 2 evidence; freeze “Leading” without measured multi-hop receipts and live SCV inject proof. Align external claims to rescored floor.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P13-3 | P0 | feature | paths | Multi-hop measured attack paths remain the Wave offering cliff
- **Persona:** Forrester Wave analyst
- **Evidence:** Slice 3 status **Next** in score plan; `ANALYST_READINESS_ASSESSMENT.md` must #3 Partial for multi-hop; competitive matrix APV Partial; panel synthesis flags Slice 3 as **P0 competitive + CISO gate**
- **Problem:** Wave BAS/exposure demos live or die on path exploitability proof. Graph UX without measured edges is “pretty topology,” not Leader offering.
- **Impact:** Caps Current Offering ~3.x; evaluators default Periscan below Cymulate/AttackIQ/XM-class path stories unless honesty wedge is executed perfectly.
- **Recommendation:** Finish Slice 3: edge planning, durable hop receipts, measured-path recompute, before/after breaker proof. Make “measure hop → fix → re-measure” the first 8 minutes of every analyst demo.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (Slice 3)

### FINDING | P13-4 | P0 | feature | engines | Closed-loop SCV / DRV inject-and-observe incomplete for BAS Wave parity
- **Persona:** Forrester Wave analyst
- **Evidence:** Competitive matrix: SCV Partial (telemetry pull, no default stimulus→block/detect); DRV Scaffold (no inject-and-observe); readiness must #4 Partial; Atomic/live BAS gated/disabled by safety policy
- **Problem:** Classic Forrester BAS questions expect simulate → observe control → verdict with evidence. Observation-only efficacy is real but demo-weak vs category leaders.
- **Impact:** Offering scored Contender not Strong Contender on control validation criteria; “we correlate MITRE from SIEM” is table stakes, not Wave win.
- **Recommendation:** Ship governed SCV stimulus + DRV inject-and-observe behind policy/offensive flip with signed detect/block/log evidence. Demo one CrowdStrike/Splunk closed loop end-to-end; keep live kill-chain disabled.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-26

### FINDING | P13-5 | P0 | bug | nav | Feature zoo + dual nav destroy Wave demo TaskSuccess
- **Persona:** Forrester Wave analyst
- **Evidence:** `apps/web/src/lib/primary-nav.tsx` PRIMARY_NAV groups Prove / Investigate / Remediate / **Autonomous** / Operate / Intel…; `apps/web/src/lib/app-navigation.ts` APP_NAV_SECTIONS with parallel Core/Connect/Govern/Operate/Ecosystem/Reference (~40 items); `SURFACE_INVENTORY.md` 50+ routes; synthesis **U-03**, **U-16**; Jobs/Horowitz zoo themes
- **Problem:** Wave TaskSuccess rewards a single inevitable journey. Dual configs + Autonomous (Swarm/MCP/Workflows) on primary rail force evaluators into platform sprawl before proof.
- **Impact:** Historical TaskSuccess mean **2.6**; demo risk of leaving “interesting but unfinished platform” impression; Strategy presentation diluted.
- **Recommendation:** Single nav source; persona primary rail ≤10 items (Dashboard, Missions, Paths, Findings, Remediation, Schedules, Runners, Integrations, Reports, Evidence + Admin). Hide Autonomous/MCP/Swarm/Model Gateway under Labs until loop is boring.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P13-6 | P1 | improvement | integrations | Integration catalog is breadth-honest but depth-unproven for Wave ecosystem criteria
- **Persona:** Forrester Wave analyst
- **Evidence:** `docs/INTEGRATIONS.md`: **267** catalogued, **126** dedicated live, **141** Planned/NotConnectable, **~29** contract-tested; **all dedicated listed Beta**, none Production/Certified; competitive matrix “deep is uneven / mostly read-only”
- **Problem:** Forrester ecosystem criteria reward certified depth with production customers, not count of Beta clients. Honesty about Planned is excellent; all-Beta is a diligence red flag if marketed as “full coverage.”
- **Impact:** Ecosystem sub-score Contender not Leader; risk of “integration theater” accusation if demos only show catalog cards.
- **Recommendation:** Certify Production for top 12–15 ICP stack (e.g. CrowdStrike, Sentinel, Splunk, Wiz, Tenable, Okta/Entra, Jira, ServiceNow, AWS/Azure, GitHub, ConnectWise). Publish certification criteria + live-smoke pass dates. Keep Planned non-connectable.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-27 / U-28 (integrate, don’t replace)

### FINDING | P13-7 | P1 | feature | integrations | Missing scan-file importers weakens VM-adjacent Wave narratives
- **Persona:** Forrester Wave analyst
- **Evidence:** Competitive matrix Unified data fabric Partial: live API per connector only; **no `.nessus`/CSV/SARIF** first-class importers; prior Forrester report §6
- **Problem:** Enterprise bake-offs often start from incumbent Tenable/Qualys export reality, not greenfield API credentials day one.
- **Impact:** Longer PoC setup; loses “sit on top of existing RBVM” co-existence story vs pure API dependency.
- **Recommendation:** Add signed, scoped file importers for Nessus/CSV/SARIF with evidenceBasis=Imported; map into unified findings without claiming Measured.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-28

### FINDING | P13-8 | P1 | improvement | onboarding | UI TaskSuccess lag vs Trust creates asymmetric Wave story
- **Persona:** Forrester Wave analyst
- **Evidence:** UX validation 2026-07-13: TaskSuccess **2.6**, Trust **3.7**; silent empty-catch governance failures; evidence chain hard to verify in UI; bulk triage gaps; later slices improved claim language / external workbench but **no claimed multi-customer usability study**
- **Problem:** Wave scoring separates product capability from “ease of use / operator productivity.” Trust alone does not win TaskSuccess criteria.
- **Impact:** Contender UX band; F1000 bake-off risk; evaluators may trust the engineering yet doubt day-2 ops.
- **Recommendation:** Five ICP first-session studies (`docs/qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`); measure time-to-first Measured finding and time-to-verified Fixed; fix silent write failures; surface integrity verify in Evidence UI.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** theme (TaskSuccess)

### FINDING | P13-9 | P1 | request | gtm | Market presence near-zero: payment, Marketplace listing, partner metrics
- **Persona:** Forrester Wave analyst
- **Evidence:** `paymentProcessorStatus: "NotConfigured"` (runtime-services billing catalog + acceptance criteria PRD §17); AWS Marketplace runbook app-side ready, listing not Public; no partner count/SI program metrics in docs
- **Problem:** Presence scores need commercial availability, distribution, and channel — architecture is not presence.
- **Impact:** Market Presence ~1.15; composite cannot reach Strong Contender overall even if Offering rises.
- **Recommendation:** Invoice design partners first; Limited Marketplace listing when metering proven; publish MSSP partner kit (2–3 SIs) with delivery playbooks. Avoid self-serve card processing before references exist (aligns Horowitz freeze).
- **Effort:** XL
- **Zoo-related:** no
- **Previous-panel-link:** theme (peacetime GTM shell)

### FINDING | P13-10 | P1 | improvement | competitive | Category positioning must be AEV/proof-layer, not full multi-vector BAS peer
- **Persona:** Forrester Wave analyst
- **Evidence:** Competitive matrix Fully-E2E only **7** buckets; Scaffold/Missing for APT, phishing, malware, DNS exfil, OT; synthesis U-26–U-31; safety floor forbids uncontrolled exploit chaining
- **Problem:** If Forrester evaluates Periscan as pure BAS library peer, multi-vector gaps dominate scoring. If evaluated as CTEM execution / AEV proof layer, honesty + fix-verify can win Strategy and selected Offering criteria.
- **Impact:** Mis-positioning guarantees Contender ceiling or Incomplete offering narrative.
- **Recommendation:** External brief: “CTEM proof layer that measures exposure and proves fixes; complements Wiz/Tenable/Microsoft; does not replace full BAS libraries or human red team.” Refuse malware/phishing live parity as success criteria.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-26

### FINDING | P13-11 | P1 | bug | copy | Competing proof-loop vocabularies confuse Wave questionnaire answers
- **Persona:** Forrester Wave analyst
- **Evidence:** Synthesis **U-02**: product stages vs CTEM radar vs marketing tagline; primary-nav “Prove/Investigate/Remediate” vs score plan “Discover → validate → remediate → revalidate → evidence” vs PRD “Find the path. Validate the risk. Prove it's fixed.”
- **Problem:** Wave questionnaires demand consistent process mapping. Three vocabularies force evaluators to invent their own mapping.
- **Impact:** Demo friction; questionnaire inconsistency; perceived immaturity despite strong core.
- **Recommendation:** One vocabulary product-wide (recommend PRD/score-plan loop); map CTEM phases as secondary labels only; purge marketing tagline collisions in UI chrome.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P13-12 | P1 | improvement | compliance | Compliance packs thin relative to regulated Wave buyers
- **Persona:** Forrester Wave analyst
- **Evidence:** Competitive matrix Compliance attestations **Scaffold** — pack types without control catalog mapping; score claims pressure vs engineering honesty; synthesis **U-24**; UX audit historically found control→evidence mapping weak
- **Problem:** DORA/NIS2/PCI/ISO buyers ask for control-ID → measured evidence → pass/gap. Generic packs with disclaimers fail diligence.
- **Impact:** Regulated vertical Wave scenarios lose to vendors with attestation depth.
- **Recommendation:** For 2–3 frameworks only, ship control matrix linked to measured evidence and last-validated date; keep “does not assert certification” disclaimer; demote Leading compliance claims until matrix ships.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-24

### FINDING | P13-13 | P1 | request | security | External control-plane pen test still open (trust pack gap)
- **Persona:** Forrester Wave analyst
- **Evidence:** `ANALYST_READINESS_ASSESSMENT.md`: Security posture **B+**, A blocked on **external pen test**; production deploy/perf external; previous CISO NO-BUY as platform-of-record
- **Problem:** Wave security diligence and buyer questionnaires expect independent assessment summary process, not only internal isolation matrices.
- **Impact:** Enterprise reference customers and inclusion confidence delayed; Market Presence adjacent trust signals missing.
- **Recommendation:** Commission independent pen test of control plane + runner; publish executive summary process for NDA diligence; close runner mTLS default-on for prod (synthesis U-20).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-20

### FINDING | P13-14 | P1 | improvement | gtm | Wave demo script must ruthlessly exclude feature zoo
- **Persona:** Forrester Wave analyst
- **Evidence:** Routes include `/swarm`, `/mcp`, `/model-gateway`, `/workflows`, `/operators`, `/engagements`, AI apps, NHI, registries; competitive matrix documents swarm/kill-chain **fixtures** (`Math.random()`, `simulated:true`); synthesis anti-fabrication excellence vs Autonomous rail
- **Problem:** Showing scaffold AI/swarm surfaces during Wave demo invites “is this real?” questions that burn the honesty brand.
- **Impact:** Contender demos become Incomplete demos; Strategy points lost in the room.
- **Recommendation:** Official Wave/demo script: 7–10 screens only — Dashboard Needs-you → Mission/External validation → Path (measured hop) → Finding → Remediation retest → Evidence pack → Integrations honesty → Reports. Label `/demo` sample. Labs only if asked.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P13-15 | P2 | feature | evidence | Evidence chain integrity under-exposed in product surfaces
- **Persona:** Forrester Wave analyst
- **Evidence:** UX validation: `verifyEvidenceChain` largely library/test-bound; UI historically showed SHA without chain verify action; flagship differentiator hard to *demonstrate* in product
- **Problem:** Wave differentiator “tamper-evident evidence” must be operable in demo, not only in unit tests.
- **Impact:** Trust score high in engineering review; TaskSuccess low when evaluator asks “prove the chain.”
- **Recommendation:** Expose verify endpoint + UI “Verify integrity / Verify chain” with pass/fail and first broken seq; always surface download integrityVerified flags.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme (evidence explorer Slice 7)

### FINDING | P13-16 | P2 | improvement | mssp | MSSP architecture is Wave-positive; commercial packaging is not
- **Persona:** Forrester Wave analyst
- **Evidence:** Competitive matrix MSSP multi-tenancy Fully-E2E arch; PSA/RMM connectors (ConnectWise, Autotask, Halo, NinjaOne, etc.) Beta; billing NotConfigured; portfolio routes exist
- **Problem:** Forrester weights channel/partner presence. Product multi-tenancy without live MSSP references and billing is Strategy potential only.
- **Impact:** Strategy MSSP wedge under-monetized for presence; MSSP Wave scenario incomplete.
- **Recommendation:** One paying or design-partner MSSP portfolio reference; QBR report path proven; invoice packaging before processor.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (Horowitz wedge)

### FINDING | P13-17 | P2 | bug | remediation | Remediation ticket CTA gaps hurt mobilization criteria
- **Persona:** Forrester Wave analyst
- **Evidence:** Synthesis **U-12**: ticket create missing on remediation detail (exists on snapshot); practitioner/blue panel
- **Problem:** CTEM mobilization = hand-off to ITSM. Broken ticket path mid-loop is a TaskSuccess and offering gap.
- **Impact:** Find-fix-verify story incomplete in operator UI; Wave “workflow integration” demos stutter.
- **Recommendation:** Parity: create ticket on remediation detail with same connectors as snapshot; show ticket URL on Fixed journey.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-12

### FINDING | P13-18 | P2 | improvement | ops | Blind independent rescore and release qualification required before external analyst pursuit
- **Persona:** Forrester Wave analyst
- **Evidence:** Score plan Slice 10 “Release qual + blind rescore”; score stuck at 79.1 until fresh row-by-row rescore; analyst-score-gate exists but delivery ≠ automatic score lift
- **Problem:** Self-scored 95.9 targets are not Forrester evidence. Blind rescore is the only internal analog of Wave questionnaire discipline.
- **Impact:** Premature external analyst engagement risks credibility event.
- **Recommendation:** After Slices 3–5 land: freeze claims, run blind rescore, only then start Wave RFI prep. Gate sales decks on rescored numbers.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme (Slice 10)

### FINDING | P13-19 | P2 | innovation | competitive | Honesty architecture is the rare Wave Strategy asset — productize it as criteria, not apology
- **Persona:** Forrester Wave analyst
- **Evidence:** Measured vs Heuristic enforcement; anti-fabrication acceptance suite; Planned≠connectable (Slice 1); Fixed demotion on retest; denied-never-queued; Ed25519 runner provenance (`ANALYST_READINESS_ASSESSMENT.md` A on truthfulness)
- **Problem:** Vendors usually hide partiality. Periscan surfaces it — evaluators may misread honesty as incompleteness unless framed as **buyer risk reduction**.
- **Impact:** Without narrative packaging, honesty loses BAS “wow” demos; with packaging, Strategy approaches Leader band.
- **Recommendation:** Wave response appendix: “Claim language contract” mapping every customer-visible term to evidence state machine. Lead demos with a Heuristic path that **refuses** Validated until measured. Make honesty the category criterion.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme (protect forever)

### FINDING | P13-20 | P3 | request | auth | Enterprise identity residuals (SCIM/JIT, recovery routes) affect buyer and presence narratives
- **Persona:** Forrester Wave analyst
- **Evidence:** Synthesis **U-01** auth recovery routes gated; **U-19** no SCIM/JIT, group→role, force-MFA policy; acceptance criteria mention SCIM/SSO enterprise exit language vs incomplete self-serve UX history
- **Problem:** Wave enterprise criteria include identity lifecycle. Incomplete recovery/SSO self-serve hurts Ability-to-Execute perception even when API exists.
- **Impact:** Enterprise buyer RFP friction; slows reference customer onboarding.
- **Recommendation:** Public auth recovery + `?next=` honor; document SCIM decision or sales-assisted SLA; do not claim full SCIM E2E until proven.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-01 · U-19

---

## 4. Top 5 moves to reach 5.0 (Wave lens)

| # | Move | Why it moves the Wave graphic |
| --- | --- | --- |
| 1 | **≥3 production customer references** on weekly proof loop | Unlocks Market Presence / inclusion; without this, max composite stays Contender |
| 2 | **Slice 3 measured multi-hop + hop CTA green** | Lifts Current Offering APV from Contender cliff toward Strong Contender |
| 3 | **Governed SCV/DRV inject-and-observe** (one flagship SIEM/EDR pair) | BAS-adjacent offering parity without abandoning safety floor |
| 4 | **Kill feature zoo for demos** — single nav, Labs for Autonomous, ≤10-screen script | Raises TaskSuccess / demo fitness; protects Strategy presentation |
| 5 | **Certify top 15 integrations Production + blind 94-row rescore** | Ecosystem + claim integrity survive diligence; freeze inflated Leading rows |

**Then (presence tail):** Limited Marketplace/commercial offer, pen-test summary pack, 2–3 SI/MSSP partners, invoice GTM.

---

## 5. Feature-zoo / IA notes (Wave demo impact)

### Cut / demote (Labs or Settings until loop is boring)

| Surface | Why Wave-hostile |
| --- | --- |
| `/swarm`, Agent Swarm | Fixture/sim paths in competitive matrix — honesty risk in live demo |
| `/mcp`, MCP Server | Platform adjacency; not CTEM buyer first hour |
| `/model-gateway` | Infrastructure; confuses exposure-validation story |
| `/workflows`, `/operators`, `/engagements` | Autonomous theater before proof loop inevitable |
| Dual Dashboard vs Command center / dual nav configs | Evaluator cognitive load |
| OT/dark-web/phishing pack claims | Scaffold/Missing — do not demo as ready |

### Merge

| Merge | Into |
| --- | --- |
| Threat Center + Threat Feed + Signal Activity | One **Intel** workbench |
| Validation Ops + Schedules + Missions ops chrome | One **Validation operations** home |
| Data fabric + Assets & Scope naming | Single authorized-targets workspace |
| `APP_NAV_*` + `PRIMARY_NAV` | **One** nav source of truth |

### Rename (Wave questionnaire alignment)

| Avoid | Prefer |
| --- | --- |
| Multiple loop slogans | Single: **Discover → Validate → Remediate → Revalidate → Prove** |
| “Agent Swarm” on primary rail | “Labs · Autonomous (preview)” |
| “Leading” without measured receipts | “Strong model / Partial measured” honesty labels |

### Keep primary (Wave hero path)

1. Dashboard (Needs you)  
2. Validation Snapshot / External validation  
3. Attack Paths (measured hop)  
4. Findings  
5. Remediation (+ ticket + retest)  
6. Evidence (integrity verify)  
7. Reports / executive pack  
8. Integrations (live + Planned honesty)  
9. Runners / Schedules  
10. Admin / Trust & Safety  

---

## 6. What is already excellent (do not break)

1. **Proof architecture** — Measured vs Heuristic; Fixed only after re-measurement; can demote Fixed.  
2. **Anti-fabrication discipline** — acceptance gates; real-first rule; Planned ≠ connectable.  
3. **Safety floor** — verified scope, denied-never-queued, outbound signed runner, non-destructive default.  
4. **Runner provenance** — Ed25519 task/result signing path proven in readiness program.  
5. **External validation workbench (Slice 2)** — authorized internet-facing loop.  
6. **Unified findings + EXV explainability** — prioritization without raw scanner dump.  
7. **Integration honesty** — 141 Planned not falsely connectable; fixture connectors hidden by default.  
8. **MSSP multi-tenant architecture** — isolation + portfolio shape.  
9. **API-first control plane** — automation/MSSP headless readiness.  
10. **Labeled sample demo** — `/demo` not sold as customer proof.  
11. **Competitive self-assessment culture** — rare vendor honesty in matrices.  
12. **Score plan gate** — excluded non-ASV rows cannot silently re-enter core scorecard.

---

## 7. Path: Contender → Strong Contender → Leader (Forrester)

```
TODAY (Composite ~3.0 Contender, Inclusion = NO)
│
├─ Gate A — Presence (blocks inclusion)
│   ├─ 3 production references + case metrics
│   ├─ Commercial path (invoice / Limited Marketplace)
│   └─ Trust pack (pen test summary process, support narrative)
│
├─ Gate B — Offering depth (exits weak Contender)
│   ├─ Slice 3 measured multi-hop default journey
│   ├─ SCV/DRV inject-and-observe with signed evidence
│   ├─ Top-15 connectors Production-certified
│   └─ Compliance matrix for 2–3 frameworks
│
├─ Gate C — Demo / Execute fitness
│   ├─ Single nav + vocabulary
│   ├─ Labs for Autonomous zoo
│   ├─ TaskSuccess ≥4.0 in ICP studies
│   └─ Blind rescore; kill inflated Leading
│
└─ THEN
    ├─ Strong Contender composite (~3.6–3.9) once A+B partially land
    ├─ Wave-includable once Gate A complete
    └─ Leader-band Strategy possible; Leader Offering needs multi-customer measured path + control validation depth at scale
```

| Stage | Strategy | Offering | Presence | Inclusion |
| --- | --- | --- | --- | --- |
| **Now** | 3.8 | 3.25 | 1.15 | **No** |
| **+6 mo (if focused)** | 4.0 | 3.7 | 2.5 | Maybe confidential shortlist |
| **+12 mo (references + Slices 3–5 + cert)** | 4.2 | 4.0 | 3.2 | **Yes — Contender/Strong Contender Wave seat** |
| **Leader** | 4.5+ | 4.5+ | 4.0+ | Requires category mindshare + multi-geo customer base not evidenced today |

**Explicit non-goals for Wave trajectory** (agree previous panel): full BAS library parity, live Caldera/Atomic/SharpHound production, CNAPP parity with Wiz, self-serve payment before design partners, more AI/swarm surfaces before hero loop.

---

## 8. Wave inclusion checklist (print)

| Prerequisite | Status 2026-07-29 |
| --- | --- |
| ≥3 speakable production references | **Fail** |
| Case studies with measured outcomes | **Fail** |
| Commercial availability (Marketplace/SaaS offer) | **Partial** (product ready; listing/payment not) |
| Independent security assessment | **Open** |
| Measured multi-hop path demo default | **Partial / Slice 3 next** |
| Closed SCV/DRV inject demo | **Partial** |
| Connector Production cert (top stack) | **Fail** (all Beta) |
| Claim language / anti-fabrication green | **Pass** (protect) |
| Score inflation controlled (blind rescore) | **Fail** |
| Demo path ≤10 screens, zoo off primary rail | **Fail** |
| **Formal Wave inclusion** | **No** |

---

## 9. Recommended Forrester narrative (if briefed today)

**Do say**

- CTEM execution platform that **proves** exposure and **proves** fix closure.  
- Fixed is a **re-measurement**, not a disposition.  
- Every conclusion is Measured or Heuristic; we refuse fabricated exploit metrics.  
- Scope, policy, and outbound runners make production-safe continuous validation possible.  
- Integration catalog is broad and **honest about Planned vs live**.  
- We complement CNAPP/RBVM/Microsoft stacks; we do not replace them.

**Do not say**

- False-positive-free / full autonomous APT as default.  
- Production-certified for entire 267 catalog.  
- Customer logos, ARR, or ROI without evidence.  
- Leading multi-hop exploitability without edge receipts.  
- Compliance packs equal certification.  
- Swarm/MCP as core CTEM proof (unless explicitly Labs).

---

## 10. Panel confidence

| Claim type | Confidence |
| --- | --- |
| Strategy / honesty architecture | **High** |
| Offering Partial/Scaffold vs Fully-E2E from matrices + code status docs | **Medium–High** (matrices dated 2026-07-05; Slice 2 landed later; score still 79.1 unre-scored) |
| Market presence absence | **High** (no contrary commercial evidence in repo) |
| UI TaskSuccess absolute level post-July UI work | **Medium** (strong ship notes; no 2026-07-29 independent multi-persona TaskSuccess re-score) |
| Wave composite ~3.0 Contender | **High** as proxy; **not** a paid Forrester score |

---

## 11. Bottom line

Periscan already owns a **Strategy-grade wedge** (proof integrity) and **Contender offering spikes** (EXV, measured fix verification, safety, integration honesty). It fails **Market Presence**, **customer reference readiness**, and several **Current Offering cliffs** (multi-hop measured paths, BAS inject loop, certified integration depth). The **feature zoo** actively harms Wave TaskSuccess and demo discipline.

**Accurate label for leadership and sales:**

> **Strong Contender strategy · Contender current offering · Pre-Wave market presence · Composite Contender (~3.0) · Not Wave-includable until references and measured path/control demos exist.**

**Highest ROI order for Contender→Leader path:** references → Slice 3 paths → SCV/DRV inject → nav/demo zoo collapse → top-N connector certification → blind rescore → trust/presence pack.

*End of exhaustive panel persona `13-forrester-analyst.md`. Contract: PROMPT_CONTRACT.md. Previous themes: PREVIOUS_PANEL_SYNTHESIS.md.*
