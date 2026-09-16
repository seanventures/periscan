import type { Prisma, PrismaClient } from "@prisma/client";
import type { ModelProviderType, ModelSessionMode } from "@periscan/shared";

import { createModelProviderAdapter } from "../adapters/index.js";
import type { FetchLike, ModelToolSchema } from "../adapters/types.js";
import { decryptModelCredential } from "../credentials.js";
import {
  getModelToolDefinition,
  listModelToolDefinitions
} from "../tool-catalog.js";
import { writeModelGatewayAuditEvent } from "./audit.js";
import type { ModelSessionWithPolicy } from "./context-broker.js";
import {
  runModelGatewayTurn,
  type GatewayToolOutcome,
  type GatewayTurnResult
} from "./orchestrator.js";
import {
  createGatewayToolRequest,
  type GatewayPolicyDeps
} from "./policy-enforcement.js";
import {
  executeReadOnlyGatewayTool,
  redactGatewayToolOutput,
  type GatewayToolExecutionDeps
} from "./tool-execution.js";

export interface GatewayProviderConfig {
  providerType: ModelProviderType;
  endpointUrl: string;
  authMethod: string;
  credentialRef: string | null;
}

export interface RunModelGatewaySessionTurnArgs {
  prisma: PrismaClient;
  session: ModelSessionWithPolicy;
  provider: GatewayProviderConfig;
  prompt: string;
  userId: string;
  model: string;
  policyDeps: GatewayPolicyDeps;
  toolDeps: GatewayToolExecutionDeps;
  fetchImpl?: FetchLike;
  maxIterations?: number;
  maxTokens?: number;
  temperature?: number;
  /** Injectable clock for deterministic timeout tests. */
  now?: () => Date;
  /** Process-level master key passthrough for credential decryption tests. */
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_MAX_ITERATIONS = 8;

/**
 * Build the JSON-schema tool descriptors the model is allowed to call this turn:
 * the code-defined catalog filtered by the session mode, the policy profile
 * allow/block lists, and per-tenant enable/mode overrides. The authoritative
 * safety classification still lives in the catalog; this only controls surface.
 */
function buildToolSchemas(
  session: ModelSessionWithPolicy,
  overrides: Map<string, { enabled: boolean; allowedSessionModes: string[] }>
): ModelToolSchema[] {
  const profile = session.policyProfile;
  const mode = session.mode as ModelSessionMode;

  return listModelToolDefinitions()
    .filter((definition) => {
      const override = overrides.get(definition.toolName);
      if (override && !override.enabled) {
        return false;
      }
      const allowedModes =
        override && override.allowedSessionModes.length > 0
          ? (override.allowedSessionModes as ModelSessionMode[])
          : definition.allowedModes;
      if (!allowedModes.includes(mode)) {
        return false;
      }
      if (profile.blockedTools.includes(definition.toolName)) {
        return false;
      }
      if (
        profile.allowedTools.length > 0 &&
        !profile.allowedTools.includes(definition.toolName)
      ) {
        return false;
      }
      return true;
    })
    .map((definition) => ({
      description: definition.description,
      name: definition.toolName,
      parameters: definition.inputSchema as Record<string, unknown>
    }));
}

/**
 * Run a single Frontier Gateway turn for a session end-to-end against the
 * customer's BYO provider. Shared by the synchronous control-plane API and the
 * asynchronous worker so policy enforcement, redaction, audit, approval-pause,
 * kill switch, and timeout behave identically regardless of trigger.
 */
export async function runModelGatewaySessionTurn(
  args: RunModelGatewaySessionTurnArgs
): Promise<GatewayTurnResult> {
  const {
    prisma,
    session,
    provider,
    prompt,
    userId,
    model,
    policyDeps,
    toolDeps
  } = args;
  const now = args.now ?? (() => new Date());
  const tenantId = session.tenantId;

  const apiKey = provider.credentialRef
    ? decryptModelCredential(provider.credentialRef, args.env)
    : null;
  const adapter = createModelProviderAdapter(provider.providerType, {
    apiKey,
    authMethod: provider.authMethod,
    endpointUrl: provider.endpointUrl,
    fetchImpl: args.fetchImpl
  });

  const overrideRows = await prisma.modelTool.findMany({ where: { tenantId } });
  const overrides = new Map(
    overrideRows.map((row) => [
      row.toolName,
      { allowedSessionModes: row.allowedSessionModes, enabled: row.enabled }
    ])
  );
  const toolSchemas = buildToolSchemas(session, overrides);

  await writeModelGatewayAuditEvent(prisma, {
    eventType: "SessionStarted",
    metadata: { event: "turn_started", toolCount: toolSchemas.length },
    modelSessionId: session.modelSessionId,
    tenantId,
    userId
  });

  // Phase 2 fix (see plan.md): inject redacted context bundle data so the model
  // actually reasons over Periscan evidence (previously bundles were built/stored
  // but never delivered to the provider messages). We include a compact redacted
  // summary + evidence refs only. Full items are available via typed tools.
  const contextSummary = await buildSessionContextSummary(prisma, session);

  const result = await runModelGatewayTurn(adapter, {
    buildInitialMessages: async () => [
      {
        content:
          "You are a security operations copilot operating inside Periscan's Frontier Gateway. " +
          "You have no direct network or shell access. You may only act by calling the provided typed tools, " +
          "each of which is policy-checked, audited, and limited to redacted, in-scope data. " +
          "Never request raw secrets or out-of-scope systems. Use read-only and planning tools to gather " +
          "evidence before proposing any action.",
        role: "system"
      },
      {
        content:
          "Current redacted context for this session (evidence IDs, high-level summaries, no raw secrets or out-of-scope data):\n" +
          contextSummary,
        role: "system"
      },
      { content: prompt, role: "user" }
    ],
    checkAbort: async () => {
      const current = await prisma.modelSession.findUnique({
        select: { expiresAt: true, status: true },
        where: { modelSessionId: session.modelSessionId }
      });
      if (!current) {
        return { aborted: true, reason: "session_missing" };
      }
      if (current.status === "Terminated") {
        return { aborted: true, reason: "kill_switch" };
      }
      if (current.status === "Expired") {
        return { aborted: true, reason: "session_expired" };
      }
      if (current.expiresAt && current.expiresAt.getTime() < now().getTime()) {
        return { aborted: true, reason: "session_timeout" };
      }
      return { aborted: false };
    },
    evaluateToolCall: async (call): Promise<GatewayToolOutcome> => {
      const definition = getModelToolDefinition(call.toolName);
      const created = await createGatewayToolRequest({
        deps: policyDeps,
        input: {
          input: call.arguments ?? {},
          requestReason: definition
            ? `Model requested ${definition.title}.`
            : `Model requested tool ${call.toolName}.`,
          requestedByModel: true,
          scopeIds: session.scopeIds,
          toolName: call.toolName
        },
        prisma,
        session,
        tenantId,
        userId
      });
      return {
        denialReason: created.denialReason,
        status:
          created.status === "Allowed"
            ? "Allowed"
            : created.status === "RequiresApproval"
              ? "RequiresApproval"
              : "Denied",
        toolRequestId: created.toolRequestId
      };
    },
    executeAllowedTool: async (outcome, call) => {
      try {
        await prisma.modelToolRequest.update({
          data: { status: "Running" },
          where: { toolRequestId: outcome.toolRequestId }
        });
        const execution = await executeReadOnlyGatewayTool({
          deps: toolDeps,
          input: call.arguments ?? {},
          prisma,
          scopeIds: session.scopeIds,
          tenantId,
          toolName: call.toolName
        });
        const redacted = redactGatewayToolOutput(execution.output);

        await prisma.modelToolResult.create({
          data: {
            evidenceIds: execution.evidenceIds,
            outputPayloadRedacted: redacted as Prisma.InputJsonValue,
            returnedToModel: true,
            sensitivityLevel: execution.sensitivityLevel,
            tenantId,
            toolRequestId: outcome.toolRequestId
          }
        });
        await prisma.modelToolRequest.update({
          data: { completedAt: now(), status: "Completed" },
          where: { toolRequestId: outcome.toolRequestId }
        });

        await writeModelGatewayAuditEvent(prisma, {
          eventType: "ToolExecuted",
          evidenceIds: execution.evidenceIds,
          metadata: { toolName: call.toolName },
          modelSessionId: session.modelSessionId,
          tenantId,
          toolName: call.toolName,
          toolRequestId: outcome.toolRequestId,
          userId
        });
        await writeModelGatewayAuditEvent(prisma, {
          eventType: "ToolResultReturned",
          evidenceIds: execution.evidenceIds,
          metadata: { toolName: call.toolName },
          modelSessionId: session.modelSessionId,
          tenantId,
          toolName: call.toolName,
          toolRequestId: outcome.toolRequestId,
          userId
        });

        return { content: JSON.stringify(redacted) };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Tool execution failed.";
        await prisma.modelToolRequest.update({
          data: { denialReason: message, status: "Failed" },
          where: { toolRequestId: outcome.toolRequestId }
        });
        await writeModelGatewayAuditEvent(prisma, {
          eventType: "ToolFailed",
          metadata: { error: message, toolName: call.toolName },
          modelSessionId: session.modelSessionId,
          tenantId,
          toolName: call.toolName,
          toolRequestId: outcome.toolRequestId,
          userId
        });
        return { content: JSON.stringify({ error: "tool_failed", message }) };
      }
    },
    listToolSchemas: () => toolSchemas,
    maxIterations: args.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    maxTokens: args.maxTokens,
    model,
    temperature: args.temperature
  });

  await applyTurnResultToSession({
    now,
    prisma,
    result,
    session,
    userId
  });

  // Autonomous-validation grounding: when the operator asks about the "swarm"/
  // autonomous capability, ground the reply in REAL tenant state — never in
  // fabricated agent/autonomy metrics. Periscan's real multi-step autonomous
  // engine is the governed Engagement runner (POST /api/v1/engagements/run):
  // it executes safe (passive / active-non-invasive) steps and DENIES offensive
  // steps under the hard policy floor, recording real evidence. Nothing is
  // executed from this chat turn.
  if (prompt.toLowerCase().includes("swarm")) {
    try {
      const [engagementCount, missionCount] = await Promise.all([
        prisma.engagement.count({ where: { tenantId } }),
        prisma.validationMission.count({ where: { tenantId } })
      ]);
      result.assistantText = `${result.assistantText || ""}\n\n[Autonomous validation] Periscan runs autonomous, multi-step validation through the governed Engagement engine — safe steps execute and record real evidence; offensive steps are denied under the policy floor. This tenant currently has ${engagementCount} engagement(s) and ${missionCount} validation mission(s). Start a governed run from the Agent Swarm screen or POST /api/v1/engagements/run with a verified scope. No steps were executed from this chat turn.`;
    } catch {
      // Non-fatal: leave the model's own grounded answer unchanged.
    }
  }

  return result;
}

async function applyTurnResultToSession(input: {
  prisma: PrismaClient;
  session: ModelSessionWithPolicy;
  result: GatewayTurnResult;
  userId: string;
  now: () => Date;
}): Promise<void> {
  const { prisma, session, result, userId, now } = input;
  const tenantId = session.tenantId;

  if (result.status === "Blocked") {
    await prisma.modelSession.update({
      data: { status: "Blocked" },
      where: { modelSessionId: session.modelSessionId }
    });
    await writeModelGatewayAuditEvent(prisma, {
      eventType: "SessionPaused",
      metadata: {
        pendingToolRequestId: result.pendingToolRequestId,
        reason: "approval_required"
      },
      modelSessionId: session.modelSessionId,
      tenantId,
      toolRequestId: result.pendingToolRequestId ?? null,
      userId
    });
    return;
  }

  if (result.status === "Aborted") {
    if (result.abortReason === "session_timeout") {
      await prisma.modelSession.update({
        data: { endedAt: now(), status: "Expired" },
        where: { modelSessionId: session.modelSessionId }
      });
    }
    await writeModelGatewayAuditEvent(prisma, {
      eventType: "SessionPaused",
      metadata: { reason: result.abortReason ?? "aborted" },
      modelSessionId: session.modelSessionId,
      tenantId,
      userId
    });
    return;
  }

  // Completed: session remains Active and ready for the next turn.
  await writeModelGatewayAuditEvent(prisma, {
    eventType: "SessionStarted",
    metadata: {
      event: "turn_completed",
      iterations: result.iterations,
      toolCallsHandled: result.toolCallsHandled
    },
    modelSessionId: session.modelSessionId,
    tenantId,
    userId
  });
}

/**
 * Lightweight context summary injector (Phase 2 fix per plan.md).
 * Pulls latest persisted ContextBundle (if any) or falls back to scope list.
 * Delivers only redacted refs + summaries to the model (no raw data).
 * Full detail remains behind typed tools.
 */
async function buildSessionContextSummary(
  prisma: PrismaClient,
  session: ModelSessionWithPolicy
): Promise<string> {
  const recent = await prisma.contextBundle.findFirst({
    where: {
      modelSessionId: session.modelSessionId,
      tenantId: session.tenantId
    },
    orderBy: { createdAt: "desc" },
    include: { items: { take: 6 } }
  });

  // Enhanced for agentic loops + Virtual Security Analyst (per approved plan.md, 6 Pillars taxonomy + BAS in PRD):
  // Always inject 6 Pillars (ASV_EASM, APV, SCV, DRV, CSV, EXV) + evidence/pillar state refs from bundle.
  // This ensures context bundles (evidence, pillar state) are injected for graph search + LLM plan → approval → deterministic pillar/BAS exec (modules/runner) → revalidation.
  const pillarTaxonomy = "6 Pillars (ASV_EASM, APV, SCV, DRV, CSV, EXV) with Find-Fix-Verify. Pillar state (evidence counts, verdicts, lastNonSnap) available via query_evidence_graph + pillar-aware tools.";
  if (!recent || recent.items.length === 0) {
    return `Session scopes: ${session.scopeIds.join(", ")}. No pre-built redacted bundle. ${pillarTaxonomy} Use typed tools (summarize_evidence, query_evidence_graph, recommend_validation_missions, create_validation_plan, get_control_results) to pull evidence-grounded pillar state for Find-Fix-Verify loops.`;
  }

  const items = recent.items
    .map((i) => {
      const ev = (i.evidenceIds || []).slice(0, 3).join(",");
      return `${i.entityType}:${i.entityId}${ev ? ` (ev:${ev})` : ""}`;
    })
    .join("; ");

  return `Redacted context bundle (sensitivity/redaction applied upstream; pillars injected): ${items}. ${pillarTaxonomy} Use tools for deeper normalized details, pillar state, full evidence.`;
}
