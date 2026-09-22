import { z } from "zod";

import {
  BasCampaignDagSchema,
  BasCampaignProviderSchema,
  BasCampaignScenarioPinSchema,
  BasCampaignTypedInputsSchema,
  compileBasCampaignDag,
  livePackFromCampaignPins,
  sha256Hex,
  canonicalizeJson,
  type BasCampaignDag,
  type BasCampaignScenarioPin
} from "./bas-campaign";
import {
  BAS_BENIGN_MARKER_MODULE_ID,
  BAS_BENIGN_MARKER_SCENARIO_ID,
  denyReasonForLivePack
} from "./bas-control-plane";
import { evaluateDangerStart, isDangerCatalogModule } from "./danger-section";
import { PolicyDecisionOutcomeSchema } from "./domain";
import type { DetectionCorrelationVerdict } from "./detection-correlation";

/**
 * Inject contract: wrap a technical action with who (asset/player), when
 * (timeline), and what is expected (observe/assert). Compile is a campaign DAG.
 * This module never queues work and never flips liveSupported.
 *
 * Product copy uses **Inject**. Do not surface vendor names in UX.
 */

export const BAS_INJECT_LIVE_SUPPORTED = false as const;
export const BAS_INJECT_PRODUCT_NOUN = "Inject" as const;
export const BAS_INJECT_COPY_FORBIDDEN = ["OpenAEV", "OpenBAS"] as const;
export const BAS_INJECT_TIMELINE_INVERSION_MESSAGE =
  "Inject scheduledAt must not precede its dependencies. Compile fails closed.";

export const BAS_INJECT_PRODUCT_COPY = {
  noun: "Inject",
  compileDenied: "Inject compile failed closed.",
  queueDenied: "Inject was not queued.",
  policyDenied: "Inject was not queued because policy is not Allowed.",
  scopeDenied: "Verified scope is required before an Inject can be queued.",
  emailCanaryOnly:
    "Email Inject is a synthetic canary unless High-danger acknowledgement is recorded.",
  tabletopCanaryOnly:
    "Tabletop Inject is a synthetic canary unless High-danger acknowledgement is recorded.",
  startDenied: "Inject start was denied. Jobs were not queued.",
  planOnly: "Inject is planned. Import is not executed coverage.",
  liveVendorDenied:
    "Live vendor Inject execution is not supported. Jobs were not queued.",
  executedCoverageForbidden: "Imported Injects are not executed coverage.",
  whoRequired: "Inject requires a target asset or player.",
  importInvalid: "Inject import failed closed."
} as const;

export const BAS_INJECT_IMPORT_ORIGIN_DEFAULT = "2026-09-17T14:00:00.000Z";

const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const BasInjectExpectedObservationSchema = z.enum([
  "logged",
  "alerted",
  "prevented",
  "inconclusive"
]);
export type BasInjectExpectedObservation = z.infer<
  typeof BasInjectExpectedObservationSchema
>;

export const BasInjectKindSchema = z.enum(["technical", "email", "tabletop"]);
export type BasInjectKind = z.infer<typeof BasInjectKindSchema>;

export const BasInjectChannelSchema = z.enum([
  "synthetic_canary",
  "phishing_send",
  "tabletop_live"
]);
export type BasInjectChannel = z.infer<typeof BasInjectChannelSchema>;

export const BasInjectDeliveryModeSchema = z.enum([
  "technical",
  "synthetic_canary",
  "high_danger_gated"
]);
export type BasInjectDeliveryMode = z.infer<typeof BasInjectDeliveryModeSchema>;

export const BasInjectActionPinSchema = z.strictObject({
  provider: BasCampaignProviderSchema,
  contentSha256: Sha256HexSchema,
  upstreamId: z.string().min(1).max(128),
  typedInputs: BasCampaignTypedInputsSchema.default({})
});
export type BasInjectActionPin = z.infer<typeof BasInjectActionPinSchema>;

