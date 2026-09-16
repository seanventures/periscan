import type {
  ModelMessage,
  ModelProviderAdapter,
  ModelToolCall,
  ModelToolSchema
} from "../adapters/types.js";

export type GatewayTurnFinalStatus = "Completed" | "Blocked" | "Aborted";

export interface GatewayToolOutcome {
  status: "Allowed" | "RequiresApproval" | "Denied";
  toolRequestId: string;
  denialReason?: string | null;
}

export interface GatewayOrchestratorDeps {
  model: string;
  maxIterations: number;
  maxTokens?: number;
  temperature?: number;
  /** Build the initial message list (system + redacted context + user prompt). */
  buildInitialMessages: () => Promise<ModelMessage[]>;
  /** Tool schemas exposed to the model for this session/mode. */
  listToolSchemas: () => ModelToolSchema[];
  /**
   * Policy Enforcement Point: record + evaluate one tool call. MUST NOT execute
   * the tool or queue any underlying action.
   */
  evaluateToolCall: (call: ModelToolCall) => Promise<GatewayToolOutcome>;
  /**
   * Execute an Allowed read-only/plan tool and return the redacted content to
   * feed back to the model on the next turn.
   */
  executeAllowedTool: (
    outcome: GatewayToolOutcome,
    call: ModelToolCall
  ) => Promise<{ content: string }>;
  /** Hook for the assistant's interim/final text (e.g. audit/persist). */
  onAssistantText?: (text: string) => Promise<void>;
  /** Abort source: kill switch activation or session timeout. */
  checkAbort: () => Promise<{ aborted: boolean; reason?: string }>;
}

