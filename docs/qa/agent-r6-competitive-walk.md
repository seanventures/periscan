# Agent R6 — Competitive walk (BAS refuse + Wiz co-exist)

**Date:** 2026-07-29  
**Worktree:** R6  
**Residuals:** P19-r2 / P19-r3  

## Problem

BAS refuse and Wiz co-exist battlecards existed as docs, but SEs lacked a
**single walkable product playbook** deep-linked to real UI routes (no fake
demo data, no inject claims, no CNAPP replacement).

## Delivered

### 1. In-product help guide

| Field | Value |
|---|---|
| **id** | `competitive-walk` |
| **title** | Competitive walk: BAS refuse + Wiz co-exist |
| **source** | `apps/web/src/lib/product-help.ts` |
| **lookup** | `getProductHelpGuide("competitive-walk")` |

Ordered deep-links (real surfaces only):

1. `/scopes` — Authorize verified scope  
2. `/engines` — Engine Lab honesty (not competitive inject BAS)  
3. `/controls` — Atomic dry-run; refuse full multi-vector BAS  
4. `/findings` — Active queue (default)  
5. `/attack-paths` — Multi-hop Measure CTA  
6. `/continuous` — Scorecard honesty (specialist Scaffold/gated)  

Guardrails in guide caution: no fake demo data, no inject-library claims, no
CNAPP replacement, Fixed only via verification, no score inflation.

### 2. Continuous hub — Sales walk (honest)

`apps/web/src/components/continuous-validation-hub.tsx` renders panel
`data-testid="continuous-sales-walk"` titled **Sales walk (honest)**, driven
by the same guide steps (ordered deep-links). No synthetic demo payloads.

### 3. Competitive docs

- `docs/competitive/BATTLECARDS.md` — **Product walk** section with ordered UI
  routes matching the guide  
- `docs/competitive/README.md` — **Sales walk (honest)** index entry  
- `docs/competitive/DEMO_AND_SE_RULES.md` — pointer for SEs after demo spine  

## Tests

```text
pnpm --filter @periscan/web test -- \
  src/lib/product-help.test.ts \
  src/components/continuous-validation-hub.test.tsx
```

Result: **7 passed**.

## Explicit non-goals

- No fake demo data injection  
- No live inject BAS claims  
- No “replace Wiz / CNAPP” language as a product claim  
- No scorecard Leading inflation  

## How SE uses it

1. Open `/continuous` → **Sales walk (honest)**  
2. Walk steps 1–6 in order on live tenant data (or honest empty/NotConfigured)  
3. Pair with battlecards A (BAS refuse) + B (Wiz co-exist) talk tracks  
