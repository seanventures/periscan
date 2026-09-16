import { z } from "zod";

import {
  AssetSchema,
  AssetValuationInputSchema,
  FinancialExposureEstimateSchema
} from "./domain";

const TimestampSchema = z.iso.datetime();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const BusinessImpactScenarioIdSchema = z.enum([
  "availability-disruption",
  "confidentiality-loss",
  "third-party-interruption",
  "custom"
]);

export const BusinessImpactSourceTypeSchema = z.enum([
  "CustomerEstimate",
  "FinanceModel",
  "InsuranceAssessment",
  "IncidentHistory",
  "ContractOrSla",
  "RegulatoryAnalysis",
  "Other"
]);

export const BusinessImpactSourceSchema = z
  .object({
    asOfDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/u, "Expected an ISO date (YYYY-MM-DD)."),
    note: z.string().trim().min(3).max(1_000),
    owner: z.string().trim().min(2).max(200),
    reference: z.string().trim().min(3).max(500),
    sourceType: BusinessImpactSourceTypeSchema
  })
  .strict();

export const BusinessImpactScenarioSchema = z
  .object({
    description: z.string().min(1),
    name: z.string().min(1),
    questionPrompts: z.array(z.string().min(1)).min(2),
    scenarioId: BusinessImpactScenarioIdSchema,
    sourceSuggestions: z.array(BusinessImpactSourceTypeSchema).min(1)
  })
  .strict();

export const BUSINESS_IMPACT_SCENARIOS = [
  {
    description:
      "Estimate the business effect of an outage or material service degradation.",
    name: "Availability disruption",
    questionPrompts: [
      "Which revenue, productivity, response, and recovery costs belong in the loss range?",
      "What evidence supports the outage frequency and the restoration window?"
    ],
    scenarioId: "availability-disruption",
    sourceSuggestions: ["ContractOrSla", "IncidentHistory", "FinanceModel"]
  },
  {
    description:
      "Estimate response, notification, recovery, contractual, and regulatory exposure from a confidentiality event.",
    name: "Confidentiality loss",
    questionPrompts: [
      "Which affected records, jurisdictions, contracts, and response activities are in scope?",
      "Which assumptions are legal or finance estimates rather than observed loss history?"
    ],
    scenarioId: "confidentiality-loss",
    sourceSuggestions: [
      "RegulatoryAnalysis",
      "InsuranceAssessment",
      "FinanceModel"
    ]
  },
  {
    description:
      "Estimate interruption exposure when a critical supplier or platform cannot deliver its service.",
    name: "Third-party interruption",
    questionPrompts: [
      "Which supplier obligations, workarounds, and dependent services define the loss range?",
      "Do contracts or incident records support the assumed frequency and recovery cost?"
    ],
    scenarioId: "third-party-interruption",
    sourceSuggestions: ["ContractOrSla", "IncidentHistory", "CustomerEstimate"]
  },
  {
    description:
      "Start from a blank, customer-defined scenario while retaining the same provenance and review controls.",
    name: "Custom scenario",
    questionPrompts: [
      "What loss event is being modeled, and what is explicitly outside its boundary?",
      "Which named sources support the frequency and magnitude ranges?"
    ],
    scenarioId: "custom",
    sourceSuggestions: ["CustomerEstimate", "Other"]
  }
] as const satisfies readonly z.input<typeof BusinessImpactScenarioSchema>[];

export const SubmitAssetValuationVersionInputSchema =
  AssetValuationInputSchema.extend({
    changeReason: z.string().trim().min(10).max(1_000),
    scenarioId: BusinessImpactScenarioIdSchema,
    sources: z.array(BusinessImpactSourceSchema).min(1).max(10)
  }).strict();

export const ReviewAssetValuationVersionInputSchema = z
  .object({
    decision: z.enum(["Approve", "Reject"]),
    reviewNote: z.string().trim().min(10).max(1_000),
    reviewReference: z.string().trim().min(3).max(500)
  })
  .strict();

export const AssetValuationVersionStatusSchema = z.enum([
  "PendingReview",
  "Approved",
  "Rejected",
  "Superseded"
]);

export const AssetValuationVersionSchema = z.object({
  annualizedLossExposureUsd: z.number().min(0),
  assetId: z.uuid(),
  assetName: z.string().min(1),
  changeReason: z.string().min(1),
  createdAt: TimestampSchema,
  createdBy: z.uuid(),
  input: SubmitAssetValuationVersionInputSchema,
  inputDigest: Sha256Schema,
  integrityVerified: z.boolean(),
  reviewNote: z.string().nullable(),
  reviewReference: z.string().nullable(),
  reviewedAt: TimestampSchema.nullable(),
  reviewedBy: z.uuid().nullable(),
  scenario: BusinessImpactScenarioSchema,
  sequence: z.number().int().positive(),
  status: AssetValuationVersionStatusSchema,
  supersededAt: TimestampSchema.nullable(),
  tenantId: z.uuid(),
  valuationVersionId: z.uuid()
});

export const BusinessImpactPreviewSchema = z.object({
  assetId: z.uuid(),
  estimate: FinancialExposureEstimateSchema,
  generatedAt: TimestampSchema,
  input: SubmitAssetValuationVersionInputSchema,
  scenario: BusinessImpactScenarioSchema
});

export const BusinessImpactAssetWorkspaceSchema = z.object({
  asset: AssetSchema,
  currentApprovedVersionId: z.uuid().nullable(),
  currentExposure: FinancialExposureEstimateSchema.nullable(),
  versions: z.array(AssetValuationVersionSchema)
});

export const BusinessImpactWorkspaceSchema = z.object({
  assets: z.array(BusinessImpactAssetWorkspaceSchema),
  generatedAt: TimestampSchema,
  limitations: z.array(z.string().min(1)).min(1),
  methodology: z.literal("FAIR-inspired PERT range estimate"),
  scenarios: z.array(BusinessImpactScenarioSchema).min(1),
  summary: z.object({
    approvedAssetCount: z.number().int().nonnegative(),
    assumptionBasedAnnualizedExposureUsd: z.number().nonnegative(),
    failedIntegrityCount: z.number().int().nonnegative(),
    pendingReviewCount: z.number().int().nonnegative(),
    valuedAssetCount: z.number().int().nonnegative()
  })
});

export type BusinessImpactScenarioId = z.infer<
  typeof BusinessImpactScenarioIdSchema
>;
export type BusinessImpactSource = z.infer<typeof BusinessImpactSourceSchema>;
export type BusinessImpactScenario = z.infer<
  typeof BusinessImpactScenarioSchema
>;
export type SubmitAssetValuationVersionInput = z.infer<
  typeof SubmitAssetValuationVersionInputSchema
>;
export type ReviewAssetValuationVersionInput = z.infer<
  typeof ReviewAssetValuationVersionInputSchema
>;
export type AssetValuationVersion = z.infer<typeof AssetValuationVersionSchema>;
export type BusinessImpactPreview = z.infer<typeof BusinessImpactPreviewSchema>;
export type BusinessImpactWorkspace = z.infer<
  typeof BusinessImpactWorkspaceSchema
>;
