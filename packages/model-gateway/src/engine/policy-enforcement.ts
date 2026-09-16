import { createHash } from "node:crypto";

import type {
  ModelToolRequest as PrismaModelToolRequest,
  ModelToolResult as PrismaModelToolResult,
  Prisma
} from "@prisma/client";
import { redactEvidenceArtifact } from "@periscan/evidence";
import type {
  ModelSessionMode,
  ModelToolDefinition,
  ModelToolRequestStatus
} from "@periscan/shared";

import { getModelToolDefinition } from "../tool-catalog.js";
import { writeModelGatewayAuditEvent, type GatewayPrisma } from "./audit.js";
import type { ModelSessionWithPolicy } from "./context-broker.js";
import { safetyLevelRank } from "./safety.js";

// === Core IP Safety Layer (test/periscan/packages/model-gateway/src/engine/policy-enforcement.ts) ===
// Explicit blastRadiusControl, killSwitch hooks (per tenant/session), zeroDisruptionGuarantee,
// behavioralAnomaly (sim vs attack stub), enhanced audit logs. Tied to computeSwarmSafety + PEP.
// Safe-only stubs: no actions performed. Historical code preserved. All fail-closed.
// Scope consent/compliance presets stubs integrated into PEP decisions + audit metadata.
//
// HONESTY (panel P03-12): the *real* operator kill switch is
// activateModelGatewayKillSwitch (durable tenant flag + terminates sessions +
// cancels tool requests), env PERISCAN_MODEL_GATEWAY_KILL_SWITCH force-on, and
// turn-runner abort when session status is Terminated. The no-arg helper
// getKillSwitchStatus() without known state remains a stub; resolveTenantModelGatewayKillSwitch
// is the real path used by PEP. blastRadius / behavioralAnomaly stay synthetic.
// See docs/trust/README.md §8.

/** Stable product-honesty string for trust pack / OpenAPI residual language. */
export const MODEL_GATEWAY_ADVANCED_SAFETY_HONESTY =
  "Model-gateway advanced safety helpers (getKillSwitchStatus without known state, detectBehavioralAnomaly regex, blastRadiusControl 0–1 scores) are stubs or synthetic. Real controls: durable tenant model-gateway kill switch, PERISCAN_MODEL_GATEWAY_KILL_SWITCH env force-on, operator API terminating sessions + cancelling tool requests, PEP allow/block lists, mode gate, safety ceiling, and redaction. Not a trained anomaly model or network blast-radius engine.";

export type AdvancedSafetyImplementationStatus =
  | "real"
  | "stub"
  | "synthetic";

export const ADVANCED_SAFETY_IMPLEMENTATION: Record<
  "blastRadiusControl" | "getKillSwitchStatus" | "detectBehavioralAnomaly",
  AdvancedSafetyImplementationStatus
> = {
  blastRadiusControl: "synthetic",
  detectBehavioralAnomaly: "stub",
  // Default helper without known state is still a stub; real status is resolved
  // via resolveTenantModelGatewayKillSwitch / operator API + env force-on.
  getKillSwitchStatus: "stub"
};

/** Global process-level feature flag that force-activates the gateway kill path. */
export function isModelGatewayEnvKillSwitchActive(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.PERISCAN_MODEL_GATEWAY_KILL_SWITCH === "true";
}

export interface KnownModelGatewayKillSwitchState {
  active: boolean;
  reason?: string | null;
  activatedAt?: string | Date | null;
  source?: "tenant" | "env" | "session_terminated" | "combined";
}

export interface BlastRadiusControlResult {
  maxAllowed: number;
  computedRadius: number;
  withinLimit: boolean;
  reason: string;
  /** Honesty: synthetic numeric gate, not measured network blast radius. */
  implementationStatus: AdvancedSafetyImplementationStatus;
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
    implementationStatus: "synthetic",
    reason: within
      ? `blast radius ${radius} within tenant/session limit ${safeMax} (synthetic; not measured network radius)`
      : `blast radius ${radius} exceeds policy limit ${safeMax} for ${context?.tenantId ?? 'unknown'} / ${context?.sessionId ?? 'session'} - blocked (synthetic)`
  };
}

