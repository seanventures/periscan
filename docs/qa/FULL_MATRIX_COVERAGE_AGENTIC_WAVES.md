# Full ASV/CTEM matrix coverage — agentic multi-wave plan

**Status:** active execution plan (committed 2026-07-30); **Wave A–C, E–H, F, J/K/L-prep landed** in agentic loop 2026-07-30 (see `panel-audit-exhaustive-2026-07-29-rerun/triage/WAVE_LOOP_COMPLETE_2026-07-30.md`). Wave D remains SOW-gated.  
**Baseline tip at plan write:** see `git log -1 --oneline` after land  
**Internal index:** 71.6 / 100 on 94 core rows (`docs/qa/analyst-scorecard.json`) — not auto-raised by this loop  
**Target internal index:** 95.9 / 100 (engineering only — **not** MQ/Wave progress)  
**External claim authority:** `docs/COMPETITIVE_COVERAGE_MATRIX.md`  
**Category home:** AEV / CTEM **proof** layer (`docs/competitive/POSITIONING.md`)

This plan turns the 110-feature Ultimate ASV/CTEM matrix into **executable agent waves** without claiming coverage we do not have, and without lifting safety floors.

---

## 0. Contracts (every agent must read)

### 0.1 Real-first completion contract

A row is **Fully-E2E** only when all are true:

1. Real API + tenant-scoped persistence  
2. Task-complete product workflow **or** honest `NotConfigured`  
3. Safety / authorization appropriate to the action  
4. Evidence provenance (`Measured` / `Heuristic` / `Imported` never lied about)  
5. Unit/contract tests **and** acceptance or inject path  
6. Operator help that matches the real path  
7. No claim words (`validated`, `measured`, `exploitable`, `Fixed`, `Leading`) unless derived from evidence state  

Roadmaps, fixtures, UI-only, and “almost” do **not** score.

### 0.2 Dual scoreboard

| Board | Use for | Forbidden use |
| --- | --- | --- |
| Internal 94-row index (71.6 → 95.9) | Engineering prioritization | MQ/Wave “Leaders ready”, sales % complete |
| Competitive matrix Fully-E2E/Partial/Scaffold | External claims, battlecards, SE | Inflating Partial as Leading |

**Leading allowlist (machine-enforced):** rows **11, 13, 24, 69, 90, 91** only until matrix Fully-E2E expands and a blind rescore lands.

### 0.3 Safety floors (never lift in product waves)

From `SECURITY_BOUNDARIES.md` + `Agents.md`:

- Verified customer-authorized scope only  
- Denied tasks never queued  
- **Fixed** only via verification event  
- No live Atomic / Caldera / SharpHound / real ransomware / real credential theft  
- No real data exfiltration  
- No uncontrolled exploit chaining  
- No fake customer refs, ARR, SOC2, SCIM, marketplace presence  

**Optional lab-only demote of inject (Wave D)** requires explicit SOW + dual approval + dry-run default + kill switch + audit. Default remains observe-only.

### 0.4 Scope of “full coverage”

| Band | Matrix IDs | Meaning of “full” |
| --- | --- | --- |
| **Core ASV/CTEM (scored)** | 1–94 (excl. retired GPU/FinOps as primary) | Fully-E2E **or** honest NotConfigured with partner path |
| **Platform adjacency (unscored)** | 95–110 class (GPU, Ray, LoRA train, …) | Document as deployment optional; do not block core 95.9 |
| **Partner / deliberate non-goals** | 2, 16*, 21, 22*, 26, 28, 99, live APT theater | Stay NotConfigured or Scaffold with refuse language |

\* Plan/sim surfaces may improve; **live** identity harvest / APT / ransomware remain off.

---

## 1. Baseline snapshot (2026-07-30)

