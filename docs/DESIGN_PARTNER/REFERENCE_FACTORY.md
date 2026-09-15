# Design-partner reference factory

Status: **process + product path durable; public references = 0**  
Tickets: P08-9 / #183 · P12-6 / #431 · P19-15 / #374 · P04-19 / #126 · Epic #30 (shippable slices)  
Real-first: **never invent** logos, case studies, ARR, NDA partner names, or public refs

This is the **operating factory** that turns authorized design partners into
*referenceable* customers. Completing the template, UI, or checklist **does not**
create market presence. While `publicReferenceCount === 0`, Wave / MQ / peer
diligence remain **Fail**.

## Honesty banner

| Claim | Truth |
| ----- | ----- |
| Public customer references | **0** |
| Production partners with reference-call consent | **0 evidenced** |
| Wave / MQ market presence | **Fail** |
| Product `marketPresence` / Trust & Safety | Live API; fails at refs = 0 |
| Sample `/demo`, lab E2E, seed tenants | **Do not count** |

> We are in a confidential design-partner stage. We do not publish names or logos
> without production deploy evidence and written reference permission.

## Factory stages (intake → KPI)

```
S0 Recruit (ICP wedge)
   ↓ written authorization + NDA as needed
S1 Intake (empty tenant / real scope)
   ↓
S2 Measured proof loop (Snapshot → Measured path → Remediate → Re-validate → pack)
   ↓
S3 Session learning note (internal; isPublicReference always false)
   ↓ repeat until 5 ICP sessions (learning gate, not market presence)
S4 Production design partner (real deploy outside lab)
   ↓ invoice / approval-reference OK while payment processor NotConfigured
S5 Reference-call rights under NDA (written consent; logo/quote optional tiers)
   ↓ ≥3 production + ≥3 signed permissions
S6 Reference pack fill (REFERENCE_PACK_CHECKLIST inventory A–C)
   ↓ only then
S7 Wave / MQ / peer diligence questionnaires (GTM spend unlock)
```

### Stage checklist

#### S0 — Recruit (ICP only)

| Step | Done when | Source |
| ---- | --------- | ------ |
| Forced ICP fit | Leader + engineer or MSSP/vCISO per wedge | [`ICP_WEDGE.md`](./ICP_WEDGE.md) |
| Refuse sprawl | No theater-first / GRC-only / RFP committee day-one | same |
| Moderator ready | Script open, no pre-coaching product terms | [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md) |

#### S1 — Intake

| Step | Done when | Product / doc |
| ---- | --------- | ------------- |
| Empty or clean tenant | No leftover demo proof mixed as measured | Design Partner Mode on Snapshot |
| Authorized scope in writing | Scope entity + verification path ready | Assets & Scope / missions |
| Consent for research notes | Partner code only in product notes | NDA / research consent (private) |
| Design partner mode on | `settings.enabled = true` | `PATCH /api/v1/tenants/current/design-partner` |

#### S2 — Measured proof loop (north-star unit)

| Step | Done when | Honesty |
| ---- | --------- | ------- |
| Connect real source **or** named lab | Integration status real | Fixture connectors never marketed as customer |
| Verified scope | Persisted verification event | Page visit ≠ complete |
| First measured result | Evidence + Measured state | Sample/demo reports do not count |
| Remediate + re-validate | Fixed only via verification event | No Fixed without retest |
| Audience evidence pack | Redaction, freshness, expiry set | Isolation pack ≠ vendor SOC 2 |

Operator playbook: [`../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md`](../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md).

#### S3 — Session learning (internal only)

| Step | Done when | Product |
| ---- | --------- | ------- |
| Observer scorecard filled | Pass/fail from real session | [`SESSION_LEARNING_LOG.md`](./SESSION_LEARNING_LOG.md) |
| Internal note logged | `POST .../design-partner/session-notes` | `isPublicReference: false` always |
| Gate 5 sessions | `sessionCount >= 5` | Still **not** Wave market presence |

**Learning ≠ market presence.** Five sessions prove usability; zero public refs
still fail Wave/MQ.

#### S4 — Production design partner

| Step | Done when | Does not count |
| ---- | --------- | -------------- |
| Real tenant outside lab | Production deploy attestation (private) | Playwright, seed, demo tenant |
| Package active | Entitlement / invoice / approval-reference | Trial start alone |
| North-star loop boring | Weekly loop without narrator | SE-driven demo only |

#### S5 — Reference-call rights under NDA

