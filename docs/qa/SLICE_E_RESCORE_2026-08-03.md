# Continuous loop Slice E rescore (2026-08-03)

**Evidence basis:** continuous-loop lab demo site (`infra/lab`, `docs/DEMO_LAB_SITE.md`, `LAB_DEMO_SITE_CLOSEOUT_2026-08-02.md`) — FullyMeasured multi-hop, DRV/DNS canaries vs mocksiem, dual runners + affinity, fixed-loop harden, Wave spine 17/17.

| Metric | D | E |
|--------|--:|--:|
| Score | 78.2 | **78.9** |
| Points | 1471 | **1484** (+13) |
| Strict ≥4.0 | 77 | **78 / 94** |
| Strong+Leading | 79 | **80** |
| Rows at 5.0 avg | 0 | **2** (24, 69) |

## Dim totals

| Dim | D | E |
|-----|--:|--:|
| product | 374 | 374 |
| function | 365 | **371** |
| ux | 372 | 372 |
| operations | 360 | **367** |

## Row lifts (lab-backed only)

| ID | Requirement | Before | After | Why |
|----|-------------|--------|-------|-----|
| 3 | Attack Path Validation | 4.0 | **4.5** | Lab multi-hop `fullyMeasured:true` + hop auto-apply |
| 5 | Exposure Graphs | 4.0 | **4.25** | Measured multi-hop path graph in lab demo |
| 8 | Detection Rule Validation | 4.0 | **4.5** | Product DRV closed loop vs mocksiem Splunk export |
| 19 | DNS Exfil Canary | 4.0 | **4.25** | Lab DNS canary path; `measured:false` honesty preserved |
| 23 | Dynamic Attack Paths | 3.75 | **4.0** | Hop measure function (was function 3) |
| 24 | Automated Unattended Scheduling | 4.75 | **5.0 Leading** | Plant schedule + dual-site runners (allowlist) |
| 47 | Execution Integrity | 4.0 | **4.5** | Worker hop auto-apply + enrolled signed runners |
| 67 | Auto-revalidate | 4.0 | **4.5** | Lab fixed-loop re-measure after harden |
| 69 | Automated Revalidation | 4.75 | **5.0 Leading** | Ops floor from closed-loop Fixed evidence (allowlist) |

## Explicit non-lifts (honesty ceilings)

| ID | Why not raised |
|----|----------------|
| 6 SCV | Inject still off — cannot Strong/Leading |
| 4 Choke | No min-cut — score must stay &lt; 4 |
| 80 Compliance attestations | Catalog incomplete — score &lt; 4 |
| 2/21/26/28 Partner packs | No real partners |
| 29/30/33 Agent hype | Scaffold / not full BAS |
| Market presence refs | Still 0 |
| Overall 95 / MQ | Forbidden without blind rescore + partners |

## Remaining to 95

+302 pts to 1786. Dominant residuals unchanged: partner feeds, live inject, market presence, choke science, compliance program-complete.

## Gate

`node scripts/analyst-score-gate.mjs` floors updated to 1484 / dims 374·371·372·367 / strict 78 / Strong+Leading 80.
