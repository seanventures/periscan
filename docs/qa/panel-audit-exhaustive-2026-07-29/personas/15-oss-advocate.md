# Panel P15 — Open Source Security Advocate (Exhaustive)

**Date:** 2026-07-29  
**Persona:** Open Source Security Advocate  
**Lens:** Proprietary dual-truth on modules, AGPL, notices, Engine Lab BYO-license model (`docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md`), attribution, Nuclei rebrand, NPSL, CONTRIBUTING, marketplace honesty, license risk gate  
**Mode:** Docs + code/docs inspection only (no product code changes)  
**Workspace:** `/Volumes/DataSSD1/test/periscan`  
**Previous panel:** `docs/qa/panel-audit-2026-07-29/15-oss-advocate.md` (~7.3/10; dual-truth P0) · synthesis **U-04**

---

## Verdict (lens definition)

| Score | Definition of 5.0 |
| ---: | --- |
| **2.8 / 5** | Every third-party-backed module’s SPDX matches the tool catalog; `licenseRisk` is derived from linked tools + disposition; GPL/LGPL/NPSL never appear as `Proprietary`/`Allowed` laundering; default images do not redistribute review-gated copyleft binaries; Engine Lab records tenant license acceptance before install; notices are true attribution; marketplace never pretends installability that policy forbids (or offers a real accept→install path); CONTRIBUTING/adapter guide exists; AGPL policy text matches the fail-closed gate. |

**Ship posture (OSS honesty):** **Conditional fail for public “open validation engines” claims.** Flagship permissive wrappers (Gitleaks/Nuclei/Trivy/OSV/Prowler) are well attributed. The **module↔tool license dual-truth**, **Semgrep MIT-vs-LGPL inversion**, and **scan-executor redistribution of GPL/LGPL-family tools** are trust-destroying if an auditor, upstream maintainer, or Wave analyst inspects the tree.

**Agreement with previous panel:** Strong — reaffirm **U-04** (module license dual-truth) as the single largest OSS integrity failure. This exhaustive pass **deepens** that finding with: reverse dual-truth (Semgrep MIT), image bake of legal-review tools, certification/license-gate blind spots, Engine Lab plan vs runtime reality, and thin notices.

---

## Method & evidence base

| Area | Paths inspected |
| --- | --- |
| Contract / prior | `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md`, `PREVIOUS_PANEL_SYNTHESIS.md` |
| Engine Lab plan | `docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md` |
| Policies | `OPEN_SOURCE_POLICY.md`, `docs/OPEN_SOURCE_POLICY.md`, `docs/OPEN_SOURCE_LICENSE_POLICY.md`, `docs/OPEN_SOURCE_VALIDATION_ENGINES.md`, `docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`, `docs/TOOL_RUNTIME_SECURITY.md` |
| Notices / gate | `licenses/THIRD_PARTY_NOTICES.md`, `scripts/license-inventory.ts`, `tests/license/license-inventory.test.ts` |
| Modules / toolchain | `packages/modules/src/index.ts` (`deriveLicenseRisk`, module `license` fields, Nuclei fallback), `packages/modules/src/toolchain.ts` |
| Certification | `scripts/module-certification.ts`, `docs/generated/module-certification-report.md` |
| Images | `infra/docker/scan-executor.Dockerfile`, `apps/runner-agent/Dockerfile` |
| Marketplace UI/API | `apps/web/src/components/tool-governance-marketplace.tsx`, `registry-center.tsx`, `apps/api/src/services/third-party-tools.ts` |
| Prior persona | `docs/qa/panel-audit-2026-07-29/15-oss-advocate.md` |

---

## What is already excellent (do not break)

1. **Engines-not-identity policy** — OSS tools framed as internal validation engines; raw tool output not primary UX (`OPEN_SOURCE_POLICY.md`, reports appendix pattern).  
2. **Honest flagship catalog naming** — Gitleaks/Nuclei/Trivy/OSV/Prowler with real `displayName`, SPDX, `gitRepo`, `docsUrl`, pinned versions.  
3. **Fail-closed AGPL/SSPL/BSL patterns in code** — `evaluateLicensePolicy` blocks AGPL family; MISP kept out of catalog for AGPL.  
4. **Tool-layer legal-review quarantine** — SharpHound, testssl, sqlmap, nikto, whatweb, scoutsuite, semgrep marked `RequiresLegalReview`; tenant enable/install denied via `canEnableEntry` / install job `Denied`.  
5. **Governance honesty on install flags** — worker install execute opt-in (`PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE`); no arbitrary curl|bash.  
6. **Extension SPDX + signed OCI + `executionAuthorized: false`** — model tenant contribution path.  
7. **Engine Lab product plan** — correctly names dual-truth as Phase 0 prerequisite and designs BYO accept→install→verify without shipping restricted binaries by default.  
8. **Marketplace surfaces upstream license badges** on tool cards (not inventing “Periscan Scanner™” product names for Nuclei/Trivy).

