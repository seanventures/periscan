# Periscan — Production-Readiness Plan ("A across the board")

Goal: take Periscan from a strong late-stage prototype to an **A-grade product on
every dimension**, then self-assess against **analyst reporting criteria** (Gartner
Adversarial Exposure Validation / CTEM as the primary rubric; Forrester + PRD as
secondary). "A" is defined per dimension with *measurable* acceptance gates, so we
can prove we got there rather than assert it.

Baseline grades (2026-07-05 assessment): Architecture A−, Feature breadth B+,
Truthfulness B, Test discipline B+, Data/migrations C+, Ops/reliability C, Security
C+, Scale/perf Unknown. Target: **A / A− across all**.

Execution style: same loop as P0–P5 — each item ships shared→service→route→test→UI
where relevant, verified against the real DB, no fabrication, docs updated.

---

## The gating principle (why WS1 dominates)

Periscan is an **Automated / Adversarial Exposure Validation** product. Its whole
value is *"we measured it — here's the evidence."* So "A" is decided less by feature
count than by one invariant:

> **Every conclusion the product renders (finding, attack path, control verdict,
> "Fixed") traces to a real measurement with a verifiable evidence chain — or is
> explicitly labeled unmeasured/heuristic. Nothing is ever fabricated.**

Passive/config-measured checks (TLS/DNS/HTTP/email) already satisfy this. The
active, in-network, adversarial path (runner-executed validation, exploitability,
closed-loop fix re-test) is the part that must become fully real. That is WS1.

---

## Workstreams

### WS0 — Guardrails (immediate, cheap, prevents recurring pain)
Days, not weeks. Runs first and in parallel with everything.
- **Migration-drift CI gate**: assert schema enums == enums produced by migrations
  (the exact bug we hit); fail CI on drift. Extend to model/table drift via
  `prisma migrate diff` in CI.
- **Full acceptance suite in CI** against an ephemeral Postgres (today CI likely
  runs unit only; the enum drift proves that gap). Merge gate.
- **Error tracking** (Sentry or equiv) in api + web; release-tagged.
- **Resource/health alerting**: disk, DB health, the existing sweep-failure metric
  → alerts (the disk-full crash we hit had no guardrail).
- **SCA + secret scanning** as merge gates (Dependabot/Trivy/gitleaks).
- **Gate:** deliberate drift/secret/dep-CVE each fail CI; an induced disk-pressure
  event fires an alert; a thrown error appears in the tracker.

### WS1 — Measured Proof Loop (the product-defining workstream) · B → A
- Complete the **runner-executed validation path** (the `feat/digitalocean-measured-loop`
  line): a runner that performs real, non-destructive validations in a target env
  and returns **signed** evidence; control-plane verifies signatures + provenance.
- **Real attack-path validation**: entry→objective confirmed by actual
  reachability/exploitability probes, not heuristics; each edge carries measured
  evidence; `evidenceBasis=Measured` is earned, not asserted.
- **Real control validation**: detection/blocking derived from connected SIEM/EDR
  telemetry (connector ingest exists) correlated to injected test activity.
- **Closed-loop fix verification**: re-run the *exact* validation post-fix; flip to
  Fixed only on measured absence of exposure (exists for passive → extend to active).
- **Safety/authorization**: policy engine gates every active action; verified scope
  required; offensive tooling stays behind explicit authorization + safe harness and
  stays disabled until the API permits.
- **Anti-fabrication invariant tests**: automated assertions that NO conclusion is
  rendered without a measured evidence chain (or an explicit unmeasured label).
- **Gate:** an end-to-end run against a real *owned* test environment produces
  measured findings + a validated attack path + a measured-verified fix, with a
  full evidence chain, and the anti-fabrication suite is green.
  - ✅ **Measured findings + measured-verified fix DONE 2026-07-05.**
    `tests/e2e-measured/measured-loop.test.ts` drives the REAL posture path
    (`LiveSafe` → live network probes) against `infra/test-range`: exposed →
    `Validated` exposure with `evidenceBasis=Measured` (asserted from the
    response AND by reading persisted evidence `attributes.measured=true`),
    hardened → `Fixed`. Proven live on macOS for 5 HTTP/TLS modules (cert,
    headers, CORS, cookie, redirect); full 10-module set + DNS runs on Linux via
    `.github/workflows/measured-loop.yml`. Run: `bash tests/e2e-measured/run-macos.sh`.
  - ⏳ Remaining for the full gate: the *validated attack path* (measured
    exploitability, WS1 additions below) + a single anti-fabrication suite.

