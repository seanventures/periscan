# OSS Tool Integration Workstreams

Per-tool workstreams for bringing open-source security tools into Periscan as certified
Validation Modules. Read [../../OPEN_SOURCE_VALIDATION_ENGINES.md](../../OPEN_SOURCE_VALIDATION_ENGINES.md)
and [../../OPEN_SOURCE_TOOL_ADAPTER_SPEC.md](../../OPEN_SOURCE_TOOL_ADAPTER_SPEC.md) first.

## Definition of done per tool

A tool integration is complete only when all are true:

1. `OpenSourceToolDefinition` declared (license, runtimes, version, policy status, phase).
2. `ValidationModule` implemented with a conformant, certified manifest.
3. Deterministic fixture exists; local-lab target exists where applicable.
4. Evidence types + named parser wired; redaction covers output; raw output never headline.
5. Policy/safety level correct; approval gate where required; denied tasks never queued.
6. `pnpm licenses:check`, `pnpm modules:certify`, `pnpm test:modules` pass.
7. Notices regenerated (`pnpm licenses:write`).
8. Workstream doc updated with status.

## Status

| #   | Tool             | Capability                      | Phase    | Safety               | State                                                                               |
| --- | ---------------- | ------------------------------- | -------- | -------------------- | ----------------------------------------------------------------------------------- |
| 01  | Gitleaks         | Repo secret scanning            | Current  | PassiveReadOnly      | Real (reference adapter)                                                            |
| 02  | Trivy            | Repo deps + container scan      | Current  | PassiveReadOnly      | Real                                                                                |
| 03  | OSV              | Advisory cross-check            | Current  | PassiveReadOnly      | Real                                                                                |
| 04  | Prowler          | Cloud (AWS) posture             | Current  | PassiveReadOnly      | Real                                                                                |
| 05  | Nuclei           | Safe external exposure          | Current  | ActiveNonInvasive    | Real (safe profiles)                                                                |
| 06  | OWASP ZAP        | Web app validation              | NearTerm | ActiveNonInvasive    | Real (passive baseline)                                                             |
| 07  | promptfoo        | AI app prompt-injection suite   | Current  | ControlledValidation | Real                                                                                |
| 08  | PyRIT            | AI risk identification          | Current  | ControlledValidation | Real (harness)                                                                      |
| 09  | Garak            | LLM vuln scanning               | NearTerm | ControlledValidation | Real (harness import)                                                               |
| 10  | OpenCTI          | Threat intel context            | NearTerm | PassiveReadOnly      | Real (STIX context import)                                                          |
| 11  | MISP             | Threat intel sharing            | Planned  | PassiveReadOnly      | Blocked by AGPL policy until legal approval or non-bundled import scope is approved |
| 12  | Sigma            | Detection rules                 | NearTerm | PassiveReadOnly      | Real (content import)                                                               |
| 13  | OCSF             | Evidence normalization schema   | NearTerm | PassiveReadOnly      | Real (schema mapping)                                                               |
| 14  | Atomic Red Team  | Control validation content      | Current  | BASLite              | Real (dry-run/fixture only)                                                         |
| 15  | MITRE Caldera    | Adversarial plan import         | Deferred | AdvancedAdversarial  | Import-only (live disabled)                                                         |
| 16  | BloodHound CE    | Identity pathing import         | Deferred | PassiveReadOnly      | Import-only (SharpHound legal-review blocked)                                       |
| 17  | Customer Agent   | Unified internal-network runner | Current  | ActiveNonInvasive    | Real (outbound-only Internal Runner; no reverse SSH/shell/tunnel)                   |
| 18  | detect-secrets   | Repo secret scanning            | Current  | PassiveReadOnly      | Real fixture parser (`detect_secrets.repo_secrets`)                                 |
| 19  | Bandit           | Python SAST                     | Current  | PassiveReadOnly      | Real fixture parser (`bandit.python_sast`)                                          |
| 20  | gosec            | Go SAST                         | Current  | PassiveReadOnly      | Real fixture parser (`gosec.go_sast`)                                               |
| 21  | KubeLinter       | Kubernetes YAML/Helm lint       | Current  | PassiveReadOnly      | Real fixture parser (`kube_linter.manifest_posture`)                                |
| 22  | Checkov          | IaC posture                     | Current  | PassiveReadOnly      | Real fixture parser (`checkov.iac_posture`)                                         |
| 23  | Terrascan        | IaC posture                     | Current  | PassiveReadOnly      | Real fixture parser (`terrascan.iac_posture`)                                       |
| 24  | KICS             | IaC posture                     | Current  | PassiveReadOnly      | Real fixture parser (`kics.iac_posture`)                                            |
| 25  | kube-bench       | Kubernetes CIS cluster          | Current  | PassiveReadOnly      | Real fixture parser (`kube_bench.cis_cluster`)                                      |
| 26  | Brakeman         | Ruby on Rails SAST              | Current  | PassiveReadOnly      | Real fixture parser (`brakeman.ruby_sast`)                                          |
| 27  | Talisman         | Repo secret scanning            | Current  | PassiveReadOnly      | Real fixture parser (`talisman.repo_secrets`)                                       |
| 28  | Dependency-Check | OWASP SCA                       | Current  | PassiveReadOnly      | Real fixture parser (`dependency_check.sca`)                                        |
| 29  | YARA             | Authorized-repo rule match      | Current  | PassiveReadOnly      | Real fixture parser (`yara.repo_rules`)                                             |
| 30  | Falco            | Rules lint (no live kernel)     | Current  | PassiveReadOnly      | Real fixture parser (`falco.rules_validate`)                                        |
| 31  | Amass            | Passive subdomain enum          | Current  | ActiveNonInvasive    | Real fixture parser (`amass.passive_enum`)                                          |
| 32  | Horusec          | Multi-language SAST             | Current  | PassiveReadOnly      | Real fixture parser (`horusec.multi_sast`)                                          |
| 33  | naabu            | Connect-scan port inventory     | Current  | ActiveNonInvasive    | Real fixture parser (`naabu.port_inventory`)                                        |
| 34  | tfsec            | Terraform IaC posture           | Current  | PassiveReadOnly      | Real fixture parser (`tfsec.iac_posture`)                                           |
| 35  | cfn-nag          | CloudFormation lint             | Current  | PassiveReadOnly      | Real fixture parser (`cfn_nag.cloudformation`)                                      |
| 36  | Whispers         | Repo secret scanning            | Current  | PassiveReadOnly      | Real fixture parser (`whispers.repo_secrets`)                                       |
| 37  | Nancy            | Go.sum OSS Index advisories     | Current  | PassiveReadOnly      | Real fixture parser (`nancy.go_advisories`)                                         |
| 38  | Sobelow          | Elixir/Phoenix SAST             | Current  | PassiveReadOnly      | Real fixture parser (`sobelow.elixir_sast`)                                         |
| 39  | Polaris          | Kubernetes workload posture     | Current  | PassiveReadOnly      | Real fixture parser (`polaris.k8s_posture`)                                         |
| 40  | kubeaudit        | Kubernetes manifest audit       | Current  | PassiveReadOnly      | Real fixture parser (`kubeaudit.k8s_posture`)                                       |
| 41  | Popeye           | Live cluster sanitizer          | Current  | PassiveReadOnly      | Real fixture parser (`popeye.cluster_sanitizer`)                                    |
| 42  | katana           | Authorized-scope web crawl      | Current  | ActiveNonInvasive    | Real fixture parser (`katana.web_crawl`)                                            |
| 43  | cloudlist        | Cloud asset inventory           | Current  | PassiveReadOnly      | Real fixture parser (`cloudlist.cloud_assets`)                                      |

