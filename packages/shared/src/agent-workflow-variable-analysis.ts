import { z } from "zod";

import { AgentWorkflowEventTypeSchema } from "./agent-workflows";

export const AgentWorkflowVariableNamespaceSchema = z.enum([
  "Input",
  "Context",
  "Policy",
  "Evidence",
  "Model",
  "Tool",
  "Transition",
  "Performance",
  "Control"
]);

export const AgentWorkflowVariableValueTypeSchema = z.enum([
  "String",
  "Number",
  "Boolean",
  "Null",
  "Array",
  "Object"
]);

export const AgentWorkflowVariableValueSchema = z.object({
  key: z.string().min(1).max(500),
  namespace: AgentWorkflowVariableNamespaceSchema,
  sourceEventId: z.uuid().nullable(),
  sourceSequence: z.string().regex(/^\d+$/u),
  stepKey: z.string().nullable(),
  valueHash: z.string().regex(/^[a-f0-9]{64}$/u),
  valuePreview: z.string().max(160),
  valueType: AgentWorkflowVariableValueTypeSchema
});

export const AgentWorkflowVariableChangeSummarySchema = z.object({
  added: z.number().int().nonnegative(),
  changed: z.number().int().nonnegative(),
  removed: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative()
});

export const AgentWorkflowVariableSnapshotSchema = z.object({
  changeSummary: AgentWorkflowVariableChangeSummarySchema,
  createdAt: z.iso.datetime(),
  eventType: z.union([z.literal("Baseline"), AgentWorkflowEventTypeSchema]),
  sequence: z.string().regex(/^\d+$/u),
  stepKey: z.string().nullable(),
  variables: z.array(AgentWorkflowVariableValueSchema).max(500)
});

export const AgentWorkflowVariableSummarySchema = z.object({
  changeCount: z.number().int().nonnegative(),
  firstSeenSequence: z.string().regex(/^\d+$/u),
  key: z.string().min(1).max(500),
  lastSeenSequence: z.string().regex(/^\d+$/u),
  latestValueHash: z.string().regex(/^[a-f0-9]{64}$/u),
  latestValuePreview: z.string().max(160),
  namespace: AgentWorkflowVariableNamespaceSchema,
  observationCount: z.number().int().positive(),
  valueType: AgentWorkflowVariableValueTypeSchema
});

export const AgentWorkflowVariableAnalysisSchema = z.object({
  generatedAt: z.iso.datetime(),
  integrityVerified: z.boolean(),
  limitations: z.array(z.string().min(1)),
  namespaceCounts: z.record(
    AgentWorkflowVariableNamespaceSchema,
    z.number().int().nonnegative()
  ),
  snapshots: z.array(AgentWorkflowVariableSnapshotSchema).min(1).max(201),
  summary: z.object({
    changedVariableCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    snapshotCount: z.number().int().positive(),
    totalCostMicrousd: z.string().regex(/^\d+$/u),
    totalLatencyMs: z.number().int().nonnegative(),
    variableCount: z.number().int().nonnegative()
  }),
  variables: z.array(AgentWorkflowVariableSummarySchema).max(500),
  workflowRunId: z.uuid()
});

export const AgentWorkflowVariableDeltaSchema = z.object({
  after: AgentWorkflowVariableValueSchema.nullable(),
  before: AgentWorkflowVariableValueSchema.nullable(),
  changeType: z.enum(["Added", "Changed", "Removed", "Unchanged"]),
  key: z.string().min(1).max(500),
  namespace: AgentWorkflowVariableNamespaceSchema
});

export function compareAgentWorkflowVariableSnapshots(
  before: AgentWorkflowVariableSnapshot,
  after: AgentWorkflowVariableSnapshot
): AgentWorkflowVariableDelta[] {
  const beforeByKey = new Map(
    before.variables.map((variable) => [variable.key, variable])
  );
  const afterByKey = new Map(
    after.variables.map((variable) => [variable.key, variable])
  );
  const keys = [...new Set([...beforeByKey.keys(), ...afterByKey.keys()])].sort(
    (left, right) => left.localeCompare(right)
  );

  return keys.map((key) => {
    const previous = beforeByKey.get(key) ?? null;
    const current = afterByKey.get(key) ?? null;
    const changeType = !previous
      ? "Added"
      : !current
        ? "Removed"
        : previous.valueHash === current.valueHash
          ? "Unchanged"
          : "Changed";

    return AgentWorkflowVariableDeltaSchema.parse({
      after: current,
      before: previous,
      changeType,
      key,
      namespace: (current ?? previous)?.namespace
    });
  });
}

export type AgentWorkflowVariableNamespace = z.infer<
  typeof AgentWorkflowVariableNamespaceSchema
>;
export type AgentWorkflowVariableValueType = z.infer<
  typeof AgentWorkflowVariableValueTypeSchema
>;
export type AgentWorkflowVariableValue = z.infer<
  typeof AgentWorkflowVariableValueSchema
>;
export type AgentWorkflowVariableSnapshot = z.infer<
  typeof AgentWorkflowVariableSnapshotSchema
>;
export type AgentWorkflowVariableSummary = z.infer<
  typeof AgentWorkflowVariableSummarySchema
>;
export type AgentWorkflowVariableAnalysis = z.infer<
  typeof AgentWorkflowVariableAnalysisSchema
>;
export type AgentWorkflowVariableDelta = z.infer<
  typeof AgentWorkflowVariableDeltaSchema
>;
