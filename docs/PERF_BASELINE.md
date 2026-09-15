# Periscan Performance Baseline (WS4)

Reusable probe: `pnpm perf:baseline` (see `scripts/perf-baseline.mjs`). It signs
up, then fires concurrent requests at representative read endpoints against a
RUNNING API, counting **only 2xx as success** (a 429/4xx/5xx is a failure, never
fast-success) and reporting per-endpoint throughput + latency percentiles with a
pass/fail p95 SLO.

## First captured baseline — 2026-07-05

Conditions: local API (dev mode) + local Postgres (port 5434), concurrency 20,
8s per endpoint, **rate limiting raised** (`PERISCAN_RATE_LIMIT_MAX` high) so the
probe measures the endpoints, not the limiter. Fresh (empty) tenant.

| endpoint | ok req | rps | p50 (ms) | p95 (ms) | p99 (ms) | fail |
|---|---|---|---|---|---|---|
| health (unauth) | 177,512 | 22,189 | 1 | 2 | 3 | 0 |
| list findings | 8,468 | 1,059 | 18 | 24 | 28 | 0 |
| list attack-paths | 12,731 | 1,591 | 12 | 17 | 19 | 0 |
| executive trends | 5,310 | 664 | 30 | 36 | 39 | 0 |
| global search | 12,289 | 1,536 | 13 | 17 | 20 | 0 |

Result: ✓ all endpoints 2xx and within the 750ms p95 SLO, zero failures.

## Data-present baseline — 2026-07-05 (30 seeded scopes + posture checks)

`PERISCAN_PERF_SEED_SCOPES=30` seeds 30 verified scopes each with a fixture
posture-check (→ measured signals → findings → evidence) before probing, so this
reflects aggregation cost under real per-tenant data — not the empty-tenant floor.

| endpoint | empty p95 | data p95 | Δ |
|---|---|---|---|
| health (unauth) | 2 | 2 | — |
| list findings | 24 | 51 | 2.1× |
| list attack-paths | 17 | 32 | 1.9× |
| **executive trends** | 36 | **119** | **3.3×** |
| global search | 17 | 22 | 1.3× |

Result: ✓ still all 2xx and within the 750ms p95 SLO. The scaling *direction* is
the finding: **executive-trends degrades fastest** (it aggregates seven tables),
so it is the first endpoint to trace/index as tenant data grows. Run
`PERISCAN_PERF_SEED_SCOPES=N pnpm perf:baseline` to re-baseline at any depth.

## Reading this

- The relative cost is the signal: **executive-trends is the heaviest**
  (aggregates findings + remediations + verification events + evidence + scopes +
  integrations + missing-signals), then findings (derivation/correlation), then
  the simpler reads. That ranking is where to look first for optimization.
- **Two honesty caveats.** (1) These are *dev-mode* numbers; production build +
  managed Postgres will differ. (2) The tenant is *empty* — reads hit near-empty
  tenant-scoped tables, so this is a request-path + query-planning FLOOR, not
  behavior under heavy per-tenant data (findings/trends grow with data). For a
  data-heavy baseline, seed the tenant before probing.
- The rate limiter is real and correct — it 429'd the first (mismeasured) run.
  Load testing must raise it deliberately; production capacity planning should
  account for it.

## Next (WS4)

- Seed a data-heavy tenant and re-baseline the aggregation endpoints.
- Add the probe to CI as a regression guard (fail on p95 breach vs a recorded
  budget) once running against a stable, production-like target.
- Trace the executive-trends aggregation for N+1 / missing indexes.
