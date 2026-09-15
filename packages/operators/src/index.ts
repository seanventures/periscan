import { createHash } from "node:crypto";

import { z } from "zod";

import {
  AttackPathAssessmentSchema,
  EvidenceArtifactSchema,
  MissionTypeSchema,
  PolicyRequestedActionSchema,
  RemediationTaskSchema,
  SafetyLevelSchema,
  SignalEnvelopeSchema,
  ValidationSnapshotSchema,
  type EvidenceArtifact,
  type MissionType,
  type PolicyRequestedAction,
  type RemediationTask,
  type SafetyLevel
} from "@periscan/shared";

export {
  DynamicPathMissionDriverSchema,
  DynamicPathMissionInputSchema,
  DynamicPathMissionPlanSchema,
  DynamicPathMissionRecommendationSchema,
  DynamicPathMissionStatusSchema,
  generateDynamicPathMissionRecommendation
} from "./dynamic-path-missions.js";
export type {
  DynamicPathMissionDriver,
  DynamicPathMissionInput,
  DynamicPathMissionPlan,
  DynamicPathMissionRecommendation,
  DynamicPathMissionStatus
} from "./dynamic-path-missions.js";

export const OperatorTypeSchema = z.enum([
  "RedTeamOperator",
  "BlueTeamOperator",
  "ExposureOperator",
  "RemediationOperator",
  "EvidenceOperator",
  "AIAppSecurityOperator"
]);

export const OperatorUncertaintySchema = z.enum(["Low", "Medium", "High"]);
export const OperatorRecommendationStatusSchema = z.enum([
  "Proposed",
  "Approved",
  "NotActionable"
]);

export const OperatorProfileSchema = z.object({
  operatorType: OperatorTypeSchema,
  name: z.string().min(1),
  purpose: z.string().min(1),
  capabilities: z.array(z.string().min(1)).min(1),
  defaultSafetyLevel: SafetyLevelSchema,
  supportedMissionTypes: z.array(MissionTypeSchema).min(1)
});

export const OperatorMissionPlanSchema = z.object({
  approvalRequired: z.boolean(),
  executionEnvironment: z.enum([
    "ControlPlane",
    "ExternalPoA",
    "InternalRunner"
  ]),
  missionType: MissionTypeSchema,
  moduleIds: z.array(z.string().min(1)),
  requestedAction: PolicyRequestedActionSchema,
  safetyLevel: SafetyLevelSchema,
  scopeId: z.string().uuid().nullish(),
  target: z.record(z.string(), z.unknown())
});

export const OperatorRecommendationSchema = z.object({
  createdAt: z.string().datetime(),
  evidenceIds: z.array(z.string().uuid()).min(1),
  operatorType: OperatorTypeSchema,
  proposedActions: z.array(z.string().min(1)).min(1),
  rationale: z.string().min(1),
  recommendationId: z.string().min(1),
  requiredIntegrations: z.array(z.string().min(1)),
  status: OperatorRecommendationStatusSchema,
  title: z.string().min(1),
  uncertainty: OperatorUncertaintySchema,
  missionPlan: OperatorMissionPlanSchema
});

/** Durable row shape for P11-4 operator proposal persistence. */
export const OperatorRecommendationRecordSchema = z.object({
  createdAt: z.string().datetime(),
  operatorRecommendationId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  scopeId: z.string().uuid().nullish(),
  status: OperatorRecommendationStatusSchema,
  tenantId: z.string().uuid()
});

export const CreateOperatorRecommendationRecordInputSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
  scopeId: z.string().uuid().nullish(),
  status: OperatorRecommendationStatusSchema.default("Proposed")
});

export const EvidenceSummaryUseCaseSchema = z.enum([
  "ExecutiveSummary",
  "RemediationSummary",
  "AttackPathExplanation",
  "EvidencePackSummary"
]);

export const EvidenceGroundedSummarySchema = z.object({
  claims: z.array(
    z.object({
      evidenceIds: z.array(z.string().uuid()).min(1),
      text: z.string().min(1)
    })
  ),
  evidenceIds: z.array(z.string().uuid()),
  generatedAt: z.string().datetime(),
  redactionApplied: z.boolean(),
  summary: z.string().min(1),
  useCase: EvidenceSummaryUseCaseSchema,
  warnings: z.array(z.string().min(1))
});

