# Periscan Tool Package Manager — Product & UX Plan

**Status:** Phase 0–2 partially shipped (2026-07-29) — Engine Lab UI v1, license acceptance, install-plan preview, enable-after-accept; Phase 3+ (runner install task, SSE theater) still open  
**Date:** 2026-07-29  
**Codename:** **Engine Lab** (primary rail name: **Engines**)  
**Depends on existing foundations:** Third-Party Tool Governance APIs, `packages/modules/src/tool-install.ts`, license inventory, Registry Center intake, runner dispatch eligibility  

---

## 1. Problem

Many best-in-class validation engines cannot ship **inside** Periscan images by default:

| Class | Examples | Why not bundled |
|-------|----------|-----------------|
| GPL / LGPL family | nmap, sqlmap, nikto, Semgrep (LGPL), FFmpeg, Ansible | Redistribution / viral obligations; policy `RequiresLegalReview` |
| Legal / safety gated collectors | SharpHound live, live Caldera/Atomic | Legal + destructive posture |
| Heavy / environment-specific | large Docker toolkits, GPU-adjacent (out of core ASV) | Size, support, customer infra |
| Catalog-only planned tools | 100+ ecosystem entries | Not yet certified, or partner-only |

**Today’s product honesty is right** (don’t redistribute / don’t enable silently), but the **experience is wrong**: operators see “Legal review / Not installed / Planned” without a delightful path to **I accept the license → install from upstream → verify → use**.

**Goal:** Make **customer-side, on-demand, verified upstream install** a **core product power feature** — not an admin afterthought — while Periscan **never** ships restricted binaries by default and **never** pretends a tool is ready without install + verify evidence.

---

## 2. Strategy (license + liability model)

### What Periscan ships

| Ship by default | Do not ship by default |
|-----------------|------------------------|
| Manifests, module adapters, parsers, redaction, safety metadata | GPL/LGPL/NPSL **binaries**, full git trees of restricted tools |
| Pinned **upstream coordinates** (repo URL, release tag, image digest, expected SHA-256, SPDX) | Arbitrary package names / URLs typed by users |
| Installer, verifier, license acceptance UI, audit trail | Legal advice that “you’re fine” |
| MIT/Apache engines we choose to bake into platform images | Tools with `Blocked` disposition (AGPL, SSPL, BSL) |

### What the customer does

1. **Chooses** a reviewed engine from Engine Lab.  
2. **Reads** upstream SPDX + Periscan plain-language summary + link to full license.  
3. **Accepts** “I am downloading from upstream under *their* license; Periscan is not redistributing this package as part of the SaaS binary.”  
4. **Installs** to an allowed target (platform worker cache, runner host, or tenant tool volume — see §5).  
5. **Verifies** digest / signature / version probe.  
6. **Enables** only after verify succeeds (and other safety gates pass).

### Non-goals

- User-typed `curl | bash` or arbitrary Docker Hub names.  
- Bypassing module certification (parser, safety level, evidence mapping).  
- Turning Periscan into unrestricted offensive kit download center.  
- Auto-enabling tools after install without human enable (and policy).  
- Claiming Periscan “includes” GPL tools in the product SBOM as redistributed code.

---

## 3. Current foundation (build on, don’t rewrite)

Already real in tree:

| Layer | What exists | Gap vs vision |
|-------|-------------|----------------|
| Policy | `RequiresLegalReview` / `Blocked` / `Allowed`; CI license gates | No first-class **tenant license acceptance** artifact with UX |
| Catalog | Open-source tool definitions + module manifests | License dual-truth (panel finding); fix metadata |
| Install engine | `tool-install.ts` — docker / git / pip plans, redacted output | Not marketed as product; limited progress UX |
| API | `/third-party-tools/:id/{check,install,enable,disable,jobs,licenses}` + intake/promotion | No accept-license step; weak real-time install progress |
| UI | `ToolGovernanceMarketplace` — cards, Check / Install / Enable | Feels admin/ops, not “sexy package manager”; buried under Operate |
| Registry Center | Intake, candidates, work orders, certifications | Platform-eng workflow, not Monday install experience |

**Principle:** Elevate install/verify/enable into **Engine Lab**, keep Registry Center as **platform engineering / certification factory**.

---

## 4. Product concept — Engine Lab

### Positioning line

> **Add proof engines the same way you add apps — one click, upstream authenticity, your license, our safety gates.**

### Primary nav

| Maturity | Placement |
|----------|-----------|
| New / Activating | Soft entry from empty “engine missing” states on modules/missions |
| Operating | **Operate → Engines** (rename/replace “Tool Governance” primary label) |
| Advanced | Registry Center remains for propose-new-tool / certification |

