import { createHash } from "node:crypto";
import { z } from "zod";

import {
  denyReasonForLivePack,
  liveOffensivePackFromTarget,
  resolveBasScenarioStart,
  type BasLivePack
} from "./bas-control-plane";
import {
  PolicyDecisionOutcomeSchema,
  ValidationMissionSchema,
  ValidationRunSchema
} from "./domain";

const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const IdSchema = z.uuid();

export const BasCampaignProviderSchema = z.enum([
  "AtomicRedTeam",
  "Caldera",
  "ControlPlane"
]);
export type BasCampaignProvider = z.infer<typeof BasCampaignProviderSchema>;

export const BasCampaignTypedInputsSchema = z
  .record(
    z.string().min(1).max(64),
    z.union([z.string().max(512), z.number(), z.boolean()])
  )
  .refine((value) => Object.keys(value).length <= 20, {
    message: "typedInputs is limited to 20 keys."
  });
export type BasCampaignTypedInputs = z.infer<
  typeof BasCampaignTypedInputsSchema
>;

export const MAX_BAS_CAMPAIGN_DAG_NODES = 12;
export const MAX_BAS_CAMPAIGN_DAG_EDGES = 36;
export const BAS_CAMPAIGN_DAG_CYCLE_MESSAGE =
  "Campaign dependency graph contains a cycle. Compile fails closed.";
export const BAS_CAMPAIGN_DAG_TOO_LARGE_MESSAGE = `Campaign dependency graph is limited to ${MAX_BAS_CAMPAIGN_DAG_NODES} steps.`;

export const BasCampaignScenarioPinSchema = z.strictObject({
  provider: BasCampaignProviderSchema,
  contentSha256: Sha256HexSchema,
  upstreamId: z.string().min(1).max(128),
  stepKey: z.string().min(1).max(128).optional(),
  dependsOn: z.array(z.string().min(1).max(128)).max(11).default([]),
  typedInputs: BasCampaignTypedInputsSchema
});
export type BasCampaignScenarioPin = z.infer<
  typeof BasCampaignScenarioPinSchema
>;

export const BasCampaignDagEdgeSchema = z.strictObject({
  from: z.string().min(1).max(256),
  to: z.string().min(1).max(256)
});
export type BasCampaignDagEdge = z.infer<typeof BasCampaignDagEdgeSchema>;

export const BasCampaignDagSchema = z.strictObject({
  edges: z.array(BasCampaignDagEdgeSchema).max(MAX_BAS_CAMPAIGN_DAG_EDGES),
  executionOrder: z.array(z.string().min(1).max(256)).max(50),
  nodes: z.array(z.string().min(1).max(256)).max(50)
});
export type BasCampaignDag = z.infer<typeof BasCampaignDagSchema>;

export function campaignPinStepKey(pin: {
  stepKey?: string;
  upstreamId: string;
}): string {
  return pin.stepKey && pin.stepKey.length > 0 ? pin.stepKey : pin.upstreamId;
}

export function compileBasCampaignDag(
  pins: ReadonlyArray<{
    dependsOn?: readonly string[];
    stepKey?: string;
    upstreamId: string;
  }>
): { error: string; graph: null } | { error: null; graph: BasCampaignDag } {
  const keys = pins.map((pin) => campaignPinStepKey(pin));
  if (new Set(keys).size !== keys.length) {
    return { error: "Campaign step keys must be unique.", graph: null };
  }

  const keySet = new Set(keys);
  const edges: BasCampaignDagEdge[] = [];
  const indegree = new Map<string, number>(keys.map((key) => [key, 0]));
  const dependents = new Map<string, string[]>(keys.map((key) => [key, []]));

  for (const pin of pins) {
    const from = campaignPinStepKey(pin);
    for (const dependency of pin.dependsOn ?? []) {
      if (dependency === from || !keySet.has(dependency)) {
        return {
          error: keySet.has(dependency)
            ? BAS_CAMPAIGN_DAG_CYCLE_MESSAGE
            : `Campaign dependency ${dependency} is not a step in the plan.`,
          graph: null
        };
      }
      edges.push({ from, to: dependency });
      indegree.set(from, (indegree.get(from) ?? 0) + 1);
      dependents.get(dependency)!.push(from);
    }
  }

  if (
    (edges.length > 0 && keys.length > MAX_BAS_CAMPAIGN_DAG_NODES) ||
    edges.length > MAX_BAS_CAMPAIGN_DAG_EDGES
  ) {
    return { error: BAS_CAMPAIGN_DAG_TOO_LARGE_MESSAGE, graph: null };
  }

  const remaining = new Map(indegree);
  const ready = keys.filter((key) => remaining.get(key) === 0);
  const executionOrder: string[] = [];
  while (ready.length > 0) {
    const node = ready.shift()!;
    executionOrder.push(node);
    for (const dependent of dependents.get(node) ?? []) {
      const next = (remaining.get(dependent) ?? 0) - 1;
      remaining.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
      }
    }
  }
  if (executionOrder.length !== keys.length) {
    return { error: BAS_CAMPAIGN_DAG_CYCLE_MESSAGE, graph: null };
  }

  return {
    error: null,
    graph: BasCampaignDagSchema.parse({
      edges,
      executionOrder,
      nodes: keys
    })
  };
}

