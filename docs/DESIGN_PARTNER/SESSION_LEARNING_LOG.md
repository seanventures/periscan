# Design-partner session learning log

**Status:** template durable — **evidence cells blank until real sessions run**  
**Tickets:** P08-8 / #182 (learning); path supports #183 / #431 residual (still GTM-blocked at refs=0)  
**Real-first:** never invent pass/fail scores, medians, quotes, or partner names

This file is the **learning evidence template** for five ICP first sessions.
Completing the template structure does **not** complete market presence or
prove product-market fit. Leave rows empty rather than fabricate.

## Empty state — next action (operators)

| Status | Next action |
| ------ | ----------- |
| Sessions **0 / 5** (correct today) | Recruit one ICP participant per [`ICP_WEDGE.md`](./ICP_WEDGE.md) |
| No scorecard yet | Run moderator script in [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md) |
| Session complete | Fill scorecard below; optional `POST /api/v1/tenants/current/design-partner/session-notes` |
| Want public references | **Stop** — use [`REFERENCE_FACTORY.md`](./REFERENCE_FACTORY.md) S4–S5 after production value; learning notes never become public refs |

Product empty copy must stay honest: *No session notes yet. Need 5 sessions before
Wave learning gate. Internal notes do not create public references.*

Canonical instruments:

- Reference factory (intake → NDA rights → KPI): [`REFERENCE_FACTORY.md`](./REFERENCE_FACTORY.md)
- Moderator script + measurements: [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)
- Operator checklist: [`../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md`](../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md)
- ICP wedge: [`ICP_WEDGE.md`](./ICP_WEDGE.md)
- Code vs GTM progress: [`../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`](../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md)

## Gate (when evidence is real)

| Gate | Target | Status |
| ---- | ------ | ------ |
| Five observed ICP first sessions | Roles mix per protocol | **0 / 5** |
| Anonymized pass/fail scorecard published | 4/5 core tasks without measured-state confusion | Open |
| Feature freezes outside Snapshot→Verify path | CEO-owned until five convert or churn with reasons | Open |

## Session roster (fill only with real consented sessions)

| # | Date | Partner code (internal) | Role band | ICP fit | Recording consent | Status |
| - | ---- | ----------------------- | --------- | ------- | ----------------- | ------ |
| 1 | | | security leader / engineer / MSSP | | | not started |
| 2 | | | | | | not started |
| 3 | | | | | | not started |
| 4 | | | | | | not started |
| 5 | | | | | | not started |

## Observer scorecard (pass/fail — one block per session)

Copy the block for each completed session. Leave unused blocks deleted or empty.

### Session template

```
Session ID:
Partner code:
Date:
Moderator:
Participant role:
Prior Periscan exposure:

Core tasks (pass/fail + 1-line observation):
- [ ] Reach authorized scope without operator translation
- [ ] Explain Measured vs Heuristic / NotConfigured in own words
- [ ] Run first valid scenario and explain result
- [ ] Identify path breaker / next safe action
- [ ] Explain Fixed-only-after-retest
- [ ] Prepare stakeholder proof (audience, redaction, expiry)
- [ ] (MSSP) Tenant-bound exception batch explanation

Keyboard-only primary actions: yes / no / n/a
Support prompts count:
Wrong turns / backtracks:
Denied or out-of-scope attempts:

Activation timings (from GET /api/v1/experience/activation — never invent):
- signup → connected source:
- signup → verified scope:
- signup → first mission:
- signup → first measured result:
- remediation → fresh verification:

Voluntary feedback rating/comment:

Outcome: convert / nurture / churn
Documented reason (required if churn):
Feature requests logged (must map to Snapshot→Verify or kill):
```

## Aggregate (publish only after five real sessions)

| Metric | Value |
| ------ | ----- |
| Sessions completed | 0 |
| Pass rate on core tasks (mean) | — |
| Measured-state confusion incidents | — |
| Median time signup → first measured result | — |
| Keyboard-only completions | — |
| Convert / nurture / churn | — / — / — |

**Anonymized public scorecard:** not published (no sessions).

## Product API reflection

`GET /api/v1/tenants/current/design-partner` includes `sessionLearning`:

| Field | Honesty rule |
| ----- | ------------ |
| `sessionCount` | **0** until real internal notes exist (not invented) |
| `sessionsRequired` | Always `5` (W0 gate) |
| `sessions` | Empty list until operators POST notes |
| `waveMarketPresenceReady` | Always `false` from product |
| `message` | “Need 5 sessions before Wave…” when under gate |

Optional internal note intake (never a public reference):

`POST /api/v1/tenants/current/design-partner/session-notes`

Body: `{ partnerCode, note, roleBand?, outcome?, sessionDate? }` — partner codes are
internal-only; `isPublicReference` is always `false`.

## Honesty rules

1. Blank beats fake. Zero learning evidence is the correct state today.
2. Internal QA, demo tenants, and sample reports do **not** count as sessions.
3. Do not mark P08-8 “learning complete” until five real scorecards exist above.
4. References / Wave / MQ remain separate gates (`REFERENCE_PACK_CHECKLIST.md`, `REFERENCE_FACTORY.md`).
5. Product session notes support the residual path toward zero-ref ticket *unblocking* only after real sessions **and** external consent — never by inventing count. Do **not** mark #183 / #431 / #374 / #126 Done at sessionCount > 0 alone.

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial template; 0/5 sessions; product API reflection. |
| 2026-07-31 | Explicit empty-state next action; factory link; GTM-block reminder for reference tickets. |
