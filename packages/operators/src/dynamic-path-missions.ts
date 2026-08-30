/**
 * Dynamic Attack Paths (scorecard id 23) — signal + measurement driven
 * "next recommended mission" for a single attack path.
 *
 * Honesty contract:
 * - Always advisory; never auto-queues validation.
 * - Always requires human approval before a draft mission is created.
 * - Does not claim autonomous real-time path replan or full-BAS adaptation.
 * - Drivers cite real signal IDs, path evidence, and hop measurement state.
 */

import { createHash } from "node:crypto";

import { z } from "zod";

import {
  MissionTypeSchema,
  PolicyRequestedActionSchema,
  SafetyLevelSchema,
  SignalEnvelopeSchema,
  type AttackPath,
  type AttackPathMeasurementState,
  type AttackPathValidationPlan,
  type MissionType,
  type PolicyRequestedAction,
  type SafetyLevel,
  type SignalEnvelope
} from "@periscan/shared";

export const DynamicPathMissionDriverSchema = z.enum([
  "UnmeasuredHop",
  "SignalCve",
  "SignalAssetChange",
  "SignalMissedDetection",
  "PathRevalidation",
  "PathBreakerVerify"
]);

export const DynamicPathMissionStatusSchema = z.enum([
  "Proposed",
  "Approved",
  "NotActionable"
]);

