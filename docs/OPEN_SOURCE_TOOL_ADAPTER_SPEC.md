# Tool Adapter Framework Spec

This is the contract every open-source tool must satisfy to become a Periscan
**Validation Module**. It is implemented in `packages/modules/src/index.ts` and
`packages/modules/src/toolchain.ts`. New tools MUST conform to this spec and pass the
certification harness (`pnpm test:modules`) before they can be enabled.

## 1. Concepts

| Concept           | Definition                                                             | Code                           |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------ |
| Tool              | An upstream open-source binary/image/package.                          | `OPEN_SOURCE_TOOL_DEFINITIONS` |
| Runtime           | A resolvable way to run a tool (binary/docker/npx/pip/git).            | `resolveOpenSourceToolRuntime` |
| Module            | A Periscan-owned adapter wrapping one capability of one or more tools. | `ValidationModule`             |
| Manifest          | Declarative metadata + safety contract for a module.                   | `ModuleManifestSchema`         |
| Execution context | Per-run inputs (mission, run, tenant, scope, policy decision, target). | `ModuleExecutionContextSchema` |
| Module output     | Normalized outcome: signals + evidence + errors.                       | `ModuleOutputSchema`           |

A module is the unit of certification, policy, and customer-visible capability. Tools
are an implementation detail.

## 2. The `ValidationModule` interface

```ts
export interface ValidationModule {
  execute(context: ModuleExecutionContext): Promise<ModuleOutput>;
  inputSchema: z.ZodType<ModuleExecutionContext>;
  manifest: ModuleManifest;
  outputSchema: z.ZodType<ModuleOutput>;
}
```

Rules:

- `execute` MUST be side-effect-free against the customer environment beyond the
  module's declared `safetyLevel`. Passive modules read only.
- `execute` MUST validate `context` with `inputSchema` and return a value that parses
  with `outputSchema`. Malformed tool output is an error, never a guessed result.
- When the tool runtime is unavailable, `execute` MUST return a structured
  `ToolUnavailable` / `RequiresConfiguration` outcome, not throw and not fabricate.
- `execute` MUST honor `context.policyDecisionId`. The module is invoked only after a
  policy decision; it does not re-decide policy, but it must fail closed if the decision
  is missing for a non-fixture run.

## 3. The module manifest

Source of truth: `ModuleManifestSchema`. Fields and their certification meaning:

