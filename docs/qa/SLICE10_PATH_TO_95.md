# Slice 10 — Honest path from 71.6 → 95+ analyst score

**Status:** OPEN — release qualification incomplete  
**Assessed:** 2026-07-30 (A8 honesty demote)  
**Source of truth:** `docs/qa/analyst-scorecard.json`  
**Gate:** `scripts/analyst-score-gate.mjs` (`pnpm analyst:score:check`)  
**Related:** `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md`, `docs/qa/BLIND_RESCORE_RELEASE_QUAL.md`, `docs/COMPETITIVE_COVERAGE_MATRIX.md`

> **P12-16:** Internal score is **not** MQ / Wave progress.
> `scoreGovernance.isMagicQuadrantProgress=false`. Zero named customer refs —
> do not fabricate market presence.

---

## 1. Baseline (do not invent)

| Metric | Value |
|--------|------:|
| Current points | **1,347 / 1,880** |
| Current score | **71.6 / 100** |
| Plan target points | **1,802 / 1,880** (95.9%) |
| Slice 10 Done floor | **≥ 1,786 / 1,880 (95.0%)** |
| Delta to 95.0% | **+439 points** |
| Delta to 95.9% plan | **+455 points** |
| Rows at strict ≥4.0 | **27 / 94** |
| Strong + Leading rows | **72 / 94** |
| Leading (Fully-E2E allowlist only) | **6 / 94** (ids 11, 13, 24, 69, 90, 91) |
| Scaffold/gated | **11** |
| Partial | **11** |
| Gap rows (below row target) | **most / 94** |

**Hard rules for this path:**

1. **No invented Leading.** Promote only with API + persistence + tests + measured/lab evidence (or honest empty/not-configured).
2. **Delivery ≠ score lift.** Completing a feature branch does not raise `analyst-scorecard.json` until a rescore cites evidence.
3. **External claims freeze.** Do not export full 94-row % or inflated Leading as MQ/Wave progress. Use `scope.presentation.coreAev*` + competitive matrix labels for external language.
4. **Blind rescore required** before any external “95+” claim (`docs/qa/BLIND_RESCORE_RELEASE_QUAL.md`).
5. **Gate floors are honesty locks**, not stretch goals. Changing floors requires a real rescore pass that reconciles dimensions.

### Gate floors (current honesty lock — must stay consistent)

Enforced by `scripts/analyst-score-gate.mjs` today:

| Floor | Value | Meaning |
|-------|------:|---------|
| `currentPoints` | **1347** | Honesty residual after A8 matrix-alignment demotes |
| Dimension sums | product **359**, function **350**, ux **353**, operations **285** | Must equal 1347 |
| `strictFloorRows` (≥4.0) | **27** | Rows at analyst “ready enough” floor |
| `strongOrLeadingRows` | **72** | Classification count (includes Strong) |
| `targetPoints` | **1802** | Row-target sum (95.9% on 1880 scale) |
| Target distribution | 4.0×12, 4.5×15, 5.0×67 | Approved ambition shape |
| P12-7 | Partner ⇒ never Leading | Joint customer proof required |
| P12-8 | Rows 29/30/33 never Strong/Leading | Agent hype scaffolds |
| P12-12 | Row 4 never Leading / never ≥4.0 | Pattern breakers ≠ min-cut |
| P12-13 | Row 80 never Leading / never ≥4.0 | Compliance theater |
| P05-11 / P13-4 | Row 6 SCV ≠ Strong/Leading | Inject hard-disabled |
| P12-3 / P19-r1 | Leading allowlist only | ids 11, 13, 24, 69, 90, 91 |
| P12-16 | `scoreGovernance` MQ/Wave flags false | Internal index ≠ analyst placement |

**95% Done floors (when evidence actually lands — replace current floors only then):**

| Floor | Target for Slice 10 Done |
|-------|--------------------------|
| `currentPoints` | **≥ 1786** (95.0%) preferred **1802** (plan 95.9%) |
| `strictFloorRows` | **≥ 80** at ≥4.0 (estimate; recompute on rescore) |
| Honesty caps | P12-7/8/12/13 remain unless evidence changes the underlying claim |
| Blind rescore memo | Required; self-score alone is insufficient |