export const BasInjectActionRefSchema = z.strictObject({
  moduleId: z.string().min(1).max(128),
  pin: BasInjectActionPinSchema.optional()
});
export type BasInjectActionRef = z.infer<typeof BasInjectActionRefSchema>;

export const BasInjectTargetRefSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    assetId: z.uuid(),
    kind: z.literal("asset")
  }),
  z.strictObject({
    kind: z.literal("player"),
    playerId: z.string().min(1).max(128)
  })
]);
export type BasInjectTargetRef = z.infer<typeof BasInjectTargetRefSchema>;

export const BasInjectSchema = z.strictObject({
  actionRef: BasInjectActionRefSchema,
  channel: BasInjectChannelSchema.optional(),
  dependsOn: z.array(z.string().min(1).max(128)).max(11).default([]),
  expectedObservation: BasInjectExpectedObservationSchema,
  kind: BasInjectKindSchema.default("technical"),
  scheduledAt: z.iso.datetime(),
  stepKey: z.string().min(1).max(128),
  targetRef: BasInjectTargetRefSchema
});
export type BasInject = z.infer<typeof BasInjectSchema>;
export type BasInjectInput = z.input<typeof BasInjectSchema>;

export function formatBasInjectLabel(inject: { stepKey: string }): string {
  return `${BAS_INJECT_PRODUCT_NOUN} ${inject.stepKey}`;
}

export function basInjectProductCopyContainsVendor(text: string): boolean {
  return /openaev|openbas/iu.test(text);
}

export function mapExpectedObservationToCorrelationVerdict(
  expected: BasInjectExpectedObservation
): Extract<
  DetectionCorrelationVerdict,
  "Logged" | "Alerted" | "Prevented" | "Inconclusive"
> {
  switch (expected) {
    case "logged":
      return "Logged";
    case "alerted":
      return "Alerted";
    case "prevented":
      return "Prevented";
    case "inconclusive":
      return "Inconclusive";
  }
}

export function resolveBasInjectActionPin(
  actionRef: BasInjectActionRef
): BasInjectActionPin {
  if (actionRef.pin) {
    return BasInjectActionPinSchema.parse(actionRef.pin);
  }
  const provider = actionRef.moduleId.startsWith("atomic.")
    ? "AtomicRedTeam"
    : actionRef.moduleId.startsWith("caldera.")
      ? "Caldera"
      : "ControlPlane";
  const upstreamId =
    actionRef.moduleId === BAS_BENIGN_MARKER_MODULE_ID
      ? BAS_BENIGN_MARKER_SCENARIO_ID
      : actionRef.moduleId;
  return BasInjectActionPinSchema.parse({
    contentSha256: sha256Hex(
      canonicalizeJson({
        moduleId: actionRef.moduleId,
        provider,
        upstreamId
      })
    ),
    provider,
    typedInputs: {},
    upstreamId
  });
}

export function basInjectToCampaignPin(
  inject: BasInject
): BasCampaignScenarioPin {
  const pin = resolveBasInjectActionPin(inject.actionRef);
  return BasCampaignScenarioPinSchema.parse({
    contentSha256: pin.contentSha256,
    dependsOn: [...(inject.dependsOn ?? [])],
    provider: pin.provider,
    stepKey: inject.stepKey,
    typedInputs: pin.typedInputs,
    upstreamId: pin.upstreamId
  });
}

export const CompileBasInjectCampaignInputSchema = z.strictObject({
  injects: z.array(BasInjectSchema).min(1).max(50)
});
export type CompileBasInjectCampaignInput = z.input<
  typeof CompileBasInjectCampaignInputSchema
>;

export const CompileBasInjectCampaignResultSchema = z.strictObject({
  error: z.string().min(1).nullable(),
  graph: BasCampaignDagSchema.nullable(),
  injects: z.array(BasInjectSchema),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false),
  pins: z.array(BasCampaignScenarioPinSchema),
  queued: z.literal(false)
});
export type CompileBasInjectCampaignResult = z.infer<
  typeof CompileBasInjectCampaignResultSchema
