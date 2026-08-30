# Panel P12 — Gartner Analyst (Magic Quadrant / Hype Cycle)

| Field | Value |
| --- | --- |
| **Persona** | Gartner Analyst — Adversarial Exposure Validation (AEV), Continuous Threat Exposure Management (CTEM), BAS-adjacent Automated Security Validation |
| **Date** | 2026-07-29 |
| **Repo** | `/Volumes/DataSSD1/test/periscan` |
| **Mode** | Docs- and code-grounded self-audit (not a paid MQ evaluation; no customer interviews; no vendor questionnaire under Gartner rules) |
| **Score snapshot** | Internal ASV/CTEM matrix **79.1 / 95.9** on 94 rows (`docs/qa/analyst-scorecard.json`, assessed 2026-07-16; still frozen pending blind rescore) |
| **Previous panel** | Visionary · Ability to Execute **~2.9** — AEV/CTEM proof, not full BAS (`PREVIOUS_PANEL_SYNTHESIS.md`) |
| **Primary sources** | `PROMPT_CONTRACT.md`, `PREVIOUS_PANEL_SYNTHESIS.md`, `PRD.md`, `docs/ANALYST_CAPABILITY_MATRIX.md`, `docs/ANALYST_READINESS_ASSESSMENT.md`, `docs/COMPETITIVE_COVERAGE_MATRIX.md`, `docs/COMPETITIVE_FEATURE_STRATEGY.md`, `docs/qa/analyst-scorecard.json`, `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`, `docs/qa/ANALYST_REQUIREMENTS_2026_AUDIT.md`, `docs/qa/HANDOFF.md`, `docs/qa/panel-audit-2026-07-29/SURFACE_INVENTORY.md`, `docs/qa/panel-audit-2026-07-29/13-forrester-analyst.md`, `apps/web/src/lib/primary-nav.tsx`, `apps/web/src/lib/app-navigation.ts`, `SECURITY_BOUNDARIES.md` |

---

## 1. Verdict (Gartner lens)

### 1.1 5.0 definition (this persona)

**5.0 = Magic-Quadrant Leaders-band candidacy** for the **AEV / CTEM proof-execution** category:

1. **Completeness of Vision ≥ 4.5** — one crisp category sentence, published wedge that matches demos, explicit in/out scope vs BAS/CNAPP/RBVM, partner + GTM narrative buyers can restate.
2. **Ability to Execute ≥ 4.3** — measured multi-hop paths as the *default* journey; closed SCV/DRV stimulus loops customers will reference; Production-certified top-N stack; enterprise trust pack; ops evidence at multi-tenant scale.
3. **Market presence** — ≥3 named production references (confidential OK) completing Validate→Remediate→Re-validate weekly; commercial path (invoice or Marketplace) not `NotConfigured`-only; no Leading claim without current blind evidence.
4. **Analyst diligence survival** — scorecard, competitive matrix, and product UI agree; partner-gated rows do not appear as “Leading platform features”; demo does not visit feature zoo.
5. **Hype honesty** — marketed as AEV/proof layer on the **Slope of Enlightenment**, not Peak-of-Inflated-Expectations “autonomous red team / 50k exploit library.”

### 1.2 Scores today

| MQ / Hype axis | Score (0–5) | Band |
| --- | ---: | --- |
| **Completeness of Vision** | **3.7** | Strong Visionaries / approaching Leaders *vision* only if packaging collapses |
| **Ability to Execute** | **2.85** | Niche Players → Visionaries execute lag (pre-reference, flagship path partial) |
| **Market presence / viability proxy** | **1.3** | Pre-MQ inclusion (no public refs, payment/Marketplace not production-commercial) |
| **Internal scorecard integrity (meta)** | **2.5** | Useful engineering index; **not** safe as external analyst narrative until blind rescore |
| **Hype Cycle placement (product)** | Innovation Trigger → early Peak risk | Honesty architecture is real; surface language still flirts with Peak theater (Autonomous/Swarm/MCP) |

**Hypothetical MQ placement today:** **Visionaries** (CoV mid–high, AtE low–mid).  
**Not Leaders. Not Challengers.** Niche only if vision is scored harshly for BAS library absence — which is the wrong category frame.

**Composite readiness for formal Gartner MQ participation:** **No.**  
**Composite readiness for design-partner / controlled pilot narrative:** **Yes**, with disciplined AEV framing.