---

## 2. Why 95% is not reachable from code polish alone

A naïve “+1 ops on every Strong row” recovers only ~**41** points.  
Safety/partner scaffolds lifted only to 3.5 recover ~**41**.  
Core proof-loop rows (3/4/6/8/23) to 4.5 recover ~**23**.  

**Partial engineering path ≈ +105 pts → ~79%** — still far short of 95.

Reaching **+362** requires nearly the full plan target (+378): measured multi-hop, control inject honesty or real inject loops, specialist safety labs, partner packs, customer connector qualification, compliance catalog depth, and release-qual ops evidence. **Lab/partner/customer work is majority mass**, not UI copy.

---

## 3. Work-type legend

| Tag | Meaning | Who |
|-----|---------|-----|
| **PRODUCT** | API, persistence, modules, UI, unit/acceptance tests in-repo | Engineering |
| **LAB** | Measured local/docker range, multi-node runner drills, soak | Eng + lab ops |
| **SAFETY** | Bounded safe substitute modules; never real theft/destruct/exfil | Eng + safety review |
| **PARTNER** | Joint customer/partner environment or feed | Design partner / GTM |
| **CUST_QUAL** | Live customer credentials against real SaaS/cloud/vSphere | SE + customer |
| **HARDWARE** | TEE/attestation hardware or controlled protocol lab | Trust squad |
| **BLIND** | Independent rescore + journey a11y/mobile/load gates | Non-author scorer |

---

## 4. Row-by-row gap list (all 94)

`gapPts` = `(targetScore × 4) − sum(product,function,ux,operations)`.  
Score is average of four 0–5 dimensions.

### 4.1 Scaffold / gated — largest honest holes (must not fake UI readiness)

| ID | Requirement | Now | Target | gapPts | Verdict | Dependency | What is real today | Gap to target | Primary work |
|---:|-------------|--:|--:|--:|---------|--------------|--------------------|---------------|--------------|
| 2 | Dark Web & Credential Monitoring | 1.75 | 4 | 9 | Scaffold/gated | Partner | Scaffold honesty panel; no live dark-web feed | Partner feed + normalized findings + ops runbook | **PARTNER** + PRODUCT shell |
| 16 | Agentless APT Execution | 2.0 | 4 | 8 | Scaffold/gated | SafetyEquivalent | Kill-chain planner plan-only (`liveSupported:false`); governed offensive flip real | Bounded safe stage playbooks with measured receipts — **not** live APT | **SAFETY** + PRODUCT |
| 21 | Ransomware Emulation | 2.0 | 4 | 8 | Scaffold/gated | SafetyEquivalent | Stage manifests; no destructive encryption | Harmless canary/detection-only pack + explicit non-claim | **SAFETY** + LAB |
| 22 | Identity Abuse & Credential Harvesting | 2.25 | 4 | 7 | Scaffold/gated | SafetyEquivalent | Modules exist `liveSupported:false` | Synthetic identity abuse with policy deny + measured markers | **SAFETY** + LAB |
| 26 | OT/ICS Attack Packs | 1.75 | 4 | 9 | Scaffold/gated | Partner | Passive port classify; fixture baseline | Partner OT lab; never claim Validated without speak-protocol proof | **PARTNER** + SAFETY |
| 28 | Crowdsourced Human-in-the-Loop | 1.5 | 4 | 10 | Scaffold/gated | Partner | No crowd network productized | Partner HITL network or keep explicitly gated | **PARTNER** |
| 29 | Multi-Agent Orchestration Engine | 2.0 | 5 | 12 | Scaffold/gated | None | Engagement engine = real **passive** path; swarm theater removed | Measured mission assembly multi-agent — **gate forbids Strong/Leading until real** | **PRODUCT** + LAB (long) |
| 30 | Hybrid Execution Compiler | 2.5 | 5 | 10 | Scaffold/gated | None | Not Fully-E2E measured surface | Real compile→signed task path or keep Scaffold | **PRODUCT** |
| 33 | Conversational Threat Builder | 2.0 | 5 | 12 | Scaffold/gated | None | UI prompt prefills only | Executable scenario generation to signed modules | **PRODUCT** (long) |
| 80 | Automated Compliance Attestations | 2.5 | 5 | 10 | Scaffold/gated | None | Partial catalog + evidence support; not regulated attestation | Versioned control catalogs, owner workflow, reviewer sign-off; **never certify** | **PRODUCT** |

