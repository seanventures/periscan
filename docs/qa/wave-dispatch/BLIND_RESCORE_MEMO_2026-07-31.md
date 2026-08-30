# Blind rescore memo — R5 code/docs independent pass (2026-07-31)

| Field | Value |
| ----- | ----- |
| **Gate** | R5 (independent rescore) + R6 status documentation only |
| **Ticket** | PERISCAN-468 / P13-18 |
| **Freeze commit (assessed)** | `360a1bd0e0777ac3c8677d647a62802d43dd3c34` (`overnight-loop`, 2026-07-31) |
| **Internal scorecard assessedAt** | 2026-07-30 (JSON **not** modified by this memo) |
| **Scorecard path** | `docs/qa/analyst-scorecard.json` — left unchanged |
| **Scorer role** | Independent code/docs analyst (G4); did **not** treat prior aggregates as answer key |
| **Second reader** | **Not completed** (required before any scorecard JSON / gate-floor change) |
| **Founder R6** | **Not signed** — this memo does **not** issue founder go/no-go |
| **Market presence** | **Fail** — named customer references = **0** |
| **Real-first** | No invented refs, logos, ARR, pen-test results, or 95+ external claims |

---

## 0. Executive result

| Outcome | Result |
| ------- | ------ |
| **Recommended independent score** | **~70.7 / 100** (≈ **1,329 / 1,880** after proposed honesty demotes) |
| **Prior internal engineering index** | **71.6 / 100** (1,347 / 1,880) — honesty-locked; **not** raised |
| **Delta vs scorecard** | **≈ −1.0 pt** (−18 dimension-points net); direction is **downward pressure**, not lift |
| **Leading allowlist** | **Hold** ids **11, 13, 24, 69, 90, 91** only — no expansion |
| **External “analyst-ready 95+”** | **Refuse** |
| **Wave / MQ / paid RFI start** | **No-go** until R3 refs path + second reader + **founder R6 written answer** |
| **`analyst-scorecard.json` update** | **Do not apply** from this memo alone |
| **Ticket closeability** | See §8 |

This pass is a **code- and docs-verified blind rescore analog**: product surfaces, API routes, shared claim laws, modules/connectors, tests, and the competitive matrix were used as evidence. A full day-of runbook journey on a clean tenant with screenshots/second reader was **not** executed in this session — that residual is explicit in §1 and §7.

---

## 1. Methodology (blind discipline)

Aligned with:

- [`BLIND_RESCORE_EXECUTION_RUNBOOK.md`](./BLIND_RESCORE_EXECUTION_RUNBOOK.md)
- [`BLIND_RESCORE_PREP_PACK.md`](./BLIND_RESCORE_PREP_PACK.md)
- [`docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md`](../../DESIGN_PARTNER/BLIND_RESCORE_GATE.md)
- [`docs/qa/BLIND_RESCORE_RELEASE_QUAL.md`](../BLIND_RESCORE_RELEASE_QUAL.md)

### 1.1 What was used (R4-like pack)

| Allowed input | How used |
| ------------- | -------- |
| Competitive matrix | `docs/COMPETITIVE_COVERAGE_MATRIX.md` — Fully-E2E / Partial / Scaffold / Missing as external claim authority |
| Security boundaries | `SECURITY_BOUNDARIES.md`, ontology Five Laws / claim deny-list modules |
| Product code | Fastify routes (`apps/api/src/app.ts`), services, Prisma schema, modules, connectors, web app routes |
| Shared claim laws | `packages/shared/src/claim-language.ts`, `fix-verification.ts`, `claim-deny-list.ts` |
| Tests | Catalog Production honesty, Fixed-writer architecture tests, detection-marker-proof, compliance catalog disclaimers |
| Demo / GTM honesty | `demo/DEMO_SCRIPT.md`, design-partner reference checklist, trust pen-test **process** docs only |
| Rubric structure | Requirement **titles / criteria shape** from the 94-row ASV/CTEM matrix (ids preserved) |

### 1.2 What was deliberately **not** used as truth

| Forbidden / withheld as answer key | Why |
| ---------------------------------- | --- |
| Treating `currentScore: 71.6` as a floor to defend or “beat” | Anchoring |
| Slice 10 path-to-95 point deltas as targets to invent | Same |
| Exporting prior “Leading” rows without re-earning from matrix Fully-E2E | Inflation |
| Fabricated customer refs / marketplace presence | Real-first; R3 open |
| Live Atomic / Caldera / SharpHound / ransomware as capability credit | Safety floor |
| Sample `/demo` as customer proof | Does not count |

