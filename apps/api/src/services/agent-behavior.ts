import { createHash } from "node:crypto";

import {
  AgentBehaviorAnalysisSchema,
  type AgentBehaviorAnalysis,
  type AgentBehaviorFinding,
  type AgentBehaviorRunMetrics,
  type AgentBehaviorSeverity
} from "@periscan/shared";

import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import { verifyAgentWorkflowEventChain } from "./agent-workflows.js";

type BehaviorEvent = Parameters<
  typeof verifyAgentWorkflowEventChain
>[0][number] & { workflowEventId: string };

export type AgentBehaviorRunInput = {
  createdAt: Date;
  events: BehaviorEvent[];
  status: string;
  toolRequests: Array<{
    approvedAt: Date | null;
    createdAt: Date;
    scopeIds: string[];
    status: string;
    toolName: string;
    toolRequestId: string;
  }>;
  usageCostsMicrousd: bigint[];
  workflowRunId: string;
};

type FindingDraft = Omit<AgentBehaviorFinding, "findingKey">;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

function safeNumber(value: bigint) {
  return Number(
    value > BigInt(Number.MAX_SAFE_INTEGER)
      ? BigInt(Number.MAX_SAFE_INTEGER)
      : value
  );
}

function finding(input: FindingDraft): AgentBehaviorFinding {
  return {
    ...input,
    findingKey: createHash("sha256")
      .update(`${input.workflowRunId}:${input.ruleId}`)
      .digest("hex")
  };
}

function severityForCount(
  count: number,
  criticalAt: number
): AgentBehaviorSeverity {
  return count >= criticalAt ? "Critical" : "High";
}