**Subtotal gapPts (scaffolds):** 95 points. Several rows have target 5 that will **not** honestly hit 5 without multi-quarter work; path to **95%** may keep 29/30/33 at ≤3.0 and recover points elsewhere — do not inflate them for the number.

### 4.2 Partial proof-loop core (Slice 3–5 residual)

| ID | Requirement | Now | Target | gapPts | Verdict | What is real | Gap | Primary work |
|---:|-------------|--:|--:|--:|---------|--------------|-----|--------------|
| 3 | Attack Path Validation | 3.5 | 5 | 6 | Partial | Graph + BFS + heuristic/measured labels | Edge receipts, multi-hop measured ratio, journey polish | **PRODUCT** + **LAB** |
| 4 | Choke Point Analysis | 3.25 | 5 | 7 | Partial | Pattern-attached greedy breakers (P12-12) | Graph-wide min-cut/dominator **or** accept “prioritized breakers” language and lower target later | **PRODUCT** (hard) — **gate: score &lt; 4 until real solver** |
| 8 | Detection Rule Validation | 3.5 | 5 | 6 | Partial / matrix Scaffold | Sigma import + marker **correlate**; emit separate | One signed emit→observe loop | **PRODUCT** + **LAB** |
| 23 | Dynamic Attack Paths | 2.75 | 5 | 9 | Partial | Advisory next-mission; no autonomous replan | Signal-driven replan with human gate + measured edges | **PRODUCT** + **LAB** |
| 47 | Execution Integrity | 3.5 | 4 | 2 | Partial | Verifier protocol core | Hardware/protocol qualification | **HARDWARE** |
| 64 | Model Weight Extraction Tests | 3.0 | 4 | 4 | Partial | Non-exfiltrating resistance suite | Broader corpus + ops evidence | **SAFETY** + PRODUCT |

**Subtotal gapPts:** 34.

### 4.3 Strong ~3.75 — ops / depth to 4.0–5.0 (many “ops+1” but 5.0 needs lab)

These score **Strong** with typical dims `4/4/4/3`. +1 operations alone → 4.0 floor (+1 pt each). Target **5** still needs function/product depth + live qualification.

| ID | Requirement | Now | Target | gapPts | Dependency | Primary work to close gap |
|---:|-------------|--:|--:|--:|------------|---------------------------|
| 6 | Security Control Validation | **3.5 Partial** | 5 | 6 | None | Closed inject disabled by design; pull telemetry real. **Gate forbids Strong/Leading** until inject→observe (P05-11) | **PRODUCT** + policy |
| 7 | URL Filtering Validation | 3.75 | 5 | 5 | None | Lab measured URL/filter scenarios + ops | **LAB** |
| 9 | Cloud Security Validation | 3.75 | 5 | 5 | None | Measured cloud tenant (not stub fetch) | **LAB** + **CUST_QUAL** |
| 10 | Kubernetes & Container Validation | 3.75 | 5 | 5 | None | kube-bench/CIS live loop | **LAB** |
| 19 | Data Exfiltration over DNS | 3.75 | 4 | 1 | SafetyEquivalent | Canary module real; no real exfil — ops polish to 4.0 OK | **LAB** (canary+telemetry) |
| 27 | SSPM / SaaS Validation | 3.75 | 5 | 5 | None | Native SaaS config tests beyond re-badge | **PRODUCT** + **CUST_QUAL** |
| 31 | Dynamic Routing | 3.75 | 5 | 5 | None | Product depth + ops | **PRODUCT** |
| 34 | MCP Host/Client | 3.75 | 5 | 5 | None | Labs-demoted; not proof-loop Fully-E2E | **PRODUCT** honesty + LAB |
| 54 | Agent Behavior Analytics | 3.75 | 5 | 5 | None | Deterministic rules real; not ML anomaly | **PRODUCT** + ops |
| 60 | Model-Aware Threat Simulation | 3.75 | 5 | 5 | None | Versioned corpora expansion | **PRODUCT** + SAFETY |
| 67 | Auto-Mitigate | 3.75 | 5 | 5 | None | Prefer **auto-revalidate** language; fix **push** still narrow/allowlist | **PRODUCT** + SAFETY |
| 68 | Prescriptive Mitigation Planner | 3.75 | 5 | 5 | None | Evidence-citing refinement beyond templates | **PRODUCT** |
| 71 | ITSM/SOAR Automation | 3.75 | 5 | 5 | None | Bidirectional closure, playbook depth | **PRODUCT** + **CUST_QUAL** |
| 73 | Palo Alto XSIAM Integration | 3.75 | 5 | 5 | CustomerQualification | XSIAM-specific depth beyond Cortex XDR | **CUST_QUAL** + PRODUCT |
| 81–88 | Compliance mappings (8 rows) | 3.75 each | 5 | 5×8=40 | None | Catalog depth + legal review; never claim certification | **PRODUCT** + legal |
| 94 | Self-Serve Free Trials | 3.75 | 5 | 5 | None | Payment processor still NotConfigured | **PRODUCT** + commercial |
| 97 | White-Labeling for GSIs | 3.75 | 5 | 5 | None | Domain/email/theme governance | **PRODUCT** |

