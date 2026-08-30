# Blind independent rescore & release qualification (P13-18)

**Status:** Ops gate before external analyst / Wave RFI pursuit.  
**Related:** Slice 10, `scripts/analyst-score-gate.mjs`, `docs/qa/analyst-scorecard.json`.

## 1. Why this exists

Self-scored targets (e.g. 95.9) are **not** Forrester evidence. Blind rescore is the internal analog of questionnaire discipline. Premature external analyst engagement is a credibility risk.

## 2. Prerequisites (freeze before rescore)

1. Slices 3–5 product claims landed and stable for ≥1 release candidate.  
2. Claim language freeze: no new customer-facing Measured / Fixed / certification language during rescore window.  
3. `pnpm verify` green on the freeze commit.  
4. Sales decks and website copy pinned to the freeze commit (or clearly “draft”).

## 3. Blind rescore protocol

1. **Appoint scorer** who did not author the freeze-week implementation notes.  
2. **Lock scorecard** rows from `docs/qa/analyst-scorecard.json` / readiness assessment rubric.  
3. **Row-by-row evidence** — each score cell cites:
   - Product surface (route or API)
   - Test or live lab proof
   - Honesty residual if Partial  
4. **No negotiation** during scoring; comments only.  
5. **Publish rescored numbers** only after second reader spot-check of Critical rows.

## 4. Release qualification gates

| Gate | Pass condition |
|------|----------------|
| Analyst score gate script | `pnpm` / `scripts/analyst-score-gate.mjs` passes agreed floor |
| Acceptance suite | Focused acceptance for proof-loop + claim language green |
| Safety | No denied-queued regressions; Fixed-only-via-verification intact |
| Trust pack | Pen-test process documented; mTLS prod default acknowledged |
| Sales deck | Numbers match rescored scorecard only |

## 5. External Wave RFI start criteria

Only after:

1. Blind rescore complete with published internal memo  
2. Zero Critical open claim-language bugs from freeze  
3. Design-partner reference path identified (even if not public)  
4. Demo script limited to 7–10 honest screens (P13-14)

## 6. Claims we refuse until this gate passes

- “Analyst-ready 95+” as external fact  
- Deck numbers higher than last blind rescore  
- “Strong Contender” overall without Market Presence realism  

Parent finding: P13-18 / Slice 10.
