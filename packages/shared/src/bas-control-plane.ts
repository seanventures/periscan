import { z } from "zod";

import {
  PolicyDecisionOutcomeSchema,
  SafetyLevelSchema,
  ValidationMissionSchema,
  ValidationRunSchema
} from "./domain";

/**
 * BAS control-plane scenario catalog and current execution readiness.
 *
 * Picking a scenario always mints a PolicyDecision. Atomic, Caldera and
 * Metasploit adapters require qualification before becoming queueable.
 * The currently qualified ControlValidation path is the benign-marker class.
 */

export const BasScenarioClaimClassSchema = z.enum([
  "benign_marker_only",
  "qualification_required"
]);
export type BasScenarioClaimClass = z.infer<typeof BasScenarioClaimClassSchema>;

export const BasLivePackSchema = z.enum([
  "none",
  "atomic",
  "caldera",
  "metasploit"
]);
export type BasLivePack = z.infer<typeof BasLivePackSchema>;

export const BasControlPlaneScenarioSchema = z.object({
  claimClass: BasScenarioClaimClassSchema,
  description: z.string().min(1),
  livePack: BasLivePackSchema,
  moduleId: z.string().min(1),
  safetyLevel: SafetyLevelSchema,
  scenarioId: z.string().min(1),
  startable: z.boolean(),
  techniqueId: z.string().min(1).optional(),
  title: z.string().min(1)
});
export type BasControlPlaneScenario = z.infer<
  typeof BasControlPlaneScenarioSchema
>;

export const StartBasScenarioInputSchema = z.object({
  controlSourceId: z.string().uuid().optional(),
  dryRun: z.boolean().optional(),
  moduleId: z.string().min(1).optional(),
  scenarioId: z.string().min(1),
  scopeId: z.string().uuid()
});
export type StartBasScenarioInput = z.infer<typeof StartBasScenarioInputSchema>;

export const StartBasScenarioResultSchema = z
  .object({
    claimClass: BasScenarioClaimClassSchema,
    denyReason: z.string().min(1).nullable(),
    jobsQueued: z.number().int().nonnegative(),
    mission: ValidationMissionSchema.nullable(),
    outcome: PolicyDecisionOutcomeSchema,
    policyDecisionId: z.string().uuid(),
    queued: z.boolean(),
    rationale: z.string().min(1),
    runs: z.array(ValidationRunSchema),
    scenarioId: z.string().min(1)
  })
  .refine(
    (result) =>
      result.outcome === "Allowed" ||
      (result.jobsQueued === 0 && result.queued === false),
    {
      message: "Denied BAS scenario starts must never queue jobs."
    }
  );
export type StartBasScenarioResult = z.infer<
  typeof StartBasScenarioResultSchema
>;

const LIVE_ATOMIC_MODULE_IDS = new Set([
  "atomic.control_validation_safe",
  "atomic.live"
]);
const LIVE_CALDERA_MODULE_IDS = new Set([
  "caldera.advanced_adversarial",
  "caldera.live"
]);
const LIVE_METASPLOIT_MODULE_IDS = new Set([
  "exploit.metasploit_check",
  "metasploit.live"
]);

const LIVE_ATOMIC_SCENARIO_IDS = new Set([
  "atomic.live",
  "atomic.control_validation_safe"
]);
const LIVE_CALDERA_SCENARIO_IDS = new Set([
  "caldera.live",
  "caldera.advanced_adversarial"
]);
const LIVE_METASPLOIT_SCENARIO_IDS = new Set([
  "metasploit.live",
  "exploit.metasploit_check"
]);

export const BAS_BENIGN_MARKER_SCENARIO_ID =
  "control.detection.benign-marker" as const;
export const BAS_BENIGN_MARKER_MODULE_ID =
  "periscan.detection_marker_emit_observe" as const;

export const LIVE_OFFENSIVE_PACK_DENY_REASONS = {
  atomic: "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
  caldera: "Caldera adapter qualification is required before live execution. Denied tasks are never queued.",
  metasploit:
    "Metasploit adapter qualification is required before live execution. Denied tasks are never queued."
} as const;