**One-line analyst verdict:**  
*Periscan has category-defining Completeness of Vision for **proof-native AEV/CTEM execution**, but Ability to Execute is still design-partner grade: measured multi-hop is not the default journey, several “Leading” scorecard rows contradict code-grounded Partial/Scaffold truth, partner- and AI-frontier rows inflate the core matrix, and market presence is insufficient for MQ inclusion.*

**Agree / dissent vs previous panel:** **Agree** with Visionary · Execute ~2.9, U-07 scorecard inflation, U-25 no references, U-16 Autonomous rail demotion, U-26 AEV-not-BAS home. **Dissent lightly** on any reading that treats internal **79.1 → 95.9** as an external MQ readiness metric — that number is an *engineering coverage index*, not Ability to Execute.

---

## 2. Category placement (must get this right or every score is wrong)

### 2.1 Correct home market

| Category | Fit | Analyst instruction |
| --- | --- | --- |
| **Adversarial Exposure Validation (AEV)** | **Home** | Lead briefings here: paths, exploitability proof, control efficacy, continuous revalidation |
| **CTEM program execution / ASV platform** | **Co-home** | Scope → Discover → Prioritize → Validate → Mobilize → Verify loop is the product spine |
| **Full multi-vector BAS** (Cymulate/AttackIQ/Picus library demos) | Partial / substitute | Do **not** enter as pure BAS; library and live multi-vector are honest gaps |
| **CNAPP / cloud graph** (Wiz-class) | Integrate | Co-sell; do not claim replacement |
| **RBVM** (Tenable-class) | Integrate / fabric | Validation layer on top of imported/live vulns |
| **Autonomous pentest** (Pentera-class) | Complement | Safety floor forbids destructive/exfil/persistence; refuse live kill-chain peer framing |
| **SIEM / XDR** | Upstream telemetry | Blue-team plane only |

**Category sentence for Gartner questionnaires (recommended):**

> Periscan is a **proof-native AEV and CTEM execution platform**: it validates exposure and attack paths under verified scope, measures control detect/block where authorized, and **only marks Fixed after re-measurement**, with cryptographic runner provenance and explicit Measured vs Heuristic labeling.

### 2.2 Hype Cycle caution

AEV/CTEM as markets sit near **Peak of Inflated Expectations** in buyer language (“autonomous red team,” “false-positive-free,” “full kill chain”). Periscan’s engineering culture is deliberately **anti-Peak**. That is Completeness of Vision gold — **unless** primary nav and Autonomous surfaces re-inflate the Peak story (Agent Swarm, MCP, multi-agent orchestration scored Leading). Analyst diligence will score the **UI and scorecard**, not only the PRD.

---

## 3. MQ scorecard (proxy)

### 3.1 Completeness of Vision (3.7 / 5)

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Market understanding | 4.5 | PRD + competitive strategy: “proof, not claims”; Fixed only on retest; anti-fabrication |
| Marketing strategy | 2.5 | Strong internal docs; external GTM still design-partner; Autonomous/Swarm dilutes message |
| Sales strategy / packaging | 2.5 | Metering catalog real; payment processor `NotConfigured`; AWS Marketplace app-side, not Public |
| Offering / product strategy | 4.2 | Sequenced slices 1–10; north-star loop clear; Slice 1–2 complete |
| Business model | 3.0 | MSSP multi-tenant + packs; short/long subscription rows exist; commercial ops incomplete |
| Vertical / industry strategy | 2.5 | Compliance pack *types* exist; control→evidence depth uneven; OT/dark-web partner-gated |
| Innovation | 4.3 | Honesty architecture, signed runners, revalidation demotion of Fixed — rare |
| Geographic strategy | 1.5 | No localized GTM evidence in product footprint |

**Vision strengths:** truth-as-architecture; CTEM loop intent; safety as strategy; API-first; MSSP scale wedge.  
**Vision risks:** feature zoo as “platform vision”; BAS-adjacent Peak language; partner rows and AI-agent protocol rows crowding AEV criteria.

### 3.2 Ability to Execute (2.85 / 5)

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Product / service (core loop) | 3.4 | Measured fix-verify, external workbench, risk/EXV real; multi-hop Measured still Slice 3 “Next” |
| Overall viability | 2.0 | No disclosed production customer base / refs / ARR in repo |
| Sales execution / pricing | 2.0 | Pre-commercial packaging |
| Market responsiveness | 3.5 | Fast honesty cleanup (Slice 1), external workbench (Slice 2) |
| Marketing execution | 2.0 | Demo labeled sample; design-partner checklist exists; no case studies |
| Customer experience | 2.8 | Historical TaskSuccess ~2.6; rail sprawl; hop CTA residual (U-05) |
| Operations | 3.0 | Verify gates strong; external pen test unclaimed; scale unproven |
| Geographic / channel | 2.0 | MSSP architecture > channel program metrics |

