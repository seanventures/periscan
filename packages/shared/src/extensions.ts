import { z } from "zod";

import {
  ExtensionCompatibilityReportSchema,
  ExtensionExecutionContractSchema
} from "./agent-trust";

const TimestampSchema = z.iso.datetime();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const SemverSchema = z
  .string()
  .trim()
  .regex(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/u,
    "Use a semantic version such as 1.0.0 or 1.0.0-rc.1."
  );

export const ExtensionProjectStatusSchema = z.enum(["Active", "Archived"]);
export const ExtensionReleaseStatusSchema = z.enum([
  "CompatibilityFailed",
  "Compatible",
  "Rejected",
  "Certified",
  "CatalogActive",
  "Superseded",
  "Revoked"
]);

export const CreateExtensionProjectInputSchema = z
  .object({
    description: z.string().trim().min(10).max(1_000),
    displayName: z.string().trim().min(2).max(120),
    licenseSpdx: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9-.+]{0,79}$/u),
    packageName: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9-]{1,62}$/u),
    repositoryUrl: z.url().max(500),
    supportUrl: z.url().max(500)
  })
  .strict();

export const ExtensionProjectSchema = z.object({
  activeReleaseId: z.uuid().nullable(),
  createdAt: TimestampSchema,
  createdBy: z.uuid(),
  description: z.string(),
  displayName: z.string(),
  extensionProjectId: z.uuid(),
  licenseSpdx: z.string(),
  packageName: z.string(),
  repositoryUrl: z.url(),
  status: ExtensionProjectStatusSchema,
  supportUrl: z.url(),
  tenantId: z.uuid(),
  updatedAt: TimestampSchema
});

export const SubmitExtensionReleaseInputSchema = z
  .object({
    contract: ExtensionExecutionContractSchema,
    version: SemverSchema
  })
  .strict();

export const ReviewExtensionReleaseInputSchema = z
  .object({
    decision: z.enum(["Certify", "Reject"]),
    reason: z.string().trim().min(10).max(1_000)
  })
  .strict();

export const ExtensionLifecycleReasonInputSchema = z
  .object({ reason: z.string().trim().min(10).max(1_000) })
  .strict();

export const RollbackExtensionProjectInputSchema = z
  .object({
    reason: z.string().trim().min(10).max(1_000),
    targetReleaseId: z.uuid()
  })
  .strict();

export const ExtensionReleaseSchema = z.object({
  activatedAt: TimestampSchema.nullable(),
  activatedBy: z.uuid().nullable(),
  activationReason: z.string().nullable(),
  capabilities: z.array(z.string()),
  certifiedAt: TimestampSchema.nullable(),
  certifiedBy: z.uuid().nullable(),
  certificationReason: z.string().nullable(),
  compatible: z.boolean(),
  compatibilityReport: ExtensionCompatibilityReportSchema,
  contract: ExtensionExecutionContractSchema,
  contractDigest: Sha256Schema,
  createdAt: TimestampSchema,
  createdBy: z.uuid(),
  executionAuthorized: z.literal(false),
  extensionProjectId: z.uuid(),
  extensionReleaseId: z.uuid(),
  imageDigest: z.string(),
  imageReference: z.string(),
  networkAllowlist: z.array(z.string()),
  revokedAt: TimestampSchema.nullable(),
  revokedBy: z.uuid().nullable(),
  revocationReason: z.string().nullable(),
  signerIdentity: z.string(),
  signerPublicKeySha256: Sha256Schema,
  status: ExtensionReleaseStatusSchema,
  tenantId: z.uuid(),
  updatedAt: TimestampSchema,
  version: SemverSchema
});

export const ExtensionDeveloperWorkspaceSchema = z.object({
  generatedAt: TimestampSchema,
  projects: z.array(ExtensionProjectSchema),
  releases: z.array(ExtensionReleaseSchema),
  summary: z.object({
    activeCatalogReleases: z.number().int().nonnegative(),
    certifiedReleases: z.number().int().nonnegative(),
    compatibilityFailures: z.number().int().nonnegative(),
    projects: z.number().int().nonnegative(),
    revokedReleases: z.number().int().nonnegative(),
    runtimeExecutionAuthorized: z.literal(0)
  })
});

export const ExtensionScaffoldFileSchema = z.object({
  content: z.string(),
  contentSha256: Sha256Schema,
  path: z.string().min(1),
  purpose: z.string().min(1)
});

export const ExtensionScaffoldSchema = z.object({
  commands: z.array(z.string().min(1)),
  doesNotExecute: z.literal(true),
  files: z.array(ExtensionScaffoldFileSchema).min(1),
  generatedAt: TimestampSchema,
  packageName: z.string(),
  safetyNotes: z.array(z.string().min(1)),
  scaffoldVersion: z.literal("1.0")
});

export type CreateExtensionProjectInput = z.infer<
  typeof CreateExtensionProjectInputSchema
>;
export type ExtensionDeveloperWorkspace = z.infer<
  typeof ExtensionDeveloperWorkspaceSchema
>;
export type ExtensionLifecycleReasonInput = z.infer<
  typeof ExtensionLifecycleReasonInputSchema
>;
export type ExtensionProject = z.infer<typeof ExtensionProjectSchema>;
export type ExtensionRelease = z.infer<typeof ExtensionReleaseSchema>;
export type ExtensionScaffold = z.infer<typeof ExtensionScaffoldSchema>;
export type ReviewExtensionReleaseInput = z.infer<
  typeof ReviewExtensionReleaseInputSchema
>;
export type RollbackExtensionProjectInput = z.infer<
  typeof RollbackExtensionProjectInputSchema
>;
export type SubmitExtensionReleaseInput = z.infer<
  typeof SubmitExtensionReleaseInputSchema
>;