**Subtotal gapPts (listed Strong 3.75 cluster):** ~116 (includes 81–88).

### 4.4 Customer-qualification integrations

| ID | Requirement | Now | Target | gapPts | Notes | Primary work |
|---:|-------------|--:|--:|--:|-------|--------------|
| 72 | CrowdStrike | 3.75 | 4.5 | 3 | Real client; live cust creds | **CUST_QUAL** |
| 73 | Palo Alto XSIAM | 3.75 | 5 | 5 | Branding/depth gap | **CUST_QUAL** + PRODUCT |
| 74 | Wiz / CSPM | 3.75 | 4.5 | 3 | Real client | **CUST_QUAL** |
| 75 | Datadog | 3.75 | 4.5 | 3 | Real client | **CUST_QUAL** |
| 76 | Tenable / RBVM | 3.75 | 4.5 | 3 | Real + file import | **CUST_QUAL** |
| 77 | IBM QRadar | 3.75 | 4.5 | 3 | Real Ariel path | **CUST_QUAL** |
| 78 | VMware vCenter | **3.75 Strong** | 4.5 | 3 | Read-only connector + tests; **live** needs customer vSphere; **not Leading** | **CUST_QUAL** (ops maintain) |

**Note:** Competitive matrix honesty refresh (2026-07-30) lists vCenter **Partial**
(was Missing). Scorecard demoted from Leading 4.5 → Strong 3.75. Do not re-export Leading.

### 4.5 Partner ecosystem appendix (P12-7)

| ID | Requirement | Now | Target | gapPts | Primary work |
|---:|-------------|--:|--:|--:|--------------|
| 35–37 | A2A Protocol / Cards / Tasks | 4.0 | 4.5 | 2 each | **PARTNER** conformance |
| 38 | A2A Artifact Exchange | 3.5 | 4.5 | 4 | **PARTNER** |
| 51 | AgentDID Integration | 3.75 | 4 | 1 | **PARTNER** issuer/wallet |

External AEV briefings use **core** scores only (`scope.presentation`).

### 4.6 Already high (gap ≤4) — polish / qualification, not rebuild