>;

function closedCompile(
  injects: BasInject[],
  pins: BasCampaignScenarioPin[],
  error: string
): CompileBasInjectCampaignResult {
  return CompileBasInjectCampaignResultSchema.parse({
    error,
    graph: null,
    injects,
    jobsQueued: 0,
    liveSupported: false,
    pins,
    queued: false
  });
}

function timelineInversionError(injects: readonly BasInject[]): string | null {
  const byKey = new Map(injects.map((inject) => [inject.stepKey, inject]));
  for (const inject of injects) {
    const scheduledAt = Date.parse(inject.scheduledAt);
    for (const dependency of inject.dependsOn ?? []) {
      const parent = byKey.get(dependency);
      if (!parent) {
        continue;
      }
      if (scheduledAt < Date.parse(parent.scheduledAt)) {
        return BAS_INJECT_TIMELINE_INVERSION_MESSAGE;
      }
    }
  }
  return null;
}

export function compileBasInjectCampaign(input: {
  injects: ReadonlyArray<BasInject | BasInjectInput>;
}): CompileBasInjectCampaignResult {
  const injects = z.array(BasInjectSchema).min(1).parse(input.injects);
  const pins = injects.map((inject) => basInjectToCampaignPin(inject));
  const dag = compileBasCampaignDag(pins);
  if (dag.error !== null || dag.graph === null) {
    return closedCompile(
      injects,
      pins,
      dag.error ?? BAS_INJECT_PRODUCT_COPY.compileDenied
    );
  }
  const inverted = timelineInversionError(injects);
  if (inverted) {
    return closedCompile(injects, pins, inverted);
  }
  const graph: BasCampaignDag = dag.graph;
  return CompileBasInjectCampaignResultSchema.parse({
    error: null,
    graph,
    injects,
    jobsQueued: 0,
    liveSupported: false,
    pins,
    queued: false
  });
}

export const EvaluateBasInjectQueueInputSchema = z.strictObject({
  dangerAckDigest: z.string().min(16).optional(),
  dangerAcknowledged: z.boolean().optional(),
  injects: z.array(BasInjectSchema).min(1).max(50),
  policyOutcome: PolicyDecisionOutcomeSchema,
  qualified: z.boolean().optional(),
  scopeVerified: z.boolean(),
  tenantAuthorized: z.boolean().optional()
});
export type EvaluateBasInjectQueueInput = z.input<
  typeof EvaluateBasInjectQueueInputSchema
>;

export const EvaluateBasInjectQueueResultSchema = z
  .strictObject({
    deliveryMode: BasInjectDeliveryModeSchema,
    denyReason: z.string().min(1).nullable(),
    jobsQueued: z.literal(0),
    liveSupported: z.literal(false),
    queueable: z.boolean(),
    queued: z.literal(false),
    startable: z.boolean()
  })
  .refine(
    (result) =>
      result.startable || (result.jobsQueued === 0 && result.queued === false),
    { message: "Denied Injects must never queue jobs." }
  );
export type EvaluateBasInjectQueueResult = z.infer<
  typeof EvaluateBasInjectQueueResultSchema
>;

function closedQueue(input: {
  deliveryMode: BasInjectDeliveryMode;
  denyReason: string;
}): EvaluateBasInjectQueueResult {
  return EvaluateBasInjectQueueResultSchema.parse({
    deliveryMode: input.deliveryMode,
    denyReason: input.denyReason,
    jobsQueued: 0,
    liveSupported: false,
    queueable: false,
    queued: false,
    startable: false
  });
}

function injectChannel(inject: BasInject): BasInjectChannel | undefined {
  if (inject.channel) {
    return inject.channel;
  }
  if (inject.kind === "email" || inject.kind === "tabletop") {
    return "synthetic_canary";
  }
  return undefined;
}

