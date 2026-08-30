# Panel P05 — Offensive Red Teamer (exhaustive)

| Field | Value |
| --- | --- |
| **Persona** | Offensive Red Teamer — continuous validation honesty, BAS/AEV claims, kill-chain, identity/OT/ransomware scaffolds, external validation limits, path measurement ceiling |
| **Date** | 2026-07-29 |
| **Mode** | Read-only code + docs audit (no product edits) |
| **Repo root** | `/Volumes/DataSSD1/test/periscan` |
| **Primary sources** | `packages/modules/src/index.ts`, `packages/evidence/src/edge-validation-plan.ts`, `packages/policy/src/external-validation.ts`, `docs/generated/module-certification-report.md`, `docs/qa/analyst-scorecard.json`, `docs/COMPETITIVE_COVERAGE_MATRIX.md`, `docs/ANALYST_CAPABILITY_MATRIX.md`, `docs/MEASURED_TEST_RANGE.md`, `SECURITY_BOUNDARIES.md`, `apps/api/src/services/findings.ts` (`launchPathEdgeValidation`), `apps/web/src/components/attack-path-detail.tsx`, `PROMPT_CONTRACT.md`, `PREVIOUS_PANEL_SYNTHESIS.md` |
| **Previous panel** | Red teamer: *Replace: No · Complement: Yes* — continuous proof, not full RT; themes U-17 (fixture `Validated`), U-18 (stale certification), U-26 (not BAS library peer), U-29 (refuse live kill-chain) |

---

## 1. Verdict (lens: can this replace / complement a human red team?)

**Verdict: 3.0 / 5.0 — Complement: Yes · Replace: No · Sales as BAS/auto-pentest: Dangerous without hard packaging gates**

**5.0 definition (this lens):**  
A product I would trust as a **continuous offensive measurement plane** beside (not instead of) human red team / purple team: (1) every customer-visible `Validated` / `Measured` / `Exploitable` claim is either live-measured or explicitly labeled fixture/sim; (2) BAS means stimulus→detect/block with receipts, not dry-run import + ambient telemetry; (3) multi-hop path measurement works end-to-end for first-customer hop shapes without CTA/policy deadlocks; (4) external validation is honestly limited and hard to oversell; (5) identity/OT/ransomware/kill-chain surfaces never look like live adversarial proof; (6) certification and scorecard cannot claim Leading/Certified for scaffolds; (7) sales demos cannot present sim modules as customer proof.

**Why 3.0:**  
Safety floor and honesty architecture are real and unusually good for this category. Built-in passive/active-non-invasive probes (TLS/HTTP/DNS, Nuclei safe profiles, test-range measured loop) are real. Offensive headline modules are largely gated correctly (`liveSupported: false`, dry-run default, kill-chain `Inconclusive`). But the catalog still contains **fixture-default `Validated` + `measured: true` paths**, scorecard **Leading** rows over path/BAS depth, **stale certification**, and a hop-measure launch that **creates a mission but never queues** — a red teamer reads that as “proof theater until the receipt lands.” Do not replace human RT. Do complement as continuous proof of the cheap links you *can* measure.

**Buy / use posture (red team org):**  
- **Adopt as:** continuous posture validation + hop probes + fix re-proof + control observation.  
- **Do not adopt as:** full multi-vector BAS, ransomware emulation, AD credential abuse proof, OT attack pack, autonomous kill-chain, or pentest replacement.  
- **Sales misuse risk: High** if demos walk kill-chain / physical / grype “Validated” fixtures or scorecard “Leading Attack Path Validation” without Measured hop ratio.

---

## 2. Top 5 moves to reach 5.0 (red-team lens)

