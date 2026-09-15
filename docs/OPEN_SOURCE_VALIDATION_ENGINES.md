# Open Source Validation Engines

Periscan uses open-source security tools as **internal validation engines**, wrapped
behind a Periscan-owned adapter framework. Open-source tools are infrastructure for
measured proof, not a rebrand of upstream projects.

**Primary UX is Periscan proof language** (validated exposure, paths, controls, fix
verification, evidence packs). **Always attribute** the engine name and SPDX license
in module detail, evidence methodology, Engine Lab cards, and third-party notices.
Do **not** present raw scanner JSON dumps or unparsed tool output as the product
experience — that is the “no raw output as primary UX” rule, not “hide ProjectDiscovery
/ Gitleaks / Trivy.” Upstream names must remain visible wherever provenance matters.

**Competitive moat (P19-16):** The anti-Nuclei-SaaS story is **governance + proof SLAs** —
policy-gated install/verify/enable, certification, redaction, evidence normalization —
not a larger uncertified tool catalog. Position Engine Lab + certified modules as a
**security tool runtime with proof SLAs**. Prefer install/verify UX and mission
deep-links over adding more uncertified engines.

This document is the index for the OSS Validation Engine program. Read it first, then
the linked specs.

## Document map

| Document                                                                 | Purpose                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [OPEN_SOURCE_TOOL_ADAPTER_SPEC.md](OPEN_SOURCE_TOOL_ADAPTER_SPEC.md)     | The Tool Adapter Framework contract: manifest, lifecycle, evidence wiring, execution planes. |
| [TOOL_RUNTIME_SECURITY.md](TOOL_RUNTIME_SECURITY.md)                     | Sandboxing, resource limits, timeouts, network egress, audit, kill switch.                   |
| [OPEN_SOURCE_LICENSE_POLICY.md](OPEN_SOURCE_LICENSE_POLICY.md)           | License classification, supply-chain gates, allow/review/block dispositions.                 |
| [VALIDATION_MODULE_CERTIFICATION.md](VALIDATION_MODULE_CERTIFICATION.md) | Certification criteria and the `pnpm test:modules` harness.                                  |
| [OPEN_SOURCE_POLICY.md](OPEN_SOURCE_POLICY.md)                           | Short product-facing policy summary and tool commands.                                       |
| [agent-tasks/open-source-tools/](agent-tasks/open-source-tools/)         | Per-tool integration workstreams.                                                            |
| [COMMUNITY.md](../COMMUNITY.md)                                          | Community offering page. Start-set source of truth is `packages/shared/src/community-edition.ts`. |
| Popular-OSS factory                                                      | `packages/modules/src/community-popular-oss.ts` (`PopularOssSpec` + `buildCommunityPopularOssModules`). |

## Current state (assessed 2026-08-30)

The framework foundation already exists in the codebase. This program formalizes,
documents, hardens, and extends it. Nothing below is aspirational unless marked
**Planned**.

### Community pack (dispatchable ≠ bundled)

Product line (`COMMUNITY_EDITION_VALUE_LINE` in
`packages/shared/src/community-edition.ts`):

> Community edition is the open-core validation pack: secrets (Gitleaks,
> detect-secrets, git-secrets, secretlint), SCA (Trivy, OSV, Grype, pip-audit,
> govulncheck, cargo-audit, retire.js), SAST (Bandit, gosec), IaC (Checkov,
> Terrascan, KICS, kube-linter, kube-score, Kubescape, Conftest), SBOM (Syft,
> cdxgen), containers (Dockle, Trivy), TLS (SSLyze/tlsx), ZAP, Nuclei (second
> mission), Prowler, kube CIS/kube-bench, YARA/Falco rules, MIT recon,
> nmap/naabu/amass when a runner is enrolled. Not a LICENSE flip. Not live
> Atomic/Caldera/Metasploit. GPL/LGPL engines stay Engine Lab + license accept.

