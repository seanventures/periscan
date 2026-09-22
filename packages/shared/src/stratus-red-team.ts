import { z } from "zod";

/**
 * Stratus Red Team evaluation contracts (PERISCAN-591).
 * Disposable authorized accounts only. liveSupported stays false.
 * Customer cloud resource destruction is forbidden.
 */

export const STRATUS_MODULE_ID = "stratus.cloud_technique_eval" as const;
export const STRATUS_LIVE_SUPPORTED = false as const;
export const STRATUS_DEFAULT_ENABLED = false as const;
export const STRATUS_DEFAULT_SELECTED_TECHNIQUE_IDS = [] as const satisfies readonly string[];
export const STRATUS_CANDIDATE_TECHNIQUE_LIMIT = 8;
export const STRATUS_MAX_SELECTED_TECHNIQUES = 20;
export const STRATUS_SPDX_LICENSE_ID = "Apache-2.0" as const;

export const STRATUS_EVAL_DISCLAIMER =
  "Stratus Red Team evaluation is limited to disposable authorized accounts with explicit resource budgets, selected techniques, and cleanup verification. liveSupported is false; techniques are not enabled by default. Customer cloud resource destruction is forbidden.";

export const StratusPlatformSchema = z.enum([
  "aws",
  "azure",
  "gcp",
  "kubernetes"
]);
export type StratusPlatform = z.infer<typeof StratusPlatformSchema>;

export const StratusTechniqueIdSchema = z
  .string()
  .regex(/^(aws|azure|gcp|kubernetes|k8s)\.[a-z0-9-]+\.[a-z0-9-]+$/);
export type StratusTechniqueId = z.infer<typeof StratusTechniqueIdSchema>;

export const StratusAccountKindSchema = z.enum([
  "disposable_authorized",
  "customer_production"
]);
export type StratusAccountKind = z.infer<typeof StratusAccountKindSchema>;

export const StratusResourceBudgetSchema = z.object({
  maxDurationMinutes: z.number().int().positive().max(240),
  maxResources: z.number().int().positive().max(50),
  maxUsd: z.number().positive().max(500)
});
export type StratusResourceBudget = z.infer<typeof StratusResourceBudgetSchema>;

export const StratusEvalRequestSchema = z.strictObject({
  accountKind: StratusAccountKindSchema,
  cleanupVerificationRequired: z.boolean(),
  customerCloudDestructionAllowed: z.boolean().default(false),
  enabled: z.boolean().default(false),
  resourceBudget: StratusResourceBudgetSchema,
  techniqueIds: z
    .array(StratusTechniqueIdSchema)
    .min(1)
    .max(STRATUS_MAX_SELECTED_TECHNIQUES)
});
export type StratusEvalRequest = z.infer<typeof StratusEvalRequestSchema>;

export const StratusEvalDenialCodeSchema = z.enum([
  "stratus_live_disabled",
  "stratus_not_enabled",
  "stratus_customer_account_forbidden",
  "stratus_budget_required",
  "stratus_techniques_required",
  "stratus_cleanup_verification_required",
  "stratus_customer_destruction_forbidden",
  "stratus_invalid_request"
]);
export type StratusEvalDenialCode = z.infer<typeof StratusEvalDenialCodeSchema>;

export const StratusEvalResultSchema = z.object({
  allowed: z.literal(false),
  accountKindAccepted: z.boolean(),
  cleanupVerificationRequired: z.literal(true),
  code: StratusEvalDenialCodeSchema,
  customerCloudDestruction: z.literal(false),
  defaultEnabled: z.literal(false),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false),
  rationale: z.string().min(1),
  resourceBudgetAccepted: z.boolean(),
  resourcesDestroyed: z.literal(0),
  selectedTechniqueIds: z.array(StratusTechniqueIdSchema)
});
export type StratusEvalResult = z.infer<typeof StratusEvalResultSchema>;

export const StratusCandidateTechniqueSchema = z.object({
  accountKind: z.literal("disposable_authorized"),
  attackTechniqueIds: z
    .array(z.string().regex(/^T\d{4}(?:\.\d{3})?$/))
    .min(1)
    .max(8),
  cleanupVerificationRequired: z.literal(true),
  defaultEnabled: z.literal(false),
  description: z.string().min(1),
  enabled: z.literal(false),
  liveSupported: z.literal(false),
  moduleId: z.literal(STRATUS_MODULE_ID),
  name: z.string().min(1),
  platform: StratusPlatformSchema,
  source: z.literal("stratus-red-team"),
  spdxLicenseId: z.literal(STRATUS_SPDX_LICENSE_ID),
  techniqueId: StratusTechniqueIdSchema
});
export type StratusCandidateTechnique = z.infer<
  typeof StratusCandidateTechniqueSchema
>;

