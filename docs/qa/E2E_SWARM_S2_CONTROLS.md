# E2E Swarm S2 — Control-plane (DRV marker · SCV observe · DNS canary)

**Date:** 2026-07-31  
**Branch:** `overnight-loop`  
**Scope:** Finish operator control-plane paths without enabling live inject, Atomic live, Caldera, ransomware, or real exfil.

## Operator journeys (done)

| Journey | UI | API | Evidence / claim | Honesty |
|---------|----|-----|------------------|---------|
| **DRV detection marker** | Controls → **Run detection marker proof** | `POST /api/v1/control-sources/:id/detection-marker-proof` | Mission + run + evidence artifacts; audit `productPath=detection_marker_proof` | `drvClaimClass=benign_marker_only`, `fullAttackLibrary=false` |
| **DNS-exfil canary** | Controls → **Run DNS-exfil canary** | `POST /api/v1/control-sources/:id/dns-exfil-canary-proof` | Mission + run; audit `productPath=dns_exfil_canary_proof` | `exfilClaimClass=benign_marker_only`, `realDataExfiltrated=false`, **`measured:false` without live emit+telemetry** |
| **SCV observe (pull)** | Controls → **Observe telemetry** (DryRun only) | `POST /api/v1/control-sources/:id/validate` | `connector.observeControl` → ControlObservation signal; target pins | `injectLoopAvailable=false`, `observationMode=telemetry_only` |
| **Inject refuse** | Banner + disabled Live option | validate with `LiveRunner` / `dryRun:false` | No queued inject mission | **`control_live_execution_disabled`** + clear message (SOW dual-gate not an enablement path) |

## Files

| Layer | Path |
|-------|------|
| API services | `apps/api/src/services/control-ai.ts` (`validateControlSource`, `runDetectionMarkerProof`, `runDnsExfilCanaryProof`) |
| Routes | `apps/api/src/app.ts` |
| UI workbench | `apps/web/src/components/controls-workbench.tsx` |
| API client | `apps/web/src/lib/periscan-api-client.ts` |
| Schemas | `packages/shared/src/domain.ts` (`DetectionMarkerProof*`, `DnsExfilCanaryProof*`) |
| Modules | `periscan.detection_marker_emit_observe`, `periscan.dns_exfil_canary` |

## Acceptance tests (HTTP)

| Suite | Asserts |
|-------|---------|
| `tests/acceptance/detection-marker-proof-flow.test.ts` | Closed emit→observe (mock SIEM), claim class, evidence/audit, refuse non-allowlisted + cross-tenant |
| `tests/acceptance/dns-exfil-canary-proof-flow.test.ts` | Canary run, **measured:false** on mock/fixture, realDataExfiltrated:false, refuse + cross-tenant |
| `tests/acceptance/control-source-observe-flow.test.ts` | DryRun observeControl Logged on T1059; LiveRunner/dryRun:false → `control_live_execution_disabled` message clarity |

## Unit / component

| Suite | Focus |
|-------|-------|
| `apps/api/src/services/detection-marker-proof.test.ts` | Schema + module loop |
| `apps/api/src/services/dns-exfil-canary-proof.test.ts` | Schema pins + measured:false fixture path |
| `apps/web/src/components/controls-workbench.test.tsx` | Marker + DNS CTAs, inject banner, Observe telemetry |
| `apps/web/src/lib/periscan-api-client.test.ts` | Client posts for marker + DNS canary |
| `apps/api/src/app.test.ts` (existing) | control_live_execution_disabled + marker route |

## Forbidden (unchanged)

- No live inject enablement / Wave D product path without SOW  
- No Atomic/Caldera live, SharpHound, ransomware, credential theft  
- No real bulk data exfiltration  

## How to re-run

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
# or PERISCAN_TEST_DATABASE_URL — see .env.example

pnpm --filter @periscan/api test -- detection-marker-proof dns-exfil-canary-proof
pnpm --filter @periscan/web test -- controls-workbench periscan-api-client
pnpm exec vitest run tests/acceptance/detection-marker-proof-flow.test.ts \
  tests/acceptance/dns-exfil-canary-proof-flow.test.ts \
  tests/acceptance/control-source-observe-flow.test.ts
```

## Commit stamp

| Item | SHA |
|------|-----|
| Swarm S2 controls E2E | `900c7263ec27781c640f91676dfd6b023fb4351b` |

### Tests green (2026-07-31)

```
pnpm --filter @periscan/api exec vitest run src/services/detection-marker-proof.test.ts src/services/dns-exfil-canary-proof.test.ts
# 9 passed

pnpm --filter @periscan/web exec vitest run src/components/controls-workbench.test.tsx src/lib/periscan-api-client.test.ts
# 39 passed

pnpm exec vitest run tests/acceptance/detection-marker-proof-flow.test.ts \
  tests/acceptance/dns-exfil-canary-proof-flow.test.ts \
  tests/acceptance/control-source-observe-flow.test.ts
# 3 passed
```