---

## Findings

### FINDING | P15-1 | P0 | bug | engines | Module manifests label third-party engines Proprietary (dual-truth)
- **Persona:** Open Source Security Advocate
- **Evidence:** `licenses/THIRD_PARTY_NOTICES.md` tool table vs module table — e.g. toolchain `nmap` **NPSL** / `sqlmap` **GPL-2.0** / `subfinder` **MIT** while modules `recon.host_discovery`, `web.sqli_probe`, `recon.subdomain_enum` etc. declare **Proprietary**. Source: `packages/modules/src/index.ts` module `license` fields for recon/web/identity/cloud/exploit packs. Same dual-truth visible in `docs/generated/module-certification-report.md` (`cloud.scoutsuite_posture` Proprietary Allowed while tool is GPL-2.0 RequiresLegalReview).
- **Problem:** Two contradictory truths in the official notices and certification surfaces. Adapter-owned glue is not a license to reclassify upstream engines as Proprietary.
- **Impact:** Attribution lie; launders copyleft into `Allowed` (see P15-4); destroys OSS credibility and fails any customer OSS inventory review. Prior panel **U-04**.
- **Recommendation:** For every module with non-empty `toolIds`, set `license` to the primary tool SPDX (or SPDX expression). Add hard certification failure on mismatch. Regenerate notices.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P15-2 | P0 | bug | engines | Semgrep modules claim MIT while catalog is LGPL-2.1 RequiresLegalReview
- **Persona:** Open Source Security Advocate
- **Evidence:** `packages/modules/src/toolchain.ts` `semgrep` → `license: "LGPL-2.1"`, `policyStatus: "RequiresLegalReview"`. Modules `semgrep.code_exploit_scan` / `semgrep.web_api_exploit` in `packages/modules/src/index.ts` set `license: "MIT"`, `toolIds: ["semgrep"]`, and return fixture `validationState: "Validated"`.
- **Problem:** Reverse dual-truth: more permissive than reality. Worse than Proprietary-on-GPL because it invents a false compatible license for an LGPL engine under legal review.
- **Impact:** License inventory and any UI showing module MIT would green-light LGPL obligations; community would treat this as intentional mislabeling.
- **Recommendation:** Set module license to `LGPL-2.1`; `licenseRisk: RequiresLegalReview`; ensure sim modules cannot surface as Allowed executable product depth. Cross-check in certification.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** U-04