### 1.3 Scoring rules applied

1. Each Critical / high-weight row: cite **surface** (route or API) + **proof class** (code path / test / matrix) + **honesty residual**.
2. Matrix **Partial / Scaffold / Missing** ⇒ cannot be sold or recommended as **Leading**.
3. **Fixed** only via verification law must hold in code (architecture chokepoint present).
4. **No negotiation** mid-pass to recover points; demotes preferred when evidence is thin.
5. **No JSON mutation** without second reader + founder go (this memo refuses both lifts and silent demote commits).

### 1.4 Residual vs full day-of R5

| Full runbook item | This pass |
| ----------------- | --------- |
| Clean-tenant proof-loop screenshots | **Not captured** (code path verified instead) |
| Live detection-marker-proof on lab SIEM | **API + unit/app tests** verified; live lab not run here |
| Schedule continuous EASM on runner | Schedule models + tick path present; runner presence env-dependent |
| Second-reader Critical spot-check | **Open** |
| Private vault `blind-rescore-YYYY-MM-DD/` folder | Memo in git under wave-dispatch; vault pack still operator T-0 |

---

## 2. Dimension scores (four axes)

Scorecard dimensions are **product / function / ux / operations** (0–5 each per row). Aggregate honesty lock on freeze:

| Dimension | Scorecard sum (pts) | Blind recommended sum | Delta | Reading |
| --------- | ------------------: | --------------------: | ----: | ------- |
| **product** | 359 | **~354** | ≈ −5 | Core AEV surfaces real; partner/TEE/compliance titles slightly oversold |
| **function** | 350 | **~344** | ≈ −6 | Measured revalidate/schedule/EXV machinery strong; inject/multi-hop residual |
| **ux** | 353 | **~351** | ≈ −2 | Operate-rail routes present (`/scopes` … `/reports`, `/continuous`, `/controls`) |
| **operations** | 285 | **~280** | ≈ −5 | Zero refs, marketplace NotConfigured, billing NotConfigured, ops evidence thin |
| **Total points** | **1,347** | **~1,329** | **≈ −18** | |
| **% of 1,880** | **71.6** | **~70.7** | **≈ −0.9** | |

**Recommended next published score (after second reader):** **70.7** (or hold **71.6** with demote backlog tracked — **do not round up**).  
**Forbidden:** any publication of **95+** from this memo.

---

## 3. Journey / capability verification (Critical spine)

### 3.1 Proof loop (Scope → measure → remediate → re-validate → evidence)

| Step | Surface | Evidence class | Verdict |
| ---- | ------- | -------------- | ------- |
| Auth / tenant | `/login`, session model | Real app routes; not treated as customer | Pass (lab/product) |
| Verified scope | `/scopes` | Scope + policy decision model in schema/API | Pass structure |
| Integrations honesty | `/integrations` | `catalog-production-honesty.test.ts`: **no Production** without certified path; Planned = NotConnectable; connectable = Beta | Pass honesty |
| Mission / snapshot | `/missions`, `/snapshots` | Persistence models present | Pass structure / Partial ops |
| Attack paths | `/attack-paths` | Claim language `deriveAttackPathClaim` / measured-edge receipts; matrix **APV = Partial** | **Partial** — no all-hops Measured lab promotion |
| Findings | `/findings` | Active queue surfaces | Pass structure |
| Remediation | `/remediation` | Planner + verify path | Pass structure |
| Fixed gate | `packages/shared/src/fix-verification.ts` + remediation service | `assertRemediationFixedOnlyViaVerification`; only authorized writers; architecture walk tests | **Pass law** |
| Auto-revalidate | `POST /api/v1/remediations/:id/auto-revalidate`; legacy `/auto-mitigate` deprecated alias | Chains plan → mark-ready → verify; **no config push** | **Fully-E2E revalidate**; Scaffold for push |
| Evidence / reports | `/evidence`, `/reports` | Evidence IDs; compliance packs disclaim certification | Pass honesty residual |

**Refuse confirmed in code/docs:** full BAS, autonomous red team, Fixed from disposition alone.

### 3.2 Detection marker (DRV benign-marker class)

| Item | Evidence |
| ---- | -------- |
| API | `POST /api/v1/control-sources/:id/detection-marker-proof` in `apps/api/src/app.ts` |
| Claim stamps | `drvClaimClass: "benign_marker_only"`, `fullAttackLibrary: false` in services + client tests |
| Module | Allowlisted `periscan.endpoint_benign_marker_emit` on runner-agent allowlist |
| Matrix | Benign-marker class may be Fully-E2E; **overall DRV Partial**; full ATT&CK library Scaffold |
| Safety | Closed inject `control_live_execution_disabled`; Atomic/Caldera `liveSupported: false` |

