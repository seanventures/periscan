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

## Safety floor (do not erode for BAS peer pressure) — P12-19

Periscan’s Completeness of Vision strength includes an explicit **non-destructive
AEV floor**. Do **not** weaken these rules to chase “attack realism” claims from
BAS peers:

- Live Atomic / Caldera / SharpHound / kill-chain / ransomware / malware / phishing
  execution stays **disabled** unless a separate, approved legal and safety
  program lands (see Agents.md “Do Not Touch”).
- Prefer **measured, governed, evidence-linked** validation over library size or
  offensive theater.
- Publish what is simulated, what is measured, and what is never done; sell the
  safety substitution catalog rather than matching uncontrolled BAS packs.
- Denied tasks must never be queued; Fixed requires verification — these are
  product guarantees, not optional marketing knobs.

## Wave D optional lab inject — SOW + dual gate (default off) — PERISCAN-460

Closed inject→measure is **not** default product behavior. Control-plane API
hard-refuses live inject (`control_live_execution_disabled`) so observe-only
telemetry correlation remains the shipping path.

Until **both** are true, do not enable inject product code:

1. **Signed SOW** using
   [`docs/competitive/WAVE_D_INJECT_SOW_TEMPLATE.md`](docs/competitive/WAVE_D_INJECT_SOW_TEMPLATE.md)
   (authorization, verified scope, dual approvers, dry-run default, kill switch,
   audit, finite duration, withdraw).
2. **Dual product gates** at runtime: tenant inject policy flag **and** operator
   approval; dry-run default; denied inject tasks never queue.

**Never under Wave D:** live ransomware, credential spray, SharpHound collector,
Caldera live, unrestricted Atomic live library, real data exfiltration.

Docs consistency:
[`docs/competitive/DEMO_OFFENSIVE_GUARDRAILS.md`](docs/competitive/DEMO_OFFENSIVE_GUARDRAILS.md)
§ Wave D. Residual D1–D5 remain blocked on signed SOW — do not flip the hard
disable to chase matrix SCV Leading.

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

## Safe substitutes to build vs never build (P05-13)

**Build (safe substitutes / proof layer):** multi-hop safe probes + receipts;
endpoint marker / DNS canary BAS-lite; import-graph re-measure; fix re-proof;
control observe closed loop; allowlisted external GET templates; Nuclei safe
profiles; kill-chain **planner** (plan-only, non-executable stages).

**Never build (live offense):** live ransomware encrypt; live credential spray
against customer IdP; SharpHound collector in product; Metasploit exploit run;
OT protocol write / Modbus coil flips; uncontrolled multi-stage agent; phishing
payload delivery; malware staging; live Atomic / Caldera inject without a
certified allowlist and policy architecture.

**Partner, do not rebuild:** dark-web credential monitoring, crowdsourced HITL,
deep OT lab packs.

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
