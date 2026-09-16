# Product copy rules (no fake case studies)

Status: **canonical**  
Related: real-first rule, P08-9 / #183, reference pack, moat defense  
Applies to: web UI, reports, decks, README, website, analyst questionnaires, sales email

## Absolute bans

1. **No fake case studies** — no invented companies, roles, outcomes, or timelines.
2. **No logo walls** without written logo consent from a production customer.
3. **No testimonials / quotes** without a real person, real tenant, and documented
   approval (legal / customer success vault — not improvised in a PR).
4. **No “Trusted by …” / “Used by Fortune …”** claims without named, consented
   references.
5. **No converting sample or lab output into customer language** (“our customers
   saw…”) when the source is fixtures, `/demo`, or internal range.
6. **No anonymized composite stories** that imply a real engagement (“a global
   bank reduced risk 40%”) without a real consented engagement behind them.
7. **No refused claim phrases** from the productized deny-list
   (`packages/shared/src/claim-deny-list.ts` refuse bucket) — including full BAS
   peer, live ransomware/kill-chain engine, CNAPP/RBVM replacement, or “we make
   you DORA/NIS2 certified.”

## Required honesty labels

| Surface | Required language |
| ------- | ----------------- |
| Public `/demo` and sample reports | Explicitly sample / fixture; not a customer environment |
| Design-partner mode | Operator-assisted; not a completed reference |
| Billing | Sales-led / NotConfigured until processor is real |
| Heuristic / simulated / pending / unconfigured | Never labeled as measured or Fixed without re-measure |
| Competitive comparisons | Grounded in [`../COMPETITIVE_COVERAGE_MATRIX.md`](../COMPETITIVE_COVERAGE_MATRIX.md) honesty tiers |

## Claim language contract (Wave Strategy asset)

Periscan’s differentiator is **honest partiality**: evaluators must never
misread a careful label as product incompleteness. Map every customer-visible
term to the evidence state machine:

| Customer-visible term | Means | Does **not** mean |
| --------------------- | ----- | ----------------- |
| **Measured** | Live or lab execution produced receipts under policy | Heuristic path, fixture, or simulated rail |
| **Heuristic** | Model/rule inference without measured hop receipts | Validated exploitability or Fixed |
| **Validated** (finding) | Evidence-backed exposure under current policy | “CVE scanner said so” without path/control context |
| **Fixed** | Remediation passed fresh verification (can demote) | Ticket closed, PR merged, or owner assertion alone |
| **AcceptedRisk** | Dual-control accepted residual | Silent suppress / false Fixed |
| **NotConfigured** | Integration or commerce path not wired | “Coming soon” theater that looks live |
| **Planned / Scaffold** | Documented intent; not connectable | Production capability claim |
| **RequiresLegalReview** | Engine gated until tenant license acceptance | Freely redistributed in default image |
| **Denied / never queued** | Policy rejected before task enqueue | Soft-fail empty UI |

**Demo rule:** lead with a Heuristic or incomplete path that **refuses** to
upgrade to Validated/Fixed until measured proof exists. Package honesty as
buyer risk reduction, not apology.

## Allowed pre-reference messaging

- Product capability statements that are true in the product today  
- Lab / measured-test-range proof **labeled as lab**  
- Process statements: “design-partner program,” “invoice-only commerce”  
- Safety and policy boundaries  
- “Proof layer on tools you already bought” positioning (see moat doc)  
- Empty states and NotConfigured rather than theater metrics  

## Forbidden pre-reference messaging

- Case study pages or PDF one-pagers with fictional companies  
- “Join leading enterprises already using Periscan”  
- Fabricated NPS, ARR, customer counts, or retention  
- Using competitor customer logos as if they were Periscan customers  
- Wave / Leader claims based only on feature scorecards  
- “MQ / Wave Leaders-ready” or market-presence Pass while public customer
  references remain **zero** (P12-6 / PERISCAN-431)

## When a real reference exists

1. Written consent on file (call / quote / logo tiers separate).  
2. Production deploy attested (not lab-only).  
3. Scenario claims match what that tenant actually ran.  
4. Redaction review before any public use.  
5. Update [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md) KPIs with
   real dates — never backfill with estimates.

## Review checklist before any external narrative

- [ ] Every customer name/logo/quote has consent  
- [ ] No sample path presented as production proof  
- [ ] Measured vs heuristic language intact  
- [ ] No payment/self-serve claim if processor NotConfigured  
- [ ] Reference pack KPIs still match reality  

## Current product surfaces (baseline)

As of this pack’s authoring:

- `demo/DEMO_SCRIPT.md` correctly states sample/fixture only  
- Billing workbench states sales-led / no card checkout when NotConfigured  
- No marketing case-study route in the web app home (product redirects to dashboard)  

Keep it that way until G2/G3 in the reference checklist are real.
