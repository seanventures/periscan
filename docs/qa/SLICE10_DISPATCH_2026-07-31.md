# Slice 10 dispatch — 2026-07-31 (PERISCAN-13)

**Agent:** G2 release-qual residual  
**Tip work:** acceptance evidence for DRV, schedule affinity, multi-node reaper  
**Scorecard:** **no bump** — still honesty-locked at **71.6% (1347/1880)**  
**Gate:** `pnpm analyst:score:check` / `node scripts/analyst-score-gate.mjs`

---

## 1. Current index (do not invent)

| Metric | Value |
|--------|------:|
| Current score | **71.6 / 100** |
| Current points | **1347 / 1880** |
| Target (plan) | **1802 / 1880 (95.9%)** |
| Slice 10 Done floor | **≥ 1786 / 1880 (95.0%)** |
| Delta to 95.0% | **+439 points** |
| Strict ≥4.0 rows | **27 / 94** |
| Strong + Leading | **72 / 94** |
| Leading allowlist only | **6** (ids 11, 13, 24, 69, 90, 91) |
| Scaffold/gated | **11** |
| Partial proof-loop core | rows **3, 4, 6, 8, 23** (+ others) |

**Source of truth:** `docs/qa/analyst-scorecard.json` (assessed 2026-07-30 A8 honesty demote).  
**Path map:** `docs/qa/SLICE10_PATH_TO_95.md`.  
**Blind rescore:** protocol + prep pack only — **not executed** this session.

Arithmetic reminder (from path doc): engineering polish alone tops out near ~79%. Lab, partner, customer-qual, and safety-equivalent specialist packs dominate the remaining mass to 95.

---

## 2. Inventory — top code-shippable gaps (session start)

| Priority | Gap | Work type | Score mass if later rescored honestly |
|---------:|-----|-----------|----------------------------------------|
| 1 | Phase A release gates incomplete (isolation proof exists; multi-node runner drill thin; DRV HTTP acceptance missing) | PRODUCT + LAB | process (no auto lift) |
| 2 | Row 8 DRV — emit→observe product path real; acceptance only unit-level | PRODUCT | +0–6 after blind rescore |
| 3 | P10-2 schedule affinity fire — pure unit tests; no HTTP fire stamp proof | PRODUCT | ops evidence |
| 4 | Rows 3/23 measured multi-hop default journey still Partial | PRODUCT + LAB | +8–12 |
| 5 | Row 4 choke breakers still pattern-greedy (gate &lt;4) | PRODUCT (hard) | 0–7 |
| 6 | Safety scaffolds 16/21/22 | SAFETY + LAB | +12–18 |
| 7 | Partner/customer rows (2, 26, 28, 72–77) | PARTNER / CUST_QUAL | majority of remaining points |

**Not code-shippable this session (honesty floors):** named customer refs, MQ/Wave progress, full BAS, live Atomic/Caldera/SharpHound, vendor SOC2, SCIM as Production.

---

## 3. Gaps closed this session

| ID | What shipped | Evidence |
|----|--------------|----------|
| **RQ-DRV-1** | HTTP acceptance for detection-marker-proof closed emit→observe | `tests/acceptance/detection-marker-proof-flow.test.ts` — Detected + `benign_marker_only` + `fullAttackLibrary:false`; fixtureMode never mints closed emit; non-allowlisted schema refuse; cross-tenant 404 |
| **RQ-AFF-1** | Schedule fire pins `validationRun.runnerId` by hard site/segment affinity | `tests/acceptance/schedule-affinity-fire-flow.test.ts` — plant-3 runner selected; hq-1 not; `affinitySelectedRunnerId` on target |
| **RQ-RUN-1** | Multi-node lease recovery drill exercised + documented | `tests/acceptance/runner-multi-node-reaper-flow.test.ts` + `docs/RUNNER_FLEET_OPERATIONS_RUNBOOK.md` § Multi-node lease recovery drill |

