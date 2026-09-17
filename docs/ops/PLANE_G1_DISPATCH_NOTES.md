# Plane dispatch notes — G1 zero customer references / market presence

**Agent group:** G1  
**Date:** 2026-07-31  
**Repo:** periscan (overnight-loop)  
**Plane API:** not available to this agent (no token) — parent should apply states below.

## HARD RULE (do not violate)

**NEVER invent** customer logos, case studies, ARR, public references, or NDA partner names.  
**NEVER mark** market-presence reference tickets **Done** while `publicReferenceCount = 0`.

Market presence must remain **Fail** at zero public references.

## Ticket recommendations

| Ticket | Title theme | Recommended Plane state | Description / comment to append |
| ------ | ----------- | ----------------------- | ------------------------------- |
| **PERISCAN-431** | [P12-6][P0] Zero customer references → MQ Market Presence fail (`04dbcdc7-82eb-4ab2-a79a-332a40dc4870`) | **In Progress** or custom **Blocked / GTM** — **not Done** | `Engineering residual closed (honesty surfaces, factory docs, live marketPresence Fail at refs=0). GTM-blocked at publicReferenceCount=0. Do not mark Done until ≥1 real consented public reference and Wave/MQ gates re-evaluated (≥3 production + consent for Pass).` |
| **PERISCAN-183** | [P08-9][P0] Zero customer references (`2969e7c2-894f-4712-be92-4ee7abb0b3fa`) | Same as 431 — **not Done** | `Engineering residual closed; GTM-blocked at refs=0. Path: docs/DESIGN_PARTNER/REFERENCE_FACTORY.md + docs/ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md.` |
| **PERISCAN-374** | [P19-15][P1] No customer references Wave/MQ fail (`2a5c9035-a00a-4d30-b34a-af23de5182f3`) | Same — **not Done** | `Product correctly reports Wave/MQ Fail. Engineering residual closed; GTM-blocked at refs=0. No Wave/MQ questionnaire spend until factory G2+G3.` |
| **PERISCAN-126** | [P04-19][P2] No customer references peer diligence (`475627b2-0f95-4c5b-b8ad-ce9c15bb9455`) | Same — **not Done** | `Peer diligence honesty banner + live peerDiligenceGate=Fail. Engineering residual closed; GTM-blocked at refs=0. Wartime answer: confidential design-partner stage until written consent.` |
| **PERISCAN-30** | [Epic] Enterprise trust & GTM (`e3da756a-67e4-401f-9412-668fb03fde5e`) | Keep **open**; shippable honesty slices may be noted complete under epic | `Shipped G1 slices: zero-ref market presence productization, design-partner reference factory docs, Trust & Safety trust-pack honesty (SCIM NotConfigured, vendor SOC2 NotClaimed), path-to-first-ref ops doc. Epic remains open for real refs, Type II, inbound SCIM, payment settlement, and other enterprise GTM work.` |

## Suggested labels / properties

- `gtm-blocked` (or project equivalent)  
- `real-first`  
- `market-presence-fail`  
- Link all four residual tickets to epic PERISCAN-30  
- Link work items / PR commits that reference PERISCAN-431/183/374/126  

## Definition of Done (when GTM unblocks)

Only mark 431 / 183 / 374 / 126 **Done** when **all** are true from external evidence:

1. `publicReferenceCount > 0` from a real consent ledger (not fixtures)  
2. For Wave/MQ **Pass**: ≥3 production design partners **and** ≥3 signed reference permissions  
3. Reference pack inventory A–C filled with consented data (private store; redacted pointers only in repo)  
4. No fabricated logos or case studies in product, website, or decks  

## Shipped artifacts (for parent verification)

| Artifact | Path |
| -------- | ---- |
| Reference factory | `docs/DESIGN_PARTNER/REFERENCE_FACTORY.md` |
| Path-to-first-ref progress | `docs/ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md` |
| Pack checklist (empty) | `docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md` |
| Session learning log (0/5) | `docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md` |
| This dispatch note | `docs/ops/PLANE_G1_DISPATCH_NOTES.md` |

## Parent actions checklist

1. [ ] Open each ticket in Plane; append recommended description language  
2. [ ] Ensure state is **not Done** for 431/183/374/126  
3. [ ] Attach or comment link to `docs/ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`  
4. [ ] Note epic 30 shippable honesty slices without closing the epic  
5. [ ] Do not schedule Wave/MQ GTM questionnaire budget until factory G2+G3  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-31 | G1 dispatch: engineering residual closed language; leave tickets open GTM-blocked. |
