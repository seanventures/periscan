import { z } from "zod";

import {
  BasCampaignTypedInputsSchema,
  evaluateBasCampaignStartability,
  livePackFromCampaignPins,
  type BasCampaignProvider
} from "./bas-campaign";
import {
  formatBasInjectLabel,
  resolveBasInjectActionPin,
  type BasInject
} from "./bas-inject";
import {
  BAS_BENIGN_MARKER_SCENARIO_ID,
  denyReasonForLivePack,
  listBasControlPlaneScenarios,
  type BasLivePack,
  type BasScenarioClaimClass
} from "./bas-control-plane";
import {
  DangerClassSchema,
  isDangerCatalogModule,
  listDangerCatalog,
  type DangerClass
} from "./danger-section";
import {
  PolicyDecisionOutcomeSchema,
  ValidationMissionSchema,
  ValidationRunSchema
} from "./domain";

const IdSchema = z.uuid();
const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const AtomicTestProviderSchema = z.enum([
  "ControlPlane",
  "AtomicRedTeam",
  "Caldera",
  "HighDanger"
]);
export type AtomicTestProvider = z.infer<typeof AtomicTestProviderSchema>;

export const AtomicTestCatalogSectionSchema = z.enum([
  "Qualified",
  "Qualification required",
  "High danger"
]);
export type AtomicTestCatalogSection = z.infer<
  typeof AtomicTestCatalogSectionSchema
>;

export const AtomicTestResultKindSchema = z.enum([
  "Validated",
  "Prevented",
  "Logged",
  "Inconclusive"
]);
export type AtomicTestResultKind = z.infer<typeof AtomicTestResultKindSchema>;

export const AtomicTestScenarioPinSchema = z.strictObject({
  contentSha256: Sha256HexSchema.optional(),
  provider: AtomicTestProviderSchema,
  typedInputs: BasCampaignTypedInputsSchema.default({}),
  upstreamId: z.string().min(1).max(128)
});
export type AtomicTestScenarioPin = z.infer<typeof AtomicTestScenarioPinSchema>;

export const StartAtomicTestInputSchema = z
  .strictObject({
    assetId: IdSchema.optional(),
    dangerAckDigest: z.string().min(16).max(128).optional(),
    dangerAcknowledged: z.boolean().optional(),
    runnerId: IdSchema.optional(),
    scenarioPin: AtomicTestScenarioPinSchema,
    scopeId: IdSchema
  })
  .refine((value) => Boolean(value.assetId) || Boolean(value.runnerId), {
    message: "assetId or runnerId is required."
  });
export type StartAtomicTestInput = z.infer<typeof StartAtomicTestInputSchema>;

export const AtomicTestCatalogPinSchema = z.strictObject({
  dangerClass: DangerClassSchema.nullable(),
  denyReason: z.string().min(1).nullable(),
  description: z.string().min(1),
  livePack: z.enum(["none", "atomic", "caldera", "metasploit"]),
  pinId: z.string().min(1),
  provider: AtomicTestProviderSchema,
  section: AtomicTestCatalogSectionSchema,
  startable: z.boolean(),
  techniqueId: z.string().min(1).nullable(),
  title: z.string().min(1),
  upstreamId: z.string().min(1).max(128)
});
export type AtomicTestCatalogPin = z.infer<typeof AtomicTestCatalogPinSchema>;

export const AtomicTestCatalogSchema = z.strictObject({
  items: z.array(AtomicTestCatalogPinSchema),
  liveSupported: z.literal(false)
});
export type AtomicTestCatalog = z.infer<typeof AtomicTestCatalogSchema>;

export const StartAtomicTestResultSchema = z
  .strictObject({
    boundAssetId: IdSchema.nullable(),
    boundRunnerId: IdSchema.nullable(),
    claimClass: z.enum(["benign_marker_only", "qualification_required"]),
    denyReason: z.string().min(1).nullable(),
    jobsQueued: z.number().int().nonnegative(),
    liveSupported: z.literal(false),
    mission: ValidationMissionSchema.nullable(),
    outcome: PolicyDecisionOutcomeSchema,
    policyDecisionId: IdSchema,
    queued: z.boolean(),
    rationale: z.string().min(1),
    result: AtomicTestResultKindSchema,
    runs: z.array(ValidationRunSchema),
    scenarioPin: AtomicTestScenarioPinSchema,
    startable: z.boolean()
  })
  .refine(
    (result) =>
      result.outcome === "Allowed" ||
      (result.jobsQueued === 0 && result.queued === false),
    { message: "Denied atomic tests must never queue jobs." }
  )
  .refine(
    (result) => result.startable || (result.jobsQueued === 0 && !result.queued),
    { message: "Unstartable atomic tests must never queue jobs." }
  );
