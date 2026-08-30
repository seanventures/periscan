# Overnight autonomous loop (9h)

**Start:** see `OVERNIGHT_DEADLINE.txt`  
**Workspace (SSD volume may be TCC-locked):** `/Users/sean/.grok/worktrees/test-periscan/overnight-loop`  
**Branch:** `overnight-loop` → merge/push to `main` regularly  
**Category home:** AEV / CTEM **proof** — not full BAS

## Mission

Work residuals until done or deadline. Each cycle: pick highest-priority unfinished item → **ensure Plane issue exists / update state** → implement real-first → test → commit → push `main` → **close Plane issue with commit SHA**.

### Plane SoR (mandatory)

Workspace `goldeneye` · project **periscan** ·  
`https://plane.local.sean.network/goldeneye/projects/c6549620-33ca-46d1-a8b3-d24dc09a033e`

On goldeneye: `plane-issue periscan "<title>" "<body>"` or API with `X-API-Key` from `/root/projects/infra/plane/.plane-api-token`.

Wave tracking issues: **PERISCAN-456…470** (created 2026-07-30 backfill).

## Hard stop (never break)

- No Atomic/Caldera live, SharpHound, ransomware, real spray, real exfil  
- No Wave D inject product path without written SOW in repo  
- No fake customer refs, ARR, Production elevation without live keys  
- No inventing Fixed without verification  
- No scorecard score inflation without evidence + gate  
- No `git reset --hard` on shared tip thrash; prefer linear commits + push  

## Priority backlog (work top-down)

| P | ID | Work item | Done when |
| --: | --- | --- | --- |
| 1 | O1 | DRV UI CTA → `detection-marker-proof` API on Controls | **Done** workbench CTA + tests |
| 2 | O2 | Controls/product-help documents marker loop + DRV Partial honesty | **Done** product-help + tests |
| 3 | O3 | APV lab path: deepen hop measure UX residual + acceptance still green | **Done** claim-safe strip/CTA + remap note; no Heuristic→Validated upgrade |
| 4 | O4 | Continuous EASM UI honesty on `/continuous` + schedules | tests |
| 5 | O5 | auto-revalidate UI residual (any remaining auto-mitigate copy) | **Done** customer-facing auto-mitigate copy cleaned |
| 6 | O6 | MCP/flight-recorder residual polish if gaps remain | **Done** product-help /mcp + console honesty + mutate-name guard |
| 7 | O7 | Connector catalog Production board residual (no fake Production) | **Done** catalog honesty + Ready/Planned partition guard (verify) |
| 8 | O8 | Compliance disclaimer regression if any surface missed | **Done** /compliance help + Support pack constant + tests |
| 9 | O9 | Acceptance/unit flaky fixes from wave merge | **Done** web unit green (credentials, attack-path pagination, design-partner schema, marketplace UI) |
| 10 | O10 | OpenAPI/docs CHANGELOG for new Wave B route | **Done** CHANGELOG-API 0.3.2 |
| 11 | O11 | Playwright smoke primary journeys if env allows | **Done** primary 4/4 pass (CSRF e2e seed fix) |
| 12 | O12 | Blind rescore prep package (no fake refs) | docs only |
| 13 | O13 | Remaining incomplete HTTP/UI wiring grep | **Done** event-catalog + residual scan doc |
| 14 | O14 | Final morning stamp `OVERNIGHT_MORNING_REPORT.md` | **Done** early — product backlog O1–O13 complete |

## Cycle protocol (each scheduler fire)

1. `cd /Users/sean/.grok/worktrees/test-periscan/overnight-loop`  
2. Read `OVERNIGHT_DEADLINE.txt` — if now > deadline_utc, only write morning report if missing, then stop product work.  
3. `git fetch origin && git checkout overnight-loop && git merge origin/main` (resolve safely)  
4. Read `OVERNIGHT_PROGRESS.md` — pick first unchecked P item  
5. Implement + focused tests  
6. Commit with `fix(...): overnight O# ...`  
7. `git push origin overnight-loop` then merge to main:
   - `git checkout main && git merge overnight-loop && git push origin main && git checkout overnight-loop`
   - If main branch not present locally: `git push origin HEAD:main` from overnight-loop when linear  
8. Append progress log entry  
9. If no product work remains, write morning report and mark complete  

## Progress log

Append-only: `docs/qa/wave-dispatch/OVERNIGHT_PROGRESS.md`

## Morning report

`docs/qa/wave-dispatch/OVERNIGHT_MORNING_REPORT.md` — commits, tests, residuals, tip SHA.
