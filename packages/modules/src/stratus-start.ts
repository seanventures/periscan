import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import {
  STRATUS_MAX_SELECTED_TECHNIQUES,
  STRATUS_MODULE_ID,
  StratusAccountKindSchema,
  StratusResourceBudgetSchema,
  StratusTechniqueIdSchema
} from "@periscan/shared";

/**
 * Qualified Stratus start helper. W1 D may still be adding the modules
 * adapter; if that file is missing this no-ops to deny. Eval (not detonate)
 * may queue only when startable + disposable account + budget + cleanup.
 * liveSupported stays false. Customer production and cloud destroy stay denied.
 */

export const STRATUS_QUALIFIED_START_LIVE_SUPPORTED = false as const;

export const STRATUS_MODULES_ADAPTER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "stratus-red-team.ts"
);

export function isStratusModulesAdapterPresent(): boolean {
  return existsSync(STRATUS_MODULES_ADAPTER_PATH);
}

export const StratusQualifiedStartRequestSchema = z.strictObject({
  accountKind: StratusAccountKindSchema,
  adapterPresent: z.boolean().optional(),
  cleanupVerificationRequired: z.boolean(),
  customerCloudDestructionAllowed: z.boolean().optional().default(false),
  resourceBudget: StratusResourceBudgetSchema.optional(),
  startable: z.boolean(),
  techniqueIds: z
    .array(StratusTechniqueIdSchema)
    .max(STRATUS_MAX_SELECTED_TECHNIQUES)
    .optional()
});
export type StratusQualifiedStartRequest = z.infer<
  typeof StratusQualifiedStartRequestSchema
>;

export const StratusQualifiedStartCodeSchema = z.enum([
  "stratus_adapter_missing",
  "stratus_not_startable",
  "stratus_customer_account_forbidden",
  "stratus_budget_required",
  "stratus_techniques_required",
  "stratus_cleanup_verification_required",
  "stratus_customer_destruction_forbidden",
  "stratus_invalid_request",
  "stratus_eval_queued"
]);
export type StratusQualifiedStartCode = z.infer<
  typeof StratusQualifiedStartCodeSchema
>;

export const StratusQualifiedStartResultSchema = z.object({
  accountKindAccepted: z.boolean(),
  action: z.enum(["eval", "deny"]),
  adapterPresent: z.boolean(),
  allowed: z.boolean(),
  cleanupVerificationRequired: z.literal(true),
  code: StratusQualifiedStartCodeSchema,
  customerCloudDestruction: z.literal(false),
  detonate: z.literal(false),
  jobsQueued: z.number().int().nonnegative(),
  liveSupported: z.literal(false),
  moduleId: z.literal(STRATUS_MODULE_ID),
  rationale: z.string().min(1),
  resourceBudgetAccepted: z.boolean(),
  resourcesDestroyed: z.literal(0),
  selectedTechniqueIds: z.array(StratusTechniqueIdSchema),
  startable: z.boolean()
});
export type StratusQualifiedStartResult = z.infer<
  typeof StratusQualifiedStartResultSchema
>;

function readOptionalBoolean(
  input: unknown,
  key: string
): boolean | undefined {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return undefined;
  }
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : undefined;
}

function deny(input: {
  accountKindAccepted?: boolean;
  adapterPresent: boolean;
  code: Exclude<StratusQualifiedStartCode, "stratus_eval_queued">;
  rationale: string;
  resourceBudgetAccepted?: boolean;
  selectedTechniqueIds?: string[];
  startable: boolean;
}): StratusQualifiedStartResult {
  return StratusQualifiedStartResultSchema.parse({
    accountKindAccepted: input.accountKindAccepted ?? false,
    action: "deny",
    adapterPresent: input.adapterPresent,
    allowed: false,
    cleanupVerificationRequired: true,
    code: input.code,
    customerCloudDestruction: false,
    detonate: false,
    jobsQueued: 0,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    rationale: input.rationale,
    resourceBudgetAccepted: input.resourceBudgetAccepted ?? false,
    resourcesDestroyed: 0,
    selectedTechniqueIds: input.selectedTechniqueIds ?? [],
    startable: input.startable
  });
}

function denialCodeFromSchemaPaths(paths: string[]): Exclude<
  StratusQualifiedStartCode,
  "stratus_eval_queued"