**Execute strengths:** engineering discipline, tests, claim-language gates, connector Planned≠connectable honesty.  
**Execute blockers:** references, measured multi-hop default journey, SCV/DRV closed loop demos, scorecard inflation, enterprise GTM pack, feature-zoo demo failure mode.

### 3.3 Illustrative MQ graphic (not Gartner-official)

```
Ability to Execute →
                Low                    High
         ┌──────────────────┬──────────────────┐
  High   │   VISIONARIES    │     LEADERS      │
  CoV    │  ★ Periscan now  │   (target 5.0)   │
         ├──────────────────┼──────────────────┤
  Low    │  NICHE PLAYERS   │   CHALLENGERS    │
         └──────────────────┴──────────────────┘
```

---

## 4. Findings (machine-parseable)

### FINDING | P12-1 | P0 | improvement | competitive | Category home is AEV/CTEM proof — not full BAS
- **Persona:** Gartner Analyst (MQ category placement)
- **Evidence:** `PRD.md` north star; `docs/COMPETITIVE_COVERAGE_MATRIX.md` pillars APV/SCV Partial, DRV Scaffold, APT/kill-chain Scaffold; previous panel U-26; `docs/ANALYST_CAPABILITY_MATRIX.md` Rubric A (Gartner AEV + CTEM).
- **Problem:** Competing as multi-vector BAS library peer (malware/phishing/DNS-exfil/ransomware live packs) forces a losing Ability-to-Execute comparison against Cymulate/AttackIQ/Picus demos.
- **Impact:** Wrong RFI shortlists, failed demo shoot-outs, MQ criteria misalignment (evaluators score missing packs as vision failure).
- **Recommendation:** Publish external category page and sales one-pager: **AEV/CTEM proof layer**. Explicit out-of-scope list for live destructive multi-vector. Co-exist matrix for Wiz/Tenable/Microsoft. Train every SE on “we measure paths and prove Fixed.”
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-26

### FINDING | P12-2 | P0 | improvement | competitive | Visionaries placement is correct; Leaders requires Execute, not more vision docs
- **Persona:** Gartner Analyst (MQ axes)
- **Evidence:** CoV assets in `COMPETITIVE_FEATURE_STRATEGY.md` + anti-fabrication; AtE gaps in `ANALYST_READINESS_ASSESSMENT.md` (multi-hop Partial, control injection Partial); market presence empty of references (previous U-25); score 79.1 frozen.
- **Problem:** Internal culture over-invests in matrices/score plans relative to customer-reference Ability to Execute.
- **Impact:** Self-perception as near-Leader while MQ diligence would place Visionary / pre-inclusion.
- **Recommendation:** Treat **referenceable measured multi-hop + SCV inject + 3 design-partner proofs** as the only Leaders path. Cap new CoV surfaces until AtE moves.
- **Effort:** L (program, not a single feature)
- **Zoo-related:** yes
- **Previous-panel-link:** theme — Visionary · Execute ~2.9

### FINDING | P12-3 | P0 | bug | gtm | Scorecard inflation: Leading rows vs Partial/Scaffold engineering truth
- **Persona:** Gartner Analyst (score integrity / diligence risk)
- **Evidence:** `docs/qa/analyst-scorecard.json`: Attack Path Validation **Leading 4.25**, Choke Point **Leading 4.5**, SCV **Leading 4.5**, DRV **Leading 4.25**, Multi-Agent Orchestration **Leading 4.5**, A2A Artifact Exchange **Leading 4.25** (Partner). Contrast `COMPETITIVE_COVERAGE_MATRIX.md`: APV **Partial**, choke-point **Partial** (pattern breakers not min-cut), SCV **Partial** (no stimulus), DRV **Scaffold**, AI-BAS/swarm historically fixture-cleaned. Score plan states score stays 79.1 until **fresh row-by-row rescore**; Slice 3 still **Next**.
- **Problem:** Internal “Leading” language would not survive Gartner product diligence or a skeptical CISO RFP cross-walk.
- **Impact:** Sales decks and MQ self-scores become liability; previous panel U-07; CISO NO-BUY risk.
- **Recommendation:** Immediate freeze: no external “Leading” claim. Run **Slice 10 blind rescore** with independent owner; downgrade APV/SCV/DRV/choke until measured-edge ratio and inject loops pass demos. Cap product/function at 4 when engineering matrix says Partial.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P12-4 | P0 | improvement | competitive | Flagship Execute gap: measured multi-hop not default journey
- **Persona:** Gartner Analyst (AEV must-have)
- **Evidence:** `ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md` Slice 3 Next; `ANALYST_READINESS_ASSESSMENT.md` must #3 Partial multi-hop; HANDOFF 2026-07-26 “Continue with Slice 3”; previous U-05 hop CTA Eligible/NeedsApproval deadlock; surface inventory hopKey work in flight.
- **Problem:** AEV questionnaires weight entry→objective measured edges. Graph UX + Heuristic paths read as model completeness without execution completeness.
- **Impact:** Contender/Visionary ceiling; cannot truthfully answer “prove lateral exploitability” in MQ RFI.
- **Recommendation:** Make Slice 3 the only P0 product bet: edge plan → policy → receipts → recompute path → before/after breaker. Kill hop CTA deadlock. Demo script = one multi-hop measured path, not swarm.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-05 · Slice 3

