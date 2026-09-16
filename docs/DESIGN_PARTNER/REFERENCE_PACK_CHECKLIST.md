# Customer reference pack checklist

Status: **checklist durable; pack contents empty**  
Related: P13-1 / #259, P08-9 / #183, P12-6 / #431  
Real-first: empty cells stay empty until real consented customers exist

## Honesty banner (non-negotiable)

| Claim | Current truth (2026-07-29) |
| ----- | -------------------------- |
| Public customer references | **Zero** |
| Production design partners with reference-call consent | **Zero evidenced** |
| Case studies on website / decks | **None allowed** until real |
| Wave / MQ market presence | **Fail** while references = 0 |
| Sample `/demo` or lab E2E as customer proof | **Does not count** |

**Zero customer references = market presence fail.**  
That is the correct analyst and buyer reading. Do **not**:

- Invent logos, company names, or “anonymized F500” stories  
- Treat `demo@periscan.local` or seed fixtures as customers  
- Promote sample Validation Snapshot reports as production outcomes  
- Mark Wave inclusion or MQ viability green on docs alone  
- Write fake case studies “for the pitch deck until we get real ones”

When someone asks “who uses Periscan?”, the wartime answer is:

> We are in a confidential design-partner stage. We do not publish customer names
> until we have production deploy and written reference permission. We can show
> a labeled sample/lab proof path today and schedule a reference when partners
> consent.

## Purpose of this checklist

Operate a **reference factory** so that when real partners exist, the pack is
complete enough for Wave / peer-proof conversations. Completing the *template*
does not complete market presence.

Canonical factory stages (intake → measured proof → NDA reference rights → KPI):
[`REFERENCE_FACTORY.md`](./REFERENCE_FACTORY.md). Engineering vs GTM residual:
[`../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`](../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md).

## Gate summary

| Gate | Target | Status |
| ---- | ------ | ------ |
| G0 — Honest pre-commercial posture | Public materials refuse fake refs | **Required now** |
| G1 — Five ICP first sessions | Protocol pass/fail published | Open (needs partners) |
| G2 — ≥3 production deploy partners | Real tenants outside lab | Open |
| G3 — ≥3 signed reference permissions | Call + logo optional tiers | Open |
| G4 — Reference pack filled | Below inventory complete | Open |
| G5 — Wave / MQ questionnaire | Only after G2+G3 | **Do not start spend** |

## Reference pack inventory (fill only with real data)

### A. Company-level (per reference partner)

| Field | Partner 1 | Partner 2 | Partner 3 |
| ----- | --------- | --------- | --------- |
| Partner code (internal) | | | |
| Legal name (private) | | | |
| Public name / logo allowed? | | | |
| Industry / size band | | | |
| ICP role fit (leader + engineer) | | | |
| Production deploy date | | | |
| Package(s) active | | | |
| Connector(s) in production | | | |
| North-star loops completed (count) | | | |
| Reference call consent (date, form) | | | |
| Quote consent (verbatim + approval) | | | |
| Logo consent | | | |
| Churn risk / NDA constraints | | | |

### B. Scenario coverage (must match what we claim)

| Scenario | Partner who can speak to it | Notes |
| -------- | --------------------------- | ----- |
| Snapshot land on real domain | | |
| Measured path + evidence | | |
| Remediation + measured re-validate (incl. Fixed demotion if occurred) | | |
| Evidence pack to board / customer / auditor | | |
| Integration as signal (e.g. Wiz/Tenable/GitHub/AWS) | | |
| MSSP multi-client (only if real) | | |
| Isolation / tenant boundaries (MSSP) | | |

Do **not** claim BAS/SCV/DRV depth a partner never ran.

### C. Artifacts per partner (consent-scoped)

| Artifact | Required for Wave pack | Location when real |
| -------- | ---------------------- | ------------------ |
| Signed reference permission | Yes | private CRM / legal vault — not public repo |
| Production deploy attestation | Yes | private ops note |
| Redacted session or QBR notes | Recommended | `docs/qa/design-partner-sessions/` (redacted) |
| One approved public quote (optional) | Optional | marketing only after legal |
| Logo file + usage terms | Optional | brand kit only after consent |
| Isolation proof leave-behind (MSSP) | If MSSP claim | private PDF |

**Never commit** unredacted customer evidence, hostnames, credentials, or raw
scanner output to this repository.

### D. Aggregate market-presence KPIs (track honestly)

| KPI | Value | Last updated |
| --- | ----- | ------------ |
| Referenceable production tenants | **0** | 2026-07-29 |
| Signed reference-call permissions | **0** | 2026-07-29 |
| Public case studies | **0** (correct) | 2026-07-29 |
| Public logos | **0** (correct) | 2026-07-29 |
| Paid invoice conversions | **0** evidenced | 2026-07-29 |
| ICP sessions completed (of 5) | **0** | 2026-07-29 |

## Design-partner learning pack (separate from public references)

Before public references, run the internal learning loop:

1. [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)
2. [`../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md`](../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md)

Learning evidence ≠ market presence. Five sessions can prove usability without
any partner agreeing to be a public reference.

## Wave / MQ readiness decision tree

```
References == 0?
  YES → Market presence FAIL. Stop Wave/MQ GTM spend. Run design partners.
  NO  → ≥3 production + consent?
          NO  → Confidential narrative only; still not Wave-ready.
          YES → Fill pack A–C; then consider questionnaire.
```

## What does **not** fill this pack

- Internal verify / Playwright / acceptance tests  
- Seeded demo tenant  
- Public sample report at `/demo`  
- Competitive matrix scores  
- Connector client count  
- “Ready for first customer” engineering checklists alone  

## Product copy

See [`PRODUCT_COPY_RULES.md`](./PRODUCT_COPY_RULES.md). No fake case studies in
UI, decks, README, or analyst responses.

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial reference pack checklist. Explicit zero-ref = market presence fail. No partner data claimed. |
| 2026-07-30 | Residual P12-6 / PERISCAN-431: Trust & Safety market-presence panel restored; claim-deny + GTM refuse fabricated logos/Leaders-ready with zero refs; wartime logos/refs talk track in BATTLECARDS + WARTIME_SALES_MOTION. Still **zero** named customers. |
