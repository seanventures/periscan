# Design-partner reference playbook

Status: ready to run — external evidence not yet claimed complete  
Owner: product + security engineering  
Related workstream: P08-8 / P13-1 / P08-2 / P08-1 (design-partner evidence + wartime GTM)

## Purpose

Operate five observed ICP first sessions so Periscan can claim **session learning
readiness** for Wave 0 / Phase A release proof without substituting internal
QA, sample reports, or fabricated participant outcomes.

**Session learning ≠ market presence.** Five sessions can prove usability.
**Zero customer references still means Wave / MQ market presence fail.** Do not
fake customers, logos, or case studies to fill the gap — see
[`../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`](../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md).

This playbook is the **session operator checklist**. The durable GTM pack (ICP
wedge, wartime motion, reference factory, product copy) lives in:

- [`../DESIGN_PARTNER/README.md`](../DESIGN_PARTNER/README.md)

The research instrument is:

- [`ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](./ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)

Roadmap and wave context:

- [`UI_RELEASE_ICP_ROADMAP.md`](./UI_RELEASE_ICP_ROADMAP.md) — Phases A–D; Phase A
  still requires five observed sessions and measured medians
- [`../DESIGN_PARTNER/ICP_WEDGE.md`](../DESIGN_PARTNER/ICP_WEDGE.md) — forced single
  ICP; refuse audience sprawl
- [`../DESIGN_PARTNER/WARTIME_SALES_MOTION.md`](../DESIGN_PARTNER/WARTIME_SALES_MOTION.md) —
  land / weapon / close / expand (protocol is not a pipeline until executed)
- [`../MOAT_TRUTH_ARCHITECTURE.md`](../MOAT_TRUTH_ARCHITECTURE.md) — moat is truth
  architecture, not breadth theater
- [`ANALYST_REQUIREMENTS_2026_BUILD_PLAN.md`](./ANALYST_REQUIREMENTS_2026_BUILD_PLAN.md) —
  **W0 — Release proof** exit evidence includes five design-partner sessions
- [`HANDOFF.md`](./HANDOFF.md) — release UI implementation complete; external
  customer evidence intentionally not marked complete

## Real-first rule (non-negotiable)

- Product-visible and research claims must come from **authorized customer or
  controlled-lab data** and **persisted entities / verification events**.
- Do **not** count internal browser QA, demo mode, sample Validation Snapshot
  reports, or fixtures as participant evidence.
- Do **not** invent session times, pass rates, quotes, medians, customers, logos,
  or case studies. Leave blank tables empty until real sessions are recorded.
- **Zero references = market presence fail.** State it. Never paper over with
  sample proof or composite “customers.”
- Redact hostnames, evidence content, credentials, and customer identifiers from
  research notes. Record role and prior Periscan exposure only—no personal or
  customer secrets.
- Stop the session if the participant attempts an unauthorized or destructive
  target.

## ICP wedge (who we recruit)

Canonical rule: [`../DESIGN_PARTNER/ICP_WEDGE.md`](../DESIGN_PARTNER/ICP_WEDGE.md).

**Primary:** mid-market / upper-mid security leader + engineer who will run one
measured loop this week. **Promise:** Find the path. Validate the risk. Prove
it's fixed. **MSSP / vCISO:** scale wedge — still recruit for the five-session
mix, but do not treat MSSP as existence proof for the company.

Do **not** recruit for day-one learning: pure scanner-replacement shoppers,
theater-first autonomous pentest buyers, GRC-only teams with no engineer, or
“show me the whole platform” RFP committees.

## ICP participant mix (minimum five)

| Slot | Required role | Session ID | Recruited | Consent | Date | Status |
| ---- | ------------- | ---------- | --------- | ------- | ---- | ------ |
| 1 | Security leader or security engineer | DP-01 | [ ] | [ ] | | not started |
| 2 | Security leader or security engineer | DP-02 | [ ] | [ ] | | not started |
| 3 | MSSP or vCISO operator | DP-03 | [ ] | [ ] | | not started |
| 4 | MSSP or vCISO operator | DP-04 | [ ] | [ ] | | not started |
| 5 | Any ICP role above (flex) | DP-05 | [ ] | [ ] | | not started |

Mix gates from the protocol:

- [ ] At least **two** security leaders or security engineers
- [ ] At least **two** MSSP or vCISO operators
- [ ] At least **one** participant completes core flow primary actions by
      **keyboard only**
- [ ] No unqualified participant who helped design the tested workflow

## Pre-session checklist (every session)

Complete before the participant begins:

1. [ ] Empty tenant provisioned for the session (no leftover demo proof mixed in)
2. [ ] Participant authorized scope confirmed in writing or ticket
3. [ ] Real read-only source **or** clearly named controlled lab ready
4. [ ] Sample / public demo report is **not** the measured-evidence path
5. [ ] Effective scope safety ceiling and policy decision visible in product
6. [ ] Recording consent obtained (if recording); redaction plan agreed
7. [ ] Moderator has [`ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](./ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)
      open; will not name controls or pre-explain terminology