### FINDING | P12-5 | P0 | feature | engines | SCV/DRV closed loop incomplete while scorecard says Leading
- **Persona:** Gartner Analyst (control validation criteria)
- **Evidence:** Scorecard rows 6 and 8 Leading; competitive matrix SCV Partial / DRV Scaffold; ANALYST matrix “telemetry Met / injection Partial”; strategy doc Build-next for governed stimulus and inject-and-observe.
- **Problem:** Gartner AEV and BAS-adjacent criteria expect **inject → observe detect/block/log**, not only ambient telemetry correlation.
- **Impact:** Peer demos crush “control validation Leading” claims; Execute score permanently capped.
- **Recommendation:** Ship governed safe stimulus + uniquely tagged DRV marker with signed evidence. Until then rename product claims to **Control Observation / Rule Coverage** externally.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-26 · competitive theme

### FINDING | P12-6 | P0 | improvement | gtm | Zero customer references → MQ Market Presence / viability fail
- **Persona:** Gartner Analyst (inclusion bar)
- **Evidence:** Demo `demo@periscan.local` / sample labeling; design-partner APIs exist; ICP protocol exists; previous U-25; Forrester panel Market Presence **1.2**.
- **Problem:** Formal MQ inclusion and Leaders-band viability require production deployments customers will discuss (even confidentially).
- **Impact:** Hypothetical MQ stays Visionary/Niche; sales cycles stall at security review without peer proof.
- **Recommendation:** Three ICP design partners with weekly proof-loop SLAs; capture MTTR-to-Fixed, measured-edge %, control miss discoveries. Do not pursue paid MQ inquiry until refs exist.
- **Effort:** XL (GTM + delivery)
- **Zoo-related:** no
- **Previous-panel-link:** U-25

### FINDING | P12-7 | P1 | improvement | gtm | Partner-gated rows still shape the “core” 94-row narrative
- **Persona:** Gartner Analyst (score composition / portfolio honesty)
- **Evidence:** `analyst-scorecard.json` `dependency: Partner` on rows including **Dark Web & Credential Monitoring (2)**, **OT/ICS (26)**, **Crowdsourced HITL (28)**, **A2A Protocol/Cards/Tasks (35–37)**, **A2A Artifact Exchange (38, Leading 4.25)**, **AgentDID (49)**; Slice 9 explicitly partners rows **2, 16, 21, 22, 26, 28**.
- **Problem:** Partner-gated capabilities belong in an appendix or “ecosystem” criteria set. Scoring them (especially Strong/Leading AI-protocol rows) pollutes AEV Completeness of Vision and confuses roadmap ROI.
- **Impact:** Leadership chases partner theater; evaluators ask for dark-web/OT demos the product does not own.
- **Recommendation:** Split scorecard presentation: **Core AEV (owner=None)** vs **Partner/Ecosystem**. Cap Partner rows at Strong only with live partner SOW evidence; never Leading without joint customer proof. Slice 9: honest “partner-gated” UI, not fake readiness.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** Slice 9 · U-07

### FINDING | P12-8 | P1 | improvement | ai-agents | Agent/A2A/MCP/Multi-Agent rows are peak-hype criteria inside an AEV matrix
- **Persona:** Gartner Analyst (Hype Cycle + criteria hygiene)
- **Evidence:** Scorecard Multi-Agent Orchestration **Leading 4.5**, MCP Host/Client Leading, A2A suite Strong/Leading+Partner; primary nav group **Autonomous** with Agent Swarm, Workflows, Operators, Engagements, MCP (`primary-nav.tsx`); previous U-16; competitive matrix AI-BAS scaffold after fabrication cleanup.
- **Problem:** These criteria belong to agent-platform or AI-security hype tracks, not the load-bearing AEV execute story. High scores create “platform company” vision while diluting proof-loop Execute.
- **Impact:** Analysts and buyers hear Peak language; Jobs/Horowitz/Palantir panel consensus: hide until loop is boring.
- **Recommendation:** Exclude or demote AI-protocol rows from external AEV briefings. Move Autonomous nav to Labs. Score Multi-Agent against *measured mission assembly*, not orchestration UX alone.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16