export type StartAtomicTestResult = z.infer<typeof StartAtomicTestResultSchema>;

export type EvaluateAtomicTestStartabilityInput = {
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  hasBoundTarget: boolean;
  pin: {
    provider: string;
    upstreamId: string;
  };
  policyAllowed?: boolean;
  runnerStatus: string | null;
  scopeVerified: boolean;
  tenantAuthorized?: boolean;
};

export type EvaluateAtomicTestStartabilityResult = {
  dangerClass: DangerClass | null;
  denyReason: string | null;
  livePack: BasLivePack;
  section: AtomicTestCatalogSection;
  startable: boolean;
};

const BOUND_TARGET_REQUIRED =
  "Bound runner or asset is required before an atomic test can start.";

function campaignProviderForPin(provider: string): BasCampaignProvider {
  if (provider === "AtomicRedTeam" || provider === "Caldera") {
    return provider;
  }
  return "ControlPlane";
}

function dangerClassForPin(pin: {
  provider: string;
  upstreamId: string;
}): DangerClass | null {
  const fromCatalog = listDangerCatalog().find(
    (entry) => entry.moduleId === pin.upstreamId
  );
  if (fromCatalog) {
    return fromCatalog.dangerClass;
  }
  if (pin.provider === "HighDanger") {
    return "ransomware_impact";
  }
  return null;
}

export function listAtomicTestCatalog(): AtomicTestCatalog {
  const controlPlane = listBasControlPlaneScenarios().map((scenario) => {
    const startable = scenario.startable && scenario.livePack === "none";
    const provider: AtomicTestProvider =
      scenario.livePack === "atomic"
        ? "AtomicRedTeam"
        : scenario.livePack === "caldera"
          ? "Caldera"
          : "ControlPlane";
    const denyReason =
      scenario.livePack === "none"
        ? startable
          ? null
          : "BAS pin is not startable. Denied tasks are never queued."
        : denyReasonForLivePack(scenario.livePack);
    return AtomicTestCatalogPinSchema.parse({
      dangerClass: null,
      denyReason,
      description: scenario.description,
      livePack: scenario.livePack,
      pinId: scenario.scenarioId,
      provider,
      section: startable ? "Qualified" : "Qualification required",
      startable,
      techniqueId: scenario.techniqueId ?? null,
      title: scenario.title,
      upstreamId: scenario.scenarioId
    });
  });

  const danger = listDangerCatalog().map((entry) =>
    AtomicTestCatalogPinSchema.parse({
      dangerClass: entry.dangerClass,
      denyReason: "danger_acknowledgement_required",
      description: entry.description,
      livePack: "none",
      pinId: entry.moduleId,
      provider: "HighDanger",
      section: "High danger",
      startable: false,
      techniqueId: entry.techniqueId,
      title: entry.title,
      upstreamId: entry.moduleId
    })
  );

  return AtomicTestCatalogSchema.parse({
    items: [...controlPlane, ...danger],
    liveSupported: false
  });
}

export function evaluateAtomicTestStartability(
  input: EvaluateAtomicTestStartabilityInput
): EvaluateAtomicTestStartabilityResult {
  const dangerClass = dangerClassForPin(input.pin);
  const isDanger =
    input.pin.provider === "HighDanger" ||
    isDangerCatalogModule(input.pin.upstreamId);

  if (!input.hasBoundTarget) {
    return {
      dangerClass,
      denyReason: BOUND_TARGET_REQUIRED,
      livePack: "none",
      section: isDanger ? "High danger" : "Qualification required",
      startable: false
    };
  }

  if (isDanger) {
    if (!input.dangerAcknowledged || !input.dangerAckDigest) {
      return {
        dangerClass,
        denyReason: "danger_acknowledgement_required",
        livePack: "none",
        section: "High danger",
        startable: false
      };
    }
    return {
      dangerClass,
      denyReason: "qualification_required",
      livePack: "none",
      section: "High danger",
      startable: false
    };
  }

  const campaign = evaluateBasCampaignStartability({
    pins: [
      {
        provider: campaignProviderForPin(input.pin.provider),
        typedInputs: {},
        upstreamId: input.pin.upstreamId
      }
    ],
    runnerStatus: input.runnerStatus,
    scopeVerified: input.scopeVerified
  });
  const livePack = livePackFromCampaignPins([input.pin]);
  return {
    dangerClass: null,
    denyReason: campaign.denyReason,
    livePack,
    section: campaign.startable ? "Qualified" : "Qualification required",
    startable: campaign.startable
  };
}