const STRATUS_CANDIDATE_TECHNIQUES = [
  {
    accountKind: "disposable_authorized",
    attackTechniqueIds: ["T1562.008"],
    cleanupVerificationRequired: true,
    defaultEnabled: false,
    description:
      "Candidate CloudTrail stop evaluation in a disposable authorized account. Not enabled by default.",
    enabled: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    name: "Stop CloudTrail Trail",
    platform: "aws",
    source: "stratus-red-team",
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID,
    techniqueId: "aws.defense-evasion.cloudtrail-stop"
  },
  {
    accountKind: "disposable_authorized",
    attackTechniqueIds: ["T1526"],
    cleanupVerificationRequired: true,
    defaultEnabled: false,
    description:
      "Candidate in-instance EC2 enumeration in a disposable authorized account. Not enabled by default.",
    enabled: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    name: "EC2 Enumerate From Instance",
    platform: "aws",
    source: "stratus-red-team",
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID,
    techniqueId: "aws.discovery.ec2-enumerate-from-instance"
  },
  {
    accountKind: "disposable_authorized",
    attackTechniqueIds: ["T1537"],
    cleanupVerificationRequired: true,
    defaultEnabled: false,
    description:
      "Candidate EBS snapshot share evaluation in a disposable authorized account. Not enabled by default.",
    enabled: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    name: "EC2 Share EBS Snapshot",
    platform: "aws",
    source: "stratus-red-team",
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID,
    techniqueId: "aws.exfiltration.ec2-share-ebs-snapshot"
  },
  {
    accountKind: "disposable_authorized",
    attackTechniqueIds: ["T1537"],
    cleanupVerificationRequired: true,
    defaultEnabled: false,
    description:
      "Candidate Compute disk share evaluation in a disposable authorized account. Not enabled by default.",
    enabled: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    name: "Share Compute Disk",
    platform: "gcp",
    source: "stratus-red-team",
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID,
    techniqueId: "gcp.exfiltration.share-compute-disk"
  },
  {
    accountKind: "disposable_authorized",
    attackTechniqueIds: ["T1059"],
    cleanupVerificationRequired: true,
    defaultEnabled: false,
    description:
      "Candidate VM custom-script evaluation in a disposable authorized account. Not enabled by default.",
    enabled: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    name: "VM Custom Script Extension",
    platform: "azure",
    source: "stratus-red-team",
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID,
    techniqueId: "azure.execution.vm-custom-script-extension"
  }
] as const;

export function listStratusCandidateTechniques(): StratusCandidateTechnique[] {
  return STRATUS_CANDIDATE_TECHNIQUES.map((item) =>
    StratusCandidateTechniqueSchema.parse(item)
  );
}

function stratusDeny(input: {
  accountKindAccepted?: boolean;
  code: StratusEvalDenialCode;
  rationale: string;
  resourceBudgetAccepted?: boolean;
  selectedTechniqueIds: string[];
}): StratusEvalResult {
  return StratusEvalResultSchema.parse({
    allowed: false,
    accountKindAccepted: input.accountKindAccepted ?? false,
    cleanupVerificationRequired: true,
    code: input.code,
    customerCloudDestruction: false,
    defaultEnabled: false,
    jobsQueued: 0,
    liveSupported: false,
    rationale: input.rationale,
    resourceBudgetAccepted: input.resourceBudgetAccepted ?? false,
    resourcesDestroyed: 0,
    selectedTechniqueIds: input.selectedTechniqueIds
  });
}

function denialCodeFromSchemaPaths(paths: string[]): StratusEvalDenialCode {
  if (paths.some((path) => path.startsWith("techniqueIds"))) {
    return "stratus_techniques_required";
  }
  if (paths.some((path) => path.startsWith("resourceBudget"))) {
    return "stratus_budget_required";
  }
  return "stratus_invalid_request";
}

export function evaluateStratusTechniqueEval(
  input: unknown
): StratusEvalResult {
  const parsed = StratusEvalRequestSchema.safeParse(input);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join("."));
    return stratusDeny({
      code: denialCodeFromSchemaPaths(paths),
      rationale:
        "Stratus evaluation request is incomplete. Selected techniques, a resource budget, a disposable authorized account, and cleanup verification are required.",
      selectedTechniqueIds: []
    });
  }

  const request = parsed.data;
  if (request.accountKind !== "disposable_authorized") {
    return stratusDeny({
      code: "stratus_customer_account_forbidden",
      rationale:
        "Stratus evaluation is limited to disposable authorized accounts. Customer production accounts are forbidden.",
      selectedTechniqueIds: request.techniqueIds
    });
  }
  if (request.customerCloudDestructionAllowed) {
    return stratusDeny({
      accountKindAccepted: true,
      code: "stratus_customer_destruction_forbidden",
      rationale: "Customer cloud resource destruction is forbidden.",
      resourceBudgetAccepted: true,
      selectedTechniqueIds: request.techniqueIds
    });
  }
  if (request.cleanupVerificationRequired !== true) {
    return stratusDeny({
      accountKindAccepted: true,
      code: "stratus_cleanup_verification_required",
      rationale:
        "Cleanup verification is required before any Stratus evaluation.",
      resourceBudgetAccepted: true,
      selectedTechniqueIds: request.techniqueIds
    });
  }
  if (request.enabled !== true) {
    return stratusDeny({
      accountKindAccepted: true,
      code: "stratus_not_enabled",
      rationale: "Stratus evaluation is not enabled by default.",
      resourceBudgetAccepted: true,
      selectedTechniqueIds: request.techniqueIds
    });
  }

  return stratusDeny({
    accountKindAccepted: true,
    code: "stratus_live_disabled",
    rationale:
      "Stratus adapter qualification is required. liveSupported remains false; live evaluation stays disabled. Denied tasks are never queued.",
    resourceBudgetAccepted: true,
    selectedTechniqueIds: request.techniqueIds
  });
}
