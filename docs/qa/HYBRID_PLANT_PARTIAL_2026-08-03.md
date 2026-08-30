# Hybrid plant runner — Partial ops evidence (2026-08-03)

**Row:** #30 Hybrid Execution Compiler  
**Verdict:** **Partial** only (ops 3 → 4; score 3.5 → **3.75**)  
**Not claimed:** Strong, Leading, fullyE2EMeasuredSurface, live BAS/APT

## What was proven

| Step | Result |
|------|--------|
| Lab range | `pnpm lab:up` — edge/app/data/mocksiem/coredns Up |
| Control plane | API `/api/v1/health` ok with `PERISCAN_LAB_MODE=1` |
| Plant runner | `runner-plant` Active, `siteId=plant`, polling control plane |
| Compile | `POST /api/v1/hybrid-compiler/compile` → **201** |
| Target | `edge.lab.range.test` under verified scope `lab.range.test` |
| Module | `periscan.dns_resolution_check` (passive allowlist) |
| Queue | `queuedTaskCount=1`, mission created, policy profile `hybrid-execution-compiler` |
| Honesty fields | Script forces `fullyE2EMeasuredSurface: false`, status **Partial** |

## Artifact

- `docs/qa/lab-runs/20260803-175632-hybrid-plant.json`

```json
{
  "ok": true,
  "plantRunnerId": "336ad659-e171-42d4-8708-099124555639",
  "missionId": "7c3e30cf-da3d-4b8f-8f49-1649e9a32041",
  "queuedTaskCount": 1,
  "missionStatus": "Queued",
  "honesty": {
    "fullyE2EMeasuredSurface": false,
    "status": "Partial",
    "note": "Plant runner path for passive allowlisted module only — not Strong BAS hybrid."
  }
}
```

## Residuals (closed later same day)

1. ~~Result signing~~ — enroll + `patch-runner-signing.sh` + compose private key env.  
2. ~~Callback host~~ — `PERISCAN_RUNNER_CONTROL_PLANE_URL=http://host.docker.internal:3001` in `lab:dev`.  
3. ~~Mission Complete~~ — see **`HYBRID_PLANT_COMPLETE_2026-08-03.md`** and artifact `20260803-180815-hybrid-plant.json` (`missionStatus: Completed`, signature verified).  
4. Module allowlist alias (`periscan.*` → `runner.*`) on Go runner required for execution.

Still **not Strong** — honesty remains Partial.

## Operator replay

```bash
pnpm lab:up
# terminal A
pnpm lab:dev
# after demo session exists:
set -a; source infra/lab/.lab-demo.env; set +a
# start enrolled runners (if not already)
# (enroll only if registration tokens still fresh; else use existing .lab-runner.env)
cd infra/lab && set -a && source .lab-runner.env && set +a \
  && docker compose --profile runners up -d runner-plant runner-hq
pnpm lab:hybrid-plant
```

## Script fixes landed this pass

- `hybrid-plant-compile.sh`: preserve HTTP status outside `$()` subshells; body matches `CompileHybridExecutionInputSchema` (dropped invalid `missionType` / `safetyLevel`).

## Score discipline

- **Allowed:** Partial ops depth vs mock-only path.
- **Forbidden:** Strong / 5.0 / MQ / fullyE2EMeasuredSurface without complete measured loop + signing.