export const BasCampaignCleanupStatusSchema = z.enum([
  "pending",
  "succeeded",
  "failed",
  "not_required"
]);
export type BasCampaignCleanupStatus = z.infer<
  typeof BasCampaignCleanupStatusSchema
>;

export const BasCampaignCleanupPolicySchema = z.strictObject({
  onCancel: z.literal("request_then_record").default("request_then_record"),
  requireVerifiedCleanup: z.boolean().default(true)
});
export type BasCampaignCleanupPolicy = z.infer<
  typeof BasCampaignCleanupPolicySchema
>;

export const DEFAULT_BAS_CAMPAIGN_CLEANUP_POLICY: BasCampaignCleanupPolicy = {
  onCancel: "request_then_record",
  requireVerifiedCleanup: true
};

export const BasCampaignPlanSchema = z.strictObject({
  basCampaignPlanId: IdSchema,
  tenantId: IdSchema,
  scopeId: IdSchema,
  scopeVersion: z.string().min(1).max(64),
  scopeVerificationStatus: z.string().min(1).max(64),
  runnerId: IdSchema.nullable(),
  contentVersionIds: z.array(IdSchema).max(50),
  scenarioPins: z.array(BasCampaignScenarioPinSchema).min(1).max(50),
  dependencyGraph: BasCampaignDagSchema.default({
    edges: [],
    executionOrder: [],
    nodes: []
  }),
  policyDecisionId: IdSchema,
  approvalDigest: Sha256HexSchema,
  compiledDigest: Sha256HexSchema,
  cleanupPolicy: BasCampaignCleanupPolicySchema,
  startable: z.boolean(),
  createdAt: z.iso.datetime()
});
export type BasCampaignPlan = z.infer<typeof BasCampaignPlanSchema>;

export const CompileBasCampaignInputSchema = z
  .strictObject({
    scopeId: IdSchema,
    contentVersionIds: z.array(IdSchema).max(50).default([]),
    scenarioPins: z
      .array(
        z.strictObject({
          provider: BasCampaignProviderSchema,
          contentSha256: Sha256HexSchema.optional(),
          upstreamId: z.string().min(1).max(128),
          stepKey: z.string().min(1).max(128).optional(),
          dependsOn: z.array(z.string().min(1).max(128)).max(11).default([]),
          typedInputs: BasCampaignTypedInputsSchema.default({}),
          contentVersionId: IdSchema.optional()
        })
      )
      .min(1)
      .max(50),
    runnerId: IdSchema.optional(),
    cleanupPolicy: BasCampaignCleanupPolicySchema.optional()
  })
  .superRefine((value, context) => {
    const dag = compileBasCampaignDag(value.scenarioPins);
    if (dag.error) {
      context.addIssue({
        code: "custom",
        message: dag.error,
        path: ["scenarioPins"]
      });
    }
  });
export type CompileBasCampaignInput = z.input<
  typeof CompileBasCampaignInputSchema
>;

