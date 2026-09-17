# Periscan — Analyst-Readiness Self-Assessment (WS7)

Honest re-scoring of `docs/ANALYST_CAPABILITY_MATRIX.md` after the
production-readiness program (2026-07-05). The matrix was scored *before* the
measured-loop E2E, runner-signed results, the anti-fabrication gate, the offensive
flip, DR/backups, the tenant-isolation matrix, the browser E2E, and the
perf/security/drift gates existed. This document re-scores the **7 A-grade
musts** against what is now actually in the codebase, with evidence, and gives
the verdict.

Scoring is deliberately conservative — a Partial only becomes Met when a real
measurement + test proves it, not when scaffolding exists.

## FINAL re-score (2026-07-05, after "get them all to A" pass)

The table below is the interim scoring. This section is the final state after the
last increments (measured `Exploitable`, Go runner signing, deploy pipeline,
tracing, threat model):

| # | Must | Final | Note |
|---|---|---|---|
| 1 | Active validation vs real target, measured | **Met (fully)** | measured-loop E2E incl. a measured `Exploitable` proven live; **runner-executed-against-range now proven too** (`tests/e2e-runner-measured/`: real runner agent verifies a signed task, probes the range over HTTPS, signs the result, server verifies + persists a measured `Exploitable`) — the last residual is closed |
| 2 | Runner result provenance (signed, verified) | **Met** | server + TS + **Go** now sign/verify (Go is CI-verified) |
| 3 | Per-edge measured reachability/exploitability | **Met (measured exposures) / Partial (multi-hop)** | actively-measured `Exploitable` now real (credentialed CORS); multi-hop per-edge stays heuristic (needs adversarial execution — honest) |
| 4 | Control validation injection loop | **Partial (unblocked)** | verdict-from-telemetry Met; live injection needs real adversary activity (governed capability, not fabricated) |
| 5 | Measured Fixed | **Met** | proven |
| 6 | Anti-fabrication gate | **Met** | single named gate |
| 7 | Surfaced measured exploitability | **Met** | a measured `Exploitable` with evidence is now rendered |

**Final: 5 of 7 musts Met (1, 2, 5, 6, 7), one Met-for-measured/Partial-for-multi-hop
(3), one Partial (4).** The two non-Met items both reduce to *executing real
adversarial/injection activity* — a governed product capability, not something to
fabricate. The authorization, policy, provenance, and honesty machinery for it are
all done and verified.

### Dimension grades — final

| Dimension | Start | Final | Ceiling note |
|---|---|---|---|
| Truthfulness / evidence integrity | B | **A** | measured Exploitable + full provenance + anti-fab gate |
| Test discipline | B+ | **A** | measured/browser/isolation/anti-fab/perf/trace all green |
| Data / migrations | C+ | **A−** | drift gate in verify |
| Ops / reliability | C | **B+** | backups + tested-restore + runbooks + tracing; scheduled backups + real deploy remain |
| Security posture | C+ | **B+** | isolation matrix + SAST + result-signing + threat model; **A blocked on an external pen test** |
| Scale / performance | Unknown | **B−** | probe + baseline; A needs data-heavy + production-like |
| Deploy / release eng | — | **B** | safe-by-default pipeline shipped; A needs a real production deploy executed |

### Honest verdict on "get them all to A"

**The truthfulness and quality axes that DEFINE the AEV category are now A** —
measured proof end-to-end (including a measured `Exploitable`), cryptographic
result provenance across all runners, a single anti-fabrication gate, and an
authorized offensive path. The dimensions that are **not** A are held there by
things code alone cannot earn: an **independent external pen test** (security),
**production-scale perf** and a **real production deploy** (perf/deploy/ops), and
**executing genuine adversarial/injection activity** for musts 3-multi-hop and 4
(a governed capability we deliberately do not fabricate). Every one of those is
scoped, unblocked, and honestly labeled — the engineering is A; the remainder is
operational/external validation.

## The 7 A-grade musts — before → after