`COMMUNITY_VALIDATION_SUITE` is the start set (66 dispatchable modules as of
this writing). **Do not claim all 66 engines ship in the default image.** The
scan-executor `runtime` stage carries a small MIT/Apache toolkit (Gitleaks,
Nuclei, Trivy, OSV-Scanner, Prowler). Other Community CLIs are Engine Lab
install, operator PATH, or the runner-agent image. Binaries that happen to
sit in that image but are not Community start (promptfoo is theater) stay
catalog/harness-only. Missing binaries return `tool_unavailable` /
Inconclusive — they never fabricate findings.

| Class | Source | Honesty |
| ----- | ------ | ------- |
| **Reference-class adapters** | Handwritten in `packages/modules/src/index.ts` | **Gitleaks, Trivy (repo + container SCA), OSV, Prowler, Nuclei** (safe External PoA, second mission). Dedicated parsers, redaction, fixtures. Gitleaks is the behavior reference. |
| **Popular-OSS factory** | `packages/modules/src/community-popular-oss.ts` (`PopularOssSpec`); catalog in `community-popular-oss-catalog.ts` | Generic CLI factory with **count parsers**, not Gitleaks-grade adapters. Permissive SPDX only (Bandit, Checkov, detect-secrets, IaC/SCA/SAST siblings, …). Copy a spec; do not duplicate Gitleaks into `index.ts`. |
| **Copyleft** | `COPYLEFT_OPT_IN_SUITE` | **Engine Lab + SPDX accept.** GPL/LGPL (Semgrep, testssl.sh, Nikto, WhatWeb, ScoutSuite, Hadolint, Lynis, RustScan, …) are not Community start and are not redistributed in the default image. |
| **Theater** | `ENGINE_LAB_THEATER_TOOL_IDS` / `ENGINE_LAB_THEATER_MODULE_IDS` | **Never Community**, even when catalog `policyStatus` is Enabled. Atomic, Caldera, SharpHound, sqlmap, Metasploit, NetExec, promptfoo. Catalog only — not installable as validation. |

Nuclei is a **second mission** so an External PoA kill-switch cannot block the
rest of the pack. First-party DNS/TLS/HTTP modules stay ControlPlane.

**Go runner ≠ runner-agent for nmap/Syft.** The value line’s “when a runner is
enrolled” means the TypeScript **runner-agent** (`apps/runner-agent`), not the
Go LTS runner. `nmap` (`recon.host_discovery`, `recon.service_inventory`) and
`syft.sbom_generate` are not Go runner binary modules. Enrolling
`periscan-runner` does not execute them.

### What exists today

- **Module contract** — `packages/modules/src/index.ts` defines the
  `ValidationModule` interface and `ModuleManifestSchema` (Zod). Every tool is wrapped
  by a manifest with `moduleId`, `license`, `safetyLevel`, `requiredInputs`,
  `requiredPermissions`, `requiredScopes`, `executionMode`, `timeoutSeconds`,
  `resourceLimits`, `parser`, `outputSchema`, `evidenceTypes`, `approvalRequired`,
  `customerVisibleDescription`, and explicit runtime/safety metadata:
  `toolVersion`, `containerImage`, `licenseRisk`, `networkAccessRequired`,
  `writesToTarget`, `canModifyTarget`, `canExecuteCode`, `canExfiltrateData`,
  `destructivePotential`, `dataSensitivity`, `redactionRules`, `localLabTargets`,
  `maintainer`, and `status`.
- **Tool catalog + runtime resolution** — `packages/modules/src/toolchain.ts` declares
  `OPEN_SOURCE_TOOL_DEFINITIONS` and resolves runnable runtimes
  (`resolveOpenSourceToolRuntime`) across `binary`, `docker`, `npx`, `pip`, and `git`.
  Schemas live in `packages/shared/src/open-source.ts`.
- **Real execution** — Reference-class engines (Gitleaks, Nuclei safe profiles,
  Trivy repo + container SCA, OSV, Prowler) execute via `execFile`/`docker run`
  from `packages/modules/src/index.ts`. The popular-OSS factory
  (`buildCommunityPopularOssModules`) execs the rest of the permissive Community
  pack through the same runtime resolver and count parsers. Missing runtimes
  return honest `tool_unavailable` / `RequiresConfiguration` / Inconclusive
  states; they never fabricate findings. Catalog size is not the default image.
