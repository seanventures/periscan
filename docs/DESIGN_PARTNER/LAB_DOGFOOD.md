# Lab dogfood cadence (Phase 4)

**Status:** process ready — lab tooling exists; this doc is the **weekly ritual**  
**Honesty:** dogfood ≠ market presence ≠ public reference. Never invent partner names, refs, ARR, or SOC2 from a lab run.

## Purpose

One internal BU (or solo operator) runs the **lab golden path** weekly so product regressions surface before design-partner sessions. Captures process evidence only.

## Cadence

| Cadence | Owner | Artifact |
|---------|-------|----------|
| **Weekly** (pick a fixed weekday) | Operator / engineering | `docs/qa/dogfood/YYYY-MM-DD-weekly.md` |
| Monthly rollup | Same | Short note in `SESSION_LEARNING_LOG.md` *only if* a real partner session also ran — otherwise keep partner log empty |

## Prerequisites

```bash
pnpm install
docker compose -f infra/docker-compose/docker-compose.yml up -d   # or existing :5434 postgres
pnpm lab:up
# terminal A
pnpm lab:dev   # API + worker + web, PERISCAN_LAB_MODE=1
```

Optional runners (affinity / hybrid):

```bash
# after lab:demo-up or enroll once:
set -a; source infra/lab/.lab-demo.env; source infra/lab/.lab-runner.env; set +a
cd infra/lab && docker compose --profile runners up -d runner-plant runner-hq
```

## Weekly checklist (copy into dogfood log)

1. **Physical smoke** — `pnpm lab:smoke` exit 0  
2. **Control plane health** — `curl -fsS $PERISCAN_API_URL/api/v1/health`  
3. **Demo / seed** — `pnpm lab:demo-up` *or* reuse `.lab-demo.env` if still valid  
4. **Wave spine (API)** — `pnpm lab:walk-spine` (target: no hard regressions vs prior week)  
5. **Canary** — at least one DRV or DNS canary against mocksiem (`canary-loop` via demo-up)  
6. **Multi-hop** — `measure-hops` FullyMeasured when worker healthy  
7. **Hybrid plant (optional)** — `pnpm lab:hybrid-plant` Partial only  
8. **UI glance** — login → Command Center → one mission detail (no screenshot fabrication required)  
9. **Safety canary** — no Atomic/Caldera/SharpHound live; Fixed still requires verification  

## Pass / fail (process)

| Result | Meaning |
|--------|---------|
| **Pass** | Checklist 1–3 + 5 green; spine regressions filed as issues |
| **Soft pass** | Physical + health green; product path flaky but logged |
| **Fail** | Lab won't start or safety boundary violated |

Fails open a GitHub issue with log path under `docs/qa/dogfood/` — do **not** mute by editing scorecards.

## What dogfood does **not** prove

- Customer reference or production qualification  
- Connector Production certification  
- Analyst index / MQ / Wave progress  
- Partner ICP session learning (use `SESSION_LEARNING_LOG.md` only for real sessions)

## Related

- Lab design: [`../LAB_DESIGN_CONTINUOUS_LOOP.md`](../LAB_DESIGN_CONTINUOUS_LOOP.md)  
- Demo site: [`../DEMO_LAB_SITE.md`](../DEMO_LAB_SITE.md)  
- Reference factory (real partners only): [`REFERENCE_FACTORY.md`](./REFERENCE_FACTORY.md)  
- Market presence honesty: [`../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`](../ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md)

## First ritual

See `docs/qa/dogfood/2026-08-03-weekly.md` for the scaffolded first log from this engineering pass.
