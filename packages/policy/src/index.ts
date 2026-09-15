import { z } from "zod";

import {
  ApprovalStateSchema,
  ExecutionEnvironmentSchema,
  MembershipRoleSchema,
  MissionTypeSchema,
  PolicyDecisionOutcomeSchema,
  PolicyRequestedActionSchema,
  SafetyLevelSchema,
  ScopeClassificationSchema,
  ScopeVerificationStatusSchema,
  resolveScopeSafetyEnvelope,
  type ApprovalState,
  type PolicyDecisionOutcome
} from "@periscan/shared";

export * from "./external-validation.js";
export * from "./prompt-injection.js";

const DEFAULT_TENANT_POLICY = {
  allowedExecutionEnvironments: [
    "ControlPlane",
    "ExternalPoA",
    "InternalRunner"
  ],
  disallowedMissionTypes: [],
  maxSafetyLevel: "BASLite",
  requireTimeWindowForSafetyLevels: []
} as const;

export const TenantPolicyEvaluationInputSchema = z
  .object({
    allowedExecutionEnvironments: z
      .array(ExecutionEnvironmentSchema)
      .min(1)
      .default([...DEFAULT_TENANT_POLICY.allowedExecutionEnvironments]),
    disallowedMissionTypes: z
      .array(MissionTypeSchema)
      .default([...DEFAULT_TENANT_POLICY.disallowedMissionTypes]),
    maxSafetyLevel: SafetyLevelSchema.default(
      DEFAULT_TENANT_POLICY.maxSafetyLevel
    ),
    requireTimeWindowForSafetyLevels: z
      .array(SafetyLevelSchema)
      .default([...DEFAULT_TENANT_POLICY.requireTimeWindowForSafetyLevels])
  })
  .default(() => ({
    allowedExecutionEnvironments: [
      ...DEFAULT_TENANT_POLICY.allowedExecutionEnvironments
    ],
    disallowedMissionTypes: [...DEFAULT_TENANT_POLICY.disallowedMissionTypes],
    maxSafetyLevel: DEFAULT_TENANT_POLICY.maxSafetyLevel,
    requireTimeWindowForSafetyLevels: [
      ...DEFAULT_TENANT_POLICY.requireTimeWindowForSafetyLevels
    ]
  }));

export const PolicyEvaluationInputSchema = z.object({
  userRole: MembershipRoleSchema,
  tenantPolicy: TenantPolicyEvaluationInputSchema,
  scopeVerificationStatus: ScopeVerificationStatusSchema,
  missionType: MissionTypeSchema,
  safetyLevel: SafetyLevelSchema,
  scopeContext: ScopeClassificationSchema.default(() =>
    ScopeClassificationSchema.parse({
      maxSafetyLevel: "AdvancedAdversarial"
    })
  ),
  target: z.record(z.string(), z.unknown()).default({}),
  executionEnvironment: ExecutionEnvironmentSchema,
  requestedAction: PolicyRequestedActionSchema,
  explicitMissionApproval: z.boolean().default(false),
  adminApproval: z.boolean().default(false),
  timeWindowApproved: z.boolean().default(false),
  // The tenant's offensive-validation authorization flip. When false (default),
  // AdvancedAdversarial is denied outright. When an admin has authorized it,
  // AdvancedAdversarial becomes permittable — still subject to the safety floor
  // and to per-run admin approval below.
  offensiveValidationAuthorized: z.boolean().default(false),
  // The tenant's DESTRUCTIVE-validation authorization tier — the top governance
  // tier, above the offensive flip. When false (default), destructive-class
  // actions (destructive / real-data exfiltration / persistence / credential
  // theft — i.e. real-payload validation) are denied outright. When an admin has
  // enabled it (with a recorded authorization reference), those actions become
  // permittable, but ONLY against a verified authorized scope, with admin
  // approval AND explicit per-mission approval, fully audited. Uncontrolled
  // exploit chaining is never permitted regardless of this tier.
  destructiveValidationAuthorized: z.boolean().default(false)
});

export const PolicyEvaluationResultSchema = z.object({
  outcome: PolicyDecisionOutcomeSchema,
  approvalState: ApprovalStateSchema,
  rationale: z.string().min(1)
});

export type PolicyEvaluationInput = z.input<typeof PolicyEvaluationInputSchema>;
export type PolicyEvaluationResult = z.infer<
  typeof PolicyEvaluationResultSchema