| Field                        | Required           | Certification meaning                                                                 |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `moduleId`                   | yes                | Stable identifier, dot-namespaced (`gitleaks.repo_secrets`).                          |
| `name`                       | yes                | Internal display name.                                                                |
| `capabilityName`             | yes                | Product capability this module fulfills.                                              |
| `version`                    | yes                | Module/adapter version.                                                               |
| `toolName`                   | yes                | Primary upstream tool.                                                                |
| `toolIds`                    | yes (may be empty) | Tool catalog IDs; drive runtime readiness.                                            |
| `capabilityIds`              | yes (may be empty) | Capability catalog linkage.                                                           |
| `license`                    | yes                | **Upstream SPDX only** (e.g. `MIT`, `Apache-2.0`, `GPL-2.0`, `NPSL`). Must match the primary tool catalog entry. Never invent `Proprietary` for a third-party-backed module. |
| `toolVersion`                | yes (nullable)     | Default upstream tool version metadata derived from tool catalog entries.             |
| `containerImage`             | yes (nullable)     | Default container image reference when a Docker runtime is available.                 |
| `installCheckCommand`        | yes (may be empty) | Argument-array metadata for checking local runtime availability.                      |
| `versionCommand`             | yes (may be empty) | Argument-array metadata for checking tool version.                                    |
| `executionCommandTemplate`   | yes                | Non-shell execution template showing the governed adapter invocation path.            |
| `licenseRisk`                | yes                | License-policy disposition (`Allowed`, `RequiresLegalReview`, `Blocked`).             |
| `safetyLevel`                | yes                | Drives policy + approval invariants (see §5).                                         |
| `networkAccessRequired`      | yes                | Explicit network posture for policy/UI/certification.                                 |
| `writesToTarget`             | yes                | Must remain `false` for Periscan validation modules.                                  |
| `canModifyTarget`            | yes                | Must remain `false`; validation modules cannot mutate customer targets.               |
| `canExecuteCode`             | yes                | Must remain `false` unless a future approved runner capability explicitly permits it. |
| `canExfiltrateData`          | yes                | Must remain `false`; real data exfiltration is prohibited.                            |
| `destructivePotential`       | yes                | Explicit destructive-potential claim (`None`, `Low`, `Moderate`, `High`).             |
| `dataSensitivity`            | yes                | Declared evidence/data sensitivity for redaction and reports.                         |
| `redactionRules`             | yes                | Named redaction rules that apply before persistence/model/report use.                 |
| `localLabTargets`            | yes (may be empty) | Deterministic fixture/lab target identifiers for certification.                       |
| `maintainer`                 | yes                | Owning team for the adapter.                                                          |
| `status`                     | yes                | Adapter implementation state (`Implemented`, `FixtureOnly`, `Deferred`, `Blocked`).   |
| `requiredInputs`             | yes                | Inputs the module needs from the mission target.                                      |
| `requiredPermissions`        | yes                | RBAC permissions required to run.                                                     |
| `requiredScopes`             | yes (may be empty) | Scope types that must be verified first.                                              |
| `requiredIntegrations`       | yes (may be empty) | Integrations that must be connected.                                                  |
| `fixtureSupported`           | yes                | Whether deterministic fixture certification exists.                                   |
| `liveSupported`              | yes                | Whether live execution is permitted in this phase.                                    |
| `supportedMissionTypes`      | yes (min 1)        | Mission types the module can serve.                                                   |
| `executionMode`              | yes                | `ControlPlane` \| `ExternalPoA` \| `InternalRunner`.                                  |
| `timeoutSeconds`             | yes                | Hard wall-clock bound (1..3600).                                                      |
| `resourceLimits`             | yes                | CPU/mem/disk/network ceilings.                                                        |
| `parser`                     | yes                | Named parser that converts raw output → signals.                                      |
| `outputSchema`               | yes                | Named normalized output schema version.                                               |
| `evidenceTypes`              | yes (min 1)        | Evidence artifact types the module emits.                                             |
| `approvalRequired`           | yes                | Whether a human approval gate is required.                                            |
| `customerVisibleDescription` | yes                | Product-facing copy (no raw tool branding as headline).                               |

### Explicit safety/runtime metadata

The PRD-requested runtime and safety fields are first-class manifest fields in
`ModuleManifestSchema`. `createModule` derives safe defaults from the module
declaration and `OPEN_SOURCE_TOOL_DEFINITIONS`, so existing adapters do not need to
duplicate catalog data by hand. A module may override these fields only when it can
prove the override through tests and certification.

Certification enforces these claims:

- `licenseRisk` must match the license-policy disposition.
- Any module with network request limits must set `networkAccessRequired=true`.
- `PassiveReadOnly` modules must declare no target write, target modification, target
  code execution, data exfiltration, or destructive potential.
- `canModifyTarget`, `canExfiltrateData`, and live high-destructive-potential modules
  are hard certification failures.
- High/restricted-sensitivity modules must declare redaction rules.

The metadata is returned by `/api/v1/modules`, which keeps UI and API customers on the
same product contract.

## 4. Execution context and output

```ts
ModuleExecutionContext = {
  missionId, runId, tenantId, scopeId,
  policyDecisionId?, safetyLevel, target, inputs, integrationIds, runnerId?
}

ModuleOutput = {
  outcome, summary, validationState?, signals[], evidence[], errors[]
}
```