export function analyzeAgentBehavior(input: {
  generatedAt: Date;
  runs: AgentBehaviorRunInput[];
  tenantId: string;
  approvalRequiredTools: Set<string>;
  windowDays?: number;
}): AgentBehaviorAnalysis {
  const windowDays = input.windowDays ?? 30;
  const metrics: AgentBehaviorRunMetrics[] = input.runs.map((run) => {
    const usageCost = run.usageCostsMicrousd.reduce(
      (total, value) => total + value,
      0n
    );
    const eventCost = run.events.reduce(
      (total, event) => total + (event.costMicrousd ?? 0n),
      0n
    );
    return {
      costMicrousd: safeNumber(usageCost > 0n ? usageCost : eventCost),
      deniedToolRequests: run.toolRequests.filter(
        (request) => request.status === "Denied"
      ).length,
      eventCount: run.events.length,
      failedToolRequests: run.toolRequests.filter(
        (request) => request.status === "Failed"
      ).length,
      flightRecorderValid: verifyAgentWorkflowEventChain(run.events),
      scopeCount: new Set(
        run.toolRequests.flatMap((request) => request.scopeIds)
      ).size,
      toolRequestCount: run.toolRequests.length,
      workflowRunId: run.workflowRunId
    };
  });
  const baseline = {
    medianCostMicrousd: Math.round(
      median(metrics.map((run) => run.costMicrousd))
    ),
    medianScopeCount: median(metrics.map((run) => run.scopeCount)),
    medianToolRequests: median(metrics.map((run) => run.toolRequestCount)),
    runCount: metrics.length,
    windowDays
  };
  const findings: AgentBehaviorFinding[] = [];

  for (const [index, run] of input.runs.entries()) {
    const runMetrics = metrics[index]!;
    const eventRefs = run.events.map(
      (event) => `workflow-event:${event.workflowEventId}`
    );
    const toolRefs = run.toolRequests.map(
      (request) => `tool-request:${request.toolRequestId}`
    );
    const fallbackRefs = [`workflow-run:${run.workflowRunId}`];

    if (!runMetrics.flightRecorderValid) {
      findings.push(
        finding({
          baseline:
            "Every append-only recorder event must preserve sequence and hash-chain integrity.",
          evidenceRefs: eventRefs.length ? eventRefs : fallbackRefs,
          explanation:
            "The stored sequence, previous-event hash, or recomputed event hash does not match the durable recorder.",
          observed: `${run.events.length} event(s); chain verification failed`,
          recommendedAction:
            "Stop checkpoint reuse, preserve the database evidence, and investigate control-plane tampering before continuing the run.",
          ruleId: "FlightRecorderIntegrity",
          severity: "Critical",
          title: "Workflow recorder integrity failed",
          workflowRunId: run.workflowRunId
        })
      );
    }

    const unapprovedCompletions = run.toolRequests.filter(
      (request) =>
        request.status === "Completed" &&
        input.approvalRequiredTools.has(request.toolName) &&
        request.approvedAt === null
    );
    if (unapprovedCompletions.length > 0) {
      findings.push(
        finding({
          baseline:
            "Every completed approval-required tool request must have a recorded approval timestamp.",
          evidenceRefs: unapprovedCompletions.map(
            (request) => `tool-request:${request.toolRequestId}`
          ),
          explanation:
            "A tool marked approval-required reached Completed without a durable approval record.",
          observed: `${unapprovedCompletions.length} completion(s) without approval`,
          recommendedAction:
            "Activate the session kill switch, inspect policy/audit records, and do not trust downstream results until reviewed.",
          ruleId: "ApprovalIntegrity",
          severity: "Critical",
          title: "Approval boundary integrity failed",
          workflowRunId: run.workflowRunId
        })
      );
    }

    if (runMetrics.deniedToolRequests >= 3) {
      findings.push(
        finding({
          baseline: "Fewer than 3 denied tool requests per workflow run.",
          evidenceRefs: run.toolRequests
            .filter((request) => request.status === "Denied")
            .map((request) => `tool-request:${request.toolRequestId}`),
          explanation:
            "Repeated policy denials can indicate goal drift, an incompatible policy profile, or attempts to exceed the authorized tool envelope.",
          observed: `${runMetrics.deniedToolRequests} denied tool requests`,
          recommendedAction:
            "Pause the session and compare the goal, policy profile, requested tools, and authorized scopes before resuming.",
          ruleId: "PolicyDenialBurst",
          severity: severityForCount(runMetrics.deniedToolRequests, 6),
          title: "Repeated policy denials",
          workflowRunId: run.workflowRunId
        })
      );
    }

    if (runMetrics.failedToolRequests >= 3) {
      findings.push(
        finding({
          baseline: "Fewer than 3 failed tool requests per workflow run.",
          evidenceRefs: run.toolRequests
            .filter((request) => request.status === "Failed")
            .map((request) => `tool-request:${request.toolRequestId}`),
          explanation:
            "A repeated failure sequence can amplify retries, cost, and side-effect risk even when each individual tool is governed.",
          observed: `${runMetrics.failedToolRequests} failed tool requests`,
          recommendedAction:
            "Stop automatic retries, review the first failure, and resume only from a still-valid checkpoint.",
          ruleId: "ToolFailureBurst",
          severity: severityForCount(runMetrics.failedToolRequests, 6),
          title: "Tool failure burst",
          workflowRunId: run.workflowRunId
        })
      );
    }

    const toolVelocityThreshold = Math.max(
      10,
      Math.ceil(baseline.medianToolRequests * 4)
    );
    if (runMetrics.toolRequestCount >= toolVelocityThreshold) {
      findings.push(
        finding({
          baseline: `30-day median ${baseline.medianToolRequests}; alert threshold ${toolVelocityThreshold} requests`,
          evidenceRefs: toolRefs.length ? toolRefs : fallbackRefs,
          explanation:
            "This run requested materially more governed tools than the tenant's recent workflow baseline.",
          observed: `${runMetrics.toolRequestCount} tool requests`,
          recommendedAction:
            "Review the request sequence and iteration budget; narrow the goal or terminate the session if the expansion is unexplained.",
          ruleId: "ToolVelocityOutlier",
          severity:
            runMetrics.toolRequestCount >= toolVelocityThreshold * 2
              ? "High"
              : "Moderate",
          title: "Tool-request velocity outlier",
          workflowRunId: run.workflowRunId
        })
      );
    }

    const scopeThreshold = Math.max(
      5,
      Math.ceil(baseline.medianScopeCount * 3)
    );
    if (runMetrics.scopeCount >= scopeThreshold) {
      findings.push(
        finding({
          baseline: `30-day median ${baseline.medianScopeCount}; alert threshold ${scopeThreshold} distinct scopes`,
          evidenceRefs: toolRefs.length ? toolRefs : fallbackRefs,
          explanation:
            "The run expanded across substantially more authorized scopes than recent tenant workflows.",
          observed: `${runMetrics.scopeCount} distinct scopes`,
          recommendedAction:
            "Confirm the goal requires this fan-out and split the workflow into smaller blast-radius units when possible.",
          ruleId: "ScopeFanOut",
          severity: "High",
          title: "Scope fan-out exceeded baseline",
          workflowRunId: run.workflowRunId
        })
      );
    }

    const costThreshold = Math.max(
      100_000,
      Math.ceil(baseline.medianCostMicrousd * 5)
    );
    if (baseline.runCount >= 3 && runMetrics.costMicrousd >= costThreshold) {
      findings.push(
        finding({
          baseline: `30-day median ${baseline.medianCostMicrousd} µUSD; alert threshold ${costThreshold} µUSD`,
          evidenceRefs: eventRefs.length ? eventRefs : fallbackRefs,
          explanation:
            "The normalized model cost is materially above the recent workflow-run baseline.",
          observed: `${runMetrics.costMicrousd} µUSD`,
          recommendedAction:
            "Inspect turn count, cached-token attribution, provider route, and retry behavior before allowing more spend.",
          ruleId: "CostOutlier",
          severity: "High",
          title: "Workflow cost outlier",
          workflowRunId: run.workflowRunId
        })
      );
    }
  }

  return AgentBehaviorAnalysisSchema.parse({
    baseline,
    findings,
    generatedAt: input.generatedAt.toISOString(),
    methodology:
      "Explainable deterministic rules over tenant-scoped workflow events, tool requests, approvals, scopes, and normalized model cost. This is not a trained anomaly model.",
    runs: metrics,
    summary: {
      critical: findings.filter((item) => item.severity === "Critical").length,
      high: findings.filter((item) => item.severity === "High").length,
      moderate: findings.filter((item) => item.severity === "Moderate").length,
      runsAnalyzed: metrics.length,
      runsWithFindings: new Set(findings.map((item) => item.workflowRunId)).size
    },
    tenantId: input.tenantId
  });
}

