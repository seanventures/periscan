# Swarm S1 — Multi-hop FullyMeasured + Find-Fix-Verify

**Date:** 2026-07-31  
**Scope:** Product path completeness for measured multi-hop and Fixed-only-via-verification.  
**Hard rules:** Fixed only via verification (`packages/shared` fix-verification); no inventing Measured without evidence IDs; no live Atomic/Caldera.

---

## What is proven in-repo (API + Postgres acceptance)

### 1. Multi-hop → FullyMeasured → claim-safe → export

| Step | Surface | Proof |
|------|---------|--------|
| Create multi-hop path | Mock GitHub + AWS connect/sync | Correlated paths with ≥2 edges |
| Measure each hop | `POST …/edges/:edgeId/receipts` with Completed hop-bound run + evidence IDs | Per-hop Measured; bare evidenceIds rejected |
| FullyMeasured | `GET …/measurement-state` + `deriveAttackPathClaim` | `fullyMeasured: true` only when every hop is Measured **with** evidence IDs |
| Claim-safe labels | `projectPathValidationState` / risk summaries | No Validated/Reachable/Exploitable overclaim without hop support |
| Export report | Snapshot HTML + `POST /api/v1/reports/:id/export` | “Fully measured multi-hop”, “Claim-safe path state”; no “zero fully measured” hypothesis banner when a full path exists |

**Acceptance:** `tests/acceptance/multi-hop-fully-measured-report-flow.test.ts`  
**Partial hop contract (prior):** `tests/acceptance/attack-path-measured-hop-flow.test.ts`

### 2. Find-Fix-Verify closed loop

| Step | Surface | Proof |
|------|---------|--------|
| Remediation | `POST /api/v1/remediations` | Status not Fixed |
| Ticket optional | create-ticket + sync-ticket Closed | `ClosedWithoutEvidence` — **never** Fixed |
| Mark ready | `POST …/mark-ready-for-verification` | `VerificationPending` — **never** Fixed |
| Verify | `POST …/verify` | `measuredRevalidation: true`; status Fixed only with Fixed outcome |
| Chokepoint | `assertRemediationFixedOnlyViaVerification` | Throws without measured revalidation / mismatched outcome |

**Acceptance:** `tests/acceptance/find-fix-verify-closed-loop.test.ts`  
**Related:** `remediation-ticket-state-flow`, `fix-verification-measured-posture-flow`, `digitalocean-fix-verification-flow`, architecture walk in `packages/shared/src/fix-verification.test.ts`

### 3. Auto-apply hop receipts (P05-1)

| Path | Wire | Proof |
|------|------|--------|
| API | `tryAutoApplyPathEdgeReceiptFromCompletedRun` | Empty evidence → refuse; hop-bound Completed + evidence → receipt `measurementMethod=hop-probe-auto` |
| Runner completion | `apps/api/src/services/runner.ts` | Calls auto-apply after Completed hop-bound result |
| Control-plane completion | `runtime-services` module execute path | Same helper after hop probe completes |
| UI | `HopLaunchResultCard` poll | On Completed, lists edge receipts; shows **auto-applied** copy when `hop-probe-auto` / `system:auto-apply` / `runner:*`; manual apply remains safety net |

**Acceptance:** `tests/acceptance/hop-receipt-auto-apply-flow.test.ts`  
**UI unit:** `apps/web/src/components/attack-path-detail.test.tsx` (auto-applied hop receipt)

---

## Honesty constraints preserved

- **Launch ≠ Measured.** Queuing Measure hop never upgrades hop/path certainty.
- **Measured requires evidence IDs** on the hop (and run linkage for public apply).
- **FullyMeasured** = every hop Measured with evidence; path evidenceBasis weakest-edge Measured.
- **Fixed** only via verification event with `measuredRevalidation: true` and outcome Fixed.
- **Ticket close** → `ClosedWithoutEvidence` when verification still required.
- **No live Atomic/Caldera** in this swarm path.

---

## Residual honest (still needs live lab / not claimed Closed)

| Residual | Status 2026-08-02 | Notes |
|----------|-------------------|--------|
| Live multi-hop FullyMeasured on lab range | **Closed (lab demo path)** | `infra/lab` + `PERISCAN_LAB_MODE=1` + worker hop auto-apply → `fullyMeasured:true` (control-plane hop probes to lab ports; dual runners polling for in-network affinity demos). Artifacts under `docs/qa/lab-runs/`. |
| Full-BAS / exploit-chain multi-hop | **Still open / out of claim** | Safety boundary: no uncontrolled chaining, no live Atomic/Caldera |
| DO open-port fix-verify still connector-resync | **Unchanged** | Single-edge; not multi-hop BAS |
| Auto-apply is best-effort | **Improved** | Worker path now auto-applies (parity with runner/control-plane); still best-effort on errors |
| Default demo tenant may still start at 0/N hops | **Closed for lab demo** | `pnpm lab:demo-up` seeds + measures; fixture `seed:demo` still honest-empty until measure |
| Report PDF claim-safe strip | **Unchanged optional** | HTML path proven |
| Slice E scorecard bump | **Still open** | Lab enables discussion; do not invent 5.0/95 without rescore memo |

---

## Commands

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan

pnpm exec vitest run \
  tests/acceptance/multi-hop-fully-measured-report-flow.test.ts \
  tests/acceptance/find-fix-verify-closed-loop.test.ts \
  tests/acceptance/hop-receipt-auto-apply-flow.test.ts \
  tests/acceptance/attack-path-measured-hop-flow.test.ts \
  --testTimeout=120000

pnpm --filter @periscan/web exec vitest run src/components/attack-path-detail.test.tsx
pnpm --filter @periscan/shared exec vitest run src/fix-verification.test.ts
```

---

## Files touched (this swarm)

- `tests/acceptance/multi-hop-fully-measured-report-flow.test.ts` (new)
- `tests/acceptance/find-fix-verify-closed-loop.test.ts` (new)
- `tests/acceptance/hop-receipt-auto-apply-flow.test.ts` (new)
- `apps/web/src/components/attack-path-detail.tsx` (auto-apply UI edge)
- `apps/web/src/components/attack-path-detail.test.tsx` (auto-apply unit)
- `docs/qa/E2E_SWARM_S1_MULTI_HOP_FFV.md` (this file)
