# Exhaustive panel contract (all personas)

## Output file
Write ONLY to: `docs/qa/panel-audit-exhaustive-2026-07-29/personas/NN-slug.md`

## Mandatory minimum
- **At least 12 findings** (prefer 15–20) unique to your lens
- Cover **bugs, improvements, features, requests, innovations**
- Every finding must be **actionable** and **grounded** in code/docs/routes you actually inspected
- Reference previous panel themes when you agree/dissent (see PREVIOUS_PANEL_SYNTHESIS.md)

## Finding format (machine-parseable — exact)

```
### FINDING | <ID> | <severity> | <type> | <area> | <title>
- **Persona:** ...
- **Evidence:** path or route + what you saw
- **Problem:** ...
- **Impact:** ...
- **Recommendation:** ...
- **Effort:** S|M|L|XL
- **Zoo-related:** yes|no
- **Previous-panel-link:** none | U-XX | theme
```

- **ID:** `P{NN}-{n}` e.g. P01-1, P01-2
- **severity:** P0 | P1 | P2 | P3
- **type:** bug | improvement | feature | request | innovation
- **area:** nav | onboarding | proof-loop | findings | paths | remediation | engines | runners | integrations | evidence | reports | compliance | auth | security | api | a11y | gtm | competitive | ops | design-system | copy | performance | mobile | mssp | ai-agents | other

## Also required sections
1. Verdict 1–5 on your lens (with 5.0 definition)
2. Top 5 moves to reach 5.0
3. Feature-zoo / IA notes (what to cut, merge, rename, demote)
4. What is already excellent (do not break)

## Repo root
`/Volumes/DataSSD1/test/periscan`

## Method
Deep read: primary-nav, shell, key workbenches in your domain, shared claim-language, HANDOFF, score plan, previous synthesis. Prefer code over docs. Be adversarial. No product code changes — findings docs only.
