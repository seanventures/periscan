# Blind rescore execution runbook (day-of)

**Status:** execution runbook — day-of operator script; **scorecard JSON not lifted**  
**Plane residual:** PERISCAN-468 (prep was O12 / `BLIND_RESCORE_PREP_PACK.md`)  
**Date:** 2026-07-30 (memo 2026-07-31)  
**Real-first:** do not invent scores, customer refs, or deck numbers

**R5 code/docs memo:** [`BLIND_RESCORE_MEMO_2026-07-31.md`](./BLIND_RESCORE_MEMO_2026-07-31.md)
(recommended ~70.7; prior internal index 71.6 held; **founder R6 not signed**;
second reader still required before any JSON/gate change). Completing this
runbook document alone does **not** complete full live-tenant R5 or R6.
A private vault pack + second-reader spot-check remain for release-qual green.

## Authoritative gates (read first)

| Doc | Role |
| --- | ---- |
| [`docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md`](../../DESIGN_PARTNER/BLIND_RESCORE_GATE.md) | Gate definition **R0–R7**; rescore pack; founder release-qual questions |
| [`docs/qa/wave-dispatch/BLIND_RESCORE_PREP_PACK.md`](./BLIND_RESCORE_PREP_PACK.md) | Pre-handoff assembly (strip grades, journeys inventory, freeze) |
| [`docs/qa/BLIND_RESCORE_RELEASE_QUAL.md`](../BLIND_RESCORE_RELEASE_QUAL.md) | Freeze protocol; Wave RFI start criteria |
| [`docs/competitive/CLAIM_DENY_LIST.md`](../../competitive/CLAIM_DENY_LIST.md) | Customer-facing deny phrases |
| [`docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`](../../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md) | Zero-ref honesty |
| [`demo/DEMO_SCRIPT.md`](../../../demo/DEMO_SCRIPT.md) | Wave spine screens (7–10) only |

---

## 0. Hard bans (operator + scorer)

| Forbidden action | Why |
| ---------------- | --- |
| Raise, rewrite, or “round up” `docs/qa/analyst-scorecard.json` without an independent rescore memo + second reader + founder go | Score inflation; internal index ≠ analyst placement |
| Raise floors in `scripts/analyst-score-gate.mjs` on the same commit as a self-grade bump without the memo | Same |
| Hand the scorer `analyst-scorecard.json` with `currentScore` / points / Leading exports as truth | Breaks **blind** (answer-key leakage) |
| Invent named customers, logos, ARR, or anonymized “F500” stories | Real-first + market presence fail while refs = 0 |
| Quote internal aggregates (e.g. prior totals) in the handoff cover or vault memo as if they were the rescore | Anchoring |
| Start paid Wave / MQ / analyst briefings before R5+R6 | Credibility risk (`BLIND_RESCORE_GATE.md`) |
| Claim “analyst-ready 95+” or deck numbers higher than last **blind** rescore | Deny-list / release-qual |

**Machine Leading allowlist (until matrix Fully-E2E expands + blind rescore):**
scorecard ids **11, 13, 24, 69, 90, 91** only (`scripts/analyst-score-gate.mjs`).
Do not expand the allowlist during day-of without founder written go.

---

## 1. Roles (who is who)

| Role | Who | Must | Must not |
| ---- | --- | ---- | -------- |
| **Operator** | Release / QA lead who freezes the commit and assembles the pack | Strip grades; provision clean tenant; capture env facts; run §2 T-0 checklist | Coach scores mid-session; open the grade sheet in the scorer’s folder |
| **Independent scorer** | Person who **did not** author freeze-week implementation notes | Score from product + allowed docs + live lab only; cite surface per row | See internal `currentScore` / path-to-95 deltas; negotiate grades during scoring |
| **Second reader** | Different person from scorer | Spot-check Critical rows against evidence captures | Re-score the whole card as a second self-score without product exercise |
| **Founder** | Release-qual sign-off | Answer R6 questions in writing (`BLIND_RESCORE_GATE.md` §Release qualification) | Waive market-presence fail without written reason |

If the intended scorer already internalized prior internal grades in another role,
**appoint a different scorer** (`BLIND_RESCORE_RELEASE_QUAL.md` §3).

---

## 2. Day-of timeline

### T-0 (operator, before scorer arrives) — ~30–60 min

1. Identify **freeze commit** SHA; prefer green `pnpm verify` on that commit when env allows.  
2. Claim-language freeze: no new customer-facing Measured / Fixed / certification copy during the window.  
3. Cut a **run folder** (private vault, not public git):  
   `blind-rescore-YYYY-MM-DD/` with subdirs `handoff/`, `evidence/`, `scores/`, `memo/`.  