| ID | Requirement | Now | Target | gapPts | Work |
|---:|-------------|--:|--:|--:|------|
| 1 | EASM | 4.0 | 5 | 4 | Continuous living map; autonomous discovery residual | PRODUCT+LAB |
| 5 | Exposure Graphs | 4.25 | 5 | 3 | Hybrid topology depth | PRODUCT |
| 11 | Exposure Validation | 4.5 | 5 | 2 | Upstream measured inputs | LAB |
| 12 | Business Impact Scoring | 4.0 | 5 | 4 | Populate financial dims in live path | PRODUCT |
| 13 | Dynamic Risk Dashboards | 4.5 | 5 | 2 | Design-partner validation | PARTNER |
| 14–15 | macOS/Linux Detection Analytics | 4.25 | 4.5 | 1 each | Ops evidence | LAB |
| 17 | Agent-Based Execution | 4.0 | 5 | 4 | Broader live allowlist modules | PRODUCT+SAFETY |
| 18 | Agentless Web App Simulator | 4.0 | 4 | 0 | At target | maintain |
| 20 | Threat Library | 4.0 | 5 | 4 | Multi-feed + scenario library | PRODUCT |
| 24 | Automated Scheduling | 4.5 | 5 | 2 | Runner pool/notification depth | PRODUCT+LAB |
| 25 | Software Supply Chain | 4.5 | 5 | 2 | CI/CD pipeline security residual | PRODUCT |
| 32 | Virtual Security Analyst | 4.0 | 5 | 4 | Always-on copilot residual | PRODUCT |
| 39–44, 48–50, 52 | Trust / ledger / HITL / TEE cores | 4.0–4.5 | 4–5 | 0–2 | Hardware/partner where marked | HARDWARE/ops |
| 57, 59, 61, 65 | AI validation / kill-switch | 4.5 | 5 | 2 | Safe canary limits; don’t overclaim | PRODUCT+SAFETY |
| 66 | Unified Data Fabric | 4.75 | 5 | 1 | Import workflow polish | PRODUCT |
| 69 | Automated Revalidation | 4.5 | 5 | 2 | Event-driven triggers | PRODUCT |
| 70 | Infrastructure-as-Code Updates | 4.5 | 5 | 2 | Beyond GitHub PR; multi-IaC | PRODUCT |
| 79 | Continuous Intelligence Feed | 4.5 | 5 | 2 | SLA UI; not validation proof | PRODUCT |
| 89–93, 96, 98 | GDPR/MSSP/licensing/locale/marketplace | 4.0–4.5 | 5 | 0–4 | Commercial/legal/ops | PRODUCT+GTM |
| 107 | Async Task Processing | 4.0 | 5 | 4 | Multi-node failure + soak | **LAB** |
| 110 | Custom Tool Framework | 4.0 | 5 | 4 | Reviewed executable adapters | PRODUCT+process |

Rows already at row-target (gapPts 0): **18**, **44** (target 4), **78** (target 4.5) — maintain only.

---

## 5. Prioritized recovery plan (honest sequence)

### Phase A — Release qualification gates (Slice 10 process)

**Does not raise score by itself; required before claiming 95+.**

| Gate | Pass condition | Work type |
|------|----------------|-----------|
| Analyst score gate | `pnpm analyst:score:check` green on freeze commit | — |
| Acceptance / verify | `pnpm verify` green | LAB |
| ICP journey | ≥90% desktop/mobile/zoom/keyboard/reduced-motion | PRODUCT+LAB |
| A11y | No serious axe findings on primary journey | PRODUCT |
| Tenant isolation | RLS / isolation proof current | LAB |
| Runner failure drill | Multi-node / lease recovery documented + exercised | LAB |
| Load/soak | Production-like profile recorded | LAB |
| Claim language | Zero Critical false-validated / false-clean | PRODUCT |
| Blind rescore | Independent scorer; memo published | **BLIND** |

### Phase B — Proof-loop product (largest **in-repo** lifts)

| Order | Rows | Action | Est. points if honest |
|------:|------|--------|----------------------:|
| B1 | 3, 23 | Measured edge plan + receipts + path recompute | +8–12 |
| B2 | 8 | Emit→observe DRV single signed loop | +4–6 |
| B3 | 4 | Either real choke solver **or** keep &lt;4 + external language freeze | 0–7 |
| B4 | 6 | Keep inject-disabled honesty **or** governed inject | 0–5 |
| B5 | 1, 12, 20 | EASM continuity, impact dims, multi-feed threat lib | +6–10 |

### Phase C — Safety-equivalent specialists (Slice 9 residual)

| Rows | Action | Est. points |
|------|--------|------------:|
| 16, 21, 22 | Bounded lab packs + evidence; never claim live ransomware/APT theft | +12–18 |
| 19 | Ops to solid 4.0 on DNS canary + live telemetry | +1 |
| 64 | Extraction-resistance ops evidence | +2–4 |

