# UX validation — 2026-08-15 (first-run after GA-4)

**Method:** House funnel. Layer 0 not re-run (no Lighthouse). Layer 1: live walk on `http://127.0.0.1:3010`. Layer 2: five ICP reviewers (SE, CISO, SOC L2, a11y, mid-market). Layer 3: orchestrator vs code/screenshots.

**ICP:** Mid-market SE + leader; SOC L2; a11y. Laptop primary; 390px residual.

**Not claimed:** panel mean 5.0, MQ/Wave, customer refs. This board is a **new empty tenant**, not the seeded lab demo (lab `fullyMeasured=true` is a separate API fact).

## Layer 0

| Gate | Result |
|------|--------|
| aurora / `onb-pulse` CSS | **Gone** from `get-started.tsx` + `globals.css` |
| Route axe / Lighthouse | Not run this session |

## Layer 1 — JTBD table

Live script: `docs/qa/ga-2026-08-15/layer1-walk.mjs`. Screenshots in the same folder.

| JTBD | Result | Notes |
|------|--------|-------|
| Signup → first-run Home | **Partial** | DOM H1 was “Let's prove your first path.” Desktop PNG caught Command Center skeletons first (race). Mobile PNG is GetStarted. |
| No aurora / no second guide | **Pass** | `auroraCount=0`; no “Full activation guide”; `/getting-started` → `/dashboard` |
| New Operate rail | **Pass** | Home · Connect · Scope · Validate |
| Scope / Paths / Findings / Executive render | **Pass** | Named H1s on each route |

**Fix landed after Layer 1:** `dashboard-command-center.tsx` now mounts GetStarted whenever no snapshot/path/finding exists — do not wait for the three list fetches (that wait painted the zoo). Needs a re-walk to retire finding #1.

## Layer 2 — rubric (pilot, empty tenant)

| ID | Role | Task | Clarity | Trust | Delight | A11y | Mean |
|----|------|:----:|:-------:|:-----:|:-------:|:----:|:----:|
| R1 | SE | 3 | 2 | 4 | 3 | 3 | 3.0 |
| R2 | CISO | 2.8 | 2.4 | 3.4 | 2.1 | 2.9 | 2.7 |
| R3 | SOC L2 | 3 | 3 | 4 | 2 | 3 | 3.0 |
| R4 | A11y | — | — | — | — | 3.6 | — |
| R5 | Mid-market | 2 | 2 | 4 | 2 | 3 | 2.6 |
| **Mean (R1/R2/R3/R5)** | | **2.7** | **2.4** | **3.9** | **2.3** | **3.0** | **~2.8** |

Do **not** compare this to the Slice F ~4.9 board: that was a seeded/mature walk. Empty first-run is a different job.

## Layer 3 — confirmed (2+ reviewers or code-proven)

| Sev | Finding | Where | Status |
|-----|---------|-------|--------|
| **P1** | Desktop first-run paints Command Center skeletons while lists load | `dashboard-command-center.tsx`; `01-first-run.png` | **Fixed** (GetStarted until any list has rows). Re-walk pending. |
| **P1** | Four first-run scores (0/3, 17%, 0/7, 1/9) | `get-started.tsx` | Open |
| **P1** | Executive undiscoverable on New/Activating | `NEW_TENANT_NAV` omits `/executive` | Open (tradeoff: slim first-run vs leader ICP) |
| **P2** | Setup “Getting started” is a Home alias | `NEW_TENANT_NAV` + redirect | Open |
| **P2** | Footer says rail includes Runners | `get-started.tsx` | Open |
| **P2** | Findings empty day is program chrome, not triage | `findings-workbench.tsx` | Open |
| **P2** | Step cards lack focus-visible; CTA hover `#3c96ff` fails AA | `get-started.tsx`, `button.tsx` | Open |
| **P3** | Rail tagline clips | `app-shell.tsx` | Open |

## Refuted / dropped

| Claim | Why |
|-------|-----|
| Aurora still in first-run | Layer 1 `auroraCount=0`; CSS removed |
| Dual first-run boards | `/getting-started` redirects; GettingStartedGuide unmounted |
| Lab FullyMeasured is a customer ref | Lab API only; empty-tenant walk has no measured paths |

## Go / no-go

| Question | Answer |
|----------|--------|
| First-run simpler than yesterday? | **Yes** — one board, no aurora, 4-item New rail |
| Ready to call UX “highest quality / not slop”? | **No** — empty-tenant mean ~2.8; Command Center flash was real |
| Safe for a design-partner **pilot with an SE present**? | **Yes**, on the lab demo tenant (fullyMeasured 2026-08-15) |
