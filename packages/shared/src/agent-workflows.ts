import { z } from "zod";

export const AgentWorkflowStepKindSchema = z.enum([
  "Context",
  "Policy",
  "Model",
  "Tool",
  "HumanGate",
  "Evidence",
  "Transition"
]);

export const AgentWorkflowStepSchema = z
  .object({
    dependsOn: z.array(z.string().min(1).max(100)).max(20).default([]),
    name: z.string().trim().min(1).max(160),
    stepKey: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/u),
    stepKind: AgentWorkflowStepKindSchema,
    toolName: z.string().trim().min(1).max(160).nullable().optional()
  })
  .strict();

export const CreateAgentWorkflowDefinitionInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    purpose: z.string().trim().min(1).max(2_000),
    steps: z.array(AgentWorkflowStepSchema).min(1).max(100),
    version: z.number().int().min(1).max(10_000)
  })
  .strict()
  .superRefine((value, context) => {
    const keys = new Set(value.steps.map((step) => step.stepKey));
    if (keys.size !== value.steps.length) {
      context.addIssue({
        code: "custom",
        message: "Workflow step keys must be unique.",
        path: ["steps"]
      });
    }
    for (const [index, step] of value.steps.entries()) {
      for (const dependency of step.dependsOn) {
        if (!keys.has(dependency) || dependency === step.stepKey) {
          context.addIssue({
            code: "custom",
            message: `Invalid dependency ${dependency}.`,
            path: ["steps", index, "dependsOn"]
          });
        }
      }
      if (step.stepKind === "Tool" && !step.toolName) {
        context.addIssue({
          code: "custom",
          message: "Tool steps require a toolName.",
          path: ["steps", index, "toolName"]
        });
      }
    }
  });

export const AgentWorkflowDefinitionSchema = z.object({
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
  definitionHash: z.string().regex(/^[a-f0-9]{64}$/u),
  name: z.string().min(1),
  purpose: z.string().min(1),
  steps: z.array(AgentWorkflowStepSchema),
  tenantId: z.uuid(),
  version: z.number().int().positive(),
  workflowDefinitionId: z.uuid()
});

export const AgentWorkflowRunStatusSchema = z.enum([
  "Created",
  "Running",
  "Paused",
  "Completed",
  "Failed",
  "Cancelled"
]);

export const CreateAgentWorkflowRunInputSchema = z
  .object({
    evidenceIds: z.array(z.uuid()).max(500).default([]),
    inputManifest: z.record(z.string(), z.unknown()),
    modelSessionId: z.uuid().nullable().optional(),
    policyDecisionIds: z.array(z.uuid()).max(100).default([]),
    workflowDefinitionId: z.uuid()
  })
  .strict();

export const AgentWorkflowRunSchema = z.object({
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
  definitionVersion: z.number().int().positive(),
  endedAt: z.iso.datetime().nullable(),
  evidenceIds: z.array(z.uuid()),
  evidenceManifestHash: z.string().regex(/^[a-f0-9]{64}$/u),
  forkedFromCheckpointId: z.uuid().nullable(),
  forkedFromRunId: z.uuid().nullable(),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/u),
  inputManifest: z.record(z.string(), z.unknown()),
  modelSessionId: z.uuid().nullable(),
  policyDecisionIds: z.array(z.uuid()),
  policySnapshotHash: z.string().regex(/^[a-f0-9]{64}$/u),
  reusedThroughSequence: z.string().regex(/^\d+$/u).nullable(),
  startedAt: z.iso.datetime().nullable(),
  status: AgentWorkflowRunStatusSchema,
  tenantId: z.uuid(),
  workflowDefinitionId: z.uuid(),
  workflowRunId: z.uuid()
});

export const AgentWorkflowEventTypeSchema = z.enum([
  "RunCreated",
  "StepStarted",
  "ModelRequest",
  "ModelResponse",
  "ToolRequested",
  "ToolResult",
  "PolicyDecision",
  "Transition",
  "EvidenceAttached",
  "CheckpointCreated",
  "UpstreamReused",
  "RunCompleted",
  "RunFailed"
]);

export const AppendAgentWorkflowEventInputSchema = z
  .object({
    costMicrousd: z.number().int().nonnegative().max(10_000_000_000).optional(),
    eventType: AgentWorkflowEventTypeSchema,
    evidenceIds: z.array(z.uuid()).max(500).default([]),
    latencyMs: z.number().int().nonnegative().max(86_400_000).optional(),
    modelProvider: z.string().trim().min(1).max(160).optional(),
    modelVersion: z.string().trim().min(1).max(160).optional(),
    payloadRedacted: z.record(z.string(), z.unknown()),
    policyDecisionId: z.uuid().nullable().optional(),
    stepKey: z
      .string()
      .regex(/^[a-z][a-z0-9_-]{0,99}$/u)
      .nullable()
      .optional(),
    toolRequestId: z.uuid().nullable().optional()
  })
  .strict();

