# Competitive & category positioning (honest GTM)

Durable sales, SE, product, and analyst language for Periscan. These docs are
**positioning contracts**, not marketing fluff. They must stay consistent with
code-verified capability in:

- [COMPETITIVE_COVERAGE_MATRIX.md](../COMPETITIVE_COVERAGE_MATRIX.md) — what is real
- [COMPETITIVE_FEATURE_STRATEGY.md](./COMPETITIVE_FEATURE_STRATEGY.md) — prove / integrate / refuse
- [../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md](../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md) — multi-wave agentic build plan (110 matrix → executable waves)
- [SECURITY_BOUNDARIES.md](../../SECURITY_BOUNDARIES.md) — hard safety floor
- Panel findings P12-1/2, P19-1–4 (`docs/qa/panel-audit-exhaustive-2026-07-29/`)

## Canonical docs

| Doc | Owns |
|---|---|
| [POSITIONING.md](./POSITIONING.md) | Category home (AEV/CTEM proof), refuse full-BAS bake-offs, co-exist rules, denied phrases, MQ placement |
| [COMPETITIVE_FEATURE_STRATEGY.md](./COMPETITIVE_FEATURE_STRATEGY.md) | Gap strategy: prove, integrate, or refuse + wave map |
| [BATTLECARDS.md](./BATTLECARDS.md) | One-pagers: Wiz, Tenable, Pentera/Horizon3, Nuclei, Defender, AttackIQ/stimulus, compliance, integration depth |
| [CLAIM_DENY_LIST.md](./CLAIM_DENY_LIST.md) | **P19-20** productized prove / integrate / refuse claim language for GTM |
| [DEMO_AND_SE_RULES.md](./DEMO_AND_SE_RULES.md) | Demo order, SE walk-away rules, recipe names |
| [../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md](../qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md) | Waves A–L agent dispatch plan for matrix coverage |

## Non-negotiables (one screen)

1. **Home category = AEV / CTEM proof layer** — measure exposure paths and prove Fixed. Not full multi-vector BAS.
2. **Co-exist with Wiz** — bring inventory/issues; never “replace CNAPP.”
3. **Co-exist with Tenable** — validation and fix-proof on top of RBVM; never “replace vulnerability management.”
4. **Pentera gap is deliberate** — governed continuous validation with a hard floor that never lifts; **not automated pentest.**
5. **Visionaries is correct today** — Leaders requires Ability to Execute (references + measured multi-hop + SCV inject), not more vision docs.
6. **Deny-list is productized** — [CLAIM_DENY_LIST.md](./CLAIM_DENY_LIST.md) + `packages/shared/src/gtm-claim-language.ts` (P19-20).

## Sales walk (honest)

In-product single playbook for **BAS refuse + Wiz co-exist** (P19-r2 / P19-r3):

- Help guide id: `competitive-walk` — title *Competitive walk: BAS refuse + Wiz co-exist*
- Continuous hub: **Sales walk (honest)** on `/continuous` (ordered deep-links only)
- Ordered routes: `/scopes` → `/engines` → `/controls` → `/findings` → `/attack-paths` → `/continuous`
- Full battlecard product walk: [BATTLECARDS.md § Product walk](./BATTLECARDS.md#product-walk--bas-refuse--wiz-co-exist-honest)

No fake demo data. No inject claims. No CNAPP replacement. No score inflation.

## When you change product claims

- Update these docs **before** product UI strings, decks, or RFPs.
- If the coverage matrix says Partial/Scaffold/Missing, do not upgrade external language to Fully-E2E or “Leading.”
- Product UI must not claim full BAS, CNAPP replacement, RBVM replacement, or automated pentest.
