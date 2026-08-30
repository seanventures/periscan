# Panel audit — Open Source Security Advocate

**Date:** 2026-07-29  
**Persona:** Open Source Security Advocate  
**Scope:** Honesty of OSS tool wrapping, license policy, attribution, anti-rebranding (Nuclei/Trivy/etc. not sold as proprietary magic), contribution/extensibility (MCP, extensions, operators)  
**Mode:** Read-only code and doc review (no product code changes)  
**Workspace:** `/Volumes/DataSSD1/test/periscan`  
**Related inventory:** [SURFACE_INVENTORY.md](./SURFACE_INVENTORY.md)

---

## Executive verdict

Periscan’s **policy story is strong and mostly honest**: OSS tools are framed as internal validation engines behind adapter modules, licenses are inventoried and CI-gated, GPL/AGPL families are review-blocked when correctly labeled, and customer-facing marketplaces generally show **real upstream names + SPDX-ish license strings** rather than inventing “Periscan Scanner™” clones of Nuclei/Trivy.

The **material integrity failure** for an OSS advocate is **dual license truth**: many modules that wrap third-party tools declare `license: "Proprietary"` on the module manifest while the tool catalog correctly records MIT/Apache/NPSL/GPL. That launders copyleft tools into `licenseRisk: Allowed` at the module layer and misrepresents provenance in `licenses/THIRD_PARTY_NOTICES.md` “Periscan Module License Metadata.”

| Dimension | Score (0–10) | Weight | Weighted |
| --- | ---: | ---: | ---: |
| Policy & governance narrative | 8.5 | 15% | 1.28 |
| License inventory / CI enforcement | 8.0 | 20% | 1.60 |
| Honest wrapping (Nuclei/Trivy/Gitleaks) | 8.0 | 20% | 1.60 |
| Module↔tool license attribution integrity | 4.0 | 20% | 0.80 |
| No proprietary rebrand / raw-tool-as-product | 8.0 | 10% | 0.80 |
| Extensibility (MCP / extensions / operators) | 8.0 | 15% | 1.20 |
| **Overall** | | | **~7.3 / 10** |

**Ship posture (OSS honesty):** Conditional — core engines (Gitleaks, Nuclei, Trivy, OSV, Prowler) are attributed well; fix module-manifest license dual-truth before claiming best-in-class OSS governance.

---

## Evidence base (what was reviewed)

| Area | Paths |
| --- | --- |
| Policy | `OPEN_SOURCE_POLICY.md`, `docs/OPEN_SOURCE_POLICY.md`, `docs/OPEN_SOURCE_LICENSE_POLICY.md`, `docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`, `docs/OPEN_SOURCE_VALIDATION_ENGINES.md` |
| Notices | `licenses/THIRD_PARTY_NOTICES.md` |
| Toolchain / modules | `packages/modules/src/toolchain.ts`, `packages/modules/src/index.ts`, `packages/modules/src/extension-sdk.ts` |
| License gate | `scripts/license-inventory.ts`, `tests/license/` |
| Governance UI | `apps/web/src/components/tool-governance-marketplace.tsx`, `registry-center.tsx` |
| Extensions | `docs/EXTENSION_DEVELOPER_RUNBOOK.md`, `apps/api/src/services/extensions.ts`, `extension-developer-studio.tsx` |
| MCP | `apps/web/app/mcp/page.tsx`, `mcp-console.tsx`, `apps/api/src/services/mcp.ts`, `/mcp` routes in `app.ts` |
| Operators | `packages/operators/src/index.ts`, `apps/web/src/components/operators-workbench.tsx` |
| Reports UX | `packages/reports/src/index.ts` (raw tool out of primary report) |

---

## What is working (keep)

### 1. Explicit “engines, not product identity” policy

Root and docs policies state that open-source software is used as **internal validation engines**, not as the customer-facing product identity. Rules require module manifests, safety levels, parsers, redaction, fixture tests, normalized evidence, and **no raw tool output as primary UX**.