### Mental model (three layers)

```text
┌─────────────────────────────────────────────────────────────┐
│  ENGINE LAB (product)                                       │
│  Browse · License · Install · Verify · Enable · Use         │
└───────────────────────────┬─────────────────────────────────┘
                            │ uses
┌───────────────────────────▼─────────────────────────────────┐
│  INSTALLER CORE (platform)                                  │
│  Allowlisted plan · pull from upstream · digest verify ·    │
│  job ledger · runner/control-plane placement                │
└───────────────────────────┬─────────────────────────────────┘
                            │ feeds
┌───────────────────────────▼─────────────────────────────────┐
│  CERTIFIED MODULES (execution)                              │
│  Policy · mission · evidence · Fixed honesty                │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Sexy, modern UX (easy-button)

### 5.1 Hero: “One-button install”

Not a form. A **device-like card** with motion and state:

```
┌──────────────────────────────────────────────┐
│  ◆  nmap                          GPL-2.0    │
│  Network discovery (passive-first profiles)  │
│                                              │
│  ████████████░░░░  68%  Verifying digest…    │
│                                              │
│  Upstream  nmap.org  ·  pin 7.95  ·  sha…    │
│                                              │
│  [ Accept license & install ]                │
│   or  Installed · Verified · Enable →        │
└──────────────────────────────────────────────┘
```

**States (animated, single primary CTA):**

| State | Primary CTA | Subtext |
|-------|-------------|---------|
| Available | **Accept license & install** | Opens license sheet first |
| Awaiting acceptance | **Review license** | Blocks install |
| Installing | Progress ring + cancel (if safe) | Live job log (redacted) |
| Verifying | Progress | SHA-256 / version probe |
| Verified | **Enable for tenant** | Optional “Run smoke check” |
| Enabled | **Use in mission** | Deep-link modules that need it |
| Failed | **Retry** / **View diagnosis** | Honest error, no fake success |
| Blocked (AGPL etc.) | Disabled + “Not available” | No install path |
| Needs certification | **Request engine** | Intake candidate, not install |

### 5.2 License sheet (the legal “easy button” that is still serious)

Modal / drawer, not a 40-page wall:

1. **Big SPDX badge** + upstream project name  
2. **Plain language** (templated per disposition):  
   - *“This tool is not redistributed by Periscan. Installing downloads it from the project’s official release under GPL-2.0. You accept that license for your organization.”*  
3. **Links:** full license text (upstream), security policy, Periscan safety class  
4. **Checkbox:** “I am authorized to accept third-party open-source licenses for this tenant.”  
5. **Record:** who accepted, when, toolId, version pin, digest, IP/session — **audit event**  
6. **Then** install starts — never install before acceptance for `RequiresLegalReview` tools  

Permissive tools may still show a short notice (“Apache-2.0 · included or cached by platform”) without the heavy acceptance flow.

### 5.3 Marketplace home (delight)

Inspired by best app stores / Raycast / Linear — not ServiceNow.

| Element | Behavior |
|---------|----------|
| **Search** | Instant filter by name, capability, ATT&CK, license |
| **Pills** | Ready · Needs install · License action · Runner-only · Control-plane |
| **Featured row** | “Most used for first proof loop” (Nuclei safe, Trivy, Gitleaks, …) |
| **License lanes** | Permissive (platform-ready) · Bring-your-own-license (install) · Not available |
| **Depth meter** | Visual: Catalog → Certified → Installed → Verified → Enabled → Proved (last run) |
| **Empty → install path** | From mission/module “Runtime missing” → deep-link to this card with CTA preselected |
| **Dark glass cards** | Match Periscan design system; soft aurora on hover; no badge soup |

### 5.4 Install theater (trust through visibility)

Full-screen **install sheet** (still one flow):

1. Resolve plan (docker pull / git clone pin / pip pin) — show **displayCommand** (no secrets)  
2. Stream job phases: Queued → Downloading → Extracting → Verifying → Ready  
3. Show **expected digest** then **measured digest** (match = green check)  
4. Version probe output (redacted, truncated)  
5. Celebrate enable (subtle) + “Add to next mission”  

Failures: specific (digest mismatch, network, disk, policy deny) — never “success” with failed verify.

### 5.5 Where it surfaces (product-wide)

| Surface | Integration |
|---------|-------------|
| Mission / module picker | “Install engine” chip when runtime missing |
| Attack path hop plan | Module needs tool → Engine Lab deep link |
| External validation | Already allowlisted; link related engines |
| Runner fleet | “Install on runner” placement when capability is InternalRunner |
| Getting started | Optional step: “Add one depth engine” after first snapshot |
| Command palette | `Install engine…` |

---

## 6. Architecture

### 6.1 Install targets (placement)

| Placement | Use | Who runs install |
|-----------|-----|------------------|
| **Control-plane worker cache** | SaaS-side docker/git for ExternalPoA / ServiceDirect | Platform worker job |
| **Internal Runner host** | Customer-network tools | Signed runner task: install plan only from allowlist |
| **Shared platform image (optional)** | Permissive tools only | Deploy-time bake, not customer click |

Customer click must **never** mean “upload random binary to SaaS for others.” Installs are **tenant-scoped records**; multi-tenant SaaS must isolate caches by tenant or use digest-addressed shared content-store with tenant enablement only.

### 6.2 Provenance chain (real-first)

```text
Catalog pin
  → upstream URL + version + expectedSha256 (and/or cosign/sigstore when available)
  → install job
  → measuredSha256 + installedVersion + runtimeKind
  → verify job (probe --version / module smoke fixture)
  → licenseAcceptanceId
  → enablement
  → mission/module execution eligibility