### FINDING | P15-3 | P0 | bug | security | scan-executor image redistributes GPL-family tools marked RequiresLegalReview
- **Persona:** Open Source Security Advocate
- **Evidence:** `infra/docker/scan-executor.Dockerfile` lines 60–78: `apt-get install … testssl.sh sqlmap ffuf nikto whatweb` and `pipx install scoutsuite`. Toolchain marks testssl/sqlmap/nikto/whatweb/scoutsuite as **GPL-2.0/GPL-3.0 + RequiresLegalReview**. Engine Lab plan §2 explicitly: do **not** ship GPL/LGPL binaries by default; customer BYO install instead (`docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md`).
- **Problem:** Default SaaS toolkit image embeds legal-review copyleft tools, contradicting policy, plan, and “not redistributed by default” story.
- **Impact:** Real redistribution obligations (and product liability narrative) while governance UI tells operators tools are legal-review blocked for enable/install. Dual operational truth.
- **Recommendation:** Remove GPL/LGPL-family packages from default scan-executor image; leave only permissive pins (gitleaks/nuclei/trivy/osv/prowler/promptfoo/pyrit). Route restricted tools through Engine Lab accept→install after Phase 0–1. Add CI image scan gate promised in plan §10.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P15-4 | P0 | bug | security | licenseRisk derived only from module.license string (bypasses tool disposition)
- **Persona:** Open Source Security Advocate
- **Evidence:** `packages/modules/src/index.ts` `deriveLicenseRisk()` tests only `manifest.license` against BLOCKED/REVIEW patterns; `"Proprietary"` → **Allowed**. Linked `toolIds` and toolchain `policyStatus` are ignored. Certification report shows `web.sqli_probe` / `web.nikto_scan` / `cloud.scoutsuite_posture` as **Proprietary | Allowed**.
- **Problem:** Module layer systematically reports Allowed for wrappers of GPL engines that the tool layer correctly quarantines.
- **Impact:** API/OpenAPI `licenseRisk`, module list UIs, and cert report mislead operators and compliance tooling; policy gate at module layer is cosmetic.
- **Recommendation:** Derive risk as max severity of (module license disposition, each tool’s license disposition, each tool’s `policyStatus`). Never allow Proprietary to collapse linked GPL risk.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P15-5 | P1 | bug | api | License inventory evaluates modules without tool cross-check or policyStatus
- **Persona:** Open Source Security Advocate
- **Evidence:** `scripts/license-inventory.ts` `evaluateInventory`: tools pass `policyStatus`; modules pass only `{ license, name, source: "module" }`. No assertion that `module.license` matches `getOpenSourceToolDefinition(toolId).license`. Tests in `tests/license/license-inventory.test.ts` cover AGPL/GPL/OR expressions but **not** dual-truth or NPSL.
- **Problem:** CI `pnpm licenses:check` can be green while notices contain contradictory tool vs module rows.
- **Impact:** False confidence in “fail-closed license CI”; dual-truth is load-bearing tech debt.
- **Recommendation:** Add inventory rule: for each module with toolIds, license must match primary tool (or explicit multi-tool expression); fail CI on mismatch. Add NPSL + dual-truth unit tests.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P15-6 | P1 | bug | copy | AGPL policy dual-truth: “legal review” prose vs unconditional Blocked in code
- **Persona:** Open Source Security Advocate
- **Evidence:** Root `OPEN_SOURCE_POLICY.md`: “AGPL tools require explicit legal review before use.” `docs/OPEN_SOURCE_POLICY.md`: “AGPL, GPL collectors… require legal review.” But `docs/OPEN_SOURCE_LICENSE_POLICY.md` and `evaluateLicensePolicy` treat AGPL/SSPL/BSL as **Blocked** (not RequiresLegalReview). Engine Lab plan correctly: Blocked (AGPL) → no install path.
- **Problem:** Three stories: reviewable AGPL, blocked AGPL, no-install AGPL. Operators/legal reading the short policy will wrong-foot the gate.
- **Impact:** Process confusion; possible intake of AGPL “for review” that CI will hard-fail; credibility hit if marketing echoes the soft wording.
- **Recommendation:** Align all policies: AGPL/SSPL/BSL/Commons Clause/PolyForm = **Blocked, never installable**. Keep GPL/LGPL as RequiresLegalReview. Fix root OPEN_SOURCE_POLICY bullet.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P15-7 | P1 | improvement | engines | NPSL treated as generic Allowed while redistributed in runner-agent
- **Persona:** Open Source Security Advocate
- **Evidence:** `toolchain.ts` nmap `license: "NPSL"`, `policyStatus: "Enabled"`, comment acknowledges modified-GPLv2-style notice obligations. `evaluateSimpleLicensePolicy` does not match NPSL → **Allowed**. `apps/runner-agent/Dockerfile` `apt-get install … nmap` and sets `PERISCAN_NMAP_RUNTIME=binary`. Modules still **Proprietary** (P15-1).
- **Problem:** NPSL is not a silent MIT equivalent; redistribution and commercial-use nuances need explicit disposition and notice packaging.
- **Impact:** Shipping nmap in the agent image without NPSL-specific disposition/notice checklist is a latent compliance miss.
- **Recommendation:** Add NPSL (and similar “not pure permissive”) pattern → `RequiresLegalReview` or `AllowedWithObligations` with mandatory notice bundle; document agent image redistribution; fix module license to NPSL.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** theme (prior OSS F3)