- **Evidence pipeline** — `packages/evidence/src/storage.ts` provides
  `redactEvidenceArtifact` and `putEvidenceArtifact` (raw → redacted → normalized →
  blob store → graph/correlation). Backends are S3/MinIO or local filesystem.
- **Policy + safety** — `packages/policy/src` `evaluatePolicy` enforces safety levels,
  verified scope, execution environment, approval gates, and dangerous-action denial.
  Denied tasks are never queued. Every run carries a policy decision and audit event.
- **Execution planes** — SaaS worker (`apps/worker`, BullMQ) runs control-plane and
  external-PoA modules. The Go internal runner (`apps/runner`) is the production
  LTS customer runner: outbound HTTPS signed-task polling (Ed25519) and the
  current safe internal checks:
  TCP reachability, DNS resolution, TLS certificate inspection, and HTTP health.
  The TypeScript runner-agent shares the same signed-task polling boundary for
  allowlisted AgentLocal module dispatch. **Go runner ≠ runner-agent:** nmap and
  Syft (and other InternalRunner OSS such as cdxgen, naabu, amass, subfinder,
  httpx, dnsx, tlsx) run only on `apps/runner-agent` via signed `discover` /
  `measured` / `executeModuleById` tasks — they are not Go runner modules.
  Full runner spec:
  [RUNNER_SPEC.md](RUNNER_SPEC.md) (local module allowlist, safety-level allowlist,
  nonce-replay, customer kill switch, accept/reject lifecycle). See
  [SUPPORTED_CUSTOMER_RUNNER.md](SUPPORTED_CUSTOMER_RUNNER.md).
- **License gate** — `scripts/license-inventory.ts` evaluates module, tool, and Node
  dependency licenses (`evaluateLicensePolicy`) and generates
  `licenses/THIRD_PARTY_NOTICES.md`. CI fails on blocked licenses or stale notices.
- **Certification** — `scripts/module-certification.ts` + `pnpm test:modules` validate
  every registered manifest against the adapter contract and safety invariants and
  emit `docs/generated/module-certification-report.md`.
- **Third-party tool governance** — `/api/v1/third-party-tools` is the mutable
  governance surface for Periscan-managed runtime tools. It exposes runtime readiness,
  pinned versions/images/refs, install/check jobs, tenant enablement, license/legal
  disposition, recent activity, and audit-backed controls. Install requests are queued
  by the API and executed only by explicitly enabled platform workers. The existing
  `/api/v1/open-source-tools`, `/api/v1/open-source-capabilities`, and
  `/api/v1/modules` endpoints remain read-only catalog APIs.
- **Tool onboarding intake** — `/api/v1/third-party-tools/intake/validate` accepts a
  proposed tool manifest and returns a deterministic certification report covering
  duplicate IDs, license/legal disposition, safety boundaries, installable runtime
  metadata, scope contract, runner compatibility, required files, required tests, and
  remediation actions. Intake is non-executing and does not install packages or add
  catalog entries.
- **Promotion certification** — `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certification-report`
  computes current promoted-tool certification from real candidate, promotion
  package, governance, runtime, runner, module/capability, evidence, policy, and
  safety state. It is read-only and does not enable tools, install runtimes, queue
  missions, dispatch runner tasks, or execute modules.
- **Certification history** —
  `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications`
  persists and lists tenant-scoped certification snapshots for promoted tools.
  Snapshots write audit events and appear in tool activity, but remain governance
  artifacts only: they do not enable, install, queue, dispatch, or execute tools.
- **Tool candidate backlog** — `/api/v1/third-party-tools/intake/candidates`
  persists accepted/rejected intake submissions as tenant-scoped review records with
  the original manifest, certification report, requester, status, timestamps, and
  audit event. Candidate records are backlog only: they do not install tools, create
  modules, queue missions, or enable runner execution.
