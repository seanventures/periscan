# Open Source Policy

Periscan uses open-source software as internal validation engines, not as the customer-facing product identity.

> Detailed specs: [OPEN_SOURCE_VALIDATION_ENGINES.md](OPEN_SOURCE_VALIDATION_ENGINES.md) (index),
> [OPEN_SOURCE_TOOL_ADAPTER_SPEC.md](OPEN_SOURCE_TOOL_ADAPTER_SPEC.md),
> [TOOL_RUNTIME_SECURITY.md](TOOL_RUNTIME_SECURITY.md),
> [OPEN_SOURCE_LICENSE_POLICY.md](OPEN_SOURCE_LICENSE_POLICY.md),
> [VALIDATION_MODULE_CERTIFICATION.md](VALIDATION_MODULE_CERTIFICATION.md).

## Rules

- Prefer permissive licenses.
- Track license metadata in module manifests and generated notices.
- AGPL, SSPL, BSL/BUSL, Commons Clause, and PolyForm are **Blocked, never installable** (not a legal-review path).
- GPL/LGPL collectors and unclear redistribution terms require legal review (`RequiresLegalReview`, not enabled by default).
- NPSL redistributed binaries require notice obligations (not silent pure-permissive Allowed).
- Default scan-executor image does not redistribute RequiresLegalReview GPL tools
  (testssl/sqlmap/nikto/whatweb/ScoutSuite); lab opt-in is the
  `runtime-legal-review` stage or future Engine Lab accept→install
  (`docs/DEPLOY.md`).
- Every tool must be wrapped by a Periscan module manifest.
- Every module needs safety level, required permissions, parser, redaction rules, fixture tests, and evidence output.
- Missing tools return unavailable/runtime-not-ready states.
- Raw tool output can appear only in evidence detail or technical appendix, never as primary UX.
- Runtime tools are managed through the Third-Party Tool Governance Center; application dependencies remain SBOM/license inventory and are not customer-installable runtime code.
- New tools become executable only after catalog metadata, module manifest, license disposition, safety classification, parser/redaction fixtures, evidence mapping, and control-plane or runner execution tests are merged.
- Customer-network execution must use outbound-only signed-task Internal Runner workflows with local allowlists, scoped targets, resource limits, evidence upload, and audit events.

## Current Policy

Current executable or import-capable tools include Gitleaks, Nuclei safe profiles/templates, Trivy, OSV, Prowler, Promptfoo/PyRIT/Garak safe report import, OpenCTI threat-context import, ZAP passive baseline, Sigma detection-rule import, OCSF evidence mapping, Atomic dry-run content, BloodHound-compatible graph import, and Caldera safe plan import. Deferred, legal-review, or catalog-only tools remain API-visible only with readiness/status metadata and are not executable. MISP remains blocked by AGPL policy, SharpHound remains legal-review blocked, and live Caldera/Atomic adversarial execution remains disabled by default.

## Governance Center

- Read-only catalog APIs: `/api/v1/open-source-tools`, `/api/v1/open-source-capabilities`, `/api/v1/modules`.
- Mutable governance APIs: `/api/v1/third-party-tools`, `/api/v1/third-party-tools/:toolId`, `/api/v1/third-party-tools/:toolId/check`, `/api/v1/third-party-tools/:toolId/install`, `/api/v1/third-party-tools/:toolId/enable`, `/api/v1/third-party-tools/:toolId/disable`, `/api/v1/third-party-tools/:toolId/jobs`, `/api/v1/third-party-tools/:toolId/update-recommendations`, `/api/v1/third-party-tools/licenses`.
- Intake APIs: `/api/v1/third-party-tools/intake/validate` returns a non-executing certification report; `/api/v1/third-party-tools/intake/candidates` persists tenant-scoped candidate review records with manifest, validation report, status, requester, timestamps, and audit event; `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness` returns a read-only implementation readiness report against actual catalog/module/governance state; `/api/v1/third-party-tools/intake/candidates/:candidateId/review` records Owner/Admin review decisions without installing, enabling, queueing, or executing tools; `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders` creates and lists accepted-candidate implementation task/scaffold plans without writing files or executing tools.
- Tenant Owner/Admin users can enable or disable approved tools for their tenant.
- Legal-review, blocked, disallowed, live-adversarial, or unsafe tools cannot be enabled by tenant admins.
- Install/check jobs use allowlisted manifest artifacts only; arbitrary package names, images, repositories, URLs, and shell commands are rejected by design.
- Disabled tools must be denied before validation mission jobs are queued.
- Every check, install, enable, disable, denial, and mission-start block must be audited.
- Candidate records are backlog only; they do not install packages, add catalog entries, enable modules, queue missions, or execute runner/control-plane tasks.
- Candidate promotion to catalog status requires readiness to prove the reviewed catalog, module, governance, runtime, runner, and safety gates already exist.
- Candidate implementation work orders are planning artifacts only; they identify files, tests, policy gates, required evidence, and runner/evidence/license work but never modify the repository, install packages, enable tools, queue missions, or execute validation modules.
- Trusted upstream version checks use reviewed tool metadata only and may create tenant-scoped candidate reports. They must not accept arbitrary package names, images, repositories, URLs, or make candidate versions executable before catalog/module/parser/license/runtime review.
- Tool update recommendations compare tenant pins only against reviewed catalog versions. Applying a recommendation may update the tenant pin and queue an install job, but it must not accept arbitrary versions, images, repositories, URLs, or execute tools directly.

## Commands

- List current tools: `pnpm tools:list`
- Check current runtime readiness: `pnpm tools:check`
- Pull current pullable tools: `pnpm tools:pull`
- Check licenses: `pnpm licenses:check`