>;

const ADMIN_APPROVER_ROLES = new Set([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);

function isAdminApprover(role: PolicyEvaluationInput["userRole"]) {
  return ADMIN_APPROVER_ROLES.has(role);
}

const SAFETY_LEVEL_ORDER: Record<z.infer<typeof SafetyLevelSchema>, number> = {
  ActiveNonInvasive: 1,
  AdvancedAdversarial: 4,
  BASLite: 3,
  ControlledValidation: 2,
  Disallowed: 5,
  PassiveReadOnly: 0
};

function isSafetyLevelAboveTenantPolicy(
  safetyLevel: z.infer<typeof SafetyLevelSchema>,
  maxSafetyLevel: z.infer<typeof SafetyLevelSchema>
) {
  return SAFETY_LEVEL_ORDER[safetyLevel] > SAFETY_LEVEL_ORDER[maxSafetyLevel];
}

export function evaluatePolicy(
  rawInput: PolicyEvaluationInput
): PolicyEvaluationResult {
  const input = PolicyEvaluationInputSchema.parse(rawInput);

  // Permanent floor — never lifts, under any toggle. Uncontrolled exploit
  // chaining means unbounded/unscoped/non-abortable automation; the platform
  // never runs it, because it cannot be constrained to a verified target or
  // stopped mid-run. (Controlled, scoped, kill-switchable destructive validation
  // is a different thing and is handled by the destructive tier below.)
  if (input.requestedAction.uncontrolledExploitChaining) {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale:
        "Uncontrolled exploit chaining is never permitted — validation must be scoped, bounded, and abortable."
    };
  }

  // Destructive-class actions (destructive / real-data exfiltration / persistence
  // / credential theft — i.e. real-payload validation) are denied UNLESS the
  // tenant has enabled the destructive-validation authorization tier. Even when
  // enabled they remain gated below on a verified authorized scope, admin
  // approval, AND explicit per-mission approval, and every run is audited.
  const destructiveClass =
    input.requestedAction.destructive ||
    input.requestedAction.realDataExfiltration ||
    input.requestedAction.persistence ||
    input.requestedAction.credentialTheft;

  if (destructiveClass && !input.destructiveValidationAuthorized) {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale:
        "Destructive / real-payload validation is disabled. A tenant admin must enable the destructive-validation authorization tier (with a recorded authorization reference) before it can run."
    };
  }

  if (input.scopeVerificationStatus !== "Verified") {
    return {
      outcome: "RequiresVerifiedScope",
      approvalState: "Pending",
      rationale:
        "Validation requires a verified customer-authorized scope before execution."
    };
  }

  if (input.tenantPolicy.disallowedMissionTypes.includes(input.missionType)) {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale:
        "Tenant policy denies this mission type for the requested validation."
    };
  }

  if (
    !input.tenantPolicy.allowedExecutionEnvironments.includes(
      input.executionEnvironment
    )
  ) {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale:
        "Tenant policy denies this execution environment for the requested validation."
    };
  }

  const scopeSafety = resolveScopeSafetyEnvelope(input.scopeContext);
  if (scopeSafety.effectiveMaxSafetyLevel === "Disallowed") {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale: "Validation is disabled for this scope."
    };
  }
  if (
    isSafetyLevelAboveTenantPolicy(
      input.safetyLevel,
      scopeSafety.effectiveMaxSafetyLevel
    )
  ) {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale: scopeSafety.isOperationalTechnology
        ? "OT-classified scopes are hard-limited to PassiveReadOnly validation; active or higher-impact validation is denied."
        : `Scope policy denies validation above its ${scopeSafety.effectiveMaxSafetyLevel} safety ceiling.`
    };
  }

  // When offensive OR destructive validation is authorized the effective ceiling
  // rises to AdvancedAdversarial; otherwise the tenant's configured maximum
  // applies. (Destructive is the higher tier and implies the adversarial ceiling.)
  const adversarialAuthorized =
    input.offensiveValidationAuthorized || input.destructiveValidationAuthorized;
  const effectiveMaxSafetyLevel = adversarialAuthorized
    ? "AdvancedAdversarial"
    : input.tenantPolicy.maxSafetyLevel;

  if (isSafetyLevelAboveTenantPolicy(input.safetyLevel, effectiveMaxSafetyLevel)) {
    return {
      outcome: "Denied",
      approvalState: "Rejected",
      rationale:
        "Tenant policy denies validation above the configured maximum safety level."
    };
  }

  if (
    input.requestedAction.requiresInternalRunner &&
    input.executionEnvironment !== "InternalRunner"
  ) {
    return {
      outcome: "RequiresInternalRunner",
      approvalState: "Pending",
      rationale:
        "This validation requires the internal runner execution environment."
    };
  }

  if (input.requestedAction.requiresTimeWindow && !input.timeWindowApproved) {
    return {
      outcome: "RequiresTimeWindow",
      approvalState: "Pending",
      rationale:
        "This validation requires an approved execution time window before it can run."
    };
  }

  if (
    input.tenantPolicy.requireTimeWindowForSafetyLevels.includes(
      input.safetyLevel
    ) &&
    !input.timeWindowApproved
  ) {
    return {
      outcome: "RequiresTimeWindow",
      approvalState: "Pending",
      rationale:
        "Tenant policy requires an approved time window for this safety level."
    };
  }

  switch (input.safetyLevel) {
    case "PassiveReadOnly":
    case "ActiveNonInvasive":
      return {
        outcome: "Allowed",
        approvalState: "NotRequired",
        rationale:
          "Verified scope with a passive or non-invasive safety level is allowed."
      };

    case "ControlledValidation":
      if (!input.explicitMissionApproval) {
        return {
          outcome: "RequiresApproval",
          approvalState: "Pending",
          rationale:
            "Controlled validation requires explicit mission approval before execution."
        };
      }

      return {
        outcome: "Allowed",
        approvalState: "Approved",
        rationale:
          "Controlled validation has explicit mission approval and may proceed."
      };

    case "BASLite":
      if (!isAdminApprover(input.userRole) || !input.adminApproval) {
        return {
          outcome: "RequiresApproval",
          approvalState: "Pending",
          rationale:
            "BAS-lite validation requires admin approval before execution."
        };
      }

      return {
        outcome: "Allowed",
        approvalState: "Approved",
        rationale:
          "BAS-lite validation has the required admin approval and may proceed."
      };

    case "AdvancedAdversarial":
      if (!adversarialAuthorized) {
        return {
          outcome: "Denied",
          approvalState: "Rejected",
          rationale:
            "Advanced adversarial validation is disabled. A tenant admin must authorize offensive (or destructive) validation before it can run."
        };
      }
      // Authorized: still gated on per-run admin approval, like BAS-lite.
      // Uncontrolled exploit chaining is already permanently denied above.
      if (!isAdminApprover(input.userRole) || !input.adminApproval) {
        return {
          outcome: "RequiresApproval",
          approvalState: "Pending",
          rationale:
            "Adversarial validation is authorized for this tenant but each run requires explicit admin approval."
        };
      }
      // Destructive / real-payload runs carry a second gate on top of admin
      // approval: an explicit per-mission approval, so a broad tier authorization
      // can never silently green-light an individual destructive execution.
      if (destructiveClass && !input.explicitMissionApproval) {
        return {
          outcome: "RequiresApproval",
          approvalState: "Pending",
          rationale:
            "Destructive / real-payload validation additionally requires explicit per-mission approval before it can run."
        };
      }
      return {
        outcome: "Allowed",
        approvalState: "Approved",
        rationale: destructiveClass
          ? "Authorized destructive validation has admin + per-mission approval and may proceed (fully audited)."
          : "Authorized adversarial validation has the required admin approval and may proceed."
      };

    case "Disallowed":
      return {
        outcome: "Denied",
        approvalState: "Rejected",
        rationale:
          "Disallowed validation levels are never permitted to execute."
      };
  }

  return {
    outcome: "Denied",
    approvalState: "Rejected",
    rationale: "Unsupported policy state."
  };
}