export const AgentWorkflowEventSchema = z.object({
  costMicrousd: z.string().regex(/^\d+$/u).nullable(),
  createdAt: z.iso.datetime(),
  eventHash: z.string().regex(/^[a-f0-9]{64}$/u),
  eventType: AgentWorkflowEventTypeSchema,
  evidenceIds: z.array(z.uuid()),
  latencyMs: z.number().int().nonnegative().nullable(),
  modelProvider: z.string().nullable(),
  modelVersion: z.string().nullable(),
  payloadRedacted: z.record(z.string(), z.unknown()),
  policyDecisionId: z.uuid().nullable(),
  previousEventHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/u)
    .nullable(),
  sequence: z.string().regex(/^\d+$/u),
  stepKey: z.string().nullable(),
  tenantId: z.uuid(),
  toolRequestId: z.uuid().nullable(),
  workflowEventId: z.uuid(),
  workflowRunId: z.uuid()
});

export const CreateAgentWorkflowCheckpointInputSchema = z
  .object({
    reusableThroughStepKey: z.string().regex(/^[a-z][a-z0-9_-]{0,99}$/u)
  })
  .strict();

export const AgentWorkflowCheckpointSchema = z.object({
  checkpointHash: z.string().regex(/^[a-f0-9]{64}$/u),
  createdAt: z.iso.datetime(),
  evidenceManifestHash: z.string().regex(/^[a-f0-9]{64}$/u),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/u),
  policySnapshotHash: z.string().regex(/^[a-f0-9]{64}$/u),
  reusableThroughStepKey: z.string().min(1),
  sequence: z.string().regex(/^\d+$/u),
  tenantId: z.uuid(),
  workflowCheckpointId: z.uuid(),
  workflowRunId: z.uuid()
});

export const ReplayAgentWorkflowInputSchema = z
  .object({
    inputManifest: z.record(z.string(), z.unknown()).optional(),
    workflowCheckpointId: z.uuid()
  })
  .strict();

export const AgentWorkflowRunDetailSchema = z.object({
  checkpoints: z.array(AgentWorkflowCheckpointSchema),
  definition: AgentWorkflowDefinitionSchema,
  events: z.array(AgentWorkflowEventSchema),
  flightRecorderValid: z.boolean(),
  run: AgentWorkflowRunSchema
});

export const AgentWorkflowQualityStatusSchema = z.enum([
  "Ready",
  "Incomplete",
  "NeedsEvidence",
  "NeedsPolicy",
  "IntegrityFailure"
]);

export const AgentWorkflowQualityFindingSchema = z.object({
  code: z.enum([
    "FlightRecorderInvalid",
    "IncompleteStepCoverage",
    "UngroundedClaimEvents",
    "ToolPolicyGap",
    "ModelIdentityGap",
    "RunNotCompleted"
  ]),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  message: z.string().min(1),
  severity: z.enum(["Info", "Moderate", "High", "Critical"])
});

export const AgentWorkflowQualityEvaluationSchema = z.object({
  evaluatedAt: z.iso.datetime(),
  findings: z.array(AgentWorkflowQualityFindingSchema),
  metrics: z.object({
    evidenceGrounding: z.number().min(0).max(1),
    flightRecorderIntegrity: z.number().min(0).max(1),
    modelIdentityCoverage: z.number().min(0).max(1),
    stepCoverage: z.number().min(0).max(1),
    toolPolicyCoverage: z.number().min(0).max(1)
  }),
  methodology: z.string().min(1),
  score: z.number().int().min(0).max(100),
  status: AgentWorkflowQualityStatusSchema,
  workflowRunId: z.uuid()
});