export const DynamicPathMissionPlanSchema = z.object({
  approvalRequired: z.literal(true),
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

export const DynamicPathMissionRecommendationSchema = z.object({
  approvalRequired: z.literal(true),
  createdAt: z.string().datetime(),
  drivers: z.array(DynamicPathMissionDriverSchema).min(1),
  evidenceIds: z.array(z.string().uuid()).min(1),
  honestyNotes: z.array(z.string().min(1)).min(1),
  kind: z.literal("DynamicPathNextMission"),
  matchedSignalIds: z.array(z.string().uuid()),
  matchedTriggerIds: z.array(z.string().min(1)),
  measuredEdgeCount: z.number().int().nonnegative(),
  missionPlan: DynamicPathMissionPlanSchema,
  pathId: z.string().uuid(),
  pathName: z.string().min(1),
  rationale: z.string().min(1),
  recommendationId: z.string().min(1),
  status: DynamicPathMissionStatusSchema,
  tenantId: z.string().uuid(),
  title: z.string().min(1),
  totalEdgeCount: z.number().int().nonnegative(),
  unmeasuredEdgeCount: z.number().int().nonnegative()
});

export type DynamicPathMissionDriver = z.infer<
  typeof DynamicPathMissionDriverSchema
>;
export type DynamicPathMissionStatus = z.infer<
  typeof DynamicPathMissionStatusSchema
>;
export type DynamicPathMissionPlan = z.infer<
  typeof DynamicPathMissionPlanSchema
>;
export type DynamicPathMissionRecommendation = z.infer<
  typeof DynamicPathMissionRecommendationSchema
>;

export const DynamicPathMissionInputSchema = z.object({
  attackPath: z.custom<AttackPath>(),
  generatedAt: z.string().datetime(),
  measurementState: z.custom<AttackPathMeasurementState>().nullish(),
  signals: z.array(SignalEnvelopeSchema).default([]),
  tenantId: z.string().uuid(),
  validationPlan: z.custom<AttackPathValidationPlan>().nullish(),
  verifiedScopeId: z.string().uuid().nullish()
});

export type DynamicPathMissionInput = {
  attackPath: AttackPath;
  generatedAt: string;
  measurementState?: AttackPathMeasurementState | null;
  signals?: SignalEnvelope[];
  tenantId: string;
  validationPlan?: AttackPathValidationPlan | null;
  verifiedScopeId?: string | null;
};

const SAFE_REQUESTED_ACTION: PolicyRequestedAction = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
};

const HONESTY_NOTES = [
  "Advisory next recommended mission only — not autonomous real-time path replan.",
  "Human approval is required; approval creates a Draft mission and never auto-queues destructive work.",
  "Drivers are signal- and hop-measurement evidence; this is not full-BAS dynamic adaptation.",
  "A recommendation is never proof that a path is fixed or that an edge is Measured."
] as const;

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function deterministicRecommendationId(input: {
  drivers: DynamicPathMissionDriver[];
  moduleIds: string[];
  pathId: string;
  tenantId: string;
}): string {
  const digest = createHash("sha256")
    .update(input.tenantId)
    .update(input.pathId)
    .update(input.drivers.slice().sort().join(","))
    .update(input.moduleIds.slice().sort().join(","))
    .digest("hex")
    .slice(0, 16);

  return `dynpath_${digest}`;
}

function signalTouchesPath(
  signal: SignalEnvelope,
  path: AttackPath
): boolean {
  if (signal.relatedPathIds.includes(path.pathId)) {
    return true;
  }

  const pathEvidence = new Set(path.evidenceIds);
  for (const evidenceId of signal.evidenceIds) {
    if (pathEvidence.has(evidenceId)) {
      return true;
    }
  }
  for (const evidenceId of signal.relatedEvidenceIds) {
    if (pathEvidence.has(evidenceId)) {
      return true;
    }
  }

  return false;
}

function classifySignalDriver(
  signal: SignalEnvelope
): DynamicPathMissionDriver | null {
  const subcategory = (signal.signalSubcategory ?? "").toLowerCase();
  const text = [
    signal.sourceType,
    signal.sourceVendor,
    signal.signalCategory,
    signal.signalSubcategory,
    signal.rawPayloadPointer
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    signal.signalCategory === "Exposure" ||
    subcategory.includes("advisory") ||
    subcategory.includes("misconfiguration") ||
    /\b(cve|advisory|vulnerab)/i.test(text)
  ) {
    return "SignalCve";
  }

  if (
    signal.signalCategory === "Asset" ||
    signal.signalCategory === "Repository" ||
    signal.signalCategory === "Cloud"
  ) {
    return "SignalAssetChange";
  }

  if (
    signal.signalCategory === "ControlObservation" &&
    (subcategory.includes("missed") ||
      subcategory.includes("noevidence") ||
      subcategory.includes("needstuning") ||
      subcategory.includes("logged"))
  ) {
    return "SignalMissedDetection";
  }

  return null;
}

function triggerIdForDriver(driver: DynamicPathMissionDriver): string | null {
  switch (driver) {
    case "SignalCve":
      return "trigger.cve";
    case "SignalAssetChange":
      return "trigger.asset_change";
    case "SignalMissedDetection":
      return "trigger.missed_detection";
    default:
      return null;
  }
}

function missionPlan(input: {
  executionEnvironment: DynamicPathMissionPlan["executionEnvironment"];
  missionType: MissionType;
  moduleIds: string[];
  requestedAction?: Partial<PolicyRequestedAction>;
  safetyLevel: SafetyLevel;
  scopeId: string | null;
  target: Record<string, unknown>;
}): DynamicPathMissionPlan {
  return DynamicPathMissionPlanSchema.parse({
    approvalRequired: true,
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

/**
 * Build the single highest-priority next recommended mission for a path.
 * Returns null when the path has no evidence (cannot recommend honestly).
 */
export function generateDynamicPathMissionRecommendation(
  rawInput: DynamicPathMissionInput
): DynamicPathMissionRecommendation | null {
  const input = DynamicPathMissionInputSchema.parse({
    ...rawInput,
    signals: rawInput.signals ?? [],
    measurementState: rawInput.measurementState ?? null,
    validationPlan: rawInput.validationPlan ?? null,
    verifiedScopeId: rawInput.verifiedScopeId ?? null
  });

  const path = input.attackPath;
  if (path.evidenceIds.length === 0) {
    return null;
  }

  const totalEdgeCount =
    input.measurementState?.totalEdgeCount ?? path.pathEdges.length;
  const measuredEdgeCount =
    input.measurementState?.measuredEdgeCount ??
    path.pathEdges.filter(
      (edge) =>
        edge.evidenceBasis === "Measured" && edge.evidenceIds.length > 0
    ).length;
  const unmeasuredEdgeCount = Math.max(0, totalEdgeCount - measuredEdgeCount);

  const relatedSignals = (input.signals ?? []).filter((signal) =>
    signalTouchesPath(signal, path)
  );
  const signalDrivers = uniqueIds(
    relatedSignals.map((signal) => classifySignalDriver(signal))
  ) as DynamicPathMissionDriver[];
  const matchedSignalIds = uniqueIds(
    relatedSignals.map((signal) => signal.signalId)
  );
  const matchedTriggerIds = uniqueIds(
    signalDrivers.map((driver) => triggerIdForDriver(driver))
  );

  const firstUnmeasuredPlanItem =
    input.validationPlan?.items
      .slice()
      .sort((left, right) => left.sequence - right.sequence)
      .find(
        (item) =>
          item.evidenceBasis !== "Measured" &&
          item.recommendedModuleIds.length > 0 &&
          item.eligibility !== "NoSafeModule" &&
          item.eligibility !== "AlreadyMeasured"
      ) ?? null;

  const primaryBreaker = path.pathBreakers
    .slice()
    .sort((left, right) => left.priority - right.priority)[0];

  const drivers: DynamicPathMissionDriver[] = [];
  let title: string;
  let rationale: string;
  let plan: DynamicPathMissionPlan;
  let missionEvidenceIds = uniqueIds([
    ...path.evidenceIds,
    ...relatedSignals.flatMap((signal) => signal.evidenceIds)
  ]);

  if (unmeasuredEdgeCount > 0 && firstUnmeasuredPlanItem) {
    drivers.push("UnmeasuredHop", ...signalDrivers);
    const moduleIds = firstUnmeasuredPlanItem.recommendedModuleIds.slice(0, 3);
    title = `Measure next hop on ${path.name}`;
    rationale =
      `${unmeasuredEdgeCount} of ${totalEdgeCount} hops lack Measured receipts` +
      (signalDrivers.length > 0
        ? `; ${signalDrivers.length} related signal driver(s) also favor revalidation`
        : "") +
      `. Recommend the next safe hop-probe mission (human-gated).`;
    plan = missionPlan({
      executionEnvironment: firstUnmeasuredPlanItem.requiresInternalRunner
        ? "InternalRunner"
        : "ControlPlane",
      missionType: firstUnmeasuredPlanItem.missionType,
      moduleIds,
      requestedAction: firstUnmeasuredPlanItem.requiresInternalRunner
        ? { requiresInternalRunner: true }
        : undefined,
      safetyLevel: firstUnmeasuredPlanItem.safetyLevel,
      scopeId: input.verifiedScopeId ?? null,
      target: {
        kind: "DynamicPathNextMission",
        pathEdgeId: firstUnmeasuredPlanItem.pathEdgeId,
        pathId: path.pathId,
        relationship: firstUnmeasuredPlanItem.relationship,
        sequence: firstUnmeasuredPlanItem.sequence
      }
    });
  } else if (signalDrivers.includes("SignalCve")) {
    drivers.push("SignalCve", ...signalDrivers.filter((d) => d !== "SignalCve"));
    title = `Signal-driven revalidation for ${path.name}`;
    rationale =
      "Related CVE/advisory/exposure signals touch this path's evidence. Recommend a safe exposure revalidation mission (human-gated), not autonomous replan.";
    plan = missionPlan({
      executionEnvironment: "ControlPlane",
      missionType: "ExposureValidation",
      moduleIds: ["osv.repo_dependency_scan", "nuclei.external_exposure_safe"],
      safetyLevel: "PassiveReadOnly",
      scopeId: input.verifiedScopeId ?? null,
      target: {
        kind: "DynamicPathNextMission",
        matchedSignalIds,
        pathId: path.pathId,
        triggerIds: matchedTriggerIds
      }
    });
  } else if (signalDrivers.includes("SignalAssetChange")) {
    drivers.push(
      "SignalAssetChange",
      ...signalDrivers.filter((d) => d !== "SignalAssetChange")
    );
    title = `Asset-change review for ${path.name}`;
    rationale =
      "Asset/cloud/repository signals related to this path suggest the attack surface may have drifted. Recommend a Validation Snapshot review mission (human-gated).";
    plan = missionPlan({
      executionEnvironment: "ControlPlane",
      missionType: "ValidationSnapshot",
      moduleIds: ["mock.external_exposure", "nuclei.external_exposure_safe"],
      safetyLevel: "PassiveReadOnly",
      scopeId: input.verifiedScopeId ?? null,
      target: {
        kind: "DynamicPathNextMission",
        matchedSignalIds,
        pathId: path.pathId,
        triggerIds: matchedTriggerIds
      }
    });
  } else if (signalDrivers.includes("SignalMissedDetection")) {
    drivers.push("SignalMissedDetection");
    title = `Control coverage check for path ${path.name}`;
    rationale =
      "Missed/no-evidence control observations relate to this path. Recommend dry-run control validation (human-gated, BAS-lite).";
    plan = missionPlan({
      executionEnvironment: "InternalRunner",
      missionType: "ControlValidation",
      moduleIds: ["atomic.control_validation_safe"],
      requestedAction: { requiresInternalRunner: true },
      safetyLevel: "BASLite",
      scopeId: input.verifiedScopeId ?? null,
      target: {
        dryRun: true,
        kind: "DynamicPathNextMission",
        matchedSignalIds,
        pathId: path.pathId
      }
    });
  } else if (
    totalEdgeCount > 0 &&
    unmeasuredEdgeCount === 0 &&
    primaryBreaker
  ) {
    drivers.push("PathBreakerVerify");
    if (primaryBreaker.evidenceIds.length > 0) {
      missionEvidenceIds = uniqueIds([
        ...missionEvidenceIds,
        ...primaryBreaker.evidenceIds
      ]);
    }
    title = `Verify path breaker on ${path.name}`;
    rationale = `All hops report Measured receipts; next human-gated step is fix-verification against breaker "${primaryBreaker.title}" — never mark Fixed without a verification event.`;
    plan = missionPlan({
      executionEnvironment: "ControlPlane",
      missionType: "FixVerification",
      moduleIds: ["periscan.fix_verification.retest"],
      safetyLevel: "PassiveReadOnly",
      scopeId: input.verifiedScopeId ?? null,
      target: {
        kind: "DynamicPathNextMission",
        pathBreakerId: primaryBreaker.pathBreakerId,
        pathId: path.pathId
      }
    });
  } else {
    drivers.push("PathRevalidation");
    title = `Revalidate path ${path.name}`;
    rationale =
      "No fresher signal drivers matched; recommend a policy-gated path revalidation mission so operators can re-check hypothesis edges with safe modules.";
    plan = missionPlan({
      executionEnvironment: "ControlPlane",
      missionType: "ExposureValidation",
      moduleIds: ["nuclei.external_exposure_safe", "periscan.tcp_reachability"],
      safetyLevel: "ActiveNonInvasive",
      scopeId: input.verifiedScopeId ?? null,
      target: {
        kind: "DynamicPathNextMission",
        pathId: path.pathId
      }
    });
  }

  const uniqueDrivers = uniqueIds(drivers) as DynamicPathMissionDriver[];
  if (uniqueDrivers.length === 0 || missionEvidenceIds.length === 0) {
    return null;
  }

  const status: DynamicPathMissionStatus = input.verifiedScopeId
    ? "Proposed"
    : "NotActionable";

  return DynamicPathMissionRecommendationSchema.parse({
    approvalRequired: true,
    createdAt: input.generatedAt,
    drivers: uniqueDrivers,
    evidenceIds: missionEvidenceIds,
    honestyNotes: [...HONESTY_NOTES],
    kind: "DynamicPathNextMission",
    matchedSignalIds,
    matchedTriggerIds,
    measuredEdgeCount,
    missionPlan: plan,
    pathId: path.pathId,
    pathName: path.name,
    rationale,
    recommendationId: deterministicRecommendationId({
      drivers: uniqueDrivers,
      moduleIds: plan.moduleIds,
      pathId: path.pathId,
      tenantId: input.tenantId
    }),
    status,
    tenantId: input.tenantId,
    title,
    totalEdgeCount,
    unmeasuredEdgeCount
  });
}