1. **Hard ban: fixture/sim modules must never emit `Validated` / `Exploitable` / `measured: true`.** Default `Inconclusive` or a dedicated `Simulated` product state; force UI/report banners. (Closes U-17, sales misuse.)  
2. **Close the path measurement loop for 3–4 hop shapes** (external exposure → asset, TCP CAN_ACCESS, HTTP health, TLS) with durable hopKey receipts and a working Measure hop → Approved → run → Measured journey. Cap exploitability claims honestly (Reachable ≠ Exploitable).  
3. **Ship one honest BAS substitute, not full library:** allowlisted endpoint canary + DNS-exfil canary + SIEM/EDR observeControl closed loop with live telemetry flag; keep Atomic/Caldera live permanently off until runner-signed inject path is certified.  
4. **Refresh module certification in CI** and fail if report module count ≠ `listModuleManifests().length`; demote catalog-only sims from customer “engines” surfaces.  
5. **Freeze scorecard Scaffold rows (2/16/21/22/26/28) and Partial BAS rows** — ban Leading without measured multi-hop + live inject evidence; sales deck = AEV/proof layer, never “BAS peer of Cymulate/AttackIQ/Pentera.”

---

## 3. Feature-zoo / IA notes (offensive surface)

| Action | Item | Why |
| --- | --- | --- |
| **Cut / Labs-only** | Swarm, hyperattack copy, “50k+ exploit templates,” physical RFID/RF sim, CTF gamified pack, video replay sim, TF/Ansible deploy sims | Red-team theater; dilutes proof product; sales misuse magnets |
| **Merge** | Kill-chain planner + engagement plan into a single “Attack plan (safe stages only)” workbench | Avoids second fake BAS product |
| **Rename** | `atomic.control_validation_safe` customer title → “Atomic dry-run scenario import (not live inject)” | Current name reads as BAS execution |
| **Rename** | `exploitation.killchain.engine` → “Kill-chain coverage planner (no execution)” | Name says Engine; body is plan-only (good body, bad brand) |
| **Demote** | Identity spray / Kerberos / Metasploit / ScoutSuite live claims | Keep as import/dry-run evidence only; never primary nav |
| **Protect** | Safe hop-probe allowlist (`SAFE_HOP_PROBE_MODULES`), external validation guard, Fixed-only-on-retest | Core honesty — do not loosen for demo speed |
| **Partner-only** | OT/ICS protocol packs beyond passive port observation; dark web/credential monitoring; crowdsourced HITL | Scorecard already Scaffold/gated — keep that way |

---

## 4. What is already excellent (do not break)

1. **Kill-chain module honesty upgrade** — `exploitation.killchain.engine` returns `validationState: "Inconclusive"`, `measured: false`, real ATT&CK technique IDs for *planned* stages only, and splits `engagementPlan` (safe live modules) vs `simulationOnlyStages` (never execute). This is the correct red-team product stance.  
2. **External validation policy** — only four Nuclei profiles (`safe-baseline`, fingerprint, headers, public-metadata); kill switch, ExternalPoA-only, Verified Domain/Subdomain, private/reserved block, rate limits (`packages/policy/src/external-validation.ts`).  
3. **Edge validation planner safety belt** — only TCP/DNS/HTTP/TLS hop modules; identity/control hops → NeedsIntegration / NoSafeModule; never recommends credential-theft modules (`packages/evidence/src/edge-validation-plan.ts`).  
4. **Launch path never queues Denied; never fabricates Measured** — `launchPathEdgeValidation` returns Denied without mission; RequiresApproval creates mission with `queued: false` and explicit next-step copy (`apps/api/src/services/findings.ts`).  
5. **Atomic / Caldera / Metasploit / identity spray** — `liveSupported: false`; live Atomic returns policy-disabled Inconclusive; BloodHound is import-only (`sharpHoundCollectorUsed: false`).  
6. **Measured test range** — real TLS/HTTP/DNS probes vs disposable range (`docs/MEASURED_TEST_RANGE.md`); fixtures for parsers only.  
7. **DNS exfil canary design** — benign marker only; `realDataExfiltrated: false`; Missed only when telemetry present; measured only when emit + liveTelemetry (`periscan.dns_exfil_canary`).  
8. **OT protocol exposure claim** — “NEVER speaks the OT protocol”; uses observed ports only (`ot_ics.protocol_exposure`).  
9. **Anti-fabrication culture** — Competitive matrix and analyst matrix self-score Scaffold/Partial for BAS/APT/OT; PRD bans Math.random swarm metrics as ship blockers.  
10. **Catalog-only quarantine set** — physical/grype/semgrep sim/killchain excluded from `listModuleManifests` / `getModuleById` executable registry (still a catalog/sales risk if surfaced elsewhere — see findings).

