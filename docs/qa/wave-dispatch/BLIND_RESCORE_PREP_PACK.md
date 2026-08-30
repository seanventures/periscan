# Blind rescore prep package (O12)

**Status:** prep pack only — **no independent rescore claimed**  
**Overnight residual:** O12 (docs only)  
**Date:** 2026-07-30  
**Real-first:** assemble what a scorer needs; do not invent scores, refs, or lifts

This package is the **operator runbook** for assembling a blind independent
rescore. It does not execute the rescore. Completing this file does not close
P13-18 / #276.

## Authoritative gates (read first)

| Doc | Role |
| --- | ---- |
| [`docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md`](../../DESIGN_PARTNER/BLIND_RESCORE_GATE.md) | Gate definition R0–R7; rescore pack contents; founder go/no-go |
| [`docs/qa/BLIND_RESCORE_RELEASE_QUAL.md`](../BLIND_RESCORE_RELEASE_QUAL.md) | Freeze protocol, row-by-row evidence rules, Wave RFI start criteria |
| [`docs/competitive/CLAIM_DENY_LIST.md`](../../competitive/CLAIM_DENY_LIST.md) | Customer-facing deny phrases |
| [`docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`](../../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md) | Zero-ref honesty + empty pack inventory |
| [`docs/COMPETITIVE_COVERAGE_MATRIX.md`](../../COMPETITIVE_COVERAGE_MATRIX.md) | Honest Fully-E2E / Partial / Scaffold labels |

---

## 1. How to blind rescore without seeing the internal grade sheet

**Blind** means the rescorer does **not** use the prior internal score as an
answer key. Internal engineering index is an honesty instrument, not MQ/Wave
progress (`scoreGovernance.isMagicQuadrantProgress=false`).

### 1.1 What the rescorer must **not** receive

| Forbidden handoff | Why |
| ----------------- | --- |
| `docs/qa/analyst-scorecard.json` with `currentScore` / points | Anchors grades to the self-score |
| Slice 10 “path to 95” tables, dimension floors, point deltas | Same anchoring |
| Any prose that quotes the internal aggregate (e.g. “71.6”, “1347/1880”) | Answer-key leakage |
| “Leading” row exports treated as truth | Must re-earn from product + matrix |
| Prior Wave/MQ draft answers that overclaim | Credibility risk |
| Fabricated case studies, logos, ARR, or “design partner quotes” | Real-first violation |
| Pen-test PDFs that do not exist | Trust theater |

**Operator rule for this prep run:** strip or withhold scorecard JSON and any
doc that states the internal aggregate **before** the rescorer starts. If the
rescorer already saw internal grades in a prior role, appoint a different
scorer (`BLIND_RESCORE_RELEASE_QUAL.md` §3).

### 1.2 What the rescorer **does** receive (R4 pack)

Aligned with [`BLIND_RESCORE_GATE.md`](../../DESIGN_PARTNER/BLIND_RESCORE_GATE.md) §Rescore pack:

1. **Clean tenant credentials** — production or lab deploy; not “customer” seed as production proof.  
2. **Architecture + threat model + security boundaries** — `SECURITY_BOUNDARIES.md`, architecture/trust docs.  
3. **Competitive coverage matrix** — honest states only (`docs/COMPETITIVE_COVERAGE_MATRIX.md`).  
4. **Demo script** — Wave spine only; sample/demo labeled (`demo/DEMO_SCRIPT.md`).  
5. **Trust pack questionnaire kit** — process docs; no fake pen-test results.  
6. **Measured proof artifacts list** — what the product can produce **in-session** (journeys in §2).  
7. **Claim deny-list** — `docs/competitive/CLAIM_DENY_LIST.md` + product claim-language modules.  
8. **Rubric row list without scores** — if a scorecard template is needed, export **row titles / criteria only** (no verdicts, no points).

### 1.3 Scoring rules (rescorer)

1. Appoint a scorer who did not author freeze-week implementation notes.  
2. Row-by-row: each cell cites product surface (route or API), test or live lab proof, honesty residual if Partial.  
3. No negotiation during scoring; comments only.  
4. Publish rescored numbers only after second-reader spot-check of Critical rows.  
5. Do **not** raise floors in `analyst-score-gate.mjs` or rewrite `analyst-scorecard.json` until the memo exists and founder signs go/no-go.

### 1.4 Operator checklist before handoff

