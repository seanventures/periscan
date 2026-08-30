# North-star KPI (only wartime company metric)

Status: **definition durable; multi-tenant company dashboard not productized**  
Related: P08-18 / #192  
Source: [`../qa/UI_RELEASE_ICP_ROADMAP.md`](../qa/UI_RELEASE_ICP_ROADMAP.md), [`ICP_WEDGE.md`](./ICP_WEDGE.md)

## The metric

> **Weekly tenants completing a measured Validate → Remediate → Re-validate proof
> loop without a Periscan employee narrating the UI.**

This is the **only** wartime company KPI. Everything else is support or vanity.

## Supporting KPIs (board / wartime staff — not vanity)

| KPI | Counts | Does not count |
| --- | ------ | -------------- |
| Tenants with ≥1 measured loop this week | Real tenant activation + rem re-validate measured | Playwright, seed tenants, sample `/demo` |
| Design-partner session pass rate | Protocol pass/fail from observed sessions | Unrun protocol, “feels good” |
| Paid / invoice conversions | approvalReference → package activation | Trial start alone |
| Referenceable production tenants | Written consent | Verbal praise, lab logos |

## Demote (engineering / not GTM)

| Metric | Role |
| ------ | ---- |
| 94-row analyst score progress | Slice / engineering completion only |
| Connector count | Fabric input depth — never GTM vanity |
| Primary route count | IA hygiene — zoo is a risk, not a win |
| Autonomous session counts | Labs / scaffold — never primary KPI |

## Product instrumentation honesty

| Layer | Current truth |
| ----- | ------------- |
| Per-tenant activation milestones | Real — `GET /api/v1/experience/activation` |
| Per-tenant work queue / Needs you | Real — dashboard home |
| Company-wide “weekly loops” executive dashboard | **Not productized** — do not claim admin BI exists |
| CRM north-star fields | **Process** — track in sales system until product analytics ships |

Optional later (only after design partners exist): admin-only aggregate of tenants
with measured re-validation events in rolling 7 days. Until then, wartime staff
count loops from CRM + session scorecards — never invent totals.

## Weekly wartime staff questions

1. How many tenants completed a measured loop this week?  
2. Design-partner session pass/fail count (real only)?  
3. Invoice / approval-reference conversions?  
4. Reference consent count (target three before Wave spend)?  
5. Any peacetime metric dominating the meeting? (kill it)

## Links

- ICP: [`ICP_WEDGE.md`](./ICP_WEDGE.md)  
- Sessions: [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)  
- Hard vs fake hard: [`HARD_VS_FAKE_HARD.md`](./HARD_VS_FAKE_HARD.md)  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Canonical north-star definition; honest non-instrumentation of company BI. |
