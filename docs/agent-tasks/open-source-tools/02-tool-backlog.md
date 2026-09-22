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

## Atomic Red Team / Invoke-AtomicRedTeam

- Current module: `atomic.control_validation_safe` imports content; the separate
  local harness has a measured T1082 execution and cleanup receipt.
- Delivery: PERISCAN-586. Implement reviewed scenario execution, prerequisites,
  signed receipts, cancellation, cleanup and detection correlation. Qualify in
  disposable local labs before customer execution.

## Caldera

- Current module: `caldera.advanced_adversarial` imports plans.
- Delivery: PERISCAN-587. Implement the private-deployment API adapter, selected
  ability sets, plan-bound approvals, bounded operation lifecycle and result
  ingestion. Preserve Periscan's outbound signed-task runner transport.

## SharpHound / BloodHound CE

- Current module: `bloodhound.identity_pathing` imports compatible graphs.
- Delivery: PERISCAN-588. Implement scoped collection and normalized graph
  provenance with reviewed licensing, permissions, limits and redaction.
  Collection alone does not prove exploitability; verify claimed path edges.

## Metasploit Framework

- Current module: `exploit.metasploit_check` provides planning/fixture support.
- Delivery: PERISCAN-589. Implement reviewed non-destructive checks with typed
  options, exact version pins, bounded execution and normalized evidence.

## detect-secrets / Bandit / gosec / KubeLinter (real fixtures)

- Modules: `detect_secrets.repo_secrets` (Apache-2.0), `bandit.python_sast`
  (Apache-2.0), `gosec.go_sast` (Apache-2.0), `kube_linter.manifest_posture`
  (Apache-2.0). PassiveReadOnly, ControlPlane.
- Status (PERISCAN-490 wave `swarm/oss-pack`): certified fixture parsers,
  redacted evidence mapping, honest skip/unavailable. FixtureMode replays the
  fixture only and never invents findings. First-hour stays Gitleaks.
- Parsers omit raw secrets, `hashed_secret`, and source `code` snippets.

## Checkov / Terrascan / KICS / kube-bench (real fixtures)

- Modules: `checkov.iac_posture` (Apache-2.0), `terrascan.iac_posture`
  (Apache-2.0), `kics.iac_posture` (Apache-2.0), `kube_bench.cis_cluster`
  (Apache-2.0). PassiveReadOnly, ControlPlane.
- Status (PERISCAN-490 wave `swarm/oss-pack-w2`): certified fixture parsers,
  redacted evidence mapping, honest IaC/kubeconfig skip. FixtureMode replays
  the fixture only and never invents findings from summary counters. First-hour
  stays Gitleaks.
- Parsers omit `code_block`, violation `code`, KICS `search_value` /
  `actual_value`, and kube-bench `reason` (trap secrets in raw tool JSON).

## Brakeman / Talisman / Dependency-Check / YARA (real fixtures)

- Modules: `brakeman.ruby_sast` (MIT), `talisman.repo_secrets` (Apache-2.0),
  `dependency_check.sca` (Apache-2.0), `yara.repo_rules` (BSD-3-Clause).
  PassiveReadOnly, ControlPlane.
- Status (PERISCAN-490 wave `swarm/oss-pack-w3`): certified fixture parsers,
  redacted evidence mapping, honest Gemfile/.yar skip. FixtureMode replays
  the fixture only and never invents findings from summary counters.
  First-hour stays Gitleaks.
- Parsers omit Brakeman `code`/`user_input`, Talisman `message`,
  Dependency-Check `description`, and YARA `strings` (trap secrets in raw
  tool JSON). SSLyze is upstream AGPL-3.0 and stays out of this wave.

## Falco / Amass / Horusec / naabu (real fixtures)

- Modules: `falco.rules_validate` (Apache-2.0), `amass.passive_enum`
  (Apache-2.0), `horusec.multi_sast` (Apache-2.0), `naabu.port_inventory`
  (MIT). Falco/Horusec PassiveReadOnly ControlPlane; Amass/naabu
  ActiveNonInvasive InternalRunner.
- Status (PERISCAN-490 wave `swarm/oss-pack-w4`): certified fixture parsers,
  redacted evidence mapping, honest Falco rules skip. FixtureMode replays
  the fixture only and never invents findings from summary counters
  (`error_count`, `summary.names`, `totalVulnerabilities`, `total`).
  First-hour stays Gitleaks.
- Parsers omit Falco `context`/`snippet`, Amass `source`/`addresses`,
  Horusec `code`/`details`, and naabu `banner`/`raw` (trap secrets in raw
  tool JSON). SSLyze is upstream AGPL-3.0 and stays out of the default pack.

## tfsec / cfn-nag / Whispers / Nancy (real fixtures)

- Modules: `tfsec.iac_posture` (MIT), `cfn_nag.cloudformation` (MIT),
  `whispers.repo_secrets` (Apache-2.0), `nancy.go_advisories` (Apache-2.0).
  PassiveReadOnly, ControlPlane.
- Status (PERISCAN-490 wave `swarm/oss-pack-w5`): certified fixture parsers,
  redacted evidence mapping, honest Terraform/CloudFormation/go.mod skip.
  FixtureMode replays the fixture only and never invents findings from
  summary counters (`failed_count`, `failure_count`, `summary.count`,
  `num_vulnerable`). First-hour stays Gitleaks.