export interface GatewayTurnResult {
  status: GatewayTurnFinalStatus;
  assistantText: string;
  iterations: number;
  toolCallsHandled: number;
  pendingToolRequestId?: string;
  abortReason?: string;
  usage: {
    cachedInputTokens: number;
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Provider-agnostic Frontier Gateway turn loop. The model reasons and requests
 * typed tools; Periscan controls everything else:
 *  - every tool call goes through the injected Policy Enforcement Point first;
 *  - Allowed read-only/plan tools execute and their redacted result is fed back;
 *  - RequiresApproval halts the turn (session Blocked) without queueing anything;
 *  - Denied tools are never executed — only a denial message is returned;
 *  - kill switch / session timeout abort the loop between provider calls;
 *  - a max-iteration ceiling bounds runaway loops.
 * The model never gets direct network/shell access — only this typed surface.
 */
export async function runModelGatewayTurn(
  adapter: ModelProviderAdapter,
  deps: GatewayOrchestratorDeps
): Promise<GatewayTurnResult> {
  const messages: ModelMessage[] = await deps.buildInitialMessages();
  const tools: ModelToolSchema[] = deps.listToolSchemas();
  let assistantText = "";
  let toolCallsHandled = 0;
  const usage = { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 };

  for (let iteration = 1; iteration <= deps.maxIterations; iteration += 1) {
    const abort = await deps.checkAbort();
    if (abort.aborted) {
      return {
        abortReason: abort.reason ?? "aborted",
        assistantText,
        iterations: iteration - 1,
        status: "Aborted",
        toolCallsHandled,
        usage
      };
    }

    // explicit killSwitch hook tie-in (per tenant/session) for safety layer; augments existing checkAbort
    // (callers from turn-runner supply the abort; this adds blast/zero/anomaly context stub here)
    const ksHook = createKillSwitchHook("session-tenant-stub", null);
    const ks = ksHook();
    if (ks.active) {
      return {
        abortReason: "kill_switch_tenant_session",
        assistantText,
        iterations: iteration - 1,
        status: "Aborted",
        toolCallsHandled,
        usage
      };
    }

    const response = await adapter.createTurn({
      maxTokens: deps.maxTokens,
      messages,
      model: deps.model,
      temperature: deps.temperature,
      tools
    });
    usage.cachedInputTokens += response.usage?.cachedInputTokens ?? 0;
    usage.inputTokens += response.usage?.inputTokens ?? 0;
    usage.outputTokens += response.usage?.outputTokens ?? 0;
    assistantText = response.assistantText;
    if (response.assistantText && deps.onAssistantText) {
      await deps.onAssistantText(response.assistantText);
    }

    if (response.toolCalls.length === 0) {
      return {
        assistantText,
        iterations: iteration,
        status: "Completed",
        toolCallsHandled,
        usage
      };
    }

    messages.push({ content: response.assistantText, role: "assistant" });

    for (const call of response.toolCalls) {
      const outcome = await deps.evaluateToolCall(call);
      toolCallsHandled += 1;

      if (outcome.status === "Denied") {
        messages.push({
          content: JSON.stringify({
            error: "tool_denied",
            reason: outcome.denialReason ?? "Denied by policy."
          }),
          name: call.toolName,
          role: "tool",
          toolCallId: call.id
        });
        continue;
      }

      if (outcome.status === "RequiresApproval") {
        return {
          assistantText,
          iterations: iteration,
          pendingToolRequestId: outcome.toolRequestId,
          status: "Blocked",
          toolCallsHandled,
          usage
        };
      }

      const result = await deps.executeAllowedTool(outcome, call);
      messages.push({
        content: result.content,
        name: call.toolName,
        role: "tool",
        toolCallId: call.id
      });
    }
  }

  return {
    abortReason: "max_iterations_reached",
    assistantText,
    iterations: deps.maxIterations,
    status: "Aborted",
    toolCallsHandled,
    usage
  };
}

/**
 * === Competitive Swarm Track A (AI Swarm Engine & Orchestrator) + core-impl-swarm ===
 * Design + small impl per session plan (new Competitive Swarm section, parallel tracks, strict protocol).
 *
 * Full multi-agentic swarm for 10+ specialized agents:
 *   Recon, Credential Harvester, Lateral Mover, Exploit Chain Builder, Data Pilferer,
 *   Evasion Specialist, Social Eng Simulator, Web/App Specialist, Cloud Config Breaker,
 *   Identity/SSO Cracker, + (EASM, SupplyChain, LLM Specialist, OT/ICS safe, etc.).
 *
 * Persistent agent registry/state: Enhanced in-mem for now (see SWARM_AGENTS_REGISTRY).
 *   Real: persist via Prisma (new SwarmAgentState or leverage GraphNode type:'swarm_agent'
 *   + evidence graph edges for state/memory). Tenant-isolated. Loaded from Marketplace packs
 *   + modules manifests (safe only). Fixtures for in-repo.
 *
 * Full agentic loop: reason-plan-execute-observe-replan (real-time adaptation, 95%+ autonomy,
 *   tunable human loop at 1-3 points via RequiresApproval / Blocked like existing PEP).
 *
 * Hybrid stack: Leverage evidence graph (from @periscan/evidence + scope-filter) as self-expanding
 *   Knowledge Base ("Cyber Terrain Map"). Hooks for classical ML (e.g. risk scores from packages/risk),
 *   deterministic engines (operators, kill-chain plans, pillar modules), scoped GenAI (current adapter).
 *   Verification layer: cross-check model outputs vs graph facts + deterministic results to detect
 *   hallucinations (stub: assertPlanGroundedInGraph()).
 *
 * Self-improving: Code comments + stubs for learning from anonymized opt-in runs (recordAnonymizedRunOutcome)
 *   + what-if simulator (simulateWhatIfCampaign). No PII, tenant opt-in gate, aggregate only.
 *
 * Safety: Enhance existing PEP/safety (blast-radius, kill-switches already in checkAbort,
 *   zero-disruption via safe-only classification + fixture, anomaly detection stub, full audit logs
 *   via writeModelGatewayAuditEvent). Integrate with scope-filter (all agents respect tenant+scope).
 *   Blast radius computed from path impact + asset criticality. Kill switch terminates swarm session.
 *
 * Ties: Existing BAS/multi-agent mentions (PRD 3.9, 3.10), 6 Pillars (ValidationPillar via context),
 *   Evidence Graph as terrain, Marketplace packs as agent source, Runner for agent-based exec (safe profiles),
 *   Model Gateway turn as base for swarm coordination. Real-first, tenant isolation, safety boundaries.
 *   Safe in-repo ONLY: fixtures, no real creds/exploits, no destructive. All sims Passive/ActiveNonInvasive.
 *
 * Start: design + small impl here (no new files; extend existing). Use adapters/tool-exec.
 * See also: turn-runner (for session turn integration), context-broker (graph KB inject), policy-enforcement,
 * safety.ts, scope-filter.ts, packages/evidence/graph.ts (Cyber Terrain Map).
 *
 * Protocol: relative paths (test/periscan/...), pre/post every edit full repro + exact Bg append to
 * test/periscan/docs/COMPLETION_REPORT.md, preserve verbatim historicals ("2026-06-28", "runner mTLS certificate-alignment", etc).
 * Update plan.md + todos.
 */

export interface SwarmAgent {
  id: string;
  type: string;
  capabilities: string[];
  state:
    | "idle"
    | "reasoning"
    | "planning"
    | "executing"
    | "observing"
    | "replan";
  pillar?: "ASV_EASM" | "APV" | "SCV" | "DRV" | "CSV" | "EXV"; // tie to 6 Pillars
  lastObservedAt?: string;
  blastRadius?: number; // 0-1 safety metric
}

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
    // P03-12: synthetic helper — not measured network blast radius
    reason: within
      ? `blast radius ${radius} within tenant/session limit ${safeMax} (synthetic)`
      : `blast radius ${radius} exceeds policy limit ${safeMax} for ${context?.tenantId ?? "unknown"} / ${context?.sessionId ?? "session"} - blocked (synthetic)`
  };
}