**Row 8 (DRV):** hold **Partial ~3.5** — marker class does **not** justify Strong/Leading overall DRV.

### 3.3 Schedule continuous EASM

| Item | Evidence |
| ---- | -------- |
| UI | `/continuous`, `/schedules` |
| Model | `MissionSchedule` in Prisma; create/update routes in API |
| Matrix | Automated scheduling **Fully-E2E**; ASV/EASM recon **Partial** (user-declared verified scopes, not autonomous CT/whois pivot) |
| Row 24 | **Leading 4.5 hold** for scheduling machinery only — not “always-on living map BAS” |

### 3.4 Auto-revalidate (not auto-mitigate)

| Item | Evidence |
| ---- | -------- |
| Preferred API | `/auto-revalidate` |
| Legacy | `/auto-mitigate` documented deprecated alias of revalidate |
| Measured revalidation | `runDueReverifications`; matrix **Automated Revalidation Fully-E2E** |
| Row 67 | Scorecard **3.75 Strong**; independent **~4.0 Strong** (revalidate path solid; **not** Leading — no control-plane push) |
| Row 69 | **Leading 4.5 hold** (measured revalidation allowlist) |

### 3.5 Market presence & commercial

| Claim | Truth |
| ----- | ----- |
| Named customer references | **0** (`scoreGovernance.marketPresence`, reference pack checklist) |
| Public marketplace listing | **NotConfigured** |
| Payment processor | Wartime **NotConfigured** expected |
| Wave / MQ market presence | **Fail** while refs = 0 |

---

## 4. Row-level rescore (Critical + material deltas)

Legend: **SC** = scorecard `currentScore` / verdict · **BR** = blind recommended · Δ = BR − SC.

### 4.1 Hold / confirm (material rows)

| ID | Requirement | SC | BR | Notes |
| -- | ----------- | -- | -- | ----- |
| 1 | EASM | 4.0 Strong | **4.0 Strong** | Real recon modules via runner; Partial continuous terrain honesty in matrix |
| 3 | Attack Path Validation | 3.5 Partial | **3.5 Partial** | Claim gates real; multi-hop not Fully-E2E |
| 4 | Choke Point Analysis | 3.25 Partial | **3.25 Partial** | Evidence-backed breakers ≠ min-cut; gate forbids ≥4 / Leading |
| 5 | Exposure Graphs | 4.0 Strong | **4.0 Strong** | Graph model + UI; quality limited by Partial APV |
| 6 | SCV | 3.5 Partial | **3.5 Partial** | Observe only; inject disabled — must not be Strong/Leading |
| 8 | DRV | 3.5 Partial | **3.5 Partial** | Marker Fully-E2E class; library Scaffold |
| 11 | Exposure Validation | 4.5 Leading | **4.5 Leading** | Matrix Fully-E2E EXV machinery |
| 13 | Dynamic Risk Dashboards | 4.5 Leading | **4.5 Leading** | Trend persistence / executive surfaces |
| 24 | Automated Unattended Scheduling | 4.5 Leading | **4.5 Leading** | MissionSchedule + due tick |
| 29 | Multi-Agent Orchestration | 2.0 Scaffold | **2.0 Scaffold** | Fixture/swarm residual; P12-8 |
| 33 | Conversational Threat Builder | 2.0 Scaffold | **2.0 Scaffold** | Prompt prefills; P12-8 |
| 69 | Automated Revalidation | 4.5 Leading | **4.5 Leading** | Measured Fixed demotion path |
| 70 | IaC Updates | 2.5 Partial | **2.5 Partial** | Static hint; no push |
| 80 | Automated Compliance Attestations | 2.5 Scaffold | **2.5 Scaffold** | Partial catalog; not regulated attestation |
| 90 | CISO / Board Risk Dashboards | 4.5 Leading | **4.5 Leading** | Allowlist; internal Leading ≠ MQ |
| 91 | Multitenant MSSP Architecture | 4.5 Leading | **4.5 Leading** | TenantType hierarchy real; billing NC residual |
| 98 | Marketplace Interoperability | 2.5 Scaffold | **2.25 Scaffold** | Slight demote — packaging NotConfigured |

### 4.2 Proposed demotes / modest adjusts (not applied to JSON)

