import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AgentWorkflowCheckpointSchema,
  AgentWorkflowDefinitionSchema,
  AgentWorkflowEventSchema,
  AgentWorkflowRunDetailSchema,
  AgentWorkflowRunSchema,
  AgentWorkflowVariableAnalysisSchema,
  evaluateAgentWorkflowQuality,
  type AgentWorkflowCheckpoint,
  type AgentWorkflowDefinition,
  type AgentWorkflowEvent,
  type AgentWorkflowRun,
  type AgentWorkflowRunDetail,
  type AgentWorkflowVariableAnalysis,
  type AgentWorkflowVariableNamespace,
  type AgentWorkflowVariableSummary,
  type AgentWorkflowVariableValue,
  type AgentWorkflowVariableValueType,
  type AppendAgentWorkflowEventInput,
  type CreateAgentWorkflowDefinitionInput,
  type MembershipRole
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  type AppServices,
  type AuthenticatedContext,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const WORKFLOW_OPERATOR_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "SecurityEngineer",
  "MSSPOwner",
  "ClientAdmin"
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

const VARIABLE_NAMESPACES: AgentWorkflowVariableNamespace[] = [
  "Input",
  "Context",
  "Policy",
  "Evidence",
  "Model",
  "Tool",
  "Transition",
  "Performance",
  "Control"
];
const MAX_VARIABLES = 500;
const MAX_INTERACTIVE_SNAPSHOTS = 200;

function variableValueType(value: unknown): AgentWorkflowVariableValueType {
  if (value === null) return "Null";
  if (Array.isArray(value)) return "Array";
  if (typeof value === "boolean") return "Boolean";
  if (typeof value === "number") return "Number";
  if (typeof value === "object") return "Object";
  return "String";
}

function variablePreview(value: unknown) {
  const serialized =
    typeof value === "string" ? value : (stableJson(value) ?? String(value));
  return serialized.length > 160 ? `${serialized.slice(0, 157)}…` : serialized;
}

function variableKey(namespace: AgentWorkflowVariableNamespace, path: string) {
  const full = `${namespace.toLowerCase()}.${path}`;
  return full.length <= 500
    ? full
    : `${full.slice(0, 481)}.${sha256(full).slice(0, 18)}`;
}

function namespaceForEvent(
  detail: AgentWorkflowRunDetail,
  event: AgentWorkflowEvent
): AgentWorkflowVariableNamespace {
  if (["ModelRequest", "ModelResponse"].includes(event.eventType)) {
    return "Model";
  }
  if (["ToolRequested", "ToolResult"].includes(event.eventType)) {
    return "Tool";
  }
  if (event.eventType === "PolicyDecision") return "Policy";
  if (event.eventType === "EvidenceAttached") return "Evidence";
  if (event.eventType === "Transition") return "Transition";
  const stepKind = detail.definition.steps.find(
    (step) => step.stepKey === event.stepKey
  )?.stepKind;
  if (stepKind === "Context") return "Context";
  if (stepKind === "Policy") return "Policy";
  if (stepKind === "Model") return "Model";
  if (stepKind === "Tool") return "Tool";
  if (stepKind === "Evidence") return "Evidence";
  if (stepKind === "Transition") return "Transition";
  return "Control";
}

