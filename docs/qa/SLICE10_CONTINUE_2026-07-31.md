# Slice 10 continue — 2026-07-31 (PERISCAN-13 residual)

Follow-on from `SLICE10_DISPATCH_2026-07-31.md`. Local commits only; parent pushes.

## multi-hop (rows 3 / 23)

### Shipped this session (PRODUCT substrate)

| Item | Status | Notes |
|------|--------|--------|
| Multi-hop acceptance → **FullyMeasured** | **Done** | `tests/acceptance/attack-path-measured-hop-flow.test.ts` applies real hop-bound Completed runs + receipts for **every** edge (≥2). Asserts `measurement-state.fullyMeasured`, claim `MeasuredPath`/`MeasuredReachable`, still **no** invent Validated/Exploitable. |
| Partial cap honesty | **Done** | 1-of-N receipt stays `PartiallyMeasuredHypothesis`; Validated overclaim remaps to Discovered until all hops Measured **with evidence IDs**. |
| Auto-apply multi-edge | **Done** | Same file: `tryAutoApplyPathEdgeReceiptFromCompletedRun` per hop (runner/control-plane path). FullyMeasured only after all hops auto-applied with evidence IDs. Empty-evidence “Measured” stamps still clamp. |
| Home / dashboard primary CTA | **Already correct** | `resolveMultiHopMeasureCta` + dashboard / hero coach / paths workbench: **Measure path hops** → `/attack-paths/{id}#hop-measurement` only when unmeasured hops + verified scope. No link fix required. |
| Scorecard Fully-E2E | **Not claimed** | No `analyst-scorecard.json` bump; no Fully-E2E language. |

### What remains lab-only (honest Partial until lab proof)

1. **Live multi-hop operator journey on a real lab range** — TCP/identity hop probes against authorized lab assets (not mock GitHub/AWS correlation alone). Acceptance proves API + claim substrate; score rows 3/23 stay **Partial** until ops memo + blind-rescore evidence of end-to-end Measure hops on lab paths.
2. **Dynamic attack paths (row 23)** — signal-driven replan with human gate still product+lab; advisory next-mission is not autonomous replan.
3. **Home CTA in live ICP session** — unit/component coverage exists; still needs panel/ICP walk with real tenant data (no fixture theater).
4. **Do not** mark APV/row 3 Fully-E2E or invent BAS / live Atomic / Caldera.

### Residual ROI next

- Lab memo: multi-hop FullyMeasured screenshot/API capture against test-range (or customer-authorized range).
- Keep Fixed-only-via-verification and claim deny-list; never stamp Measured without hop evidence IDs.

## Commits (this residual)

1. `test(acceptance): multi-hop FullyMeasured receipts + auto-apply claim clamp`  
2. `docs(qa): SLICE10_CONTINUE multi-hop residual (rows 3/23)`