### FINDING | P12-9 | P1 | improvement | nav | Feature zoo dilutes category — ~35–50 destinations, dual nav configs
- **Persona:** Gartner Analyst (offering focus / demo fitness)
- **Evidence:** `SURFACE_INVENTORY.md` 50+ routes; `PRIMARY_NAV` groups Prove / Investigate / Remediate / **Autonomous** / Operate / Intel / Govern (~35+ items); dual `primary-nav.tsx` vs `app-navigation.ts`; previous U-03.
- **Problem:** MQ Current Offering demos reward a ruthless 7–10 screen path. Zoo reads as incomplete platform, not depth.
- **Impact:** Vision score drops when evaluators cannot restate the offering; AtE demo fails on navigation.
- **Recommendation:** Persona rail ≤10 for New tenants: Dashboard · Missions · Paths · Findings · Remediation · Schedules · Runners · Integrations · Reports · Evidence (+ Admin). Everything else Settings/Labs/MSSP role.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03

### FINDING | P12-10 | P1 | improvement | copy | Three proof-loop vocabularies break Completeness of Vision consistency
- **Persona:** Gartner Analyst (message integrity)
- **Evidence:** Previous U-02; PRD “Find the path. Validate the risk. Prove it's fixed.”; CTEM radar language; marketing/help variants; nav “Prove / Investigate / Remediate” vs CTEM stage names.
- **Problem:** Gartner scores vision coherence. Multiple loop dialects force evaluators to invent their own taxonomy.
- **Impact:** Lower CoV; longer RFPs; internal score plans and UI disagree on journey names.
- **Recommendation:** One vocabulary systemwide (product stages = CTEM stages or PRD three-act only). Align radar, nav, help, demo script, analyst one-pager.
- **Effort:** S–M
- **Zoo-related:** yes
- **Previous-panel-link:** U-02

### FINDING | P12-11 | P1 | improvement | gtm | GTM narrative is wartime honesty + peacetime shell
- **Persona:** Gartner Analyst (marketing/sales strategy criteria)
- **Evidence:** Ben Horowitz previous panel theme; payment/Marketplace incomplete (`IMPLEMENTATION_STATUS` billing NotConfigured pattern); strong internal honesty docs; live app exists (`app.periscan.com`) without public case studies.
- **Problem:** Ability to Execute includes go-to-market execution. Engineering truth without commercial packaging is Visionary default, not Challenger/Leader.
- **Impact:** Buyers cannot procure; analysts cannot place viability; MSSP architecture under-monetized.
- **Recommendation:** Invoice-first design-partner SKU (“Pay for what you validate” meters already exist). AWS Marketplace path to Limited listing. Freeze feature launch calendar until first three paid pilots.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme — Horowitz wartime honesty / peacetime GTM shell

### FINDING | P12-12 | P1 | improvement | competitive | Choke-point “Leading 4.5” overstates graph science
- **Persona:** Gartner Analyst (APV diligence)
- **Evidence:** Scorecard row 4 Leading 4.5; competitive matrix: pathBreakers are **pattern-attached**, not graph-wide min-cut/dominator; strategy says Build-next for real solver.
- **Problem:** Choke-point analysis is a named AEV differentiator for XM Cyber-class peers. Pattern strings ≠ computed cut set.
- **Impact:** Diligence call-out; inflated Execute subscore.
- **Recommendation:** External language: “prioritized breakers (pattern + evidence).” Ship min-cut/betweenness solver or drop Leading. Tie breakers to measured edges only for Leaders demos.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P12-13 | P1 | improvement | compliance | Compliance attestation depth thin for regulated MQ buyers
- **Persona:** Gartner Analyst (industry strategy / security & risk buyers)
- **Evidence:** Competitive matrix historically Scaffold generic packs; ANALYST_REQUIREMENTS_2026_AUDIT claims richer mapping later; scorecard has many compliance rows often scored high; reports disclaim certification status; previous U-24.
- **Problem:** DORA/NIS2/PCI buyers evaluate control→measured-evidence matrices. Generic packs fail board-level diligence.
- **Impact:** Vertical CoV weak; security & risk MQ-adjacent deals stuck.
- **Recommendation:** Two frameworks only (e.g. SOC 2-aligned validation evidence + one of DORA/PCI) with control catalog linked to measured claims. Park the rest as labeled stubs.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-24