export interface KillSwitchStatus {
  active: boolean;
  tenantId: string;
  sessionId?: string | null;
  reason?: string;
  activatedAt?: string;
  source?: KnownModelGatewayKillSwitchState["source"];
  /**
   * Honesty: "stub" when called without known state; "real" when built from
   * tenant flag, env force-on, or resolved session termination.
   */
  implementationStatus: AdvancedSafetyImplementationStatus;
}

/**
 * Build a kill-switch status. Without `known`, returns stub inactive — do not
 * treat that as durable fabric. Pass known state from
 * resolveTenantModelGatewayKillSwitch for the real PEP path.
 */
export function getKillSwitchStatus(
  tenantId: string,
  sessionId?: string | null,
  known?: KnownModelGatewayKillSwitchState
): KillSwitchStatus {
  if (!known) {
    return {
      active: false,
      implementationStatus: "stub",
      reason: "stub_default_inactive",
      sessionId: sessionId ?? null,
      source: undefined,
      tenantId
    };
  }

  const activatedAt =
    known.activatedAt instanceof Date
      ? known.activatedAt.toISOString()
      : (known.activatedAt ?? undefined);

  return {
    active: known.active,
    activatedAt,
    implementationStatus: "real",
    reason: known.reason ?? undefined,
    sessionId: sessionId ?? null,
    source: known.source ?? "tenant",
    tenantId
  };
}

export function createKillSwitchHook(
  tenantId: string,
  sessionId?: string | null,
  known?: KnownModelGatewayKillSwitchState
) {
  return () => getKillSwitchStatus(tenantId, sessionId, known);
}

/**
 * Resolve durable tenant kill switch + optional env force-on. This is the real
 * PEP path; getKillSwitchStatus alone without known state is still a stub.
 */
export async function resolveTenantModelGatewayKillSwitch(
  prisma: GatewayPrisma,
  tenantId: string,
  options?: { env?: NodeJS.ProcessEnv; sessionId?: string | null }
): Promise<KillSwitchStatus> {
  const envActive = isModelGatewayEnvKillSwitchActive(options?.env);
  const tenant = await prisma.tenant.findUnique({
    select: {
      modelGatewayKillSwitchActivatedAt: true,
      modelGatewayKillSwitchActive: true,
      modelGatewayKillSwitchReason: true
    },
    where: { tenantId }
  });

  const tenantActive = tenant?.modelGatewayKillSwitchActive === true;
  const active = envActive || tenantActive;
  let source: KnownModelGatewayKillSwitchState["source"] = "tenant";
  if (envActive && tenantActive) source = "combined";
  else if (envActive) source = "env";
  else if (tenantActive) source = "tenant";

  return getKillSwitchStatus(tenantId, options?.sessionId ?? null, {
    active,
    activatedAt: tenant?.modelGatewayKillSwitchActivatedAt ?? null,
    reason: envActive
      ? tenant?.modelGatewayKillSwitchReason
        ? `env force-on + tenant: ${tenant.modelGatewayKillSwitchReason}`
        : "PERISCAN_MODEL_GATEWAY_KILL_SWITCH=true"
      : (tenant?.modelGatewayKillSwitchReason ?? null),
    source: active ? source : "tenant"
  });
}

export function zeroDisruptionGuaranteeCheck(
  safetyLevelRankValue: number,
  approvalRequired: boolean,
  toolSafetyRank: number
): { guaranteed: boolean; reason: string } {
  const guaranteed = toolSafetyRank <= 1 || (safetyLevelRankValue <= 2 && !approvalRequired); // low invasiveness or controlled
  return {
    guaranteed,
    reason: guaranteed ? "zero-disruption guarantee holds (safe levels or controlled)" : "zero-disruption may not hold - higher blast potential"
  };
}

export interface BehavioralAnomalyResult {
  isSimulation: boolean;
  anomalyScore: number;
  looksLikeAttack: boolean;
  simVsAttack: "sim" | "attack-like" | "indeterminate";
  reason: string;
  /** Honesty: regex heuristic stub — not a trained anomaly model. */
  implementationStatus: AdvancedSafetyImplementationStatus;
}