### FINDING | P15-8 | P1 | feature | engines | Engine Lab BYO license acceptance is plan-only; runtime is hard-deny with no accept path
- **Persona:** Open Source Security Advocate
- **Evidence:** `docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md` Phase 1: `ToolLicenseAcceptance`, `POST …/license-acceptances`, require acceptance before install for review tools. Grep shows **no** `license-acceptances` / `userLicenseAcceptanceRequired` in app code—only the plan. API `installThirdPartyTool` denies with “blocked or requires legal review” (`third-party-tools.ts` ~5498–5529). UI Install disabled when `LegalReviewRequired` (`tool-governance-marketplace.tsx`).
- **Problem:** Product strategy is “customer accepts upstream license → install from pin → verify.” Product reality is “Legal review tile, dead install, no ceremony.”
- **Impact:** Operators cannot lawfully expand depth for GPL engines the plan intends to support; pressure rises to bake binaries (P15-3) or fake Proprietary (P15-1).
- **Recommendation:** Implement Phase 0–1 before marketing Engine Lab: acceptance artifact, gate install on current pin+text hash, audit actor/time, then install/verify/enable. Keep Blocked (AGPL) non-installable.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme (Wave A license honesty)

### FINDING | P15-9 | P1 | improvement | engines | Catalog lacks integrity/upstream license URL fields required by Engine Lab Phase 0
- **Persona:** Open Source Security Advocate
- **Evidence:** Plan §6.5 requires `upstreamHomepage`, `upstreamLicenseUrl`, `releaseArtifact`/`imageDigest`, `expectedIntegrity`, `installRuntimes[]`, `userLicenseAcceptanceRequired`. `OpenSourceToolDefinition` / `toolchain.ts` have `docsUrl`/`gitRepo`/`dockerImage`/`defaultVersion` but not the integrity + license-URL acceptance fields; no cosign pin on install path for customer BYO.
- **Problem:** Without pins+integrity, “install from upstream” cannot be proven authentic; marketplace honesty fails under supply-chain scrutiny.
- **Impact:** Digest-mismatch “Installed” risk; weak provenance chain vs plan §6.2.
- **Recommendation:** Extend shared schema + toolchain for integrity fields; verify before enable; refuse install without expected digest for review tools.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P15-10 | P1 | bug | copy | Nuclei missing template name defaults to Periscan-branded string
- **Persona:** Open Source Security Advocate
- **Evidence:** `packages/modules/src/index.ts` nuclei evidence attributes: `templateName: finding.info.name ?? "Periscan Safe HTTP Fingerprint"`. Module otherwise correctly names Nuclei (`customerVisibleDescription`, `sourceVendor: "Nuclei"`, MIT license).
- **Problem:** Fallback invents a Periscan template brand when upstream omits `info.name`.
- **Impact:** Evidence/reports can look like proprietary templates rather than ProjectDiscovery/allowlisted profile content — soft rebrand of OSS template identity.
- **Recommendation:** Fallback to `template-id` only or `"Unknown template"`; keep profile name (`safe-baseline`) as separate field (already present).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme (prior OSS F2)

### FINDING | P15-11 | P1 | bug | engines | Module certification certifies dual-truth and does not fail on tool↔module license mismatch
- **Persona:** Open Source Security Advocate
- **Evidence:** `scripts/module-certification.ts` runs `evaluateLicensePolicy` on `manifest.license` only; checks `licenseRisk` matches that disposition. Adapter spec (`docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md` §3) states license is **“Upstream license string; evaluated by the license gate.”** Certification report marks GPL wrappers Certified/CertifiedWithWarnings as **Proprietary Allowed**.
- **Problem:** Certification is the program gate (`pnpm test:modules` / `modules:certify`) and currently rubber-stamps the dual-truth.
- **Impact:** “Certified module” claim is worthless for license integrity; auditors will dismiss the harness.
- **Recommendation:** Hard-fail when any `toolIds` entry’s license/policy disagrees with module license/licenseRisk; regenerate report after fix.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-18 (stale cert report theme; this is the license slice)