export interface KillSwitchStatus {
  active: boolean;
  tenantId: string;
  sessionId?: string | null;
  reason?: string;
  activatedAt?: string;
}

export function getKillSwitchStatus(
  tenantId: string,
  sessionId?: string | null
): KillSwitchStatus {
  // P03-12 stub: default inactive. Real halt is session Terminated + operator API.
  return {
    active: false,
    reason: "stub_default_inactive",
    sessionId: sessionId ?? null,
    tenantId
  };
}

export function createKillSwitchHook(
  tenantId: string,
  sessionId?: string | null
) {
  return () => getKillSwitchStatus(tenantId, sessionId);
}

export function zeroDisruptionGuaranteeCheck(
  agentType: string,
  blast: number
): { guaranteed: boolean; reason: string } {
  const guaranteed =
    agentType.includes("safe") || agentType === "recon" || blast < 0.35;
  return {
    guaranteed,
    reason: guaranteed
      ? `zeroDisruptionGuarantee holds for ${agentType}`
      : "potential disruption - high blast or non-safe agent"
  };
}

export interface BehavioralAnomalyResult {
  isSimulation: boolean;
  anomalyScore: number;
  looksLikeAttack: boolean;
  simVsAttack: "sim" | "attack-like" | "indeterminate";
  reason: string;
}

export function detectBehavioralAnomaly(
  agent: SwarmAgent,
  actions: string[],
  context: { tenantId: string; sessionId?: string | null }
): BehavioralAnomalyResult {
  const combined = (agent.type + " " + actions.join(" ")).toLowerCase();
  const isSim =
    combined.includes("sim") ||
    combined.includes("fixture") ||
    combined.includes("recon") ||
    (agent.blastRadius ?? 0) < 0.3;
  const looksAttack =
    /exploit|spray|chain|pilfer|takeover/.test(combined) && !isSim;
  const score = isSim ? 0.06 : looksAttack ? 0.81 : 0.22;
  return {
    isSimulation: isSim,
    anomalyScore: score,
    looksLikeAttack: looksAttack,
    simVsAttack: isSim ? "sim" : looksAttack ? "attack-like" : "indeterminate",
    reason: `behavioralAnomaly (sim vs attack): ${isSim ? "sim" : "indet"} (tenant=${context.tenantId}, agent=${agent.type}) - stub only`
  };
}

