import { z } from "zod";

import {
  MissionTypeSchema,
  SafetyLevelSchema,
  type MissionType,
  type SafetyLevel
} from "./domain";
import {
  isRunnerMeasuredModuleId,
  RUNNER_MEASURED_MODULE_IDS,
  RunnerTaskEnvelopeSchema,
  type RunnerMeasuredModuleId
} from "./runner";

/**
 * Hybrid Execution Compiler (matrix #30) + passive multi-agent assembly (#29).
 *
 * Product honesty:
 * - Compiles mission plans into **signed runner task payloads** for
 *   allowlisted measured modules only (passive / non-invasive).
 * - Does **not** claim full hybrid AI/graph BAS compile, live APT, Atomic,
 *   or multi-agent offensive swarm. Scaffold until Fully-E2E measured surface.
 * - Multi-agent here means **role-tagged passive step assembly with policy**,
 *   not autonomous offense orchestration.
 */

export const HYBRID_COMPILER_PRODUCT_STATUS = {
  claimLanguage: "passive_allowlisted_compile_to_signed_task",
  fullyE2EMeasuredSurface: false,
  liveAptAtomicSupported: false,
  multiAgentOffensiveSwarmSupported: false,
  status: "Partial" as const,
  summary:
    "Mission plan compiles to Ed25519-signed runner task envelopes for allowlisted passive measured modules only. Not full hybrid BAS / multi-agent offense."
};

const IdSchema = z.string().uuid();

export const HybridCompilerAgentRoleSchema = z.enum([
  "dns_posture",
  "tls_posture",
  "http_posture",
  "endpoint_canary",
  "operator_intent"
]);
export type HybridCompilerAgentRole = z.infer<
  typeof HybridCompilerAgentRoleSchema
>;

/** Role templates for passive multi-step mission assembly (not BAS swarm). */
export const PASSIVE_MULTI_AGENT_ROLE_TEMPLATES: ReadonlyArray<{
  agentRole: HybridCompilerAgentRole;
  description: string;
  moduleIds: readonly RunnerMeasuredModuleId[];
  safetyCeiling: SafetyLevel;
}> = [
  {
    agentRole: "dns_posture",
    description: "Passive DNS resolution posture on verified scope.",
    moduleIds: ["periscan.dns_resolution_check"],
    safetyCeiling: "PassiveReadOnly"
  },
  {
    agentRole: "tls_posture",
    description: "TLS certificate and protocol posture checks.",
    moduleIds: [
      "periscan.tls_certificate_check",
      "periscan.tls_protocol_audit"
    ],
    safetyCeiling: "ActiveNonInvasive"
  },
  {
    agentRole: "http_posture",
    description: "HTTP health, cookie, redirect, and CORS posture.",
    moduleIds: [
      "periscan.http_health_check",
      "periscan.http_cookie_security",
      "periscan.http_redirect_enforcement",
      "periscan.http_cors_audit"
    ],
    safetyCeiling: "ActiveNonInvasive"
  },
  {
    agentRole: "endpoint_canary",
    description:
      "Benign endpoint marker emit only — not malware or credential theft.",
    moduleIds: ["periscan.endpoint_benign_marker_emit"],
    safetyCeiling: "ControlledValidation"
  }
];

const SAFETY_RANK: Record<SafetyLevel, number> = {
  PassiveReadOnly: 0,
  ActiveNonInvasive: 1,
  ControlledValidation: 2,
  BASLite: 3,
  AdvancedAdversarial: 4,
  Disallowed: 5
};

export function isHybridCompilerPassiveModuleId(
  moduleId: string
): moduleId is RunnerMeasuredModuleId {
  if (!isRunnerMeasuredModuleId(moduleId)) {
    return false;
  }
  // endpoint marker is ControlledValidation canary class — still allowlisted
  // but never defaulted into multi-agent assembly without explicit intent.
  return true;
}