### Tests run (local)

```text
DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
pnpm exec vitest run \
  tests/acceptance/detection-marker-proof-flow.test.ts \
  tests/acceptance/schedule-affinity-fire-flow.test.ts \
  tests/acceptance/runner-multi-node-reaper-flow.test.ts
→ 3 files, 3 tests passed
```

### Honesty invariants re-asserted

- DRV product path remains **benign-marker class only** — not full ATT&CK BAS / Atomic live.
- `fixtureMode` plans emit only (`closedLoop: false`) — no fabricated measured emit.
- Schedule affinity is soft rank / hard site-segment; wrong-site pin still denied at create/lease gates (unchanged unit coverage).
- Reaper is per-task expiry across multi-runner fleets; no score inflation, no Fixed writers touched.

---

## 4. Remaining to 95 (honest)

| Bucket | Approx gap mass | Status after this session |
|--------|----------------:|---------------------------|
| Phase A process gates (verify, journey, a11y, isolation, runner drill, soak, claim language, **blind rescore**) | process | Isolation + multi-node reaper **improved evidence**; blind rescore **still open**; soak/load still open |
| Phase B proof-loop (rows 3, 4, 6, 8, 23) | ~34 pts | Row 8 **acceptance evidence** stronger; still Partial / not Fully-E2E; multi-hop default journey still Partial |
| Phase C safety-equivalent specialists | ~12–18 | Unchanged |
| Phase D partner + customer qual | large | Unchanged — external |
| Phase E compliance depth (non-cert) | ~20–40 | Unchanged; P12-13 still caps row 80 |
| Phase F ops polish cluster | ~40+ | Unchanged |

**Plane ticket #13 Definition of Done** (from path doc) still requires:

1. `currentPoints ≥ 1786` on gate-passing scorecard  
2. Blind rescore memo published + Critical spot-check  
3. Phase A gates green  
4. No P12-7/8/12/13 violations  

**None of (1)–(2) are true after this session.** Ticket **stays OPEN**.

---

## 5. Recommended score delta

| Action | Recommendation |
|--------|----------------|
| `analyst-scorecard.json` dim bumps | **None** — no Fully-E2E proof, no lab multi-hop, no partner pack |
| Gate floor change | **None** — remain honesty lock **1347** |
| Row 8 (DRV) promote Partial→Strong | **Defer** — product path + acceptance stronger, but matrix/competitor “full DRV library” bar still unmet; keep Partial / Strong only after blind rescore with emit→observe lab memo |
| External “95+ ready” language | **Forbidden** until blind rescore |

**Recommended score delta: no score bump (0 points).**

---

## 6. Next highest-ROI residual (for follow-on agents)

1. **Measured multi-hop default journey** (rows 3/23) — lab path with all hops Measured + Home CTA; acceptance already partially present (`attack-path-measured-hop-flow`).  
2. **Blind rescore execution** per `BLIND_RESCORE_RELEASE_QUAL.md` + prep pack (process, not code).  
3. **Safety-equivalent packs** 16/21/22 with measured canaries (never live ransomware/theft).  
4. **Customer connector quals** 72–77 when real credentials exist.  
5. **Load/soak + multi-API lease failover** for ops rows / runner scale non-claims.

---

## 7. Commits (this session)

Local commits only (parent pushes):

1. `test(acceptance): Slice 10 DRV + schedule affinity + multi-node reaper evidence`  
2. `docs(qa): SLICE10_DISPATCH_2026-07-31 release-qual residual memo`

---

## 8. Verdict for PERISCAN-13

| Question | Answer |
|----------|--------|
| Can #13 stay open? | **Yes — must stay OPEN** |
| Closer to 95? | Slightly better **evidence substrate** for Phase A/B; **index unchanged** |
| Fabrication risk | None this session (no scorecard edit, no refs, no BAS claims) |