---

## 5. Findings (machine-parseable)

### FINDING | P05-1 | P0 | bug | engines | Fixture/sim modules stamp Validated + measured:true (sales/trust poison)
- **Persona:** Offensive Red Teamer
- **Evidence:** `packages/modules/src/index.ts` — `identity.cred_spray` fixture path sets `validationState: found ? "Validated" : "Fixed"` and `attributes.measured: true`; `cloud.scoutsuite_posture` fixture same pattern; `bloodhound.identity_pathing` import → `Validated` when privileged edges exist; `ot_ics.safe_baseline` fixture → `Validated`; G1/G3 sims `grype.cve_scan` / `physical.rfid_sim` / etc. hardcode `validationState: "Validated"` with `simulated: true` (catalog-only set). Previous panel **U-17**.
- **Problem:** `Validated` is the customer-facing “we proved exposure” state. Fixture-backed modules mint that state (and sometimes `measured: true`) without a live authorized probe. Red teams and auditors will treat this as fabricated BAS proof if it reaches findings/reports.
- **Impact:** Trust collapse; competitive demo fraud risk; Fixed/Verified lifecycle polluted by fake exposures that “close” on empty fixtures.
- **Recommendation:** Enforce a module-output invariant: if `fixtureMode`/`simulated`/`dryRun` (without live tool), validationState ∈ {Inconclusive, Detected?, Logged?} — never Validated/Exploitable/Fixed as exposure proof; set `measured: false`. Add acceptance test scanning registry execute paths. Keep parser unit tests, but quarantine fixture outcomes behind `evidenceBasis: Heuristic` + UI “Fixture” badge.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-17

### FINDING | P05-2 | P0 | bug | paths | Path edge launch never queues work — Measure hop stops at RequiresApproval mission
- **Persona:** Offensive Red Teamer
- **Evidence:** `apps/api/src/services/findings.ts` `launchPathEdgeValidation` comment: “Safe auto-queue is intentionally not enabled”; always returns `queued: false`, `status: "RequiresApproval"` even when policy would allow safe ActiveNonInvasive. UI `attack-path-detail.tsx` treats Eligible + NeedsApproval as launchable and shows Measure hop CTA. Help copy says progress only via receipts.
- **Problem:** From a red-team operator view, “Measure hop” is a **policy ticket creator**, not a measurement. Multi-hop path proof cannot complete without a second start/approve/run path that is easy to miss — path measurement ceiling is productized as incomplete.
- **Impact:** Flagship AEV claim fails Monday morning; demos stall; Slice 3 residual (previous panel U-05 hop CTA / correlation). Scorecard row 3 “Attack Path Validation” Leading is not earned as continuous measurement.
- **Recommendation:** Define one explicit happy path: Eligible + Passive/ActiveNonInvasive + verified scope → create mission **and** queue hop module when policy outcome is Allowed; keep RequiresApproval for ControlledValidation+. Surface mission deep-link + “Run hop probe now” with hopKey receipt write-back. Never upgrade edge to Measured without evidence IDs (already correct).
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-05

### FINDING | P05-3 | P0 | improvement | competitive | BAS honesty gap: Atomic is dry-run import, not control inject BAS
- **Persona:** Offensive Red Teamer
- **Evidence:** `atomic.control_validation_safe` — `safetyLevel: "BASLite"`, `liveSupported: false`; `dryRun === false` returns `live_execution_disabled` / Inconclusive; otherwise loads allowlisted scenarios and defaults `fixtureOutcome ?? "Detected"`. Competitive matrix SCV: “Never executes a stimulus and measures block/detect.” Scorecard row 16 Agentless APT Execution = Scaffold/gated.
- **Problem:** Naming + safety level **BASLite** implies breach-and-attack simulation. Implementation is **scenario content import + optional fixture outcome**. Ambient SIEM observe is real; inject half is not. Red teams will call this “content library, not BAS.”
- **Impact:** Sales vs Cymulate/AttackIQ/SafeBreach demos lose instantly if honesty slips; if honesty holds, still over-catalogued under BAS.
- **Recommendation:** Rebrand to “Control scenario library (dry-run)”; separate product claim “Measured control effectiveness” only when `endpoint_benign_marker_emit` / `dns_exfil_canary` / runner canary + liveTelemetry observeControl closes Detected/Missed. Keep live Atomic permanently off (AGENTS.md / SECURITY_BOUNDARIES) until a certified allowlist of non-destructive techniques exists on runner with signed results.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-26