export const CompileBasCampaignResultSchema = z.strictObject({
  plan: BasCampaignPlanSchema,
  startable: z.boolean(),
  queued: z.literal(false),
  jobsQueued: z.literal(0),
  denyReason: z.string().min(1).nullable()
});
export type CompileBasCampaignResult = z.infer<
  typeof CompileBasCampaignResultSchema
>;

export const StartBasCampaignInputSchema = z.strictObject({
  compiledDigest: Sha256HexSchema,
  dangerAckDigest: z.string().min(16).optional(),
  dangerAcknowledged: z.boolean().optional()
});
export type StartBasCampaignInput = z.infer<typeof StartBasCampaignInputSchema>;

export const StartBasCampaignResultSchema = z
  .strictObject({
    compiledDigest: Sha256HexSchema,
    campaignPlanId: IdSchema,
    outcome: PolicyDecisionOutcomeSchema,
    denyReason: z.string().min(1).nullable(),
    jobsQueued: z.number().int().nonnegative(),
    queued: z.boolean(),
    mission: ValidationMissionSchema.nullable(),
    policyDecisionId: IdSchema,
    rationale: z.string().min(1),
    startable: z.boolean(),
    runs: z.array(ValidationRunSchema)
  })
  .refine(
    (result) =>
      result.outcome === "Allowed" ||
      (result.jobsQueued === 0 && result.queued === false),
    { message: "Denied BAS campaign starts must never queue jobs." }
  );
export type StartBasCampaignResult = z.infer<
  typeof StartBasCampaignResultSchema
>;

export const BasCampaignCleanupReceiptSchema = z.strictObject({
  adapter: BasCampaignProviderSchema,
  outputHash: Sha256HexSchema,
  receiptSha256: Sha256HexSchema,
  status: z.enum(["succeeded", "failed"]),
  stepKey: z.string().min(1).max(256),
  verifiedAt: z.iso.datetime()
});
export type BasCampaignCleanupReceipt = z.infer<
  typeof BasCampaignCleanupReceiptSchema
>;

export const CancelBasCampaignInputSchema = z.strictObject({
  compiledDigest: Sha256HexSchema,
  cleanupReceipts: z
    .array(BasCampaignCleanupReceiptSchema)
    .max(MAX_BAS_CAMPAIGN_DAG_NODES)
    .default([])
});
export type CancelBasCampaignInput = z.input<
  typeof CancelBasCampaignInputSchema
>;

export const BasCampaignStepCleanupSchema = z
  .strictObject({
    stepKey: z.string().min(1).max(256),
    status: BasCampaignCleanupStatusSchema,
    detail: z.string().min(1).max(1000).nullable(),
    receiptSha256: Sha256HexSchema.nullable().default(null),
    outputHash: Sha256HexSchema.nullable().default(null),
    verifiedAt: z.iso.datetime().nullable().default(null)
  })
  .refine((row) => row.status !== "succeeded" || Boolean(row.receiptSha256), {
    message: "Cleanup status succeeded requires an adapter receipt hash."
  });
export type BasCampaignStepCleanup = z.infer<
  typeof BasCampaignStepCleanupSchema
>;

export function resolveBasCampaignStepCleanup(input: {
  delayed: boolean;
  dispatched: boolean;
  receipt?: BasCampaignCleanupReceipt | null;
  stepKey: string;
}): BasCampaignStepCleanup {
  if (input.receipt) {
    return BasCampaignStepCleanupSchema.parse({
      detail:
        input.receipt.status === "succeeded"
          ? "Adapter cleanup receipt recorded."
          : "Adapter cleanup receipt recorded as failed.",
      outputHash: input.receipt.outputHash,
      receiptSha256: input.receipt.receiptSha256,
      status: input.receipt.status,
      stepKey: input.stepKey,
      verifiedAt: input.receipt.verifiedAt
    });
  }
  if (!input.dispatched) {
    return BasCampaignStepCleanupSchema.parse({
      detail: null,
      outputHash: null,
      receiptSha256: null,
      status: "not_required",
      stepKey: input.stepKey,
      verifiedAt: null
    });
  }
  return BasCampaignStepCleanupSchema.parse({
    detail: input.delayed
      ? "Runner task still leased; cancel requested. Cleanup is pending until an adapter receipt is recorded."
      : "Cancel requested; cleanup is pending until an adapter receipt is recorded.",
    outputHash: null,
    receiptSha256: null,
    status: "pending",
    stepKey: input.stepKey,
    verifiedAt: null
  });
}