- Parsers omit tfsec `description`/`links`, cfn-nag `code`/`snippet`,
  Whispers `value`/`hashed_secret`, and Nancy `Description` (trap secrets
  in raw tool JSON). SSLyze is upstream AGPL-3.0 and stays out of the
  default pack.

## Sobelow / Polaris / kubeaudit / Popeye / katana / cloudlist (real fixtures)

- Modules: `sobelow.elixir_sast` (Apache-2.0), `polaris.k8s_posture`
  (Apache-2.0), `kubeaudit.k8s_posture` (MIT), `popeye.cluster_sanitizer`
  (Apache-2.0), `katana.web_crawl` (MIT), `cloudlist.cloud_assets` (MIT).
  Sobelow/Polaris/kubeaudit: PassiveReadOnly ControlPlane. Popeye:
  PassiveReadOnly ControlPlane (kubeconfig). katana: ActiveNonInvasive
  InternalRunner. cloudlist: PassiveReadOnly InternalRunner.
- Status (PERISCAN-490 wave `swarm/oss-pack-w6`): certified fixture parsers,
  redacted evidence mapping, honest mix.exs/YAML/kubeconfig skip.
  FixtureMode replays the fixture only and never invents findings from
  summary counters (`total_findings`, `Score`, `summary.errors`, `score`/
  `grade`/`tally`, `total`). First-hour stays Gitleaks.
- Parsers omit Sobelow `vuln_source`, Polaris `Details`/`Message`, kubeaudit
  `msg`/`Snippet`/`Command`, Popeye `snippet`/`details`, katana
  `request.raw`/`response.body`/`response.raw`, and cloudlist `token`/
  `secret` (trap secrets in raw tool JSON). SSLyze is upstream AGPL-3.0
  and stays out of the default pack.

## pip-audit / Dockle / tlsx / kube-score (real fixtures)

- Modules: `pip_audit.python_advisories` (Apache-2.0), `dockle.dockerfile_cis`
  (Apache-2.0), `tlsx.tls_probe` (MIT), `kube_score.manifest_score` (MIT).
  pip-audit/Dockle/kube-score: PassiveReadOnly ControlPlane. tlsx:
  ActiveNonInvasive InternalRunner.
- Status (PERISCAN-490 wave `swarm/oss-pack-w7`): certified fixture parsers,
  redacted evidence mapping, honest lockfile/Dockerfile/YAML skip. FixtureMode
  replays the fixture only and never invents findings from summary counters
  (`vulnerability_count`, `summary.fatal`/`warn`, `total`, `score`/`grade`).
  First-hour stays Gitleaks.
- Parsers omit pip-audit `description`, Dockle `alerts`, tlsx
  `certificate`/`serial`/`fingerprint_hash`, and kube-score `comments`
  (trap secrets in raw tool JSON). SSLyze is upstream AGPL-3.0 and stays
  out of the default pack.

## Conftest / cdxgen / git-secrets / secretlint (real fixtures)

- Modules: `conftest.policy_test` (Apache-2.0), `cdxgen.sbom_generate`
  (Apache-2.0), `git_secrets.repo_secrets` (Apache-2.0),
  `secretlint.repo_secrets` (MIT). Conftest/git-secrets/secretlint:
  PassiveReadOnly ControlPlane. cdxgen: PassiveReadOnly InternalRunner.
- Status (PERISCAN-490 wave `swarm/oss-pack-w8`): certified fixture parsers,
  redacted evidence mapping, honest policy/ skip. FixtureMode replays the
  fixture only and never invents findings from summary counters
  (`successes`/`failure_count`, `component_count`/`vulnerabilities`,
  `match_count`, `errorCount`). First-hour stays Gitleaks.
- Parsers omit Conftest `msg`/`metadata`, cdxgen `description`/`hashes`/
  `properties`, git-secrets `content`, and secretlint `message`/`data`/
  `sourceContent` (trap secrets in raw tool JSON). SSLyze is upstream
  AGPL-3.0 and stays out of the default pack.

## retire.js / govulncheck / cargo-audit / Kubescape / slsa-verifier (real fixtures)

- Modules: `retirejs.js_advisories` (Apache-2.0), `govulncheck.go_advisories`
  (BSD-3-Clause), `cargo_audit.rust_advisories` (Apache-2.0),
  `kubescape.repo_posture` (Apache-2.0), `slsa_verifier.provenance`
  (Apache-2.0). PassiveReadOnly, ControlPlane.
- Status (PERISCAN-490 wave `swarm/oss-pack-w9`): certified fixture parsers,
  redacted evidence mapping, honest package.json/go.mod/Cargo.lock/provenance
  skip. FixtureMode replays the fixture only and never invents findings from
  summary counters (`vulnerability_count`, OSV/progress messages,
  `vulnerabilities.count`/`found`/warnings, `summaryDetails.score`/
  `ResourceCounters`, `failed`/PASSED). First-hour stays Gitleaks.
- Parsers omit retire.js `identifiers.summary`/`info`, govulncheck OSV
  `details`, cargo-audit `description`, Kubescape `rules`/`paths`/`resources`,
  and slsa-verifier `error` (trap secrets in raw tool JSON). SSLyze is
  upstream AGPL-3.0 and stays out of the default pack.

## Cross-cutting backlog

- Local-lab compose targets for deterministic certification (gitleaks repo, http target,
  trivy image, OSV manifest).
- Container hardening profile + egress allowlists (see TOOL_RUNTIME_SECURITY.md, Planned).
- Promote implicit capability flags to explicit manifest fields (see adapter spec §3).