export function selectPassiveModulesForIntent(
  intent: string,
  maximumSteps = 4
): RunnerMeasuredModuleId[] {
  const tokens = new Set(
    intent
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 3)
  );
  const wantsCanary =
    tokens.has("canary") ||
    tokens.has("marker") ||
    tokens.has("endpoint");
  const ordered: RunnerMeasuredModuleId[] = [];
  for (const role of PASSIVE_MULTI_AGENT_ROLE_TEMPLATES) {
    if (role.agentRole === "endpoint_canary" && !wantsCanary) {
      continue;
    }
    for (const moduleId of role.moduleIds) {
      const hay = `${role.agentRole} ${role.description} ${moduleId}`.toLowerCase();
      const matched =
        tokens.size === 0 ||
        [...tokens].some((token) => hay.includes(token));
      if (matched && !ordered.includes(moduleId)) {
        ordered.push(moduleId);
      }
      if (ordered.length >= maximumSteps) {
        return ordered;
      }
    }
  }
  if (ordered.length === 0) {
    return RUNNER_MEASURED_MODULE_IDS.filter(
      (id) => id !== "periscan.endpoint_benign_marker_emit"
    ).slice(0, maximumSteps) as RunnerMeasuredModuleId[];
  }
  return ordered.slice(0, maximumSteps);
}

export function agentRoleForModule(
  moduleId: string
): HybridCompilerAgentRole {
  for (const role of PASSIVE_MULTI_AGENT_ROLE_TEMPLATES) {
    if ((role.moduleIds as readonly string[]).includes(moduleId)) {
      return role.agentRole;
    }
  }
  return "operator_intent";
}

export function highestSafetyAmong(
  levels: SafetyLevel[]
): SafetyLevel {
  return levels.reduce<SafetyLevel>(
    (highest, level) =>
      SAFETY_RANK[level] > SAFETY_RANK[highest] ? level : highest,
    "PassiveReadOnly"
  );
}

export const HybridMissionPlanStepSchema = z.object({
  agentRole: HybridCompilerAgentRoleSchema,
  dependsOn: z.array(z.string().min(1)).max(20).default([]),
  moduleId: z.string().min(1),
  name: z.string().min(1).max(160),
  safetyLevel: SafetyLevelSchema,
  stepKey: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/u)
});
export type HybridMissionPlanStep = z.infer<typeof HybridMissionPlanStepSchema>;

export const HybridMissionPlanSchema = z.object({
  intent: z.string().trim().min(1).max(2_000),
  missionType: MissionTypeSchema.default("ExposureValidation"),
  moduleIds: z.array(z.string().min(1)).min(1).max(20),
  safetyCeiling: SafetyLevelSchema,
  scopeId: IdSchema,
  steps: z.array(HybridMissionPlanStepSchema).min(1).max(20),
  targetHost: z.string().min(1).max(253)
});
export type HybridMissionPlan = z.infer<typeof HybridMissionPlanSchema>;

export const CompileHybridExecutionInputSchema = z
  .object({
    intent: z.string().trim().min(1).max(2_000).optional(),
    maximumSteps: z.number().int().min(1).max(12).default(4),
    /** When true, persist Queued runner tasks; default is signed payload compile only. */
    queueTasks: z.boolean().default(false),
    moduleIds: z.array(z.string().min(1)).max(20).optional(),
    path: z.string().min(1).max(512).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
    runnerId: IdSchema,
    scheme: z.enum(["http", "https"]).optional(),
    scopeId: IdSchema,
    targetHost: z.string().min(1).max(253),
    timeoutSeconds: z.number().int().min(1).max(30).default(5)
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.moduleIds?.length && !value.intent) {
      context.addIssue({
        code: "custom",
        message: "Provide moduleIds or intent for hybrid compile.",
        path: ["moduleIds"]
      });
    }
  });
export type CompileHybridExecutionInput = z.infer<
  typeof CompileHybridExecutionInputSchema
>;

export const HybridCompileRejectedStepSchema = z.object({
  moduleId: z.string().min(1),
  reason: z.string().min(1),
  reasonCode: z.enum([
    "not_runner_measured",
    "module_not_found",
    "safety_not_passive_compatible",
    "policy_denied",
    "scope_mismatch",
    "missing_port",
    "missing_canary_fields"
  ])
});
export type HybridCompileRejectedStep = z.infer<
  typeof HybridCompileRejectedStepSchema
>;

export const HybridCompiledStepSchema = z.object({
  agentRole: HybridCompilerAgentRoleSchema,
  envelope: RunnerTaskEnvelopeSchema,
  moduleId: z.string().min(1),
  policyDecisionId: IdSchema.nullable(),
  queued: z.boolean(),
  runId: IdSchema.nullable(),
  safetyLevel: SafetyLevelSchema,
  stepKey: z.string().min(1),
  taskId: IdSchema
});
export type HybridCompiledStep = z.infer<typeof HybridCompiledStepSchema>;

export const CompileHybridExecutionResponseSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  compiledAt: z.string().datetime(),
  compiledHash: z.string().regex(/^[a-f0-9]{64}$/u),
  honesty: z.object({
    claimLanguage: z.string().min(1),
    fullyE2EMeasuredSurface: z.literal(false),
    liveAptAtomicSupported: z.literal(false),
    multiAgentOffensiveSwarmSupported: z.literal(false),
    status: z.enum(["Partial", "Scaffold"]),
    summary: z.string().min(1)
  }),
  missionId: IdSchema.nullable(),
  missionPlan: HybridMissionPlanSchema,
  queuedTaskCount: z.number().int().nonnegative(),
  rejected: z.array(HybridCompileRejectedStepSchema),
  steps: z.array(HybridCompiledStepSchema)
});
export type CompileHybridExecutionResponse = z.infer<
  typeof CompileHybridExecutionResponseSchema
>;

export const AssemblePassiveMultiAgentPlanInputSchema = z
  .object({
    intent: z.string().trim().min(1).max(2_000),
    maximumSteps: z.number().int().min(1).max(12).default(4),
    scopeId: IdSchema,
    targetHost: z.string().min(1).max(253)
  })
  .strict();
export type AssemblePassiveMultiAgentPlanInput = z.infer<
  typeof AssemblePassiveMultiAgentPlanInputSchema
>;

export const AssemblePassiveMultiAgentPlanResponseSchema = z.object({
  honesty: z.object({
    claimLanguage: z.literal("passive_role_assembly_not_bas_swarm"),
    /** Assembly persists Draft missions only — never auto-starts BAS swarm. */
    draftMissionsOnly: z.literal(true),
    multiAgentOffensiveSwarmSupported: z.literal(false),
    status: z.enum(["Partial", "Scaffold"]),
    summary: z.string().min(1)
  }),
  /** Persisted ValidationMission in Draft status when assembly ran via API. */
  missionId: IdSchema.nullable(),
  missionStatus: z.literal("Draft").nullable(),
  missionPlan: HybridMissionPlanSchema,
  policyPreview: z.object({
    approvalRequired: z.boolean(),
    executionEnvironment: z.literal("InternalRunner"),
    requestedAction: z.object({
      credentialTheft: z.literal(false),
      destructive: z.literal(false),
      persistence: z.literal(false),
      realDataExfiltration: z.literal(false),
      requiresInternalRunner: z.literal(true),
      requiresTimeWindow: z.literal(false),
      uncontrolledExploitChaining: z.literal(false)
    }),
    safetyCeiling: SafetyLevelSchema
  })
});
export type AssemblePassiveMultiAgentPlanResponse = z.infer<
  typeof AssemblePassiveMultiAgentPlanResponseSchema
>;

/** Conversational threat builder (#33): real draft object, not executable BAS. */
export const ConversationalMissionDraftSchema = z.object({
  createdAt: z.string().datetime(),
  draftId: IdSchema,
  executable: z.literal(false),
  honesty: z.object({
    claimLanguage: z.literal("mission_draft_not_executable_bas"),
    conversationalOnly: z.literal(true),
    summary: z.string().min(1)
  }),
  intent: z.string().min(1),
  missionType: MissionTypeSchema,
  moduleIds: z.array(z.string().min(1)),
  nextSteps: z.array(z.string().min(1)).min(1),
  safetyCeiling: SafetyLevelSchema,
  scopeId: IdSchema.nullable(),
  source: z.enum([
    "AevProofPlanPreset",
    "ThreatLibraryProofPreset",
    "FreeformIntent"
  ]),
  steps: z.array(HybridMissionPlanStepSchema),
  targetHost: z.string().nullable(),
  title: z.string().min(1).max(160)
});
export type ConversationalMissionDraft = z.infer<
  typeof ConversationalMissionDraftSchema
>;

export const CreateConversationalMissionDraftInputSchema = z
  .object({
    intent: z.string().trim().min(1).max(2_000),
    maximumSteps: z.number().int().min(1).max(12).default(4),
    scopeId: IdSchema.optional(),
    source: z
      .enum([
        "AevProofPlanPreset",
        "ThreatLibraryProofPreset",
        "FreeformIntent"
      ])
      .default("FreeformIntent"),
    targetHost: z.string().min(1).max(253).optional(),
    title: z.string().trim().min(1).max(160).optional()
  })
  .strict();
export type CreateConversationalMissionDraftInput = z.infer<
  typeof CreateConversationalMissionDraftInputSchema
>;