4. Populate `handoff/` with the **R4 pack only** (§3).  
5. Explicitly **exclude** from `handoff/`:  
   - `docs/qa/analyst-scorecard.json` (or export **titles/criteria only**, no points/verdicts)  
   - Slice 10 path-to-95 tables, dimension floors, point deltas  
   - Any prose quoting internal aggregates  
   - Fabricated case studies, logos, pen-test PDFs that do not exist  
6. Write `handoff/COVER_NOTE.md` including the **zero-refs banner** (§6).  
7. Confirm clean tenant credentials work (lab or production-like; not “seed = customer”).  
8. Name **scorer** + **second reader** on the cover note.  
9. Queue founder release-qual questions (gate R6).

### T-start → T-score (scorer) — product exercise + scoring

1. Operator hands **only** `handoff/` + credentials.  
2. Scorer runs journeys in §4 (minimum: proof loop; then marker, schedule EASM, auto-revalidate if time).  
3. Scorer captures evidence per §5 into `evidence/` (screenshots, response IDs, honesty residuals).  
4. Scorer fills the rubric **row-by-row** into `scores/` (private). Each cell cites:  
   - Product surface (route or API)  
   - Test or live lab proof  
   - Honesty residual if Partial  
5. **No negotiation** during scoring; comments only.  
6. Operator stays available for env breaks only — not grade coaching.

### T-close (second reader + founder)

1. Second reader spot-checks Critical rows against `evidence/`.  
2. Scorer + second reader publish **rescored numbers only after** spot-check.  
3. Founder answers R6 go/no-go in writing.  
4. **Only then** may engineering update `analyst-scorecard.json` / gate floors to match the memo — never before, never “optimistic.”  
5. External Wave RFI / paid briefings remain **blocked** until R5+R6 (and R3 honesty: refs still 0 unless real).

---

## 3. What the scorer gets vs must not see

Aligned with [`BLIND_RESCORE_GATE.md`](../../DESIGN_PARTNER/BLIND_RESCORE_GATE.md) §Rescore pack and the prep pack.

### 3.1 Scorer receives (R4 pack)

1. **Clean tenant credentials** — production or lab deploy; not demo seed as production proof.  
2. **Architecture + threat model + security boundaries** — `SECURITY_BOUNDARIES.md`, trust docs.  
3. **Competitive coverage matrix** — honest states (`docs/COMPETITIVE_COVERAGE_MATRIX.md`).  
4. **Demo script** — Wave spine only (`demo/DEMO_SCRIPT.md`); sample/demo labeled.  
5. **Trust pack questionnaire kit** — process docs; no fake pen-test results.  
6. **Measured proof artifacts list** — this runbook §4 journeys.  
7. **Claim deny-list** — `docs/competitive/CLAIM_DENY_LIST.md` + product claim-language modules.  
8. **Rubric row list without scores** — titles / criteria only if a template is needed.

### 3.2 Scorer must **not** receive

| Forbidden handoff | Why |
| ----------------- | --- |
| `docs/qa/analyst-scorecard.json` with points / verdicts / aggregates | Answer key |
| Slice 10 “path to 95” tables, dimension floors, point deltas | Anchoring |
| “Leading” row exports treated as truth | Must re-earn from product + matrix |
| Prior Wave/MQ draft answers that overclaim | Credibility risk |
| Fabricated case studies, logos, ARR, design-partner quotes | Real-first |
| Pen-test PDFs that do not exist | Trust theater |
| Coaching that “we already scored this Leading” | Breaks independence |

---

## 4. Journey scripts (product, not decks)

Prefer **live lab or clean tenant**. Fixtures are for automated tests; sample
reports only when clearly labeled sample/demo. Scorer may stop a journey and
record **NotConfigured** / honest empty — that is a valid score input.

**Category line (room / memo):**

> Periscan is the **AEV / CTEM proof layer** on tools you already bought. We
> measure which exposures are real on authorized scope and prove fixes — we do
> **not** replace full multi-vector BAS libraries, CNAPP, or RBVM.

### 4.1 Proof loop (core AEV/CTEM spine)

**Goal:** Scope → connect/snapshot → measure path → remediate without inventing Fixed → re-validate → evidence pack.

| # | Operator / scorer step | UI / API | Pass signal (honest) | Capture |
| - | ---------------------- | -------- | -------------------- | ------- |
| 1 | Sign in to clean tenant | `/login` | Session real; not presented as customer | Auth OK |
| 2 | Authorize verified scope | `/scopes` | Scope **Verified**; policy decision present | Scope id + status |
| 3 | Connect honesty | `/integrations` | Beta/Planned honest; no fake Production elevation | Catalog honesty note |
| 4 | Run Validation Snapshot / mission | `/missions` or `/snapshots` | Real persistence or honest empty | Snapshot / mission id |
| 5 | Inspect path hops | `/attack-paths` | **Measured** vs **Heuristic** labels match model; no Measured forge | Path id + hop labels |
| 6 | Work a finding | `/findings` | Active queue; route to remediation | Finding id |
| 7 | Open remediation | `/remediation` | Ticket / plan without inventing **Fixed** | Remediation id + status |
| 8 | Re-validate | mark-ready / verify path (see §4.4) | **Fixed only after** verification event; Fixed can demote | Verification event id |
| 9 | Evidence / report | `/evidence`, `/reports` | Evidence IDs; no raw scanner dump as primary UX | Report / export id |