### FINDING | P05-4 | P1 | bug | ops | Module certification report stale (40 modules @ 2026-06-24 vs expanded registry)
- **Persona:** Offensive Red Teamer
- **Evidence:** `docs/generated/module-certification-report.md` Generated at `2026-06-24T14:39:34.920Z`, “Modules certified: 40”. Registry `createModule` inventory in `packages/modules/src/index.ts` now includes OT, endpoint analytics, DNS exfil canary, SSCS, SSPM, kill-chain, physical, IaC sims, etc. Certification harness uses `listModuleManifests()` (`scripts/module-certification.ts`) and has a staleness check command — report file checked in is old. Previous panel **U-18**.
- **Problem:** Governance artifact claims full catalog certified; new modules may ship uncertified. Red-team buyers ask for tool certification before enablement.
- **Impact:** Compliance/legal blind spot; OSS dual-truth adjacent (U-04); false confidence in “Certified” column.
- **Recommendation:** CI job `pnpm modules:certify` must regenerate report and fail on drift vs committed report + fail if any executable module is NotCertified for ship tags. Publish count and date on Registry Center UI. Exclude catalog-only sims from “Certified engines” count with explicit “Simulation catalog” bucket.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-18

### FINDING | P05-5 | P1 | improvement | paths | Path measurement ceiling: identity & lateral hops have NoSafeModule
- **Persona:** Offensive Red Teamer
- **Evidence:** `edge-validation-plan.ts` `recommendSafeModulesForHop` — Identity / NonHumanIdentity → empty modules, missingTelemetry `identity_posture`; lateral CAN_ACCESS maps to TCP/DNS/HTTP/TLS only. BloodHound is import-only (`liveSupported: false`, no SharpHound). Scorecard row 22 Identity Abuse & Credential Harvesting Scaffold/gated; matrix: 5/6 path families Heuristic.
- **Problem:** Real red-team paths die at AD edges (AdminTo, HasSession, GenericAll). Product correctly refuses unsafe probes, but then **cannot measure** the hops that matter for domain compromise stories. Ceiling = network exposure + config reachability, not privilege graph proof.
- **Impact:** Honest product is “external/network hop prober,” not “identity attack path validator.” Overclaiming identity pathing is sales misuse.
- **Recommendation:** Ship **import + re-import verification** as Measured-for-identity: signed BloodHound CE graph ingest with collector attestation fields; never claim Exploitable from graph alone. Optional partner: Entra/AD read APIs for high-value edges. Do **not** enable live netexec/kerbrute against customer AD by default.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme path ceiling / Slice 3

### FINDING | P05-6 | P1 | improvement | engines | Kill-chain “Engine” is plan-only; 7/10 stages have null safeLiveModuleId
- **Persona:** Offensive Red Teamer
- **Evidence:** `exploitation.killchain.engine` — stages Credential access→…→Identity forgery; only `gitleaks.repo_secrets`, `web.zap_baseline`, `prowler.aws_posture` non-null; ransomware Impact `safeLiveModuleId: null`; outcome Inconclusive. Comments still reference “50k+ evolving exploit templates” elsewhere in file header/toolchain. Competitive matrix still notes APT/kill-chain Scaffold.
- **Problem:** Module name + PRD competitive track language still read as full kill-chain execution. Code is correct (plan only). Residual risk is **GTM/docs/nav** and engagementPlan mapping “safe modules” to kill-chain stages (gitleaks ≠ T1110 credential dumping).
- **Impact:** Red teamer dismisses product as vapor if marketed as kill-chain; if sold honestly, engagementPlan technique mapping is still weakly grounded (secrets scan ≠ credential access technique proof).
- **Recommendation:** Rename; UI label “Coverage planner.” Map stages to techniques **and** evidence class (Exposure scan vs Attack action). Never auto-run engagementPlan as “kill-chain complete.” Remove 50k+ language from customer-visible toolchain strings.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-29