export function buildAgentWorkflowVariableAnalysis(
  detail: AgentWorkflowRunDetail,
  generatedAt = new Date()
): AgentWorkflowVariableAnalysis {
  const state = new Map<string, AgentWorkflowVariableValue>();
  const summaries = new Map<string, AgentWorkflowVariableSummary>();
  const snapshots: AgentWorkflowVariableAnalysis["snapshots"] = [];
  let variableLimitReached = false;
  let totalCostMicrousd = 0n;
  let totalLatencyMs = 0;

  function observe(
    namespace: AgentWorkflowVariableNamespace,
    path: string,
    value: unknown,
    source: {
      eventId: string | null;
      sequence: string;
      stepKey: string | null;
    }
  ) {
    const key = variableKey(namespace, path);
    if (!state.has(key) && state.size >= MAX_VARIABLES) {
      variableLimitReached = true;
      return;
    }
    const next: AgentWorkflowVariableValue = {
      key,
      namespace,
      sourceEventId: source.eventId,
      sourceSequence: source.sequence,
      stepKey: source.stepKey,
      valueHash: sha256(value),
      valuePreview: variablePreview(value),
      valueType: variableValueType(value)
    };
    const previousSummary = summaries.get(key);
    summaries.set(key, {
      changeCount:
        (previousSummary?.changeCount ?? 0) +
        (previousSummary && previousSummary.latestValueHash !== next.valueHash
          ? 1
          : 0),
      firstSeenSequence: previousSummary?.firstSeenSequence ?? source.sequence,
      key,
      lastSeenSequence: source.sequence,
      latestValueHash: next.valueHash,
      latestValuePreview: next.valuePreview,
      namespace,
      observationCount: (previousSummary?.observationCount ?? 0) + 1,
      valueType: next.valueType
    });
    state.set(key, next);
  }

  function observeManifest(
    namespace: AgentWorkflowVariableNamespace,
    path: string,
    value: unknown,
    source: {
      eventId: string | null;
      sequence: string;
      stepKey: string | null;
    },
    depth = 0
  ) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value as Record<string, unknown>).length > 0 &&
      depth < 5
    ) {
      for (const [key, child] of Object.entries(
        value as Record<string, unknown>
      ).sort(([left], [right]) => left.localeCompare(right))) {
        observeManifest(namespace, `${path}.${key}`, child, source, depth + 1);
      }
      return;
    }
    observe(namespace, path, value, source);
  }

  function recordSnapshot(input: {
    createdAt: string;
    eventType: AgentWorkflowVariableAnalysis["snapshots"][number]["eventType"];
    sequence: string;
    stepKey: string | null;
  }) {
    const variables = [...state.values()].sort(
      (left, right) =>
        VARIABLE_NAMESPACES.indexOf(left.namespace) -
          VARIABLE_NAMESPACES.indexOf(right.namespace) ||
        left.key.localeCompare(right.key)
    );
    const previous = snapshots.at(-1)?.variables ?? [];
    const previousByKey = new Map(
      previous.map((variable) => [variable.key, variable.valueHash])
    );
    const currentByKey = new Map(
      variables.map((variable) => [variable.key, variable.valueHash])
    );
    let added = 0;
    let changed = 0;
    let unchanged = 0;
    for (const variable of variables) {
      const previousHash = previousByKey.get(variable.key);
      if (!previousHash) added += 1;
      else if (previousHash === variable.valueHash) unchanged += 1;
      else changed += 1;
    }
    const removed = [...previousByKey.keys()].filter(
      (key) => !currentByKey.has(key)
    ).length;
    snapshots.push({
      ...input,
      changeSummary: { added, changed, removed, unchanged },
      variables
    });
    if (snapshots.length > MAX_INTERACTIVE_SNAPSHOTS + 1) {
      snapshots.splice(1, snapshots.length - MAX_INTERACTIVE_SNAPSHOTS - 1);
    }
  }

  const baselineSource = {
    eventId: null,
    sequence: "0",
    stepKey: null
  };
  observeManifest("Input", "run", detail.run.inputManifest, baselineSource);
  observe("Input", "run.inputHash", detail.run.inputHash, baselineSource);
  observe(
    "Policy",
    "run.decisionIds",
    detail.run.policyDecisionIds,
    baselineSource
  );
  observe(
    "Policy",
    "run.snapshotHash",
    detail.run.policySnapshotHash,
    baselineSource
  );
  observe("Evidence", "run.ids", detail.run.evidenceIds, baselineSource);
  observe(
    "Evidence",
    "run.manifestHash",
    detail.run.evidenceManifestHash,
    baselineSource
  );
  observe("Control", "definition.name", detail.definition.name, baselineSource);
  observe(
    "Control",
    "definition.version",
    detail.definition.version,
    baselineSource
  );
  observe(
    "Control",
    "definition.hash",
    detail.definition.definitionHash,
    baselineSource
  );
  observe("Control", "run.status", "Created", baselineSource);
  recordSnapshot({
    createdAt: detail.run.createdAt,
    eventType: "Baseline",
    sequence: "0",
    stepKey: null
  });

  for (const event of detail.events) {
    const source = {
      eventId: event.workflowEventId,
      sequence: event.sequence,
      stepKey: event.stepKey
    };
    const namespace = namespaceForEvent(detail, event);
    const stepPath = event.stepKey ?? "run";
    observeManifest(
      namespace,
      `${stepPath}.manifest`,
      event.payloadRedacted,
      source
    );
    observe("Transition", "run.eventType", event.eventType, source);
    observe("Transition", "run.sequence", event.sequence, source);
    if (event.stepKey) {
      observe("Transition", "run.stepKey", event.stepKey, source);
    }
    observe("Control", "run.lastEventHash", event.eventHash, source);
    if (event.modelProvider) {
      observe("Model", `${stepPath}.provider`, event.modelProvider, source);
    }
    if (event.modelVersion) {
      observe("Model", `${stepPath}.version`, event.modelVersion, source);
    }
    if (event.toolRequestId) {
      observe("Tool", `${stepPath}.requestId`, event.toolRequestId, source);
    }
    if (event.policyDecisionId) {
      observe(
        "Policy",
        `${stepPath}.decisionId`,
        event.policyDecisionId,
        source
      );
    }
    if (event.evidenceIds.length > 0) {
      observe("Evidence", `${stepPath}.ids`, event.evidenceIds, source);
    }
    if (event.costMicrousd !== null) {
      totalCostMicrousd += BigInt(event.costMicrousd);
      observe(
        "Performance",
        "run.totalCostMicrousd",
        totalCostMicrousd.toString(),
        source
      );
    }
    if (event.latencyMs !== null) {
      totalLatencyMs += event.latencyMs;
      observe("Performance", "run.totalLatencyMs", totalLatencyMs, source);
      observe(
        "Performance",
        `${stepPath}.latestLatencyMs`,
        event.latencyMs,
        source
      );
    }
    if (event.eventType === "StepStarted") {
      observe("Control", "run.status", "Running", source);
    } else if (event.eventType === "RunCompleted") {
      observe("Control", "run.status", "Completed", source);
    } else if (event.eventType === "RunFailed") {
      observe("Control", "run.status", "Failed", source);
    }
    recordSnapshot({
      createdAt: event.createdAt,
      eventType: event.eventType,
      sequence: event.sequence,
      stepKey: event.stepKey
    });
  }

  const variables = [...summaries.values()].sort(
    (left, right) =>
      VARIABLE_NAMESPACES.indexOf(left.namespace) -
        VARIABLE_NAMESPACES.indexOf(right.namespace) ||
      left.key.localeCompare(right.key)
  );
  const namespaceCounts = Object.fromEntries(
    VARIABLE_NAMESPACES.map((namespace) => [
      namespace,
      variables.filter((variable) => variable.namespace === namespace).length
    ])
  );
  const limitations = [
    "Only persisted, redacted workflow manifests and references are analyzed; raw prompts, responses, credentials, and deliberately unrecorded secrets cannot be reconstructed.",
    "Value previews are bounded for operator scanning; SHA-256 hashes preserve exact change detection without expanding retained content."
  ];
  if (detail.events.length > MAX_INTERACTIVE_SNAPSHOTS) {
    limitations.push(
      `The interactive lens retains the baseline plus the latest ${MAX_INTERACTIVE_SNAPSHOTS} event snapshots; the complete append-only recorder remains authoritative.`
    );
  }
  if (variableLimitReached) {
    limitations.push(
      `The interactive lens is bounded to ${MAX_VARIABLES} variables; use the complete recorder for additional persisted fields.`
    );
  }

  return AgentWorkflowVariableAnalysisSchema.parse({
    generatedAt: generatedAt.toISOString(),
    integrityVerified: detail.flightRecorderValid,
    limitations,
    namespaceCounts,
    snapshots,
    summary: {
      changedVariableCount: variables.filter(
        (variable) => variable.changeCount > 0
      ).length,
      eventCount: detail.events.length,
      snapshotCount: snapshots.length,
      totalCostMicrousd: totalCostMicrousd.toString(),
      totalLatencyMs,
      variableCount: variables.length
    },
    variables,
    workflowRunId: detail.run.workflowRunId
  });
}