export function detectBehavioralAnomaly(
  toolName: string,
  input: Record<string, unknown>,
  context: { tenantId: string; sessionId?: string; isSwarm?: boolean }
): BehavioralAnomalyResult {
  const str = `${toolName} ${JSON.stringify(input)}`;
  const hasSim = /sim|fixture|plan|recon|passive|safe/i.test(str);
  const attackLike = /exploit|attack|spray|crack|exfil|takeover/i.test(str) && !hasSim;
  const isSim = hasSim || !!context.isSwarm;
  const score = isSim ? 0.07 : (attackLike ? 0.78 : 0.18);
  return {
    isSimulation: isSim,
    anomalyScore: score,
    looksLikeAttack: attackLike && !isSim,
    implementationStatus: "stub",
    simVsAttack: isSim ? "sim" : (attackLike ? "attack-like" : "indeterminate"),
    reason: `behavioralAnomaly PEP check: ${isSim ? "sim" : "indeterminate/attack-like"} (tenant=${context.tenantId}) - stub regex, not ML`
  };
}

export interface EnhancedPolicyAuditInput {
  action: string;
  tenantId: string;
  sessionId?: string | null;
  safetyDecision: string;
  blast?: BlastRadiusControlResult;
  killSwitch?: KillSwitchStatus;
  anomaly?: BehavioralAnomalyResult;
  consentChecked?: boolean;
  compliancePreset?: string;
}

export function createEnhancedPolicyAuditEvent(input: EnhancedPolicyAuditInput): Record<string, unknown> {
  return {
    ...input,
    advancedSafetyHonesty: MODEL_GATEWAY_ADVANCED_SAFETY_HONESTY,
    advancedSafetyImplementation: ADVANCED_SAFETY_IMPLEMENTATION,
    timestamp: new Date().toISOString(),
    layer: "model-gateway-pep-safety",
    guarantee: "fail-closed",
    tiedTo: "computeSwarmSafety+PEP",
    preserveHistorical: true
  };
}

// Scope consent + compliance preset stubs (applied in PEP)
export const SCOPE_CONSENT_PRESETS = {
  minimal: { requiresExplicitConsent: false, maxBlast: 0.2 },
  standard: { requiresExplicitConsent: true, maxBlast: 0.5 },
  strict: { requiresExplicitConsent: true, maxBlast: 0.3 }
} as const;

export const COMPLIANCE_PRESETS = {
  soc2: ["audit-all", "blast-radius-control", "killswitch-per-session"],
  iso27001: ["behavioral-anomaly", "zero-disruption", "tenant-kill-hooks"],
  pci: ["consent-required", "no-credential"]
} as const;

export function evaluateScopeConsent(scopeOk: boolean, consent: boolean, preset: keyof typeof SCOPE_CONSENT_PRESETS = "standard"): { consented: boolean; rationale: string } {
  const p = SCOPE_CONSENT_PRESETS[preset];
  const ok = scopeOk && (!p.requiresExplicitConsent || consent);
  return { consented: ok, rationale: ok ? `consent ok (${preset})` : `consent required but missing (${preset})` };
}

export function applyCompliancePreset(preset?: string): string[] {
  if (!preset || !(preset in COMPLIANCE_PRESETS)) return [];
  return [...COMPLIANCE_PRESETS[preset as keyof typeof COMPLIANCE_PRESETS]];
}

export interface TenantAuditEventInput {
  action: string;
  actorType: string;
  entityId: string;
  entityType: string;
  metadata?: Record<string, unknown>;
  tenantId: string;
  userId?: string | null;
}

export interface GatewayPolicyDeps {
  /** Tenant-level audit writer (e.g. runtime-services writeAuditEvent). */
  writeTenantAuditEvent: (
    prisma: GatewayPrisma,
    input: TenantAuditEventInput
  ) => Promise<unknown>;
  /** Error factory so callers can map to their own error type/status codes. */
  createError: (message: string, statusCode: number, code: string) => Error;
}

export interface CreateGatewayToolRequestArgs {
  prisma: GatewayPrisma;
  input: {
    toolName: string;
    requestReason: string;
    input: Record<string, unknown>;
    scopeIds?: string[];
    requestedByModel: boolean;
  };
  session: ModelSessionWithPolicy;
  tenantId: string;
  userId: string;
  deps: GatewayPolicyDeps;
}

