import { z } from "zod";

/**
 * PERISCAN-587 Caldera operations adapter contracts.
 *
 * Pinned plugin/ability sets for a customer-managed isolated Caldera. This is
 * not a product runtime enablement: liveSupported/startable stay false and
 * denied live starts still queue nothing.
 */

export const PINNED_CALDERA_RELEASE = "v5.3.0" as const;
export const PINNED_CALDERA_API_VERSION = "v2" as const;
export const PINNED_CALDERA_PLANNER_ID = "atomic" as const;
export const PINNED_CALDERA_SOURCE_ID = "basic" as const;
export const PINNED_CALDERA_OBFUSCATOR = "plain-text" as const;

/** stockpile discovery: PowerShell version (T1082). */
export const PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID =
  "29451844-9b76-4e16-a9ee-d6feab4b24db" as const;
/** stockpile discovery: Print Working Directory (T1083). */
export const PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID =
  "6e1a53c0-7352-4899-be35-fa7f364d5722" as const;
/** stockpile discovery: Current User (T1033). */
export const PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID =
  "bd527b63-9f9e-46e0-9816-b8434d2b8989" as const;

export const CalderaAbilityReviewStatusSchema = z.enum([
  "Reviewed",
  "Unreviewed"
]);
export type CalderaAbilityReviewStatus = z.infer<
  typeof CalderaAbilityReviewStatusSchema
>;

export const CalderaPinnedPluginRoleSchema = z.enum(["abilities", "planner"]);
export type CalderaPinnedPluginRole = z.infer<
  typeof CalderaPinnedPluginRoleSchema
>;

export const CalderaPinnedPluginSchema = z.object({
  pluginId: z.string().min(1),
  reviewStatus: z.literal("Reviewed"),
  role: CalderaPinnedPluginRoleSchema
});
export type CalderaPinnedPlugin = z.infer<typeof CalderaPinnedPluginSchema>;

export const CalderaPinnedAbilitySchema = z.object({
  abilityId: z.string().min(1),
  executable: z.literal(false),
  name: z.string().min(1),
  pluginId: z.literal("stockpile"),
  reviewStatus: z.literal("Reviewed"),
  tactic: z.literal("discovery"),
  techniqueId: z.string().regex(/^T\d{4}(?:\.\d{3})?$/)
});
export type CalderaPinnedAbility = z.infer<typeof CalderaPinnedAbilitySchema>;

export const CalderaOperationStateSchema = z.enum([
  "paused",
  "running",
  "finished",
  "cleanup",
  "out_of_time",
  "cancelled"
]);
export type CalderaOperationState = z.infer<typeof CalderaOperationStateSchema>;

export const CalderaNormalizedStepStatusSchema = z.enum([
  "queued",
  "collected",
  "success",
  "failed",
  "discarded",
  "timeout",
  "cancelled"
]);
export type CalderaNormalizedStepStatus = z.infer<
  typeof CalderaNormalizedStepStatusSchema
>;

export const CalderaNormalizedStepSchema = z.object({
  abilityId: z.string().min(1),
  agentPaw: z.string().min(1).nullable(),
  name: z.string().min(1),
  pluginId: z.string().min(1),
  reviewStatus: z.literal("Reviewed"),
  status: CalderaNormalizedStepStatusSchema,
  techniqueId: z.string().min(1)
});
export type CalderaNormalizedStep = z.infer<typeof CalderaNormalizedStepSchema>;

export const CalderaNormalizedOperationSchema = z.object({
  adapterId: z.literal("caldera.operations.v1"),
  calderaRelease: z.literal(PINNED_CALDERA_RELEASE),
  cancelled: z.boolean(),
  evidenceProduced: z.literal(false),
  executable: z.literal(false),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false),
  operationId: z.string().min(1),
  operationName: z.string().min(1),
  queued: z.literal(false),
  startable: z.literal(false),
  state: CalderaOperationStateSchema,
  steps: z.array(CalderaNormalizedStepSchema)
});
export type CalderaNormalizedOperation = z.infer<
  typeof CalderaNormalizedOperationSchema
>;

export class CalderaAdapterError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CalderaAdapterError";
    this.code = code;
  }
}

const PINNED_PLUGINS: readonly CalderaPinnedPlugin[] = [
  {
    pluginId: "stockpile",
    reviewStatus: "Reviewed",
    role: "abilities"
  },
  {
    pluginId: "atomic",
    reviewStatus: "Reviewed",
    role: "planner"
  }
];

const PINNED_ABILITIES: readonly CalderaPinnedAbility[] = [
  {
    abilityId: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
    executable: false,
    name: "PowerShell version",
    pluginId: "stockpile",
    reviewStatus: "Reviewed",
    tactic: "discovery",
    techniqueId: "T1082"
  },
  {
    abilityId: PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
    executable: false,
    name: "Print Working Directory",
    pluginId: "stockpile",
    reviewStatus: "Reviewed",
    tactic: "discovery",
    techniqueId: "T1083"
  },
  {
    abilityId: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
    executable: false,
    name: "Current User",
    pluginId: "stockpile",
    reviewStatus: "Reviewed",
    tactic: "discovery",
    techniqueId: "T1033"
  }
];