- `evidence[]` items declare `artifactType`, `description`, `sensitivityLevel`,
  `redactionStatus`, and `attributes`. They flow into `putEvidenceArtifact`, which
  performs redaction, sensitivity labeling, blob storage, and graph/correlation.
- `signals[]` are `SignalEnvelope`s that downstream correlation turns into exposures,
  attack paths, and remediation tasks.
- `errors[]` carry actionable, non-sensitive messages (e.g. "runtime not configured").

## 5. Safety levels and policy

`safetyLevel` is the primary policy axis (`packages/shared` `SafetyLevelSchema`,
enforced by `packages/policy` `evaluatePolicy`):

| Safety level           | Meaning                                 | Adapter rules                                                                                 |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PassiveReadOnly`      | Read-only collection.                   | No target writes; default-enabled where licensed.                                             |
| `ActiveNonInvasive`    | Active probes, non-invasive.            | Safe profiles only; verified scope required.                                                  |
| `ControlledValidation` | Controlled checks (e.g. AI app suites). | Bounded, non-destructive.                                                                     |
| `BASLite`              | Breach-and-attack-simulation lite.      | `approvalRequired` MUST be `true`. Dry-run/fixture only until a runner live path is approved. |
| `AdvancedAdversarial`  | Advanced adversarial ops.               | `approvalRequired` MUST be `true`. Import/plan-only; live execution disabled.                 |
| `Disallowed`           | Not permitted in this phase.            | MUST NOT be `liveSupported`.                                                                  |

Certification enforces: BASLite/AdvancedAdversarial ⇒ `approvalRequired === true`;
Disallowed ⇒ `liveSupported === false`. `evaluateModuleStartConstraints` additionally
blocks Caldera advanced ops (import-only) and Atomic non-dry-run execution.

## 6. Execution planes

| Plane            | Where                                  | Used for                                                  |
| ---------------- | -------------------------------------- | --------------------------------------------------------- |
| `ControlPlane`   | SaaS worker (`apps/worker`, BullMQ)    | Repo/cloud/passive tools (Gitleaks, Trivy, OSV, Prowler). |
| `ExternalPoA`    | SaaS worker, internet-facing           | Safe external exposure (Nuclei safe profiles).            |
| `InternalRunner` | Customer-network agent (`apps/runner`) | Internal-network reach; today reachability only.          |

The internal runner uses **outbound HTTPS long-poll with Ed25519 signed task
envelopes**. This is a deliberate security posture (no inbound ports, no reverse SSH).
Running OSS tools on the runner is a future capability gated on the customer-agent
design — see `agent-tasks/open-source-tools/17-customer-agent.md`.

## 7. Adding a new tool (checklist)

1. Add a `OpenSourceToolDefinition` to `OPEN_SOURCE_TOOL_DEFINITIONS` (SPDX license
   from upstream, runtimes, default version, policy status, phase, docsUrl/gitRepo).
2. Implement a `ValidationModule` with a conformant manifest and `execute`.
   - `manifest.license` **must equal** the primary tool’s SPDX (examples:
     Gitleaks → `MIT`, Trivy → `Apache-2.0`, nmap → `NPSL`, sqlmap → `GPL-2.0`).
   - First-party-only modules (no third-party `toolIds`) may use `Proprietary`.
   - `licenseRisk` is derived from tool SPDX + `policyStatus` — do not hardcode
     `Allowed` to launder a review-gated engine.
3. Add a deterministic fixture and, where applicable, a local-lab target.
4. Wire evidence types and a named parser; ensure redaction covers the output.
5. Run `pnpm licenses:check`, `pnpm modules:certify`, `pnpm test:modules`.
6. Regenerate notices: `pnpm licenses:write`.
7. Document the workstream in `agent-tasks/open-source-tools/` or follow root
   `CONTRIBUTING.md`.
8. Do not enable live execution for BASLite+ tools without an approved runner path.
9. Attribute the engine in customer-visible methodology copy; never present the
   module as if Periscan authored the upstream binary.