**Refuse during journey:** “full BAS”, autonomous red team, Fixed from disposition alone.

**Wave spine limit:** stay on Operate rail; do not open `/swarm`, `/workflows`,
`/mcp`, multi-vector BAS library slides unless the evaluator asks
(`demo/DEMO_SCRIPT.md`).

### 4.2 Detection marker proof (DRV benign-marker class)

**Goal:** Emit→observe allowlisted benign marker only; overall DRV stays Partial.

| # | Step | UI / API | Pass signal (honest) | Capture |
| - | ---- | -------- | -------------------- | ------- |
| 1 | Open Controls | `/controls` | Guide states marker class, not full ATT&CK library | Screenshot of honesty copy |
| 2 | Ensure control source (SIEM/EDR/XDR/WAF) | Controls register / list | Source exists or honest NotConfigured | Control source id |
| 3 | Run **Detection marker proof** | UI CTA or `POST /api/v1/control-sources/:id/detection-marker-proof` | Allowlisted `periscan-*` emit→observe chain; `drvClaimClass=benign_marker_only` (or equivalent); `fullAttackLibrary=false` | Mission / evidence ids + claim class |
| 4 | Read honesty residual | UI + response | Overall DRV **Partial**; no full BAS library claim | Quote residual text |

**Matrix honesty:** benign-marker class may be Fully-E2E; full ATT&CK inject library remains Scaffold. Live Atomic/Caldera execution stays **off**.

**Refuse:** “full detection-rule library inject-and-observe”, ransomware emulation, Atomic live.

### 4.3 Schedule continuous EASM

**Goal:** Scheduled continuous validation on **user-declared verified scopes** — not autonomous internet pivot.

| # | Step | UI / API | Pass signal (honest) | Capture |
| - | ---- | -------- | -------------------- | ------- |
| 1 | Open Continuous hub | `/continuous` | Honesty for continuous EASM; Scaffold/gated specialist rows not sold as Available BAS peers | Screenshot of Specialist coverage honesty |
| 2 | Open schedules | `/schedules` | Create/list schedule UI | Schedule list |
| 3 | Create schedule on verified scope | Schedule create (External / continuous EASM class as product allows) | Next-run preview; scope is verified user-declared | Schedule id + next run |
| 4 | Runner path (if present) | Runner signed-task polling | Real tool exec **or** honest NotConfigured / missing runner | Runner status |
| 5 | Optional run / pause | Schedule run or pause controls | Real mission linkage or honest empty | lastMission / status |

**Matrix honesty:** ASV/EASM recon under authorized scope can be real; “continuous living map / terrain” stubs stay non-primary.

**Refuse:** cert-transparency/whois pivot as production ASV without verified scope; “continuous validation” without schedule/revalidate qualifier.

### 4.4 Auto-revalidate (not auto-mitigate)

**Goal:** Plan + re-measure only; never control-plane / firewall push; Fixed still needs verification.

| # | Step | UI / API | Pass signal (honest) | Capture |
| - | ---- | -------- | -------------------- | ------- |
| 1 | Open a remediation | `/remediation` (detail) | CTAs prefer **auto-revalidate** language | Screenshot of CTA copy |
| 2 | Preferred API | `POST /api/v1/remediations/:id/auto-revalidate` | Chains planner → mark-ready → verify → audit; **no config push**; `actionApplied` false if exposed | Full response (redact secrets) |
| 3 | Legacy alias (optional) | `POST /api/v1/remediations/:id/auto-mitigate` | Documented **deprecated** alias of revalidate only | Note deprecation in capture |
| 4 | Fixed gate | Status after revalidate | **Fixed** only with verification evidence; can demote | Status transition + verification event |

**Matrix honesty:** revalidate path can be Fully-E2E; **fix push** remains Scaffold / not shipped.

**Refuse:** “auto-mitigate” as WAF/SG/firewall push; Fixed without VerificationEvent.

### 4.5 Optional supporting journeys (if time)

| Journey | Surfaces | Honesty bar |
| ------- | -------- | ----------- |
| Connector catalog Production board | `/integrations` | No fake Production elevation without live keys |
| Compliance evidence | `/compliance` | Framework **evidence attachment**, not “we make you compliant” |
| Trust & Safety | `/trust-safety` | Deny-list visible; pen-test process documented, not claimed run |
| Design-partner `analystEvidence` | Product instrument only | Zero customer quotes |