export const CancelBasCampaignResultSchema = z.strictObject({
  compiledDigest: Sha256HexSchema,
  dispatchPrevented: z.literal(true),
  cancelRequested: z.boolean(),
  cancelCompleted: z.boolean(),
  delayedCancel: z.boolean(),
  mission: ValidationMissionSchema.nullable(),
  cleanup: z.array(BasCampaignStepCleanupSchema)
});
export type CancelBasCampaignResult = z.infer<
  typeof CancelBasCampaignResultSchema
>;

export const BasCampaignPreviewSchema = z.strictObject({
  plan: BasCampaignPlanSchema,
  policyOutcome: PolicyDecisionOutcomeSchema,
  policyRationale: z.string().min(1),
  denyReason: z.string().min(1).nullable(),
  missionId: IdSchema.nullable(),
  dispatchPrevented: z.boolean(),
  cancelledAt: z.iso.datetime().nullable(),
  cleanup: z.array(BasCampaignStepCleanupSchema),
  jobsQueued: z.number().int().nonnegative()
});
export type BasCampaignPreview = z.infer<typeof BasCampaignPreviewSchema>;

export const BasCampaignListSchema = z.strictObject({
  items: z.array(BasCampaignPreviewSchema).max(50)
});
export type BasCampaignList = z.infer<typeof BasCampaignListSchema>;

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)])
    );
  }
  return value;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export type BasCampaignPinRef = {
  contentSha256?: string;
  dependsOn?: readonly string[];
  provider: BasCampaignProvider;
  stepKey?: string;
  typedInputs?: BasCampaignTypedInputs;
  upstreamId: string;
};

export interface BasCampaignCanonicalPayload {
  tenantId: string;
  scopeId: string;
  scopeVersion: string;
  scopeVerificationStatus: string;
  runnerId: string | null;
  contentVersionIds: string[];
  scenarioPins: readonly BasCampaignPinRef[];
  cleanupPolicy: BasCampaignCleanupPolicy;
}

export function campaignCompiledDigest(
  input: BasCampaignCanonicalPayload
): string {
  const pins = [...input.scenarioPins]
    .map((pin) =>
      BasCampaignScenarioPinSchema.parse({
        ...pin,
        dependsOn: [...(pin.dependsOn ?? [])].sort(),
        stepKey: campaignPinStepKey(pin),
        typedInputs: pin.typedInputs ?? {}
      })
    )
    .sort((left, right) => {
      const provider = left.provider.localeCompare(right.provider);
      if (provider !== 0) {
        return provider;
      }
      const step = campaignPinStepKey(left).localeCompare(
        campaignPinStepKey(right)
      );
      if (step !== 0) {
        return step;
      }
      const upstream = left.upstreamId.localeCompare(right.upstreamId);
      if (upstream !== 0) {
        return upstream;
      }
      return left.contentSha256.localeCompare(right.contentSha256);
    });
  return sha256Hex(
    canonicalizeJson({
      cleanupPolicy: BasCampaignCleanupPolicySchema.parse(input.cleanupPolicy),
      contentVersionIds: [...input.contentVersionIds].sort(),
      runnerId: input.runnerId,
      scenarioPins: pins,
      scopeId: input.scopeId,
      scopeVerificationStatus: input.scopeVerificationStatus,
      scopeVersion: input.scopeVersion,
      tenantId: input.tenantId
    })
  );
}

export function campaignApprovalDigest(input: {
  policyDecisionId: string;
  outcome: string;
  expiresAt: string | null;
  compiledDigest: string;
}): string {
  return sha256Hex(
    canonicalizeJson({
      compiledDigest: input.compiledDigest,
      expiresAt: input.expiresAt,
      outcome: input.outcome,
      policyDecisionId: input.policyDecisionId
    })
  );
}