### FINDING | P12-14 | P1 | request | integrations | Integration breadth is CoV asset; depth certification is AtE debt
- **Persona:** Gartner Analyst (ecosystem / partners)
- **Evidence:** 126 connectable vs 141 Planned/NotConnectable (HANDOFF); competitive Fully-E2E breadth; most clients read-only; contract-tested subset much smaller; Forrester panel top-15 Production cert.
- **Problem:** Catalog size impresses vision questionnaires; diligence asks “which are Production-certified against customer accounts?”
- **Impact:** Breadth advantage becomes credibility risk if Planned honesty is lost in sales decks.
- **Recommendation:** Publish external tier table (Production / Beta / Planned). Certify top 10 (SIEM/EDR/CNAPP/ITSM/IdP) with customer-credential evidence. Keep Planned non-connectable (Slice 1 win — protect).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none (aligns Forrester integration theme)

### FINDING | P12-15 | P1 | improvement | ops | Ops/security external validation still blocks Leaders-band Execute
- **Persona:** Gartner Analyst (operations / viability)
- **Evidence:** `ANALYST_READINESS_ASSESSMENT.md`: security A blocked on **external pen test**; scale B− needs production-like; deploy residual; previous U-19/U-20 enterprise/security themes.
- **Problem:** Ability to Execute includes product security posture and operational track record.
- **Impact:** Enterprise RFP and MQ security criteria fail independent of feature depth.
- **Recommendation:** Independent control-plane + runner pen test summary process; mTLS default-on for prod runners; one multi-tenant soak report. Attach to trust pack for design partners.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-19 · U-20

### FINDING | P12-16 | P2 | improvement | gtm | Internal 79.1→95.9 plan is not an MQ progress metric
- **Persona:** Gartner Analyst (score governance / narrative hygiene)
- **Evidence:** `analyst-scorecard.json` currentScore 79.1 target 95.9; plan completion contract is engineering evidence; score frozen after Slice 2; many rows include agent/TEE/A2A/NHI adjacent to pure AEV.
- **Problem:** Leadership may treat 95.9 as “Leaders ready.” Gartner does not score your internal matrix.
- **Impact:** Misallocated roadmap; premature analyst inquiry spend.
- **Recommendation:** Dual scoreboard: (A) engineering 94-row index internal-only; (B) **MQ proxy** = CoV/AtE table in this document + reference count + measured-edge ratio + Production connectors. Gate external claims on B only.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-07 · Slice 10

### FINDING | P12-17 | P2 | innovation | competitive | Honesty architecture is the Leaders differentiator — productize the trust metric
- **Persona:** Gartner Analyst (innovation / differentiation)
- **Evidence:** Measured vs Heuristic model; Fixed only after retest; Ed25519 runner provenance; anti-fabrication suite; Slice 1 weakest-hop claim contract; competitive strategy “proof, not claims.”
- **Problem:** Differentiator is architectural but under-instrumented as an executive metric competitors cannot fake.
- **Impact:** Vision strong; market education incomplete; buyers still compare library size.
- **Recommendation:** Dashboard trust metric: **% claims Measured**, **% Fixed that survived revalidation**, **denied-never-queued count**, **signature verification rate**. Put it on every executive report. That is MQ Innovation + CoV.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme — proof not claims (protect)

### FINDING | P12-18 | P2 | improvement | mssp | MSSP multi-tenancy is Execute wedge underplayed in GTM
- **Persona:** Gartner Analyst (business model / channel)
- **Evidence:** Competitive matrix MSSP Fully-E2E arch; portfolio UI; metering packs; payment not configured; white-label/GSI rows in scorecard.
- **Problem:** Channel/MSSP is a classic Challenger→Leader path for security platforms when direct enterprise brand is weak.
- **Impact:** Missed Ability-to-Execute via partners while chasing enterprise PoR too early (CISO panel NO-BUY as PoR).
- **Recommendation:** MSSP-first GTM: co-managed ASV packs, QBR reports, 2–3 trained partners, invoice metering. Use MSSP references as first MQ confidential refs.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none (Horowitz packaging adjacent)