---

## 5. Evidence capture checklist

Store under the private run folder `evidence/`. Prefer redacted exports over secrets.

### 5.1 Per journey

- [ ] Timestamp (UTC) + freeze commit SHA  
- [ ] Tenant type: lab / clean / production-like (**not** “customer” unless real consented)  
- [ ] Route(s) and/or API operationId  
- [ ] Resource ids (scope, mission, path, remediation, schedule, control source)  
- [ ] Pass / Partial / NotConfigured / Fail with one-line honesty residual  
- [ ] Screenshot or API response excerpt (secrets redacted)  
- [ ] Claim-language check: no deny-list phrase asserted as true

### 5.2 Cross-cutting (end of day)

- [ ] Cover note zero-refs statement still accurate  
- [ ] No scorecard JSON in `handoff/`  
- [ ] Critical rows mapped to at least one evidence file  
- [ ] Second-reader checklist started (or scheduled)  
- [ ] List of claim-language bugs found (if any) for freeze follow-up  
- [ ] Explicit note: **internal scorecard not updated** pending memo + go

### 5.3 What not to capture as “proof”

- Demo seed outcomes presented as customer outcomes  
- Sample `/demo` report as production evidence  
- Deck screenshots without product exercise  
- Internal scorecard rows as circular proof

---

## 6. Zero named customer references (honesty)

| Claim | Current truth |
| ----- | ------------- |
| Public customer references | **Zero** |
| Production design partners with reference-call consent | **Zero evidenced** |
| Case studies / logos on website or decks | **None allowed** until real |
| Wave / MQ market presence | **Fail** while references = 0 |
| Sample `/demo` or lab E2E as customer proof | **Does not count** |

**Required cover-note text (handoff):**

> Market presence: **0** named customer references. Lab and design-partner
> instruments are not references. Sample reports are labeled sample/demo only.
> Blind rescore cannot invent refs. Gate R3 remains Open until real consented
> partners exist (`docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`).

**Wartime buyer answer** (“who uses Periscan?”):

> We are in a confidential design-partner stage. We do not publish customer names
> until we have production deploy and written reference permission. We can show a
> labeled sample/lab proof path today and schedule a reference when partners consent.

**Do not:** invent logos or company names; treat `demo@periscan.local` as a
customer; promote sample Validation Snapshot reports as production outcomes;
paper over zero refs with internal QA score lifts.

---

## 7. After the run — when scorecard may change

| Condition | Allowed? |
| --------- | -------- |
| Memo + second reader + founder **go**, scores match memo | Yes — update `analyst-scorecard.json` / gate floors in a dedicated commit citing memo + SHA |
| “We shipped features so scores should go up” without independent run | **No** |
| Demote rows after honesty review (overclaim found) | Yes — prefer demotion over silent freeze (`SLICE10_PATH_TO_95.md`) |
| Expand Leading allowlist without matrix Fully-E2E + blind rescore | **No** |
| External “95+” / deck numbers ahead of last blind rescore | **No** |

Gate status after memo + this runbook:

| Gate | Status |
| ---- | ------ |
| R0–R2 process | Process ready (see gate doc) |
| R3 references | **Open — refs = 0** |
| R4 pack for a run | Process ready; operator still cuts private run folder for live journeys (§2 T-0) |
| R5 independent rescore | **Code/docs memo complete** (`BLIND_RESCORE_MEMO_2026-07-31.md`); live-tenant + second reader still open |
| R6 founder go/no-go | **Not signed** (founder must answer in writing; memo does not issue go) |
| R7 pen-test summary under NDA | **Open** (process docs only) |

---

## 8. Related artifacts

- Prep pack: [`BLIND_RESCORE_PREP_PACK.md`](./BLIND_RESCORE_PREP_PACK.md)  
- Gate: [`docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md`](../../DESIGN_PARTNER/BLIND_RESCORE_GATE.md)  
- Release qual: [`docs/qa/BLIND_RESCORE_RELEASE_QUAL.md`](../BLIND_RESCORE_RELEASE_QUAL.md)  
- Design-partner index: [`docs/DESIGN_PARTNER/README.md`](../../DESIGN_PARTNER/README.md)  
- Overnight: [`OVERNIGHT_LOOP.md`](./OVERNIGHT_LOOP.md) (O12 = prep only)  
- RC checklist L1: `docs/qa/panel-audit-exhaustive-2026-07-29-rerun/triage/WAVE_LOOP_RC_CHECKLIST.md`

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-30 | PERISCAN-468: day-of execution runbook (roles, journeys, evidence, score inflation ban, zero refs). No independent run claimed. No score lift. |
| 2026-07-31 | Link R5 code/docs memo; gate table: R5 memo complete, R6 not signed, JSON not lifted. |
