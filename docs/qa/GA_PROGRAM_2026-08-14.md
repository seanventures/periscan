# Periscan GA program — 2026-08-14

**Plane parent:** [PERISCAN-490](https://plane.local.sean.network/goldeneye/projects/c6549620-33ca-46d1-a8b3-d24dc09a033e/issues/490)
**Settled axioms:** [`docs/SETTLED.md`](../SETTLED.md)

## What GA means here

A stranger can package, run, and **complete the designed proof loop** on
authorized lab scope, with honest language, simple UI, and tests that
fail on the real bug. Public Community source is **Apache-2.0**
(`seanventures/periscan`). Goldeneye `seanheiney/periscan` stays private.

| In GA | Out of GA (do not chase) |
|-------|--------------------------|
| Clone → measured lab proof &lt; 60 min | Analyst 95 / MQ / Wave |
| Scope → OSS engine → evidence → finding → remediations → revalidate → Fixed-only-via-verify | Live Atomic/Caldera/inject (460) |
| Claim language from evidence | Customer refs (431/374/183/126) |
| Proof OS rail, no slop | Payments / AWS Marketplace (469) |
| `pnpm verify` + lab golden + first-customer e2e | Production cert without live partner keys (467) |
| License matrix, secret scrub, SECURITY.md | GitHub Actions billing / PVR (not used) |

Public snapshot: `https://github.com/seanventures/periscan` (Apache-2.0).

## Workstreams

| Issue | Stream | State |
|-------|--------|-------|
| 490 | Parent program | In Progress — not GA until 500 live suite + stranger first-hour |
| 491 | GA-0 Measure working-tree truth | Done |
| 492 | GA-1 Checkpoint uncommitted Slice E/F | Done |
| 493 | GA-2 First-hour packaging | Done (scripts; live 60-min still 490) |
| 494 | GA-3 Core proof loop on real lab engines | Done |
| 495 | GA-4 UI: simple Proof OS + house panel | Done |
| 496 | GA-5 Open-core preflight | Done — LICENSE is now Apache-2.0 (529) |
| 497 | GA-6 SETTLED + red-proven gates | Done |
| 498 | GA-7 Live OSS through worker + runner-agent | Done |
| 499 | GA-8 Merge unique branches, v0.10.0 | Done |
| 500 | Community suite actually runs | In Progress — Community worker = scan-executor runtime |
| 525 | GitHub launch swarm | Done (Apache + seanventures/periscan) |

## Method

1. Assess (this kickoff swarm) — do not trust 2026-08-03 memos as current.
2. Fix from confirmed findings only. Signal-driven, not 489-issue theater.
3. After each material UI/loop slice: house UX funnel (Layer 0–3).
4. Definition of done: named test watched red on the bug, then green;
   no SETTLED TELL in the diff; observed outcome, not a transport proxy.

## Machine notes (kickoff)

- Working tree: ~107 dirty files vs `origin/main` (`7107afdb`).
- Lab range containers: up (7d). Control plane / worker / Redis / MinIO:
  not running on this host at kickoff. Compose Postgres healthy on **:5434**.
- Host :3000 is an SSH listener, not the Next app — use `PERISCAN_WEB_PORT`.
- `infra/lab/.lab-runner.env.bak` existed and was **not** gitignored; ignore
  rule added this session. Do not commit lab env.
