# Hybrid plant runner — compile → poll → signed complete (2026-08-03)

**Row:** #30 Hybrid Execution Compiler  
**Verdict:** still **Partial** (ops depth improved; not Strong / not fullyE2EMeasuredSurface)  
**Artifact:** `docs/qa/lab-runs/20260803-180815-hybrid-plant.json`

## Proven loop

| Step | Result |
|------|--------|
| Compile | HTTP **201**, `queuedTaskCount=1` |
| Plant runner | Active, site=`plant` |
| Poll | Plant processed **1** task |
| Module | `periscan.dns_resolution_check` (mapped to local `runner.dns_resolution_check`) |
| Result signature | **verified** (`result_signature_verified_at` set) |
| Task status | **Completed** |
| Mission status | **Completed** |
| Honesty | `fullyE2EMeasuredSurface: false`, status Partial |

## Fixes landed to close residuals

1. **Result signing on enroll** — `enroll-runners.sh` generates Ed25519 keypair; public PEM on register; private PEM in runner creds.  
2. **Patch existing lab runners** — `infra/lab/scripts/patch-runner-signing.sh` for already-enrolled plant/hq.  
3. **Compose** — export `PERISCAN_RESULT_SIGNING_PRIVATE_KEY_PEM` from creds volume.  
4. **Lab API callbacks** — `control-plane-dev.sh` sets `PERISCAN_RUNNER_CONTROL_PLANE_URL=http://host.docker.internal:3001`.  
5. **Module ID alias** — Go runner allowlists + `normalizeModuleID` for control-plane `periscan.*` measured IDs (hybrid dispatch was failing allowlist against `runner.*` only).

## Explicit non-claims

- Not Strong BAS hybrid  
- Not multi-agent offensive swarm  
- Not live APT / Atomic / Caldera  
- DNS success in lab is passive measured module only  

## Replay

```bash
pnpm lab:up
# terminal A (includes runner callback URL):
pnpm lab:dev
set -a; source infra/lab/.lab-demo.env; set +a
# if runners lack result keys:
bash infra/lab/scripts/patch-runner-signing.sh
# rebuild runner after Go allowlist changes:
docker build -t periscan-runner:test apps/runner
cd infra/lab && set -a && source .lab-runner.env && set +a \
  && docker compose --profile runners up -d --force-recreate runner-plant runner-hq
pnpm lab:hybrid-plant
# expect missionStatus Completed, honesty Partial
```