```1:13:OPEN_SOURCE_POLICY.md
# Periscan Open Source Policy

Periscan uses open-source tools internally as validation engines. The customer-facing product remains Periscan's control plane, evidence model, policy system, and report experience.
// ...
- Raw tool output must not become the primary user experience.
```

Reports reinforce the same boundary (evidence IDs / normalized detail; raw tool output appendix-only).

### 2. Honest catalog naming for flagship tools

`OPEN_SOURCE_TOOL_DEFINITIONS` attributes engines with real `displayName`, `license`, `gitRepo`, `docsUrl`, pinned versions, and docker images — e.g. **Gitleaks** (MIT), **Nuclei** + **Nuclei Templates** (MIT), **Trivy** (Apache-2.0). Notes describe safe profiles and supply-chain pinning rather than claiming exclusive invention.

The runner package marketplace UI surfaces **upstream display names and license badges**, not rebranded product titles:

- Title: tool `displayName`
- Badge: tool `license`
- Body: tool `notes`
- Governance: legal-review / blocked cannot be enabled client-side; API remains final gate

### 3. Nuclei / Trivy wrappers name the upstream engine

Module customer-facing copy and summaries **name Nuclei and Trivy**, e.g. nuclei:

- `customerVisibleDescription`: “Runs allowlisted **safe Nuclei templates**…”
- Summary strings: “Nuclei identified …”
- Parser IDs: `periscan.nuclei.safe.v1`, `periscan.trivy.repo.v1`

That is the correct OSS-advocate position: wrap and govern, **do not erase** the engine.

Missing runtimes return structured unavailable / configuration states rather than fabricating findings (adapter contract + validation engines doc).

### 4. License policy with fail-closed CI

`docs/OPEN_SOURCE_LICENSE_POLICY.md` + `scripts/license-inventory.ts`:

| Disposition | Meaning |
| --- | --- |
| Allowed | Permissive / compatible |
| RequiresLegalReview | Non-permissive but quarantined (`policyStatus` + not enabled) |
| Blocked | CI fails (AGPL, SSPL, Commons Clause, unknown, etc.) |

Commands: `pnpm licenses:check`, `pnpm licenses:write` → `licenses/THIRD_PARTY_NOTICES.md`.  
Policy also calls out **MISP AGPL blocked**, **SharpHound GPL legal-review**, **Caldera/Atomic live adversarial disabled by default**.

Tool governance maps `RequiresLegalReview` → `LegalReviewRequired` and refuses enablement with an explicit reason.

### 5. Governance / intake does not pretend intake is execution

Third-party tool intake, candidates, work orders, and promotion packages are documented and implemented as **planning / certification artifacts** — not silent install or enable. That is good OSS-supply-chain hygiene and good honesty toward operators.

### 6. Extensions: SPDX, signed OCI, execution not implied

Extension developer program requires SPDX license on project create, hashed scaffold, digest-pinned images, local signing, compatibility checks, human certify/activate, and **`executionAuthorized: false`** on every persisted release (API + DB constraint). Runbook states catalog activation ≠ runner authority. This is a model contribution path for **tenant adapters** without claiming arbitrary third-party code is now “Periscan proprietary core.”

### 7. MCP: read-only, tenant-scoped, audited

`/mcp` exposes **read-only** tools over streamable HTTP JSON-RPC, Bearer tenant API keys, and activity derived from audit. UI copy is clear: query posture, **never mutate or cross tenant**. That is a legitimate open integration surface without turning MCP into a free exploit bus.

### 8. Operators: propose, don’t self-execute

Operators package proposes evidence-backed recommendations and mission plans; UI states they are **never self-executing** and require approval. Extends product without presenting autonomous red-team magic.

---

## Findings (ordered by severity)

### F1 — P0: Module manifests mislabel third-party engines as `Proprietary`