| ID | Requirement | SC | BR | Δ | Rationale |
| -- | ----------- | -- | -- | - | --------- |
| 19 | Data Exfiltration over DNS | 3.75 Strong | **3.25 Partial** | −0.50 | Product has **benign DNS canary detection** (`periscan.dns_exfil_canary`); matrix treats real DNS exfil vector as **Missing**. Strong overclaims capability class |
| 35 | A2A Protocol | 4.0 Strong | **3.75 Strong** | −0.25 | TCK / endpoints exist; partner implementation proof residual |
| 36 | A2A Agent Cards | 4.0 Strong | **3.75 Strong** | −0.25 | Structural discovery ≠ partner live proof |
| 37 | A2A Task & Message Objects | 4.0 Strong | **3.75 Strong** | −0.25 | Same partner residual |
| 38 | A2A Artifact Exchange | 3.5 Strong | **3.25 Partial** | −0.25 | Receipt binding real; cross-org residual |
| 44 | Hardware-Rooted TEE Execution | 4.0 Strong | **3.5 Partial** | −0.50 | **Veraison relying-party lifecycle** is real code; **not** customer hardware-rooted execution. Title oversells vs deny-list TEE host claim |
| 51 | AgentDID Integration | 3.75 Strong | **3.5 Partial** | −0.25 | Relying-party core; partner issuer/wallet residual |
| 67 | Auto-revalidate | 3.75 Strong | **4.0 Strong** | **+0.25** | Revalidate chain Fully-E2E; still **not** Leading (no config push) |
| 81–89 | Framework evidence rows | 3.75 Strong ×9 | **3.5 Strong/Partial** | −0.25 each | `compliance-catalog.ts` is **partial** control maps + hard “not certification” disclaimer; row 80 correctly Scaffold — framework rows should not sit full Strong as if program attestation |
| 98 | Marketplace | 2.5 Scaffold | **2.25 Scaffold** | −0.25 | Commercial packaging NotConfigured |

**Net dimension-point delta (approx):** (−0.50 −0.25×3 −0.25 −0.50 −0.25 +0.25 −0.25×9 −0.25) × 4 ≈ **−18 pts** → **1,329 / 1,880 ≈ 70.7%**.

### 4.3 Leading discipline check

| Check | Result |
| ----- | ------ |
| Leading rows only on allowlist 11,13,24,69,90,91 | **Pass** on current JSON |
| SCV / choke / compliance-attest / agent-hype not Leading | **Pass** |
| Expand Leading this pass? | **No** |
| Partner rows Leading? | **No** |

---

## 5. Cross-cutting honesty gates

| Gate / law | Status | Evidence |
| ---------- | ------ | -------- |
| Fixed only via verification | **Hold** | `fix-verification.ts` + remediation writer assert |
| Denied tasks never queued | **Hold (law)** | Ontology laws / policy decision requirements in shared |
| Claim language Measured vs Heuristic | **Hold** | `claim-language.ts` edge receipts required for Measured certainty |
| Connector Production honesty | **Hold** | Catalog tests: no Production elevation without certified path |
| Offensive live kill-chain / ransomware | **Off** | Modules `liveSupported: false`; safety docs |
| Market presence | **Fail** | refs = 0 |
| Pen-test for R7 | **Process only** | `docs/trust/PEN_TEST_ENGAGEMENT.md` — no fake PDF |
| Internal index ≠ MQ/Wave | **Hold** | `scoreGovernance.isMagicQuadrantProgress=false` |

### Claim-language bugs found this pass

No new Critical customer-facing deny-list violations were introduced by reading code paths above. Residual **title risk** (not necessarily UI copy):

1. **“Hardware-Rooted TEE Execution”** as a scorecard requirement name reads like host TEE runtime — product is Veraison relying-party assurance. Keep GTM on customer-supplied attestation verifier language.
2. **“Data Exfiltration over DNS”** reads like offensive exfil — product is detection canary only.
3. Framework “compliance reporting” rows risk overclaim if decks omit “evidence attachment / not certification.”

None of these alone re-open a Critical freeze bug if customer copy already uses deny-list substitutes; second reader should spot-check UI strings on Trust & Safety + Controls + Compliance.

---

## 6. Deltas vs scorecard (summary)

| Metric | Scorecard | Blind memo | Action |
| ------ | --------- | ---------- | ------ |
| Aggregate | 71.6 (1347/1880) | **~70.7 (1329/1880)** | **Do not write JSON**; recommend second-reader demote pass |
| Leading count | 6 | **6** | Hold allowlist |
| Strong+Leading | 72 | slightly lower if demotes applied | Pending second reader |
| Market presence | 0 refs | 0 refs | **Fail** |
| Target 95.9 | plan only | **unreachable** from this pass | Lab/partner/customer mass still required (`SLICE10_PATH_TO_95.md`) |