function assertSafeRedactedPayload(value: unknown, path = "payloadRedacted") {
  if (JSON.stringify(value).length > 100_000) {
    throw new AppServiceError(
      "Workflow event payload exceeds 100 KB.",
      400,
      "workflow_payload_too_large"
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeRedactedPayload(item, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[-_\s]/gu, "").toLowerCase();
    if (
      /^(?:password|secret|privatekey|clientsecret|credential|authorization|apikey|accesstoken|refreshtoken)$/u.test(
        normalized
      )
    ) {
      throw new AppServiceError(
        `Workflow event payload contains forbidden secret field ${path}.${key}.`,
        400,
        "workflow_payload_contains_secret"
      );
    }
    assertSafeRedactedPayload(child, `${path}.${key}`);
  }
}

function assertWorkflowDag(input: CreateAgentWorkflowDefinitionInput) {
  const byKey = new Map(input.steps.map((step) => [step.stepKey, step]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(stepKey: string) {
    if (visiting.has(stepKey)) {
      throw new AppServiceError(
        "Workflow dependencies contain a cycle.",
        400,
        "workflow_dependency_cycle"
      );
    }
    if (visited.has(stepKey)) return;
    visiting.add(stepKey);
    for (const dependency of byKey.get(stepKey)?.dependsOn ?? []) {
      visit(dependency);
    }
    visiting.delete(stepKey);
    visited.add(stepKey);
  }

  for (const step of input.steps) visit(step.stepKey);
}

function serializeDefinition(record: {
  createdAt: Date;
  createdBy: string;
  definitionHash: string;
  name: string;
  purpose: string;
  steps: Prisma.JsonValue;
  tenantId: string;
  version: number;
  workflowDefinitionId: string;
}): AgentWorkflowDefinition {
  return AgentWorkflowDefinitionSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString()
  });
}

function serializeRun(record: {
  createdAt: Date;
  createdBy: string;
  definitionVersion: number;
  endedAt: Date | null;
  evidenceIds: string[];
  evidenceManifestHash: string;
  forkedFromCheckpointId: string | null;
  forkedFromRunId: string | null;
  inputHash: string;
  inputManifest: Prisma.JsonValue;
  modelSessionId: string | null;
  policyDecisionIds: string[];
  policySnapshotHash: string;
  reusedThroughSequence: bigint | null;
  startedAt: Date | null;
  status: string;
  tenantId: string;
  workflowDefinitionId: string;
  workflowRunId: string;
}): AgentWorkflowRun {
  return AgentWorkflowRunSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    reusedThroughSequence: record.reusedThroughSequence?.toString() ?? null,
    startedAt: record.startedAt?.toISOString() ?? null
  });
}