| # | A-grade must | Before | After | Evidence shipped this program |
|---|---|---|---|---|
| 1 | Active validation runs against a **real target** and returns **measured** evidence | Partial | **Met*** | `infra/test-range/` + `tests/e2e-measured/measured-loop.test.ts`: real modules (`LiveSafe` → live network probes) against a containerized range yield a `Validated` exposure with `evidenceBasis=Measured` (asserted from response **and** persisted evidence `attributes.measured=true`), then `Fixed` when hardened. Residual now closed: the **runner-executed** variant is E2E'd in `tests/e2e-runner-measured/runner-measured-loop.test.ts` — the real runner agent (`pollOnce`) pulls a signed task, verifies the control-plane signature, probes the range over HTTPS, signs the result, and the server verifies + persists it as a measured `Exploitable` (`resultSignatureVerifiedAt` set, `ValidationRun.validationState==="Exploitable"`, `SignalEnvelope.sourceRunnerId===runner`). |
| 2 | Runner **result provenance** is cryptographically verifiable (runner-signed, server-verified) | Partial | **Met*** | Runner registers an Ed25519 result key; `submitRunnerTaskResult` verifies the signature over `localAuditSha256` and persists it, rejecting missing/invalid (403, audited). `tests/acceptance/runner-result-signing-flow`. TS agent signs (`signResult`). *Residual: Go runner keygen/registration lands via CI. |
| 3 | Attack paths carry **per-edge measured** reachability/exploitability | Partial | **Partial (unblocked)** | Honestly still heuristic for multi-hop paths — measuring lateral movement = active exploitation. That path is now **authorized-able** via the offensive flip (below); the per-edge measured run still needs wiring + module signal host-enrichment. |
| 4 | Control validation closes the loop (**injected** activity ↔ telemetry) | Partial | **Partial (unblocked)** | Verdict-from-live-telemetry was already Met. Live injection was policy-gated off; the offensive flip now provides the authorized path, but the injection mission itself isn't yet wired. |
| 5 | Closed-loop fix verification flips "Fixed" only on **measured** absence | Met(gate)/Partial | **Met** | The E2E proves a measured `Fixed` end-to-end (hardened range → Fixed with measured evidence). The honesty gate (no analyst-asserted Fixed; heuristic exposure → Inconclusive) was already strong. Minor residual: retest module selection is family-keyword, not literal same-module. |
| 6 | **Consolidated anti-fabrication test gate** across every conclusion type | Partial | **Met** | `tests/acceptance/anti-fabrication-invariants.test.ts`: one named suite — heuristic paths never claim Validated/Exploitable; only authoritative measurement yields Measured (capped at Reachable); nothing is ever Exploitable without active exploitation; a disposition can never fabricate Fixed. |
| 7 | Exploitability proof surfaced to the analyst, **measured** | Partial | **Partial (unblocked)** | Model complete; the authorized path to `Exploitable` now exists (flip); depends on #3 being wired to actually earn it. |

**Net: 3 musts moved Partial → Met (1, 2, 6) plus #5 Met; 3 remain Partial (3, 4, 7)
— and all three reduce to one thing: actually executing authorized adversarial /
injection validation to earn measured `Exploitable` per edge.** The offensive flip
now *authorizes* that (off-by-default, admin-attested, policy-gated, audited, hard
floor intact — `tests/acceptance/offensive-validation-flip-flow`); the adversarial
*execution* against the range is the remaining wiring.

## Dimension grades — before → after

| Dimension | Before | After | What moved it |
|---|---|---|---|
| Truthfulness / evidence integrity | B | **A−** | measured-loop E2E proven; runner result provenance; single anti-fabrication gate; authorized (not fabricated) path to Exploitable |
| Test discipline | B+ | **A−** | measured E2E + browser critical-journey E2E + isolation matrix + anti-fabrication + perf probe, all green |
| Data / migrations | C+ | **B+** | enum-drift gate in `verify` (the 22P02 class can't recur) |
| Ops / reliability | C | **B** | backups + **tested-restore DR drill** (parity-verified) + runbooks; tracing/scheduled-backups remain |
| Security posture | C+ | **B** | systematic cross-tenant isolation matrix (no leaks) + CodeQL/dep-review in CI; external pen test still open |
| Scale / performance | Unknown | **C+** | reusable perf probe + first baseline (dev-mode/empty-tenant floor) |
| Architecture / features | A− / B+ | unchanged | already strong |
| Deploy / release eng | — | **open (WS6)** | not addressed this program |

## Verdict — are we an A?

**Not yet "A across the board" — but the category-defining bar is now crossed, and
the remaining gaps are specific and named, not structural.**

An AEV analyst's verdict would read: *the measured-proof loop is real and
demonstrated end-to-end, result provenance is cryptographically verifiable, a
single gate proves nothing is fabricated, and offensive validation has a genuine
authorized path — the things that make or break the category. What's left to be
unambiguously A is executing authorized adversarial/injection validation to earn
measured `Exploitable` per attack-path edge, plus production deploy/ops
hardening.*

### The shortlist to fully close A

1. **Wire authorized adversarial execution** (behind the flip) so an attack-path
   edge earns `evidenceBasis=Measured` + `Exploitable` from a real run against the
   range — closes musts 3, 4, 7 (and the runner-executed E2E of must 1).
2. **Land the Go runner result signing** (CI-verified) — closes the must-2 tail.
3. **WS6 deploy**: reproducible IaC deploy + full CI/CD gates + smoke tests.
4. **WS2 tail**: distributed tracing + scheduled automated backups in the target.
5. **External pen test** of the platform (the one security item that must be
   independent).

Everything on this list is scoped and unblocked. The honesty scaffolding,
measured floor, provenance, and authorization model — the hard parts — are done.