export function buildHybridMissionPlanSteps(
  moduleIds: string[],
  moduleMeta: Array<{ moduleId: string; name: string; safetyLevel: SafetyLevel }>
): HybridMissionPlanStep[] {
  const metaById = new Map(moduleMeta.map((item) => [item.moduleId, item]));
  return moduleIds.map((moduleId, index) => {
    const meta = metaById.get(moduleId);
    const stepKey = `step-${index + 1}`;
    const previous = index > 0 ? `step-${index}` : null;
    return HybridMissionPlanStepSchema.parse({
      agentRole: agentRoleForModule(moduleId),
      dependsOn: previous ? [previous] : [],
      moduleId,
      name: meta?.name ?? moduleId,
      safetyLevel: meta?.safetyLevel ?? "PassiveReadOnly",
      stepKey
    });
  });
}

export function buildConversationalMissionDraft(input: {
  createdAt: string;
  draftId: string;
  intent: string;
  moduleMeta: Array<{
    moduleId: string;
    name: string;
    safetyLevel: SafetyLevel;
  }>;
  moduleIds: string[];
  missionType?: MissionType;
  scopeId?: string | null;
  source: ConversationalMissionDraft["source"];
  targetHost?: string | null;
  title?: string;
}): ConversationalMissionDraft {
  const steps = buildHybridMissionPlanSteps(input.moduleIds, input.moduleMeta);
  const safetyCeiling = highestSafetyAmong(
    steps.map((step) => step.safetyLevel)
  );
  return ConversationalMissionDraftSchema.parse({
    createdAt: input.createdAt,
    draftId: input.draftId,
    executable: false,
    honesty: {
      claimLanguage: "mission_draft_not_executable_bas",
      conversationalOnly: true,
      summary:
        "Conversational builder produces a typed mission draft for review. It is not an executable BAS scenario and does not dispatch runner tasks."
    },
    intent: input.intent,
    missionType: input.missionType ?? "ExposureValidation",
    moduleIds: input.moduleIds,
    nextSteps: [
      "Review module list and safety ceiling.",
      "Bind a verified customer-authorized scope if not already set.",
      "Compile with Hybrid Execution Compiler (passive allowlisted only) for signed runner task payloads.",
      "Do not treat this draft as live APT, Atomic, or multi-agent offense."
    ],
    safetyCeiling,
    scopeId: input.scopeId ?? null,
    source: input.source,
    steps,
    targetHost: input.targetHost ?? null,
    title:
      input.title?.trim() ||
      input.intent.slice(0, 96) ||
      "Conversational mission draft"
  });
}