function serializeEvent(record: {
  costMicrousd: bigint | null;
  createdAt: Date;
  eventHash: string;
  eventType: string;
  evidenceIds: string[];
  latencyMs: number | null;
  modelProvider: string | null;
  modelVersion: string | null;
  payloadRedacted: Prisma.JsonValue;
  policyDecisionId: string | null;
  previousEventHash: string | null;
  sequence: bigint;
  stepKey: string | null;
  tenantId: string;
  toolRequestId: string | null;
  workflowEventId: string;
  workflowRunId: string;
}): AgentWorkflowEvent {
  return AgentWorkflowEventSchema.parse({
    ...record,
    costMicrousd: record.costMicrousd?.toString() ?? null,
    createdAt: record.createdAt.toISOString(),
    sequence: record.sequence.toString()
  });
}

function serializeCheckpoint(record: {
  checkpointHash: string;
  createdAt: Date;
  evidenceManifestHash: string;
  inputHash: string;
  policySnapshotHash: string;
  reusableThroughStepKey: string;
  sequence: bigint;
  tenantId: string;
  workflowCheckpointId: string;
  workflowRunId: string;
}): AgentWorkflowCheckpoint {
  return AgentWorkflowCheckpointSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    sequence: record.sequence.toString()
  });
}

async function evidenceManifest(
  prisma: PrismaClient,
  tenantId: string,
  evidenceIds: string[]
) {
  const ids = [...new Set(evidenceIds)].sort();
  const rows = await prisma.evidenceArtifact.findMany({
    orderBy: { evidenceId: "asc" },
    select: {
      chainHash: true,
      evidenceId: true,
      redactedSha256: true,
      sha256: true
    },
    where: { evidenceId: { in: ids }, tenantId }
  });
  if (rows.length !== ids.length) {
    throw new AppServiceError(
      "One or more workflow evidence references were not found in this tenant.",
      400,
      "workflow_evidence_not_found"
    );
  }
  return {
    hash: sha256(rows),
    ids
  };
}