export const OperatorContextSchema = z.object({
  aiAppCount: z.number().int().nonnegative(),
  aiAppRisks: z.array(SignalEnvelopeSchema),
  attackPaths: z.array(AttackPathAssessmentSchema),
  controlObservations: z.array(SignalEnvelopeSchema),
  controlSourceCount: z.number().int().nonnegative(),
  defaultTargetHostname: z.string().min(1).nullish(),
  evidenceArtifacts: z.array(EvidenceArtifactSchema),
  generatedAt: z.string().datetime(),
  integrationCount: z.number().int().nonnegative(),
  latestSnapshot: ValidationSnapshotSchema.nullish(),
  remediations: z.array(RemediationTaskSchema),
  tenantId: z.string().uuid(),
  verifiedScopeIds: z.array(z.string().uuid())
});

export type OperatorType = z.infer<typeof OperatorTypeSchema>;
export type OperatorProfile = z.infer<typeof OperatorProfileSchema>;
export type OperatorMissionPlan = z.infer<typeof OperatorMissionPlanSchema>;
export type OperatorRecommendationStatus = z.infer<
  typeof OperatorRecommendationStatusSchema
>;
export type OperatorRecommendation = z.infer<
  typeof OperatorRecommendationSchema
>;
export type OperatorRecommendationRecord = z.infer<
  typeof OperatorRecommendationRecordSchema
>;
export type CreateOperatorRecommendationRecordInput = z.infer<
  typeof CreateOperatorRecommendationRecordInputSchema
>;
export type OperatorContext = z.infer<typeof OperatorContextSchema>;
export type EvidenceSummaryUseCase = z.infer<
  typeof EvidenceSummaryUseCaseSchema
>;
export type EvidenceGroundedSummary = z.infer<
  typeof EvidenceGroundedSummarySchema
>;

const SAFE_REQUESTED_ACTION: PolicyRequestedAction = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
};

const OPERATOR_PROFILES: OperatorProfile[] = [
  {
    capabilities: [
      "Build safe attack-path validation plans",
      "Prioritize high-impact path hypotheses and measured paths",
      "Identify path breakers"
    ],
    defaultSafetyLevel: "ControlledValidation",
    name: "Red Team Operator",
    operatorType: "RedTeamOperator",
    purpose:
      "Recommends policy-bounded attack-path validation missions from prioritized path hypotheses and measured paths.",
    supportedMissionTypes: ["ExposureValidation"]
  },
  {
    capabilities: [
      "Recommend control validation checks",
      "Focus on missed/no-evidence outcomes",
      "Map recommendations to telemetry evidence"
    ],
    defaultSafetyLevel: "BASLite",
    name: "Blue Team Operator",
    operatorType: "BlueTeamOperator",
    purpose:
      "Recommends dry-run or approved control validation missions for EDR, SIEM, and related controls.",
    supportedMissionTypes: ["ControlValidation"]
  },
  {
    capabilities: [
      "Recommend safe exposure validation",
      "Respect verified external scope",
      "Prefer non-invasive modules"
    ],
    defaultSafetyLevel: "ActiveNonInvasive",
    name: "Exposure Operator",
    operatorType: "ExposureOperator",
    purpose:
      "Recommends safe exposure validation against verified scope and current signal gaps.",
    supportedMissionTypes: ["ExposureValidation"]
  },
  {
    capabilities: [
      "Turn high-risk paths into fix verification plans",
      "Identify remediations awaiting proof",
      "Prevent closed-without-evidence outcomes"
    ],
    defaultSafetyLevel: "PassiveReadOnly",
    name: "Remediation Operator",
    operatorType: "RemediationOperator",
    purpose:
      "Recommends fix verification missions for remediation work that still needs evidence.",
    supportedMissionTypes: ["FixVerification"]
  },
  {
    capabilities: [
      "Recommend evidence-pack generation",
      "Summarize proof for stakeholder audiences",
      "Keep raw findings out of primary output"
    ],
    defaultSafetyLevel: "PassiveReadOnly",
    name: "Evidence Operator",
    operatorType: "EvidenceOperator",
    purpose:
      "Recommends evidence-pack and report workflows from normalized evidence.",
    supportedMissionTypes: ["ValidationSnapshot"]
  },
  {
    capabilities: [
      "Recommend safe AI app validation",
      "Focus on RAG, leakage, tool-use, and guardrail evidence",
      "Require explicit approval for controlled validation"
    ],
    defaultSafetyLevel: "ControlledValidation",
    name: "AI App Security Operator",
    operatorType: "AIAppSecurityOperator",
    purpose:
      "Recommends safe AI app validation missions that cite current AI application evidence.",
    supportedMissionTypes: ["AIAppValidation"]
  }
];