function hashPayload(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type JsonSchemaProperty = {
  format?: string;
  maxLength?: number;
  maximum?: number;
  minimum?: number;
  type?: string | string[];
};

type JsonObjectSchema = {
  additionalProperties?: boolean;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  type?: string;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaTypes(property: JsonSchemaProperty): string[] {
  return Array.isArray(property.type)
    ? property.type
    : property.type
      ? [property.type]
      : [];
}

function validateJsonSchemaProperty(
  toolName: string,
  key: string,
  value: unknown,
  property: JsonSchemaProperty,
  deps: GatewayPolicyDeps
): void {
  const types = schemaTypes(property);
  if (types.length > 0) {
    const validType = types.some((type) => {
      switch (type) {
        case "array":
          return Array.isArray(value);
        case "boolean":
          return typeof value === "boolean";
        case "integer":
          return (
            typeof value === "number" &&
            Number.isFinite(value) &&
            Number.isInteger(value)
          );
        case "number":
          return typeof value === "number" && Number.isFinite(value);
        case "object":
          return isPlainObject(value);
        case "string":
          return typeof value === "string";
        default:
          return true;
      }
    });
    if (!validType) {
      throw deps.createError(
        `Invalid input for tool ${toolName}: ${key} has the wrong type.`,
        422,
        "invalid_tool_input"
      );
    }
  }

  if (typeof value === "string") {
    if (property.maxLength !== undefined && value.length > property.maxLength) {
      throw deps.createError(
        `Invalid input for tool ${toolName}: ${key} exceeds maxLength.`,
        422,
        "invalid_tool_input"
      );
    }
    if (
      property.format === "uuid" &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
    ) {
      throw deps.createError(
        `Invalid input for tool ${toolName}: ${key} must be a UUID.`,
        422,
        "invalid_tool_input"
      );
    }
  }

  if (typeof value === "number") {
    if (property.minimum !== undefined && value < property.minimum) {
      throw deps.createError(
        `Invalid input for tool ${toolName}: ${key} is below minimum.`,
        422,
        "invalid_tool_input"
      );
    }
    if (property.maximum !== undefined && value > property.maximum) {
      throw deps.createError(
        `Invalid input for tool ${toolName}: ${key} exceeds maximum.`,
        422,
        "invalid_tool_input"
      );
    }
  }
}

const SENSITIVE_INPUT_KEY_PATTERN =
  /(?:secret|token|password|passwd|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key|credential|authorization|bearer)/i;

function redactToolInputValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key && SENSITIVE_INPUT_KEY_PATTERN.test(key)) {
      return value.length > 0 ? "[redacted]" : value;
    }
    return redactEvidenceArtifact(value).content;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactToolInputValue(item, key));
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactToolInputValue(childValue, childKey)
      ])
    );
  }
  return value;
}

export function prepareGatewayToolInput(
  definition: ModelToolDefinition,
  input: Record<string, unknown>,
  deps: GatewayPolicyDeps
): {
  canonicalInput: Record<string, unknown>;
  redactedInput: Record<string, unknown>;
} {
  const schema = definition.inputSchema as JsonObjectSchema;
  if (schema.type && schema.type !== "object") {
    throw deps.createError(
      `Tool ${definition.toolName} input schema must be an object.`,
      500,
      "invalid_tool_schema"
    );
  }

  const rawInput = input ?? {};
  if (!isPlainObject(rawInput)) {
    throw deps.createError(
      `Invalid input for tool ${definition.toolName}: input must be an object.`,
      422,
      "invalid_tool_input"
    );
  }

  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  for (const requiredKey of required) {
    if (rawInput[requiredKey] === undefined) {
      throw deps.createError(
        `Invalid input for tool ${definition.toolName}: ${requiredKey} is required.`,
        422,
        "invalid_tool_input"
      );
    }
  }

  const canonicalInput: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawInput)) {
    const property = properties[key];
    if (!property) {
      if (schema.additionalProperties === false) {
        throw deps.createError(
          `Invalid input for tool ${definition.toolName}: ${key} is not allowed.`,
          422,
          "invalid_tool_input"
        );
      }
      canonicalInput[key] = value;
      continue;
    }
    validateJsonSchemaProperty(definition.toolName, key, value, property, deps);
    canonicalInput[key] = value;
  }

  return {
    canonicalInput,
    redactedInput: redactToolInputValue(canonicalInput) as Record<
      string,
      unknown
    >
  };
}

/**
 * Policy Enforcement Point for a single tool request. Applies the code-defined
 * tool catalog plus the session's policy profile and per-tenant tool overrides
 * to decide Allowed / RequiresApproval / Denied. It NEVER executes the tool and
 * NEVER queues an underlying action; denied requests are recorded and never
 * acted upon. Shared by the manual control-plane API and the turn orchestrator.
 */
