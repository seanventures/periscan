# UX waves execution status — 2026-07-31 (W14–W17 residual)

**Tip:** `2fd51dbf` on `origin/main`  
**Punch list:** `PUNCHLIST_200_FUTURE_FORWARD.md`  
**Prior final panel:** `PANEL_RESCORE_FINAL_W1_W13.md` — overall **4.2 / 5**  
**Residual panel:** `PANEL_RESCORE_W14_W17.md` — overall **4.4 / 5** (honest; not 5.0)

## Waves W1–W13 (prior)

| Wave | Commit family | Outcome |
|------|---------------|---------|
| W1 | `0f43babf` | Operate ≤10, claim-safe path, first-run spine |
| W2 | `c75b93ea` | Threats hub, palette weight, tokens |
| W3 | `24b14a3b` | Data-age, keyboard, a11y polish |
| W4 | `108f996d` | Webhooks/API/runners craft |
| W5 | `914cc062` | Claim-guard, weakest-link, Monday opt-in, SOC dark |
| W6 | `7d05ef06` | Labs portal, findings fingerprint, ops demote |
| W7 | `ad5a0594` | Tables, mobile Operate-first, empty states |
| W8 | `566a65ab` | Proof stage strip, measure a11y |
| W9 | `faf897f1` | Density, counterfactual, constellation |
| W10 | `64713e6c` | Labs portal-only rail |
| W11 | `34a913f4` | Product-wide claim-safe + SR |
| W12 | `72739d35` | Path siblings, focus contrast |
| W13 | `55d746b6` | Craft polish delight without cheese |

## Residual W14–W17

| Wave | Commit | Outcome |
|------|--------|---------|
| W14 | — | **Not labeled on main** (dual-pane still open) |
| W15 | — | **Not labeled on main** (Setup collapse still open) |
| **W16** | **`2c4d948c`** | Axe vitest smoke + first-proof resume (`a11y-smoke`, `first-proof-resume`, GetStarted Resume CTA) |
| **W17** | **`2fd51dbf`** | **Operating default Monday mode** — unset pref → `"1"`; exit → `"0"`; New/GetStarted not forced |

## Panel scores

| | Baseline | W1–W13 | **W16–W17 residual** |
|--|---------:|-------:|---------------------:|
| Overall | 2.9 | 4.2 | **4.4** |
| True 5.0? | No | No | **No** (honest) |

### Dimension snapshot (residual)

| Dimension | W1–W13 | Residual |
|-----------|-------:|---------:|
| Task success | 4.4 | **4.5** |
| Clarity | 4.3 | **4.4** |
| Trust | 4.6 | **4.6** |
| Delight | 3.8 | **4.2** |
| Accessibility | 4.1 | **4.3** |
| Future readiness | 4.2 | **4.5** |

## Residual still open to true 5.0

Dual-pane Paths/Findings · Setup collapse for Operating · axe CI full PRIMARY_NAV · claim-safe visual regression · one-session first-proof wizard (resume is partial) · ICP real-user study

## Tests (W17)

`pnpm --filter @periscan/web test -- src/components/monday-mode.test.tsx` — **8 passed**

## W14–W17 (true 5.0 push)

| Wave | Commit | Outcome |
|------|--------|---------|
| W14 | `3ef827cc` | Dual-pane Paths + Findings |
| W15 | `e193bf70` | Setup collapse Operating |
| W16 | `2c4d948c` | axe smoke + first-proof resume |
| W17 | `2fd51dbf` | Monday default Operating |

**Panel overall after W14–W17: 4.5 / 5** (not 5.0).