**Where:** `packages/modules/src/index.ts` module `license` fields; reflected in `licenses/THIRD_PARTY_NOTICES.md` “Periscan Module License Metadata.”

**Examples (tool catalog vs module):**

| Module | toolName | Module `license` | Tool catalog license (toolchain) |
| --- | --- | --- | --- |
| `recon.host_discovery` / `recon.service_inventory` | nmap | **Proprietary** | NPSL |
| `web.sqli_probe` | sqlmap | **Proprietary** | GPL-2.0 (legal review at tool) |
| `web.tls_audit` | testssl | **Proprietary** | GPL-2.0 (legal review) |
| `web.nikto_scan` | nikto | **Proprietary** | GPL-2.0 (legal review) |
| `web.fingerprint` | whatweb | **Proprietary** | GPL-3.0 (legal review) |
| `cloud.scoutsuite_posture` | scoutsuite | **Proprietary** | GPL-2.0 (legal review) |
| `recon.subdomain_enum` | subfinder | **Proprietary** | MIT |
| `recon.http_probe` | httpx | **Proprietary** | MIT |
| `recon.dns_probe` | dnsx | **Proprietary** | MIT |
| `web.content_discovery` | ffuf | **Proprietary** | MIT |
| `identity.cred_spray` | netexec | **Proprietary** | BSD-2-Clause |
| `exploit.metasploit_check` | metasploit | **Proprietary** | BSD-3-Clause |
| `identity.kerberos_userenum` | kerbrute | **Proprietary** | MIT |

**Why it matters:**

1. **Attribution lie** — wrapping MIT/Apache/GPL tools while publishing module license “Proprietary” reads as rebranding the *license posture*, even if the marketplace shows the tool license separately.
2. **Policy bypass vector** — `deriveLicenseRisk()` keys only off **module** `license`. `"Proprietary"` → `Allowed`. Copyleft tools that are correctly `RequiresLegalReview` at the tool layer still appear **Allowed** on the module layer and in module-notice tables.
3. **Notices dual truth** — toolchain table can say GPL/NPSL while module table says Proprietary for the same engine name.

**Contrast (correct):** `nuclei.external_exposure_safe` → MIT; `trivy.*` → Apache-2.0; `gitleaks.repo_secrets` → MIT; first-party `periscan-*` probes → Proprietary (legitimate).

**Recommendation:**

- Module `license` must be the **upstream tool SPDX/id string** (or multi-license expression) for any module with non-empty third-party `toolIds`.
- Add certification / unit gate: `module.license` must match primary tool definition license when `toolIds` resolves.
- Prefer deriving module license from toolchain if not overridden for multi-tool packs.
- Regenerate `THIRD_PARTY_NOTICES.md` after fix.

---

### F2 — P1: Fallback template naming can Periscan-brand upstream Nuclei templates

In nuclei evidence attributes:

```8090:8092:packages/modules/src/index.ts
          templateId: finding["template-id"],
          templateName: finding.info.name ?? "Periscan Safe HTTP Fingerprint",
          templateProfile: target.templateProfile ?? "safe-baseline"
```

If upstream omits `info.name`, the default **“Periscan Safe HTTP Fingerprint”** can look like a proprietary template brand. Prefer neutral fallbacks (`Unknown template`, or template-id only) and keep allowlisted profile names separate from upstream template identity.

---

### F3 — P1: NPSL treated as generic Allowed; no special disposition

Nmap is correctly documented in toolchain comments as **Nmap Public Source License** (modified GPLv2-style obligations). `evaluateLicensePolicy` does not specially classify NPSL; it falls through to Allowed. Notices track the string, which is good, but redistribution/notice obligations for shipping Nmap in a commercial runner image deserve an explicit disposition (Allowed-with-obligations or RequiresLegalReview) rather than silent “everything else.”

---

### F4 — P2: Product language tension — “no raw branding” vs attribution