export function atomicTestImmediateResult(input: {
  jobsQueued: number;
  observedOutcome?: string | null;
  outcome: string;
  queued: boolean;
  startable: boolean;
}): AtomicTestResultKind {
  const observed = input.observedOutcome ?? null;
  if (observed === "Prevented") {
    return "Prevented";
  }
  if (
    observed === "Detected" ||
    observed === "Validated" ||
    observed === "Alerted" ||
    observed === "Routed"
  ) {
    return "Validated";
  }
  if (observed === "Logged" || observed === "TelemetryOnly") {
    return "Logged";
  }
  if (
    input.startable &&
    input.outcome === "Allowed" &&
    input.queued &&
    input.jobsQueued > 0
  ) {
    return "Logged";
  }
  return "Inconclusive";
}

export function deniedAtomicTestResult(input: {
  boundAssetId: string | null;
  boundRunnerId: string | null;
  claimClass?: BasScenarioClaimClass;
  denyReason: string;
  policyDecisionId: string;
  scenarioPin: AtomicTestScenarioPin;
}): StartAtomicTestResult {
  return StartAtomicTestResultSchema.parse({
    boundAssetId: input.boundAssetId,
    boundRunnerId: input.boundRunnerId,
    claimClass: input.claimClass ?? "qualification_required",
    denyReason: input.denyReason,
    jobsQueued: 0,
    liveSupported: false,
    mission: null,
    outcome: "Denied",
    policyDecisionId: input.policyDecisionId,
    queued: false,
    rationale: input.denyReason,
    result: "Inconclusive",
    runs: [],
    scenarioPin: input.scenarioPin,
    startable: false
  });
}

export const ATOMIC_TEST_BENIGN_MARKER_PIN_ID = BAS_BENIGN_MARKER_SCENARIO_ID;

const IMPORTED_INJECT_DENY_REASON =
  "Imported Injects are not a qualified live pack. Denied tasks are never queued.";

export function listAtomicTestsFromInjects(
  injects: ReadonlyArray<BasInject>
): AtomicTestCatalog {
  const catalog = listAtomicTestCatalog();
  const byUpstream = new Map(
    catalog.items.map((item) => [item.upstreamId, item])
  );
  const byPinId = new Map(catalog.items.map((item) => [item.pinId, item]));

  const items = injects.map((inject) => {
    const pin = resolveBasInjectActionPin(inject.actionRef);
    const existing =
      byUpstream.get(pin.upstreamId) ??
      byPinId.get(inject.actionRef.moduleId) ??
      byPinId.get(pin.upstreamId);
    if (existing) {
      return existing;
    }

    const livePack = livePackFromCampaignPins([pin]);
    const isDanger =
      isDangerCatalogModule(inject.actionRef.moduleId) ||
      isDangerCatalogModule(pin.upstreamId);
    const provider: AtomicTestProvider = isDanger
      ? "HighDanger"
      : pin.provider === "AtomicRedTeam"
        ? "AtomicRedTeam"
        : pin.provider === "Caldera"
          ? "Caldera"
          : "ControlPlane";
    const dangerClass = isDanger
      ? dangerClassForPin({
          provider,
          upstreamId: pin.upstreamId
        })
      : null;

    return AtomicTestCatalogPinSchema.parse({
      dangerClass,
      denyReason: isDanger
        ? "danger_acknowledgement_required"
        : livePack === "none"
          ? IMPORTED_INJECT_DENY_REASON
          : denyReasonForLivePack(livePack),
      description: IMPORTED_INJECT_DENY_REASON,
      livePack,
      pinId: inject.stepKey,
      provider,
      section: isDanger ? "High danger" : "Qualification required",
      startable: false,
      techniqueId: null,
      title: formatBasInjectLabel(inject),
      upstreamId: pin.upstreamId
    });
  });

  return AtomicTestCatalogSchema.parse({
    items,
    liveSupported: false
  });
}