function evaluateInjectDanger(input: {
  inject: BasInject;
  policyAllowed: boolean;
  qualified: boolean;
  scopeVerified: boolean;
  tenantAuthorized: boolean;
  dangerAcknowledged: boolean;
  dangerAckDigest?: string;
}) {
  return evaluateDangerStart({
    dangerAckDigest: input.dangerAckDigest,
    dangerAcknowledged: input.dangerAcknowledged,
    policyAllowed: input.policyAllowed,
    qualified: input.qualified,
    scenarioId: input.inject.actionRef.moduleId,
    scopeVerified: input.scopeVerified,
    tenantAuthorized: input.tenantAuthorized
  });
}

export function evaluateBasInjectQueue(
  raw: EvaluateBasInjectQueueInput
): EvaluateBasInjectQueueResult {
  const input = EvaluateBasInjectQueueInputSchema.parse(raw);
  const compiled = compileBasInjectCampaign({ injects: input.injects });
  const injects = compiled.injects;
  const hasCanaryKind = injects.some(
    (inject) => inject.kind === "email" || inject.kind === "tabletop"
  );
  const baselineMode: BasInjectDeliveryMode = hasCanaryKind
    ? "synthetic_canary"
    : "technical";

  if (compiled.error) {
    return closedQueue({
      deliveryMode: baselineMode,
      denyReason: compiled.error
    });
  }
  if (!input.scopeVerified) {
    return closedQueue({
      deliveryMode: baselineMode,
      denyReason: BAS_INJECT_PRODUCT_COPY.scopeDenied
    });
  }
  if (input.policyOutcome !== "Allowed") {
    return closedQueue({
      deliveryMode: baselineMode,
      denyReason: BAS_INJECT_PRODUCT_COPY.policyDenied
    });
  }

  const livePack = livePackFromCampaignPins(compiled.pins);
  if (livePack !== "none") {
    return closedQueue({
      deliveryMode: baselineMode,
      denyReason: denyReasonForLivePack(livePack)
    });
  }

  let highDangerGated = false;
  const dangerInput = {
    dangerAckDigest: input.dangerAckDigest,
    dangerAcknowledged: input.dangerAcknowledged === true,
    policyAllowed: true,
    qualified: input.qualified === true,
    scopeVerified: true,
    tenantAuthorized: input.tenantAuthorized === true
  };

  for (const inject of injects) {
    const channel = injectChannel(inject);
    const canaryCopy =
      inject.kind === "tabletop"
        ? BAS_INJECT_PRODUCT_COPY.tabletopCanaryOnly
        : BAS_INJECT_PRODUCT_COPY.emailCanaryOnly;

    if (channel === "phishing_send" || channel === "tabletop_live") {
      if (!isDangerCatalogModule(inject.actionRef.moduleId)) {
        return closedQueue({
          deliveryMode: baselineMode,
          denyReason: canaryCopy
        });
      }
      const danger = evaluateInjectDanger({ ...dangerInput, inject });
      if (!danger.startable) {
        return closedQueue({
          deliveryMode: baselineMode,
          denyReason: danger.denyReason ?? canaryCopy
        });
      }
      highDangerGated = true;
      continue;
    }

    if (isDangerCatalogModule(inject.actionRef.moduleId)) {
      const danger = evaluateInjectDanger({ ...dangerInput, inject });
      if (!danger.startable) {
        return closedQueue({
          deliveryMode: baselineMode,
          denyReason: danger.denyReason ?? canaryCopy
        });
      }
      highDangerGated = true;
    }
  }

  const deliveryMode: BasInjectDeliveryMode = highDangerGated
    ? "high_danger_gated"
    : baselineMode;

  return EvaluateBasInjectQueueResultSchema.parse({
    deliveryMode,
    denyReason: null,
    jobsQueued: 0,
    liveSupported: false,
    queueable: true,
    queued: false,
    startable: true
  });
}