export function createAgentBehaviorServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "getAgentBehaviorAnalysis"> {
  const { prisma } = deps;
  return {
    async getAgentBehaviorAnalysis(context) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [runs, approvalRequiredTools] = await Promise.all([
        prisma.agentWorkflowRun.findMany({
          include: {
            events: { orderBy: { sequence: "asc" } },
            modelSession: {
              include: {
                toolRequests: true,
                usageEvents: { select: { costMicrousd: true } }
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 200,
          where: {
            createdAt: { gte: cutoff },
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.modelTool.findMany({
          select: { toolName: true },
          where: {
            approvalRequired: true,
            tenantId: context.tenant.tenantId
          }
        })
      ]);
      return analyzeAgentBehavior({
        approvalRequiredTools: new Set(
          approvalRequiredTools.map((tool) => tool.toolName)
        ),
        generatedAt: new Date(),
        runs: runs.map((run) => ({
          createdAt: run.createdAt,
          events: run.events,
          status: run.status,
          toolRequests: (run.modelSession?.toolRequests ?? []).map(
            (request) => ({
              approvedAt: request.approvedAt,
              createdAt: request.createdAt,
              scopeIds: request.scopeIds,
              status: request.status,
              toolName: request.toolName,
              toolRequestId: request.toolRequestId
            })
          ),
          usageCostsMicrousd: (run.modelSession?.usageEvents ?? [])
            .map((event) => event.costMicrousd)
            .filter((value): value is bigint => value !== null),
          workflowRunId: run.workflowRunId
        })),
        tenantId: context.tenant.tenantId
      });
    }
  };
}