async function policySnapshot(
  prisma: PrismaClient,
  tenantId: string,
  policyDecisionIds: string[],
  now = new Date()
) {
  const ids = [...new Set(policyDecisionIds)].sort();
  const rows = await prisma.policyDecision.findMany({
    orderBy: { policyDecisionId: "asc" },
    select: {
      approvalState: true,
      approvedAt: true,
      expiresAt: true,
      outcome: true,
      policyDecisionId: true,
      requestedAction: true,
      safetyLevel: true,
      scopeId: true,
      target: true,
      updatedAt: true
    },
    where: { policyDecisionId: { in: ids }, tenantId }
  });
  if (rows.length !== ids.length) {
    throw new AppServiceError(
      "One or more workflow policy decisions were not found in this tenant.",
      400,
      "workflow_policy_not_found"
    );
  }
  const valid = rows.every(
    (row) =>
      row.outcome === "Allowed" &&
      (row.approvalState === "NotRequired" ||
        row.approvalState === "Approved") &&
      (!row.expiresAt || row.expiresAt.getTime() > now.getTime())
  );
  return { hash: sha256(rows), ids, valid };
}

function eventHashPayload(input: {
  costMicrousd: bigint | null;
  eventType: string;
  evidenceIds: string[];
  latencyMs: number | null;
  modelProvider: string | null;
  modelVersion: string | null;
  payloadRedacted: unknown;
  policyDecisionId: string | null;
  previousEventHash: string | null;
  sequence: bigint;
  stepKey: string | null;
  toolRequestId: string | null;
  workflowRunId: string;
}) {
  return {
    costMicrousd: input.costMicrousd?.toString() ?? null,
    eventType: input.eventType,
    evidenceIds: input.evidenceIds,
    latencyMs: input.latencyMs,
    modelProvider: input.modelProvider,
    modelVersion: input.modelVersion,
    payloadRedacted: input.payloadRedacted,
    policyDecisionId: input.policyDecisionId,
    previousEventHash: input.previousEventHash,
    sequence: input.sequence.toString(),
    stepKey: input.stepKey,
    toolRequestId: input.toolRequestId,
    workflowRunId: input.workflowRunId
  };
}