### FINDING | P15-12 | P2 | improvement | compliance | THIRD_PARTY_NOTICES is a license inventory table, not attribution notices
- **Persona:** Open Source Security Advocate
- **Evidence:** `licenses/THIRD_PARTY_NOTICES.md` generated structure: Policy Summary + three markdown tables (tools, modules, node deps). No copyright holders, no license text excerpts, no “this product includes software developed by…” lines, no link to full license texts for redistributed binaries (nmap, ProjectDiscovery tools in images).
- **Problem:** For OSS advocates and many enterprise counsel workflows, “notices” means attribution, not only SPDX inventory.
- **Impact:** Insufficient for redistribution of bundled binaries in scan-executor/runner-agent; weak response to upstream NOTICE obligations.
- **Recommendation:** Keep inventory tables; add section for **redistributed runtime binaries** with project name, copyright, SPDX, upstream URL, and license text path. Split first-party Proprietary modules from third-party table.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P15-13 | P2 | request | other | No root CONTRIBUTING.md or public OSS adapter contribution guide
- **Persona:** Open Source Security Advocate
- **Evidence:** No `CONTRIBUTING.md` at repo root (search). Extension path documented (`docs/EXTENSION_DEVELOPER_RUNBOOK.md`); tool intake via Registry Center APIs. Prior panel scored community CONTRIBUTING weak.
- **Problem:** Catalog of 50+ tools with no public “how to propose an engine without rebranding upstream” guide.
- **Impact:** External contributors (or design-partner engineers) invent metadata incorrectly — dual-truth will recur.
- **Recommendation:** Add short `CONTRIBUTING.md`: license field rules (SPDX from upstream only), no Proprietary for third-party tools, intake API path, certification checklist, Engine Lab acceptance model, link to adapter spec.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme (prior OSS F5)

### FINDING | P15-14 | P2 | improvement | gtm | Marketplace honesty: dual surfaces + legal-review dead-end without BYO story
- **Persona:** Open Source Security Advocate
- **Evidence:** UI `ToolGovernanceMarketplace`: title **“Runner package marketplace”**, copy says legal-review cannot be enabled. `registry-center.tsx` also frames **OSS Package Marketplace** with license search. Plan renames to **Operate → Engines** (Engine Lab) with license lanes (Permissive / BYO / Not available). Today: no lanes, no accept sheet, dual IA.
- **Problem:** Operators see a marketplace that cannot complete the purchase metaphor for the tools that most need governed install; dual homes risk attribution drift.
- **Impact:** Feature-zoo packaging; “marketplace” oversells admin governance; under-delivers Engine Lab honesty.
- **Recommendation:** Single marketplace home (`/engines`) with three license lanes; legal-review cards show **Review license & install** only after Phase 1; Blocked = Not available. Demote Registry Center to certification factory.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-03 / U-16 (surface zoo)

### FINDING | P15-15 | P2 | bug | ops | Module certification report is stale relative to module catalog growth
- **Persona:** Open Source Security Advocate
- **Evidence:** `docs/generated/module-certification-report.md` generated **2026-06-24**, **40 modules**. Current tree includes additional modules (e.g. endpoint analytics, DNS canary, sim packs). Prior panel U-18 (~40 vs ~71). License columns in stale report freeze dual-truth as historical truth for readers.
- **Problem:** Checked-in generated report used as proof of certification is out of date.
- **Impact:** Sales/audit packs may cite stale Certified Allowed for wrong licenses.
- **Recommendation:** Regenerate in `pnpm verify`; fail if report drift; or stop committing and generate in CI artifact only.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-18

### FINDING | P15-16 | P2 | bug | engines | Adapter contract text violated by current manifests
- **Persona:** Open Source Security Advocate
- **Evidence:** `docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`: `license` = “Upstream license string.” Many modules with third-party `toolName`/`toolIds` set Proprietary (nmap, sqlmap, ffuf, nikto, …). Spec also requires modules wrap tools without becoming product identity — license field is the metadata equivalent of rebrand.
- **Problem:** Spec vs implementation gap is documented “done” behavior in certification.
- **Impact:** New module authors copy Proprietary pattern from existing recon/web modules.
- **Recommendation:** Spec compliance test in certification; update examples in adapter spec with correct SPDX samples.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P15-17 | P2 | improvement | other | No repository root LICENSE clarifies Periscan product vs engine licenses
- **Persona:** Open Source Security Advocate
- **Evidence:** No `LICENSE` / `LICENSE.md` at repo root. Product is proprietary control plane (legitimate); engines are third-party. Notices exist under `licenses/` only.
- **Problem:** Without a clear product license file, outsiders and scanners mis-infer open-source product status or cannot separate first-party vs third-party.
- **Impact:** SBOM/tooling noise; contributor confusion; weaker separation story for “we don’t rebrand engines.”
- **Recommendation:** Add proprietary LICENSE (or BUSL/source-available if chosen) + README pointer: engines under their SPDX; product under LICENSE; notices under `licenses/THIRD_PARTY_NOTICES.md`.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P15-18 | P2 | improvement | copy | “Never raw tool branding as primary UX” over-read as erase-upstream risk
- **Persona:** Open Source Security Advocate
- **Evidence:** `docs/OPEN_SOURCE_VALIDATION_ENGINES.md` intro: customers never see raw tool branding as primary UX. Marketplace and module copy correctly name Gitleaks/Nuclei/Trivy. Adapter policy intent is “no raw JSON dump as product,” not “hide ProjectDiscovery.”
- **Problem:** Ambiguous policy language can drive future UI to strip attribution in the name of polish.
- **Impact:** Long-term rebrand risk if product designers follow engines doc literally.
- **Recommendation:** Rewrite to: “Primary UX is Periscan proof language; **always attribute** engine name + SPDX in module detail, evidence methodology, and Engine Lab cards.”
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** theme (prior OSS F4)