- [ ] Freeze commit identified; `pnpm verify` green on that commit (when env allows).  
- [ ] Claim language freeze: no new customer-facing Measured / Fixed / certification copy during the window.  
- [ ] Internal grade sheet removed from the handoff folder.  
- [ ] Zero customer references stated explicitly in the handoff cover note (§4).  
- [ ] Journeys in §2 runnable on the clean tenant (or documented as NotConfigured / lab-only).  
- [ ] Independent rescorer named; second reader named.  
- [ ] Founder release-qual questions queued (`BLIND_RESCORE_GATE.md` §Release qualification).

---

## 2. Evidence journeys to exercise

Rescorer exercises **product behavior**, not deck claims. Prefer live lab or
clean tenant. Fixtures are for tests only; sample reports only when clearly
labeled sample/demo.

### 2.1 Proof loop (core AEV/CTEM spine)

| Step | What to exercise | Pass signal (honest) |
| ---- | ---------------- | -------------------- |
| Scope | Authorize verified scope | Scope status Verified; policy decision present |
| Connect / snapshot | Validation Snapshot land | Real persistence or honest empty |
| Measure | Path / hop Measured vs Heuristic labels | Labels match data model; no Measured forge |
| Remediate | Ticket / rem plan without inventing Fixed | Fixed **not** available without verification |
| Re-validate | Verification event path | Fixed only after re-measure; Fixed can demote |
| Evidence pack | Report / export audience pack | Evidence IDs present; no raw scanner dump as primary UX |

**Surfaces:** Get Started / first-run spine, Validation Snapshot, attack paths, remediations, evidence ledger, reports.  
**Refuse:** “full BAS”, autonomous red team, inventing Fixed from disposition alone.

### 2.2 Detection marker (DRV benign-marker class)

| Step | What to exercise | Pass signal (honest) |
| ---- | ---------------- | -------------------- |
| Marker CTA | Controls / DRV workbench → detection-marker-proof | Calls `POST .../detection-marker-proof` (or documented client path) |
| Emit → observe | Allowlisted benign marker chain | Evidence chain for **benign marker class** only |
| Honesty copy | Partial / not full ATT&CK library | UI states DRV Partial; no full BAS library claim |

**Matrix honesty:** benign-marker class may be Fully-E2E; full ATT&CK inject library remains Scaffold. Live Atomic/Caldera execution stays off.  
**Refuse:** “full detection-rule library inject-and-observe”, ransomware emulation, Atomic live.

### 2.3 Schedule continuous EASM

| Step | What to exercise | Pass signal (honest) |
| ---- | ---------------- | -------------------- |
| Continuous UI | `/continuous` + schedule create | Next-run preview / honesty for continuous EASM |
| Scope seed | User-declared verified scopes | Not autonomous internet pivot as “customer discovery” |
| Runner path | Signed task polling when runner present | Real tool exec or honest NotConfigured / missing runner |

**Matrix honesty:** ASV/EASM recon modules can be real under authorized scope; “continuous living map / terrain” stubs stay quarantined / non-primary.  
**Refuse:** cert-transparency/whois pivot as production ASV without verified scope; “continuous validation” without schedule/revalidate qualifier.

### 2.4 Auto-revalidate (not auto-mitigate)

| Step | What to exercise | Pass signal (honest) |
| ---- | ---------------- | -------------------- |
| Preferred API | `POST /remediations/:id/auto-revalidate` | Chains planner → mark-ready → verify → audit |
| UI copy | Remediation detail CTAs / help | **auto-revalidate** language; no control-plane / firewall push claim |
| Legacy alias | `/auto-mitigate` if present | Deprecated alias only; customer copy prefers revalidate |

**Matrix honesty:** revalidate path can be Fully-E2E; **fix push** remains Scaffold / not shipped.  
**Refuse:** “auto-mitigate” as config push; Fixed without VerificationEvent.

### 2.5 Optional supporting journeys (if time)

| Journey | Honesty bar |
| ------- | ------------ |
| Connector catalog Production board | No fake Production elevation without live keys |
| Compliance evidence | Framework **evidence attachment**, not “we make you compliant” |
| Trust & Safety | Deny-list visible; pen-test process documented, not claimed run |
| Design-partner `analystEvidence` | Product instrument only; zero customer quotes |

---

## 3. Forbidden claims (rescore + GTM freeze)

Summarized from [`CLAIM_DENY_LIST.md`](../../competitive/CLAIM_DENY_LIST.md). Full list wins on conflict.

