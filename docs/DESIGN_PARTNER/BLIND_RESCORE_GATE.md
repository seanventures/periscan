# Blind independent rescore & release qualification gate

**Status:** process durable — gate defined; **R5 code/docs memo 2026-07-31**; **R6 founder go not signed**; **no scorecard lift**  
**Tickets:** P13-18 / #276 / PERISCAN-468  
**Real-first:** do not treat internal scorecard lifts as Magical Quadrant / Wave progress

## Purpose

Before any external analyst pursuit (Wave, MQ, peer diligence, paid analyst
briefings), require a **blind independent rescore** and release qualification so
internal Completeness-of-Vision / score inflation cannot masquerade as Ability
to Execute.

This document is the **gate definition**. Completing the document is not
completing the rescore.

## Non-negotiable rules

1. **Internal scorecard ≠ analyst placement.** `docs/qa/analyst-scorecard.json`
   is an engineering honesty instrument, not MQ progress.  
2. **Zero public references = market presence fail.** Rescore cannot invent refs.  
3. **Blind** means the rescorer does not use the prior internal grade sheet as
   answer key; they use product + docs + live lab only.  
4. **No paid analyst pursuit** (briefings, questionnaires, GTM spend) until
   gates below pass or are explicitly waived by founder with written reason.

## Gate checklist (must all pass or waiver)

| # | Gate | Evidence | Status |
| - | ---- | -------- | ------ |
| R0 | Category framing locked (AEV/CTEM proof layer) | `docs/competitive/POSITIONING.md` | Process ready |
| R1 | Claim deny-list enforced in product/GTM | `CLAIM_LANGUAGE_CATALOG` / competitive deny-list | Process ready |
| R2 | Design-partner learning path instrumented | Design-partner workspace `analystEvidence` + session protocol | Process ready |
| R3 | ≥3 production reference permissions **or** explicit “confidential only” stance | `REFERENCE_PACK_CHECKLIST.md` | **Open — refs = 0** |
| R4 | Blind rescore pack assembled (no internal grades attached) | This file §Rescore pack | Open until assembled for a run |
| R5 | Independent rescorer completes scorecard + narrative | [`docs/qa/wave-dispatch/BLIND_RESCORE_MEMO_2026-07-31.md`](../qa/wave-dispatch/BLIND_RESCORE_MEMO_2026-07-31.md) (code/docs); live vault + second reader residual | **Memo complete; live/second-reader residual** |
| R6 | Founder release qualification sign-off | Written go / no-go | **Not signed** |
| R7 | External pen-test summary available under NDA if security-sensitive pursuit | `docs/trust/PEN_TEST_ENGAGEMENT.md` | **Open** |

## Rescore pack (what the independent reviewer gets)

Provide only:

1. Production or lab deploy credentials for a clean tenant (no demo seed as “customer”).  
2. Architecture + threat model + security boundaries.  
3. Competitive coverage matrix (honest states).  
4. Demo script (Wave spine only).  
5. Trust pack questionnaire kit.  
6. List of **measured** proof artifacts the product can produce in-session.  

Do **not** provide:

- Internal “Leading” row exports as truth  
- Fabricated case studies  
- Prior Wave/MQ draft answers that overclaim  
- Pen-test PDFs that do not exist  

## Release qualification (founder)

Before external pursuit, founder answers in writing:

1. Market presence: references count? (honest number)  
2. Did blind rescore find claim language violations?  
3. Is multi-hop / SCV residual correctly labeled Partial/Scaffold?  
4. Is payment processor / Marketplace still NotConfigured (expected wartime)?  
5. Go / no-go for this analyst cycle.

## What this gate does **not** close

- External pen test itself  
- Customer references  
- Magical Quadrant inclusion  
- Live MSSP channel packaging  

## Related

- [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md)  
- [`../competitive/POSITIONING.md`](../competitive/POSITIONING.md)  
- [`../qa/analyst-scorecard.json`](../qa/analyst-scorecard.json)  
- [`../ANALYST_READINESS_ASSESSMENT.md`](../ANALYST_READINESS_ASSESSMENT.md)  
- [`../trust/PEN_TEST_ENGAGEMENT.md`](../trust/PEN_TEST_ENGAGEMENT.md)  
- Prep pack: [`../qa/wave-dispatch/BLIND_RESCORE_PREP_PACK.md`](../qa/wave-dispatch/BLIND_RESCORE_PREP_PACK.md)  
- Day-of execution: [`../qa/wave-dispatch/BLIND_RESCORE_EXECUTION_RUNBOOK.md`](../qa/wave-dispatch/BLIND_RESCORE_EXECUTION_RUNBOOK.md)  
- R5 memo: [`../qa/wave-dispatch/BLIND_RESCORE_MEMO_2026-07-31.md`](../qa/wave-dispatch/BLIND_RESCORE_MEMO_2026-07-31.md)  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial blind rescore / release qualification gate. No independent run claimed. |
| 2026-07-30 | Link prep pack + day-of execution runbook. Gate R5 still not run; no score lift. |
| 2026-07-31 | R5 code/docs memo linked; recommended ~70.7 vs internal 71.6; R6 not signed; no score lift. |