### FINDING | P12-19 | P2 | caution | security | Safety floor is CoV strength — do not erode for BAS peer pressure
- **Persona:** Gartner Analyst (Hype + risk)
- **Evidence:** `SECURITY_BOUNDARIES.md` / Agents.md: no destructive, no exfil, denied never queued; offensive flip gated; kill-chain live disabled; competitive missing malware/phishing vectors.
- **Problem:** Peak-of-hype competitors will claim more “attack realism.” Responding with live APT theater destroys the honesty brand and legal posture.
- **Impact:** Category confusion or catastrophic trust loss.
- **Recommendation:** Explicit safety substitution catalog (what is simulated, what is measured, what is never done). Sell governed non-destructive AEV as the enterprise-grade answer. Partner human validation for residual (row 28).
- **Effort:** S–M
- **Zoo-related:** no
- **Previous-panel-link:** theme — safety floor protect

### FINDING | P12-20 | P2 | feature | onboarding | Design-partner mode is correct AtE scaffolding — instrument it for analyst evidence
- **Persona:** Gartner Analyst (customer experience / inclusion prep)
- **Evidence:** Design-partner API/checklist in acceptance docs; ICP research protocol; UI release notes claim no participant results yet; dual GetStarted vs Getting Started (U-09).
- **Problem:** Mode exists but does not yet produce the evidence MQ needs (journeys, outcomes, quotes).
- **Impact:** Stays lab product; Wave/MQ presence fail continues.
- **Recommendation:** One onboarding rail; require design-partner checklist completion metrics; export anonymized proof-loop KPIs for analyst briefings.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-09 · U-25

---

## 5. Top 5 moves to reach 5.0 (Leaders path)

| # | Move | Why Gartner cares | Maps to |
| --- | --- | --- | --- |
| **1** | **Close measured multi-hop as the default path journey** (Slice 3 + hop CTA + receipt durability) | AEV Ability to Execute core | P12-4, U-05, U-06 |
| **2** | **Blind rescore + kill Leading inflation** (APV/SCV/DRV/choke/agent rows); split Partner appendix | Diligence survival; CoV honesty | P12-3, P12-7, P12-8, P12-16 |
| **3** | **Three production design-partner references** with weekly proof-loop outcomes | Market presence / viability | P12-6, P12-20 |
| **4** | **Collapse zoo + one vocabulary + hide Autonomous** | Offering focus; demo fitness; Hype control | P12-9, P12-10, P12-8 |
| **5** | **SCV stimulus + DRV inject + top-10 connector Production cert + trust pack** | Control validation + ecosystem Execute | P12-5, P12-14, P12-15 |

**Secondary (still required before formal MQ inquiry):** invoice/Marketplace commercial path; MSSP partner program metrics; two-framework compliance depth; published AEV-not-BAS category narrative; trust metrics on executive dashboard (P12-17).

---

## 6. Feature-zoo / IA notes (cut · merge · rename · demote)

### Cut from primary rail / external AEV story
- Agent Swarm, MCP Server, Model Gateway, confidential-compute theater as first-run surfaces
- Dark web, OT/ICS, crowdsourced HITL as “platform complete” claims (partner appendix only)
- Full BAS multi-vector (malware/phishing/live ransomware) parity roadmap priority

### Merge
- Threat Center + Threat Feed + ATT&CK → one **Intel** workspace
- Validation Ops + Signal Activity + Schedules cadence views → **Continuous Validation**
- Dual nav configs → single `PRIMARY_NAV` source
- Dual first-run (GetStarted vs Getting Started) → one checklist

### Rename (honesty)
- “Security Control Validation Leading” → **Control Observation** until inject ships
- “Detection Rule Validation Leading” → **Rule Coverage / Telemetry Correlation** until inject-and-observe
- “Choke Point Leading” → **Prioritized Path Breakers** until graph solver
- “Auto-Mitigate” → **Auto-Revalidate** (code already does not push config)

### Demote to Labs / Admin / MSSP role
- Autonomous group entire
- A2A/AgentDID/TEE rows as product marketing
- White-label/GSI until one partner lives it
- Compliance packs beyond two deep frameworks

### Keep primary (category spine)
- Dashboard (Needs you) · Missions/Snapshot · Attack Paths · Findings · Controls · Remediation · External Validation · Schedules · Runners · Integrations · Reports · Evidence · Policies/Admin

---

## 7. What is already excellent (do not break)