### FINDING | P15-19 | P2 | bug | security | ScoutSuite installed into default image despite RequiresLegalReview
- **Persona:** Open Source Security Advocate
- **Evidence:** `scan-executor.Dockerfile` `pipx install scoutsuite` + `PERISCAN_SCOUTSUITE_RUNTIME=binary`. Toolchain: ScoutSuite GPL-2.0 RequiresLegalReview; module `cloud.scoutsuite_posture` Proprietary Allowed.
- **Problem:** Same class as P15-3 but singular high-signal example: cloud posture GPL tool baked + module laundering.
- **Impact:** SaaS image ships GPL cloud auditor while governance denies enable — maximum dual-truth.
- **Recommendation:** Remove scoutsuite from default image; fixture/import-only until Engine Lab acceptance exists; fix module license to GPL-2.0 + RequiresLegalReview risk.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-04

### FINDING | P15-20 | P2 | improvement | engines | License summary API is inventory-only; no acceptance/obligation export for auditors
- **Persona:** Open Source Security Advocate
- **Evidence:** `getThirdPartyToolLicenseSummary` returns licenses map + `blockedLegalReview` list only (`third-party-tools.ts` ~5741–5767). Plan Phase 4: Trust & Safety export of acceptances for customer auditors.
- **Problem:** CISO/OSS review cannot export “who accepted which pin under which SPDX.”
- **Impact:** Enterprise RFP/OSS questionnaire gap; Engine Lab incomplete without audit export.
- **Recommendation:** After Phase 1 model, add acceptance export (CSV/JSON) with toolId, version, SPDX, text hash, actor, timestamp; surface in Trust pack.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P15-21 | P3 | improvement | copy | Toolchain notes sometimes over-claim breadth beyond liveSupported
- **Persona:** Open Source Security Advocate
- **Evidence:** e.g. Semgrep notes (“50k+ style rule-based exploits”), various recon notes with expansive ASV pillar lists while modules are fixture/NearTerm/legal-review.
- **Problem:** Catalog marketing color undermines careful fixture/legal-review honesty elsewhere.
- **Impact:** Soft honesty erosion; competitive reviewers quote notes as capability.
- **Recommendation:** Notes must mirror `policyStatus` + `liveSupported` + phase; move roadmap color to ROADMAP.md only.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** theme (prior OSS F7)

### FINDING | P15-22 | P3 | innovation | engines | Engine Lab license lanes + digest theater are the right productization of OSS respect
- **Persona:** Open Source Security Advocate
- **Evidence:** Plan §5 (one-button accept & install, license sheet, measured vs expected digest, Featured permissive row). Foundations exist: `tool-install.ts`, third-party-tools jobs, marketplace cards.
- **Problem:** Innovation is documented, not shipped; meanwhile anti-patterns (P15-1–3) fill the vacuum.
- **Impact:** Missing competitive story vs “we just bake Nuclei+everything”; missing ethical path for GPL depth.
- **Recommendation:** After Phase 0 metadata truth, ship Phase 1–2 as the **public OSS respect demo** for design partners. Measure: 100% review tools with acceptance before enable; 0 digest-mismatch Installed.
- **Effort:** XL
- **Zoo-related:** no
- **Previous-panel-link:** none

