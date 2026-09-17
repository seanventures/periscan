import { z } from "zod";

import { ConfidentialAttestationSchema } from "./agent-trust";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const TeeAssuranceProviderSchema = z.enum([
  "ArmPSA",
  "ArmCCA",
  "AMDSEVSNP",
  "TPM"
]);

export const TeeAssuranceVerifierTypeSchema = z.literal("Veraison");

export const TeeAssuranceDecisionTypeSchema = z.enum([
  "Qualified",
  "Rejected",
  "Revoked"
]);

export const TeeAssuranceStatusSchema = z.enum([
  "AwaitingEvidence",
  "Qualified",
  "Rejected",
  "Revoked",
  "Expired"
]);

export const CreateTeeAssuranceRequirementInputSchema = z
  .object({
    authorizationReason: z.string().trim().min(10).max(1_000),
    escalationReference: z.string().trim().min(3).max(240),
    evidenceMediaType: z
      .string()
      .trim()
      .min(3)
      .max(240)
      .nullable()
      .default(null),
    expectedMeasurement: Sha256Schema.nullable().default(null),
    expectedRegion: z.string().trim().min(2).max(120).nullable().default(null),
    maxAttestationAgeMinutes: z.number().int().min(1).max(1_440).default(10),
    policyReference: z.string().trim().min(3).max(240),
    provider: TeeAssuranceProviderSchema,
    qualificationValidityMinutes: z
      .number()
      .int()
      .min(5)
      .max(10_080)
      .default(60),
    requireDebugDisabled: z.boolean().default(false),
    requireSecureBoot: z.boolean().default(false),
    scopeId: z.uuid(),
    supportOwner: z.string().trim().min(3).max(160),
    verifierType: TeeAssuranceVerifierTypeSchema,
    workloadId: z.string().trim().min(3).max(240)
  })
  .strict();

export const EvaluateTeeAssuranceInputSchema = z
  .object({
    attestationId: z.uuid(),
    decisionReason: z.string().trim().min(10).max(1_000),
    decisionReference: z.string().trim().min(3).max(240)
  })
  .strict();

export const RevokeTeeAssuranceInputSchema = z
  .object({
    decisionReason: z.string().trim().min(10).max(1_000),
    decisionReference: z.string().trim().min(3).max(240)
  })
  .strict();

export const TeeAssuranceDecisionSchema = z.object({
  attestationCheckedAt: z.iso.datetime(),
  attestationId: z.uuid(),
  attestationRawClaimsHash: Sha256Schema,
  attestationResultClaimsHash: Sha256Schema.nullable(),
  decidedAt: z.iso.datetime(),
  decidedBy: z.uuid(),
  decisionReason: z.string(),
  decisionReference: z.string(),
  decisionType: TeeAssuranceDecisionTypeSchema,
  findings: z.array(z.string()),
  qualifiedUntil: z.iso.datetime().nullable(),
  teeAssuranceDecisionId: z.uuid(),
  teeAssuranceRequirementId: z.uuid(),
  tenantId: z.uuid()
});

export const TeeAssuranceRequirementSchema = z.object({
  authorizationReason: z.string(),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
  escalationReference: z.string(),
  evidenceMediaType: z.string().nullable(),
  expectedMeasurement: Sha256Schema.nullable(),
  expectedRegion: z.string().nullable(),
  latestDecision: TeeAssuranceDecisionSchema.nullable(),
  maxAttestationAgeMinutes: z.number().int().min(1),
  policyDecisionId: z.uuid(),
  policyReference: z.string(),
  provider: TeeAssuranceProviderSchema,
  qualificationValidityMinutes: z.number().int().min(5),
  requireDebugDisabled: z.boolean(),
  requireSecureBoot: z.boolean(),
  scopeId: z.uuid(),
  status: TeeAssuranceStatusSchema,
  supportOwner: z.string(),
  teeAssuranceRequirementId: z.uuid(),
  tenantId: z.uuid(),
  verifierType: TeeAssuranceVerifierTypeSchema,
  workloadId: z.string()
});

export const TeeAssuranceScopeSchema = z.object({
  scopeId: z.uuid(),
  scopeType: z.string(),
  value: z.string(),
  verificationStatus: z.string()
});

export const TeeAssuranceWorkspaceSchema = z.object({
  assurances: z.array(TeeAssuranceRequirementSchema),
  attestations: z.array(ConfidentialAttestationSchema),
  qualificationRulesVersion: z.literal("1.0"),
  scopes: z.array(TeeAssuranceScopeSchema)
});

export type CreateTeeAssuranceRequirementInput = z.infer<
  typeof CreateTeeAssuranceRequirementInputSchema
>;
export type EvaluateTeeAssuranceInput = z.infer<
  typeof EvaluateTeeAssuranceInputSchema
>;
export type RevokeTeeAssuranceInput = z.infer<
  typeof RevokeTeeAssuranceInputSchema
>;
export type TeeAssuranceProvider = z.infer<typeof TeeAssuranceProviderSchema>;
export type TeeAssuranceDecision = z.infer<typeof TeeAssuranceDecisionSchema>;
export type TeeAssuranceRequirement = z.infer<
  typeof TeeAssuranceRequirementSchema
>;
export type TeeAssuranceWorkspace = z.infer<typeof TeeAssuranceWorkspaceSchema>;