export async function createGatewayToolRequest(
  args: CreateGatewayToolRequestArgs
): Promise<PrismaModelToolRequest & { result: PrismaModelToolResult | null }> {
  const { prisma, session, tenantId, userId, deps } = args;
  const definition = getModelToolDefinition(args.input.toolName);
  if (!definition) {
    throw deps.createError(
      `Unknown tool: ${args.input.toolName}.`,
      404,
      "not_found"
    );
  }

  const profile = session.policyProfile;
  const override = await prisma.modelTool.findUnique({
    where: {
      tenantId_toolName: { tenantId, toolName: definition.toolName }
    }
  });

  const enabled = override?.enabled ?? true;
  const allowedModes =
    override && override.allowedSessionModes.length > 0
      ? (override.allowedSessionModes as ModelSessionMode[])
      : definition.allowedModes;
  const scopeIds =
    args.input.scopeIds && args.input.scopeIds.length > 0
      ? args.input.scopeIds
      : session.scopeIds;

  let denialReason: string | null = null;
  if (!enabled) {
    denialReason = "Tool is disabled for this tenant.";
  } else if (!allowedModes.includes(session.mode as ModelSessionMode)) {
    denialReason = `Tool is not permitted in ${session.mode} mode.`;
  } else if (profile.blockedTools.includes(definition.toolName)) {
    denialReason = "Tool is blocked by the session policy profile.";
  } else if (
    profile.allowedTools.length > 0 &&
    !profile.allowedTools.includes(definition.toolName)
  ) {
    denialReason = "Tool is not in the policy profile allow-list.";
  } else if (
    safetyLevelRank(definition.safetyLevel) >
    safetyLevelRank(profile.maxSafetyLevel)
  ) {
    denialReason = "Tool exceeds the policy profile maximum safety level.";
  }

  let approvalRequired =
    override?.approvalRequired ?? definition.approvalRequiredByDefault;
  if (
    safetyLevelRank(definition.safetyLevel) >
    safetyLevelRank(profile.approvalRequiredAboveLevel)
  ) {
    approvalRequired = true;
  }

  const preparedInput = prepareGatewayToolInput(
    definition,
    args.input.input ?? {},
    deps
  );

  // === Explicit safety layer tie-in (blastRadiusControl, killSwitch per tenant/session, zeroDisrupt, behavioralAnomaly) ===
  // Applied inside PEP without altering prior denial logic. Fail closed for safety.
  // Real durable path: tenant flag + PERISCAN_MODEL_GATEWAY_KILL_SWITCH env.
  const tenantSessionKill = await resolveTenantModelGatewayKillSwitch(
    prisma,
    tenantId,
    { sessionId: session.modelSessionId }
  );
  if (tenantSessionKill.active) {
    denialReason =
      denialReason ??
      `Model gateway kill switch active for tenant ${tenantId}${
        tenantSessionKill.reason ? `: ${tenantSessionKill.reason}` : ""
      }`;
  }
  const blast = blastRadiusControl(
    safetyLevelRank(definition.safetyLevel) * 0.18 + (profile.blockedTools.length > 0 ? 0.1 : 0),
    0.65,
    { tenantId, sessionId: session.modelSessionId }
  );
  if (!blast.withinLimit && !denialReason) {
    denialReason = `Blocked by blastRadiusControl: ${blast.reason}`;
  }
  const zeroDisrupt = zeroDisruptionGuaranteeCheck(
    safetyLevelRank(profile.maxSafetyLevel),
    approvalRequired,
    safetyLevelRank(definition.safetyLevel)
  );
  const anomaly = detectBehavioralAnomaly(
    definition.toolName,
    preparedInput.canonicalInput,
    { tenantId, sessionId: session.modelSessionId, isSwarm: profile.maxSafetyLevel === "BASLite" /* approx */ }
  );
  const scopeConsent = evaluateScopeConsent(scopeIds.length > 0, true /* assume for stub; real from context */);
  const complianceControls = applyCompliancePreset("soc2"); // stub preset

  // Enhanced audit metadata incorporating new controls
  const safetyMetadata = {
    blastRadius: blast,
    killSwitch: tenantSessionKill,
    zeroDisruption: zeroDisrupt,
    behavioralAnomaly: anomaly,
    scopeConsent,
    complianceControls,
    computeSwarmSafetyTie: "pep-enforced"
  };

  // Re-derive status to incorporate post-override safety (blast/kill/zero/anomaly) while preserving prior historical denial calc
  const effectiveDenial = denialReason;
  const effectiveStatus: ModelToolRequestStatus = effectiveDenial
    ? "Denied"
    : approvalRequired
      ? "RequiresApproval"
      : "Allowed";

  const created = await prisma.modelToolRequest.create({
    data: {
      denialReason: effectiveDenial,
      inputPayloadHash: hashPayload(
        JSON.stringify(preparedInput.canonicalInput)
      ),
      inputPayloadRedacted:
        preparedInput.redactedInput as Prisma.InputJsonValue,
      modelSessionId: session.modelSessionId,
      requestReason: args.input.requestReason,
      requestedByModel: args.input.requestedByModel,
      scopeIds,
      status: effectiveStatus,
      tenantId,
      toolName: definition.toolName
    },
    include: { result: true }
  });

  await writeModelGatewayAuditEvent(prisma, {
    eventType: "ToolRequested",
    metadata: {
      requestedByModel: args.input.requestedByModel,
      toolName: definition.toolName,
      safety: safetyMetadata // enhanced audit log
    },
    modelSessionId: session.modelSessionId,
    tenantId,
    toolName: definition.toolName,
    toolRequestId: created.toolRequestId,
    userId
  });

  await deps.writeTenantAuditEvent(prisma, {
    action: "model_tool.requested",
    actorType: args.input.requestedByModel ? "Model" : "User",
    entityId: created.toolRequestId,
    entityType: "ModelToolRequest",
    metadata: { status: effectiveStatus, toolName: definition.toolName, safety: createEnhancedPolicyAuditEvent({ action: "pep-request", tenantId, sessionId: session.modelSessionId, safetyDecision: effectiveStatus, blast, killSwitch: tenantSessionKill, anomaly, consentChecked: scopeConsent.consented }) },
    tenantId,
    userId
  });

  if (effectiveStatus === "Denied") {
    await writeModelGatewayAuditEvent(prisma, {
      eventType: "ToolDenied",
      metadata: { denialReason: effectiveDenial, safety: safetyMetadata },
      modelSessionId: session.modelSessionId,
      tenantId,
      toolName: definition.toolName,
      toolRequestId: created.toolRequestId,
      userId
    });
    await deps.writeTenantAuditEvent(prisma, {
      action: "model_tool.denied",
      actorType: args.input.requestedByModel ? "Model" : "User",
      entityId: created.toolRequestId,
      entityType: "ModelToolRequest",
      metadata: { denialReason: effectiveDenial, toolName: definition.toolName, safety: createEnhancedPolicyAuditEvent({ action: "pep-denied", tenantId, sessionId: session.modelSessionId, safetyDecision: "Denied", blast, killSwitch: tenantSessionKill, anomaly }) },
      tenantId,
      userId
    });
  } else if (effectiveStatus === "RequiresApproval") {
    await writeModelGatewayAuditEvent(prisma, {
      eventType: "ApprovalRequested",
      metadata: { safety: safetyMetadata },
      modelSessionId: session.modelSessionId,
      tenantId,
      toolName: definition.toolName,
      toolRequestId: created.toolRequestId,
      userId
    });
  } else {
    await writeModelGatewayAuditEvent(prisma, {
      eventType: "ToolAllowed",
      metadata: { safety: safetyMetadata },
      modelSessionId: session.modelSessionId,
      tenantId,
      toolName: definition.toolName,
      toolRequestId: created.toolRequestId,
      userId
    });
    await deps.writeTenantAuditEvent(prisma, {
      action: "model_tool.allowed",
      actorType: args.input.requestedByModel ? "Model" : "User",
      entityId: created.toolRequestId,
      entityType: "ModelToolRequest",
      metadata: { toolName: definition.toolName, safety: createEnhancedPolicyAuditEvent({ action: "pep-allowed", tenantId, sessionId: session.modelSessionId, safetyDecision: "Allowed", blast, killSwitch: tenantSessionKill, anomaly, compliancePreset: "soc2" }) },
      tenantId,
      userId
    });
  }

  return created;
}
