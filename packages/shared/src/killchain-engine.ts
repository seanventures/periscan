import { z } from "zod";

import {
  BAS_DANGER_ACK_DENY_REASON,
  compileBasCampaignDag,
  type BasCampaignDag
} from "./bas-campaign";
import { DANGER_CATALOG, isDangerCatalogModule } from "./danger-section";
import {
  getSafeStagePlaybook,
  listExecutableSafeStages,
  type MeasurementClass
} from "./safe-stage-playbooks";

export const KILLCHAIN_ENGINE_MODULE_ID =
  "exploitation.killchain.engine" as const;
export const RANSOMWARE_TECHNIQUE_ID = "T1486" as const;
export const LIVE_RANSOMWARE_MODULE_ID = "ransomware.live" as const;

export const QUALIFIED_KILLCHAIN_HANDOFF_MODULE_IDS: readonly string[] =
  listExecutableSafeStages()
    .map((stage) => stage.defaultModuleId)
    .filter((moduleId): moduleId is string => Boolean(moduleId));

const KillChainPinInputSchema = z.strictObject({
  dependsOn: z.array(z.string().min(1).max(128)).max(11).optional(),
  moduleId: z.string().min(1).max(128).optional(),
  stepKey: z.string().min(1).max(128).optional(),
  techniqueId: z.string().min(1).max(32)
});

export type KillChainPinInput = z.infer<typeof KillChainPinInputSchema>;

export const KillChainQueuedPinSchema = z.strictObject({
  measurementClass: z.enum(["Exposure", "Detection", "Config", "Danger"]),
  moduleId: z.string().min(1),
  stepKey: z.string().min(1),
  techniqueId: z.string().min(1)
});

export type KillChainQueuedPin = z.infer<typeof KillChainQueuedPinSchema>;

export const KillChainForbiddenPinSchema = z.strictObject({
  reason: z.string().min(1),
  techniqueId: z.string().min(1)
});

export type KillChainForbiddenPin = z.infer<typeof KillChainForbiddenPinSchema>;

export const KillChainRansomwareDecisionSchema = z.strictObject({
  measured: z.literal(false),
  measurementClass: z.literal("Danger"),
  startable: z.boolean(),
  techniqueId: z.literal("T1486")
});

export type KillChainRansomwareDecision = z.infer<
  typeof KillChainRansomwareDecisionSchema
>;

export interface KillChainEngineStart {
  denyReason: string | null;
  forbiddenPins: KillChainForbiddenPin[];
  graph: BasCampaignDag | null;
  jobsQueued: number;
  measured: false;
  queuedPins: KillChainQueuedPin[];
  ransomware: KillChainRansomwareDecision;
  startable: boolean;
}

export interface KillChainEngineStartInput {
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  liveEngine?: boolean;
  pins?: readonly KillChainPinInput[];
  qualified?: boolean;
  techniques?: readonly string[];
  tenantAuthorized?: boolean;
}

const RANSOMWARE_DENIED: KillChainRansomwareDecision = {
  measured: false,
  measurementClass: "Danger",
  startable: false,
  techniqueId: RANSOMWARE_TECHNIQUE_ID
};

const LIVE_RANSOMWARE_DENY_REASON =
  "Live ransomware is never queued. High-danger T1486 uses the catalog module after danger acknowledgement, qualification, and tenant authorization.";

const FORBIDDEN_PIN_DENY_REASON =
  "Kill-chain start fails closed when any pin is Forbidden. Denied tasks are never queued.";

function failClosed(input: {
  denyReason: string;
  forbiddenPins?: KillChainForbiddenPin[];
}): KillChainEngineStart {
  return {
    denyReason: input.denyReason,
    forbiddenPins: input.forbiddenPins ?? [],
    graph: null,
    jobsQueued: 0,
    measured: false,
    queuedPins: [],
    ransomware: RANSOMWARE_DENIED,
    startable: false
  };
}

function qualifiedModuleSet(): Set<string> {
  return new Set(QUALIFIED_KILLCHAIN_HANDOFF_MODULE_IDS);
}