### FINDING | P05-7 | P1 | feature | engines | Ransomware “emulation” is a null stage — scorecard Scaffold is correct; do not build live crypto
- **Persona:** Offensive Red Teamer
- **Evidence:** Kill-chain stage “Impact (ransomware sim)” T1486, `safeLiveModuleId: null`. Scorecard id 21 Ransomware Emulation verdict Scaffold/gated, score 2.0, dependency SafetyEquivalent. No dedicated ransomware module in executable registry.
- **Problem:** Market BAS vendors demo encrypt/canary file ops. Periscan correctly has **nothing** live. Risk is roadmap pressure to “just enable Atomic ransomware techniques.”
- **Impact:** Building real ransomware-like encrypt/delete is a hard never for this product’s safety floor and liability.
- **Recommendation:** **Never build** live encryption, shadow-copy delete, or mass file lock. **Safe substitute:** canary file write of a uniquely tagged zero-byte marker in an authorized path + EDR detect/block observe (like endpoint benign marker), labeled “ransomware *detection* canary,” not ransomware emulation. Keep scorecard Scaffold until that detection loop is live.
- **Effort:** M (substitute) / never (live crypto)
- **Zoo-related:** no
- **Previous-panel-link:** Slice 9 scaffolds

### FINDING | P05-8 | P1 | improvement | engines | Identity abuse modules are dry-run theater with fixture Validated escape hatch
- **Persona:** Offensive Red Teamer
- **Evidence:** `identity.cred_spray` / `identity.kerberos_userenum` — `liveSupported: false`; non-fixture dry-run → Inconclusive plan; `dryRun === false` → disabledLiveExecutionOutput; fixtureMode runs netexec path in code **or** fixtureValidCredentials and can return Validated + measured:true. Scorecard row 22 Scaffold.
- **Problem:** Module exists in production registry (not catalog-only). Fixture path overclaims (P05-1). Live path is correctly disabled but dead code path still calls `runToolCapture("netexec", …)` if fixtureMode false and dryRun false somehow bypasses — currently gated by disabled output when dryRun false; still a maintenance hazard.
- **Impact:** Red team may try to enable “real spray” for a purple team engagement; legal/safety incident risk if gates regress.
- **Recommendation:** Keep live disabled forever unless tenant offensive tier + lab-only scope + rate-limited single-user check modules (not spray). Delete or compile-out netexec live branch. Prefer **password spray *detection*** canary (failed auth marker + IdP logs) over credential validation.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-17 / Slice 9

### FINDING | P05-9 | P1 | improvement | engines | OT/ICS: passive port classification is fine; fixture baseline Validated and liveSupported:true overstate pack maturity
- **Persona:** Offensive Red Teamer
- **Evidence:** `ot_ics.protocol_exposure` — passive on openPorts, never speaks OT protocol (good); Validated when ports match industrial services. `ot_ics.safe_baseline` — `liveSupported: true` but non-fixture returns Inconclusive “must be executed by Internal Runner” without implementing runner payload; fixture returns Validated. Scorecard id 26 OT/ICS Attack Packs Scaffold/gated 1.75.
- **Problem:** LiveSupported:true without a real runner agent module is catalog falsehood. Fixture Validated is overclaim. OT red team concern: any accidental active scan against PLCs.
- **Impact:** Plant environments must not see active recon by default; overstated OT pack is a safety *and* sales issue.
- **Recommendation:** Set `liveSupported: false` until runner implements non-disruptive profile. Fixture → Inconclusive + `partnerLabQualified` required for any customer-visible Validated OT claim. Scope tags: OT assets force maxSafetyLevel PassiveReadOnly (policy). Partner path for deeper packs.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Slice 9 id 26