async function appendEvent(
  prisma: PrismaClient,
  run: { tenantId: string; workflowRunId: string },
  input: AppendAgentWorkflowEventInput
) {
  assertSafeRedactedPayload(input.payloadRedacted);
  const evidence = await evidenceManifest(
    prisma,
    run.tenantId,
    input.evidenceIds
  );

  if (input.policyDecisionId) {
    await policySnapshot(prisma, run.tenantId, [input.policyDecisionId]);
  }
  if (input.toolRequestId) {
    const toolRequest = await prisma.modelToolRequest.findFirst({
      select: { toolRequestId: true },
      where: {
        tenantId: run.tenantId,
        toolRequestId: input.toolRequestId
      }
    });
    if (!toolRequest) {
      throw new AppServiceError(
        "Workflow tool request was not found in this tenant.",
        400,
        "workflow_tool_request_not_found"
      );
    }
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const previous = await prisma.agentWorkflowEvent.findFirst({
      orderBy: { sequence: "desc" },
      where: { workflowRunId: run.workflowRunId }
    });
    const sequence = (previous?.sequence ?? 0n) + 1n;
    const data = {
      costMicrousd:
        input.costMicrousd === undefined ? null : BigInt(input.costMicrousd),
      eventType: input.eventType,
      evidenceIds: evidence.ids,
      latencyMs: input.latencyMs ?? null,
      modelProvider: input.modelProvider ?? null,
      modelVersion: input.modelVersion ?? null,
      payloadRedacted: input.payloadRedacted,
      policyDecisionId: input.policyDecisionId ?? null,
      previousEventHash: previous?.eventHash ?? null,
      sequence,
      stepKey: input.stepKey ?? null,
      tenantId: run.tenantId,
      toolRequestId: input.toolRequestId ?? null,
      workflowRunId: run.workflowRunId
    };
    try {
      return await prisma.agentWorkflowEvent.create({
        data: {
          ...data,
          eventHash: sha256(eventHashPayload(data)),
          payloadRedacted: data.payloadRedacted as Prisma.InputJsonValue
        }
      });
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error("Unable to append workflow event.");
}

export function verifyAgentWorkflowEventChain(
  events: Array<{
    costMicrousd: bigint | null;
    eventHash: string;
    eventType: string;
    evidenceIds: string[];
    latencyMs: number | null;
    modelProvider: string | null;
    modelVersion: string | null;
    payloadRedacted: Prisma.JsonValue;
    policyDecisionId: string | null;
    previousEventHash: string | null;
    sequence: bigint;
    stepKey: string | null;
    toolRequestId: string | null;
    workflowRunId: string;
  }>
) {
  let previousHash: string | null = null;
  let sequence = 1n;
  for (const event of events) {
    if (
      event.sequence !== sequence ||
      event.previousEventHash !== previousHash ||
      event.eventHash !== sha256(eventHashPayload(event))
    ) {
      return false;
    }
    previousHash = event.eventHash;
    sequence += 1n;
  }
  return true;
}

export function createAgentWorkflowServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "appendAgentWorkflowEvent"
  | "createAgentWorkflowCheckpoint"
  | "createAgentWorkflowDefinition"
  | "createAgentWorkflowRun"
  | "evaluateAgentWorkflowRunQuality"
  | "getAgentWorkflowRun"
  | "getAgentWorkflowVariableAnalysis"
  | "listAgentWorkflowDefinitions"
  | "listAgentWorkflowRuns"
  | "replayAgentWorkflowRun"
> {
  const { prisma } = deps;

  async function loadRun(context: AuthenticatedContext, workflowRunId: string) {
    const run = await prisma.agentWorkflowRun.findFirst({
      include: { definition: true },
      where: { tenantId: context.tenant.tenantId, workflowRunId }
    });
    if (!run) {
      throw new AppServiceError(
        "Agent workflow run not found.",
        404,
        "agent_workflow_run_not_found"
      );
    }
    return run;
  }

  async function loadRunDetail(
    context: AuthenticatedContext,
    workflowRunId: string
  ) {
    const run = await loadRun(context, workflowRunId);
    const [events, checkpoints] = await Promise.all([
      prisma.agentWorkflowEvent.findMany({
        orderBy: { sequence: "asc" },
        where: { workflowRunId }
      }),
      prisma.agentWorkflowCheckpoint.findMany({
        orderBy: { sequence: "asc" },
        where: { workflowRunId }
      })
    ]);
    return AgentWorkflowRunDetailSchema.parse({
      checkpoints: checkpoints.map(serializeCheckpoint),
      definition: serializeDefinition(run.definition),
      events: events.map(serializeEvent),
      flightRecorderValid: verifyAgentWorkflowEventChain(events),
      run: serializeRun(run)
    }) as AgentWorkflowRunDetail;
  }

  return {
    async listAgentWorkflowDefinitions(context) {
      const definitions = await prisma.agentWorkflowDefinition.findMany({
        orderBy: [{ name: "asc" }, { version: "desc" }],
        where: { tenantId: context.tenant.tenantId }
      });
      return definitions.map(serializeDefinition);
    },

    async createAgentWorkflowDefinition(context, input) {
      requireRole(
        context.membership.role,
        WORKFLOW_OPERATOR_ROLES,
        "create agent workflow definitions"
      );
      assertWorkflowDag(input);
      const definitionHash = sha256({
        name: input.name,
        purpose: input.purpose,
        steps: input.steps,
        version: input.version
      });
      const existing = await prisma.agentWorkflowDefinition.findUnique({
        where: {
          tenantId_name_version: {
            name: input.name,
            tenantId: context.tenant.tenantId,
            version: input.version
          }
        }
      });
      if (existing) {
        if (existing.definitionHash === definitionHash) {
          return serializeDefinition(existing);
        }
        throw new AppServiceError(
          "This workflow name and version already exists with different content.",
          409,
          "agent_workflow_version_conflict"
        );
      }
      const created = await prisma.agentWorkflowDefinition.create({
        data: {
          createdBy: context.user.userId,
          definitionHash,
          name: input.name,
          purpose: input.purpose,
          steps: input.steps as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          version: input.version
        }
      });
      return serializeDefinition(created);
    },

    async listAgentWorkflowRuns(context) {
      const runs = await prisma.agentWorkflowRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return runs.map(serializeRun);
    },

    async createAgentWorkflowRun(context, input) {
      requireRole(
        context.membership.role,
        WORKFLOW_OPERATOR_ROLES,
        "create agent workflow runs"
      );
      const definition = await prisma.agentWorkflowDefinition.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          workflowDefinitionId: input.workflowDefinitionId
        }
      });
      if (!definition) {
        throw new AppServiceError(
          "Agent workflow definition not found.",
          404,
          "agent_workflow_definition_not_found"
        );
      }
      assertSafeRedactedPayload(input.inputManifest, "inputManifest");
      if (input.modelSessionId) {
        const modelSession = await prisma.modelSession.findFirst({
          select: { modelSessionId: true },
          where: {
            modelSessionId: input.modelSessionId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!modelSession) {
          throw new AppServiceError(
            "Model session not found for this workflow run.",
            400,
            "workflow_model_session_not_found"
          );
        }
      }
      const evidence = await evidenceManifest(
        prisma,
        context.tenant.tenantId,
        input.evidenceIds
      );
      const policies = await policySnapshot(
        prisma,
        context.tenant.tenantId,
        input.policyDecisionIds
      );
      const created = await prisma.agentWorkflowRun.create({
        data: {
          createdBy: context.user.userId,
          definitionVersion: definition.version,
          evidenceIds: evidence.ids,
          evidenceManifestHash: evidence.hash,
          inputHash: sha256(input.inputManifest),
          inputManifest: input.inputManifest as Prisma.InputJsonValue,
          modelSessionId: input.modelSessionId ?? null,
          policyDecisionIds: policies.ids,
          policySnapshotHash: policies.hash,
          tenantId: context.tenant.tenantId,
          workflowDefinitionId: definition.workflowDefinitionId
        }
      });
      await appendEvent(prisma, created, {
        eventType: "RunCreated",
        evidenceIds: evidence.ids,
        payloadRedacted: {
          definitionHash: definition.definitionHash,
          evidenceManifestHash: evidence.hash,
          inputHash: created.inputHash,
          policySnapshotHash: policies.hash
        }
      });
      return serializeRun(created);
    },

    async appendAgentWorkflowEvent(context, workflowRunId, input) {
      requireRole(
        context.membership.role,
        WORKFLOW_OPERATOR_ROLES,
        "append agent workflow events"
      );
      const run = await loadRun(context, workflowRunId);
      if (["Completed", "Failed", "Cancelled"].includes(run.status)) {
        throw new AppServiceError(
          "A terminal workflow run cannot accept more events.",
          409,
          "agent_workflow_run_terminal"
        );
      }
      const definitionSteps = run.definition.steps as Array<{
        stepKey: string;
      }>;
      if (
        input.stepKey &&
        !definitionSteps.some((step) => step.stepKey === input.stepKey)
      ) {
        throw new AppServiceError(
          "Workflow event step is not part of the versioned definition.",
          400,
          "agent_workflow_step_not_found"
        );
      }
      const event = await appendEvent(prisma, run, input);
      if (input.eventType === "StepStarted" && run.status === "Created") {
        await prisma.agentWorkflowRun.update({
          data: { startedAt: new Date(), status: "Running" },
          where: { workflowRunId }
        });
      } else if (
        input.eventType === "RunCompleted" ||
        input.eventType === "RunFailed"
      ) {
        await prisma.agentWorkflowRun.update({
          data: {
            endedAt: new Date(),
            status: input.eventType === "RunCompleted" ? "Completed" : "Failed"
          },
          where: { workflowRunId }
        });
      }
      return serializeEvent(event);
    },

    async createAgentWorkflowCheckpoint(context, workflowRunId, input) {
      requireRole(
        context.membership.role,
        WORKFLOW_OPERATOR_ROLES,
        "create agent workflow checkpoints"
      );
      const run = await loadRun(context, workflowRunId);
      const steps = run.definition.steps as Array<{ stepKey: string }>;
      if (
        !steps.some((step) => step.stepKey === input.reusableThroughStepKey)
      ) {
        throw new AppServiceError(
          "Checkpoint step is not part of the versioned workflow definition.",
          400,
          "agent_workflow_step_not_found"
        );
      }
      const event = await appendEvent(prisma, run, {
        eventType: "CheckpointCreated",
        evidenceIds: run.evidenceIds,
        payloadRedacted: {
          reusableThroughStepKey: input.reusableThroughStepKey
        },
        stepKey: input.reusableThroughStepKey
      });
      const checkpointHash = sha256({
        eventHash: event.eventHash,
        evidenceManifestHash: run.evidenceManifestHash,
        inputHash: run.inputHash,
        policySnapshotHash: run.policySnapshotHash,
        reusableThroughStepKey: input.reusableThroughStepKey,
        sequence: event.sequence.toString()
      });
      const checkpoint = await prisma.agentWorkflowCheckpoint.create({
        data: {
          checkpointHash,
          evidenceManifestHash: run.evidenceManifestHash,
          inputHash: run.inputHash,
          policySnapshotHash: run.policySnapshotHash,
          reusableThroughStepKey: input.reusableThroughStepKey,
          sequence: event.sequence,
          tenantId: run.tenantId,
          workflowRunId
        }
      });
      return serializeCheckpoint(checkpoint);
    },

    async getAgentWorkflowRun(context, workflowRunId) {
      return loadRunDetail(context, workflowRunId);
    },

    async getAgentWorkflowVariableAnalysis(context, workflowRunId) {
      return buildAgentWorkflowVariableAnalysis(
        await loadRunDetail(context, workflowRunId)
      );
    },

    async evaluateAgentWorkflowRunQuality(context, workflowRunId) {
      return evaluateAgentWorkflowQuality(
        await loadRunDetail(context, workflowRunId)
      );
    },

    async replayAgentWorkflowRun(context, workflowRunId, input) {
      requireRole(
        context.membership.role,
        WORKFLOW_OPERATOR_ROLES,
        "replay agent workflow checkpoints"
      );
      const run = await loadRun(context, workflowRunId);
      const checkpoint = await prisma.agentWorkflowCheckpoint.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          workflowCheckpointId: input.workflowCheckpointId,
          workflowRunId
        }
      });
      if (!checkpoint) {
        throw new AppServiceError(
          "Workflow checkpoint not found.",
          404,
          "agent_workflow_checkpoint_not_found"
        );
      }
      const events = await prisma.agentWorkflowEvent.findMany({
        orderBy: { sequence: "asc" },
        where: { workflowRunId, sequence: { lte: checkpoint.sequence } }
      });
      if (!verifyAgentWorkflowEventChain(events)) {
        throw new AppServiceError(
          "Workflow event chain verification failed; replay is denied.",
          409,
          "agent_workflow_chain_invalid"
        );
      }
      const inputManifest =
        input.inputManifest ?? (run.inputManifest as Record<string, unknown>);
      assertSafeRedactedPayload(inputManifest, "inputManifest");
      const currentInputHash = sha256(inputManifest);
      const evidence = await evidenceManifest(
        prisma,
        run.tenantId,
        run.evidenceIds
      );
      const policies = await policySnapshot(
        prisma,
        run.tenantId,
        run.policyDecisionIds
      );
      const mismatches = [
        currentInputHash !== checkpoint.inputHash ? "input" : null,
        policies.hash !== checkpoint.policySnapshotHash || !policies.valid
          ? "policy"
          : null,
        evidence.hash !== checkpoint.evidenceManifestHash ? "evidence" : null
      ].filter((value): value is string => value !== null);
      if (mismatches.length > 0) {
        throw new AppServiceError(
          `Checkpoint reuse denied because ${mismatches.join(", ")} validity changed.`,
          409,
          "agent_workflow_checkpoint_stale"
        );
      }
      const fork = await prisma.agentWorkflowRun.create({
        data: {
          createdBy: context.user.userId,
          definitionVersion: run.definitionVersion,
          evidenceIds: evidence.ids,
          evidenceManifestHash: evidence.hash,
          forkedFromCheckpointId: checkpoint.workflowCheckpointId,
          forkedFromRunId: workflowRunId,
          inputHash: currentInputHash,
          inputManifest: inputManifest as Prisma.InputJsonValue,
          policyDecisionIds: policies.ids,
          policySnapshotHash: policies.hash,
          reusedThroughSequence: checkpoint.sequence,
          tenantId: run.tenantId,
          workflowDefinitionId: run.workflowDefinitionId
        }
      });
      await appendEvent(prisma, fork, {
        eventType: "UpstreamReused",
        evidenceIds: evidence.ids,
        payloadRedacted: {
          checkpointHash: checkpoint.checkpointHash,
          reusedEventHashes: events.map((event) => event.eventHash),
          reusedThroughStepKey: checkpoint.reusableThroughStepKey,
          sourceRunId: workflowRunId
        },
        stepKey: checkpoint.reusableThroughStepKey
      });
      return serializeRun(fork);
    }
  };
}