```

Any break in the chain → **NotReady**, not “Installed.”

### 6.3 API additions (thin, on top of existing)

Existing: check, install, enable, disable, jobs, licenses.

**Add:**

| Endpoint | Purpose |
|----------|---------|
| `POST .../license-acceptances` | Record acceptance (toolId, version, SPDX, text hash, actor) |
| `GET .../license-acceptances` | List for audit / Trust & Safety |
| `GET .../:toolId/install-plan` | Preview plan without executing (for UI theater) |
| `GET .../jobs/:jobId` or SSE/poll | Rich phase progress for sexy UI |
| `POST .../:toolId/verify` | Explicit verify after install (digest + smoke) |
| `GET .../marketplace` | Curated view model: featured, lanes, depth meters (or client-compose) |

**Hard rules (unchanged + strengthened):**

- Reject non-allowlisted artifacts  
- Install does not enable  
- Enable does not queue missions  
- Legal-review tools require **current** acceptance for pin version  
- Blocked tools never install  
- All steps audited  

### 6.4 Installer core enhancements

Evolve `tool-install.ts` / worker:

1. **Digest-first verify** for git tarballs / release assets / image digests  
2. **Optional cosign** for tools that publish signatures  
3. **Runner install agent** capability: signed task type `ToolInstall` with local path sandbox  
4. **Idempotent re-verify** without re-download when digest matches  
5. **Uninstall / purge** (tenant cache only) for disk hygiene  

### 6.5 Catalog metadata fixes (prerequisite)

Panel P0: stop labeling GPL engines as `Proprietary` in module manifests.  
Each installable engine must have:

- accurate SPDX  
- `upstreamHomepage`, `upstreamLicenseUrl`  
- `releaseArtifact` or `imageDigest`  
- `expectedIntegrity`  
- `installRuntimes[]`  
- `userLicenseAcceptanceRequired: boolean`  

---

## 7. Safety & product rules (non-negotiable)

Aligned with AGENTS.md / SECURITY_BOUNDARIES:

1. Install ≠ execute validation against customer targets.  
2. Enable still subject to module safety, verified scope, policy decision.  
3. No SharpHound/Caldera/Atomic **live** just because installed — live remains separately gated.  
4. Denied tools never queued.  
5. Raw install logs redacted; no secrets in UI.  
6. Real-first: UI status only from job/verify records.  
7. Multi-tenant isolation of enablement and (where applicable) install cache.  

---

## 8. Information architecture

### Rename / restructure

| Today | Tomorrow |
|-------|----------|
| Operate → Tool Governance / Runner package marketplace | **Operate → Engines** (Engine Lab) |
| Registry Center (heavy intake) | **Admin → Engine certification** (platform eng) |
| Scattered “runtime missing” | Unified deep link ` /engines?tool=nmap&action=install` |

### Route proposal

- `/engines` — marketplace home (sexy)  
- `/engines/[toolId]` — detail: license, pins, jobs, modules unlocked, runner eligibility  
- Keep `/registries` for intake/candidates/work orders  

---

## 9. Delivery phases

### Phase 0 — Truth & metadata (1–2 days) — **partially shipped 2026-07-29**

- Fix module/tool license dual-truth (**shipped**: derived SPDX from primary tool; `licenseRisk` from tool disposition)  
- Catalog fields: optional `licenseUrl` + `integrityDigest` on tool definitions and install-plan API (**shipped schema**; populate digests as pins are reviewed — omit rather than invent)  
- Product copy: “not redistributed by default” (**shipped** on Engine Lab + install-plan)

### Phase 1 — License acceptance + verify productization (3–5 days)

- Persistence model `ToolLicenseAcceptance`  
- API accept + require before install for review tools  
- Explicit **Verify** step after install; gate enable on Verified  
- Tests: no install without acceptance; digest mismatch fails  

### Phase 2 — Engine Lab UI v1 (1 week)

- New `/engines` marketplace home (design-system, motion, lanes)  
- One-button flow: Accept → Install → Verify → Enable  
- Job progress UI (poll first; SSE later)  
- Deep links from module NotReady states  
- Component + Playwright: happy path + deny path  

### Phase 3 — Runner placement + install theater (1–2 weeks)

- Runner `ToolInstall` signed task  
- Placement picker: control plane vs selected runner pool  
- Full install sheet with phase animation  
- Uninstall / re-verify  

### Phase 4 — Marketplace growth loop (ongoing)

- Featured collections (“First proof week”, “Cloud posture”, “Web safe”)  
- “Request engine” → existing intake (no fake install)  
- Update recommendations with one-click re-accept if license text hash changed  
- Trust & Safety export of acceptances for customer auditors  

### Phase 5 — Polish / delight

- Command palette, empty-state illustrations, success confetti restraint  
- Mobile install status  
- Accessibility: focus trap on license sheet, live regions for progress  

---

## 10. Success metrics

| Metric | Target |
|--------|--------|
| Time from “runtime missing” → Verified install | &lt; 5 min for docker-pullable pins |
| % legal-review tools with recorded acceptance before enable | 100% |
| Digest mismatch false “Installed” | 0 |
| Install success rate (allowlisted) | &gt; 95% in lab |
| Operator NPS on Engine Lab (design partners) | Qualitative “easy button” |
| No redistribution of GPL blobs in default images | Done for scan-executor default `runtime` (smoke asserts absence of testssl/sqlmap/nikto/whatweb/scout); optional `runtime-legal-review` + compose profile `legal-review-tools` for lab; expand CI gate as Engine Lab ships |

---

## 11. Competitive angle

| Alternative | Periscan Engine Lab |
|-------------|---------------------|
| Bake everything into the image | Customer installs restricted engines; clean default SBOM |
| “Download our fork of nmap” | Upstream authenticity + digest verify |
| Silent auto-enable | Explicit enable + policy |
| Admin YAML package lists | App-store grade UX for security operators |

**Story for CISO:** *We don’t force GPL into our cloud image. Your team installs what you accept, we prove integrity, and we still refuse unsafe execution.*

---

## 12. Open decisions (need product call)

1. **Shared vs tenant-private caches** for identical digests on multi-tenant SaaS (cost vs isolation).  
2. **Whether permissive tools stay one-click without acceptance** (recommend: yes, short notice only).  
3. **Self-hosted / air-gap:** offline bundle import of **pre-approved** digests only (future).  
4. **Who can accept licenses:** Owner/Admin only vs SecurityEngineer (recommend Owner/Admin + optional SecurityEngineer with audit).  

---

## 13. Implementation map (first PR cut)

| PR | Deliverable |
|----|-------------|
| A | Schema `ToolLicenseAcceptance` + API + require on install for review tools |
| B | `verify` endpoint + enable gate on Verified |
| C | Catalog integrity fields + license metadata fix |
| D | `/engines` UI: card grid + license sheet + install/verify/enable flow |
| E | Module NotReady → deep link  
| F | Runner install task (optional after D) |

---

## 14. Design keywords for implementation agents

- **App store for proof engines**, not Jira for tools  
- One primary button per state  
- License is a **ceremony**, not a wall  
- Progress is **visible trust**  
- Failure is **honest and recoverable**  
- Catalog is **curated**, not the open internet  
- Install is **customer-side license assumption** + **Periscan safety still applies**  

---

## 15. Summary

Periscan already has the **bones** of a governed installer. The product move is to make **Engine Lab** the **core, sexy package manager**:

- Restricted-license tools are **not** packaged by default.  
- Operators **click**, **accept upstream license**, **install from official pins**, **verify integrity**, **enable** under policy.  
- That expands the validation ecosystem like a marketplace without violating open-source redistribution rules or safety floors.

**Next step after plan approval:** implement Phase 0–2 (metadata truth + acceptance + Engine Lab UI v1) with a design QA pass on the install sheet.