export function evaluateAgentWorkflowQuality(
  detail: AgentWorkflowRunDetail,
  evaluatedAt = new Date()
): AgentWorkflowQualityEvaluation {
  const { definition, events, flightRecorderValid, run } = detail;
  const findings: AgentWorkflowQualityFinding[] = [];
  const coveredSteps = new Set(
    events.flatMap((event) => (event.stepKey ? [event.stepKey] : []))
  );
  const stepCoverage =
    definition.steps.length === 0
      ? 1
      : coveredSteps.size / definition.steps.length;
  const claimEvents = events.filter((event) =>
    ["ModelResponse", "ToolResult", "EvidenceAttached"].includes(
      event.eventType
    )
  );
  const expectsClaims = definition.steps.some((step) =>
    ["Model", "Tool", "Evidence"].includes(step.stepKind)
  );
  const evidenceGrounding =
    claimEvents.length > 0
      ? claimEvents.filter((event) => event.evidenceIds.length > 0).length /
        claimEvents.length
      : expectsClaims
        ? 0
        : 1;
  const toolEvents = events.filter((event) =>
    ["ToolRequested", "ToolResult"].includes(event.eventType)
  );
  const expectsTools = definition.steps.some(
    (step) => step.stepKind === "Tool"
  );
  const toolRequestCoverage =
    toolEvents.length > 0
      ? toolEvents.filter((event) => Boolean(event.toolRequestId)).length /
        toolEvents.length
      : expectsTools
        ? 0
        : 1;
  const policyCoverage =
    toolEvents.length === 0
      ? expectsTools
        ? 0
        : 1
      : events.some(
            (event) =>
              Boolean(event.policyDecisionId) ||
              event.eventType === "PolicyDecision"
          )
        ? 1
        : 0;
  const toolPolicyCoverage = Math.min(toolRequestCoverage, policyCoverage);
  const modelEvents = events.filter((event) =>
    ["ModelRequest", "ModelResponse"].includes(event.eventType)
  );
  const expectsModel = definition.steps.some(
    (step) => step.stepKind === "Model"
  );
  const modelIdentityCoverage =
    modelEvents.length > 0
      ? modelEvents.filter((event) =>
          Boolean(event.modelProvider && event.modelVersion)
        ).length / modelEvents.length
      : expectsModel
        ? 0
        : 1;

  if (!flightRecorderValid) {
    findings.push({
      code: "FlightRecorderInvalid",
      evidenceRefs: [`run:${run.workflowRunId}`],
      message:
        "The append-only event chain does not verify; replay and analyst conclusions are untrusted.",
      severity: "Critical"
    });
  }
  if (stepCoverage < 1) {
    const missing = definition.steps
      .filter((step) => !coveredSteps.has(step.stepKey))
      .map((step) => step.stepKey);
    findings.push({
      code: "IncompleteStepCoverage",
      evidenceRefs: missing.map((step) => `step:${step}`),
      message: `${missing.length} versioned workflow step${missing.length === 1 ? " is" : "s are"} not represented in the flight recorder.`,
      severity: "Moderate"
    });
  }
  if (evidenceGrounding < 1) {
    const ungrounded = claimEvents.filter(
      (event) => event.evidenceIds.length === 0
    );
    findings.push({
      code: "UngroundedClaimEvents",
      evidenceRefs:
        ungrounded.length > 0
          ? ungrounded.map((event) => `event:${event.workflowEventId}`)
          : ["workflow:claim-evidence-not-observed"],
      message:
        "One or more analyst, model, or tool result events lack tenant evidence references.",
      severity: "High"
    });
  }
  if (toolPolicyCoverage < 1) {
    findings.push({
      code: "ToolPolicyGap",
      evidenceRefs:
        toolEvents.length > 0
          ? toolEvents.map((event) => `event:${event.workflowEventId}`)
          : ["workflow:tool-step-not-observed"],
      message:
        "Tool activity is missing a durable tool request or policy-decision reference.",
      severity: "High"
    });
  }
  if (modelIdentityCoverage < 1) {
    findings.push({
      code: "ModelIdentityGap",
      evidenceRefs:
        modelEvents.length > 0
          ? modelEvents.map((event) => `event:${event.workflowEventId}`)
          : ["workflow:model-step-not-observed"],
      message:
        "Model activity is missing the provider or immutable model-version identity needed for reproducible evaluation.",
      severity: "Moderate"
    });
  }
  if (run.status !== "Completed") {
    findings.push({
      code: "RunNotCompleted",
      evidenceRefs: [`run:${run.workflowRunId}`],
      message: `The workflow is ${run.status}; completion quality cannot be certified.`,
      severity: "Info"
    });
  }

  const score = Math.round(
    (flightRecorderValid ? 30 : 0) +
      stepCoverage * 20 +
      evidenceGrounding * 25 +
      toolPolicyCoverage * 15 +
      modelIdentityCoverage * 10
  );
  const status = !flightRecorderValid
    ? "IntegrityFailure"
    : evidenceGrounding < 1
      ? "NeedsEvidence"
      : toolPolicyCoverage < 1
        ? "NeedsPolicy"
        : run.status === "Completed" && stepCoverage === 1
          ? "Ready"
          : "Incomplete";
  return AgentWorkflowQualityEvaluationSchema.parse({
    evaluatedAt: evaluatedAt.toISOString(),
    findings,
    metrics: {
      evidenceGrounding,
      flightRecorderIntegrity: flightRecorderValid ? 1 : 0,
      modelIdentityCoverage,
      stepCoverage,
      toolPolicyCoverage
    },
    methodology:
      "Deterministic run evaluation: flight-recorder integrity 30%, step coverage 20%, evidence grounding 25%, tool/policy traceability 15%, model identity 10%.",
    score,
    status,
    workflowRunId: run.workflowRunId
  });
}