export const BasQualifiableLivePackSchema = z.enum([
  "atomic",
  "caldera",
  "metasploit"
]);
export type BasQualifiableLivePack = z.infer<
  typeof BasQualifiableLivePackSchema
>;

export const BasPackQualificationSchema = z.strictObject({
  pack: BasQualifiableLivePackSchema,
  pinIds: z.array(z.string().min(1).max(128)).min(1).max(50),
  labReceiptHash: Sha256HexSchema,
  qualifiedAt: z.iso.datetime()
});
export type BasPackQualification = z.infer<typeof BasPackQualificationSchema>;

export const QualifyBasPackInputSchema = z.strictObject({
  pack: BasQualifiableLivePackSchema,
  pinIds: z.array(z.string().min(1).max(128)).min(1).max(50),
  labReceiptHash: Sha256HexSchema
});
export type QualifyBasPackInput = z.infer<typeof QualifyBasPackInputSchema>;

export const StoredBasPackQualificationSchema =
  BasPackQualificationSchema.extend({
    basPackQualificationId: IdSchema,
    qualifiedByUserId: IdSchema,
    tenantId: IdSchema
  });
export type StoredBasPackQualification = z.infer<
  typeof StoredBasPackQualificationSchema
>;

export const QualifyBasPackResultSchema = z.strictObject({
  created: z.boolean(),
  qualification: StoredBasPackQualificationSchema
});
export type QualifyBasPackResult = z.infer<typeof QualifyBasPackResultSchema>;

export const TenantBasPackAuthorizationSchema = z.strictObject({
  tenantId: IdSchema,
  pack: BasQualifiableLivePackSchema,
  scopeId: IdSchema,
  approver: IdSchema,
  digest: Sha256HexSchema,
  expiresAt: z.iso.datetime()
});
export type TenantBasPackAuthorization = z.infer<
  typeof TenantBasPackAuthorizationSchema
>;

export const AuthorizeBasPackInputSchema = z.strictObject({
  pack: BasQualifiableLivePackSchema,
  scopeId: IdSchema,
  expiresAt: z.iso.datetime()
});
export type AuthorizeBasPackInput = z.infer<typeof AuthorizeBasPackInputSchema>;

export const StoredTenantBasPackAuthorizationSchema =
  TenantBasPackAuthorizationSchema.extend({
    tenantBasPackAuthorizationId: IdSchema
  });
export type StoredTenantBasPackAuthorization = z.infer<
  typeof StoredTenantBasPackAuthorizationSchema
>;

export const AuthorizeBasPackResultSchema = z.strictObject({
  authorization: StoredTenantBasPackAuthorizationSchema,
  created: z.boolean()
});
export type AuthorizeBasPackResult = z.infer<
  typeof AuthorizeBasPackResultSchema
>;

export function tenantBasPackAuthorizationDigest(input: {
  approver: string;
  expiresAt: string;
  pack: BasQualifiableLivePack;
  scopeId: string;
  tenantId: string;
}): string {
  return sha256Hex(
    canonicalizeJson({
      approver: input.approver,
      expiresAt: input.expiresAt,
      pack: input.pack,
      scopeId: input.scopeId,
      tenantId: input.tenantId
    })
  );
}

export const BAS_FORBIDDEN_PIN_DENY_REASON =
  "No remaining hard-forbidden BAS pin classes; High-danger pins need extra acknowledgement. Denied tasks are never queued.";

export const BAS_DANGER_ACK_DENY_REASON =
  "High-danger class (T1486 / ransomware / unscoped spray / credential harvest / persistence / unrestricted Metasploit PAYLOAD) requires extra acknowledgement plus qualification and tenant authorization. Denied tasks are never queued.";

export function livePackFromCampaignPin(pin: {
  provider: string;
  upstreamId: string;
}): Exclude<BasLivePack, "none"> | "none" {
  if (pin.provider === "AtomicRedTeam") {
    return "atomic";
  }
  if (pin.provider === "Caldera") {
    return "caldera";
  }
  return (
    liveOffensivePackFromTarget({
      scenarioId: pin.upstreamId
    }) ?? "none"
  );
}

