# Lab demo site closeout — 2026-08-02

**Status:** Lab + demo-site operator path **Closed for engineering** (physical + product path proven).  
**Analyst rescore:** Slice E (lab-backed 78.9) + Slice F catch-up (79.2) applied — see `SLICE_E_RESCORE_2026-08-03.md`, `SLICE_F_RESCORE_2026-08-03.md`.  
**Not closed:** Phase 3 cloud/k8s, design-partner dogfood cadence, public refs, ICP re-panel after E/F.

## Agents / processes

| Process | Status | Action |
|---------|--------|--------|
| API / worker / web (this session) | **Intentionally running** for demo | Leave up for walk; not stuck “completed task” agents |
| Grok background bash tasks | Completed or killed when done | No residual agent loops on finished work |
| Claude Desktop helpers | User app processes | Out of scope — do not kill |

No autonomous agents were left working on already-completed lab tickets.

## Closed engineering tickets (lab / demo)

| Item | Evidence |
|------|----------|
| Phase 1 multi-tier lab | `infra/lab/` compose, smoke green |
| Phase 2 mocksiem + Splunk export | canary physical + product DRV closed loop |
| FullyMeasured multi-hop (lab) | `*-golden-fullymeasured.json`, `fullyMeasured:true` |
| Worker hop auto-apply (P05-1 worker gap) | `apps/worker/src/processor.ts` |
| LAB_MODE hop + posture URL map | `findings.ts`, `scopes.ts` |
| Dual runners enroll + poll | plant/hq Up; `processed 0 task(s)` |
| Affinity physical | plant→data OK, hq isolated |
| Harden physical 401 | fixed-loop pass |
| Wave spine API | walk-spine **17/17** |
| Demo operator package | `pnpm lab:demo-up`, `lab:dev`, `docs/DEMO_LAB_SITE.md` |
| Optional CI lab-golden | `.github/workflows/lab-golden.yml` |
| E2E lab SIEM | `PERISCAN_LAB_E2E=1` acceptance |

## Explicitly still open (honest)

| Item | Why not closed |
|------|----------------|
| Phase 3 LocalStack/kind | Optional; not required for Wave spine demo |
| Design-partner weekly dogfood process | Process, not code — see `DESIGN_PARTNER_REFERENCE_PLAYBOOK.md` |
| Full product Fixed on every HTTP posture module after harden | Script pass + physical 401; some modules still need DNS/hosts for non-LAB_MODE paths |
| Public customer references | Lab alone does not create refs |
| ICP re-panel after lab demo | Pending formal re-panel; do not invent panel mean 5.0 |

## Operator commands (canonical)

```bash
pnpm lab:up
pnpm lab:dev          # api + worker + web
pnpm lab:demo-up
pnpm lab:walk-spine
# UI: http://127.0.0.1:3000/login  + email in infra/lab/.lab-demo.env
```

## Scorecard note

Continuous-loop state is **Slice F / 79.2** (`docs/qa/CONTINUOUS_LOOP_STATE.json`). Lab proof backed Slice E lifts; Slice F applied catch-up only for previously shipped product. **Do not invent 5.0 / 95 / MQ.**