---

## Feature-zoo / IA notes (OSS lens)

| Action | Item |
| --- | --- |
| **Merge** | Tool Governance marketplace + Registry “OSS Package Marketplace” → **Engine Lab (`/engines`)** with license lanes |
| **Demote** | Registry Center → Admin / Engine certification only |
| **Rename** | “Runner package marketplace” → “Engines” / “Engine Lab” (plan) |
| **Cut from default images** | GPL/LGPL packages in scan-executor (testssl, sqlmap, nikto, whatweb, scoutsuite) until BYO path exists |
| **Do not cut** | Permissive pin set (gitleaks, nuclei, trivy, osv, prowler); fail-closed AGPL block; extension SPDX flow |
| **Hide until honest** | Any module card showing Proprietary for third-party toolName |

---

## Top 5 moves to reach 5.0

1. **Phase 0 truth (P15-1, P15-2, P15-4, P15-5, P15-11, P15-16):** Align every third-party module SPDX + derive `licenseRisk` from tools; hard-fail inventory + certification on mismatch; regenerate notices + cert report.  
2. **Stop shipping review-gated binaries by default (P15-3, P15-7, P15-19):** Strip GPL/LGPL from scan-executor; treat NPSL agent bundling as explicit obligation with notices.  
3. **Engine Lab Phase 1–2 (P15-8, P15-9, P15-14, P15-20, P15-22):** License acceptance, integrity pins, accept→install→verify→enable, auditor export, single marketplace.  
4. **Policy & copy alignment (P15-6, P15-10, P15-12, P15-18):** AGPL = Blocked everywhere; Nuclei fallback debrand; real attribution notices; “always attribute engines.”  
5. **Contributor hygiene (P15-13, P15-17, P15-15):** CONTRIBUTING + root LICENSE + fresh certification artifact in CI.

---

## Scorecard (this lens)

| Criterion | Score (0–5) | Notes |
| --- | ---: | --- |
| Written OSS policy exists | 4.0 | Strong docs; AGPL wording conflict |
| Fail-closed license CI (as designed) | 3.5 | Good for node/tools; blind to dual-truth |
| Module↔tool license integrity | **1.0** | Systemic Proprietary + Semgrep MIT |
| No redistribution of review-gated copyleft in default images | **1.5** | scan-executor/scoutsuite/nmap issues |
| Honest wrapping (Nuclei/Trivy/Gitleaks) | 4.0 | Excellent flagship; template fallback blemish |
| Notices quality | 2.5 | Inventory yes; attribution thin; dual tables |
| Marketplace / Engine Lab honesty | 2.5 | Plan strong; runtime dead-end for BYO |
| License risk gate accuracy | 2.0 | Tool layer OK; module layer launders |
| Contribution / CONTRIBUTING | 2.0 | Extensions strong; community docs weak |
| Engine Lab BYO readiness | 1.5 | Plan only |
| **Overall (this lens)** | **~2.8 / 5** | Aligns with prior ~7.3/10 ≈ 3.6/5 after weight of image+Semgrep findings |

---

## Prior-panel agreement / dissent

| Theme | Stance |
| --- | --- |
| U-04 module license dual-truth | **Agree — escalate** with Semgrep reverse dual-truth + cert/gate blind spots |
| Wave A “module licenses accurate” | **Agree — required before OSS credibility claims** |
| Prior OSS 7.3/10 | **Dissent slightly downward (~2.8/5)** after documenting image redistribution of GPL tools and MIT-labeled LGPL modules; architecture remains strong |
| Engine Lab plan | **Agree strongly** — correct remedy; Phase 0 is non-negotiable before UI theater |
| Connector/marketplace honesty culture | **Agree** — same honesty standard must apply to licenses as to Planned ≠ connectable |

---

## Bottom line

Periscan’s **architecture wants to be an OSS-respectful proof plane**: pin engines, normalize evidence, quarantine AGPL, refuse silent enable. The **implementation currently fails the OSS advocate’s first test of integrity** — **one license truth** — and occasionally **ships** what policy claims is only under legal review.

**Do not advertise “open-source validation engines with rigorous license governance” until P15-1 through P15-5 and P15-3 are fixed.** Then ship Engine Lab as the ethical expansion path, not as a second marketplace badge.

---

*End of P15 exhaustive audit — 22 findings.*
