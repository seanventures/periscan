# Moat: truth architecture (not breadth theater)

Status: **canonical competitive positioning**  
Related: P08-7 / ticket #181  
Companions: [`COMPETITIVE_FEATURE_STRATEGY.md`](./COMPETITIVE_FEATURE_STRATEGY.md),
[`COMPETITIVE_COVERAGE_MATRIX.md`](./COMPETITIVE_COVERAGE_MATRIX.md),
[`DESIGN_PARTNER/ICP_WEDGE.md`](./DESIGN_PARTNER/ICP_WEDGE.md)

## One-liner (forced in every deck)

> **Periscan is the proof layer on top of the tools you already bought.**  
> We don’t replace Wiz or Tenable. We tell you which of their findings are
> reachable, whether your controls actually fired, and whether the fix stayed
> fixed — with evidence you can hand to a board without lying.

If any clause is false for a pillar still in scaffold/partial state, **remove that
clause from the sentence for that deal.**

## What the moat is

**Truth architecture** is the primary moat — a culture and data model, not a
feature checkbox:

| Pillar | Meaning |
| ------ | ------- |
| Measured vs heuristic | Verdict quality is first-class in the model and UI |
| Fixed only after re-measure | Stale Fixed can demote; revalidation is real |
| Signed / tamper-evident evidence | Runner results and packs defend integrity claims |
| No fabricated metrics | Anti-fabrication; sample paths isolated and labeled |
| Fail-closed policy & entitlement | Denied never queued; null package fails closed |
| Safety floor | No destructive / exfil / persistence / credential-theft kits |

This dies the first time sales or UI **overclaims** heuristic paths as validated,
sample as production, or scaffold as Fully-E2E.

## Secondary moats (in order)

1. **Close-the-loop RemOps** — automated revalidation that demotes stale Fixed.  
2. **Signal fabric depth** — connectors as inputs to proof, not logo count.  
3. **MSSP multi-tenant + PSA** — structural channel moat **after** single-org loop works.  

## Anti-moats (do not invest CEO calories here)

| Anti-moat | Why it loses |
| --------- | ------------ |
| Feature / route / pillar count | Peacetime vanity; competitors outspend theater |
| Connector logo slides without depth | Integration theater; buyers audit honesty |
| Competing as CNAPP vs Wiz | Capital death spiral |
| Competing as scanner vs Tenable | Commodity ASV race |
| BAS library parity vs Picus/Pentera/Cymulate before Snapshot PMF | RFP trap on incomplete SCV/DRV |
| Autonomous pentest theater | Buyers burned by false Fixed become yours only if you refuse the war |
| Public Marketplace / payment processor as GTM story | Process before cash is peacetime |

## Category map (how to sell)

| Archetype | They own | We do |
| --------- | -------- | ----- |
| **Wiz** | Cloud CNAPP / graph risk at scale | Ingest as signal; win on measured validation + fix proof |
| **Tenable** | VM / exposure breadth | Ingest; win on exploitability honesty + Fixed demotion |
| **AttackIQ / Picus / Cymulate** | BAS / control programs | Sell governed safe stimulus + signed evidence **only when real**; else detection coverage honesty and fix loop — not “we replace BAS” |
| **Pentera / Horizon3** | Autonomous pentest narrative | Refuse theater; authorized, non-destructive, measured chains |
| **XM Cyber** | Attack path / hybrid exposure | Compete on measured edges + choke points when real; label heuristic today |

## Strategy rule

From [`COMPETITIVE_FEATURE_STRATEGY.md`](./COMPETITIVE_FEATURE_STRATEGY.md):

> Every competitor sells “validate your security.” Their weakness is **overclaim**.
> Periscan’s differentiator: **every verdict is provable.**

Breadth without measured share is **not** the wedge. Publish and improve the
**measured/heuristic ratio** as a trust metric; do not hide it.

## Hard vs fake hard (moat lens)

### Actually hard (creates the company)

1. First measured customer proof without a narrator  
2. Claim-language invariant in API, UI, and PDF  
3. Promote path edges heuristic → measured on a real range  
4. Governed safe stimulus for SCV / inject-and-observe DRV when ready  
5. Cross-tenant isolation proof as an artifact for MSSP trust  
6. Deal desk economics and wartime sellers who can say NotConfigured  
7. Keep the safety floor under sales pressure  

### Fake hard (anti-moat work)

1. Parity matrices before Snapshot PMF  
2. OT/ICS prestige scaffolds  
3. Payment processor “to scale” before invoices are boring  
4. Public Marketplace as lead GTM  
5. Another wave of shallow connectors  
6. Frontier / swarm marketing  
7. Compliance pack types without control-mapping matrix  

## GTM enforcement

- Sales kit and ICP: [`DESIGN_PARTNER/`](./DESIGN_PARTNER/)  
- Session evidence: [`qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md`](./qa/ICP_FIRST_SESSION_RESEARCH_PROTOCOL.md)  
- Product copy: [`DESIGN_PARTNER/PRODUCT_COPY_RULES.md`](./DESIGN_PARTNER/PRODUCT_COPY_RULES.md)  
- Zero references: state market presence fail; never invent customers  

## Scoreboard question

Before any competitive claim in public:

1. Is it measured in product for this tenant?  
2. Is it labeled if not?  
3. Would we hand this sentence to a board with evidence IDs?  

If no → cut the sentence. That discipline **is** the moat.

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Canonical moat doc: truth architecture vs breadth theater; one-liner; anti-moats; hard vs fake hard. |