const PINNED_ABILITY_BY_ID = new Map(
  PINNED_ABILITIES.map((ability) => [ability.abilityId, ability])
);

export function listPinnedCalderaPlugins(): CalderaPinnedPlugin[] {
  return PINNED_PLUGINS.map((plugin) =>
    CalderaPinnedPluginSchema.parse(plugin)
  );
}

export function listPinnedCalderaAbilities(): CalderaPinnedAbility[] {
  return PINNED_ABILITIES.map((ability) =>
    CalderaPinnedAbilitySchema.parse(ability)
  );
}

export function getPinnedCalderaAbility(
  abilityId: string
): CalderaPinnedAbility | undefined {
  const ability = PINNED_ABILITY_BY_ID.get(abilityId);
  return ability ? CalderaPinnedAbilitySchema.parse(ability) : undefined;
}

export function assertCalderaAbilitiesAllowlisted(abilityIds: string[]): void {
  if (abilityIds.length === 0) {
    throw new CalderaAdapterError(
      "ability_not_allowlisted",
      "Caldera operations require at least one reviewed allowlisted ability."
    );
  }
  const seen = new Set<string>();
  for (const abilityId of abilityIds) {
    if (seen.has(abilityId)) {
      continue;
    }
    seen.add(abilityId);
    if (!PINNED_ABILITY_BY_ID.has(abilityId)) {
      throw new CalderaAdapterError(
        "ability_not_allowlisted",
        "Unreviewed Caldera abilities cannot execute."
      );
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function mapLinkStatus(status: unknown): CalderaNormalizedStepStatus {
  if (status === 0) {
    return "success";
  }
  if (status === -2) {
    return "discarded";
  }
  if (status === -3) {
    return "collected";
  }
  if (status === -5) {
    return "timeout";
  }
  if (typeof status === "number" && status > 0) {
    return "failed";
  }
  return "queued";
}

function mapOperationState(
  state: unknown,
  cancelled: boolean
): CalderaOperationState {
  if (cancelled) {
    return "cancelled";
  }
  if (
    state === "paused" ||
    state === "running" ||
    state === "finished" ||
    state === "cleanup" ||
    state === "out_of_time"
  ) {
    return state;
  }
  return "paused";
}

export function normalizeCalderaOperation(input: {
  cancelled: boolean;
  operation: Record<string, unknown>;
}): CalderaNormalizedOperation {
  const operation = asRecord(input.operation);
  const planner = asRecord(operation.planner);
  const plannerId = readString(planner.id);
  if (plannerId && plannerId !== PINNED_CALDERA_PLANNER_ID) {
    throw new CalderaAdapterError(
      "planner_not_pinned",
      "Caldera operations must use the pinned atomic planner."
    );
  }

  const chain = Array.isArray(operation.chain) ? operation.chain : [];
  const steps: CalderaNormalizedStep[] = chain.map((entry) => {
    const link = asRecord(entry);
    const ability = asRecord(link.ability);
    const abilityId =
      readString(ability.ability_id) ?? readString(ability.id) ?? "";
    const pinned = getPinnedCalderaAbility(abilityId);
    if (!pinned) {
      throw new CalderaAdapterError(
        "ability_not_allowlisted",
        "Unreviewed Caldera abilities cannot execute."
      );
    }
    const pluginId = readString(ability.plugin) ?? pinned.pluginId;
    if (pluginId !== "stockpile") {
      throw new CalderaAdapterError(
        "plugin_not_pinned",
        "Caldera abilities must come from the pinned stockpile plugin."
      );
    }
    let status = mapLinkStatus(link.status);
    if (input.cancelled && status !== "success") {
      status = "cancelled";
    }
    return CalderaNormalizedStepSchema.parse({
      abilityId: pinned.abilityId,
      agentPaw: readString(link.paw) ?? null,
      name: readString(ability.name) ?? pinned.name,
      pluginId: pinned.pluginId,
      reviewStatus: "Reviewed",
      status,
      techniqueId: pinned.techniqueId
    });
  });

  return CalderaNormalizedOperationSchema.parse({
    adapterId: "caldera.operations.v1",
    calderaRelease: PINNED_CALDERA_RELEASE,
    cancelled: input.cancelled,
    evidenceProduced: false,
    executable: false,
    jobsQueued: 0,
    liveSupported: false,
    operationId: readString(operation.id) ?? "unknown",
    operationName: readString(operation.name) ?? "caldera-operation",
    queued: false,
    startable: false,
    state: mapOperationState(operation.state, input.cancelled),
    steps
  });
}