export const StartBasInjectInputSchema = EvaluateBasInjectQueueInputSchema;
export type StartBasInjectInput = EvaluateBasInjectQueueInput;

export const StartBasInjectResultSchema = z
  .strictObject({
    deliveryMode: BasInjectDeliveryModeSchema,
    denyReason: z.string().min(1).nullable(),
    executed: z.literal(false),
    jobsQueued: z.literal(0),
    liveSupported: z.literal(false),
    outcome: PolicyDecisionOutcomeSchema,
    queued: z.literal(false),
    rationale: z.string().min(1),
    startable: z.boolean()
  })
  .refine(
    (result) =>
      result.outcome === "Allowed" ||
      (result.jobsQueued === 0 && result.queued === false),
    { message: "Denied Injects must never queue jobs." }
  )
  .refine(
    (result) => result.startable || (result.jobsQueued === 0 && !result.queued),
    { message: "Unstartable Injects must never queue jobs." }
  );
export type StartBasInjectResult = z.infer<typeof StartBasInjectResultSchema>;

export function startBasInject(raw: StartBasInjectInput): StartBasInjectResult {
  const input = StartBasInjectInputSchema.parse(raw);
  const evaluated = evaluateBasInjectQueue(input);
  if (!evaluated.startable) {
    const rationale =
      evaluated.denyReason ?? BAS_INJECT_PRODUCT_COPY.startDenied;
    return StartBasInjectResultSchema.parse({
      deliveryMode: evaluated.deliveryMode,
      denyReason: evaluated.denyReason,
      executed: false,
      jobsQueued: 0,
      liveSupported: false,
      outcome: input.scopeVerified ? "Denied" : "RequiresVerifiedScope",
      queued: false,
      rationale,
      startable: false
    });
  }
  return StartBasInjectResultSchema.parse({
    deliveryMode: evaluated.deliveryMode,
    denyReason: null,
    executed: false,
    jobsQueued: 0,
    liveSupported: false,
    outcome: "Allowed",
    queued: false,
    rationale: BAS_INJECT_PRODUCT_COPY.planOnly,
    startable: true
  });
}

export const BasInjectImportDenialCodeSchema = z.enum([
  "inject_executed_coverage_forbidden",
  "inject_import_invalid",
  "inject_live_vendor_forbidden",
  "inject_target_required"
]);
export type BasInjectImportDenialCode = z.infer<
  typeof BasInjectImportDenialCodeSchema
>;

export const ImportBasInjectsSuccessSchema = z.strictObject({
  executed: z.literal(false),
  injects: z.array(BasInjectSchema).min(1),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false),
  ok: z.literal(true)
});
export type ImportBasInjectsSuccess = z.infer<
  typeof ImportBasInjectsSuccessSchema
>;

export const ImportBasInjectsDenialSchema = z.strictObject({
  code: BasInjectImportDenialCodeSchema,
  executed: z.literal(false),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false),
  ok: z.literal(false),
  rationale: z.string().min(1)
});
export type ImportBasInjectsDenial = z.infer<
  typeof ImportBasInjectsDenialSchema
>;

export const ImportBasInjectsResultSchema = z.discriminatedUnion("ok", [
  ImportBasInjectsSuccessSchema,
  ImportBasInjectsDenialSchema
]);
export type ImportBasInjectsResult = z.infer<
  typeof ImportBasInjectsResultSchema
>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function denyImport(
  code: BasInjectImportDenialCode,
  rationale: string
): ImportBasInjectsDenial {
  return ImportBasInjectsDenialSchema.parse({
    code,
    executed: false,
    jobsQueued: 0,
    liveSupported: false,
    ok: false,
    rationale
  });
}

function hasExecutedCoverageClaim(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) {
    return false;
  }
  if (
    record.executedCoverage === true ||
    record.executed === true ||
    record.executable === true
  ) {
    return true;
  }
  const claims = asRecord(record.claims);
  return Boolean(claims && claims.executedCoverage === true);
}