export const BAS_CONTROL_PLANE_SCENARIOS: readonly BasControlPlaneScenario[] = [
  {
    claimClass: "benign_marker_only",
    description:
      "Queue a benign-marker ControlValidation (allowlisted periscan-* emit→observe). Current coverage: the approved marker class.",
    livePack: "none",
    moduleId: BAS_BENIGN_MARKER_MODULE_ID,
    safetyLevel: "ActiveNonInvasive",
    scenarioId: BAS_BENIGN_MARKER_SCENARIO_ID,
    startable: true,
    techniqueId: "T1059",
    title: "Benign detection marker"
  },
  {
    claimClass: "qualification_required",
    description:
      "Atomic Red Team execution adapter. Qualification required before customer execution.",
    livePack: "atomic",
    moduleId: "atomic.control_validation_safe",
    safetyLevel: "BASLite",
    scenarioId: "atomic.live",
    startable: false,
    techniqueId: "T1059",
    title: "Atomic (qualification required)"
  },
  {
    claimClass: "qualification_required",
    description:
      "Reviewed Linux argv T1082 hostname. Campaign start queues when qualified, authorized, policy Allowed, and a bound runner is Active.",
    livePack: "atomic",
    moduleId: "atomic.control_validation_safe",
    safetyLevel: "ActiveNonInvasive",
    scenarioId: "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133",
    startable: true,
    techniqueId: "T1082",
    title: "Atomic T1082 hostname (qualified argv)"
  },
  {
    claimClass: "qualification_required",
    description:
      "Reviewed Linux argv T1082 environment. Campaign start queues when qualified, authorized, policy Allowed, and a bound runner is Active.",
    livePack: "atomic",
    moduleId: "atomic.control_validation_safe",
    safetyLevel: "ActiveNonInvasive",
    scenarioId: "atomic:fcbdd43f-f4ad-42d5-98f3-0218097e2720",
    startable: true,
    techniqueId: "T1082",
    title: "Atomic T1082 env (qualified argv)"
  },
  {
    claimClass: "qualification_required",
    description:
      "Reviewed Linux argv T1124 date. Campaign start queues when qualified, authorized, policy Allowed, and a bound runner is Active.",
    livePack: "atomic",
    moduleId: "atomic.control_validation_safe",
    safetyLevel: "ActiveNonInvasive",
    scenarioId: "atomic:f449c933-0891-407f-821e-7916a21a1a6f",
    startable: true,
    techniqueId: "T1124",
    title: "Atomic T1124 date (qualified argv)"
  },
  {
    claimClass: "qualification_required",
    description:
      "Caldera operations adapter. Qualification required before customer execution.",
    livePack: "caldera",
    moduleId: "caldera.advanced_adversarial",
    safetyLevel: "AdvancedAdversarial",
    scenarioId: "caldera.live",
    startable: false,
    title: "Caldera (qualification required)"
  },
  {
    claimClass: "qualification_required",
    description:
      "Metasploit validation adapter. Qualification required before customer execution.",
    livePack: "metasploit",
    moduleId: "exploit.metasploit_check",
    safetyLevel: "AdvancedAdversarial",
    scenarioId: "metasploit.live",
    startable: false,
    title: "Metasploit (qualification required)"
  }
];

export function listBasControlPlaneScenarios(): BasControlPlaneScenario[] {
  return BAS_CONTROL_PLANE_SCENARIOS.map((scenario) =>
    BasControlPlaneScenarioSchema.parse(scenario)
  );
}