**WS1 additions surfaced by the analyst capability matrix (2026-07-05), verified in code:**
- **Runner-signed RESULTS with server-side verification.** ✅ DONE (control plane
  + TS agent) 2026-07-05. Runner registers an Ed25519 result-signing public key
  (`resultSigningPublicKeyPem`, stored on Runner); `submitRunnerTaskResult`
  verifies the runner's signature over `localAuditSha256` and persists it
  (`RunnerTask.resultSignature`/`resultSignatureVerifiedAt`); enforce-when-
  registered (403 on missing/invalid, audited); non-breaking for legacy runners.
  TS runner-agent signs via `signResult` (config `resultSigningPrivateKeyPem`).
  Migration 20260705050000; acceptance `runner-result-signing-flow`; runner-agent
  `signResult` tests. **Remaining (CI-verified follow-up):** the Go runner
  (`apps/runner`) must generate the keypair at registration, send the public key,
  and sign results — straightforward with crypto/ed25519 (it already verifies
  task signatures), but Go isn't runnable in this loop so it lands via CI.
- **Raise attack-path measurement past "Reachable."** 5 of 6 path families are
  honestly `Heuristic`; only DO firewall-config paths are `Measured`, and they
  cap at Reachable (never Exploitable). Add measured exploitability probes for
  more families so `evidenceBasis=Measured` covers real paths, not one.
- **Live control-injection loop.** Control verdicts already come from real
  CrowdStrike/Splunk telemetry (a genuine strength), but the closed
  inject→observe→verdict loop is runner-gated/dry-run; make it live.
- **One named anti-fabrication CI gate** (also WS4): ✅ DONE 2026-07-05.
  `tests/acceptance/anti-fabrication-invariants.test.ts` consolidates the honesty
  invariants across conclusion types into one auditable suite: correlated
  multi-hop paths are heuristic and never claim Validated/Exploitable; only
  authoritative measurement yields a Measured path (capped at Reachable, never
  Exploitable); no conclusion is ever labeled Exploitable (non-destructive
  validation never asserts demonstrated exploitation); an analyst disposition can
  never fabricate a Fixed status. Runs in the acceptance gate.
- **Honest scoping note (investigated 2026-07-05):** raising attack-path
  *exploitability* past the current honest ceiling is deliberately bounded.
  Measured posture FINDINGS are already measured (proven by the E2E). Multi-hop
  paths stay Heuristic because measuring lateral movement = active exploitation.
  UPDATE 2026-07-05: that active path is now reachable under an **authorized
  offensive-validation flip** (off-by-default, admin-authorized with a recorded
  attestation, policy-gated, audited; the hard floor never lifts) — so
  "Exploitable" is honestly achievable when a tenant explicitly authorizes
  adversarial validation. Acceptance `offensive-validation-flip-flow`; UI toggle
  in Trust & Safety. Broadening measured *1-hop* paths
  (like the DO firewall path) to more sources needs the modules to emit a
  parseable host on the signal (createSignal currently leaves
  rawPayloadPointer/relatedAssetIds empty) — a scoped, non-urgent follow-up.
  "Exploitable" is never claimed without active exploitation, and the gate above
  enforces that.

### WS2 — Reliability & Ops · C → A
- ✅ **Backups + tested restore DONE 2026-07-05.** `pnpm db:backup` (compressed
  custom-format pg_dump, timestamped, retained) + `pnpm db:restore` (guarded
  destructive restore) + `pnpm db:restore-drill` — the DR gate that dumps the
  live DB, restores into a throwaway, and asserts row-count PARITY across 10
  representative tables, then cleans up. Proven: parity on 924k audit_events,
  414k evidence_artifacts, 160k policy_decisions, 49k tenants (268 MB dump).
  Runbooks for the top failure modes in `docs/runbooks/` (disk-full — the one we
  hit — DB-down, runner-offline, migration-drift).
- ⏳ Remaining WS2: evidence-store durability/retention, distributed tracing
  (OpenTelemetry), scheduled automated backups in the deploy target.
- Structured logging + **distributed tracing** (OpenTelemetry) across api/runner/web.
- Graceful degradation + surfaced SLOs; runbooks for the top failure modes.
- Harden the continuous-validation sweep (idempotency, backpressure, poison-pill).
- **Gate:** a DR drill restores from backup to a working system; tracing shows a
  request end-to-end; runbooks exist for DB-down, disk-full, runner-offline.