function hasLiveVendorSaaSClaim(value: unknown): boolean {
  const record = asRecord(value);
  if (!record) {
    return false;
  }
  if (record.liveSupported === true) {
    return true;
  }
  for (const key of ["openaevUrl", "openbasUrl", "filigranUrl"] as const) {
    if (typeof record[key] === "string" && record[key].length > 0) {
      return true;
    }
  }
  return false;
}

function isBasInjectShape(value: unknown): boolean {
  const record = asRecord(value);
  return Boolean(
    record &&
    record.actionRef &&
    record.targetRef &&
    record.scheduledAt &&
    record.stepKey
  );
}

function firstId(value: unknown, keys: readonly string[]): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstId(entry, keys);
      if (found) {
        return found;
      }
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return null;
}

function injectKindFromType(injectType: string): BasInjectKind {
  const normalized = injectType.toLowerCase();
  if (/(email|mail|phish)/u.test(normalized)) {
    return "email";
  }
  if (/(tabletop|challenge|article|media)/u.test(normalized)) {
    return "tabletop";
  }
  return "technical";
}

function providerFromInjectType(
  injectType: string
): z.infer<typeof BasCampaignProviderSchema> {
  const normalized = injectType.toLowerCase();
  if (normalized.includes("atomic")) {
    return "AtomicRedTeam";
  }
  if (normalized.includes("caldera")) {
    return "Caldera";
  }
  return "ControlPlane";
}

function expectedObservationFromRaw(
  value: unknown
): BasInjectExpectedObservation {
  const entries = Array.isArray(value) ? value : value ? [value] : [];
  for (const entry of entries) {
    const record = asRecord(entry);
    const type = String(
      record?.inject_expectation_type ?? record?.type ?? entry ?? ""
    ).toUpperCase();
    if (type.includes("PREVENTION") || type.includes("PREVENT")) {
      return "prevented";
    }
    if (type.includes("DETECTION") || type.includes("DETECT")) {
      return "alerted";
    }
    if (
      type.includes("HUMAN") ||
      type.includes("ARTICLE") ||
      type.includes("CHALLENGE") ||
      type.includes("MANUAL")
    ) {
      return "logged";
    }
  }
  return "inconclusive";
}

function scheduledAtFromRaw(
  record: Record<string, unknown>,
  originAt: string
): string {
  const dated =
    typeof record.inject_date === "string" ? record.inject_date : null;
  if (dated && !Number.isNaN(Date.parse(dated))) {
    return new Date(dated).toISOString();
  }
  const duration =
    typeof record.inject_depends_duration === "number" &&
    Number.isFinite(record.inject_depends_duration)
      ? record.inject_depends_duration
      : 0;
  return new Date(Date.parse(originAt) + duration * 1000).toISOString();
}

function targetRefFromRaw(
  record: Record<string, unknown>
): BasInjectTargetRef | null {
  const assetId = firstId(record.inject_assets ?? record.inject_asset_id, [
    "asset_id",
    "assetId",
    "id"
  ]);
  if (assetId && z.uuid().safeParse(assetId).success) {
    return { assetId, kind: "asset" };
  }
  const playerId = firstId(
    record.inject_teams ??
      record.inject_players ??
      record.inject_user ??
      record.team_id,
    ["team_id", "player_id", "user_id", "userId", "id"]
  );
  if (playerId) {
    return { kind: "player", playerId };
  }
  return null;
}

function dependsOnFromRaw(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.length > 0) {
      ids.push(entry);
      continue;
    }
    const record = asRecord(entry);
    const injectId = record?.inject_id;
    if (typeof injectId === "string" && injectId.length > 0) {
      ids.push(injectId);
    }
  }
  return ids;
}