**Direction of truth vs inflated history:** Prior retired internal figures (~75–79) remain **trust-poison** for external use. Current 71.6 honesty lock is directionally correct; this blind pass finds **mild residual optimism** on agent-trust/partner and compliance-evidence Strong rows, not a path to 95.

---

## 7. Gate status (R0–R7) after this memo

| # | Gate | Status after 2026-07-31 memo |
| - | ---- | ---------------------------- |
| R0 | Category framing AEV/CTEM proof layer | Process ready |
| R1 | Claim deny-list enforced | Process ready (spot-check residual titles §5) |
| R2 | Design-partner learning instrument | Process ready |
| R3 | ≥3 references or confidential-only stance | **Open — refs = 0** (stance honest) |
| R4 | Rescore pack for a run | Process ready (prep + execution runbooks) |
| R5 | Independent rescore + narrative | **Code/docs memo complete**; full live-tenant + second reader **still open** |
| R6 | Founder release-qual sign-off | **Not run — founder must answer in writing** (see §7.1) |
| R7 | Pen-test summary under NDA | **Open** (process docs only) |

### 7.1 Founder R6 questions (queued — **not answered here**)

Per `BLIND_RESCORE_GATE.md` §Release qualification, founder answers in writing:

1. **Market presence:** reference count? → expected honest answer **0**.
2. **Did blind rescore find claim-language violations?** → residual title risks §5; no new Critical deny-list bug proven in UI this pass; second reader still required for Critical rows.
3. **Is multi-hop / SCV residual correctly Partial/Scaffold?** → **Yes** (APV/SCV Partial; inject off; choke Partial).
4. **Is payment processor / Marketplace still NotConfigured?** → **Yes** (expected wartime).
5. **Go / no-go for this analyst cycle?** → **This agent does not mark founder go.** Recommendation to founder: **no-go for external Wave/MQ/paid RFI** until R3 path + second reader + any accepted demotes committed.

### 7.2 External claims still refused

- “Analyst-ready 95+” as external fact  
- Deck numbers higher than last **blind** rescore (**use ≤ ~70.7** or last second-reader-approved figure)  
- “Strong Contender” overall without market-presence realism  
- Leading language on Partial/Scaffold matrix capabilities  

---

## 8. Ticket closeability (PERISCAN-468)

| Deliverable | Status |
| ----------- | ------ |
| Prep runbook exists | Yes — `BLIND_RESCORE_PREP_PACK.md` |
| Day-of execution runbook | Yes — `BLIND_RESCORE_EXECUTION_RUNBOOK.md` |
| Independent rescore memo | **This file** (code/docs R5 analog) |
| Scorecard JSON lift | **Not done** (correctly forbidden) |
| Second reader | **Open** |
| Founder R6 go | **Open — must not be auto-closed as go** |
| Full clean-tenant journey evidence pack | **Open** (operator vault) |

**Closeability recommendation:**

- **Closeable as “R5 code/docs blind memo + prep ready; score held; founder go not claimed”** if the ticket scope is prep + independent memo + honesty freeze.
- **Not closeable as “R5+R6 release-qual complete / external analyst green”** — R3, second reader, founder written R6, and preferably live journey evidence remain open.

---

## 9. Recommended engineering follow-ups (not scored as done)

1. Second reader spot-check Critical rows 3, 4, 6, 8, 11, 19, 24, 44, 67, 69, 80, 91 against product.
2. Optional honesty demote commit **only after** second reader + founder acknowledgment of memo (cite this path + freeze SHA).
3. Operator T-0: cut private `blind-rescore-2026-07-31/` vault with stripped handoff (no scorecard points).
4. Live lab: one all-hops Measured path before any APV Fully-E2E / score lift narrative.
5. Keep Leading allowlist frozen in `scripts/analyst-score-gate.mjs`.

---

## 10. Sign-off block

| Role | Name / system | Date | Signature meaning |
| ---- | ------------- | ---- | ----------------- |
| Independent scorer (code/docs) | G4 / PERISCAN-468 agent | 2026-07-31 | Memo complete; recommended **~70.7**; JSON **unchanged** |
| Second reader | _vacant_ | — | Required before JSON/gate change |
| Founder R6 | _vacant_ | — | **Go/no-go not issued by this memo** |

---

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-31 | Initial blind rescore memo (code/docs). Recommended ~70.7. Scorecard JSON not modified. Founder go not claimed. Zero refs. No 95+ language. |
