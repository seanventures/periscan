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

| #   | Tool            | Capability                      | Phase    | Safety               | State                                                                               |
| --- | --------------- | ------------------------------- | -------- | -------------------- | ----------------------------------------------------------------------------------- |
| 01  | Gitleaks        | Repo secret scanning            | Current  | PassiveReadOnly      | Real (reference adapter)                                                            |
| 02  | Trivy           | Repo deps + container scan      | Current  | PassiveReadOnly      | Real                                                                                |
| 03  | OSV             | Advisory cross-check            | Current  | PassiveReadOnly      | Real                                                                                |
| 04  | Prowler         | Cloud (AWS) posture             | Current  | PassiveReadOnly      | Real                                                                                |
| 05  | Nuclei          | Safe external exposure          | Current  | ActiveNonInvasive    | Real (safe profiles)                                                                |
| 06  | OWASP ZAP       | Web app validation              | NearTerm | ActiveNonInvasive    | Real (passive baseline)                                                             |
| 07  | promptfoo       | AI app prompt-injection suite   | Current  | ControlledValidation | Real                                                                                |
| 08  | PyRIT           | AI risk identification          | Current  | ControlledValidation | Real (harness)                                                                      |
| 09  | Garak           | LLM vuln scanning               | NearTerm | ControlledValidation | Real (harness import)                                                               |
| 10  | OpenCTI         | Threat intel context            | NearTerm | PassiveReadOnly      | Real (STIX context import)                                                          |
| 11  | MISP            | Threat intel sharing            | Planned  | PassiveReadOnly      | Blocked by AGPL policy until legal approval or non-bundled import scope is approved |
| 12  | Sigma           | Detection rules                 | NearTerm | PassiveReadOnly      | Real (content import)                                                               |
| 13  | OCSF            | Evidence normalization schema   | NearTerm | PassiveReadOnly      | Real (schema mapping)                                                               |
| 14  | Atomic Red Team | Control validation content      | Current  | BASLite              | Real (dry-run/fixture only)                                                         |
| 15  | MITRE Caldera   | Adversarial plan import         | Deferred | AdvancedAdversarial  | Import-only (live disabled)                                                         |
| 16  | BloodHound CE   | Identity pathing import         | Deferred | PassiveReadOnly      | Import-only (SharpHound legal-review blocked)                                       |
| 17  | Customer Agent  | Unified internal-network runner | Current  | ActiveNonInvasive    | Real (outbound-only Internal Runner; no reverse SSH/shell/tunnel)                   |

Detailed files: [01-gitleaks.md](01-gitleaks.md) (reference),
[02-tool-backlog.md](02-tool-backlog.md) (per-tool plans),
[17-customer-agent.md](17-customer-agent.md) (architecture decision).

## Integration order

Foundation first, riskiest last: Gitleaks → Trivy/OSV → Prowler → Nuclei → ZAP →
promptfoo/PyRIT/Garak → OpenCTI/Sigma/OCSF → MISP legal review → Atomic/Caldera (content only) →
BloodHound CE (import only). Do not enable live execution for BASLite+ tools without
explicit legal/safety approval, customer authorization, verified scope, and a
policy-approved runner mission.

## Acceptance criteria (program)

- Every enabled module is `Certified` or `CertifiedWithWarnings` in the certification
  report.
- No `Blocked` license is enabled.
- SharpHound, Caldera live execution, Atomic live execution remain disabled.
- All product-visible data comes from real persistence/integrations/modules or honest
  empty/not-configured states.