export function listOperatorProfiles() {
  return OPERATOR_PROFILES.map((profile) =>
    OperatorProfileSchema.parse(profile)
  );
}

function uniqueEvidenceIds(...groups: string[][]) {
  return [...new Set(groups.flat().filter(Boolean))];
}

function collectContextEvidenceIds(context: OperatorContext) {
  return uniqueEvidenceIds(
    context.latestSnapshot?.evidenceIds ?? [],
    ...context.attackPaths.map(({ attackPath }) => attackPath.evidenceIds),
    ...context.controlObservations.map((signal) => signal.evidenceIds),
    ...context.aiAppRisks.map((signal) => signal.evidenceIds),
    ...context.remediations.map((remediation) => remediation.evidenceIds),
    context.evidenceArtifacts.map((artifact) => artifact.evidenceId)
  );
}

function getPrimaryScopeId(context: OperatorContext) {
  return context.verifiedScopeIds[0] ?? null;
}

function deterministicRecommendationId(input: {
  operatorType: OperatorType;
  tenantId: string;
  title: string;
  evidenceIds: string[];
}) {
  const digest = createHash("sha256")
    .update(input.tenantId)
    .update(input.operatorType)
    .update(input.title)
    .update(input.evidenceIds.sort().join(","))
    .digest("hex")
    .slice(0, 16);

  return `oprec_${digest}`;
}

function createRecommendation(
  input: Omit<OperatorRecommendation, "recommendationId"> & {
    tenantId: string;
  }
) {
  return OperatorRecommendationSchema.parse({
    ...input,
    recommendationId: deterministicRecommendationId({
      evidenceIds: input.evidenceIds,
      operatorType: input.operatorType,
      tenantId: input.tenantId,
      title: input.title
    })
  });
}

function missionPlan(input: {
  approvalRequired: boolean;
  executionEnvironment: OperatorMissionPlan["executionEnvironment"];
  missionType: MissionType;
  moduleIds: string[];
  requestedAction?: Partial<PolicyRequestedAction>;
  safetyLevel: SafetyLevel;
  scopeId: string | null;
  target: Record<string, unknown>;
}): OperatorMissionPlan {
  return OperatorMissionPlanSchema.parse({
    approvalRequired: input.approvalRequired,
    executionEnvironment: input.executionEnvironment,
    missionType: input.missionType,
    moduleIds: input.moduleIds,
    requestedAction: {
      ...SAFE_REQUESTED_ACTION,
      ...input.requestedAction
    },
    safetyLevel: input.safetyLevel,
    scopeId: input.scopeId,
    target: input.target
  });
}

function hasOpenRemediation(remediation: RemediationTask) {
  return !["Fixed", "Mitigated"].includes(remediation.status);
}

function selectTopPath(context: OperatorContext) {
  return context.attackPaths.find(
    (path) => path.risk.band === "Critical" || path.risk.band === "High"
  );
}

function isControlValidationGap(signal: { signalSubcategory?: string | null }) {
  const value = (signal.signalSubcategory ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "");

  return (
    value.includes("missed") ||
    value.includes("noevidence") ||
    value.includes("needstuning")
  );
}