function pinStepKey(pin: KillChainPinInput): string {
  return pin.stepKey && pin.stepKey.length > 0 ? pin.stepKey : pin.techniqueId;
}

const METASPLOIT_PAYLOAD_MODULE_ID = "exploit.metasploit_payload" as const;

function isLiveRansomwareModuleId(moduleId: string | undefined): boolean {
  return moduleId === LIVE_RANSOMWARE_MODULE_ID;
}

function highDangerGateOpen(input: KillChainEngineStartInput): boolean {
  return (
    input.dangerAcknowledged === true &&
    typeof input.dangerAckDigest === "string" &&
    input.dangerAckDigest.length >= 16 &&
    input.qualified === true &&
    input.tenantAuthorized === true
  );
}

function isMetasploitPayloadClass(pin: KillChainPinInput): boolean {
  const tokens = [pin.moduleId, pin.techniqueId]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toUpperCase());
  return (
    tokens.includes("PAYLOAD") || pin.moduleId === METASPLOIT_PAYLOAD_MODULE_ID
  );
}

function hasCommunitySafeStageDefault(pin: KillChainPinInput): boolean {
  const playbook = getSafeStagePlaybook(pin.techniqueId);
  return (
    playbook != null &&
    playbook.measurementClass !== "Danger" &&
    playbook.measurementClass !== "Forbidden" &&
    playbook.defaultModuleId != null
  );
}

function dangerCatalogModuleForPin(pin: KillChainPinInput): string | null {
  if (pin.moduleId && isDangerCatalogModule(pin.moduleId)) {
    return pin.moduleId;
  }
  if (isMetasploitPayloadClass(pin)) {
    return METASPLOIT_PAYLOAD_MODULE_ID;
  }
  if (hasCommunitySafeStageDefault(pin)) {
    return null;
  }
  const catalog = DANGER_CATALOG.find(
    (entry) =>
      entry.techniqueId === pin.techniqueId &&
      entry.moduleId !== KILLCHAIN_ENGINE_MODULE_ID
  );
  return catalog?.moduleId ?? null;
}

function isHighDangerKillChainPin(pin: KillChainPinInput): boolean {
  if (dangerCatalogModuleForPin(pin) != null) {
    return true;
  }
  if (pin.techniqueId === RANSOMWARE_TECHNIQUE_ID) {
    return true;
  }
  return getSafeStagePlaybook(pin.techniqueId)?.measurementClass === "Danger";
}

function resolveHighDangerModuleId(pin: KillChainPinInput): string | null {
  if (isLiveRansomwareModuleId(pin.moduleId)) {
    return null;
  }
  const catalogModule = dangerCatalogModuleForPin(pin);
  if (catalogModule && !isLiveRansomwareModuleId(catalogModule)) {
    return catalogModule;
  }
  const playbook = getSafeStagePlaybook(pin.techniqueId);
  const moduleId = pin.moduleId ?? playbook?.defaultModuleId ?? null;
  if (!moduleId || isLiveRansomwareModuleId(moduleId)) {
    return null;
  }
  if (isDangerCatalogModule(moduleId)) {
    return moduleId;
  }
  if (
    playbook?.measurementClass === "Danger" &&
    moduleId === playbook.defaultModuleId
  ) {
    return moduleId;
  }
  return null;
}

function ransomwareDecision(
  queuedPins: KillChainQueuedPin[]
): KillChainRansomwareDecision {
  return {
    measured: false,
    measurementClass: "Danger",
    startable: queuedPins.some(
      (pin) => pin.techniqueId === RANSOMWARE_TECHNIQUE_ID
    ),
    techniqueId: RANSOMWARE_TECHNIQUE_ID
  };
}

