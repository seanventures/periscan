# Periscan Security Boundaries

Periscan only validates customer-authorized scope.

## Safe-use rules

- Verified scope is required before validation starts.
- No destructive tests.
- No real data exfiltration.
- No persistence on customer systems.
- No credential theft.
- No uncontrolled exploit chaining.
- No third-party scanning without verified authorization.
- Default to read-only collection and passive validation.
- Sensitive validation requires policy approval.
- Every validation action must be logged and auditable.
- External validation must use explicit safety controls, rate limits, and allowlists.
- The internal runner must be outbound-only and scope-limited.
- The internal runner must use outbound HTTPS with bearer-token authentication over TLS by default; reverse SSH tunnels are not part of the default product design.

## Governed BAS / AEV development — PERISCAN-583

Full BAS/AEV and qualified Atomic, Caldera, SharpHound/BloodHound and Metasploit
integrations are authorized development objectives. The [BAS/AEV
program](docs/BAS_AEV_PROGRAM.md) defines implementation requirements. Authorization to develop is distinct
from customer authorization to execute a particular scenario.

Promote each adapter and scenario only with pinned content, reviewed side
effects, least privilege, verified scope, policy/approval binding, bounded
execution, cancellation, cleanup verification and real lab evidence. Preserve
signed outbound runner tasks and tenant isolation. No arbitrary shell or
unrestricted tool-library dispatch from the API.

The current generic control inject API remains disabled
(`control_live_execution_disabled`) until its governed implementation ships.
Existing fixture/import-only modules remain non-executable. Update the runtime
gates with the implementation and negative tests, not by changing catalog flags.
Record customer execution scope with the [BAS execution authorization](docs/competitive/BAS_EXECUTION_AUTHORIZATION.md).

## Product enforcement expectations

- Policy decisions gate every mission.
- Denied work must not be queued.
- Evidence access must stay tenant-scoped.
- Every conclusion must link to evidence IDs.

## SIEM / case co-existence (P06-16) — not bi-directional close

Periscan is a **validation-and-proof control plane**, not a SIEM or IR case
console:

- **Do not** implement bi-directional “close Splunk notable / Sentinel incident
  when dispositioned in Periscan” as a product default.
- **Allowed outbound only:** `finding.disposition_changed` webhooks (and optional
  workflow case_link intent on Escalated; comment_only intent on
  FalsePositive/Suppressed) so SOC automation can annotate cases elsewhere.
- Analyst dispositions never claim Fixed; Fixed remains verification-only.

## Build scope and excluded behavior

**Build:** qualified OSS adapters, scenario and campaign authoring, governed
control stimulation, detection correlation, directory collection and identity
path analysis, reviewed non-destructive validation checks, measured path
receipts, canaries, remediation retests and evidence-backed reports.

**Exclude:** customer-data destruction, ransomware encryption of customer
files, credential theft or uncontrolled spray, persistent implants, evasion,
real data exfiltration, OT writes and uncontrolled multi-stage chaining.
Use synthetic data, dedicated test identities and reversible approved behavior
for simulation. An engine's name does not determine eligibility; the specific
adapter, scenario, target and side effects do.

## Safety drill (kill switch + denied-task visibility) (P06-19)

SOC / design-partner tabletop (quarterly recommended):

1. **Issue kill switch** on a lab runner (Runners → kill switch). Confirm audit
   event and UI state; new leases must not dispatch.
2. **Attempt schedule run-now** (or mission start) while kill-switched /
   against denied policy. Confirm the task is **never queued** and a policy or
   fleet deny reason is visible in audit + UI.
3. **Clear kill switch** and re-run a safe PassiveReadOnly mission to prove
   recovery.
4. Optional: export evidence pack snippet titled **“Safety control exercised”**
   for auditors (audit rows + denied decision IDs only — no raw tool output).

Trust & Safety can host a reminder; the product does not invent a fake “practice
mission type” that weakens live safety floors.

## Frontier Gateway boundaries

The Frontier Gateway lets a customer's own model reason over Periscan data, but the model is never trusted with direct access:

- No model gets direct network or shell access; it can only request typed, code-defined tools.
- The model never receives raw secrets and only sees context that has passed `redactEvidenceArtifact`.
- Every tool request is policy-checked at a Policy Enforcement Point (`Allowed` / `RequiresApproval` / `Denied`), audited, and evidence-linked.
- BYO frontier-model API keys are encrypted at rest (AES-256-GCM), never logged, never sent to the model, and never returned on read.
- Denied tool requests are recorded but never queue an underlying action; approval-gated action tools reuse the existing mission/approval machinery.
- A risk can only be marked fixed by a real verification event; the model cannot mark anything fixed directly.
- Tenant isolation and verified-scope enforcement apply to every tool, and a per-tenant kill switch terminates all active sessions and blocks pending requests immediately.