8. [ ] Session record template ready (copy protocol table; use participant code
      only)

## Five-session execution checklist

Run the moderator script from the ICP protocol for each session. Mark only
after the session is complete and the record is filled from real timestamps.

| # | Session ID | Safe setup done | Script complete | Activation milestones captured | Scorecard filled | Friction notes | Keyboard-only? | Record filed path |
| - | ---------- | --------------- | --------------- | ------------------------------ | ---------------- | -------------- | -------------- | ----------------- |
| 1 | DP-01 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| 2 | DP-02 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| 3 | DP-03 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| 4 | DP-04 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| 5 | DP-05 | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |

Moderator prompts (do not coach product terms before the participant acts)—full
script in the protocol:

1. Defensible proof of the most important reachable risk; begin from new account
2. Show what Periscan can read and what it cannot do yet
3. Authorize the smallest comfortable scope
4. State whether the action is measured / heuristic / simulated / unconfigured /
   pending **before** starting
5. Run first valid scenario; explain result in own words
6. Identify smallest path breaker; assign next action
7. Explain what is required before calling risk fixed
8. Prepare stakeholder proof: evidence, redaction, freshness, integrity,
   audience, delivery expiry
9. MSSP only: client exception batch; what remains tenant-bound

Record every support prompt separately. Repeat the task if needed; do not name
the control to click.

## Evidence to collect

### A. Per-session session record

Use the protocol **Session record** fields. One file or row per participant
code. Recommended store (when real sessions exist):

`docs/qa/design-partner-sessions/<session-id>/session-record.md`

(Do not create placeholder participant data here.)

Required fields:

| Field | Source of truth |
| ----- | --------------- |
| Participant code | Research code only |
| Role / organization type | Self-reported role class |
| Prior Periscan exposure | Self-reported |
| Authorized environment | Customer-authorized or named lab |
| Start / end time | Wall clock + consent notes |
| Time to connected source | `GET /api/v1/experience/activation` + persisted entities |
| Time to verified scope | same |
| Time to first mission | same |
| Time to first measured evidence | same |
| Clicks: prioritized result → owned remediation | Observer + product state |
| Path breaker time | Observer stopwatch + evidence navigation |
| Support prompts / wrong turns | Observer log |
| Denied or out-of-scope attempts | Product audit / observer |
| Measured-vs-heuristic explanation | Observer pass/fail + quote |
| Next-safe-action explanation | Observer pass/fail + quote |
| Proof accuracy review | Observer / human review notes |
| Top friction and exact language | Verbatim (redacted) |

**Milestone rule:** never infer completion from a page visit. A milestone is
complete only when its **persisted entity or verification event** exists.

### B. Observer scorecard (pass/fail per participant)

From the protocol; attach a short observation for each:

| Criterion | DP-01 | DP-02 | DP-03 | DP-04 | DP-05 |
| --------- | ----- | ----- | ----- | ----- | ----- |
| Reaches verified scope without coaching | | | | | |
| Starts first valid mission without coaching | | | | | |
| Distinguishes measured vs heuristic / sample / simulated / unconfigured / pending | | | | | |
| Identifies next safe action | | | | | |
| Finds path breaker + evidence in under two minutes | | | | | |
| Does not mistake proposed fix for verified fix | | | | | |
| Proof composer: inclusion, redaction, freshness, integrity, audience, expiry | | | | | |
| MSSP: batch triage does not perform cross-tenant mutations | n/a if non-MSSP | | | | |