export function generateOperatorRecommendations(
  rawContext: OperatorContext
): OperatorRecommendation[] {
  const context = OperatorContextSchema.parse(rawContext);
  const primaryScopeId = getPrimaryScopeId(context);
  const topPath = selectTopPath(context);
  const fallbackEvidenceIds = collectContextEvidenceIds(context);
  const recommendations: OperatorRecommendation[] = [];

  if (topPath && topPath.attackPath.evidenceIds.length > 0) {
    recommendations.push(
      createRecommendation({
        createdAt: context.generatedAt,
        evidenceIds: topPath.attackPath.evidenceIds,
        missionPlan: missionPlan({
          approvalRequired: true,
          executionEnvironment: "ControlPlane",
          missionType: "ExposureValidation",
          moduleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"],
          safetyLevel: "ControlledValidation",
          scopeId: primaryScopeId,
          target: {
            pathId: topPath.attackPath.pathId
          }
        }),
        operatorType: "RedTeamOperator",
        proposedActions: [
          "Validate the highest-impact path with scoped, non-destructive modules.",
          "Confirm the recommended path breaker still reduces the most risk."
        ],
        rationale: `The current top path is ${topPath.risk.band} risk with score ${topPath.risk.score}.`,
        requiredIntegrations: ["GitHub", "AWS"],
        status: primaryScopeId ? "Proposed" : "NotActionable",
        tenantId: context.tenantId,
        title: `Validate top path: ${topPath.attackPath.name}`,
        uncertainty:
          topPath.attackPath.evidenceIds.length > 0 &&
          topPath.attackPath.confidence >= 0.8
            ? "Low"
            : "Medium"
      })
    );
  }

  const missedControl = context.controlObservations.find(
    isControlValidationGap
  );

  if (missedControl?.evidenceIds.length) {
    recommendations.push(
      createRecommendation({
        createdAt: context.generatedAt,
        evidenceIds: missedControl?.evidenceIds ?? [],
        missionPlan: missionPlan({
          approvalRequired: true,
          executionEnvironment: "InternalRunner",
          missionType: "ControlValidation",
          moduleIds: ["atomic.control_validation_safe"],
          requestedAction: {
            requiresInternalRunner: true
          },
          safetyLevel: "BASLite",
          scopeId: primaryScopeId,
          target: {
            controlSourceCount: context.controlSourceCount,
            dryRun: true,
            techniqueId: missedControl?.techniqueIds?.[0] ?? "T1595"
          }
        }),
        operatorType: "BlueTeamOperator",
        proposedActions: [
          "Run fixture/dry-run control validation first.",
          "Compare expected detect/block/log behavior with observed telemetry."
        ],
        rationale: `Control evidence includes ${missedControl.signalSubcategory} telemetry that needs validation.`,
        requiredIntegrations: ["SIEM or EDR observer"],
        status: primaryScopeId ? "Proposed" : "NotActionable",
        tenantId: context.tenantId,
        title: "Validate control telemetry coverage",
        uncertainty: missedControl?.evidenceIds.length ? "Medium" : "High"
      })
    );
  }

  if (primaryScopeId && fallbackEvidenceIds.length > 0) {
    recommendations.push(
      createRecommendation({
        createdAt: context.generatedAt,
        evidenceIds: context.latestSnapshot?.evidenceIds.length
          ? context.latestSnapshot.evidenceIds
          : fallbackEvidenceIds,
        missionPlan: missionPlan({
          approvalRequired: true,
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          moduleIds: ["nuclei.external_exposure_safe"],
          safetyLevel: "ActiveNonInvasive",
          scopeId: primaryScopeId,
          target: {
            hostname:
              context.defaultTargetHostname ?? "verified-scope-required",
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        }),
        operatorType: "ExposureOperator",
        proposedActions: [
          "Run the safe external exposure profile only against verified scope.",
          "Refresh reachability and service evidence before the next Snapshot."
        ],
        rationale:
          "Verified scope exists and can support a safe, non-invasive exposure refresh.",
        requiredIntegrations: [],
        status: "Proposed",
        tenantId: context.tenantId,
        title: "Refresh safe external exposure validation",
        uncertainty: context.defaultTargetHostname ? "Low" : "Medium"
      })
    );
  }

  const openRemediations = context.remediations.filter(hasOpenRemediation);
  const evidenceBackedOpenRemediations = openRemediations.filter(
    (remediation) => remediation.evidenceIds.length > 0
  );

  if (evidenceBackedOpenRemediations.length > 0) {
    recommendations.push(
      createRecommendation({
        createdAt: context.generatedAt,
        evidenceIds: uniqueEvidenceIds(
          ...evidenceBackedOpenRemediations.map(
            (remediation) => remediation.evidenceIds
          )
        ),
        missionPlan: missionPlan({
          approvalRequired: true,
          executionEnvironment: "ControlPlane",
          missionType: "FixVerification",
          moduleIds: ["periscan.fix_verification.retest"],
          safetyLevel: "PassiveReadOnly",
          scopeId: primaryScopeId,
          target: {
            remediationIds: evidenceBackedOpenRemediations.map(
              (remediation) => remediation.remediationId
            )
          }
        }),
        operatorType: "RemediationOperator",
        proposedActions: [
          "Create targeted verification for open remediations.",
          "Do not mark fixed until a verification event links new evidence."
        ],
        rationale: `${evidenceBackedOpenRemediations.length} evidence-backed remediation item${evidenceBackedOpenRemediations.length === 1 ? "" : "s"} still require proof.`,
        requiredIntegrations: [],
        status: primaryScopeId ? "Proposed" : "NotActionable",
        tenantId: context.tenantId,
        title: "Verify open remediation work",
        uncertainty: "Low"
      })
    );
  }

  if (
    (context.latestSnapshot && context.latestSnapshot.evidenceIds.length > 0) ||
    context.evidenceArtifacts.length > 0
  ) {
    recommendations.push(
      createRecommendation({
        createdAt: context.generatedAt,
        evidenceIds: context.latestSnapshot?.evidenceIds.length
          ? context.latestSnapshot.evidenceIds
          : context.evidenceArtifacts.map((artifact) => artifact.evidenceId),
        missionPlan: missionPlan({
          approvalRequired: true,
          executionEnvironment: "ControlPlane",
          missionType: "ValidationSnapshot",
          moduleIds: [],
          safetyLevel: "PassiveReadOnly",
          scopeId: primaryScopeId,
          target: {
            audience: "Executive"
          }
        }),
        operatorType: "EvidenceOperator",
        proposedActions: [
          "Generate an audience-specific evidence pack from normalized evidence.",
          "Use evidence IDs in summaries and keep raw module output in the appendix only."
        ],
        rationale:
          "Current normalized evidence can support an executive or customer-review evidence pack.",
        requiredIntegrations: [],
        status: primaryScopeId ? "Proposed" : "NotActionable",
        tenantId: context.tenantId,
        title: "Prepare an evidence pack for stakeholder review",
        uncertainty: context.latestSnapshot ? "Low" : "Medium"
      })
    );
  }

  const aiRisk = context.aiAppRisks[0];

  if (aiRisk?.evidenceIds.length) {
    recommendations.push(
      createRecommendation({
        createdAt: context.generatedAt,
        evidenceIds: aiRisk?.evidenceIds ?? [],
        missionPlan: missionPlan({
          approvalRequired: true,
          executionEnvironment: "ControlPlane",
          missionType: "AIAppValidation",
          moduleIds: ["ai_app.safe_validation"],
          safetyLevel: "ControlledValidation",
          scopeId: primaryScopeId,
          target: {
            validationCategory: aiRisk?.signalSubcategory ?? "PromptInjection"
          }
        }),
        operatorType: "AIAppSecurityOperator",
        proposedActions: [
          "Run safe AI app validation against customer-authorized test endpoints.",
          "Redact outputs and cite AI-specific evidence IDs in the report."
        ],
        rationale: aiRisk
          ? `AI validation evidence includes ${aiRisk.signalSubcategory}.`
          : "AI applications are registered but do not have recent validation evidence.",
        requiredIntegrations: ["AI application endpoint"],
        status: primaryScopeId ? "Proposed" : "NotActionable",
        tenantId: context.tenantId,
        title: "Validate registered AI application risks",
        uncertainty: aiRisk?.evidenceIds.length ? "Medium" : "High"
      })
    );
  }

  return recommendations.sort((left, right) =>
    left.operatorType.localeCompare(right.operatorType)
  );
}

function getEvidenceSubject(artifact: EvidenceArtifact) {
  return `${artifact.artifactType} for ${artifact.relatedEntityType}`;
}

export function generateEvidenceGroundedSummary(input: {
  artifacts: EvidenceArtifact[];
  generatedAt: string;
  useCase: EvidenceSummaryUseCase;
}): EvidenceGroundedSummary {
  const useCase = EvidenceSummaryUseCaseSchema.parse(input.useCase);
  const artifacts = z.array(EvidenceArtifactSchema).parse(input.artifacts);
  const evidenceIds = [
    ...new Set(artifacts.map((artifact) => artifact.evidenceId))
  ];

  if (evidenceIds.length === 0) {
    return EvidenceGroundedSummarySchema.parse({
      claims: [],
      evidenceIds: [],
      generatedAt: input.generatedAt,
      redactionApplied: true,
      summary:
        "There is insufficient normalized evidence to generate a supported Periscan summary.",
      useCase,
      warnings: [
        "No tenant-authorized evidence artifacts were supplied for this summary."
      ]
    });
  }

  const claims = artifacts.slice(0, 6).map((artifact) => ({
    evidenceIds: [artifact.evidenceId],
    text: `${getEvidenceSubject(artifact)} is available with ${artifact.redactionStatus} redaction status and ${artifact.sensitivityLevel} sensitivity.`
  }));
  const summary =
    `${useCase} generated from ${evidenceIds.length} normalized evidence artifact${evidenceIds.length === 1 ? "" : "s"}. ` +
    `Every claim below cites evidence IDs; raw artifact contents are not included.`;

  return EvidenceGroundedSummarySchema.parse({
    claims,
    evidenceIds,
    generatedAt: input.generatedAt,
    redactionApplied: true,
    summary,
    useCase,
    warnings: []
  });
}