export function livePackFromCampaignPins(
  pins: ReadonlyArray<
    { provider: string; upstreamId: string } & Record<string, unknown>
  >
): Exclude<BasLivePack, "none"> | "none" {
  for (const pin of pins) {
    const pack = livePackFromCampaignPin(pin);
    if (pack !== "none") {
      return pack;
    }
  }
  return "none";
}

export function moduleIdForBasCampaignPin(pin: {
  provider: string;
  upstreamId: string;
}): string | null {
  const pack = livePackFromCampaignPin(pin);
  if (pack === "atomic") {
    return "atomic.control_validation_safe";
  }
  if (pack === "caldera") {
    return "caldera.advanced_adversarial";
  }
  if (pack === "metasploit") {
    return "exploit.metasploit_check";
  }
  if (pin.provider !== "ControlPlane") {
    return null;
  }
  try {
    return resolveBasScenarioStart({
      scenarioId: pin.upstreamId,
      scopeId: "00000000-0000-4000-8000-000000000000"
    }).moduleId;
  } catch {
    return null;
  }
}

function pinText(pin: BasCampaignPinRef): string {
  return [
    pin.upstreamId,
    pin.stepKey ?? "",
    JSON.stringify(pin.typedInputs ?? {})
  ]
    .join(" ")
    .toLowerCase();
}

export function forbiddenBasCampaignPinClass(
  _pin: BasCampaignPinRef
): string | null {
  return null;
}

export function dangerBasCampaignPinClass(
  pin: BasCampaignPinRef
): string | null {
  const haystack = pinText(pin);
  const inputs = pin.typedInputs ?? {};
  if (inputs.persistence === true) {
    return "persistence";
  }
  if (livePackFromCampaignPin(pin) === "metasploit") {
    const payload = inputs.PAYLOAD ?? inputs.payload;
    if (typeof payload === "string" && payload.length > 0) {
      return "metasploit_payload";
    }
  }
  if (/\bt1486\b/u.test(haystack) || haystack.includes("ransomware")) {
    return "ransomware";
  }
  if (inputs.credentialTheft === true) {
    return "credential_harvest";
  }
  const spray =
    /\bt1110\b/u.test(haystack) ||
    haystack.includes("password spray") ||
    haystack.includes("internet spray") ||
    inputs.spray === true;
  if (spray) {
    const identity =
      typeof inputs.verifiedScopeIdentity === "string" &&
      inputs.verifiedScopeIdentity.length > 0;
    if (inputs.ownedAccount !== true || !identity) {
      return "unscoped_spray";
    }
  }
  return null;
}

function qualificationCoversPin(
  qualification: BasPackQualification,
  pin: BasCampaignPinRef,
  pack: Exclude<BasLivePack, "none">
): boolean {
  if (qualification.pack !== pack) {
    return false;
  }
  const ids = new Set(qualification.pinIds);
  return ids.has(pin.upstreamId) || ids.has(campaignPinStepKey(pin));
}

function authorizationCoversPack(input: {
  authorization: TenantBasPackAuthorization;
  now: Date;
  pack: Exclude<BasLivePack, "none">;
  scopeId?: string;
  tenantId?: string;
}): boolean {
  const authorization = input.authorization;
  if (authorization.pack !== input.pack) {
    return false;
  }
  if (input.tenantId && authorization.tenantId !== input.tenantId) {
    return false;
  }
  if (input.scopeId && authorization.scopeId !== input.scopeId) {
    return false;
  }
  if (Date.parse(authorization.expiresAt) <= input.now.getTime()) {
    return false;
  }
  return (
    authorization.digest ===
    tenantBasPackAuthorizationDigest({
      approver: authorization.approver,
      expiresAt: authorization.expiresAt,
      pack: authorization.pack,
      scopeId: authorization.scopeId,
      tenantId: authorization.tenantId
    })
  );
}

export type BasCampaignStartGateInput = {
  authorizations?: readonly TenantBasPackAuthorization[];
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  now?: Date | string;
  pins: ReadonlyArray<BasCampaignPinRef>;
  policyOutcome?: string | null;
  qualifications?: readonly BasPackQualification[];
  scopeId?: string;
  tenantId?: string;
};

