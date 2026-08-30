# Continuous loop Slice B — Dynamic Attack Paths + Choke honesty

**Date:** 2026-08-01  
**Branch:** `overnight-loop`  
**Rows:** scorecard **id 23** (Dynamic Attack Paths), **id 4** (Choke Point Analysis)  
**Implementation commit:** `0d3028b8` (landed with multi-track Slice B; this doc is the source of truth for rows 4/23)

## Goals (shipped)

### 1. Dynamic Attack Paths (id 23)

Signal-driven **next recommended mission** for a single attack path, with a hard human approval gate.

| Surface | Behavior |
|--------|----------|
| Pure generator | `packages/operators/src/dynamic-path-missions.ts` — `generateDynamicPathMissionRecommendation` |
| API read | `GET /api/v1/attack-paths/:id/next-mission` → `{ recommendation }` (nullable, always 200) |
| API approve | `POST /api/v1/attack-paths/:id/next-mission/approve` → Draft mission, **`queued: false`** |
| Persistence | `operator_recommendations` row with payload `kind: "DynamicPathNextMission"` |
| UI | Path detail panel **Next recommended mission** (`data-testid="path-next-mission-panel"`) |
| Acceptance | `tests/acceptance/dynamic-path-next-mission-flow.test.ts` |

**Drivers (priority order):**

1. `UnmeasuredHop` — next safe hop-probe module from validation plan  
2. `SignalCve` / `SignalAssetChange` / `SignalMissedDetection` — signals that touch path evidence  
3. `PathBreakerVerify` — fully measured + breaker present → FixVerification  
4. `PathRevalidation` — fallback policy-gated revalidation  

**Honesty contract (enforced in schema + copy):**

- Always `approvalRequired: true`  
- Approve creates **Draft** only; never auto-queues execution  
- Explicit notes: not autonomous real-time replan; not full-BAS adaptation  
- No recommendation without path evidence IDs  

### 2. Choke Point Analysis (id 4)

Improve breaker quality **without** inventing min-cut.

| Change | Detail |
|--------|--------|
| Ranking | Greedy hitting-set still; path weight = `1 + measuredHopFraction` so measured paths bias cover scores |
| Methodology | Remains `GreedyHittingSetApproximation` (schema literal) |
| Assumptions | Explicit: not XM-class min-cut, not max-flow, betweenness is weighted coverage, Partial until real solver |
| UI / help | Workbench optimizer + product-help path-breaker terms updated |

**Gate preserved:** scorecard **currentScore must stay &lt; 4** until a real graph-wide min-cut/dominator solver ships. This slice does **not** claim Leading choke science.

## Recommended scorecard deltas (do not auto-apply)

Apply only after acceptance + focused unit tests green.

| ID | Requirement | Current | Suggested after Slice B | Rationale | Cap |
|---:|-------------|---------|-------------------------|-----------|-----|
| 23 | Dynamic Attack Paths | 2.75 (3/3/3/2) | **3.25–3.5** e.g. product 4, function 3–4, ux 4, operations 2–3 | Real path-scoped next mission + persist + human gate + UI + acceptance | Still Partial until measured-edge replan loop is lab-proven autonomous-but-governed |
| 4 | Choke Point Analysis | 3.25 (4/3/3/3) | **3.25–3.5 max** e.g. product 4, function 3–4, ux 3–4, operations 3 | Evidence-weighted greedy + stronger honesty docs; **not** min-cut | **&lt; 4** hard gate without real solver |

Do **not**:

- Set id 4 product/function to 5 or verdict Leading  
- Set id 23 to Strong/Leading without lab-measured adaptive replan evidence  
- Edit `docs/qa/analyst-scorecard.json` unless the rescore agent has green acceptance evidence  

## Tests

```bash
# Unit
pnpm --filter @periscan/operators test
pnpm --filter @periscan/evidence test -- choke-points
pnpm --filter @periscan/web test -- attack-path-detail

# Acceptance (needs Postgres — see Agents.md / .env.example)
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm exec vitest run tests/acceptance/dynamic-path-next-mission-flow.test.ts
```

## Not claimed

- Autonomous real-time path adaptation / swarm replan productization  
- Exact global min-cut, max-flow, or XM Cyber choke parity  
- Score ≥ 4 on id 4  
- Full BAS dynamic attack paths  