> {
  if (paths.some((path) => path.startsWith("techniqueIds"))) {
    return "stratus_techniques_required";
  }
  if (paths.some((path) => path.startsWith("resourceBudget"))) {
    return "stratus_budget_required";
  }
  return "stratus_invalid_request";
}

export function startStratusQualifiedEval(
  input: unknown
): StratusQualifiedStartResult {
  const parsed = StratusQualifiedStartRequestSchema.safeParse(input);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join("."));
    return deny({
      adapterPresent:
        readOptionalBoolean(input, "adapterPresent") ??
        isStratusModulesAdapterPresent(),
      code: denialCodeFromSchemaPaths(paths),
      rationale:
        "Stratus qualified start request is incomplete. A startable pin, disposable authorized account, resource budget, selected techniques, and cleanup verification are required. Detonate is not queued.",
      startable: readOptionalBoolean(input, "startable") === true
    });
  }

  const request = parsed.data;
  const adapterPresent =
    request.adapterPresent ?? isStratusModulesAdapterPresent();
  const selectedTechniqueIds = request.techniqueIds ?? [];

  if (!adapterPresent) {
    return deny({
      adapterPresent: false,
      code: "stratus_adapter_missing",
      rationale:
        "Stratus modules adapter is not present. Qualified start no-ops to deny; eval is not queued.",
      selectedTechniqueIds,
      startable: request.startable
    });
  }

  if (request.startable !== true) {
    return deny({
      adapterPresent: true,
      code: "stratus_not_startable",
      rationale:
        "Stratus pin is not startable. Denied tasks are never queued.",
      selectedTechniqueIds,
      startable: false
    });
  }

  if (request.accountKind !== "disposable_authorized") {
    return deny({
      adapterPresent: true,
      code: "stratus_customer_account_forbidden",
      rationale:
        "Stratus evaluation is limited to disposable authorized accounts. Customer production accounts are forbidden.",
      selectedTechniqueIds,
      startable: true
    });
  }

  if (request.customerCloudDestructionAllowed) {
    return deny({
      accountKindAccepted: true,
      adapterPresent: true,
      code: "stratus_customer_destruction_forbidden",
      rationale:
        "Customer cloud resource destruction is forbidden. Qualified start does not detonate or destroy cloud resources.",
      resourceBudgetAccepted: request.resourceBudget !== undefined,
      selectedTechniqueIds,
      startable: true
    });
  }

  if (request.cleanupVerificationRequired !== true) {
    return deny({
      accountKindAccepted: true,
      adapterPresent: true,
      code: "stratus_cleanup_verification_required",
      rationale:
        "Cleanup verification is required before any Stratus evaluation.",
      resourceBudgetAccepted: request.resourceBudget !== undefined,
      selectedTechniqueIds,
      startable: true
    });
  }

  if (request.resourceBudget === undefined) {
    return deny({
      accountKindAccepted: true,
      adapterPresent: true,
      code: "stratus_budget_required",
      rationale:
        "An explicit resource budget is required before Stratus evaluation can be queued.",
      selectedTechniqueIds,
      startable: true
    });
  }

  if (selectedTechniqueIds.length === 0) {
    return deny({
      accountKindAccepted: true,
      adapterPresent: true,
      code: "stratus_techniques_required",
      rationale:
        "Selected technique ids are required. Wildcards and empty catalogs are rejected.",
      resourceBudgetAccepted: true,
      startable: true
    });
  }

  return StratusQualifiedStartResultSchema.parse({
    accountKindAccepted: true,
    action: "eval",
    adapterPresent: true,
    allowed: true,
    cleanupVerificationRequired: true,
    code: "stratus_eval_queued",
    customerCloudDestruction: false,
    detonate: false,
    jobsQueued: selectedTechniqueIds.length,
    liveSupported: STRATUS_QUALIFIED_START_LIVE_SUPPORTED,
    moduleId: STRATUS_MODULE_ID,
    rationale:
      "Start gate is startable. Queued Stratus eval for selected techniques in a disposable authorized account with a resource budget and required cleanup verification. liveSupported remains false. Customer cloud destruction is forbidden.",
    resourceBudgetAccepted: true,
    resourcesDestroyed: 0,
    selectedTechniqueIds,
    startable: true
  });
}
