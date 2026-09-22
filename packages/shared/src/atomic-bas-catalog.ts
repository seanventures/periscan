import { z } from "zod";

/** Current catalog rows describe dry-run Atomic content. Execution eligibility is a separate adapter qualification. */
export const BasAtomicScenarioExecutionModeSchema = z.literal("dry-run");

export const BasAtomicScenarioCatalogItemSchema = z.object({
  description: z.string().min(1),
  executionMode: BasAtomicScenarioExecutionModeSchema,
  liveExecutionDisabled: z.literal(true),
  liveExecutionLabel: z.literal("live execution disabled"),
  moduleId: z.literal("atomic.control_validation_safe"),
  name: z.string().min(1),
  scenarioId: z.string().min(1),
  source: z.literal("atomic-red-team"),
  spdxLicenseId: z.literal("MIT"),
  tactic: z.string().min(1),
  techniqueId: z.string().min(1)
});

export type BasAtomicScenarioCatalogItem = z.infer<
  typeof BasAtomicScenarioCatalogItemSchema
>;

export const BasAtomicScenarioRunExecutionModeSchema = z.enum([
  "dry-run",
  "live"
]);

export const BasAtomicScenarioRunInputSchema = z.object({
  controlSourceId: z.string().uuid().optional(),
  dryRun: z.boolean().optional(),
  executionMode: BasAtomicScenarioRunExecutionModeSchema.default("live")
});

export type BasAtomicScenarioRunInput = z.infer<
  typeof BasAtomicScenarioRunInputSchema
>;

export const BasAtomicScenarioRunResultSchema = z.object({
  allowed: z.boolean(),
  code: z.string().min(1),
  executionMode: BasAtomicScenarioRunExecutionModeSchema,
  jobsQueued: z.literal(0),
  liveExecutionDisabled: z.literal(true),
  rationale: z.string().min(1),
  scenarioId: z.string().min(1),
  techniqueId: z.string().min(1)
});

export type BasAtomicScenarioRunResult = z.infer<
  typeof BasAtomicScenarioRunResultSchema
>;

export const AtomicActivityKindSchema = z.enum([
  "catalog_import",
  "content_preview",
  "content_registry",
  "dry_run_module",
  "customer_live_start",
  "local_lab_qualification"
]);
export type AtomicActivityKind = z.infer<typeof AtomicActivityKindSchema>;

export const AtomicActivityAccountingSchema = z.object({
  countedAsExecution: z.literal(false),
  countedAsLocalLabQualification: z.boolean(),
  jobsQueued: z.literal(0),
  liveSupported: z.literal(false)
});
export type AtomicActivityAccounting = z.infer<
  typeof AtomicActivityAccountingSchema
>;

/** Imports, denied live starts, and lab receipts are never customer executions. */
export function classifyAtomicActivity(
  kind: AtomicActivityKind
): AtomicActivityAccounting {
  return AtomicActivityAccountingSchema.parse({
    countedAsExecution: false,
    countedAsLocalLabQualification: kind === "local_lab_qualification",
    jobsQueued: 0,
    liveSupported: false
  });
}

export function denyLiveAtomicCustomerStart(input: {
  scenarioId: string;
  techniqueId: string;
}): BasAtomicScenarioRunResult {
  return BasAtomicScenarioRunResultSchema.parse({
    allowed: false,
    code: "atomic_live_disabled",
    executionMode: "live",
    jobsQueued: 0,
    liveExecutionDisabled: true,
    rationale:
      "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
    scenarioId: input.scenarioId,
    techniqueId: input.techniqueId
  });
}

const ATOMIC_LAB_ARGV = ["/bin/hostname", "/bin/env", "/bin/date"] as const;

export const AtomicLabArgvSchema = z
  .array(z.enum(ATOMIC_LAB_ARGV))
  .length(1)
  .refine((argv) => argv[0]?.startsWith("/bin/"), {
    message: "Atomic lab argv must be an allowlisted absolute binary."
  });

export const AtomicLabSourcePinSchema = z.object({
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourcePath: z.string().min(1),
  sourceRevision: z.string().min(1)
});

export const AtomicLabPrerequisitesSchema = z.object({
  dockerUnixSocket: z.literal(true),
  elevationRequired: z.literal(false),
  pinnedImageMustBePresent: z.literal(true),
  yamlDependencies: z.literal(false),
  yamlInputArguments: z.literal(false)
});

export const AtomicLabCleanupSchema = z.object({
  requiredAfterCreate: z.literal(true),
  strategy: z.literal("remove_labelled_container"),
  yamlCleanupCommand: z.literal(false)
});

export const AtomicLabExpectedTelemetrySchema = z.object({
  detection: z.literal("NotMeasured"),
  observerRequired: z.literal(false),
  processName: z.enum(["hostname", "env", "date"]),
  techniqueId: z.string().min(1)
});

export const AtomicLabTypedInputsSchema = z.strictObject({});

export const AtomicLabAdapterBindingSchema = z.object({
  argv: AtomicLabArgvSchema,
  cleanup: AtomicLabCleanupSchema,
  customerLiveSupported: z.boolean(),
  expectedTelemetry: AtomicLabExpectedTelemetrySchema,
  guid: z.uuid(),
  image: z.string().min(1),
  labOnly: z.boolean(),
  name: z.string().min(1),
  os: z.literal("linux"),
  prerequisites: AtomicLabPrerequisitesSchema,
  queueable: z.boolean(),
  scenarioId: z
    .string()
    .regex(
      /^atomic:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    ),
  sourcePin: AtomicLabSourcePinSchema,
  techniqueId: z.string().min(1),
  typedInputs: AtomicLabTypedInputsSchema
});
export type AtomicLabAdapterBinding = z.infer<
  typeof AtomicLabAdapterBindingSchema
>;

export const AtomicLabReceiptExecutionSchema = z
  .object({
    exitCode: z.number().int().nullable(),
    expectedOutputMatched: z.boolean(),
    status: z.enum([
      "NotStarted",
      "Completed",
      "Failed",
      "TimedOut",
      "Cancelled",
      "OutputLimitExceeded"
    ]),
    stdoutBytes: z.number().int().nonnegative(),
    stdoutSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
  })
  .strict();

export const AtomicLabReceiptSchema = z.object({
  cleanup: z.enum(["NotRequired", "Verified", "Failed"]),
  completedAt: z.iso.datetime(),
  containerName: z.string().min(1),
  countedAsCustomerExecution: z.literal(false),
  customerLiveSupported: z.literal(false),
  detection: z.literal("NotMeasured"),
  execution: AtomicLabReceiptExecutionSchema,
  guid: z.uuid(),
  image: z.string().min(1),
  kind: z.literal("AtomicLocalLabQualification"),
  planSha256: z.string().regex(/^[a-f0-9]{64}$/),
  policyDecision: z.object({
    outcome: z.enum(["Allowed", "Denied"]),
    reason: z.string().min(1),
    scope: z.literal("DisposableLocalContainer")
  }),
  qualification: z.enum(["Passed", "Failed"]),
  runId: z.uuid(),
  scenarioId: z.string().min(1),
  sourceRevision: z.string().min(1),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceVerified: z.boolean(),
  startedAt: z.iso.datetime()
});
export type AtomicLabReceiptContract = z.infer<typeof AtomicLabReceiptSchema>;