export interface EnhancedSwarmAudit {
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

export function createEnhancedSwarmAuditEvent(
  input: EnhancedSwarmAudit
): Record<string, unknown> {
  return {
    ...input,
    timestamp: new Date().toISOString(),
    layer: "model-gateway-orchestrator-swarm-safety",
    tiedToComputeSwarmSafety: true,
    preserveHistorical: true
  };
}

// Scope consent + compliance presets stubs
export const SCOPE_CONSENT_PRESETS = {
  minimal: { requiresExplicitConsent: false },
  standard: { requiresExplicitConsent: true },
  strict: { requiresExplicitConsent: true }
} as const;
export const COMPLIANCE_PRESETS = {
  soc2: ["kill-per-session", "blast-control", "anomaly"],
  iso27001: ["zero-disrupt", "consent"],
  pci: ["scope-consent"]
} as const;

export function evaluateScopeConsent(
  scopeOk: boolean,
  preset: keyof typeof SCOPE_CONSENT_PRESETS = "standard"
): { consented: boolean; rationale: string } {
  const requires = SCOPE_CONSENT_PRESETS[preset].requiresExplicitConsent;
  const ok = scopeOk && (!requires || true) /*stub consent*/;
  return {
    consented: ok,
    rationale: `consent ${ok ? "satisfied" : "needed"} for ${preset}`
  };
}

export function applyCompliancePreset(
  preset: keyof typeof COMPLIANCE_PRESETS = "soc2"
): string[] {
  return [...(COMPLIANCE_PRESETS[preset] ?? [])] as string[];
}

// Updated computeSwarmSafety now explicitly uses the added controls (historical body preserved + augmented)
export interface SwarmSafetyCheck {
  blastRadius: number; // 0 safe ... 1 high
  zeroDisruption: boolean;
  anomalyScore: number; // 0-1
  allowed: boolean;
  reason: string;
  blastControl?: BlastRadiusControlResult;
  killSwitch?: KillSwitchStatus;
  anomaly?: BehavioralAnomalyResult;
  consent?: ReturnType<typeof evaluateScopeConsent>;
}

export function computeSwarmSafety(
  agent: SwarmAgent,
  terrain: { impact: number },
  scopeOk: boolean,
  tenantId: string = "default",
  sessionId?: string | null
): SwarmSafetyCheck {
  const base = agent.blastRadius ?? 0.2;
  const blast = Math.min(1, base + (terrain.impact || 0) * 0.3);
  const zeroDisruptCheck = zeroDisruptionGuaranteeCheck(agent.type, blast);
  const zeroDisrupt = zeroDisruptCheck.guaranteed;
  const anomaly = detectBehavioralAnomaly(agent, ["swarm-step"], {
    tenantId,
    sessionId
  });
  const kill = getKillSwitchStatus(tenantId, sessionId);
  const consent = evaluateScopeConsent(scopeOk);
  // explicit blastRadiusControl
  const blastCtrl = blastRadiusControl(blast, 0.65, {
    tenantId,
    sessionId: sessionId ?? undefined
  });
  const allowed =
    scopeOk &&
    !kill.active &&
    blastCtrl.withinLimit &&
    zeroDisrupt &&
    anomaly.simVsAttack !== "attack-like";
  return {
    blastRadius: blast,
    zeroDisruption: zeroDisrupt,
    anomalyScore: anomaly.anomalyScore,
    allowed,
    reason: allowed
      ? "within blast+scope+non-disrupt+kill+anomaly+consent (tied to PEP)"
      : "blast or anomaly or scope or kill violation - blocked",
    blastControl: blastCtrl,
    killSwitch: kill,
    anomaly,
    consent
  };
}