| Tier | Minimum for Wave pack | Storage |
| ---- | --------------------- | ------- |
| Reference call consent | Written, dated, scope of call | CRM / legal vault — **not** public repo |
| Quote consent | Verbatim + approval | Marketing only after legal |
| Logo consent | Optional separate tier | Brand kit only after consent |

Product APIs **never** set public references. Only an external consent ledger
may later raise `publicReferenceCount` (process outside this codebase until a
real ledger integration ships).

#### S6 — Reference pack fill

Fill [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md) sections A–C
only with real consented data. Empty cells stay empty.

#### S7 — Wave / MQ / peer diligence

| Gate | Unlock condition |
| ---- | ---------------- |
| G0 Honest posture | **Always required now** |
| G1 Five ICP sessions | Learning complete (still not market presence) |
| G2 ≥3 production deploy partners | Real tenants |
| G3 ≥3 signed reference permissions | Written rights |
| G4 Pack filled | Inventory A–C |
| G5 Wave/MQ questionnaire | Only after G2+G3; **no GTM spend before** |

Decision tree:

```
publicReferenceCount == 0?
  YES → Market presence FAIL. Stop Wave/MQ spend. Run factory S0–S5.
  NO  → productionDesignPartnerReferenceCount >= 3
        AND signedReferencePermissionCount >= 3?
          NO  → Confidential narrative only.
          YES → Fill pack; then consider questionnaire.
```

## KPI dashboard (honest zeros)

| KPI | Current | Source of truth |
| --- | ------- | --------------- |
| `publicReferenceCount` | **0** | Product `buildMarketPresenceReadiness()` |
| Production design-partner refs | **0** | External ledger (not invented in product) |
| Signed reference permissions | **0** | Legal / CRM |
| Public logos / case studies | **0** | Marketing (blocked) |
| ICP sessions completed | **0** | `sessionLearning.sessionCount` + log file |
| Wave / MQ / peer gates | **Fail** | Auto while refs = 0 |
| Weekly north-star loops (company) | Not productized | [`NORTH_STAR_KPI.md`](./NORTH_STAR_KPI.md) |

## Product surfaces (bind live data)

| Surface | Behavior |
| ------- | -------- |
| Trust & Safety | Live `marketPresence` banner + readiness panel + trust pack |
| Admin | Zero-refs honesty banner → Trust & Safety |
| Design Partner Mode (Snapshot) | Checklists, analyst evidence, session learning empty state |
| `GET /api/v1/trust-safety` | `marketPresence` from `buildMarketPresenceReadiness()` |
| `GET /api/v1/tenants/current/design-partner` | `sessionLearning.waveMarketPresenceReady: false` always from product |

## Path to first design partner (operator next action)

When references = 0, the **only** correct next action is the factory — not logos.

1. Open Design Partner Mode on Validation Snapshot; enable mode.
2. Recruit one ICP org per [`ICP_WEDGE.md`](./ICP_WEDGE.md).
3. Run one measured proof loop with authorized scope (S2).
4. File session record + optional product session note (S3).
5. Convert by invoice / approval-reference (S4).
6. Request written reference-call rights under NDA only after production value (S5).
7. Track KPIs in this factory + [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md).

Consolidated engineering vs GTM status:
[`../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`](../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md).

## What does **not** advance the factory

- Invented logos, “Fortune 500”, anonymized F500 fiction, fake ARR  
- Internal QA / Playwright as customer proof  
- Seed `demo@periscan.local` as a reference  
- Sample Validation Snapshot reports as production outcomes  
- Marking Plane #183 / #431 / #374 / #126 **Done** without real refs  
- Starting Wave/MQ GTM questionnaire spend at refs = 0  

## Links

| Doc | Role |
| --- | ---- |
| [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md) | Pack inventory + zero-ref honesty |
| [`SESSION_LEARNING_LOG.md`](./SESSION_LEARNING_LOG.md) | Five-session learning template |
| [`WARTIME_SALES_MOTION.md`](./WARTIME_SALES_MOTION.md) | Land / weapon / close |
| [`PRODUCT_COPY_RULES.md`](./PRODUCT_COPY_RULES.md) | No fake case studies |
| [`NORTH_STAR_KPI.md`](./NORTH_STAR_KPI.md) | Company wartime metric |
| [`../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md`](../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md) | Session operator checklist |
| [`../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`](../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md) | Code-complete vs GTM-blocked |

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-31 | Reference factory stages S0–S7; honest zero KPIs; path to first partner. No customer data claimed. |
