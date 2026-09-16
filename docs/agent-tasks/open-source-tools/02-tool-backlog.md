# Per-Tool Integration Backlog

Concise plans per tool. Each follows the definition of done in
[00-index.md](00-index.md) and the contract in
[../../OPEN_SOURCE_TOOL_ADAPTER_SPEC.md](../../OPEN_SOURCE_TOOL_ADAPTER_SPEC.md).

## Trivy (real)

- Modules: `trivy.repo_dependency_scan`, `trivy.container_scan` (Apache-2.0, PassiveReadOnly).
- Plan: pin DB mirror, prefer `--network none` with offline DB where possible; map CVEs to
  exposures with severity. Local lab: a deliberately vulnerable image/manifest.

## OSV (real)

- Module: `osv.repo_dependency_scan` (Apache-2.0, PassiveReadOnly).
- Plan: cross-check dependency advisories; egress allowlist to the OSV API only.

## Prowler (real)

- Module: `prowler.aws_posture` (Apache-2.0, PassiveReadOnly).
- Plan: read-only cloud posture using least-privilege role; requires connected cloud
  integration; map checks to posture exposures.

## Nuclei (real, safe profiles)

- Module: `nuclei.external_exposure_safe` (MIT, ActiveNonInvasive, ExternalPoA).
- Plan: safe templates only; only verified in-scope targets; no intrusive/DoS templates.

## OWASP ZAP (real)

- Capability: web app validation (ActiveNonInvasive baseline scan).
- Module: `web.zap_baseline`.
- Plan: containerized passive baseline scan against verified web scopes; non-destructive;
  egress restricted to in-scope targets; medium/high passive alerts become normalized
  exposure evidence.

## promptfoo / PyRIT / Garak (real harnesses)

- Module: `ai_app.safe_validation` (MIT, ControlledValidation) covers prompt-injection,
  RAG/tool-invocation, and an alternate safety harness.
- Plan: bounded, non-destructive AI app suites against customer-authorized AI endpoints.
  Promptfoo, PyRIT, and Garak reports are imported through the same redacted evidence
  path; live endpoint probes remain benign and `Inconclusive` unless a real harness
  report provides validation proof.

## OpenCTI (real, import only)

- Capability: threat-intel context enrichment (PassiveReadOnly).
- Module: `opencti.threat_context_import`.
- Plan: import approved OpenCTI/STIX exports, extract CVEs, IOCs, MITRE ATT&CK
  technique IDs, labels, and advisory context, and emit normalized Periscan
  evidence with `validationProof:false`. Context import never claims
  exploitability, detection, or fix status.

## MISP (blocked by current license policy)

- Capability: threat-intel context enrichment (PassiveReadOnly).
- Status: MISP core is AGPL, and Periscan's license policy blocks AGPL material
  from enabled OSS tool definitions. Keep MISP non-connectable/non-executable
  until legal approval or a scoped, non-bundled customer-export parser is
  approved and tested.

## Sigma (real, content import)

- Capability: detection-rule content for control validation mapping.
- Module: `sigma.detection_rule_import`.
- Plan: import/normalize Sigma YAML rules, map ATT&CK technique tags, and emit
  control-coverage evidence. Content only: no live deployment, SIEM mutation, rule
  enablement, or query execution.

## OCSF (real, schema mapping)

- Capability: normalize Periscan signals/evidence toward the Open Cybersecurity
  Schema Framework.
- Module: `ocsf.evidence_mapping`.
- Plan: map existing normalized signals/evidence into OCSF-compatible export
  envelopes, preserve unmapped attribute keys, and record `validationProof:false`.
  Schema mapping is PassiveReadOnly content work and never asserts exploitability,
  detection, or fix status.

## Atomic Red Team (real, dry-run/fixture only)

- Module: `atomic.control_validation_safe` (BASLite, approvalRequired=true).
- Plan: ATT&CK scenario content packs + dry-run executor only. Live execution is blocked
  by `evaluateModuleStartConstraints` until an approved internal-runner path exists.

## MITRE Caldera (import only, live disabled)

- Module: `caldera.advanced_adversarial` (AdvancedAdversarial, approvalRequired=true).
- Plan: import adversary plans as content only. Live adversarial execution is disabled by
  policy and `evaluateModuleStartConstraints`.

## BloodHound CE (import only)

- Module: `bloodhound.identity_pathing` (Apache-2.0, PassiveReadOnly).
- Plan: import identity-path graphs for analysis. The **SharpHound** collector is GPL
  family and legal-review blocked; it is not enabled.

## Cross-cutting backlog

- Local-lab compose targets for deterministic certification (gitleaks repo, http target,
  trivy image, OSV manifest).
- Container hardening profile + egress allowlists (see TOOL_RUNTIME_SECURITY.md, Planned).
- Promote implicit capability flags to explicit manifest fields (see adapter spec §3).