Adapter/policy text says product-facing copy should avoid raw tool branding as **headline** UX; validation engines doc says customers never see raw tool branding as primary UX. Marketplace and module descriptions **do** name Gitleaks/Nuclei/Trivy/ZAP/Syft/Cosign in operator help and packs.

**OSS advocate view:** Naming engines is **required** for honesty. The intended distinction is “don’t dump raw Nuclei JSON as the product,” not “hide ProjectDiscovery.” Keep naming engines; tighten copy to “normalized Periscan capability powered by \<Tool\> under \<License\>.”

---

### F5 — P2: External contribution path is tenant-extension, not community OSS

There is a solid **signed extension** lifecycle and OSS tool **intake backlog**, but no root `CONTRIBUTING.md` for upstream-style community module PRs. Operators are in-product specialist profiles, not an open operator plugin SDK. For an OSS advocate scorecard of “extensibility,” MCP + extensions are real; **public contribution docs** are thin relative to the size of the tool catalog.

---

### F6 — P2: Marketplace framing is honest but dual-homed

- `/packs` (and related governance UI): “Runner package marketplace” / governed open-source engines.
- `/registries` registry center: “OSS Package Marketplace” with search by license.

Honesty is good. Dual surfaces increase risk of one path lagging attribution (e.g. modules list showing Proprietary while packages show MIT). Prefer a single license field sourced from tool definitions in all UIs.

---

### F7 — P3: Catalog notes sometimes over-claim roadmap color

Some toolchain `notes` lean marketing (“50k+ style evolving templates,” broad ASV pillar lists). Not license fraud, but dilutes the otherwise careful “fixture / dry-run / legal-review” honesty. Prefer readiness-accurate notes aligned with `liveSupported` / `policyStatus`.

---

## Dimension deep dives

### A. Honesty of OSS tool wrapping

| Check | Result |
| --- | --- |
| Real binaries/images for current engines | Yes (gitleaks, nuclei, trivy docker/binary prefs) |
| Fixture-only when live unsupported | Yes for grype sim, several identity/web legal-review paths |
| Unavailable runtime honesty | Contract + implementation pattern present |
| Parser / redaction / evidence types | Manifest-required; certification harness |
| Safe Nuclei profiles only | Documented + module capability IDs for safe profiles |
| Rebrand as proprietary scanner product | **No** for flagship tools; **license dual-truth is the residual rebrand** |

### B. License policy

| Check | Result |
| --- | --- |
| Written policy | Strong (root + docs + license policy) |
| Generated notices | Present; CI staleness gate |
| AGPL/unknown block | Implemented |
| GPL legal-review quarantine | Implemented at **tool** governance |
| Module license consistency | **Fail** (F1) |
| Extension SPDX | Required on project create |

### C. Attribution

| Surface | Attribution quality |
| --- | --- |
| Tool cards | High (name, license, notes) |
| Module API/UI descriptions (Nuclei/Trivy/Gitleaks) | High |
| Module license field (recon/web/identity packs) | **Poor** (Proprietary) |
| THIRD_PARTY_NOTICES tool table | Good |
| THIRD_PARTY_NOTICES module table | **Polluted** by F1 |
| Reports primary UX | Correctly de-emphasizes raw dumps (not the same as hiding names) |

### D. MCP / extensions / operators (contribution & extensibility)

| Surface | Openness | Guardrails | Honesty |
| --- | --- | --- | --- |
| MCP | Connect any MCP client | Read-only, tenant key, audit | High |
| Extensions | Tenant developer studio + runbook | Sign, digest pin, certify, `executionAuthorized: false` | High |
| Operators | Profiles + approve recommendations | Evidence required, no self-exec | High |
| Tool intake | Candidate backlog | Non-executing certification | High |
| Community CONTRIBUTING | Weak | n/a | Gap |

---

## Scorecard (detailed)

