# Periscan local performance qualification — 2026-07-15

## Verdict

The repeatable API baseline passed in the declared local environment with no
failed responses and every measured p95 below the 1,000 ms test SLO. This is
useful release-regression evidence. It is **not** a 10,000-concurrent production
certification, a multi-region result, or a customer SLO.

## Environment and request mix

- Environment label: `local-docker-postgres-redis`
- API process: one local Node/Fastify process
- Database: local Docker PostgreSQL 16
- Queue/cache dependency: local Docker Redis 7
- Concurrent request workers: 20
- Measurement duration: 1 second per endpoint
- Seeded tenant: 10 verified scopes with fixture posture checks
- SLO used by this run: p95 ≤ 1,000 ms and zero non-2xx responses
- Qualification ID: `cd553d3f-1751-45ab-b294-efc8437b5cfd`
- Completed: `2026-07-15T11:05:16.922Z`

## Measured result

| Endpoint         | Successful | Failed | Requests/s | p50 ms | p95 ms | p99 ms |
| ---------------- | ---------: | -----: | ---------: | -----: | -----: | -----: |
| Health           |     20,548 |      0 |     20,548 |   0.74 |   2.03 |   3.41 |
| Findings         |        744 |      0 |        744 |  26.14 |  32.42 |  64.04 |
| Attack paths     |      1,673 |      0 |      1,673 |  11.90 |  14.12 |  16.40 |
| Executive trends |        440 |      0 |        440 |  45.27 |  68.05 |  71.64 |
| Global search    |      1,428 |      0 |      1,428 |  13.81 |  17.68 |  20.34 |

## Repeat command

Start the API against the target backing services with an intentionally high
load-test rate limit, then run:

```bash
PERISCAN_PERF_URL=http://127.0.0.1:3001 \
PERISCAN_PERF_CONCURRENCY=20 \
PERISCAN_PERF_DURATION_SECONDS=1 \
PERISCAN_PERF_P95_SLO_MS=1000 \
PERISCAN_PERF_SEED_SCOPES=10 \
PERISCAN_PERF_ENVIRONMENT_LABEL=local-docker-postgres-redis \
PERISCAN_PERF_RESULT_PATH=/tmp/periscan-performance-qualification.json \
node scripts/perf-baseline.mjs
```

The script now validates bounded inputs, fails on any non-2xx response or p95
breach, and writes a machine-readable qualification artifact when
`PERISCAN_PERF_RESULT_PATH` is set. Every artifact states its environment and
keeps `productionScaleClaimValidated` false.

## Claim boundary and next production gate

The product can defensibly claim horizontally scalable BullMQ workers,
tenant-scoped concurrency limits, explicit standard/priority lanes, safe
pre-turn provider routing, durable asynchronous usage events, and local API
regression evidence. It cannot claim a particular production concurrency or
availability number yet.

Before publishing a production SLO, run the same artifact-producing gate in a
production-like topology with representative tenant cardinality and data
volume, multiple API/worker replicas, Redis and PostgreSQL failover, queue
backlog/recovery, provider latency/failure injection, noisy-neighbor isolation,
and billing reconciliation. The approved SLO must cite that artifact rather
than this local baseline.