export function getBasControlPlaneScenario(
  scenarioId: string
): BasControlPlaneScenario | undefined {
  return listBasControlPlaneScenarios().find(
    (scenario) => scenario.scenarioId === scenarioId
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type LiveOffensivePack = Exclude<BasLivePack, "none">;

function packFromModuleId(
  moduleId: string | undefined
): LiveOffensivePack | null {
  if (!moduleId) {
    return null;
  }
  if (LIVE_ATOMIC_MODULE_IDS.has(moduleId)) {
    return "atomic";
  }
  if (LIVE_CALDERA_MODULE_IDS.has(moduleId)) {
    return "caldera";
  }
  if (LIVE_METASPLOIT_MODULE_IDS.has(moduleId)) {
    return "metasploit";
  }
  return null;
}

function packFromScenarioId(
  scenarioId: string | undefined
): LiveOffensivePack | null {
  if (!scenarioId) {
    return null;
  }
  if (
    LIVE_ATOMIC_SCENARIO_IDS.has(scenarioId) ||
    scenarioId.startsWith("atomic:")
  ) {
    return "atomic";
  }
  if (LIVE_CALDERA_SCENARIO_IDS.has(scenarioId)) {
    return "caldera";
  }
  if (LIVE_METASPLOIT_SCENARIO_IDS.has(scenarioId)) {
    return "metasploit";
  }
  return null;
}

function packFromLivePackField(value: unknown): LiveOffensivePack | null {
  if (value === "atomic" || value === "caldera" || value === "metasploit") {
    return value;
  }
  return null;
}

/**
 * Detect a live Atomic / Caldera / Metasploit request from policy target JSON.
 * Used by evaluatePolicy so a minted Allowed ticket cannot cover live packs.
 */
export function liveOffensivePackFromTarget(
  target: Record<string, unknown> | undefined
): LiveOffensivePack | null {
  const record = asRecord(target);
  const fromField = packFromLivePackField(record.livePack);
  if (fromField) {
    return fromField;
  }
  const fromScenario = packFromScenarioId(readString(record.scenarioId));
  if (fromScenario) {
    return fromScenario;
  }
  const moduleId = readString(record.moduleId);
  const fromModule = packFromModuleId(moduleId);
  if (fromModule === "atomic") {
    return record.dryRun === false ? "atomic" : null;
  }
  return fromModule;
}

export function denyReasonForLivePack(
  pack: Exclude<BasLivePack, "none">
): string {
  return LIVE_OFFENSIVE_PACK_DENY_REASONS[pack];
}

export interface ResolvedBasScenarioStart {
  claimClass: BasScenarioClaimClass;
  denyReason: string | null;
  livePack: BasLivePack;
  moduleId: string;
  queueable: boolean;
  safetyLevel: BasControlPlaneScenario["safetyLevel"];
  scenarioId: string;
  techniqueId: string | undefined;
  title: string;
}

export function resolveBasScenarioStart(
  input: StartBasScenarioInput
): ResolvedBasScenarioStart {
  const parsed = StartBasScenarioInputSchema.parse(input);
  const catalog = getBasControlPlaneScenario(parsed.scenarioId);
  const modulePack = packFromModuleId(parsed.moduleId);
  const requestLivePack =
    packFromScenarioId(parsed.scenarioId) ??
    (modulePack === "atomic"
      ? parsed.dryRun === false
        ? "atomic"
        : null
      : modulePack);
  const catalogLivePack =
    catalog?.livePack && catalog.livePack !== "none" ? catalog.livePack : null;
  const resolvedLivePack: BasLivePack =
    requestLivePack ?? catalogLivePack ?? "none";

  if (resolvedLivePack !== "none") {
    return {
      claimClass: "qualification_required",
      denyReason: denyReasonForLivePack(resolvedLivePack),
      livePack: resolvedLivePack,
      moduleId:
        parsed.moduleId ??
        catalog?.moduleId ??
        (resolvedLivePack === "atomic"
          ? "atomic.control_validation_safe"
          : resolvedLivePack === "caldera"
            ? "caldera.advanced_adversarial"
            : "exploit.metasploit_check"),
      queueable: false,
      safetyLevel: catalog?.safetyLevel ?? "BASLite",
      scenarioId: parsed.scenarioId,
      techniqueId: catalog?.techniqueId,
      title: catalog?.title ?? `Live ${resolvedLivePack}`
    };
  }

  if (
    catalog?.claimClass === "benign_marker_only" ||
    parsed.scenarioId === BAS_BENIGN_MARKER_SCENARIO_ID
  ) {
    return {
      claimClass: "benign_marker_only",
      denyReason: null,
      livePack: "none",
      moduleId: BAS_BENIGN_MARKER_MODULE_ID,
      queueable: true,
      safetyLevel: "ActiveNonInvasive",
      scenarioId: BAS_BENIGN_MARKER_SCENARIO_ID,
      techniqueId: catalog?.techniqueId ?? "T1059",
      title: catalog?.title ?? "Benign detection marker"
    };
  }

  throw new Error(`Unknown BAS control-plane scenario ${parsed.scenarioId}.`);
}

export function basScenarioPolicyTarget(input: {
  controlSourceId?: string;
  resolved: ResolvedBasScenarioStart;
}): Record<string, unknown> {
  return {
    claimClass: input.resolved.claimClass,
    controlSourceId: input.controlSourceId ?? null,
    dryRun: input.resolved.livePack === "none",
    livePack: input.resolved.livePack,
    moduleId: input.resolved.moduleId,
    scenarioId: input.resolved.scenarioId,
    techniqueId: input.resolved.techniqueId ?? null
  };
}