export const AgentBehaviorSeveritySchema = z.enum([
  "Low",
  "Moderate",
  "High",
  "Critical"
]);

export const AgentBehaviorRuleIdSchema = z.enum([
  "FlightRecorderIntegrity",
  "ApprovalIntegrity",
  "PolicyDenialBurst",
  "ToolFailureBurst",
  "ToolVelocityOutlier",
  "ScopeFanOut",
  "CostOutlier"
]);

export const AgentBehaviorRunMetricsSchema = z.object({
  costMicrousd: z.number().int().nonnegative(),
  deniedToolRequests: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  failedToolRequests: z.number().int().nonnegative(),
  flightRecorderValid: z.boolean(),
  scopeCount: z.number().int().nonnegative(),
  toolRequestCount: z.number().int().nonnegative(),
  workflowRunId: z.uuid()
});

export const AgentBehaviorFindingSchema = z.object({
  baseline: z.string().min(1),
  evidenceRefs: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  findingKey: z.string().regex(/^[a-f0-9]{64}$/u),
  observed: z.string().min(1),
  recommendedAction: z.string().min(1),
  ruleId: AgentBehaviorRuleIdSchema,
  severity: AgentBehaviorSeveritySchema,
  title: z.string().min(1),
  workflowRunId: z.uuid()
});

export const AgentBehaviorAnalysisSchema = z.object({
  baseline: z.object({
    medianCostMicrousd: z.number().int().nonnegative(),
    medianScopeCount: z.number().nonnegative(),
    medianToolRequests: z.number().nonnegative(),
    runCount: z.number().int().nonnegative(),
    windowDays: z.number().int().positive()
  }),
  findings: z.array(AgentBehaviorFindingSchema),
  generatedAt: z.iso.datetime(),
  methodology: z.string().min(1),
  runs: z.array(AgentBehaviorRunMetricsSchema),
  summary: z.object({
    critical: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    moderate: z.number().int().nonnegative(),
    runsAnalyzed: z.number().int().nonnegative(),
    runsWithFindings: z.number().int().nonnegative()
  }),
  tenantId: z.uuid()
});

export type AgentWorkflowStep = z.infer<typeof AgentWorkflowStepSchema>;
export type AgentWorkflowDefinition = z.infer<
  typeof AgentWorkflowDefinitionSchema
>;
export type CreateAgentWorkflowDefinitionInput = z.infer<
  typeof CreateAgentWorkflowDefinitionInputSchema
>;
export type AgentWorkflowRun = z.infer<typeof AgentWorkflowRunSchema>;
export type CreateAgentWorkflowRunInput = z.infer<
  typeof CreateAgentWorkflowRunInputSchema
>;
export type AgentWorkflowEvent = z.infer<typeof AgentWorkflowEventSchema>;
export type AppendAgentWorkflowEventInput = z.infer<
  typeof AppendAgentWorkflowEventInputSchema
>;
export type AgentWorkflowCheckpoint = z.infer<
  typeof AgentWorkflowCheckpointSchema
>;
export type CreateAgentWorkflowCheckpointInput = z.infer<
  typeof CreateAgentWorkflowCheckpointInputSchema
>;
export type ReplayAgentWorkflowInput = z.infer<
  typeof ReplayAgentWorkflowInputSchema
>;
export type AgentWorkflowRunDetail = z.infer<
  typeof AgentWorkflowRunDetailSchema
>;
export type AgentWorkflowQualityFinding = z.infer<
  typeof AgentWorkflowQualityFindingSchema
>;
export type AgentWorkflowQualityEvaluation = z.infer<
  typeof AgentWorkflowQualityEvaluationSchema
>;
export type AgentWorkflowQualityStatus = z.infer<
  typeof AgentWorkflowQualityStatusSchema
>;
export type AgentBehaviorSeverity = z.infer<typeof AgentBehaviorSeveritySchema>;
export type AgentBehaviorRuleId = z.infer<typeof AgentBehaviorRuleIdSchema>;
export type AgentBehaviorRunMetrics = z.infer<
  typeof AgentBehaviorRunMetricsSchema
>;
export type AgentBehaviorFinding = z.infer<typeof AgentBehaviorFindingSchema>;
export type AgentBehaviorAnalysis = z.infer<typeof AgentBehaviorAnalysisSchema>;