- **Tool candidate batch import** —
  `/api/v1/third-party-tools/intake/candidates/import` accepts a bounded batch of
  proposed manifests, validates each item independently, isolates malformed or
  duplicate entries with item-level errors, persists successful items into the same
  candidate backlog, and writes batch audit metadata. Batch import is backlog-only:
  it does not install tools, create catalog entries, enable tenant governance, queue
  missions, dispatch runner tasks, or execute modules.
- **Tool candidate readiness summary** —
  `/api/v1/third-party-tools/intake/candidates/readiness-summary` summarizes the
  full tenant candidate backlog with per-candidate readiness reports, readiness
  counts, review/intake counts, and top required actions. The summary is triage
  only: it does not install tools, create catalog entries, enable tenant
  governance, queue missions, dispatch runner tasks, or execute modules.
- **Tool candidate readiness** —
  `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness` reports
  whether a candidate is `ReadyForGovernance`, `NeedsImplementation`, or `Blocked`
  by comparing it to actual reviewed catalog entries, module manifests, governance
  availability, runtime metadata, runner compatibility, and legal/safety gates.
  The report is read-only and never promotes, installs, enables, queues, or
  executes the proposed tool.
- **Tool candidate review** —
  `/api/v1/third-party-tools/intake/candidates/:candidateId/review` lets tenant
  Owner/Admin users record `NeedsChanges`, `AcceptedForImplementation`,
  `Rejected`, or readiness-gated `PromotedToCatalog` decisions. Review updates
  tenant-scoped metadata and audit events only; it never installs, enables,
  queues, or executes proposed tools.
- **Tool implementation work orders** —
  `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders` creates
  and lists accepted-candidate task/scaffold plans. Work orders capture required
  implementation evidence across catalog metadata, module manifests, parsers,
  policy gates, runner contracts, evidence/report wiring, license notices, and
  docs without writing files, installing packages, enabling tools, queueing
  missions, or executing modules.
- **Tool implementation bundles** —
  `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle`
  returns non-executing scaffold artifacts derived from a persisted work order:
  file content, SHA-256 hashes, validation commands, required actions, and safety
  notes. Bundles are review inputs only; they do not write repository files,
  install or enable tools, queue missions, dispatch runner tasks, or execute
  modules.
- **Tool promotion packages** —
  `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`
  creates and lists durable, tenant-scoped promotion artifacts after a candidate is
  readiness-gated as `PromotedToCatalog`. Each package snapshots the reviewed
  catalog entry, module/capability IDs, effective governance policy, runtime
  readiness, implementation readiness report, required evidence, and safety notes.
  Packages are non-executing and do not install tools, enable tools, queue
  missions, or dispatch runner tasks.
- **Trusted upstream version checks** —
  `/api/v1/third-party-tools/:toolId/upstream-version-checks` records tenant-scoped
  checks against trusted source metadata already present in the reviewed tool
  catalog, such as GitHub release/tag, npm, PyPI, or configured platform override
  metadata. A `CandidateAvailable` result is an auditable review input only; it
  cannot update reviewed catalog versions, tenant pins, install jobs, mission
  queues, or runner execution by itself.
- **Reviewed version recommendations** —
  `/api/v1/third-party-tools/:toolId/update-recommendations` creates and lists
  tenant-scoped recommendations when a reviewed catalog version differs from a
  tenant's pinned version. Applying a recommendation updates the reviewed pin
  and can queue an install job, but it never accepts arbitrary customer-supplied
  versions or bypasses legal/safety policy.
- **Tool activity timeline** —
  `/api/v1/third-party-tools/:toolId/activity` exposes a tenant-scoped lifecycle
  log assembled from governance records, runtime jobs, validation runs, upstream
  checks, update recommendations, candidates, work orders, and audit events. The
  timeline is a management surface only; it must not expose credentials, raw
  scanner output, arbitrary package data, or UI-only placeholder logs.