### C. Aggregate measures (fill only after five real sessions)

| Aggregate | Value | Notes |
| --------- | ----- | ----- |
| Median time to verified scope | | Calculated from all five records |
| Median time to first mission | | Calculated from all five records |
| Count who explain measured vs heuristic without coaching | /5 | Phase A needs ≥4 |
| Count who identify next safe action without coaching | /5 | Phase A needs ≥4 |
| Anyone mistook sample/simulated/unconfigured/pending for measured? | yes/no | Must be **no** for Phase A |
| Keyboard-only primary-action completer present? | yes/no | Protocol minimum |
| Safety or truthfulness failures filed as product issues | count | Do not average them away |

### D. Evidence pack artifacts (session vault)

For each completed session, collect only what consent and safety allow:

| Artifact | Required | Location (when real) |
| -------- | -------- | -------------------- |
| Filled session record | Yes | `docs/qa/design-partner-sessions/<id>/session-record.md` |
| Scorecard row | Yes | pack summary or session file |
| Activation milestone timestamps | Yes | from API activation + entities |
| Redacted friction / verbatim notes | Yes | session file |
| Support-prompt log | Yes | session file |
| Screenshot or short clip of proof composer governance UI | Optional | redacted only |
| Product issue tickets for failures | When failed | link issue IDs in session file |

Do **not** store raw scanner output, credentials, unredacted customer
identifiers, or unredacted evidence bytes in the research pack.

### E. Wave / phase readiness evidence beyond first sessions

Phase A (first-session loop) is the five-session core. Wave reference readiness
also tracks adjacent external gates from the roadmap and W0 definition of done.
Mark only with real evidence:

| Gate | Source | Status | Evidence pointer |
| ---- | ------ | ------ | ---------------- |
| Five observed first sessions | Protocol; roadmap Phase A; W0 | not started | |
| Median time to verified scope + first mission | Protocol exit | not started | |
| ≥4/5 measured-vs-heuristic + next safe action | Protocol / Phase A / W0 | not started | |
| No sample/simulated/unconfigured/pending mistaken for measured | Protocol / Phase A / W0 | not started | |
| Grounded-analyst: 100% evidence citation for tenant facts | Protocol Phase C; roadmap Phase C; W0 | not started | |
| Grounded-analyst: zero successful policy/scope escapes | same | not started | |
| Path breaker + evidence &lt; 2 minutes | Protocol Phase C; roadmap Phase C | not started | |
| Human approval of proof traceability, audience, redaction, claim accuracy | Protocol Phase C; roadmap Phase C | not started | |
| Production build + full browser suite (desktop, 320–390px, 200% zoom, keyboard, reduced motion) | W0 DoD; engineering gate | engineering baseline separate from ICP sessions | see `HANDOFF.md` / verify logs |
| Dedicated MSSP demo tenant (portfolio, switch, batch, branding, boundaries) | W0 product work | product implementation; not a substitute for live MSSP sessions | |

## Success criteria

### Phase A / Wave 0 first-session exit (minimum for “sessions complete”)

Satisfied only when **all** of the following are true from the five real
records:

1. Median time to **verified scope** and **first mission** calculated from all
   five session records.
2. At least **four of five** participants explain **measured versus heuristic**
   and identify the **next safe action** without coaching.
3. **No** participant mistakes sample, simulated, unconfigured, or pending work
   for measured proof.
4. Participant mix and keyboard-only minimums from this playbook are met.
5. Every safety or truthfulness failure is filed as a reproducible product issue
   (route, tenant maturity, proof-loop stage, expected behavior, evidence)—not
   averaged away.

### Phase C / differentiation readiness (additional for full session pack)

Required in addition to Phase A for full design-partner **learning** claims that
include analyst, replay, and proof-pack differentiation:

1. **100%** evidence citation for factual grounded-analyst claims.
2. **Zero** successful policy/scope escapes.
3. Sub-two-minute path-breaker result with supporting evidence.
4. Human approval of proof pack traceability, audience fit, redaction, and claim
   accuracy.