| Criterion | Score | Notes |
| --- | ---: | --- |
| Written OSS policy exists and matches architecture | 9 | Dual docs; slight root vs docs duplication |
| Fail-closed license CI | 8 | Solid; module Proprietary weakens meaning of notices |
| Tool catalog attribution (name/URL/license/version) | 9 | Exemplary for Nuclei/Trivy/Gitleaks |
| Module license matches upstream | 3 | Systemic Proprietary mislabels |
| No proprietary rebrand of engines | 8 | Marketplace good; F1 + template fallback |
| Raw output not primary product | 9 | Policy + reports + findings copy |
| Legal-review tools not tenant-enabled | 8 | Governance paths present |
| MCP openness with safety | 8 | Read-only scope is right |
| Extension program completeness | 8 | Excellent governance; not runtime yet by design |
| Operator honesty (no magic autonomy) | 8 | Evidence + approval model |
| Community contribution docs | 5 | Extension runbook only |
| NPSL / special licenses handled | 6 | Tracked string; no special disposition |

---

## Recommended remediation backlog

1. **P0 — License dual-truth fix**  
   - Align all third-party-backed module `license` fields with `OPEN_SOURCE_TOOL_DEFINITIONS`.  
   - Certify mismatch as failure in `pnpm test:modules` / `module-certification`.  
   - `pnpm licenses:write` and commit notices.

2. **P1 — Derive `licenseRisk` from tool policy when toolIds present**  
   - If any linked tool is `RequiresLegalReview` or license is GPL-family, module must not report Allowed solely because adapter is “Proprietary.”

3. **P1 — Nuclei template fallback naming**  
   - Stop defaulting missing template names to Periscan-branded strings.

4. **P2 — NPSL disposition**  
   - Document redistribution obligations for runner images shipping nmap; optionally force legal-review or notice packaging checklist.

5. **P2 — Attribution line in module UI**  
   - Always show `toolName` + catalog license next to module name in registries/modules list (single source of truth).

6. **P2 — CONTRIBUTING / OSS adapter guide**  
   - Public short guide: how to propose a tool (intake API), how licenses are evaluated, how not to rebrand upstream in customerVisibleDescription.

7. **P3 — Tone down catalog notes** that claim breadth beyond `liveSupported` / phase.

---

## Persona conclusions

As an Open Source Security Advocate I would **defend Periscan in a public forum** on:

- Not selling a thin Nuclei/Trivy skin as secret proprietary scanning magic;
- Publishing tool licenses and third-party notices;
- Blocking AGPL and quarantining GPL collectors like SharpHound;
- Offering governed extensibility (MCP read-only, signed extensions, operator approvals).

I would **challenge Periscan** hard on:

- Module metadata that calls nmap/sqlmap/ffuf/etc. **Proprietary** — that is the kind of error that loses community trust faster than any marketing claim;
- Notices tables that disagree with themselves across tool vs module sections;
- Missing automated invariant that would have caught F1 on day one.

**Bottom line:** Architecture and flagship wrappers are OSS-respectful. **Repair module license attribution before marketing “open validation engines” as a compliance differentiator.**

---

## Appendix — Quick reference commands / APIs

| Concern | Surface |
| --- | --- |
| List tools | `pnpm tools:list`, `GET /api/v1/open-source-tools` |
| Capabilities | `GET /api/v1/open-source-capabilities` |
| Modules | `GET /api/v1/modules` |
| Governance | `GET /api/v1/third-party-tools`, licenses summary |
| License CI | `pnpm licenses:check`, `pnpm licenses:write` |
| MCP UI | `/mcp` |
| Operators UI | `/operators` |
| Registries / OSS marketplace | `/registries` |
| Packs / runner marketplace | `/packs` (ToolGovernanceMarketplace + ExtensionDeveloperStudio) |
| Extension runbook | `docs/EXTENSION_DEVELOPER_RUNBOOK.md` |

---

*End of panel report 15 — Open Source Security Advocate.*
