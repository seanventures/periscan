# Ops soak prep — health + auth probes only

**Status:** Prep harness only.  
**Does not claim:** production soak, multi-node failure qualification, customer SLO, concurrency capacity, or p95/p99 numbers.

## Why this exists

Ops / VP Eng automation ICPs need a **repeatable pre-flight** before anyone runs `scripts/perf-baseline.mjs` or a design-partner soak. Prep proves the control plane answers:

1. Liveness (`GET /api/v1/health`)
2. Readiness (`GET /api/v1/health/ready` — DB / queue / evidence dependencies)
3. Contract surface (`GET /openapi.json`)
4. Optional authenticated identity (`GET /api/v1/me` with `PERISCAN_API_KEY`)

It deliberately **does not** generate load or invent latency percentiles for scorecards.

## Run

```bash
# Against a running API (local or deploy)
BASE_URL=http://127.0.0.1:3001 bash scripts/ops-soak-prep.sh

# Include authenticated probe
BASE_URL=http://127.0.0.1:3001 \
  PERISCAN_API_KEY=psk_… \
  RESULT_PATH=/tmp/periscan-soak-prep.json \
  bash scripts/ops-soak-prep.sh
```

Artifact fields (when `RESULT_PATH` is set):

| Field | Meaning |
|-------|---------|
| `artifactType` | Always `ops-soak-prep` |
| `productionScaleClaimValidated` | Always `false` |
| `loadOrSoakCompleted` | Always `false` |
| `slaClaims` | Always `[]` |
| `probes[]` | Per-route expected/actual status + wall `elapsedMs` only |

## Related (still not production certification)

| Artifact | Role |
|----------|------|
| `scripts/smoke-test.sh` | Post-deploy smoke (health + optional signup round-trip) |
| `scripts/perf-baseline.mjs` | Local API baseline under concurrency; writes env-scoped results with `productionScaleClaimValidated: false` |
| `docs/qa/PERFORMANCE_QUALIFICATION_2026-07-15.md` | Historical local qualification write-up — environment-labeled, not customer SLO |
| `docs/trust/EXTERNAL_VALIDATION.md` | Design-partner soak *template* when a real attachable report exists |

## Scorecard honesty

Do **not** cite this prep script as soak completion or as ops row 107 / load evidence. Attach only:

- This prep artifact (readiness), **and/or**
- A dated `perf-baseline` artifact with its environment label, **and/or**
- A real multi-tenant soak report produced in a production-like topology.

Never backfill fake p95 numbers into `docs/qa/analyst-scorecard.json`.