| Never claim during / after blind prep without new evidence | Positive substitute |
| --------------------------------------------------------- | ------------------- |
| Full BAS / multi-vector BAS peer / scenario-library parity | AEV/CTEM **proof layer** on authorized scope |
| Replace CNAPP / Wiz alternative | Bring inventory; prove path + fix |
| Replace Tenable / RBVM | Validation and fix-proof **on top of** RBVM |
| Automated pentest / autonomous red team | Governed continuous validation; hard safety floor |
| Ransomware emulation / live malware packs | Not in product |
| “We make you DORA / NIS2 / PCI / SOC 2 compliant” | Attach measured validation evidence to framework claims |
| False-positive-free (global) | Scope to measured edge with evidence IDs |
| “Leading” on Partial/Scaffold matrix rows | Fully-E2E + Leading allowlist only until rescore expands it |
| 100+ deep native integrations | Connectable vs planned; top-N depth |
| Microsoft CTEM replacement / rip out Defender | Cross-stack path + external PoA |
| “We run Nuclei” as hero claim | Authorized External PoA workflow |
| Continuous validation without qualifier | Scheduled + revalidation + signal-triggered truth |
| Auto-mitigate as control/firewall push | Auto-revalidate only |
| TEE host / confidential-enclave runtime | Customer-supplied attestation verifier language only |
| Ray scaling shipped | Absent / platform-adjacency freeze |
| Deck numbers higher than last **blind** rescore | Wait for memo + second reader |
| “Analyst-ready 95+” as external fact | Internal engineering index only until gate passes |
| Strong Contender overall without market presence realism | Zero refs = market presence fail |

**Machine Leading allowlist (until matrix Fully-E2E expands + blind rescore):** scorecard ids **11, 13, 24, 69, 90, 91** only (`scripts/analyst-score-gate.mjs`).

---

## 4. Zero customer references honesty

| Claim | Current truth |
| ----- | ------------- |
| Public customer references | **Zero** |
| Production design partners with reference-call consent | **Zero evidenced** |
| Case studies / logos on website or decks | **None allowed** until real |
| Wave / MQ market presence | **Fail** while references = 0 |
| Sample `/demo` or lab E2E as customer proof | **Does not count** |

**Handoff cover note must say:**

> Market presence: **0** named customer references. Lab and design-partner
> instruments are not references. Sample reports are labeled sample/demo only.
> Blind rescore cannot invent refs. Gate R3 remains Open until real consented
> partners exist (`REFERENCE_PACK_CHECKLIST.md`).

**Do not:**

- Invent logos, company names, or “anonymized F500” stories  
- Treat `demo@periscan.local` or seed fixtures as customers  
- Promote sample Validation Snapshot reports as production outcomes  
- Mark Wave inclusion or MQ viability green on docs alone  
- Paper over zero refs with internal QA score lifts  

Wartime buyer answer when asked “who uses Periscan?”:

> We are in a confidential design-partner stage. We do not publish customer names
> until we have production deploy and written reference permission. We can show a
> labeled sample/lab proof path today and schedule a reference when partners consent.

---

## 5. What this prep package closes vs leaves open

| Item | Status after O12 |
| ---- | ---------------- |
| Operator runbook for blind handoff | **This file** |
| Gate definition R0–R7 | Durable in `BLIND_RESCORE_GATE.md` — not closed by O12 |
| R4 “rescore pack assembled for a run” | **Process ready** when operator completes §1.4; still open until a real run folder is cut |
| R5 independent rescore | **Code/docs memo:** [`BLIND_RESCORE_MEMO_2026-07-31.md`](./BLIND_RESCORE_MEMO_2026-07-31.md) — live vault + second reader residual; JSON not lifted |
| R3 ≥3 references | **Open — refs = 0** |
| Score inflation / gate floor raise | **Forbidden** without memo + founder go |
| External Wave RFI spend | **Do not start** until release-qual gates pass |

---

## 6. Related overnight / release artifacts

- **Day-of execution:** [`BLIND_RESCORE_EXECUTION_RUNBOOK.md`](./BLIND_RESCORE_EXECUTION_RUNBOOK.md) (PERISCAN-468 — roles, journey scripts, evidence capture, score inflation ban)  
- Overnight loop: [`OVERNIGHT_LOOP.md`](./OVERNIGHT_LOOP.md) (O12 = docs only)  
- Progress log: [`OVERNIGHT_PROGRESS.md`](./OVERNIGHT_PROGRESS.md)  
- Release checklist L1: `docs/qa/panel-audit-exhaustive-2026-07-29-rerun/triage/WAVE_LOOP_RC_CHECKLIST.md`  
- Design-partner pack index: [`docs/DESIGN_PARTNER/README.md`](../../DESIGN_PARTNER/README.md)

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-30 | O12: initial blind rescore prep pack. No independent run claimed. No score lift. Zero refs stated. |
| 2026-07-30 | Link day-of execution runbook (PERISCAN-468). Still no independent run; no score lift. |
| 2026-07-31 | Link R5 memo; no score lift; founder R6 not signed. |