1. **Proof-not-claims architecture** — Measured vs Heuristic, weakest-hop claim contract, Fixed only after re-measurement that can demote itself.  
2. **Anti-fabrication discipline** — single gate suite; swarm theater removal; Real-First rule.  
3. **Safety / authorization floor** — verified scope, denied-never-queued, outbound signed runner, kill switch, non-destructive defaults.  
4. **Slice 1 connector honesty** — Planned/NotConnectable cannot open fake credential setup.  
5. **Slice 2 external validation workbench** — task-complete authorized external loop.  
6. **Runner cryptographic provenance** (task/result signing direction) — category trust asset.  
7. **Evidence integrity** — SHA-256 write/read, evidence-linked claims.  
8. **EXV / explainable risk + continuous scheduling/revalidation** — Fully-E2E core per competitive matrix.  
9. **MSSP multi-tenant architecture** — real isolation hierarchy.  
10. **API-first surface + OpenAPI discipline** — automation and replacement-UI ready.  
11. **Competitive self-assessment culture** — rare analyst-friendly honesty in `COMPETITIVE_COVERAGE_MATRIX.md`.  
12. **Demo labeled sample** — not sold as customer proof.

These are Completeness of Vision **and** partial Ability to Execute foundations. Breaking them for Peak-hype demos would move Periscan *down* every Gartner axis.

---

## 8. Cautions (analyst diligence red lines)

| Caution | Why it fails diligence |
| --- | --- |
| Presenting **79.1/95.9** as market or MQ score | It is an internal engineering index with inflated Leading rows |
| Demo path that visits Swarm/MCP before a measured path | Signals Peak hype, weak Execute |
| Claiming **full BAS** or **FP-free** | Contradicts code and SAFETY_BOUNDARIES |
| Listing 267 connectors as equal depth | 141 Planned; most live are read-only |
| Compliance packs as certification | Reports disclaim; mapping depth uneven |
| Partner rows as native Leading features | Dark web / OT / A2A partner dependencies |
| Enterprise PoR for 5k-employee CTEM today | Prior CISO panel NO-BUY; pilot only |
| Fabricating customer logos or ROI | No references in repo; demo fixtures only |

---

## 9. Hype Cycle memo (AEV category + Periscan)

| Object | Phase | Note |
| --- | --- | --- |
| **Market: AEV/CTEM language** | Peak of Inflated Expectations | Buyers hear autonomous red team / full kill chain |
| **Periscan honesty core** | Early Slope of Enlightenment | Real measured loops, labeled uncertainty |
| **Periscan Autonomous/AI surface** | Innovation Trigger → Peak risk | Orchestration scores high; execution often governed/scaffold |
| **Recommended vendor posture** | **Trough-aware truth-teller** | Ride Slope with proof metrics; refuse Peak theater |

Analysts reward vendors who **define** the post-hype category. Periscan can — if GTM and nav stop re-entering the Peak.

---

## 10. Score summary card (print-ready)

| Dimension | Score | Band |
| --- | ---: | --- |
| Completeness of Vision | **3.7 / 5** | Strong Visionary |
| Ability to Execute | **2.85 / 5** | Lagging / pre-reference |
| Market presence proxy | **1.3 / 5** | Pre-MQ |
| Scorecard integrity (meta) | **2.5 / 5** | Needs blind rescore |
| **Hypothetical MQ quadrant** | | **Visionaries** |
| **Formal MQ inclusion readiness** | | **No** |
| **Design-partner / pilot readiness** | | **Yes (AEV-framed)** |
| **Persona verdict vs 5.0** | **2.9 / 5** | Execute-bound; vision not the constraint |

**5.0 path in one sentence:** *Own AEV proof, measure multi-hop by default, close inject loops, collapse the zoo, certify the stack, produce three references — then ask Gartner.*

---

## 11. Confidence and limits

| Claim type | Confidence |
| --- | --- |
| Category placement AEV/CTEM vs BAS | High |
| Vision vs Execute imbalance | High |
| Scorecard vs competitive matrix inflation | High on named rows (APV/SCV/DRV/choke/agent) |
| Market presence absence | High (no contrary commercial evidence in repo) |
| Post–2026-07-26 row scores still 79.1 | High that freeze is intentional; Medium that individual rows drifted up without rescore |
| Live UI polish vs 2026-07-13 TaskSuccess | Medium — substantial ship notes; no independent 2026-07-29 usability rescore |

This document is **not** a Gartner Magic Quadrant. It is a panel self-audit under `PROMPT_CONTRACT.md` rules for roadmap and narrative discipline.

---

*End of exhaustive panel audit `personas/12-gartner-analyst.md`. Findings: P12-1 … P12-20. Companion: `PREVIOUS_PANEL_SYNTHESIS.md`, `docs/qa/panel-audit-2026-07-29/13-forrester-analyst.md`.*