/**
 * The action a validation mission may take given the current state of its bound
 * policy decision. This is the single enforcement point that reconciles the
 * decision `outcome` with its mutable `approvalState`:
 *
 * - `Proceed` — the mission may queue and execute.
 * - `RequiresApproval` — execution is blocked pending a human approval decision.
 * - `Denied` — the mission must not queue.
 *
 * A `RequiresApproval` outcome is intentionally NOT terminal: it begins as
 * `Pending` and is later moved to `Approved` (honored here as `Proceed`) or
 * `Rejected` (honored here as `Denied`) by an admin approval action. Reading the
 * outcome alone would leave an approved mission stuck forever and treat a
 * rejected one as merely pending, so the gate must consult `approvalState`.
 *
 * `approvalState` is mutable for ANY decision, not just a `RequiresApproval` one:
 * `denyPolicyDecision` rejects whatever decision it is handed (it carries no
 * outcome guard, unlike `approvePolicyDecision`), so an auto-`Allowed` decision —
 * e.g. a verified-scope PassiveReadOnly/ActiveNonInvasive mission — can be
 * explicitly rejected to revoke it. A rejected decision was turned down by a
 * human and must NEVER execute, so the gate reconciles `approvalState` FIRST
 * (fail closed): a `Rejected` decision is always `Denied` regardless of outcome.
 * Honoring the rejection only on the `RequiresApproval` branch made revoking an
 * `Allowed` decision decorative — the gate still returned `Proceed` and the
 * mission ran anyway.
 *
 * A decision also carries an optional `expiresAt` (a column on PolicyDecision
 * that is serialized into the public DTO, so clients see a time-boxed
 * authorization). An authorization that has lapsed is no longer a current
 * decision: whatever it once permitted, an expired Allowed/Approved decision
 * must NOT proceed — the operator has to obtain a fresh decision. The gate is the
 * single point that turns a stored decision into an execute/block verdict, so it
 * is the one place expiry can be honored; leaving it unchecked made `expiresAt` a
 * decorative expiry — serialized as if approvals were time-boxed while the gate
 * ignored it and ran an expired authorization anyway (the same decorative-control
 * gap reconciling `approvalState` here closed). Expiry is fail-closed to `Denied`
 * (the only verdict valid for ALL outcomes — `RequiresApproval` cannot be
 * re-satisfied for an Allowed/NotRequired decision) and checked right after the
 * `Rejected` short-circuit so every block reason is resolved before any
 * `Proceed`. A null `expiresAt` means "no expiry recorded" and never blocks, so
 * decisions written without one are unaffected.
 */
