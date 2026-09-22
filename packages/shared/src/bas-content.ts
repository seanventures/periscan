import { z } from "zod";

export const BAS_CONTENT_MAX_BYTES = 256 * 1024;
export const BAS_CONTENT_MAX_SCENARIOS = 200;
export const BasContentProviderSchema = z.enum(["AtomicRedTeam", "Caldera"]);
export const BasContentReviewStatusSchema = z.enum(["Unreviewed", "Reviewed"]);
export type BasContentReviewStatus = z.infer<
  typeof BasContentReviewStatusSchema
>;

export const BasContentPreviewInputSchema = z.strictObject({
  provider: BasContentProviderSchema,
  format: z.enum(["yaml", "json"]),
  sourceRevision: z.string().trim().min(1).max(128),
  content: z.string().min(1).max(BAS_CONTENT_MAX_BYTES)
});
export type BasContentPreviewInput = z.infer<
  typeof BasContentPreviewInputSchema
>;

/** Authoring metadata, not a new finding, verdict, or executable task. */
export const BasScenarioPreviewSchema = z.strictObject({
  scenarioId: z.string().min(1).max(256),
  upstreamId: z.string().min(1).max(128),
  name: z.string().trim().min(1).max(512),
  techniqueIds: z
    .array(z.string().regex(/^T\d{4}(?:\.\d{3})?$/))
    .min(1)
    .max(20),
  platforms: z.array(z.string().min(1).max(64)).min(1).max(20),
  executors: z.array(z.string().min(1).max(64)).min(1).max(20),
  hasPrerequisites: z.boolean(),
  hasCleanup: z.boolean(),
  reviewStatus: BasContentReviewStatusSchema,
  executable: z.literal(false)
});
export type BasScenarioPreview = z.infer<typeof BasScenarioPreviewSchema>;

export const BasContentPreviewSchema = z.strictObject({
  provider: BasContentProviderSchema,
  sourceRevision: z.string().min(1).max(128),
  provenance: z.literal("UserSuppliedUnverified"),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  scenarios: z
    .array(BasScenarioPreviewSchema)
    .min(1)
    .max(BAS_CONTENT_MAX_SCENARIOS),
  executable: z.literal(false),
  evidenceProduced: z.literal(false)
});
export type BasContentPreview = z.infer<typeof BasContentPreviewSchema>;

/** Logical upstream path, never read as a local file or fetched as a URL. */
export const BasContentSourcePathSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*$/);

export const RegisterBasContentInputSchema =
  BasContentPreviewInputSchema.extend({
    sourcePath: BasContentSourcePathSchema
  });
export type RegisterBasContentInput = z.infer<
  typeof RegisterBasContentInputSchema
>;

export const BasContentVersionSummarySchema = z.strictObject({
  basContentVersionId: z.uuid(),
  tenantId: z.uuid(),
  provider: BasContentProviderSchema,
  sourceRevision: z.string().min(1).max(128),
  sourcePath: BasContentSourcePathSchema,
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  scenarioCount: z.number().int().min(1).max(BAS_CONTENT_MAX_SCENARIOS),
  provenance: z.literal("UserSuppliedUnverified"),
  executable: z.literal(false),
  evidenceProduced: z.literal(false),
  reviewStatus: BasContentReviewStatusSchema.optional(),
  reviewedByUserId: z.uuid().nullable().optional(),
  reviewedAt: z.iso.datetime().nullable().optional(),
  registeredByUserId: z.uuid().nullable(),
  createdAt: z.iso.datetime()
});
export type BasContentVersionSummary = z.infer<
  typeof BasContentVersionSummarySchema
>;

export const BasContentVersionSchema = BasContentVersionSummarySchema.extend({
  preview: BasContentPreviewSchema
});
export type BasContentVersion = z.infer<typeof BasContentVersionSchema>;

export const RegisterBasContentResultSchema = z.strictObject({
  created: z.boolean(),
  version: BasContentVersionSchema
});
export type RegisterBasContentResult = z.infer<
  typeof RegisterBasContentResultSchema
>;

export const BasContentVersionFilterSchema = z.strictObject({
  provider: BasContentProviderSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  cursor: z.uuid().optional()
});
export type BasContentVersionFilter = z.infer<
  typeof BasContentVersionFilterSchema
>;

export const BasContentVersionListSchema = z.strictObject({
  items: z.array(BasContentVersionSummarySchema).max(50),
  nextCursor: z.uuid().nullable()
});
export type BasContentVersionList = z.infer<typeof BasContentVersionListSchema>;

/** Owner/Admin promotion. Does not set executable, liveSupported, or startable. */
export const PromoteBasContentInputSchema = z.strictObject({
  reviewStatus: z.literal("Reviewed")
});
export type PromoteBasContentInput = z.infer<
  typeof PromoteBasContentInputSchema
>;

export const PromoteBasContentResultSchema = z.strictObject({
  created: z.boolean(),
  version: BasContentVersionSchema
});
export type PromoteBasContentResult = z.infer<
  typeof PromoteBasContentResultSchema
>;