### Customer reference / Wave market presence (separate factory)

Five sessions alone do **not** produce public customer references. For Wave /
MQ market presence, complete
[`../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`](../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md):

| Gate | Target | Counts only if |
| ---- | ------ | -------------- |
| Production partners | ≥3 | Real deploy outside lab |
| Reference-call consent | ≥3 | Written permission on file |
| Public case study / logo | Optional tiers | Separate consent; never invent |

**Current (do not advance without evidence):** referenceable production tenants
= **0** → market presence **fail**. Leave tickets #183 / #259 / #431 open until
real partners exist.

### What does **not** count as success

- Internal QA, Playwright journeys, or engineer walkthroughs alone
- Demo / sample reports used as measured proof
- Incomplete mix (missing security or MSSP roles)
- “Pass” marked without persisted milestone entities
- Claiming Wave 0 external evidence complete before the five-session exit
- Claiming market presence / Wave inclusion with zero customer references
- Fake or composite case studies “until we get real ones”

## Wave reference readiness summary

| Wave / phase | What this pack proves | Ready when |
| ------------ | --------------------- | ---------- |
| **W0 — Release proof** | ICP can run the measured proof loop without operator translation | Phase A session exit + W0 DoD engineering/visual gates; grounded-analyst citation evaluation when claiming full W0 external closeout |
| **Phase A — release learning loop** | First design partner reaches first evidence | Five sessions + medians + 4/5 + no measured-state confusion |
| **Phase B — proof loop is the product** | Weekly ops navigation cost | Needs production baseline comparison after Phase A baseline exists—not inventable from this pack alone |
| **Phase C — evidence-native differentiation** | Analyst, replay, proof composer credibility | Phase C gates above with real evaluations and human review |
| **Phase D — platform packs** | Expand without interface sprawl | Real entitlement/install lifecycle and honest cohort thresholds—out of scope for this five-session pack |

**Current claimed state (do not advance without evidence):**

- UI / instrumentation for Phases A–D: shipped (see roadmap closeout 2026-07-14)
- External design-partner evidence: **in progress / not complete**
- Five-session medians, 4/5 scorecard aggregates, Phase C evaluations: **blank
  until real sessions**

## After each session

1. [ ] Fill session record from activation API + observer notes (redact)
2. [ ] Complete scorecard pass/fail with short observations
3. [ ] File product issues for every safety/truthfulness or severe friction fail
4. [ ] Store artifacts only under consent and redaction rules
5. [ ] Do not update aggregate medians until all five sessions exist

## After all five sessions

1. [ ] Compute medians and 4/5 counts; fill aggregate table above
2. [ ] Confirm mix and keyboard-only gates
3. [ ] Decide Phase A exit: pass / fail with linked issues
4. [ ] If claiming full W0 external closeout, schedule grounded-analyst evaluation
      set, timed replay study, and human proof-pack review (Phase C)
5. [ ] Update [`UI_RELEASE_ICP_ROADMAP.md`](./UI_RELEASE_ICP_ROADMAP.md) and
      [`HANDOFF.md`](./HANDOFF.md) only with real outcomes—never placeholder
      “success”
6. [ ] Keep this playbook’s status line accurate

## Issue template (for failed thresholds)

When a threshold fails, open a product issue with:

- Route(s) and UI surface
- Tenant maturity (New / Activating / active)
- Proof-loop stage (connect → authorize → validate → understand → act → verify → prove)
- Expected behavior
- Observed behavior (redacted)
- Evidence: timestamp, entity IDs if non-sensitive, support-prompt count
- Participant code (not name)
- Severity: safety / truthfulness / usability

## Weekly dogfood cadence (process — not a score lift)

**Status:** process defined; **not** evidence of customer references or Production
connectors. Running this cadence does **not** raise the analyst scorecard or
create market presence.

Use after the continuous-loop lab demo is green (`pnpm lab:demo-up` / walk-spine)
so SE and product share one measured loop before external sessions.