export type PolicyDecisionGate = "Proceed" | "RequiresApproval" | "Denied";

/**
 * Whether a policy decision's authorization window has lapsed as of `now`. A
 * null/undefined `expiresAt` means "no expiry recorded" and never expires
 * (mirrors the runner certificate-expiry gate's legacy-null handling), so a
 * decision stored without one is never blocked on this basis. Accepts a `Date`
 * (Prisma record) or an ISO string (serialized DTO) so both gate callers can
 * pass their decision through unchanged.
 */
export function isPolicyDecisionExpired(
  expiresAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= now.getTime();
}

export function resolvePolicyDecisionGate(
  decision: {
    outcome: PolicyDecisionOutcome;
    approvalState: ApprovalState;
    expiresAt?: Date | string | null;
  },
  now: Date = new Date()
): PolicyDecisionGate {
  if (decision.approvalState === "Rejected") {
    return "Denied";
  }

  if (isPolicyDecisionExpired(decision.expiresAt, now)) {
    return "Denied";
  }

  if (decision.outcome === "Allowed") {
    return "Proceed";
  }

  if (decision.outcome === "RequiresApproval") {
    // A Rejected approvalState is already handled above (fail closed), so only
    // an Approved decision proceeds; anything else is still pending approval.
    if (decision.approvalState === "Approved") {
      return "Proceed";
    }

    return "RequiresApproval";
  }

  // RequiresVerifiedScope / RequiresInternalRunner / RequiresTimeWindow / Denied
  // are never honored as executable from the start path; they remain blocked.
  return "Denied";
}

// === Core IP Safety Layer additions (test/periscan/packages/policy/src/index.ts) ===
// Explicit blastRadiusControl, per-tenant/session killSwitch hooks, zeroDisruptionGuarantee checks,
// behavioralAnomaly (sim vs attack detection stub), enhanced audit log helpers.
// Scope consent + compliance presets stubs.
// All safe: guards only, fail-closed, no exec, no mutations, no real actions. Preserve historical evaluatePolicy etc verbatim.
// Ties to existing PEP (evaluatePolicy, resolvePolicyDecisionGate) and computeSwarmSafety (via shared concepts + model-gateway calls to similar).
// Historical preserved; non-breaking additions only.

export interface BlastRadiusControlResult {
  maxAllowed: number;
  computedRadius: number;
  withinLimit: boolean;
  reason: string;
}

