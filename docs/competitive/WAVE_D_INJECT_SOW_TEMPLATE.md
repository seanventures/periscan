# Wave D — Optional lab inject SOW template

**Status:** documentation / residual for [PERISCAN-460](https://plane.local.sean.network/goldeneye/projects/c6549620-33ca-46d1-a8b3-d24dc09a033e) (D0: Spec + SOW template)  
**Product path:** **not enabled** by this document. Default product remains **observe-only** control validation until a fully executed SOW **and** dual policy flags land.  
**This file is a written-contract template only** — it does not implement inject code, flip `control_live_execution_disabled`, or enable Atomic/Caldera live.

**Related:**

- Guardrails: [DEMO_OFFENSIVE_GUARDRAILS.md](./DEMO_OFFENSIVE_GUARDRAILS.md) (Wave D closed inject — SOW-only)
- Wave plan: [FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md](../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md) § Wave D
- Strategy: [COMPETITIVE_FEATURE_STRATEGY.md](./COMPETITIVE_FEATURE_STRATEGY.md) (Wave D = Prove lab / Refuse default)
- Safety floor: [SECURITY_BOUNDARIES.md](../../SECURITY_BOUNDARIES.md)
- SE demo rules: [DEMO_AND_SE_RULES.md](./DEMO_AND_SE_RULES.md)

---

## 1. Purpose

Use this template when a **customer or design partner** requests optional **lab** closed inject→measure (SCV stimulus / DRV inject-and-observe class work) under Wave D.

Without a signed SOW that satisfies every required field below, SE and product **refuse** inject work. Default shipping product stays telemetry **observe-only**.

---

## 2. Required SOW fields (checklist)

Every Wave D inject SOW **must** include all of the following. Missing any field → **do not proceed**.

| # | Field | What to write | Acceptance gate |
| --- | --- | --- | --- |
| 1 | **Customer authorization** | Named authorizing legal entity, primary contact, and statement that the engagement is **customer-authorized** (or design-partner authorized) for the named environment only. | Signature / countersignature block present |
| 2 | **Verified scope** | Explicit asset / network / account / tenant scope (CIDRs, hostnames, control-source IDs, SIEM indices, runner IDs). Out-of-scope list required. | Scope bind matches verified-scope records; no “all production” vague language |
| 3 | **Dual approvers** | Two named roles that must both approve before any inject run: (A) **tenant / customer security owner**, (B) **Periscan operator / engagement lead**. | Both names + email + date on SOW; product dual-gate (tenant flag **and** operator approval) still required at runtime |
| 4 | **Dry-run default** | Statement that inject execution mode defaults to **dry-run / plan-only** until both approvers explicitly enable a single live lab window. | SOW does not default live; first run is dry-run |
| 5 | **Kill switch** | Named procedure and owners for immediate stop: runner kill switch, tenant inject flag off, and “denied tasks never queue.” | Runbook pointer + who can invoke within minutes |
| 6 | **Audit** | Requirement that every inject decision, deny, dry-run, live attempt, stimulus ID, and observation correlation emits **audit events** and evidence IDs retained for the engagement. | Audit + evidence retention period stated |
| 7 | **Duration** | Start date, end date (or max calendar days), max number of live inject windows, and max concurrent inject missions. | Finite window; auto-expire language present |
| 8 | **Withdraw** | Customer or Periscan may **withdraw authorization at any time**; withdraw immediately revokes live inject, reverts to observe-only, and cancels pending inject work without queueing. | Withdraw contact + SLA to stop (e.g. same business day / immediate kill switch) |

### Optional but recommended fields

| Field | Notes |
| --- | --- |
| Allowlisted stimuli only | Exact technique IDs / benign marker names (e.g. `periscan-*` process canary); no open-ended “any Atomic test” |
| Success criteria | What “detect / block / miss / log-only” means for this lab; SIEM/EDR sources named |
| Environment class | Lab / non-prod preferred; if prod-adjacent, extra risk sign-off |
| Data handling | No real PII/exfil targets; evidence redaction rules |
| Claim language | Explicit: lab inject ≠ full BAS library; SCV remains Partial until matrix Fully-E2E customer proof |

---

## 3. Explicit never list (hard floor)

The SOW **must not** authorize, and Periscan **must not** implement under Wave D:

| Never | Why |
| --- | --- |
| **Live ransomware** / malware encrypt / destructive payload | Safety floor; non-negotiable |
| **SharpHound** (live collector in product) | Agents.md / security boundaries hard disable |
| **Caldera live** execution | Hard disable; no competitive “full adversary” theater |
| **Atomic live library** (unrestricted Atomic Red Team live) | Atomic remains dry-run import / scenario catalog only unless a separate certified allowlist program lands outside this residual |
| **Real data exfiltration** | No real customer data leave path as “proof” |
| Credential spray / theft, persistence, evasion packs, uncontrolled multi-stage exploit chaining | Same floor |
| Continuous multi-vector inject BAS sold as default product | Wave D is optional lab under SOW, not default GTM |

If a prospect’s RFP requires any row above, **refuse** (see §5). Do not weaken the floor to win a bake-off.

---

## 4. Default product remains observe-only

Until **both** are true:

1. Fully executed SOW (all required fields + signatures), **and**  
2. Product dual gates (tenant inject policy flag **and** operator approval; dry-run default; kill switch armed),

the product behavior is:

- Control validation = **observe** EDR/SIEM telemetry correlation only  
- Closed inject→measure remains **hard-disabled** (`control_live_execution_disabled` class)  
- Atomic / Caldera / SharpHound live remain off  
- Denied inject tasks **never queue**

**This residual (SOW template) does not enable the inject product path.** Implementation of D1–D5 (flags, safe stimulus, observe binding, canary, deny-never-queue) is separate work and still SOW-gated.

Matrix language: SCV stays **Partial (observe)** or at most **Partial (lab inject optional)** after a real lab proof — never **Leading** from a template alone.

---

## 5. How SE refuses without SOW

Use when a prospect, partner, or internal demo asks for inject / “full BAS” / Atomic live without a completed Wave D SOW.

### Spoken script (short)

> Periscan’s default product is **observe-only** control validation: we pull real EDR/SIEM telemetry and tell you Detected / Blocked / Missed / Logged-only with evidence.  
> **Closed inject→measure is Wave D lab work.** It requires a written SOW with dual approvers, verified scope, dry-run default, kill switch, audit, finite duration, and withdraw rights.  
> We do **not** run ransomware, SharpHound, Caldera live, Atomic live libraries, or real exfil — not for a demo and not to match a multi-vector BAS bake-off.  
> Without that SOW, we refuse inject and demo the honest observe path plus Fixed-only-via-verification.

### Walk-away conditions

| Ask | SE action |
| --- | --- |
| “Turn on inject for this call” | Refuse. Point to this template + DEMO_OFFENSIVE_GUARDRAILS |
| “Match AttackIQ/Cymulate scenario library live” | Refuse library parity. Offer one governed lab loop **only after** SOW |
| “Just run Atomic / Caldera / SharpHound once” | Hard refuse (never list) |
| “Skip dual approval; I am the only admin” | Refuse. Dual approvers are mandatory |
| “Leave inject on after the week” | Refuse open-ended duration; SOW must expire |

### After refuse — what to offer instead

1. Observe-only control validation with real connected sources  
2. Benign detection-marker class paths already in product (allowlisted; not full inject library)  
3. Measured multi-hop / fix verification proof loop  
4. Schedule a **design-partner SOW workshop** using this template (legal + security owners)

Do not invent fixture inject results as customer proof. Demo fixtures stay watermarked.

---

## 6. Fill-in SOW skeleton (copy into legal doc)

```text
WAVE D — OPTIONAL LAB CLOSED INJECT STATEMENT OF WORK
Engagement ID: _______________
Customer / design partner: _______________
Authorizing entity + signatory: _______________
Periscan engagement lead: _______________

1. AUTHORIZATION
   We authorize optional lab closed inject→measure solely for the scope in §2,
   subject to dual approval, dry-run default, kill switch, audit, duration, and
   withdraw in this SOW. Default product without this SOW remains observe-only.

2. VERIFIED SCOPE (in) / OUT OF SCOPE (out)
   In: _______________________________________________
   Out: ______________________________________________
   Environments (lab / non-prod / other): ______________
   Control sources / runners: _________________________

3. DUAL APPROVERS
   (A) Tenant/customer security owner: name / email / date
   (B) Periscan operator: name / email / date
   Live inject requires both; either may stop.

4. DRY-RUN DEFAULT
   First and default mode is dry-run / plan-only. Live lab windows require
   explicit dual re-approval per window: from ____ to ____ (UTC).

5. ALLOWLISTED STIMULI ONLY (no open library)
   ___________________________________________________
   Explicitly excluded: ransomware, SharpHound, Caldera live, Atomic live
   library, real exfil, credential spray/theft, persistence, uncontrolled chaining.

6. KILL SWITCH
   Owners: _______________  Procedure: runner + tenant inject flag off;
   denied tasks never queue. Stop SLA: _______________

7. AUDIT & EVIDENCE
   All decisions, denials, runs, stimulus IDs, and observations audited.
   Retention: _______________

8. DURATION
   Start: ________  End / auto-expire: ________
   Max live windows: ____  Max concurrent inject missions: ____

9. WITHDRAW
   Either party may withdraw authorization at any time. Withdraw reverts to
   observe-only immediately and cancels pending inject work without queueing.
   Withdraw contact: _______________

10. CLAIMS
    This lab does not authorize marketing claims of full multi-vector BAS,
    continuous inject library parity, or matrix Leading SCV without separate
    Fully-E2E customer proof.

Signatures:
Customer: ________________ date ______
Periscan: ________________ date ______
```

---

## 7. Residual tracking (PERISCAN-460)

**Progress (docs+gates complete until SOW):** D0 + D6 + hard product refuse are
landed. Product remains **observe-only**. **D1–D5 stay blocked** until a real
signed customer/design-partner SOW exists — do not implement enablement flags
or live inject paths “ready for SOW.”

| Residual | Status | Notes |
| --- | --- | --- |
| D0 Spec + SOW template | **Done** | This file |
| D1 Policy flags | **Blocked on signed SOW** | Default off forever until SOW; no enable path in product |
| D2 Safe stimulus path | **Blocked on signed SOW** | Allowlist only; never Atomic live library |
| D3–D5 Observe bind / canary / deny-never-queue | **Blocked on signed SOW** | Product + tests after SOW |
| D6 SE runbook | **Done** | DEMO_OFFENSIVE_GUARDRAILS + this template + SECURITY_BOUNDARIES |
| D7 Matrix language | **Blocked on customer-proof lab** | Do not promote Leading from docs |

**Product gate today:** `validateControlSource` refuses
`executionMode: LiveRunner` and `dryRun: false` with
`control_live_execution_disabled` (mentions Wave D SOW + dual gates). Denied
inject never queues because live inject never starts.

**Hard stop for agents:** do not implement inject product code, enable live offensive modules, or remove `control_live_execution_disabled` under this residual.

**Recommended Plane state:** keep **Backlog** (or Done only if project allows
“dormant until SOW” with explicit note that D1–D5 are residual). Parent decides.

---

## 8. References

- [DEMO_OFFENSIVE_GUARDRAILS.md](./DEMO_OFFENSIVE_GUARDRAILS.md)  
- [FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md](../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md) § Wave D  
- [COMPETITIVE_FEATURE_STRATEGY.md](./COMPETITIVE_FEATURE_STRATEGY.md)  
- [CLAIM_DENY_LIST.md](./CLAIM_DENY_LIST.md)  
- [SECURITY_BOUNDARIES.md](../../SECURITY_BOUNDARIES.md)  
- [Agents.md](../../Agents.md) — Do Not Touch / Safety Rules  