function normalizeVendorInject(
  value: unknown,
  originAt: string
): BasInject | null {
  const record = asRecord(value);
  if (!record || typeof record.inject_id !== "string") {
    return null;
  }
  const targetRef = targetRefFromRaw(record);
  if (!targetRef) {
    return null;
  }
  const contract = asRecord(record.inject_injector_contract) ?? {};
  const payload = asRecord(contract.injector_contract_payload) ?? {};
  const injectType = String(record.inject_type ?? payload.payload_type ?? "");
  const kind = injectKindFromType(injectType);
  const provider = providerFromInjectType(injectType);
  const moduleId =
    typeof payload.payload_id === "string" && payload.payload_id.length > 0
      ? payload.payload_id
      : record.inject_id;
  const upstreamId = moduleId;
  const pin = BasInjectActionPinSchema.parse({
    contentSha256: sha256Hex(
      canonicalizeJson({
        moduleId,
        provider,
        upstreamId
      })
    ),
    provider,
    typedInputs: {},
    upstreamId
  });
  return BasInjectSchema.parse({
    actionRef: { moduleId, pin },
    channel:
      kind === "email" || kind === "tabletop" ? "synthetic_canary" : undefined,
    dependsOn: dependsOnFromRaw(record.inject_depends_on),
    expectedObservation: expectedObservationFromRaw(record.inject_expectations),
    kind,
    scheduledAt: scheduledAtFromRaw(record, originAt),
    stepKey: record.inject_id,
    targetRef
  });
}

function rawInjectList(record: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(record.scenario_injects)) {
    return record.scenario_injects;
  }
  if (Array.isArray(record.injects)) {
    return record.injects;
  }
  return null;
}

export function importBasInjects(raw: unknown): ImportBasInjectsResult {
  if (hasExecutedCoverageClaim(raw)) {
    return denyImport(
      "inject_executed_coverage_forbidden",
      BAS_INJECT_PRODUCT_COPY.executedCoverageForbidden
    );
  }
  if (hasLiveVendorSaaSClaim(raw)) {
    return denyImport(
      "inject_live_vendor_forbidden",
      BAS_INJECT_PRODUCT_COPY.liveVendorDenied
    );
  }

  if (Array.isArray(raw)) {
    return importBasInjects({ injects: raw });
  }

  const record = asRecord(raw);
  if (!record) {
    return denyImport(
      "inject_import_invalid",
      BAS_INJECT_PRODUCT_COPY.importInvalid
    );
  }

  const originAt =
    typeof record.originAt === "string" &&
    !Number.isNaN(Date.parse(record.originAt))
      ? new Date(record.originAt).toISOString()
      : BAS_INJECT_IMPORT_ORIGIN_DEFAULT;

  const list = rawInjectList(record);
  if (!list || list.length === 0) {
    return denyImport(
      "inject_import_invalid",
      BAS_INJECT_PRODUCT_COPY.importInvalid
    );
  }

  const injects: BasInject[] = [];
  for (const entry of list) {
    if (isBasInjectShape(entry)) {
      const parsed = BasInjectSchema.safeParse(entry);
      if (!parsed.success) {
        return denyImport(
          "inject_import_invalid",
          BAS_INJECT_PRODUCT_COPY.importInvalid
        );
      }
      injects.push(parsed.data);
      continue;
    }
    const normalized = normalizeVendorInject(entry, originAt);
    if (!normalized) {
      const orphan = asRecord(entry);
      if (orphan && typeof orphan.inject_id === "string") {
        return denyImport(
          "inject_target_required",
          BAS_INJECT_PRODUCT_COPY.whoRequired
        );
      }
      return denyImport(
        "inject_import_invalid",
        BAS_INJECT_PRODUCT_COPY.importInvalid
      );
    }
    injects.push(normalized);
  }

  return ImportBasInjectsSuccessSchema.parse({
    executed: false,
    injects,
    jobsQueued: 0,
    liveSupported: false,
    ok: true
  });
}