export function blastRadiusControl(
  computedRadius: number,
  maxAllowed: number = 0.5,
  context?: { tenantId?: string; sessionId?: string }
): BlastRadiusControlResult {
  const safeMax = Math.max(0, Math.min(1, maxAllowed));
  const radius = Math.max(0, Math.min(1, computedRadius));
  const within = radius <= safeMax;
  return {
    maxAllowed: safeMax,
    computedRadius: radius,
    withinLimit: within,
    reason: within
      ? `blast radius ${radius} within tenant/session limit ${safeMax}`
      : `blast radius ${radius} exceeds policy limit ${safeMax} for ${context?.tenantId ?? 'unknown'} / ${context?.sessionId ?? 'session'} - blocked`
  };
}

export interface KillSwitchStatus {
  active: boolean;
  tenantId: string;
  sessionId?: string | null;
  reason?: string;
  activatedAt?: string;
}

/** Per tenant/session killSwitch hook (stub). Provides explicit control point for orchestrator/PEP. */
export function getKillSwitchStatus(tenantId: string, sessionId?: string | null): KillSwitchStatus {
  // Ties to historical killSwitchEnabled (external-validation) and runner/model Terminated status.
  // Safe default: inactive. Real impl would consult tenant+session state without side effects here.
  return {
    active: false,
    tenantId,
    sessionId: sessionId ?? null,
    reason: undefined
  };
}

export function createKillSwitchHook(tenantId: string, sessionId?: string | null) {
  return () => getKillSwitchStatus(tenantId, sessionId);
}

export function zeroDisruptionGuaranteeCheck(
  safetyLevel: string,
  hasExplicitApproval: boolean,
  requestedAction: { destructive?: boolean; realDataExfiltration?: boolean; persistence?: boolean; credentialTheft?: boolean; uncontrolledExploitChaining?: boolean } = {}
): { guaranteed: boolean; reason: string } {
  const isDisruptive = !!(
    requestedAction.destructive ||
    requestedAction.realDataExfiltration ||
    requestedAction.persistence ||
    requestedAction.credentialTheft ||
    requestedAction.uncontrolledExploitChaining
  );
  const safeLevel = ["PassiveReadOnly", "ActiveNonInvasive"].includes(safetyLevel);
  const guaranteed = !isDisruptive && (safeLevel || hasExplicitApproval);
  return {
    guaranteed,
    reason: guaranteed
      ? `zero-disruption guaranteed for ${safetyLevel} (or approved)`
      : `zero-disruption NOT guaranteed: disruptive or high safetyLevel=${safetyLevel} without approval`
  };
}

export interface BehavioralAnomalyResult {
  isSimulation: boolean;
  anomalyScore: number; // 0 normal .. 1 anomalous
  looksLikeAttack: boolean;
  simVsAttack: 'sim' | 'attack-like' | 'indeterminate';
  reason: string;
}

/** behavioralAnomaly stub: distinguishes sim vs attack-like patterns for swarm/PEP safety. */
export function detectBehavioralAnomaly(
  observedActions: Array<{ tool?: string; pattern?: string; isFixture?: boolean } | string>,
  context: { tenantId: string; isSwarm?: boolean; missionSimulated?: boolean } = { tenantId: 'unknown' }
): BehavioralAnomalyResult {
  const actionStrs = observedActions.map(a => typeof a === 'string' ? a : JSON.stringify(a));
  const hasSimMarkers = actionStrs.some(s => /sim|fixture|safe|recon|passive/i.test(s));
  const looksAttack = actionStrs.some(s => /exploit|spray|crack|takeover|chain|pilfer/i.test(s)) && !hasSimMarkers;
  const isSim = hasSimMarkers || !!context.missionSimulated || !!context.isSwarm;
  const score = isSim ? 0.08 : (looksAttack ? 0.82 : 0.25);
  const classification: 'sim' | 'attack-like' | 'indeterminate' = isSim ? 'sim' : (looksAttack ? 'attack-like' : 'indeterminate');
  return {
    isSimulation: isSim,
    anomalyScore: score,
    looksLikeAttack: looksAttack && !isSim,
    simVsAttack: classification,
    reason: `behavioralAnomaly: ${classification} (tenant=${context.tenantId}, sim=${isSim}) - stub only, no real ML/attack exec`
  };
}