- **Tool runner eligibility** —
  `/api/v1/third-party-tools/:toolId/runner-eligibility` exposes a read-only
  tenant-scoped report for customer-network execution readiness. It combines
  tenant governance, runtime availability, active runner count, verified scope,
  capability implementation status, safety approval needs, and server-side
  runner dispatch allowlists. A tool is `Ready` only when at least one reviewed
  internal-runner capability has a known signed-task dispatch route; otherwise
  the API returns explicit states such as `ControlPlaneOnly`, `RequiresRunner`,
  `RequiresVerifiedScope`, `RequiresRuntime`, `NeedsImplementation`, or
  `Blocked`.
- **Tool runner dispatch** —
  `/api/v1/third-party-tools/:toolId/runner-dispatch` creates signed runner
  tasks only for reviewed capabilities that are already `Ready` in the
  eligibility report. It delegates to the existing runner task builders
  (`/tasks/discover`, `/tasks/measured`, or `/tasks/check`), so verified scope,
  policy decisions, runner kill switch, signed envelopes, local allowlists,
  evidence upload, and audit behavior remain centralized. Current safe OSS
  discovery dispatch covers `nmap`, `subfinder`, `httpx`, and `dnsx` through
  `recon.*` **runner-agent** modules. Syft SBOM (`syft.sbom_generate`) is the
  same AgentLocal path (`RUNNER_OSS_ENGINE_MODULE_IDS`), not a Go runner binary.
  The Go runner still only implements reachability, DNS, TLS certificate, and
  HTTP health. SharpHound, Caldera live execution, Atomic live execution,
  credential validation, exploitation checks, and arbitrary package/module
  dispatch remain blocked or non-executable by design.

### Gaps this program closes

- **P1** Per-tool workstream coverage and certification fixtures for the full PRD tool
  list (Gitleaks → OCSF). Tracked in `agent-tasks/open-source-tools/`.
- **P1** Unified customer-agent (Docker) that runs internal-network tools. **Resolved
  (GAP-OSS-AGENT-01):** the unified customer agent IS the outbound-only Internal Runner;
  no reverse SSH / arbitrary shell / tunnel. The runner supports signed,
  scope-enforced reachability, DNS, TLS certificate, HTTP health, safe measured
  `periscan.*`, and non-invasive internal discovery tasks; outbound HTTPS signed
  polling is the mandated transport. See [RUNNER_SPEC.md](RUNNER_SPEC.md) and
  [agent-tasks/open-source-tools/17-customer-agent.md](agent-tasks/open-source-tools/17-customer-agent.md).
  nmap/Syft still need the TypeScript runner-agent; the Go LTS runner does not
  execute those CLIs.
- **P2** Container hardening is implemented for Docker-backed module launches
  (`--read-only`, non-root, no-new-privileges, cap drop, resource ceilings, explicit
  network mode). Per-destination network-egress allowlisting remains a deployment
  control until a dedicated tool egress proxy is shipped.
- **P2** Explicit manifest runtime/safety metadata is implemented and certified.
  Certification now fails modules that misstate license risk, omit network posture,
  advertise target modification/exfiltration, or pair live support with high
  destructive potential.
- **P2** Local lab compose targets (gitleaks repo, http target, trivy image, OSV
  manifest) for deterministic certification.

## Non-negotiable invariants

These hold for every OSS engine integration and are enforced in code/tests:

1. Only verified, customer-authorized scope is validated.
2. No destructive actions; no real data exfiltration; no persistence/credential theft.
3. Every validation run requires a policy decision and an audit event.
4. Denied tasks are never queued.
5. A risk cannot be marked fixed without a verification event.
6. Raw tool output appears only in evidence detail/technical appendix, never as primary
   UX or report headline.
7. Sensitive evidence is redacted before storage and before any model/context exposure.
8. SharpHound, Caldera live execution, and Atomic live execution remain disabled.
9. Tenant-disabled tools are denied before mission jobs are queued.
10. Install/pull jobs use only allowlisted catalog artifacts; no customer-supplied
    arbitrary package/image/repository/URL/shell command is accepted.
11. Copyleft (GPL/LGPL) engines are Engine Lab + SPDX accept — not Community
    start, not default-image redistribution.
12. Theater tool IDs never Community-start, even when catalog `policyStatus` is
    Enabled.

## Tool integration order