export function compileKillChainEngineStart(
  input: KillChainEngineStartInput
): KillChainEngineStart {
  if (input.liveEngine === true) {
    return failClosed({
      denyReason:
        "The kill-chain engine is a coverage planner, not a live APT execution engine. Startable only as a DAG of already-qualified non-Forbidden pins."
    });
  }

  const rawPins: KillChainPinInput[] = [
    ...(input.pins ?? []).map((pin) => KillChainPinInputSchema.parse(pin)),
    ...(input.techniques ?? []).map((techniqueId) =>
      KillChainPinInputSchema.parse({ techniqueId })
    )
  ];

  if (rawPins.length === 0) {
    return failClosed({
      denyReason:
        "Kill-chain start has no qualified pins. Denied tasks are never queued."
    });
  }

  const qualifiedModules = qualifiedModuleSet();
  const forbiddenPins: KillChainForbiddenPin[] = [];
  const queuedPins: KillChainQueuedPin[] = [];
  const dagPins: Array<{
    dependsOn: string[];
    stepKey: string;
    upstreamId: string;
  }> = [];

  for (const pin of rawPins) {
    if (isLiveRansomwareModuleId(pin.moduleId)) {
      return failClosed({
        denyReason: LIVE_RANSOMWARE_DENY_REASON
      });
    }

    if (isHighDangerKillChainPin(pin)) {
      if (!highDangerGateOpen(input)) {
        return failClosed({
          denyReason: BAS_DANGER_ACK_DENY_REASON
        });
      }
      const moduleId = resolveHighDangerModuleId(pin);
      if (!moduleId) {
        return failClosed({
          denyReason:
            "Kill-chain High-danger pins must use the High-danger catalog module. Live ransomware and unmarked Validate modules are never queued."
        });
      }
      const stepKey = pinStepKey(pin);
      queuedPins.push({
        measurementClass: "Danger",
        moduleId,
        stepKey,
        techniqueId: pin.techniqueId
      });
      dagPins.push({
        dependsOn: [...(pin.dependsOn ?? [])],
        stepKey,
        upstreamId: moduleId
      });
      continue;
    }

    const playbook = getSafeStagePlaybook(pin.techniqueId);
    const forbidden =
      playbook?.measurementClass === "Forbidden" ||
      playbook?.defaultModuleId == null;
    if (forbidden) {
      forbiddenPins.push({
        reason:
          playbook?.refusalNote ??
          `${pin.techniqueId} is Forbidden and cannot start.`,
        techniqueId: pin.techniqueId
      });
      continue;
    }

    const moduleId = pin.moduleId ?? playbook.defaultModuleId;
    if (
      !moduleId ||
      !qualifiedModules.has(moduleId) ||
      moduleId !== playbook.defaultModuleId
    ) {
      return failClosed({
        denyReason:
          "Kill-chain startable pins must already be qualified non-Forbidden hand-offs. Unreviewed or live-offensive pins are never queued.",
        forbiddenPins
      });
    }

    const measurementClass = playbook.measurementClass as Exclude<
      MeasurementClass,
      "Forbidden" | "Danger"
    >;
    const stepKey = pinStepKey(pin);
    queuedPins.push({
      measurementClass,
      moduleId,
      stepKey,
      techniqueId: pin.techniqueId
    });
    dagPins.push({
      dependsOn: [...(pin.dependsOn ?? [])],
      stepKey,
      upstreamId: moduleId
    });
  }

  if (forbiddenPins.length > 0) {
    return failClosed({
      denyReason: FORBIDDEN_PIN_DENY_REASON,
      forbiddenPins
    });
  }

  const dag = compileBasCampaignDag(dagPins);
  if (dag.error || !dag.graph) {
    return failClosed({
      denyReason:
        dag.error ??
        "Kill-chain dependency graph is invalid. Compile fails closed."
    });
  }

  return {
    denyReason: null,
    forbiddenPins: [],
    graph: dag.graph,
    jobsQueued: queuedPins.length,
    measured: false,
    queuedPins,
    ransomware: ransomwareDecision(queuedPins),
    startable: true
  };
}

export function isForbiddenKillChainCampaignToken(token: string): boolean {
  const value = token.trim();
  if (value.length === 0) {
    return false;
  }
  return isLiveRansomwareModuleId(value);
}