### FINDING | P05-10 | P1 | improvement | engines | External validation limits are correct — product cannot be sold as full ASV/pentest external
- **Persona:** Offensive Red Teamer
- **Evidence:** `packages/policy/src/external-validation.ts` — only 4 safe Nuclei template profiles; GET-only notes; Domain/Subdomain Verified only; no IP-only external; reserved/private blocked; rate windows. Modules templates under `packages/modules/templates/nuclei/safe-baseline/`. Competitive: Nuclei SaaS cheaper for pure scan (U-30).
- **Problem:** Limits are a feature for safety, not a bug — but UI/PRD “EASM/ASV” language can overshoot. No crawl, no auth fuzz, no exploit templates, no subdomain takeover active claim beyond DNS dangling precondition modules.
- **Impact:** Red team external recon expects content discovery, vuln templates, auth flows — not here. Good. Sales must not demo “full external attack surface management.”
- **Recommendation:** External workbench copy: “Authorized safe observations (headers, fingerprint, public metadata).” Explicit non-goals list. Compete on proof workflow + scope + evidence, not template count. Optional future: more **GET-only** templates still allowlisted — never generic nuclei severity packs.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-30

### FINDING | P05-11 | P1 | bug | gtm | Scorecard inflation on Attack Path / Dynamic Paths vs measured reality
- **Persona:** Offensive Red Teamer
- **Evidence:** `docs/qa/analyst-scorecard.json` id 3 Attack Path Validation verdict **Leading** 4.25; id 23 Dynamic Attack Paths **Leading** 4.5; id 4 Choke Point **Leading** 4.5. Contrast `docs/ANALYST_CAPABILITY_MATRIX.md` and `COMPETITIVE_COVERAGE_MATRIX.md`: APV Partial; 5/6 path families Heuristic; dynamic paths Scaffold; choke points descriptive not min-cut. Previous panel **U-07**.
- **Problem:** Internal scorecard sells Leading where code matrix says Partial/Scaffold. Red-team and Forrester personas already flagged inflation.
- **Impact:** Product strategy and sales decks will cite 79.1→95.9 plan as if path/BAS depth is Leading; design partners get disappointed in week one.
- **Recommendation:** Blind rescore rows 3/4/23/16/21/22/26 against measured hop ratio + live inject. Cap at Partial until multi-hop Measured is default journey. Freeze Leading language in external materials.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P05-12 | P2 | improvement | engines | Catalog-only sims still return Validated in code — quarantine incomplete if toolchain surfaces them
- **Persona:** Offensive Red Teamer
- **Evidence:** `CATALOG_ONLY_SIMULATION_MODULE_IDS` excludes physical/grype/semgrep/killchain/iac/ctf from `getModuleById`, but module bodies still assign `Validated`. `packages/modules/src/toolchain.ts` still describes grype/semgrep as feeding “50k+ style” kill-chain templates; featureTags include `50k`.
- **Problem:** Exclusion from execute path is good; residual Validated + marketing strings create dual-truth if Registry/Marketplace/UI lists catalog-only as runnable engines.
- **Impact:** Demo script or future wiring re-enables execute without fixing outcomes → instant U-17 regression.
- **Recommendation:** Single `simulationOutcome()` helper forced for catalog-only; toolchain customer strings ban 50k+/hyperattack; Registry UI section “Simulation / planning only (non-executable).”
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-17

### FINDING | P05-13 | P2 | feature | engines | Safe substitutes to build (detection canaries) vs never build (live offense)
- **Persona:** Offensive Red Teamer
- **Evidence:** Existing good substitutes: `periscan.endpoint_benign_marker_emit`, `periscan.dns_exfil_canary`, safe hop probes, Nuclei safe profiles, kill-chain planner, BloodHound import. Hard floors: AGENTS.md / SECURITY_BOUNDARIES — no destructive, no exfil, no persistence, no credential theft, no uncontrolled chaining; do not enable SharpHound/Caldera/Atomic live without approval architecture.
- **Problem:** Roadmap and competitive PRD still list full BAS / APT / multi-modal sims as mandatory market coverage, pressuring the wrong build list.
- **Impact:** Building wrong half destroys the honesty brand that is the only durable moat vs Pentera/Cymulate.
- **Recommendation:**  
  **Build:** multi-hop safe probes + receipts; marker/canary BAS; import graph re-measure; fix re-proof; control observe closed loop; allowlisted external GET templates.  
  **Never build:** live ransomware encrypt; live credential spray against customer IdP; SharpHound collector in product; Metasploit exploit run; OT protocol write/modbus coil flips; uncontrolled multi-stage agent; phishing payload delivery; malware staging.  
  **Partner:** dark web credential monitoring (scorecard id 2), crowdsourced HITL (id 28), deep OT lab packs (id 26).