export function assemblePassiveMultiAgentPlan(input: {
  intent: string;
  maximumSteps?: number;
  /** Optional persisted Draft mission id (API layer sets after create). */
  missionId?: string | null;
  moduleMeta: Array<{
    moduleId: string;
    name: string;
    safetyLevel: SafetyLevel;
  }>;
  scopeId: string;
  targetHost: string;
}): AssemblePassiveMultiAgentPlanResponse {
  const moduleIds = selectPassiveModulesForIntent(
    input.intent,
    input.maximumSteps ?? 4
  );
  const steps = buildHybridMissionPlanSteps(moduleIds, input.moduleMeta);
  const safetyCeiling = highestSafetyAmong(
    steps.map((step) => step.safetyLevel)
  );
  const missionPlan = HybridMissionPlanSchema.parse({
    intent: input.intent,
    missionType: "ExposureValidation",
    moduleIds,
    safetyCeiling,
    scopeId: input.scopeId,
    steps,
    targetHost: input.targetHost
  });
  const missionId = input.missionId ?? null;
  return AssemblePassiveMultiAgentPlanResponseSchema.parse({
    honesty: {
      claimLanguage: "passive_role_assembly_not_bas_swarm",
      draftMissionsOnly: true,
      multiAgentOffensiveSwarmSupported: false,
      status: "Partial",
      summary:
        "Passive multi-agent assembly assigns role-tagged proof steps (DNS/TLS/HTTP/canary) under policy and creates Draft missions only. Not multi-agent BAS swarm or autonomous offense."
    },
    missionId,
    missionStatus: missionId ? ("Draft" as const) : null,
    missionPlan,
    policyPreview: {
      approvalRequired: safetyCeiling !== "PassiveReadOnly",
      executionEnvironment: "InternalRunner",
      requestedAction: {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: true,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyCeiling
    }
  });
}

/**
 * Conversational draft → Hybrid compile input (#33 → #30).
 *
 * The draft remains `executable: false` (not BAS). The returned compile input
 * is only for allowlisted passive measured modules via the Hybrid Execution
 * Compiler; it never claims full multi-agent offense or live APT/Atomic.
 */
export const MissionDraftToHybridCompileOptionsSchema = z
  .object({
    path: z.string().min(1).max(512).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    /** Default false: convert produces compile input without auto-queue. */
    queueTasks: z.boolean().default(false),
    rateLimitPerMinute: z.number().int().min(1).max(120).default(30),
    runnerId: IdSchema,
    scheme: z.enum(["http", "https"]).optional(),
    /** Override when draft.scopeId is null. */
    scopeId: IdSchema.optional(),
    /** Override when draft.targetHost is null. */
    targetHost: z.string().min(1).max(253).optional(),
    timeoutSeconds: z.number().int().min(1).max(30).default(5)
  })
  .strict();
/** Parsed options (defaults applied). */
export type MissionDraftToHybridCompileOptions = z.infer<
  typeof MissionDraftToHybridCompileOptionsSchema
>;
/** Caller input; defaulted fields may be omitted. */
export type MissionDraftToHybridCompileOptionsInput = z.input<
  typeof MissionDraftToHybridCompileOptionsSchema
>;

export const HybridCompileInputFromDraftSchema = z.object({
  compileInput: CompileHybridExecutionInputSchema,
  draftExecutable: z.literal(false),
  draftId: IdSchema,
  honesty: z.object({
    basExecutableFromDraft: z.literal(false),
    claimLanguage: z.literal("mission_draft_not_executable_bas"),
    summary: z.string().min(1)
  }),
  rejectedModuleIds: z.array(z.string().min(1))
});
export type HybridCompileInputFromDraft = z.infer<
  typeof HybridCompileInputFromDraftSchema
>;

export const ConvertMissionDraftToHybridCompileInputSchema = z
  .object({
    draft: ConversationalMissionDraftSchema,
    options: MissionDraftToHybridCompileOptionsSchema
  })
  .strict();
export type ConvertMissionDraftToHybridCompileInput = z.infer<
  typeof ConvertMissionDraftToHybridCompileInputSchema
>;
export type ConvertMissionDraftToHybridCompileInputRequest = z.input<
  typeof ConvertMissionDraftToHybridCompileInputSchema
>;

export function missionDraftToHybridCompileInput(
  draft: ConversationalMissionDraft,
  rawOptions: MissionDraftToHybridCompileOptionsInput
): HybridCompileInputFromDraft {
  const options = MissionDraftToHybridCompileOptionsSchema.parse(rawOptions);
  if (draft.executable !== false) {
    throw new Error(
      "Conversational mission draft must remain executable:false (not BAS)."
    );
  }

  const scopeId = options.scopeId ?? draft.scopeId;
  const targetHost = options.targetHost ?? draft.targetHost;
  if (!scopeId) {
    throw new Error(
      "scopeId is required on the draft or convert options to build hybrid compile input."
    );
  }
  if (!targetHost) {
    throw new Error(
      "targetHost is required on the draft or convert options to build hybrid compile input."
    );
  }

  const accepted: string[] = [];
  const rejectedModuleIds: string[] = [];
  for (const moduleId of draft.moduleIds) {
    if (isHybridCompilerPassiveModuleId(moduleId)) {
      if (!accepted.includes(moduleId)) {
        accepted.push(moduleId);
      }
    } else {
      rejectedModuleIds.push(moduleId);
    }
  }
  if (accepted.length === 0) {
    throw new Error(
      "No allowlisted passive measured modules remain on the draft for hybrid compile."
    );
  }

  const compileInput = CompileHybridExecutionInputSchema.parse({
    intent: draft.intent,
    moduleIds: accepted,
    path: options.path,
    port: options.port,
    queueTasks: options.queueTasks,
    rateLimitPerMinute: options.rateLimitPerMinute,
    runnerId: options.runnerId,
    scheme: options.scheme,
    scopeId,
    targetHost,
    timeoutSeconds: options.timeoutSeconds
  });

  return HybridCompileInputFromDraftSchema.parse({
    compileInput,
    draftExecutable: false,
    draftId: draft.draftId,
    honesty: {
      basExecutableFromDraft: false,
      claimLanguage: "mission_draft_not_executable_bas",
      summary:
        "Converted conversational mission draft into Hybrid Execution Compiler input for allowlisted passive modules only. Draft remains non-executable BAS; conversion does not enable live APT/Atomic or multi-agent offense."
    },
    rejectedModuleIds
  });
}