Reference-class adapters first (already real): **Gitleaks, Trivy, OSV, Prowler,
Nuclei**. Community density beyond those five is the popular-OSS factory
(permissive SPDX, count parsers). Copyleft is Engine Lab, not this sequence.
Theater (Atomic, Caldera, SharpHound, sqlmap, Metasploit, promptfoo) is never
Community start — catalog/content only.

The original program order (foundation first, riskiest capabilities last) is:

1. Gitleaks (reference adapter — already real)
2. Trivy + OSV (dependency/container)
3. Prowler (cloud posture)
4. Nuclei (safe external exposure)
5. ZAP (web app passive baseline)
6. promptfoo / PyRIT / Garak (AI app validation harnesses; promptfoo is
   **theater**, never Community)
7. OpenCTI / Sigma / OCSF (threat intel + normalization; OpenCTI, Sigma, and
   OCSF are implemented as content/schema mapping modules; MISP remains blocked
   by the current AGPL license policy)
8. Atomic Red Team / Caldera (content/plan import only; live execution disabled;
   **theater**, never Community)
9. BloodHound CE (identity pathing import; SharpHound collector legal-review
   blocked and theater)

## Tool library expansion lifecycle

New tools must enter the ecosystem through the same governed path:

1. Validate proposed metadata through `/api/v1/third-party-tools/intake/validate`
   and resolve any required actions from the returned certification report.
2. Submit the proposal to `/api/v1/third-party-tools/intake/candidates`, or
   submit bounded manifest batches to
   `/api/v1/third-party-tools/intake/candidates/import`, when proposed tools
   should become auditable tenant-scoped review backlog items.
3. Check `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness`
   and keep the candidate non-executable until all required implementation work is complete.
4. Review the candidate and generate an implementation work order through
   `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders` after
   it is accepted for implementation.
5. Download the non-executing implementation bundle for the accepted work order
   when platform engineers need deterministic scaffold content, file hashes,
   validation commands, and safety notes for reviewed code changes.
6. Add a tool catalog entry with tool ID, category, license, phase, runtime
   preferences, pinned version/image/ref, docs URL, policy status, and notes.
7. Use update recommendations when reviewed catalog versions change so tenant
   pins move through auditable approval instead of silent runtime drift.
8. Add one or more `ModuleManifest` entries that declare tool IDs, capability IDs,
   execution plane, safety level, required scope/integrations/permissions, parser,
   output schema, evidence types, resource limits, redaction rules, fixture support,
   and live support.
9. Add fixture-backed parser, normalization, redaction, and no-raw-findings tests.
10. Pass module certification, OSS toolchain, and license policy checks.
11. Wire the module into the validation ecosystem: policy preview/start, worker or
    runner execution, evidence storage, graph updates, risk/path/remediation/report
    outputs, and activity/audit events.
12. Expose readiness and tenant governance through `/api/v1/third-party-tools`.
13. Expose customer-network dispatch readiness through
    `/api/v1/third-party-tools/:toolId/runner-eligibility` before enabling any
    Internal Runner workflow.
14. Enable live execution only after legal, safety, and execution-plane review.

Customer-network execution must use the outbound-only Internal Runner. Runner-executed
tools require signed task envelopes, local module/tool allowlists, scoped targets,
resource limits, nonce replay protection, kill-switch handling, evidence upload, runner
task activity, and audit events. Reverse SSH, arbitrary shell, uncontrolled tunnels,
destructive testing, persistence, credential theft, and real data exfiltration are not
valid execution modes.

Platform tool installation is a separate control-plane concern. Tenant admins can
request installs through `/api/v1/third-party-tools/:toolId/install`, but the API
only creates a queued, audited install job. A platform worker must opt in with
`PERISCAN_THIRD_PARTY_TOOL_INSTALL_WORKER_ENABLED=true`; actual docker/git/pip
execution also requires `PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE=true`. Without
that execute flag, jobs are denied/skipped with explicit audit evidence rather than
being marked installed.

See [agent-tasks/open-source-tools/00-index.md](agent-tasks/open-source-tools/00-index.md).
