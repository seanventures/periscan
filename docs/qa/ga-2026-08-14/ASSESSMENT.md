# GA-0 assessment — 2026-08-14

**Plane:** PERISCAN-491 (parent 490).  
**Method:** six independent read-only agents + host probes.  
**Not claimed:** 95 / MQ / Wave / panel 5.0 / live customer refs.

## Host at kickoff

| Surface | Fact |
|---------|------|
| `origin/main` | `7107afdb` Phase 1 lab scaffold |
| Working tree | ~107 dirty files (Slice E/F, lab demo, UI de-slop, OSS plan) **uncommitted** |
| Lab range | containers Up 7d (edge/app/data/mocksiem/runners) |
| Control plane | not running; host `:3000` is SSH |
| Compose Postgres | healthy, published **:5434** |
| Redis / MinIO | were down; started this session |
| Plane | 489 issues; open residuals are partner/inject/refs/95 — not this program |

## Verdict

The **API contracts** for the designed loop are real. The product is **not**
shippable GA: first-hour docs lead to fixtures, verify ≠ live engines, UI rail
disagreed with its own tests, and Slice E/F “engineering-closed” lives only in
the dirty tree.

## Confirmed (do not undo)

- Fixed only via measured verification; ticket close → `ClosedWithoutEvidence`
- Weakest-hop claim language; denied tasks never queue
- Standardized catalog connectors are NotConnectable
- ~8 worker-live OSS engines (Gitleaks, Nuclei safe-baseline, Trivy, OSV, Prowler, ZAP baseline, runner-agent recon)
- Live Atomic / Caldera / SharpHound stay off
- Operate ≤10 + Labs portal-only + IBM Plex + `brand-fill` contrast patch
- LICENSE still proprietary (correct until counsel)

## Blockers (code can close)

| Sev | Finding | Stream |
|-----|---------|--------|
| P0 | No single test: live scope → live Nuclei/Trivy (`fixtureMode=false`) → finding → remediations → `status=Fixed` | 494 |
| P0 | README / `pnpm dev` never reaches measured proof; `demo-up` printed READY on soft-fail | 493 |
| P0 | Operate allow-list hid Executive; tests already required it | 495 |
| P1 | Findings are projections; usual “find” is mock GH+AWS correlate | 494 |
| P1 | Worker hop auto-apply untested vs API helper | 494 |
| P1 | Dual/triple first-run (GetStarted / /getting-started / /welcome) + Validate/Snapshot/Missions names | 495 |
| P1 | `verify.sh` defaults Postgres :5432; Playwright :5434; lab not in merge CI | 493 / 497 |
| P1 | `.lab-runner.env.bak` was not gitignored | 496 |
| P2 | Certified ≠ live (Syft/Cosign stranded; catalog ≫ worker-live set) | 496 |
| P2 | GetStarted aurora/glow leftover | 495 |

## Cannot close in code (leave Plane open)

469 payments · 460 inject SOW · 467 live partner keys · 431/374/183/126 refs · 13 (95 chase).

## Fixes landed this session (not GA)

- `docs/SETTLED.md`, `docs/qa/GA_PROGRAM_2026-08-14.md`, this file
- `.gitignore` lab `*.env.bak`
- Operate rail aligned with PRIMARY_NAV + existing nav-scope tests
- README first measured-proof path
- `lab:dev` binds 3010 if :3000 busy; `env.sh` uses published Postgres port
- `demo-up` says PARTIAL unless `fullyMeasured`; `STRICT=1` exits 1

## Live tests this session (`DATABASE_URL` → `:5434`)

| Suite | Result |
|-------|--------|
| `app-shell-nav-scope` + `primary-nav` | **31/31 PASS** after rail align |
| `anti-fabrication-invariants` | **4/4 PASS** |
| `tenant-isolation-matrix` | **1/1 PASS** |
| `security-boundaries` | **14/14 PASS** |
| `find-fix-verify-closed-loop` | **PASS** after `afterEach` hookTimeout 30s (was cleanup flake, not product) |

These are fixture/devMode honesty gates. They do **not** prove live Nuclei/Trivy.

## Next (execution order)

1. Run honesty acc + nav unit tests against `:5434`
2. Checkpoint dirty tree only after those tests (PERISCAN-492) — need a SHA
3. Worker hop auto-apply test + one live-engine acc path (494)
4. Collapse dual first-run; kill aurora (495)
5. Open-core preflight only (no LICENSE flip)
6. Fresh house UX panel **after** 4 — not before