| Cadence | Owner | Ritual | Artifacts (real only) |
| ------- | ----- | ------ | --------------------- |
| **Mon** | Eng | Lab smoke + `pnpm lab:walk-spine` (or document skip if lab down) | Lab-run JSON under `docs/qa/lab-runs/` or ticket note “lab offline” |
| **Wed** | SE + Eng | One internal dogfood of north-star loop on **authorized lab or partner scope only** | Session note: time-to-first-proof, blockers, claim-language issues |
| **Fri** | Product | 30-min triage of dogfood notes → backlog tickets (no score invent) | Plane/backlog links; no invented customer names |
| **Monthly** | Product | Review design-partner pipeline slots DP-01…05; recruit gaps | Updated participant mix table (empty until real consent) |

### Dogfood rules

1. **Authorized scope only** — lab `*.lab.range.test` or signed partner SOW scope.  
2. **No fixtures as proof** — demo seed data is not a customer reference.  
3. **Fixed only via verification** — never mark Fixed from ticket close alone.  
4. **Zero refs stay zero** — dogfood does not fill the reference pack.  
5. **Inject / Atomic / Caldera** stay off unless explicit SOW (Wave D).  

### Exit (process health, not analyst 95)

- Four consecutive weeks with Wed dogfood completed **or** explicit skip reason.  
- Open issues filed for every claim-language or blocked-path bug found.  
- ICP first-session protocol still required before Phase A “session learning ready.”

## Wartime motion (sessions feed the pipeline)

Protocol readiness is not a sales pipeline. After each real session, feed outcomes
into [`../DESIGN_PARTNER/WARTIME_SALES_MOTION.md`](../DESIGN_PARTNER/WARTIME_SALES_MOTION.md):

1. Land = Snapshot on their domain + one real connector  
2. Weapon = measured fix-verification / Fixed demotion  
3. Close artifact = audience evidence pack  
4. Quota = partners who complete the north-star loop without a narrator  
5. Expand / MSSP only after one verified fix is boring  

## Links (canonical)

| Document | Role |
| -------- | ---- |
| [`../DESIGN_PARTNER/README.md`](../DESIGN_PARTNER/README.md) | Durable GTM pack index |
| [`../DESIGN_PARTNER/ICP_WEDGE.md`](../DESIGN_PARTNER/ICP_WEDGE.md) | Forced ICP; refuse sprawl |
| [`../DESIGN_PARTNER/WARTIME_SALES_MOTION.md`](../DESIGN_PARTNER/WARTIME_SALES_MOTION.md) | Wartime land/weapon/close motion |
| [`../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md`](../DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md) | Reference factory; zero-ref honesty |
| [`../DESIGN_PARTNER/PRODUCT_COPY_RULES.md`](../DESIGN_PARTNER/PRODUCT_COPY_RULES.md) | No fake case studies |
| [`../MOAT_TRUTH_ARCHITECTURE.md`](../MOAT_TRUTH_ARCHITECTURE.md) | Moat = truth architecture |
| [`ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](./ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md) | Moderator script, measurements, scorecard, session record, exit decision |
| [`UI_RELEASE_ICP_ROADMAP.md`](./UI_RELEASE_ICP_ROADMAP.md) | Phase A–D outcomes and exit evidence; ICP product decision |
| [`ANALYST_REQUIREMENTS_2026_BUILD_PLAN.md`](./ANALYST_REQUIREMENTS_2026_BUILD_PLAN.md) | W0–W6 sequence; W0 five design-partner sessions |
| [`HANDOFF.md`](./HANDOFF.md) | Engineering closeout; points here for external evidence |
| [`../SECURITY_BOUNDARIES.md`](../SECURITY_BOUNDARIES.md) | Authorized scope, policy, no destructive execution |
| Agents.md / product Real-First Rule | Fixtures only in tests; no fake customer proof |

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial playbook: five-ICP checklist, evidence inventory, success criteria, wave reference readiness, links to ICP protocol. No participant data claimed. |
| 2026-07-29 | Linked durable GTM pack (ICP wedge, wartime motion, reference factory, product copy, moat). Explicit: zero refs = market presence fail; sessions ≠ public references. |
| 2026-08-03 | Weekly dogfood cadence (Mon lab / Wed loop / Fri triage / monthly DP slots). Process only — does not create refs or score lifts. |