| Bucket | Reality |
| --- | --- |
| Fully-E2E market claims | EXV (#11), risk dashboards (#13), scheduling (#24), measured revalidation (#69), board (#90), MSSP (#91); plus strong platform: async (#107), MCP host (#34), extension SDK (#110), semantic cache (#103), usage (#105) |
| Highest-value Partials | EASM (#1), APV (#3–5), SCV observe (#6), cloud/K8s (#9–10), runners (#17), fabric (#66), ITSM (#71), connectors 72–77, AI safe suites 59–63, attestation **verify** 44–52 |
| Highest claim–reality delta | Multi-agent BAS (#29), conversational builder (#33), auto-mitigate push (#67), compliance complete (#80–88), TEE **execution** (#44–46), GPU fair-share (#56–57), Ray (#99) |
| GTM blockers | Zero named design-partner refs; payment settlement NotConfigured; AWS Marketplace listing NotConfigured |

Source audit: incomplete-features closeout + matrix E2E check (session 2026-07-30).

---

## 2. Wave map (agentic execution)

Waves are **dependency-ordered**. Inside a wave, agents run **in parallel** with isolated worktrees when possible. Parent merges with honesty/security first.

```text
Wave A  Truth & measured APV          ──┐
Wave B  DRV + SCV honesty              ──┤ core proof
Wave C  EASM continuous + fabric       ──┤
Wave D  Optional closed inject (gated) ──┘ (optional; SOW)
Wave E  RemOps language + IaC depth
Wave F  Connector Production depth
Wave G  Compliance audit-support honesty
Wave H  Agentic control plane (not BAS swarm)
Wave I  Attestation verify ops (not TEE host)
Wave J  GTM commercial surfaces (no fake refs)
Wave K  Platform adjacency freeze (95–110)
Wave L  Blind rescore + release candidate
```

### Parallelism rules

| Rule | Detail |
| --- | --- |
| Isolation | Prefer `git worktree` / agent isolation; if shared tree, **no** `git reset --hard` / amend others’ commits |
| Agent count | **8–12** per wave max; each agent owns 1–3 matrix IDs or one E2E journey |
| Merge order | Safety/honesty → API contracts → UI → docs stamps → scorecard rescore |
| Exit gate | Focused tests green + acceptance path + help text + matrix label update if Fully-E2E |
| Stop condition | Any claim language regression fails the wave |

---

## 3. Wave A — Truth language + measured multi-hop APV (P0)

**Goal:** No primary UI/report can call a path **validated** unless hops are measured; multi-hop Measure journey is product-complete.  
**Matrix IDs:** 3, 4, 5, 11 (protect), claim language  
**Parallel agents (suggested 10):**

| Agent | Ticket | Deliverable | Exit |
| --- | --- | --- | --- |
| A1 | Path claim contract | Shared weakest-hop claim helper used on paths, findings, executive, reports | unit + report tests |
| A2 | Edge receipts persist | Store per-edge evidence refs on attack path hops | API + DB migration if needed |
| A3 | Measured recompute | Path validation state recomputed from edge receipts only | service tests |
| A4 | Multi-hop UI CTA | Measure path hops journey on `/attack-paths` (productize residual) | web e2e/component |
| A5 | Choke honesty | Path breakers labeled **evidence-backed**, never “min-cut Leading” | copy + tests |
| A6 | Graph export honesty | PDF/HTML paths cannot upgrade Heuristic → Validated | report tests |
| A7 | Findings path source | Findings show sourceMotion / measured hop fraction | UI tests |
| A8 | Acceptance | `attack-path-measured-hop-flow` or extend existing | acc green |
| A9 | Help | Product help guide for multi-hop Measure | help tests |
| A10 | Matrix stamp | Update COMPETITIVE_COVERAGE_MATRIX APV/choke rows | docs only |

**Do not:** claim Fully-E2E APV until ≥1 lab path has all hops Measured end-to-end.  
**Score impact:** enables later Leading reconsideration for #3 only after blind rescore.

---

## 4. Wave B — Detection rule validation emit→observe (P0)

**Goal:** One **signed** emit → observe loop for detection markers (DRV partial → Fully-E2E for **benign marker** class only).  
**Matrix IDs:** 8, 14, 15, 6 (observe remains)

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| B1 | Marker emit module | Runner-safe benign marker emit with policy decision |
| B2 | Observe correlation | SIEM/EDR observe binds same marker id + technique |
| B3 | One loop API | Mission/run that chains emit→observe with single evidence chain |
| B4 | macOS analytics path | Wire #14 to same loop when telemetry present |
| B5 | Linux analytics path | Wire #15 same |
| B6 | UI Controls surface | Operator can run “Detection marker proof” without raw scanner dump |
| B7 | Acceptance | emit-observe flow green against mock SIEM |
| B8 | Honesty | Catalog: Fully-E2E for marker class; still not full ATT&CK library BAS |

**Safety:** marker content allowlisted; no malware samples; no Atomic live.

---

## 5. Wave C — EASM continuous + data fabric honesty (P1)

**Goal:** Continuous external exposure on verified scopes + BYO import remains Imported≠Measured.  
**Matrix IDs:** 1, 66, 20, 79

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| C1 | Scheduled external safe profiles | Schedules fire External PoA / recon on due scopes |
| C2 | Change detection (honest) | Diff prior asset/exposure observations; no fake living map |
| C3 | Scan import residual | EvidenceArtifact chain depth if feasible; else keep Partial |
| C4 | Threat feed → technique | Improve KEV/technique mapping beyond regex scrape |
| C5 | Fabric quality UX | Ownership + quality states primary nav discoverable |
| C6 | Acceptance | external schedule + import honesty tests |

**Do not:** claim autonomous CT/whois pivot as EASM Fully-E2E without product path.

---

## 6. Wave D — Optional closed inject (P1, **gated**)

**Goal:** Optional **lab** closed inject→measure for SCV demos under dual approval. Default product remains observe-only.  
**Matrix IDs:** 6, 7 (URL filter lab), 65 (kill switch)  
**PERISCAN-460 progress:** docs + hard product refuse complete; **D1–D5 blocked on signed SOW** (product observe-only). Template: `docs/competitive/WAVE_D_INJECT_SOW_TEMPLATE.md`.

| Agent | Ticket | Deliverable | Status |
| --- | --- | --- | --- |
| D0 | Spec + SOW template | Dual-gate, scope bind, kill switch, audit, dry-run default | **Done** (template) |
| D1 | Policy flags | Tenant + scope flags for inject; default off | **Blocked on SOW** |
| D2 | Safe stimulus path | Only allowlisted benign stimuli (no Atomic Red Team live library) | **Blocked on SOW** |
| D3 | Observe binding | Stimulus id in SIEM/EDR observation | **Blocked on SOW** |
| D4 | URL filter canary | DNS/HTTP canary to Umbrella-class observer (lab) | **Blocked on SOW** |
| D5 | Deny-never-queue | Inject denied still never enqueued | **Blocked on SOW** (hard refuse already never queues live inject) |
| D6 | SE runbook | DEMO_OFFENSIVE_GUARDRAILS update | **Done** |
| D7 | Matrix | SCV Partial → “Partial (lab inject optional)” not Leading until customer proof | **Blocked on lab proof** |

**Hard stop:** no ransomware, spray, SharpHound, Caldera live, real exfil.

---

## 7. Wave E — RemOps language + IaC depth (P1)

**Goal:** Kill auto-mitigate confusion; deepen GitHub PR path; keep Fixed-only-via-verify.  
**Matrix IDs:** 67, 68, 69 (protect), 70, 71

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| E1 | Rename surface | Prefer `auto-revalidate` everywhere customer-visible |
| E2 | actionApplied honesty | UI never implies config push |
| E3 | Planner quality | Stack-aware templates (AWS SG, K8s NetPol, Okta policy) without fake AI claims |
| E4 | IaC multi-file preview | Expand beyond single-file PR if safe |
| E5 | ITSM bidirectional | Ticket status sync for Jira/SN (Partial→deeper Partial) |
| E6 | Webhooks residual | Event catalog HTTP if product needs it; else stay service-only |
| E7 | Acceptance | fix-verification + infrastructure-change flows |

---

## 8. Wave F — Connector Production depth (P1)

**Goal:** CustomerQualification → Production for top GTM connectors with live design-partner keys (when available).  
**Matrix IDs:** 72–78, 74 (Wiz co-exist), 76 (Tenable co-exist)

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| F1 | CrowdStrike Production checklist | Health, technique detect, rate limits, redaction |
| F2 | Wiz Production | Inventory + issues correlation proven on partner tenant |
| F3 | Tenable Production | Asset/vuln sync + import honesty |
| F4 | Datadog / QRadar | SIEM observe Production |
| F5 | vCenter | Document Partial forever or deepen inventory only |
| F6 | XSIAM honesty | Separate XSIAM vs Cortex clone claims |
| F7 | Catalog health | No Planned connectors appear Connectable |

**Parallelism:** one agent per vendor. No secrets in repo.

---

## 9. Wave G — Compliance audit-support honesty (P2)

**Goal:** Partial catalogs remain useful; never “certified.”  
**Matrix IDs:** 80–89

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| G1 | Control mapping depth | Expand representative controls per framework with evidence links |
| G2 | Report disclaimers | Every pack: “not certification / not audit opinion” |
| G3 | Scorecard demote guard | Strong only if mapping + evidence path real |
| G4 | GDPR isolation pack | Point at real RLS/tenant isolation tests |
| G5 | Help | Compliance workspace operator guide |

---

## 10. Wave H — Agentic **control plane** (not BAS swarm) (P2)

**Goal:** Strengthen governed AI ops; refuse multi-agent offense theater.  
**Matrix IDs:** 30–43, 32, 34–42; **explicit non-goal:** 29/33 Fully-E2E as BAS swarm

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| H1 | Virtual analyst UX | Session UX that always cites tool evidence ids |
| H2 | MCP host depth | Additional read-only tools with capability gates |
| H3 | A2A TCK CI | Nightly/on-demand TCK against approved endpoints |
| H4 | Flight recorder UX | Time-travel replay discoverable in product |
| H5 | HITL Slack/Teams notify | Approval interrupts via existing connectors |
| H6 | Feedback cycles | Operator UX polish for scenario feedback (bounded) |
| H7 | Honesty | Matrix: multi-agent orchestration remains Scaffold; no Leading |

---

## 11. Wave I — Attestation verify ops (P2)

**Goal:** Customer-supplied TEE/H100 evidence qualification is operationally excellent.  
**Matrix IDs:** 44–52, 53 (NHI inventory)

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| I1 | TEE assurance UX | Requirement → receipt → decision journey polished |
| I2 | NVIDIA NVAT path | Runbook + tests for detached-EAT |
| I3 | AgentDID/VC | Trust profile ops docs + acceptance |
| I4 | NHI inventory import | CSV/API bulk register (still not sprawl crawl) |
| I5 | Claim freeze | UI never says “runs in TDX” — only “qualified attestation” |

---

## 12. Wave J — GTM commercial surfaces (P2, no fabrication)

**Goal:** Real commercial plumbing when ready; **never** fake refs.  
**Matrix IDs:** 92–98, 95

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| J1 | Payment adapter interface | Stripe-or-equivalent behind NotConfigured until keys |
| J2 | Trial → paid conversion | Only when payment configured |
| J3 | AWS Marketplace listing checklist | Ops runbook; listing remains NotConfigured until seller account |
| J4 | White-label depth | Portal chrome beyond report logo |
| J5 | Design-partner evidence kit | Blind rescore package (zero logos unless real) |
| J6 | CLAIM_DENY_LIST sync | Productize any new refuse phrases |

---

## 13. Wave K — Platform adjacency freeze (95–110 class)

**Goal:** Document optional deployment features; stop them competing with CTEM score.

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| K1 | Score gate enforce | Confirm 16-row exclusion still machine-enforced |
| K2 | FinOps honesty flags | `selfHostedInferenceImplemented: false` etc. stay true until real |
| K3 | Ray (#99) | Explicit Absent in matrix; no stub modules |
| K4 | Extension SDK (#110) | Production extension publish path residual |
| K5 | Async ops (#107) | Scale tests / recovery room polish |

---

## 14. Wave L — Blind rescore + release candidate

**Goal:** Independent rescore before any external 95+ language.

| Agent | Ticket | Deliverable |
| --- | --- | --- |
| L1 | Blind rescore protocol | Follow `docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md` |
| L2 | Matrix rescore | Update COMPETITIVE_COVERAGE_MATRIX counts |
| L3 | Scorecard gate | `pnpm analyst:score:check` + Leading allowlist |
| L4 | Playwright smoke | Primary journeys green |
| L5 | Release notes | Honest Fully-E2E list only |
| L6 | Push RC | Tag + deploy only after L1–L5 |

---

## 15. Partner / deliberate non-goals (track, do not “complete”)

| ID | Feature | Disposition |
| --: | --- | --- |
| 2 | Dark web monitoring | Partner feed contract; honesty panel NotConfigured |
| 16 | Agentless APT | Plan-only; refuse automated pentest RFPs |
| 21 | Ransomware emulation | Safety floor forever unless separate legal product |
| 22 | Identity harvest | Live off; BloodHound import only |
| 26 | OT/ICS | Partner lab Validated only |
| 28 | Crowdsourced HITL | Partner SOW; no marketplace theater |
| 99 | Ray scaling | Absent; use existing async workers |

Agents assigned these IDs may only improve **honesty, docs, and refuse UX**.

---

## 16. Suggested agent dispatch template (copy per wave)

```text
You own Wave <X> agent <N>: <ticket title>.
Repo: periscan. Read Agents.md, SECURITY_BOUNDARIES.md, this plan §0.
Matrix IDs: <list>. Status target: <Partial|Fully-E2E|NotConfigured>.
Implement real-first. Add tests. Update COMPETITIVE_COVERAGE_MATRIX only if verified.
Do not: Atomic/Caldera live, SharpHound, fake Fixed, fake refs, invent ARR.
Exit: focused tests green + 1-page report under docs/qa/.../triage/agent-waveX-N.md
Commit message: fix(<area>): <ticket> (Wave X)
```

**Parent orchestrator:** merge in safety order, run `pnpm --filter @periscan/api exec vitest run` focused + web focused + analyst score check; push only after wave exit gate.

---

## 17. Score trajectory (internal only)

| Milestone | Expected internal index (approx.) | Condition |
| --- | --- | --- |
| Now | 71.6 | A8 honesty residual |
| Post Wave A–C | 78–84 | measured hops + DRV marker + EASM schedule |
| Post Wave D–F | 84–90 | lab inject optional + Production connectors + RemOps |
| Post Wave G–J | 90–94 | compliance honesty + GTM plumbing |
| Post Wave L | ≤95.9 only if blind rescore agrees | No self-score inflation |

If evidence does not support a raise, **do not raise**.

---

## 18. Success definition for “full coverage”

**Full coverage** for Periscan means:

1. Every core matrix row is **Fully-E2E**, **honest Partial with documented limit**, or **NotConfigured with partner path** — never silent Scaffold sold as shipped.  
2. Competitive matrix Fully-E2E list is accurate and battlecards match.  
3. Leading allowlist expands only via matrix Fully-E2E + gate + blind rescore.  
4. Safety floors intact.  
5. Zero fabricated market presence.

It does **not** mean matching Pentera/NodeZero live APT or Picus full multi-vector BAS libraries.

---

## 19. Related docs

| Doc | Role |
| --- | --- |
| `docs/qa/ANALYST_94_ASV_CTEM_95_SCORE_PLAN.md` | Slice history + 94-row completion contract |
| `docs/COMPETITIVE_COVERAGE_MATRIX.md` | External claim truth |
| `docs/competitive/POSITIONING.md` | Category home |
| `docs/competitive/COMPETITIVE_FEATURE_STRATEGY.md` | Gap → prove / integrate / refuse |
| `docs/competitive/CLAIM_DENY_LIST.md` | Forbidden claims |
| `docs/qa/CORE_PRODUCT_GAP_AUDIT_2026-07-16.md` | Historical gap audit |
| `docs/qa/panel-audit-exhaustive-2026-07-29-rerun/triage/INCOMPLETE_FEATURES_CLOSEOUT_2026-07-30.md` | Recent incomplete closeout |
| `SECURITY_BOUNDARIES.md` | Hard floor |

---

## 20. Immediate next action

**Execute Wave A** with ≥8 parallel agents (measured multi-hop APV + claim language).  
Dispatch brief: [`wave-dispatch/WAVE_A_DISPATCH.md`](./wave-dispatch/WAVE_A_DISPATCH.md).  
Do not start Wave D inject without explicit human SOW approval.

### Wave dispatch index

| Wave | Dispatch brief | Start after |
| --- | --- | --- |
| A | [WAVE_A_DISPATCH.md](./wave-dispatch/WAVE_A_DISPATCH.md) | now |
| B–L | Create `wave-dispatch/WAVE_<X>_DISPATCH.md` at wave kickoff (copy A template) | prior wave exit gate |