SETTLED Community pack named expansion engines are certified through wave 6.
SSLyze is upstream AGPL-3.0 — skip for the default pack. GPL/AGPL (Semgrep,
testssl, Nikto, WhatWeb, ScoutSuite, TruffleHog) stay Engine Lab.

Detailed files: [01-gitleaks.md](01-gitleaks.md) (reference),
[02-tool-backlog.md](02-tool-backlog.md) (per-tool plans),
[17-customer-agent.md](17-customer-agent.md) (architecture decision).

## Integration order

Reuse the existing scanner, inventory and evidence integrations. Build Atomic,
Caldera, SharpHound/BloodHound and Metasploit adapters through the shared
BAS/AEV program (`docs/BAS_AEV_PROGRAM.md`), starting in disposable local labs.
Customer execution requires qualified scenarios, reviewed licenses, verified
scope and a policy-approved signed runner mission.

## Acceptance criteria (program)

- Every enabled module is `Certified` or `CertifiedWithWarnings` in the certification
  report.
- No `Blocked` license is enabled.
- Build qualified SharpHound, Caldera and Atomic execution adapters under PERISCAN-586–588. Before qualification, runtime start requests must deny before queueing.
- All product-visible data comes from real persistence/integrations/modules or honest
  empty/not-configured states.
