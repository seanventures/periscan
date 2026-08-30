# Wave A dispatch — measured multi-hop APV + claim truth

**Parent plan:** [`../FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md`](../FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md)  
**Slice link:** ANALYST_94 Slice 3  
**Matrix IDs:** 3, 4, 5 (+ protect 11)  
**Agents:** 10 parallel (A1–A10)  
**Isolation:** prefer worktrees; no reset/amend of shared tip without parent

## Shared preflight (every agent)

1. Read `Agents.md`, `SECURITY_BOUNDARIES.md`, plan §0  
2. `git status` clean relative to your branch/worktree  
3. Do not claim Fully-E2E APV until all hops Measured in lab path  
4. Focused tests only; parent runs broader verify  

## Agent roster

| ID | Title | Primary paths | Exit report |
| --- | --- | --- | --- |
| A1 | Path claim contract | `packages/shared/src/claim-language.ts`, risk/findings/reports | `triage/agent-wave-a1-claim.md` |
| A2 | Edge receipts persist | evidence graph, Prisma, findings service | `triage/agent-wave-a2-edge-receipts.md` |
| A3 | Measured recompute | attack path validation state from receipts | `triage/agent-wave-a3-recompute.md` |
| A4 | Multi-hop UI CTA | `apps/web` attack-paths workbench | `triage/agent-wave-a4-ui.md` |
| A5 | Choke honesty | choke-points + UI labels | `triage/agent-wave-a5-choke.md` |
| A6 | Graph export honesty | `packages/reports` | `triage/agent-wave-a6-reports.md` |
| A7 | Findings path source | findings workbench hop fraction | `triage/agent-wave-a7-findings.md` |
| A8 | Acceptance flow | `tests/acceptance` measured hop | `triage/agent-wave-a8-acc.md` |
| A9 | Product help | `product-help.ts` multi-hop guide | `triage/agent-wave-a9-help.md` |
| A10 | Matrix stamp | COMPETITIVE_COVERAGE_MATRIX APV section | `triage/agent-wave-a10-matrix.md` |

## Parent merge order

A1 → A2 → A3 → A6 → A5 → A7 → A4 → A9 → A8 → A10  

(Honesty/API first, then UI, then acceptance, then docs.)

## Parent exit gate

- [ ] Claim words cannot upgrade Heuristic path to Validated  
- [ ] At least one acceptance path proves measured hop receipt  
- [ ] Choke copy not “Leading min-cut”  
- [ ] Focused API + web + reports tests green  
- [ ] Matrix APV remains Partial until lab all-hops Measured  
- [ ] No scorecard Leading expansion without blind rescore  

## Prompt stub

```
You own Wave A agent <N>: <title>.
Repo periscan. Read Agents.md + docs/qa/FULL_MATRIX_COVERAGE_AGENTIC_WAVES.md §0 + §3.
Implement real-first. Tests required. Report under docs/qa/panel-audit-exhaustive-2026-07-29-rerun/triage/agent-wave-a<N>-*.md
Do not lift Atomic/Caldera/SharpHound/live ransomware. Do not invent customer refs.
```