- **Effort:** XL (program) / governance S
- **Zoo-related:** yes
- **Previous-panel-link:** consensus Do-not-prioritize

### FINDING | P05-14 | P2 | improvement | evidence | BloodHound Validated confuses graph import with path proof
- **Persona:** Offensive Red Teamer
- **Evidence:** `bloodhound.identity_pathing` — import graph, filter privileged edges, `validationState: pathEdges.length > 0 ? "Validated" : "Fixed"`. Description: collector execution disabled. No edge evidenceBasis Measured on attack path from this alone.
- **Problem:** In red-team language, “identity path validated” means walk/abuse path. Here it means “imported graph contained admin-ish edges.” Fixed when no edges is also wrong (import empty ≠ remediated).
- **Impact:** Findings queue can show Validated identity exposure without any hop measurement or live AD context.
- **Recommendation:** Use validationState `Discovered` or `Inconclusive` for import; create path hypotheses with `evidenceBasis: Heuristic`; only upgrade edges after import integrity checks + optional re-query. Fixed only after re-import shows edge absence **and** optional control/config verification.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-17

### FINDING | P05-15 | P2 | bug | engines | Metasploit / ScoutSuite “Measured” language on fixture outputs
- **Persona:** Offensive Red Teamer
- **Evidence:** `exploit.metasploit_check` liveSupported false; fixture can claim vulnerable; `cloud.scoutsuite_posture` evidence description “Measured ${provider} cloud posture (ScoutSuite)” with measured:true on fixture. Analyst matrix line: offensive tools’ Measured labels are fixture-driven.
- **Problem:** Evidence attribute `measured: true` is the proof bit used downstream. Fixture ScoutSuite/Metasploit must not set it.
- **Impact:** Risk scores and Fixed gates may treat fixture posture as authoritative measurement.
- **Recommendation:** `measured` only when tool runtime executed under signed task against verified scope; fixtures set `measured: false`, `fixture: true`. CI invariant on ModuleOutput.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-17

### FINDING | P05-16 | P2 | improvement | competitive | Do not compete as BAS library peer — own AEV/proof narrative
- **Persona:** Offensive Red Teamer
- **Evidence:** Previous panel U-26/U-29; scorecard scaffolds 16/21/22/26; competitive matrix AI-powered BAS Scaffold; Atomic/Caldera live off. Real strength: Fixed-only-on-retest, Measured vs Heuristic, hop planner, external guard, test range.
- **Problem:** Feature zoo and PRD 3.9 full BAS language invite head-to-head library demos Periscan will lose.
- **Impact:** Wrong RFP box → loss or unsafe overbuild.
- **Recommendation:** Positioning line for red-team buyers: “We continuously **prove the cheap links** on paths your scanners and humans found — we do not replace your annual RT or your BAS library.” Co-exist with Cymulate/AttackIQ/Pentera/Wiz/Tenable. Wave inclusion only after references + measured multi-hop.
- **Effort:** S (positioning) / L (product depth)
- **Zoo-related:** yes
- **Previous-panel-link:** U-26 / U-29

