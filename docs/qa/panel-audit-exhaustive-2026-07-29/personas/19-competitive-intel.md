# Panel P19 — Competitive Intelligence (Exhaustive)

| Field | Value |
| --- | --- |
| **Persona** | Competitive Intelligence — AEV/CTEM market map, claim proof, deny-list, feature-zoo vs focused peers |
| **Date** | 2026-07-29 |
| **Repo** | `/Volumes/DataSSD1/test/periscan` |
| **Mode** | Docs- and code-grounded; adversarial; **docs only** (no product changes) |
| **Contract** | `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md` |
| **Prior consensus** | `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` (U-26–U-31, “Complement, don't replace”) |
| **Primary sources** | `PRD.md` competitive §; `docs/COMPETITIVE_COVERAGE_MATRIX.md`; `docs/COMPETITIVE_FEATURE_STRATEGY.md`; `docs/ANALYST_CAPABILITY_MATRIX.md`; `docs/qa/analyst-scorecard.json` (79.1/95.9); `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`; `packages/shared/src/claim-language.ts`; `SECURITY_BOUNDARIES.md`; `docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md` (Engine Lab); `docs/OPEN_SOURCE_VALIDATION_ENGINES.md`; `apps/web/src/lib/primary-nav.tsx`; `packages/modules/src/index.ts`; `packages/connectors/src/{index,scan-importers}.ts`; `docs/generated/module-certification-report.md`; `apps/web/app/*` route surface |

---

## 1. Verdict (this lens)

**Score: 3.1 / 5.0** — *Complement-layer Contender; not a category replacement.*

**5.0 definition (Competitive Intel):** Buyers and analysts can place Periscan in one sentence against every named peer, every public claim is code-backed or explicitly denied, scorecards match the competitive matrix, the UI tells a focused story (not a zoo), and at least one differentiator (proof loop **or** Engine Lab) is product-visible enough that a design partner would choose Periscan *in addition to* Wiz/Tenable/MS without a feature bake-off loss.

| Dimension | Score | Notes |
| --- | ---: | --- |
| Positioning clarity (home category) | 4.0 | AEV/CTEM **proof layer** is the correct home; PRD + strategy docs agree |
| Claim honesty vs code | 4.0 | `claim-language`, Fixed-only-on-retest, Planned≠connectable are real |
| Competitive gap closure (Wiz/Tenable/BAS/Pentera/Nuclei/MS) | 2.5 | Gaps correctly self-documented; demos still lose library/graph/VM bake-offs |
| Score governance (scorecard ↔ matrix) | 2.0 | Leading rows where matrix says Partial/Scaffold = trust risk (U-07) |
| Packaging / zoo discipline | 2.0 | ~35–50 destinations; Autonomous rail on primary nav |
| Engine Lab as GTM weapon | 2.5 | Strong plan + installer bones; **not** product surface yet |
| Co-existence story (don't replace) | 4.0 | Prior panel U-26–U-31 correct; product still implies platform-of-record |

**Buy / use posture (competitive):** **Complement, don't replace** Wiz, Tenable, Microsoft Defender platform stack, AttackIQ/Cymulate BAS libraries, Pentera-style auto-pentest, or bare Nuclei SaaS. Sell as the **measured proof + fix-verify + governed engine** plane that sits on top of those tools.

Agrees with previous synthesis: U-26–U-31, U-07, U-16, U-24, U-25; Jobs/Horowitz “feature zoo”; Forrester Contender ~3.0 / not Wave-includable.

---

## 2. Competitive map (one slide, code-verified)

| Competitor | Category they own | Periscan today | Honest posture | Win condition |
| --- | --- | --- | --- | --- |
| **Wiz** | CNAPP / cloud graph / inventory | Real Wiz connector (`createWizConnector`) + inventory signals; **not** a cloud graph peer | **Integrate / co-sell** | Correlate Wiz inventory → measured path hop → Fixed retest |
| **Tenable** | RBVM / vuln inventory | Real Tenable VM connector; Nessus parse in `scan-importers.ts` (library); **no apps/web import UX found** | **Validation layer on top of RBVM** | Import/sync vulns → exploitability-honest queue → prove closure |
| **AttackIQ** | Enterprise BAS / control efficacy | SCV = telemetry pull + MITRE correlate; Atomic `liveSupported: false`; no inject-and-observe default | **Proof-first SCV**, not library peer | Governed safe stimulus + signed detect/block receipts |
| **Cymulate** | Multi-vector BAS + threat library demos | Scheduling Fully-E2E; multi-vector malware/phish/DNS-exfil **Missing**; AI-BAS Scaffold | **Refuse library bake-off** | Continuous measured revalidation + honesty labels |
| **Pentera** | Automated pentest / kill-chain | Offensive modules gated; kill-chain/live Caldera/Metasploit disabled; no live chaining | **Governed continuous proof**, not auto-RT | Multi-hop **measured** edges + never-lift floor as selling point |
| **Nuclei** (project / SaaS wrappers) | Cheap external template scan | `nuclei.external_exposure_safe` live, allowlisted profiles only | **Wrap Nuclei; compete on workflow/proof** | Scope→policy→evidence→remediate→retest, not template count |
| **MS Defender** (XDR / M365) | Platform gravity / endpoint + email telemetry | Defender XDR + O365 connectors real; technique stamping tests exist | **Complement cross-stack / MSSP** | Use Defender telemetry for SCV; never claim to replace Defender |

**Coverage matrix snapshot** (`docs/COMPETITIVE_COVERAGE_MATRIX.md`, 2026-07-05): **7 Fully-E2E · 17 Partial · 7 Scaffold · 4 Missing**. Product scorecard still **79.1/100** with many **Leading** verdicts on rows the matrix treats as Partial.

---

## 3. Unique claims — proof or deny

### Claims that **are** defensible today (lead every deal)

| Claim | Proof surface |
| --- | --- |
| **Measured vs Heuristic is first-class** | `evidenceBasis`; defaults Heuristic; `deriveAttackPathClaim` weakest-hop (`packages/shared/src/claim-language.ts`) |
| **“Fixed” only after measured retest** | `buildVerificationResult` / remediation honesty tests; domain forbids analyst-asserted Fixed |
| **Automated revalidation can demote stale Fixed** | Competitive matrix Fully-E2E; scheduler re-verify path |
| **Denied work never queues** | Policy engine + SECURITY_BOUNDARIES |
| **Outbound signed-task runner (no reverse shell default)** | Runner verify/dispatch; Agents.md hard rule |
| **Planned connectors are not connectable** | 126 dedicated live + 141 Planned/NotConnectable; Slice 1 complete |
| **No fabricated swarm metrics in prod path** | Matrix honesty fix (commit family noted in matrix); anti-fabrication acceptance tests |

### Claims that must stay on the **deny-list** (sales / marketing / UI)

| Deny claim | Why (code/docs) |
| --- | --- |
| “We replace Wiz / full CNAPP” | Inventory ingest ≠ cloud graph / toxic combination engine |
| “We replace Tenable / RBVM” | Connector + scoring ≠ full vuln lifecycle / scanner estate |
| “Full multi-vector BAS like Cymulate/AttackIQ” | DRV inject Scaffold; SCV no default stimulus; malware/phish/DNS-exfil Missing |
| “Autonomous pentest / APT like Pentera/Horizon3” | `liveSupported: false` on Caldera/Atomic live/Metasploit; kill-chain not live even with approval |
| “False-positive-free” without qualifier | Exploitability framework honest; evidence base still often Heuristic |
| “Exploitable path” without fully measured edges | Claim language blocks `canClaimExploitable` unless fully Measured + state |
| “Includes GPL engines in SaaS image” | Engine Lab plan: customer-side upstream install; no silent redistribution |
| “Compliance certified / DORA-ready out of box” | Pack types exist; control catalog mapping Scaffold / thin |
| “Live Atomic / Caldera / SharpHound / Metasploit” | Policy-blocked / legal-review / liveSupported false |
| “Microsoft-native CTEM replacement” | Defender is telemetry peer; platform gravity favors MS for M365-only buyers |
| “Score = 95+ / Leading on multi-hop paths” | Scorecard Leading on APV/choke points while Slice 3 still open; matrix Partial |

---

## 4. Findings (machine-parseable)

### FINDING | P19-1 | P0 | improvement | competitive | Own AEV/proof home; refuse BAS library bake-offs
- **Persona:** Competitive Intelligence
- **Evidence:** `docs/COMPETITIVE_COVERAGE_MATRIX.md` (SCV Partial, DRV Scaffold, multi-vector Missing); `atomic.control_validation_safe` `liveSupported: false` in `packages/modules/src/index.ts`; prior panel U-26
- **Problem:** GTM still lists ASV/CTEM leaders including Cymulate/AttackIQ/Picus as direct peers (`PRD.md`) while the honest matrix shows Periscan loses classic “simulate → detect/block” library demos.
- **Impact:** Sales demos that open with scenario catalogs lose to AttackIQ/Cymulate in minutes; positioning noise undermines the real wedge.
- **Recommendation:** Publish a one-page battlecard: **Home = AEV/CTEM proof layer**. Explicit “we do not sell scenario-library BAS parity.” Demo script order: verified scope → measured probe → Fixed demotion → evidence pack. Train SE to walk away from full BAS RFPs or partner.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-26

### FINDING | P19-2 | P0 | improvement | competitive | Co-exist with Wiz — never “replace CNAPP”
- **Persona:** Competitive Intelligence
- **Evidence:** `createWizConnector` inventory/signals in `packages/connectors/src/index.ts`; matrix hybrid-network Partial; no Wiz-class toxic combo / DSPM depth claimed in Fully-E2E list
- **Problem:** Integration breadth can be misread as CNAPP parity. Buyers with Wiz already will RFP-compare graph features Periscan does not own.
- **Impact:** Lost deals or forced feature zoo expansion into Wiz’s moat (worst use of roadmap).
- **Recommendation:** Integration marketplace copy + sales deck: **“Bring Wiz inventory; we prove which path is real and whether the fix held.”** Ship a named “Wiz → Attack Path → Remediation” recipe (docs + mission pack). Do not build CNAPP UI.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-27

### FINDING | P19-3 | P0 | improvement | competitive | Co-exist with Tenable — validation on top of RBVM
- **Persona:** Competitive Intelligence
- **Evidence:** Tenable VM connector real; `packages/connectors/src/scan-importers.ts` parses `.nessus`/CSV/SARIF; **zero** `scan-import` references under `apps/`; competitive strategy still lists importers as Build-next for product fabric
- **Problem:** Differentiator “we prove exploitability on your Tenable findings” is blocked by incomplete product path for scan import and by RBVM-replacement ambiguity.
- **Impact:** Nuclei-cheap + Tenable-deep win pure vuln conversations; Periscan never enters the room as the closure-proof layer.
- **Recommendation:** Productize scan import (API route + Integrations UI “Import Nessus/SARIF”) wired into signal fabric; battlecard: **Tenable finds; Periscan validates & verifies fix.** Keep Tenable as system of vuln record.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-28

### FINDING | P19-4 | P0 | improvement | competitive | Pentera gap is deliberate — weaponize the safety floor
- **Persona:** Competitive Intelligence
- **Evidence:** `SECURITY_BOUNDARIES.md` (no destructive/exfil/persistence/credential theft/uncontrolled chaining); Metasploit/Caldera/SharpHound live blocked; Agents.md “Do Not Touch”; matrix APT/autonomous pentest Scaffold
- **Problem:** Against Pentera/Horizon3, “we also do autonomous pentest” is a losing claim and a safety/legal risk. Silence or soft parity language still invites bake-offs.
- **Impact:** Either overclaim (trust death) or under-explain (buyer thinks Periscan is “weaker RT”).
- **Recommendation:** Deny-list phrase: **“not automated pentest.”** Positive phrase: **“governed continuous validation with a hard floor that never lifts.”** Competitive win = auditability + Fixed honesty + MSSP multi-tenant, not kill-chain theater. Keep live offensive kits disabled without approval to change policy.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-29

### FINDING | P19-5 | P1 | improvement | competitive | Nuclei is commodity — compete on authorized workflow
- **Persona:** Competitive Intelligence
- **Evidence:** `nuclei.external_exposure_safe` liveSupported true; allowlisted profiles only (`README.md` safe-baseline/fingerprint/headers/metadata); Slice 2 external-validation workbench complete per score plan
- **Problem:** Any team can run Nuclei cheaper. Competing on template count or “scan depth” is a race to the bottom (U-30).
- **Impact:** Pure-EASM buyers pick ProjectDiscovery Cloud / open Nuclei; Periscan looks expensive unless proof-loop packaging is the story.
- **Recommendation:** Market **authorized External PoA**: verified scope → policy preview → bounded profiles → normalized findings → remediation → retest ledger. Never lead with “we run Nuclei.” Hide raw template branding per `OPEN_SOURCE_VALIDATION_ENGINES.md`.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-30

### FINDING | P19-6 | P1 | improvement | competitive | Microsoft Defender = gravity; complement only
- **Persona:** Competitive Intelligence
- **Evidence:** Defender XDR + Defender for Office 365 connectors and technique tests (`packages/connectors/src/microsoft-defender-technique.test.ts`); enterprise-readiness labels; prior U-31
- **Problem:** M365-centric enterprises default to Microsoft Secure Score / Defender XDR exposure narratives. Periscan cannot win “rip out Defender.”
- **Impact:** Enterprise RFPs written around MS stack ignore pure-play AEV unless co-existence is explicit.
- **Recommendation:** Battlecard: **Defender for endpoint/email telemetry; Periscan for cross-stack path proof, external PoA, hybrid/non-MS assets, MSSP multi-client evidence.** Build one “Defender technique → control coverage → miss/logged-only” demo path; never claim SIEM/XDR replacement (agrees Blue Team prior panel).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-31

### FINDING | P19-7 | P0 | bug | gtm | Scorecard inflation vs competitive matrix (trust poison)
- **Persona:** Competitive Intelligence
- **Evidence:** `docs/qa/analyst-scorecard.json` Attack Path Validation **4.25 Leading**, Choke Point **4.5 Leading**; matrix APV **Partial**, choke-point **Partial** (pattern breakers not min-cut); score plan Slice 3 still **Next**; prior U-07
- **Problem:** Internal “Leading” language will leak into sales decks and analyst questionnaires while multi-hop measured edges remain incomplete.
- **Impact:** Analyst / CISO credibility failure worse than a low score — **overclaim is anti-brand for a proof vendor**.
- **Recommendation:** Freeze export of Leading for rows where matrix ≠ Fully-E2E or Slice incomplete. Blind rescore (Slice 10). Map scorecard verdicts 1:1 to matrix Fully-E2E/Partial/Scaffold. Sales must use matrix language until rescore.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P19-8 | P0 | improvement | proof-loop | Flagship differentiator still Slice-3 gated
- **Persona:** Competitive Intelligence
- **Evidence:** `deriveAttackPathClaim` blocks Validated/Exploitable without full measured edges; score plan Slice 3 open; capability matrix A-grade musts #1/#3 Partial
- **Problem:** The only story that beats Wiz+Tenable+BAS combo is **measured multi-hop path + choke + Fixed**. That journey is not yet the default customer path.
- **Impact:** Demos fall back to graph theater (heuristic paths) — competitors already have prettier graphs (XM Cyber/Wiz).
- **Recommendation:** Do not open new product surface until hop measure CTA + receipt durability + correlation honesty are green (U-05/U-06). Competitive KPI: **% of demo paths with fullyMeasured=true**.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-05

### FINDING | P19-9 | P0 | feature | engines | Engine Lab is the latent category weapon — still a plan
- **Persona:** Competitive Intelligence
- **Evidence:** `docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md` status **Plan (not implemented as full product surface)**; foundations: `tool-install.ts`, third-party-tools APIs, Tool Governance UI at `/registries`; primary nav still **“Tool Governance”** not **Engines**
- **Problem:** Focused competitors ship engines pre-bundled or ignore license honesty. Periscan’s **governed upstream install** (license accept → digests → enable → use) is a unique GTM story vs “we include nmap” or “gray-area redistribution” — but operators only see admin marketplace cards.
- **Impact:** Missed differentiation vs Nuclei SaaS (no governance) and vs BAS vendors (closed scenario packs). MSSP/legal buyers who care about SPDX never see the easy button.
- **Recommendation:** Execute Engine Lab Phases 0–2: rename Operate→**Engines**, one-button install sheet, empty-state deep links from modules missing tools. Market as **“proof engines, App Store-style, your license, our safety gates.”** Do not claim product readiness until UI v1 ships.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P19-10 | P1 | bug | engines | Module license dual-truth undermines Engine Lab credibility
- **Persona:** Competitive Intelligence
- **Evidence:** Prior U-04; certification report shows many modules `Proprietary` while tool catalog carries real OSS licenses; OSS advocate panel ~7.3/10
- **Problem:** Competitive claim “we respect upstream licenses and never silently redistribute” collapses if module metadata lies.
- **Impact:** Procurement / OSS audit fails; Engine Lab launch becomes a liability event.
- **Recommendation:** Align module SPDX with toolchain catalog before any Engine Lab GTM; regenerate certification report (stale 2026-06-24, ~40 modules vs expanded set — U-18).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P19-11 | P1 | improvement | nav | Feature zoo vs focused peers (AttackIQ/Cymulate/Wiz ship a spine)
- **Persona:** Competitive Intelligence
- **Evidence:** `PRIMARY_NAV` groups Prove/Investigate/Remediate/**Autonomous**/Operate/Intel/Govern — items include Agent Swarm, MCP, Machine Identities, Threat Feed + Threat Center + ATT&CK, Validation Ops + Signal Activity, Tool Governance, Packs, Model-adjacent surfaces; dual nav configs noted in prior panel; ~50 `apps/web/app` routes
- **Problem:** Focused BAS/CNAPP competitors present one hero workflow. Periscan presents a platform mall. Autonomous rail (swarm/workflows/mcp) appears before proof loop is inevitable.
- **Impact:** Competitive demos dilute; evaluators score “unfocused Contender” (Forrester prior ~3.0); Horowitz wartime critique reinforced.
- **Recommendation:** Persona rail ≤10: Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin). Move Autonomous + MCP + Swarm + Model Gateway to **Labs**. Merge Threat Center/Feed/ATT&CK; merge Validation Ops/Signal Activity; rename Tool Governance → Engines when Lab ships.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03, U-16

### FINDING | P19-12 | P1 | improvement | competitive | Control validation loses AttackIQ demos without stimulus
- **Persona:** Competitive Intelligence
- **Evidence:** Matrix SCV Partial / DRV Scaffold; control-ai dry-run; `control_live_execution_disabled`; Blue Team prior: validation plane not SIEM
- **Problem:** AttackIQ’s buying moment is “we fired a technique and your control did/didn’t fire.” Periscan’s ambient telemetry correlation is real but **not the same product moment**.
- **Impact:** Blue-team RFP line-items for “breach and attack simulation” score Periscan Partial forever.
- **Recommendation:** Build one governed safe-stimulus path (single technique family) with marker evidence; keep library breadth out of scope. Competitive message: **“one proven inject loop beats 5,000 simulated scenarios without receipts.”** Align with Slice 5.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-26

### FINDING | P19-13 | P1 | improvement | competitive | Compliance Leading claims vs scaffold packs (regulated RFP lose)
- **Persona:** Competitive Intelligence
- **Evidence:** Matrix compliance attestations Scaffold (generic renderer, no control catalog mapping); scorecard and nav still promote Compliance as primary Prove item; prior U-24
- **Problem:** DORA/NIS2/PCI buyers compare control-mapping depth. Thin packs + Leading language = competitive own-goal.
- **Recommendation:** Demote Compliance nav priority until matrix → Partial with real control→evidence maps. Sales deny-list: “we make you DORA compliant.” Allow: “we attach measured validation evidence to framework claims.”
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-24

### FINDING | P19-14 | P1 | feature | integrations | Integration breadth is real — depth uneven vs market leaders
- **Persona:** Competitive Intelligence
- **Evidence:** ~126 dedicated live clients; 141 Planned/NotConnectable; `market-leaders.ts` mock scaffolds called out in matrix; mostly read-only pulls
- **Problem:** “106/126 integrations” sounds like ServiceNow-class ecosystem; competitors with 20 deep bidirectional integrations win enterprise RFPs on operational depth.
- **Impact:** Analysts discount breadth (Forrester already notes uneven depth); sales overpromises “deep native.”
- **Recommendation:** Publish **connectable vs planned vs mock** counts in marketplace and security questionnaire. Top-N stack (Wiz, Tenable, CrowdStrike, Splunk/Sentinel, Jira/ServiceNow, AWS/Azure/GCP, Defender, GitHub) get GA depth badges; stop expanding catalog as competitive KPI.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P19-15 | P1 | request | gtm | No customer references → Wave/MQ automatic fail
- **Persona:** Competitive Intelligence
- **Evidence:** Forrester panel market presence ~1.2; prior U-25; design-partner protocol exists without closed sessions claimed
- **Problem:** Competitive win rate vs named vendors is unknowable without references; analyst inclusion impossible.
- **Impact:** Even perfect product scores cannot convert enterprise pipeline.
- **Recommendation:** Three design partners on the narrow wedge only (external PoA + fix verify + one path). Capture referenceable quote on **Fixed demotion** and **Measured labels**. Do not pursue Wave/MQ until references exist.
- **Effort:** XL (program, not engineering)
- **Zoo-related:** no
- **Previous-panel-link:** U-25

### FINDING | P19-16 | P2 | innovation | engines | OSS engine adapter framework as anti-Nuclei-SaaS moat
- **Persona:** Competitive Intelligence
- **Evidence:** `docs/OPEN_SOURCE_VALIDATION_ENGINES.md`; adapter contract, policy, redaction, certification, third-party intake industrial complex; raw tool branding not primary UX
- **Problem:** Moat is governance + evidence normalization, but product still feels like a tool catalog admin UI rather than a curated engine OS.
- **Impact:** Competitors can wrap Nuclei/Trivy without Periscan’s safety story if Periscan doesn’t productize governance as the benefit.
- **Recommendation:** Position Engine Lab + certified modules as **“security tool runtime with proof SLAs”** — innovate on install/verify/enable UX and mission deep-links, not on adding more uncertified tools.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P19-17 | P2 | improvement | competitive | Choke-point “Leading” overstates graph science vs XM Cyber / Wiz
- **Persona:** Competitive Intelligence
- **Evidence:** Scorecard choke point 4.5 Leading; matrix Partial (per-pattern `pathBreakers`, not min-cut/dominator); capability matrix partial measured edges
- **Problem:** Path analytics competitors win on graph math narrative. Periscan has good UX labels, weaker algorithm story.
- **Impact:** Bake-off loss on “show me the single cheapest control to break 40 paths.”
- **Recommendation:** Either implement real choke solver (strategy Build-next) or re-label product copy to **“evidence-backed path breakers”** and remove Leading. Prefer honesty until algorithm ships.
- **Effort:** L (solver) / S (relabel)
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P19-18 | P2 | improvement | competitive | Auto-mitigate naming vs AttackIQ/RemOps expectations
- **Persona:** Competitive Intelligence
- **Evidence:** Matrix Auto-Mitigate Scaffold — endpoint chains planner→verify, **no config push**; remediation service comments admit non-push
- **Problem:** Competitors (and buyers) hear “auto-mitigate” as control tuning. Current name is a claim hazard.
- **Impact:** RFP checkbox fails or trust hit when demo cannot push WAF/firewall change.
- **Recommendation:** Rename product/API surface to **Auto-revalidate** until real approved control push exists. Competitive honesty > feature-name parity.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P19-19 | P2 | feature | competitive | Continuous cadence gap vs “always-on” BAS marketing
- **Persona:** Competitive Intelligence
- **Evidence:** Scheduling Fully-E2E Daily/Weekly/Monthly; matrix notes no sub-daily continuous; Cymulate/AttackIQ market “continuous validation”
- **Problem:** Cadence language in marketing may overshoot product.
- **Impact:** Minor RFP loss on “continuous” checkbox; mitigable with honest scheduling + drift triggers.
- **Recommendation:** Claim **scheduled + revalidation + signal-triggered** (what exists). Add sub-daily only when ops-proven. Do not use “continuous” without qualifier.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P19-20 | P1 | improvement | gtm | Deny-list must be productized (shared claim-language for GTM)
- **Persona:** Competitive Intelligence
- **Evidence:** Strong code claim-language for paths; SECURITY_BOUNDARIES for actions; no single customer-facing “what we never claim” page; PRD competitive § mixes ambition with honesty
- **Problem:** Engineering honesty does not automatically reach SE decks, website, or Wave questionnaires.
- **Impact:** One overclaiming AE destroys years of Measured/Heuristic architecture.
- **Recommendation:** Ship `/trust-safety` or public doc section: **Capabilities we prove / Capabilities we integrate / Capabilities we refuse.** Align with deny-list in §3. Require sales enablement review on every new nav item in Autonomous.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme (proof not claims)

---

## 5. Score vs matrix (governance table)

| Source | Headline | Competitive reading |
| --- | --- | --- |
| `analyst-scorecard.json` | **79.1 / 100**, target 95.9, many **Leading** | Internal aspiration tracker — **unsafe for external claims** |
| `COMPETITIVE_COVERAGE_MATRIX.md` | **7 Fully-E2E / 17 Partial / 7 Scaffold / 4 Missing** | **External-safe** capability honesty |
| `ANALYST_CAPABILITY_MATRIX.md` | A-grade musts mostly Partial on active adversarial loop | Aligns with matrix more than scorecard Leading |
| Score plan Slice 3 | **Next** (measured paths) | Confirms APV Leading is premature |
| Previous panel U-07 | Score inflation | **Confirmed this panel** |

**Rule for GTM:** Public competitive statements may cite matrix Fully-E2E only. Scorecard numbers stay internal until blind rescore post–Slice 3–5.

---

## 6. Feature-zoo / IA notes (cut · merge · rename · demote)

| Action | Item | Competitive rationale |
| --- | --- | --- |
| **Demote → Labs** | Agent Swarm, Agent Workflows, MCP Server, Model Gateway (if primary) | Peers don’t put unfinished AI theater next to BAS core; dilutes proof wedge |
| **Merge** | Threat Center + Threat Feed + ATT&CK | One intel surface; Cymulate has library, not three nav entries |
| **Merge** | Validation Ops + Signal Activity | Ops peers expect one operations desk |
| **Rename** | Tool Governance → **Engines** (Engine Lab) | Productize differentiator vs admin jargon |
| **Rename** | Auto-mitigate → Auto-revalidate | Claim honesty vs RemOps peers |
| **Demote** | Compliance (until mapping real) | Avoid regulated bake-off loss |
| **Keep primary** | Dashboard, Paths, Findings, Remediation, External Validation, Schedules, Runners, Integrations, Reports, Evidence | Hero loop = only competitive answer |
| **Cut from ICP demo** | Machine Identities, Packs, Engagements (until path measured default) | Zoo noise vs Wiz/Tenable focused tours |
| **Do not build** | Full BAS library, CNAPP parity, live kill-chain, MS Secure Score clone | Prior panel consensus; this panel reaffirms |

---

## 7. Top 5 moves to reach 5.0 on this lens

1. **Freeze claim surface:** public deny-list + matrix-only Fully-E2E language; kill Leading export for Partial rows (P19-7, P19-20).  
2. **Ship measured multi-hop as the only flagship demo** (Slice 3) — competitive KPI `fullyMeasured` (P19-8).  
3. **Battlecards for Wiz / Tenable / AttackIQ / Cymulate / Pentera / Nuclei / Defender** with explicit co-existence (P19-1–P19-6).  
4. **Engine Lab UI v1 + license metadata truth** — make governed engines the second wedge after Fixed honesty (P19-9, P19-10).  
5. **Collapse nav to proof rail; hide Autonomous** — look like a focused Contender, not a zoo (P19-11).  

Bonus for market 5.0: **three design-partner references** (P19-15) — without them, competitive score caps ~3.5 regardless of code.

---

## 8. What is already excellent (do not break)

1. **Proof-not-claims architecture** — Measured/Heuristic, weakest-hop claim language, Fixed only on retest, Fixed demotion.  
2. **Self-documented competitive matrix** — rare vendor honesty; protect and keep code-verified.  
3. **Safety floor** — verified scope, denied-never-queued, outbound runner, legal gates on SharpHound/Caldera/Atomic live.  
4. **Connector honesty** — Planned ≠ connectable (post Slice 1).  
5. **External validation workbench (Slice 2)** — real answer to “authorized Nuclei with workflow.”  
6. **MSSP multi-tenant architecture** — real scale wedge peers often bolt on later.  
7. **Anti-fabrication cleanup** — swarm/kill-chain random metrics removed from the honesty narrative.  
8. **Unified findings + evidence integrity plumbing** — substrate competitors fake with PDF theater.  
9. **OSS adapter + governance bones** — foundation for Engine Lab moat.  
10. **Explicit real-first / no-raw-scanner-UX policy** — correct vs Nuclei SaaS identity trap.

---

## 9. Dissent / agreement with previous panel

| Theme | Stance |
| --- | --- |
| Complement, don’t replace (U-26–U-31) | **Strong agree** — restated with evidence per peer |
| Feature zoo (U-03, U-16, Jobs/Horowitz) | **Agree** — primary competitive UX failure mode |
| Score inflation (U-07) | **Agree — elevates to P0 for GTM** |
| Engine Lab | **Extend** prior panel (under-scoped): treat as **P0/P1 differentiator program**, not ops cleanup |
| Wave not ready (Forrester) | **Agree** — references + measured path + claim freeze required |
| “Visionary / lagging execute” MQ hypothetical | **Agree** — strategy docs better than demo default journey |

---

## 10. Bottom line

Periscan’s competitive truth is sharp: **it is not Wiz, not Tenable, not AttackIQ/Cymulate, not Pentera, not Nuclei Cloud, and not Microsoft Defender.** It is the **evidence-honest proof and fix-verification layer** that should sit beside them — with a second latent weapon in **Engine Lab** (governed upstream engines) that is still a plan.

Until multi-hop measurement is the default demo, scorecards stop saying Leading where the matrix says Partial, Autonomous is off the primary rail, and Engine Lab is a real product surface, competitive posture stays **Complement Contender (≈3.1)** — exactly as the previous panel synthesis warned.

---

*End of panel P19 competitive intelligence. Output path: `docs/qa/panel-audit-exhaustive-2026-07-29/personas/19-competitive-intel.md`.*
