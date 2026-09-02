# Design-partner GTM pack (durable)

Status: **playbook + ICP durable** — external customer evidence still blank  
Owner: founder / product / security engineering  
Real-first: no fabricated customers, logos, quotes, case studies, or session results

This directory is the wartime go-to-market operating system for Periscan until
commercial PMF is proven. It does **not** claim market presence, Wave readiness,
or Magical Quadrant / Forrester market-presence viability.

## What is durable (done as process)

| Artifact | File | Closes |
| -------- | ---- | ------ |
| Forced ICP wedge | [`ICP_WEDGE.md`](./ICP_WEDGE.md) | P08-1 / #420 |
| Wartime sales motion | [`WARTIME_SALES_MOTION.md`](./WARTIME_SALES_MOTION.md) | P08-2 / #176 |
| Private deal desk (bands + conversion ops + MSSP units) | [`DEAL_DESK.md`](./DEAL_DESK.md) | P08-5 / #179, P08-13 / #187, P08-14 / #188 process |
| MSSP-first GTM wedge (ASV packs, QBR, partner bar) | [`MSSP_GTM.md`](./MSSP_GTM.md) | P12-18 / #256 process (zero trained partners claimed) |
| Design-partner checklist + anonymized proof-loop KPIs | [`ANALYST_EVIDENCE_METRICS.md`](./ANALYST_EVIDENCE_METRICS.md) | P12-20 / #258 (product metrics; zero customer quotes) |
| Hard vs fake hard eng freeze | [`HARD_VS_FAKE_HARD.md`](./HARD_VS_FAKE_HARD.md) | P08-10 / #184, P08-15 / #189 narrative |
| North-star KPI definition | [`NORTH_STAR_KPI.md`](./NORTH_STAR_KPI.md) | P08-18 / #192 process (company BI not productized) |
| Wartime seller scorecard | [`WARTIME_SELLER_SCORECARD.md`](./WARTIME_SELLER_SCORECARD.md) | P08-20 / #194 process (hire not claimed) |
| Reference pack checklist + zero-ref honesty | [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md) | structure for P13-1 / #259; honesty for #183 / #431 |
| Design-partner **reference factory** (intake → proof → NDA rights → KPI) | [`REFERENCE_FACTORY.md`](./REFERENCE_FACTORY.md) | operating system for first real refs; #183 / #431 / #374 / #126 path |
| Path-to-first-ref: code-complete vs GTM-blocked | [`../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`](../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md) | residual engineering closed language |
| Session operator checklist | [`../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md`](../qa/DESIGN_PARTNER_REFERENCE_PLAYBOOK.md) | P08-8 path |
| First-session instrument | [`../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](../qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md) | learning instrument |
| Session learning log (blank until real) | [`SESSION_LEARNING_LOG.md`](./SESSION_LEARNING_LOG.md) | P08-8 learning template |
| Moat / positioning | [`../MOAT_TRUTH_ARCHITECTURE.md`](../MOAT_TRUTH_ARCHITECTURE.md) | P08-7 / #181 |
| Product copy rules | [`PRODUCT_COPY_RULES.md`](./PRODUCT_COPY_RULES.md) | no fake case studies |
| MSSP Execute wedge GTM | [`MSSP_GTM_WEDGE.md`](./MSSP_GTM_WEDGE.md) | P12-18 / #256 narrative; packaging residual open |
| Blind rescore / release qualification gate | [`BLIND_RESCORE_GATE.md`](./BLIND_RESCORE_GATE.md) | P13-18 / #276 process |
| Design-partner analyst evidence (product) | `GET /api/v1/tenants/current/design-partner` → `analystEvidence` | P12-20 / #258 instrument |

## What remains open (needs real customers)

These cannot be closed with documentation alone. **Do not mark them Done.**

| Gate | Ticket theme | Honest status |
| ---- | ------------ | ------------- |
| Five observed ICP first sessions with medians / scorecards | P08-8 / #182 | Path built; **evidence of learning = 0** |
| ≥3 production design partners willing to take a reference call | P08-9 / #183, P12-6 / #431, P19-15 / #374, P04-19 / #126 | **Zero customer references** |
| Filled Wave / MQ reference pack (names, logos, deploy proof) | P13-1 / #259 | Checklist exists; **pack empty** |
| Analyst market presence / Wave inclusion | #183, #431, #267 | **Market presence fail** until references exist |
| Live MSSP commercial packaging / dogfood partner | P13-16 / #274 | GTM narrative ready; **no live channel packaging** |
| Independent control-plane pen test | P13-13 / #271 | Checklist in `docs/trust/PEN_TEST_ENGAGEMENT.md`; **not run** |
| Blind independent rescore execution | P13-18 / #276 residual | Gate defined; **rescore not executed** |

## Non-negotiable rules

1. **Zero references = market presence fail.** State it. Do not paper over with sample
   reports, lab demos, internal QA, or invented logos.
2. **Do not fake customers.** No synthetic case studies, no “Fortune 500” claims, no
   anonymized quotes without a real consented session record.
3. **Protocol ≠ pipeline.** The research protocol and this pack are not a sales pipeline
   until five sessions run and deals convert on invoice / approval-reference.
4. **ICP is forced.** Audience sprawl in the full PRD is TAM, not day-one ICP. Sell the
   wedge only (`ICP_WEDGE.md`).
5. **Moat is truth architecture**, not connector count or route count
   (`MOAT_TRUTH_ARCHITECTURE.md`).

## Sequence (existence → scale)

1. Land one org buyer on **Validation Snapshot** → measured path → remediation →
   measured re-validate → audience evidence pack.
2. Run five ICP first sessions; publish anonymized pass/fail (never invent scores).
3. Convert design partners by invoice / approval reference (payment processor still
   NotConfigured is fine).
4. Collect **three** referenceable production partners with written consent.
5. Only then: MSSP as primary channel motion, Wave/MQ questionnaires, public Marketplace
   GTM spend.

## Links

- UI / ICP product decision: [`../qa/UI_RELEASE_ICP_ROADMAP.md`](../qa/UI_RELEASE_ICP_ROADMAP.md)
- Competitive honesty: [`../COMPETITIVE_COVERAGE_MATRIX.md`](../COMPETITIVE_COVERAGE_MATRIX.md),
  [`../COMPETITIVE_FEATURE_STRATEGY.md`](../COMPETITIVE_FEATURE_STRATEGY.md)
- Safety: [`../../SECURITY_BOUNDARIES.md`](../../SECURITY_BOUNDARIES.md)
- Demo (explicitly sample): [`../../demo/DEMO_SCRIPT.md`](../../demo/DEMO_SCRIPT.md)

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial durable GTM pack: ICP wedge, wartime motion, reference checklist, product copy rules. Zero customer evidence claimed. |
| 2026-07-29 | Deal desk, hard-vs-fake-hard freeze, north-star KPI, wartime seller scorecard. Still zero customers claimed. |
| 2026-07-29 | MSSP GTM wedge, blind rescore gate, design-partner `analystEvidence` instrument. Still zero customers claimed. |
| 2026-07-31 | Reference factory stages + ops path-to-first-ref consolidation. Still zero customer references claimed; tickets GTM-blocked. |