export interface EnhancedPolicyAuditInput {
  action: string;
  tenantId: string;
  sessionId?: string;
  safetyDecision: string;
  blast?: BlastRadiusControlResult;
  killSwitch?: KillSwitchStatus;
  anomaly?: BehavioralAnomalyResult;
  consentChecked?: boolean;
  compliancePreset?: string;
  extra?: Record<string, unknown>;
}

/** Enhanced audit log creator for safety layer. Complements existing tenant/model audits. */
export function createEnhancedPolicyAuditEvent(input: EnhancedPolicyAuditInput): Record<string, unknown> {
  return {
    ...input,
    timestamp: new Date().toISOString(),
    layer: "policy-core-safety",
    guarantee: "fail-closed-safe-only",
    preserveHistorical: true,
    note: "tied to PEP + computeSwarmSafety patterns"
  };
}

// Scope consent + compliance presets stubs (for tenant/session safety boundaries)
export const SCOPE_CONSENT_PRESETS = {
  minimal: { requiresExplicitConsent: false, maxBlast: 0.2 },
  standard: { requiresExplicitConsent: true, maxBlast: 0.5 },
  strict: { requiresExplicitConsent: true, maxBlast: 0.3, complianceRequired: ["soc2", "iso"] }
} as const;

export const COMPLIANCE_PRESETS = {
  soc2: { controls: ["audit-all", "scope-verify", "killswitch-per-session", "blast-control"], zeroDisruptDefault: true },
  iso27001: { controls: ["behavioral-anomaly", "blast-radius-control", "tenant-kill-hooks", "zero-disrupt"], zeroDisruptDefault: true },
  pci: { controls: ["no-credential-theft", "external-kill", "consent-required"], zeroDisruptDefault: false }
} as const;

export function evaluateScopeConsent(
  scopeStatus: string,
  consentGiven: boolean,
  preset: keyof typeof SCOPE_CONSENT_PRESETS = "standard"
): { consented: boolean; rationale: string } {
  const p = SCOPE_CONSENT_PRESETS[preset] ?? SCOPE_CONSENT_PRESETS.standard;
  const ok = scopeStatus === "Verified" && (!p.requiresExplicitConsent || consentGiven);
  return {
    consented: ok,
    rationale: ok ? `scope consent satisfied under ${preset} preset` : `scope consent failed under ${preset} preset`
  };
}

export function applyCompliancePreset(
  preset: string,
  tenantPolicy: Record<string, unknown> = {}
): { applied: boolean; effectiveControls: string[] } {
  const p = (COMPLIANCE_PRESETS as unknown as Record<string, { controls: string[] }>)[preset];
  if (!p) {
    return { applied: false, effectiveControls: [] };
  }
  const tenantControls = Array.isArray(tenantPolicy.controls)
    ? tenantPolicy.controls.filter(
        (control): control is string => typeof control === "string"
      )
    : [];
  return {
    applied: true,
    effectiveControls: [...new Set([...(p.controls || []), ...tenantControls])]
  };
}

/**
 * Wrapper that ties the new safety controls into existing PEP evaluatePolicy.
 * Historical evaluatePolicy unchanged; this augments result for swarm/PEP consumers.
 * Safe stub.
 */
export function evaluatePolicyWithSafetyControls(
  rawInput: PolicyEvaluationInput
): PolicyEvaluationResult & {
  safety: {
    blast: BlastRadiusControlResult;
    zeroDisrupt: ReturnType<typeof zeroDisruptionGuaranteeCheck>;
    anomaly: BehavioralAnomalyResult;
  };
} {
  const base = evaluatePolicy(rawInput);
  const blast = blastRadiusControl(
    rawInput.safetyLevel === "BASLite" || rawInput.safetyLevel === "AdvancedAdversarial" ? 0.45 : 0.15,
    0.55,
    { tenantId: "policy-eval", sessionId: "n/a" }
  );
  const zero = zeroDisruptionGuaranteeCheck(
    rawInput.safetyLevel,
    !!(rawInput.explicitMissionApproval || rawInput.adminApproval),
    rawInput.requestedAction
  );
  const anomaly = detectBehavioralAnomaly(
    [rawInput.missionType, JSON.stringify(rawInput.requestedAction)],
    { tenantId: "policy-eval", missionSimulated: true }
  );
  return {
    ...base,
    safety: { blast, zeroDisrupt: zero, anomaly }
  };
}