### Phase D — Partner + customer qualification

| Rows | Action | Est. points |
|------|--------|------------:|
| 2, 26, 28 | Partner feeds/labs or permanent gate | +0–28 (only with real partners) |
| 72–77 | Live customer connector quals | +12–18 |
| 35–38, 51 | A2A/DID partner proof | +5–10 |
| 13, 90, 91 | Design-partner references (market, not just score) | ops + GTM |

### Phase E — Compliance depth (honest non-certification)

| Rows | Action | Est. points |
|------|--------|------------:|
| 80 | Real control catalogs + workflows; score may rise but **not Leading as cert** | +4–8 under P12-13 until ≥4 allowed by policy change |
| 81–88 | Framework content + reviewer workflow | +16–32 |

### Phase F — Ops polish cluster

| Action | Est. points |
|--------|------------:|
| Operations 3→4 on ~40 Strong rows with real runbooks + drills | +40 |
| Push selected Fully-E2E rows 4.5→5 with partner + soak evidence | +20–40 |

**Arithmetic check:** B+C+D+E+F must be evidence-backed and re-gated; inventing dim bumps to hit 1786 is a **release blocker**, not progress.

---

## 6. Residual overclaim watchlist (blind rescore focus)

Do **not** auto-promote. Scorer should challenge:

| ID | Why challenge |
|---:|---------------|
| 25, 59, 61, 66, 70 | Matrix historically Partial/Scaffold while scorecard Leading — demand measured demos |
| 67 | “Auto-Mitigate” vs auto-revalidate / narrow allowlist |
| 78 | Live vCenter vs mock/fixture tests only |
| 29, 30, 33, 80, 4 | Gate-capped; any attempt to Leading is automatic fail |
| 6, 8 | Inject disabled / incomplete DRV loop |
| All Partner rows | Leading forbidden without joint proof |

If any row still overclaims after code review, **demote in `analyst-scorecard.json` and update gate dimension floors in the same commit**. Prefer demotion over silent freeze.

---

## 7. Scorecard correction policy (this ticket)

| Action | This Slice 10 pass |
|--------|--------------------|
| Invented Leading promotions | **None** |
| Evidence-based promotions | **None** (no new Fully-E2E proof landed in this ticket) |
| Honesty demotions | **Applied 2026-07-30 A8** — residual Leading vs matrix demoted; SCV→Partial; floors **1347** |
| Gate floors | **Updated** (1347 honesty lock); 95% Done floors documented above |
| Competitive matrix refresh | Recommended follow-up (vCenter, DNS canary, IaC PR path stale vs 2026-07-05) |

---

## 8. Definition of Done for Plane ticket #13

Mark **Done** only when **all** are true:

1. `currentPoints ≥ 1786` (95.0%) on gate-passing scorecard — preferably ≥1802.
2. Blind rescore memo published and spot-checked on Critical rows.
3. Phase A release gates green (journey, a11y, isolation, runner drill, soak, claim language).
4. No P12-7/8/12/13 violations; no Partner Leading; no false-validated primary UX.

**Until then:** leave issue **OPEN**. Path document + gate documentation are prerequisites, not completion.

---

## 9. Operator commands

```bash
pnpm analyst:score:check
# or
node scripts/analyst-score-gate.mjs
```

Expected today:

```text
Analyst scorecard verified: 94/94 ASV/CTEM rows, 1347/1880 (71.6%) current,
1802/1880 (95.9%) target; 27/94 at the strict 4.0 floor and 72/94 Strong/Leading.
```

---

## 10. Traceability

| Artifact | Role |
|----------|------|
| `docs/qa/analyst-scorecard.json` | Machine-readable scores |
| `scripts/analyst-score-gate.mjs` | Honesty + floor enforcement |
| `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md` | Slice 1–10 product plan |
| `docs/qa/BLIND_RESCORE_RELEASE_QUAL.md` | Independent rescore protocol |
| `docs/COMPETITIVE_COVERAGE_MATRIX.md` | External claim vocabulary |
| `docs/qa/SLICE10_PATH_TO_95.md` | This gap map |