function resolveStartGateNow(now?: Date | string): Date {
  if (!now) {
    return new Date();
  }
  return now instanceof Date ? now : new Date(now);
}

export function livePinPassesStartGate(
  pin: BasCampaignPinRef,
  input: BasCampaignStartGateInput
): { denyReason: string | null; startable: boolean } {
  if (forbiddenBasCampaignPinClass(pin)) {
    return {
      denyReason: BAS_FORBIDDEN_PIN_DENY_REASON,
      startable: false
    };
  }
  if (dangerBasCampaignPinClass(pin)) {
    if (!input.dangerAcknowledged || !input.dangerAckDigest) {
      return {
        denyReason: BAS_DANGER_ACK_DENY_REASON,
        startable: false
      };
    }
  }
  const pack = livePackFromCampaignPin(pin);
  if (pack === "none") {
    return { denyReason: null, startable: true };
  }
  const now = resolveStartGateNow(input.now);
  const qualified = (input.qualifications ?? []).some((qualification) =>
    qualificationCoversPin(qualification, pin, pack)
  );
  const authorized = (input.authorizations ?? []).some((authorization) =>
    authorizationCoversPack({
      authorization,
      now,
      pack,
      scopeId: input.scopeId,
      tenantId: input.tenantId
    })
  );
  if (!qualified || !authorized) {
    return {
      denyReason: denyReasonForLivePack(pack),
      startable: false
    };
  }
  if (input.policyOutcome != null && input.policyOutcome !== "Allowed") {
    return {
      denyReason: denyReasonForLivePack(pack),
      startable: false
    };
  }
  return { denyReason: null, startable: true };
}

const UNREVIEWED_CAMPAIGN_DENY_REASON =
  "Unreviewed BAS content cannot execute. Campaign start is denied and jobs are not queued.";

export function evaluateBasCampaignStartability(input: {
  authorizations?: readonly TenantBasPackAuthorization[];
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  hasUnreviewedContent?: boolean;
  now?: Date | string;
  pins: ReadonlyArray<BasCampaignPinRef>;
  policyOutcome?: string | null;
  qualifications?: readonly BasPackQualification[];
  runnerStatus: string | null;
  scopeId?: string;
  scopeVerified: boolean;
  tenantId?: string;
}): { startable: boolean; denyReason: string | null } {
  if (!input.scopeVerified) {
    return {
      denyReason: "Verified scope is required before a BAS campaign can start.",
      startable: false
    };
  }
  if (input.hasUnreviewedContent) {
    return {
      denyReason: UNREVIEWED_CAMPAIGN_DENY_REASON,
      startable: false
    };
  }
  if (
    input.runnerStatus != null &&
    input.runnerStatus !== "Active" &&
    input.runnerStatus !== "Degraded"
  ) {
    return {
      denyReason: `Bound runner is ${input.runnerStatus}; campaign start is denied.`,
      startable: false
    };
  }

  for (const pin of input.pins) {
    const gate = livePinPassesStartGate(pin, input);
    if (!gate.startable) {
      return gate;
    }
    const pack = livePackFromCampaignPin(pin);
    if (pack !== "none") {
      continue;
    }
    if (dangerBasCampaignPinClass(pin) && input.dangerAcknowledged) {
      continue;
    }
    if (pin.provider !== "ControlPlane") {
      return {
        denyReason: UNREVIEWED_CAMPAIGN_DENY_REASON,
        startable: false
      };
    }
    const resolved = resolveBasScenarioStart({
      scenarioId: pin.upstreamId,
      scopeId: "00000000-0000-4000-8000-000000000000"
    });
    if (!resolved.queueable) {
      return {
        denyReason:
          resolved.denyReason ??
          "BAS campaign pin is not queueable. Denied tasks are never queued.",
        startable: false
      };
    }
  }

  return { denyReason: null, startable: true };
}

export type BasCampaignStartWalkPin = {
  moduleId: string;
  stepKey: string;
  upstreamId: string;
};

export type BasCampaignStartWalk = {
  denyReason: string | null;
  failClosed: boolean;
  queuedPins: BasCampaignStartWalkPin[];
  skippedStepKeys: string[];
};