### FINDING | P05-17 | P2 | innovation | engines | Technique-mapped “safe stage” playbooks as the only ethical kill-chain productization
- **Persona:** Offensive Red Teamer
- **Evidence:** Kill-chain already emits engagementPlan of safe modules; endpoint marker + DNS canary + gitleaks + zap baseline + prowler exist as real-ish stages.
- **Problem:** Stages still loosely mapped (T1110 → gitleaks). Operators need playbooks: “prove credential *exposure* in repos,” not “simulate credential dumping.”
- **Impact:** With better mapping, kill-chain UI becomes a **purple-team checklist** instead of fake APT.
- **Recommendation:** Ship ATT&CK-technique → **measurement class** table (Exposure / Detection / Config / Forbidden). For each allowed class, one default module + success criteria (Validated/Detected/Missed/Inconclusive). Export as engagement report for human RT handoff (“we proved these hops; we did not attempt these techniques — schedule RT”).
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme anti-fabrication

### FINDING | P05-18 | P3 | request | security | Sales / demo guardrails for offensive modules
- **Persona:** Offensive Red Teamer
- **Evidence:** Demo labeled sample (previous panel excellence #9); modules still named Engine/BAS/Spray; scorecard Leading rows; freemium light external scan notes “No full swarm” in API copy but swarm nav may still exist (`app-navigation` Agent Swarm).
- **Problem:** Demo discipline is documentation-level, not product-enforced. New SE can still click sim modules and show Validated.
- **Impact:** One bad demo = permanent brand damage in red-team community.
- **Recommendation:** Demo tenant flag: simulation modules watermark findings “DEMO FIXTURE — NOT CUSTOMER PROOF.” Production tenants: hide catalog-only sims. Sales enablement one-pager from this audit’s build vs never-build list.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** theme sales misuse

---

## 6. Weak scorecard rows (offensive-relevant) — keep gated

| ID | Requirement | Scorecard | Code truth (this audit) | Red-team instruction |
| --- | --- | --- | --- | --- |
| 2 | Dark Web & Credential Monitoring | Scaffold/gated 1.75 | Partner dependency; not a validation core | Partner only — never fake |
| 3 | Attack Path Validation | **Leading 4.25** | Model strong; multi-hop Measured partial; launch doesn’t queue | **Demote to Partial** until P05-2 closed |
| 16 | Agentless APT Execution | Scaffold/gated 2.0 | Kill-chain plan-only; no agentless APT | Keep Scaffold; never live APT |
| 21 | Ransomware Emulation | Scaffold/gated 2.0 | Null safe stage only | Detection canary only |
| 22 | Identity Abuse & Credential Harvesting | Scaffold/gated 2.25 | Import + dry-run; spray live off | Import + detection canaries |
| 26 | OT/ICS Attack Packs | Scaffold/gated 1.75 | Passive port audit + incomplete baseline | Passive only + partner lab |
| 28 | Crowdsourced HITL | Scaffold/gated 1.5 | Partner | No fake marketplace of humans |

---

## 7. Agreement / dissent with previous panel synthesis

| Theme | Stance |
| --- | --- |
| Complement not replace RT | **Agree hard** |
| U-17 fixture Validated | **Agree — elevate to P0 invariant** |
| U-18 stale certification | **Agree** |
| U-26 not BAS library peer | **Agree** |
| U-29 refuse live kill-chain | **Agree — code already refuses; rename/marketing lag** |
| Slice 3 measured paths | **Agree — flagship; launch queue gap is the operational blocker** |
| Slice 9 scaffolds stay gated | **Agree** |
| Autonomous/swarm demote | **Agree** (offensive theater) |
| Dissent | Previous synthesis “anti-fabrication swarm metrics removed” is largely true for kill-chain module; **residual 50k+ toolchain marketing strings and fixture Validated remain** — not fully clean |

---

## 8. Bottom line

Periscan’s offensive posture is **ethically and architecturally closer to a purple-team continuous proof system** than to an autonomous red team. That is the correct product. The failures that will get a red teamer (or a hostile buyer) to walk are not missing Metasploit live — they are **`Validated` without measurement**, **path Measure that does not measure**, **BASLite naming without inject**, and **scorecard/certification theater**.

Ship the honesty invariant and the hop receipt loop. Keep the safety floor. Market as AEV/proof. Never sell as full BAS, ransomware emulation, or RT replacement.

---

*End of panel P05 — `docs/qa/panel-audit-exhaustive-2026-07-29/personas/05-red-teamer.md`. Findings: 18 (P05-1 … P05-18).*
