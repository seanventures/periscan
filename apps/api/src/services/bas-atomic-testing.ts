import {
  StartAtomicTestInputSchema,
  StartAtomicTestResultSchema,
  atomicTestImmediateResult,
  basScenarioPolicyTarget,
  deniedAtomicTestResult,
  evaluateAtomicTestStartability,
  listAtomicTestCatalog,
  resolveBasScenarioStart,
  type AtomicTestCatalog,
  type StartAtomicTestInput,
  type StartAtomicTestResult
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

const BAS_ATOMIC_TEST_POLICY_PROFILE = "bas-atomic-test";
const ACTIVE_RUNNER_STATUSES = new Set(["Active", "Degraded"]);

export async function runAtomicTestStart(input: {
  context: AuthenticatedContext;
  createMission: AppServices["createMission"];
  loadAsset: (assetId: string) => Promise<{ assetId: string } | null>;
  loadRunner: (
    runnerId: string
  ) => Promise<{ runnerId: string; status: string } | null>;
  loadScope: (scopeId: string) => Promise<{
    scopeId: string;
    tenantId: string;
    verificationStatus: string;
  } | null>;
  previewPolicyDecision: AppServices["previewPolicyDecision"];
  request: StartAtomicTestInput;
  startMission: AppServices["startMission"];
}): Promise<StartAtomicTestResult> {
  const request = StartAtomicTestInputSchema.parse(input.request);
  const pin = request.scenarioPin;

  const scope = await input.loadScope(request.scopeId);
  if (!scope || scope.tenantId !== input.context.tenant.tenantId) {
    throw new AppServiceError("Scope not found.", 404, "scope_not_found");
  }

  let runner: { runnerId: string; status: string } | null = null;
  if (request.runnerId) {
    runner = await input.loadRunner(request.runnerId);
  }
  let asset: { assetId: string } | null = null;
  if (request.assetId) {
    asset = await input.loadAsset(request.assetId);
    if (!asset) {
      throw new AppServiceError("Asset not found.", 404, "asset_not_found");
    }
  }

  const runnerStatus = request.runnerId ? (runner?.status ?? "Revoked") : null;
  const runnerBound = Boolean(
    runner && ACTIVE_RUNNER_STATUSES.has(runner.status)
  );
  const startability = evaluateAtomicTestStartability({
    dangerAckDigest: request.dangerAckDigest,
    dangerAcknowledged: request.dangerAcknowledged,
    hasBoundTarget: runnerBound || Boolean(asset),
    pin,
    policyAllowed: true,
    runnerStatus,
    scopeVerified: scope.verificationStatus === "Verified",
    tenantAuthorized: true
  });

  let resolved = null;
  try {
    if (pin.provider !== "HighDanger") {
      resolved = resolveBasScenarioStart({
        scenarioId: pin.upstreamId,
        scopeId: request.scopeId
      });
    }
  } catch {
    resolved = null;
  }

  const decision = await input.previewPolicyDecision(
    input.context,
    scope.scopeId,
    {
      executionEnvironment: "ControlPlane",
      explicitMissionApproval: false,
      missionType: "ControlValidation",
      requestedAction: { ...SAFE_REQUESTED_ACTION },
      safetyLevel: resolved?.safetyLevel ?? "ActiveNonInvasive",
      target: {
        assetId: request.assetId ?? null,
        kind: "atomic-test",
        livePack: startability.livePack,
        runnerId: request.runnerId ?? null,
        scenarioId: pin.upstreamId,
        ...(resolved
          ? basScenarioPolicyTarget({
              resolved
            })
          : {})
      }
    }
  );

  const deny = (reason: string): StartAtomicTestResult =>
    deniedAtomicTestResult({
      boundAssetId: asset?.assetId ?? request.assetId ?? null,
      boundRunnerId: runner?.runnerId ?? request.runnerId ?? null,
      claimClass: resolved?.claimClass ?? "qualification_required",
      denyReason: reason,
      policyDecisionId: decision.policyDecisionId,
      scenarioPin: pin
    });

  if (
    !resolved ||
    !resolved.queueable ||
    !startability.startable ||
    decision.outcome !== "Allowed"
  ) {
    return deny(
      startability.denyReason ??
        (decision.outcome === "Allowed"
          ? "Atomic test is not startable. Denied tasks are never queued."
          : decision.rationale)
    );
  }

  const mission = await input.createMission(input.context, {
    missionType: "ControlValidation",
    policyDecisionId: decision.policyDecisionId,
    policyProfile: BAS_ATOMIC_TEST_POLICY_PROFILE,
    safetyLevel: decision.safetyLevel,
    scopeId: scope.scopeId
  });
  const started = await input.startMission(input.context, mission.missionId, {
    moduleIds: [resolved.moduleId],
    runnerId: request.runnerId,
    target: {
      assetId: request.assetId ?? null,
      kind: "atomic-test",
      livePack: "none",
      runnerId: request.runnerId ?? null,
      ...basScenarioPolicyTarget({ resolved })
    }
  });

  return StartAtomicTestResultSchema.parse({
    boundAssetId: asset?.assetId ?? request.assetId ?? null,
    boundRunnerId: runner?.runnerId ?? request.runnerId ?? null,
    claimClass: resolved.claimClass,
    denyReason: null,
    jobsQueued: started.jobsQueued,
    liveSupported: false,
    mission: started.mission,
    outcome: decision.outcome,
    policyDecisionId: decision.policyDecisionId,
    queued: started.jobsQueued > 0,
    rationale: decision.rationale,
    result: atomicTestImmediateResult({
      jobsQueued: started.jobsQueued,
      outcome: decision.outcome,
      queued: started.jobsQueued > 0,
      startable: true
    }),
    runs: started.runs,
    scenarioPin: pin,
    startable: true
  });
}

export function createBasAtomicTestingServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "listAtomicTests" | "startAtomicTest"> {
  const { prisma } = deps;

  return {
    async listAtomicTests(): Promise<AtomicTestCatalog> {
      return listAtomicTestCatalog();
    },

    async startAtomicTest(this: AppServices, context, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start atomic tests"
      );
      const request = StartAtomicTestInputSchema.parse(rawInput);
      return runAtomicTestStart({
        context,
        createMission: this.createMission.bind(this),
        loadAsset: async (assetId) =>
          prisma.asset.findFirst({
            select: { assetId: true },
            where: { assetId, tenantId: context.tenant.tenantId }
          }),
        loadRunner: async (runnerId) =>
          prisma.runner.findFirst({
            select: { runnerId: true, status: true },
            where: { runnerId, tenantId: context.tenant.tenantId }
          }),
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