export function walkBasCampaignStartPins(input: {
  authorizations?: readonly TenantBasPackAuthorization[];
  dangerAckDigest?: string;
  dangerAcknowledged?: boolean;
  executionOrder?: readonly string[];
  hasUnreviewedContent?: boolean;
  now?: Date | string;
  pins: ReadonlyArray<BasCampaignPinRef>;
  policyOutcome?: string | null;
  qualifications?: readonly BasPackQualification[];
  scopeId?: string;
  tenantId?: string;
}): BasCampaignStartWalk {
  const pins = [...input.pins];
  const allKeys = pins.map((pin) => campaignPinStepKey(pin));
  const failClosed = (denyReason: string): BasCampaignStartWalk => ({
    denyReason,
    failClosed: true,
    queuedPins: [],
    skippedStepKeys: allKeys
  });

  if (input.hasUnreviewedContent) {
    return failClosed(UNREVIEWED_CAMPAIGN_DENY_REASON);
  }

  for (const pin of pins) {
    const gate = livePinPassesStartGate(pin, input);
    if (!gate.startable) {
      return failClosed(
        gate.denyReason ??
          "BAS campaign pin is not startable. Denied tasks are never queued."
      );
    }
  }

  const pinByKey = new Map(
    pins.map((pin) => [campaignPinStepKey(pin), pin] as const)
  );
  const dag = compileBasCampaignDag(pins);
  const fromInput = (input.executionOrder ?? []).filter((key) =>
    pinByKey.has(key)
  );
  const fromDag = dag.graph?.executionOrder ?? allKeys;
  const seen = new Set<string>();
  const order: string[] = [];
  for (const key of [...fromInput, ...fromDag]) {
    if (seen.has(key) || !pinByKey.has(key)) {
      continue;
    }
    seen.add(key);
    order.push(key);
  }

  const walked = order.slice(0, MAX_BAS_CAMPAIGN_DAG_NODES);
  const skippedStepKeys = order.slice(MAX_BAS_CAMPAIGN_DAG_NODES);
  const queuedPins: BasCampaignStartWalkPin[] = [];

  for (const stepKey of walked) {
    const pin = pinByKey.get(stepKey);
    if (!pin) {
      skippedStepKeys.push(stepKey);
      continue;
    }
    const pack = livePackFromCampaignPin(pin);
    if (pack !== "none") {
      const moduleId = moduleIdForBasCampaignPin(pin);
      if (!moduleId) {
        skippedStepKeys.push(stepKey);
        continue;
      }
      queuedPins.push({
        moduleId,
        stepKey,
        upstreamId: pin.upstreamId
      });
      continue;
    }
    if (pin.provider !== "ControlPlane") {
      skippedStepKeys.push(stepKey);
      continue;
    }
    try {
      const resolved = resolveBasScenarioStart({
        scenarioId: pin.upstreamId,
        scopeId: "00000000-0000-4000-8000-000000000000"
      });
      if (!resolved.queueable) {
        skippedStepKeys.push(stepKey);
        continue;
      }
      queuedPins.push({
        moduleId: resolved.moduleId,
        stepKey,
        upstreamId: resolved.scenarioId
      });
    } catch {
      skippedStepKeys.push(stepKey);
    }
  }

  if (queuedPins.length === 0) {
    return failClosed(
      "BAS campaign has no startable pins. Denied tasks are never queued."
    );
  }

  return {
    denyReason: null,
    failClosed: false,
    queuedPins,
    skippedStepKeys
  };
}

export function deniedBasCampaignStart(input: {
  compiledDigest: string;
  campaignPlanId: string;
  policyDecisionId: string;
  rationale: string;
  startable?: boolean;
  outcome?: z.infer<typeof PolicyDecisionOutcomeSchema>;
}): StartBasCampaignResult {
  return StartBasCampaignResultSchema.parse({
    campaignPlanId: input.campaignPlanId,
    compiledDigest: input.compiledDigest,
    denyReason: input.rationale,
    jobsQueued: 0,
    mission: null,
    outcome: input.outcome ?? "Denied",
    policyDecisionId: input.policyDecisionId,
    queued: false,
    rationale: input.rationale,
    runs: [],
    startable: input.startable ?? false
  });
}
