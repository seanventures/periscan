# Gitleaks — Repository Secret Validation (reference adapter)

Gitleaks is the **reference implementation** of the Tool Adapter Framework. New tool
integrations should mirror its structure. It is real (not mocked) and certified.

- Module: `gitleaks.repo_secrets` (`packages/modules/src/index.ts`)
- Tool definition: `gitleaks` (`packages/modules/src/toolchain.ts`)
- License: MIT (Allowed)
- Safety: `PassiveReadOnly` · Execution: `ControlPlane` · Timeout: 90s

## Manifest highlights

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `requiredInputs`        | `repositoryPath`                                                   |
| `requiredPermissions`   | `repositories:read`                                                |
| `requiredScopes`        | `Repository` (must be verified)                                    |
| `requiredIntegrations`  | `github`                                                           |
| `supportedMissionTypes` | `ValidationSnapshot`, `ExposureValidation`, `ContinuousValidation` |
| `parser`                | `periscan.gitleaks.report.v1`                                      |
| `outputSchema`          | `periscan.module-output.v1`                                        |
| `evidenceTypes`         | `RawModuleOutput`, `NormalizedEvidence`                            |
| `approvalRequired`      | `false` (passive)                                                  |
| `fixtureSupported`      | `true`                                                             |

## End-to-end path (scan → exposure → remediation → verification → rerun)

1. **Scope** — a `Repository` scope must be verified for the tenant. Unverified scope ⇒
   no run.
2. **Policy** — `evaluatePolicy` allows the passive run; a policy decision + audit event
   are recorded. Denied ⇒ never queued.
3. **Execution** — `loadGitleaksFindings(target)` runs Gitleaks via the resolved runtime
   (`resolveOpenSourceToolRuntime("gitleaks")`). If the runtime is unavailable, the
   module returns `outcome: "tool_unavailable"`, `validationState: "Inconclusive"` — an
   honest empty state, not a fabricated finding.
4. **Evidence** — each finding becomes a `NormalizedEvidence` artifact with
   `sensitivityLevel: "High"`, `redactionStatus: "Redacted"`, and a `secretPreview` (no
   raw secret). Raw output is `RawModuleOutput`, stored for the technical appendix only.
   `putEvidenceArtifact` redacts, labels, stores, and updates the graph.
5. **Signals → exposure** — `createGitleaksSignals` emits envelopes that correlation
   turns into a secret-exposure with grounding evidence. `validationState` is `Validated`
   when secrets are found.
6. **Remediation** — the exposure yields a remediation task (rotate/remove secret).
7. **Verification** — the risk cannot be marked fixed without a `VerificationEvent`
   (`verifyRemediation`). A re-scan with zero findings drives `validationState: "Fixed"`.
8. **Rerun** — `ContinuousValidation` missions re-run on schedule to confirm the fix
   holds and detect regressions.

## Safety and redaction

- Read-only against the repository; no writes, no execution of repo code.
- Secret values are never persisted in cleartext; only a preview + fingerprint.
- All evidence is redacted before storage and before any model/context exposure.

## Certification

- Certified (license MIT, parser + output schema + evidence types present, timeout
  bounded, fixtures supported). See
  [../../generated/module-certification-report.md](../../generated/module-certification-report.md).
- Local lab target (Planned): a seeded repo with a known fake secret for deterministic
  end-to-end testing — see `02-tool-backlog.md` and the local-lab plan.

## Validation commands

```bash
pnpm tools:check          # gitleaks runtime readiness
pnpm modules:certify      # regenerate certification report
pnpm test:modules         # certification assertions
```