### WS3 — Platform Security · C+ → A
- **Threat model** of the platform: multi-tenant isolation, runner trust boundary,
  Frontier Gateway, API-key lifecycle, evidence store.
- **Systematic tenant-isolation test matrix**: every tenant-scoped route proven to
  reject cross-tenant access.
- Auth hardening review (session, MFA, API-key scope/rotation, rate-limit tuning,
  security headers/helmet, CSRF).
- SAST + container image scanning in CI.
- **External pen test** (or internal red-team pass) of the platform itself.
- **Gate:** documented threat model w/ mitigations; isolation matrix all green;
  scan gates clean; pen-test criticals remediated.

### WS4 — Test Coverage, Perf & E2E · B+ → A
- ✅ **Browser critical-journey E2E DONE 2026-07-05.**
  `tests/e2e/critical-journey-ui.spec.ts` (Playwright): seeds a measured finding
  via the web origin's own /api/v1 proxy (browser-context cookies → authenticated
  page), then drives the REAL UI — the finding renders on /findings, an analyst
  disposition is applied through the form (badge appears after the live
  round-trip), and all five proof-loop screens (dashboard, executive,
  attack-paths, evidence, remediation) load authenticated in the shell.
  Complements the API-level first-customer-proof-loop spec. Verified passing.
- Raise acceptance coverage toward all **285 endpoints** (OpenAPI contract tests +
  per-domain flows); track a coverage threshold.
- **Load/perf baseline** (k6/artillery) with SLO targets; kill N+1s; tune pooling.
- **Playwright E2E** for the critical journey: signup → scope → validate → finding
  → remediate → measured-verify → report.
- **Gate:** coverage threshold met; perf baseline documented + SLOs set; E2E green in CI.

### WS5 — Product Completeness & Analyst-Criteria Fit · B+ → A
- Build a **capability matrix** mapping features → target analyst criteria (AEV/CTEM
  stages: scope, discover, prioritize, validate, mobilize, verify) with evidence links.
- Close deltas: deferred items (SSO config form, MSSP tenant switcher) + any
  analyst must-haves not yet met (prioritization transparency, scheduling depth,
  reporting completeness across exec/systems/threat basis — most already exist).
- UX pass on rapidly-built surfaces: empty/error states, a11y, copy.
- **Gate:** capability matrix scored, every "must" backed by a working feature +
  evidence link.

### WS6 — Deploy & Release Engineering · → A
- Reproducible IaC deploy (terraform present) to a real env; rolling/blue-green;
  migrations gated in the pipeline.
- CI/CD runs full unit + acceptance + scans + build before deploy; smoke tests post-deploy.
- **Gate:** one-command deploy to a clean environment passes smoke tests; pipeline
  blocks on any failing gate.

### WS7 — Analyst-Readiness Assessment (the final test) 
- Assemble the capability matrix + evidence and self-score against the chosen
  analyst rubric; produce an honest gap list; close remaining "musts."
- **Gate:** self-assessment shows all category "musts" met with evidence; this is
  the "test against analyst reporting" milestone.

---

## Locked decisions (2026-07-05)

- **Rubric = matrixed**: score against **Gartner AEV + CTEM**, **Forrester
  (exposure/BAS)**, and the **Periscan PRD** in one capability matrix (WS5/WS7).
- **Measured-loop target = local containerized test range**: a disposable,
  reproducible target environment (deliberately-vulnerable + hardened containers)
  the runner validates against. No cloud spend; fully repeatable in CI.
- **Sequencing = everything in parallel**: all workstreams run concurrently as
  independent, individually-verified increments.

## Recommended sequencing

1. **WS0 guardrails** — immediately, in parallel with everything (days).
2. **WS1 measured proof loop** — the long pole; start now, it gates the product claim.
3. **WS3 security** — begins in parallel; pen test scheduled for after WS1 lands.
4. **WS2 ops** + **WS4 coverage/perf/E2E** — parallelize as WS1 stabilizes.
5. **WS5 completeness** + **WS6 deploy** — as surfaces settle.
6. **WS7 analyst assessment** — the finish line / your acceptance test.

Honest scale: this is weeks-to-months of real work, WS1 being the largest. We
execute it as a sequence of shippable, independently-verified increments (the P0–P5
cadence), each with its own green gate, so progress is provable at every step.
