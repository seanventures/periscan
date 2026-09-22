import {
  StartBasScenarioInputSchema,
  StartBasScenarioResultSchema,
  basScenarioPolicyTarget,
  resolveBasScenarioStart,
  type StartBasScenarioInput,
  type StartBasScenarioResult
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  type AppServices,
  type AuthenticatedContext,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const SAFE_REQUESTED_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
} as const;

const BAS_POLICY_PROFILE = "bas-control-plane";

export async function runBasScenarioStart(input: {
  context: AuthenticatedContext;
  createMission: AppServices["createMission"];
  loadScope: (scopeId: string) => Promise<{
    scopeId: string;
    tenantId: string;
    verificationStatus: string;
  } | null>;
  previewPolicyDecision: AppServices["previewPolicyDecision"];
  request: StartBasScenarioInput;
  startMission: AppServices["startMission"];
}): Promise<StartBasScenarioResult> {
  const request = StartBasScenarioInputSchema.parse(input.request);

  let resolved;
  try {
    resolved = resolveBasScenarioStart(request);
  } catch {
    throw new AppServiceError(
      `Unknown BAS control-plane scenario ${request.scenarioId}.`,
      400,
      "bas_scenario_unknown"
    );
  }

  const scope = await input.loadScope(request.scopeId);
  if (!scope || scope.tenantId !== input.context.tenant.tenantId) {
    throw new AppServiceError("Scope not found.", 404, "scope_not_found");
  }

  const decision = await input.previewPolicyDecision(
    input.context,
    scope.scopeId,
    {
      executionEnvironment: "ControlPlane",
      explicitMissionApproval: false,
      missionType: "ControlValidation",
      requestedAction: { ...SAFE_REQUESTED_ACTION },
      safetyLevel: resolved.safetyLevel,
      target: basScenarioPolicyTarget({
        controlSourceId: request.controlSourceId,
        resolved
      })
    }
  );

  // Adapter readiness and policy must both permit execution. A stored Allowed
  // decision cannot make an unqualified scenario queueable.
  const canQueue = resolved.queueable && decision.outcome === "Allowed";
  if (!canQueue) {
    return StartBasScenarioResultSchema.parse({
      claimClass: resolved.claimClass,
      denyReason: resolved.denyReason ?? decision.rationale,
      jobsQueued: 0,
      mission: null,
      outcome: resolved.queueable ? decision.outcome : "Denied",
      policyDecisionId: decision.policyDecisionId,
      queued: false,
      rationale: resolved.denyReason ?? decision.rationale,
      runs: [],
      scenarioId: resolved.scenarioId
    });
  }

  const mission = await input.createMission(input.context, {
    missionType: "ControlValidation",
    policyDecisionId: decision.policyDecisionId,
    policyProfile: BAS_POLICY_PROFILE,
    safetyLevel: decision.safetyLevel,
    scopeId: scope.scopeId
  });
  const started = await input.startMission(input.context, mission.missionId, {
    moduleIds: [resolved.moduleId],
    target: basScenarioPolicyTarget({
      controlSourceId: request.controlSourceId,
      resolved
    })
  });

  return StartBasScenarioResultSchema.parse({
    claimClass: resolved.claimClass,
    denyReason: null,
    jobsQueued: started.jobsQueued,
    mission: started.mission,
    outcome: decision.outcome,
    policyDecisionId: decision.policyDecisionId,
    queued: started.jobsQueued > 0,
    rationale: decision.rationale,
    runs: started.runs,
    scenarioId: resolved.scenarioId
  });
}

export function createBasControlPlaneServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "startBasScenario"> {
  const { prisma } = deps;

  return {
    async startBasScenario(
      this: AppServices,
      context,
      rawInput
    ): Promise<StartBasScenarioResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start BAS control-plane scenarios"
      );
      const request = StartBasScenarioInputSchema.parse(rawInput);
      return runBasScenarioStart({
        context,
        createMission: this.createMission.bind(this),
        loadScope: async (scopeId) =>
          prisma.scope.findFirst({
            select: {
              scopeId: true,
              tenantId: true,
              verificationStatus: true
            },
            where: { scopeId, tenantId: context.tenant.tenantId }
          }),
        previewPolicyDecision: this.previewPolicyDecision.bind(this),
        request,
        startMission: this.startMission.bind(this)
      });
    }
  };
}
