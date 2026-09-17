import { z } from "zod";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const AgentProtocolSchema = z.enum(["MCP", "A2A"]);
export const AgentProtocolEndpointStatusSchema = z.enum([
  "PendingReview",
  "Approved",
  "Revoked"
]);

export const AgentTrustPolicySchema = z
  .object({
    allowedAudience: z.string().trim().min(1).max(240),
    maxCredentialTtlSeconds: z.number().int().min(30).max(3600).default(300),
    requireAgentDidCredential: z.boolean().default(false),
    requireSignedArtifacts: z.boolean().default(true),
    requireSpiffeIdentity: z.boolean().default(true)
  })
  .strict();

export const RegisterAgentProtocolEndpointInputSchema = z
  .object({
    endpointUrl: z.url().max(2_000),
    name: z.string().trim().min(2).max(160),
    protocol: AgentProtocolSchema,
    publicKeyPem: z.string().trim().min(100).max(20_000).nullable().optional(),
    trustPolicy: AgentTrustPolicySchema
  })
  .strict();

export const ReviewAgentProtocolEndpointInputSchema = z
  .object({
    allowedCapabilityNames: z
      .array(z.string().trim().min(1).max(160))
      .max(200)
      .default([]),
    reason: z.string().trim().min(10).max(1_000),
    status: z.enum(["Approved", "Revoked"])
  })
  .strict();

export const AgentProtocolCapabilitySchema = z.object({
  description: z.string().max(2_000).nullable(),
  inputSchemaHash: Sha256Schema.nullable(),
  name: z.string().min(1).max(160)
});

export const A2AAgentCardConformanceCheckSchema = z.object({
  checkId: z.string().min(1).max(120),
  message: z.string().min(1).max(2_000),
  status: z.enum(["Pass", "Warning", "Fail"])
});

export const A2AAgentCardConformanceReportSchema = z.object({
  agentName: z.string().max(160).nullable(),
  agentVersion: z.string().max(120).nullable(),
  cardHash: Sha256Schema,
  checkedAt: z.iso.datetime(),
  checks: z.array(A2AAgentCardConformanceCheckSchema).min(1).max(50),
  coreOperationsProbe: z.literal("NotRun"),
  preferredInterface: z
    .object({
      protocolBinding: z.string().min(1).max(240),
      protocolVersion: z.string().min(1).max(40),
      url: z.url().max(2_000)
    })
    .nullable(),
  signatureStatus: z.enum(["NotPresent", "PresentUnverified"]),
  specification: z.literal("A2A 1.0 Agent Card"),
  structurallyConformant: z.boolean()
});

export const AgentProtocolEndpointSchema = z.object({
  a2aConformance: A2AAgentCardConformanceReportSchema.nullable(),
  agentProtocolEndpointId: z.uuid(),
  allowedCapabilityNames: z.array(z.string()),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
  discoveredAt: z.iso.datetime().nullable(),
  discoveredCapabilities: z.array(AgentProtocolCapabilitySchema),
  endpointUrl: z.url(),
  hasPublicKey: z.boolean(),
  name: z.string().min(1),
  protocol: AgentProtocolSchema,
  reviewReason: z.string().nullable(),
  status: AgentProtocolEndpointStatusSchema,
  tenantId: z.uuid(),
  trustPolicy: AgentTrustPolicySchema,
  updatedAt: z.iso.datetime()
});

export const DiscoverAgentProtocolEndpointResultSchema = z.object({
  a2aConformance: A2AAgentCardConformanceReportSchema.nullable(),
  capabilities: z.array(AgentProtocolCapabilitySchema),
  discoveredAt: z.iso.datetime(),
  endpoint: AgentProtocolEndpointSchema,
  importedAutomatically: z.literal(false),
  protocol: AgentProtocolSchema
});

export const A2ATckTransportSchema = z.enum(["grpc", "jsonrpc", "http_json"]);
export const A2ATckRequirementLevelSchema = z.enum(["MUST", "SHOULD", "MAY"]);
export const A2ATckRequirementStatusSchema = z.enum([
  "PASS",
  "FAIL",
  "SKIPPED",
  "NOT_TESTED"
]);
export const RunA2ATckInputSchema = z
  .object({
    acknowledgeTestTraffic: z.literal(true),
    authorizationReason: z.string().trim().min(10).max(1_000),
    level: z.enum(["all", "must", "should", "may"]).default("must"),
    scopeId: z.uuid(),
    transports: z.array(A2ATckTransportSchema).min(1).max(3)
  })
  .strict();
export const A2ATckRequirementResultSchema = z.object({
  errors: z.array(z.string().min(1).max(1_000)).max(20),
  level: A2ATckRequirementLevelSchema,
  requirementId: z.string().min(1).max(160),
  status: A2ATckRequirementStatusSchema,
  transports: z.record(z.string(), z.enum(["PASS", "FAIL", "SKIPPED"]))
});
export const A2ATckTransportResultSchema = z.object({
  failed: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  transport: A2ATckTransportSchema
});
export const A2ATckRunSchema = z.object({
  a2aTckRunId: z.uuid(),
  agentProtocolEndpointId: z.uuid(),
  authorizationReason: z.string(),
  compatible: z.boolean(),
  completedAt: z.iso.datetime().nullable(),
  failureReason: z.string().nullable(),
  level: z.enum(["all", "must", "should", "may"]),
  mayCompatibility: z.number().min(0).max(100).nullable(),
  mustCompatibility: z.number().min(0).max(100).nullable(),
  overallCompatibility: z.number().min(0).max(100).nullable(),
  policyDecisionId: z.uuid(),
  reportHash: Sha256Schema.nullable(),
  requirementResults: z.array(A2ATckRequirementResultSchema).max(1_000),
  scopeId: z.uuid(),
  shouldCompatibility: z.number().min(0).max(100).nullable(),
  specVersion: z.string().max(120).nullable(),
  startedAt: z.iso.datetime(),
  status: z.enum(["Running", "Completed", "Failed", "DeniedByPolicy"]),
  tenantId: z.uuid(),
  toolVersion: z.string().min(1).max(120),
  transportResults: z.array(A2ATckTransportResultSchema).max(3),
  transports: z.array(A2ATckTransportSchema).min(1).max(3),
  triggeredBy: z.uuid()
});

export const AgentReceiptKindSchema = z.enum(["Task", "Message", "Artifact"]);

export const VerifyAgentSignedReceiptInputSchema = z
  .object({
    agentProtocolEndpointId: z.uuid(),
    agentVerifiableCredentialId: z.uuid().nullable().optional(),
    audience: z.string().trim().min(1).max(240),
    evidenceIds: z.array(z.uuid()).max(500).default([]),
    expiresAt: z.iso.datetime(),
    issuedAt: z.iso.datetime(),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{16,160}$/u),
    payloadDigest: Sha256Schema,
    receiptKind: AgentReceiptKindSchema,
    senderWorkloadId: z
      .string()
      .regex(/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/u),
    signature: z.string().regex(/^[A-Za-z0-9+/=_-]{40,12000}$/u)
  })
  .strict();

export const AgentSignedReceiptSchema = z.object({
  agentProtocolEndpointId: z.uuid(),
  agentSignedReceiptId: z.uuid(),
  agentVerifiableCredentialId: z.uuid().nullable(),
  audience: z.string(),
  evidenceIds: z.array(z.uuid()),
  expiresAt: z.iso.datetime(),
  issuedAt: z.iso.datetime(),
  nonce: z.string(),
  payloadDigest: Sha256Schema,
  receiptKind: AgentReceiptKindSchema,
  senderWorkloadId: z.string(),
  tenantId: z.uuid(),
  verificationReason: z.string(),
  verificationStatus: z.enum(["Verified", "Rejected"]),
  verifiedAt: z.iso.datetime()
});

export const AgentDidTrustProfileStatusSchema = z.enum(["Active", "Revoked"]);

export const CreateAgentDidTrustProfileInputSchema = z
  .object({
    agentProtocolEndpointId: z.uuid(),
    allowedCredentialTypes: z
      .array(z.string().trim().min(1).max(160))
      .min(1)
      .max(20),
    authorizationReason: z.string().trim().min(10).max(1_000),
    expectedAudience: z.string().trim().min(1).max(240),
    issuerDid: z
      .string()
      .trim()
      .regex(/^did:web:[A-Za-z0-9.%:_-]+$/u),
    scopeId: z.uuid(),
    subjectDid: z
      .string()
      .trim()
      .regex(/^did:web:[A-Za-z0-9.%:_-]+$/u)
  })
  .strict();

export const RevokeAgentDidTrustProfileInputSchema = z
  .object({
    reason: z.string().trim().min(10).max(1_000)
  })
  .strict();

export const RefreshAgentDidTrustProfileInputSchema = z
  .object({
    reason: z.string().trim().min(10).max(1_000)
  })
  .strict();

export const VerifyAgentVerifiableCredentialInputSchema = z
  .object({
    credentialJwt: z.string().trim().min(80).max(1_000_000),
    profileId: z.uuid()
  })
  .strict();

export const AgentDidTrustProfileSchema = z.object({
  agentDidTrustProfileId: z.uuid(),
  agentProtocolEndpointId: z.uuid(),
  allowedCredentialTypes: z.array(z.string()),
  authorizationReason: z.string(),
  createdAt: z.iso.datetime(),
  createdBy: z.uuid(),
  expectedAudience: z.string(),
  expectedEndpointOrigin: z.url(),
  issuerDid: z.string(),
  issuerDidDocumentHash: Sha256Schema,
  issuerResolutionUrl: z.url(),
  issuerResolvedAt: z.iso.datetime(),
  policyDecisionId: z.uuid(),
  revokedAt: z.iso.datetime().nullable(),
  revokedBy: z.uuid().nullable(),
  revocationReason: z.string().nullable(),
  scopeId: z.uuid(),
  status: AgentDidTrustProfileStatusSchema,
  subjectDid: z.string(),
  subjectDidDocumentHash: Sha256Schema,
  subjectResolutionUrl: z.url(),
  subjectResolvedAt: z.iso.datetime(),
  tenantId: z.uuid(),
  updatedAt: z.iso.datetime()
});

export const AgentVerifiableCredentialStatusSchema = z.enum([
  "Verified",
  "Rejected",
  "Revoked",
  "Expired"
]);

export const AgentVerifiableCredentialSchema = z.object({
  agentDidTrustProfileId: z.uuid(),
  agentVerifiableCredentialId: z.uuid(),
  algorithm: z.string().nullable(),
  allowedCapabilities: z.array(z.string()),
  claimsHash: Sha256Schema,
  credentialHash: Sha256Schema,
  credentialId: z.string().nullable(),
  credentialTypes: z.array(z.string()),
  findings: z.array(z.string()),
  issuerDid: z.string(),
  issuerDidDocumentHash: Sha256Schema,
  status: AgentVerifiableCredentialStatusSchema,
  subjectDid: z.string(),
  tenantId: z.uuid(),
  validFrom: z.iso.datetime().nullable(),
  validUntil: z.iso.datetime().nullable(),
  verificationMethodId: z.string().nullable(),
  verifiedAt: z.iso.datetime(),
  workloadId: z.string().nullable()
});

export const AgentExchangeObjectKindSchema = z.enum([
  "Task",
  "Message",
  "Artifact"
]);
export const AgentExchangeObjectStateSchema = z.enum([
  "Submitted",
  "Working",
  "InputRequired",
  "Completed",
  "Failed",
  "Cancelled"
]);
export const CreateAgentExchangeObjectInputSchema = z
  .object({
    agentProtocolEndpointId: z.uuid(),
    evidenceIds: z.array(z.uuid()).max(500).default([]),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/u),
    kind: AgentExchangeObjectKindSchema,
    parentObjectId: z.uuid().nullable().optional(),
    payloadRedacted: z.record(z.string(), z.unknown()),
    signedReceiptId: z.uuid().nullable().optional()
  })
  .strict();
export const UpdateAgentExchangeObjectStateInputSchema = z
  .object({
    reason: z.string().trim().min(3).max(1_000),
    state: AgentExchangeObjectStateSchema
  })
  .strict();
export const AgentExchangeObjectSchema = z.object({
  agentExchangeObjectId: z.uuid(),
  agentProtocolEndpointId: z.uuid(),
  createdAt: z.iso.datetime(),
  evidenceIds: z.array(z.uuid()),
  idempotencyKey: z.string(),
  kind: AgentExchangeObjectKindSchema,
  parentObjectId: z.uuid().nullable(),
  payloadRedacted: z.record(z.string(), z.unknown()),
  signedReceiptId: z.uuid().nullable(),
  state: AgentExchangeObjectStateSchema,
  stateReason: z.string().nullable(),
  tenantId: z.uuid(),
  updatedAt: z.iso.datetime()
});

export const ConfidentialAttestationProviderSchema = z.enum([
  "AWSNitro",
  "AzureTDX",
  "AMDSEVSNP",
  "NvidiaConfidentialGPU",
  "ArmPSA",
  "ArmCCA",
  "TPM"
]);

export const CreateConfidentialAttestationChallengeInputSchema = z
  .object({
    provider: ConfidentialAttestationProviderSchema,
    workloadId: z.string().trim().min(3).max(240)
  })
  .strict();

export const ConfidentialAttestationChallengeSchema = z.object({
  challengeId: z.uuid(),
  expiresAt: z.iso.datetime(),
  nonce: z.string().regex(/^[a-f0-9]{64}$/u),
  provider: ConfidentialAttestationProviderSchema,
  workloadId: z.string()
});

const VerifyGenericConfidentialAttestationInputSchema = z
  .object({
    expectedAudience: z.string().trim().min(1).max(240),
    expectedMeasurement: Sha256Schema,
    expectedNonce: z.string().regex(/^[A-Za-z0-9_-]{16,160}$/u),
    expectedRegion: z.string().trim().min(2).max(120),
    noLogRequired: z.boolean().default(true),
    provider: z.enum(["AWSNitro", "AzureTDX", "AMDSEVSNP"]),
    signedStatement: z.string().min(80).max(100_000),
    workloadId: z.string().trim().min(3).max(240)
  })
  .strict();

export const VerifyNvidiaConfidentialGpuAttestationInputSchema = z
  .object({
    challengeId: z.uuid(),
    expectedGpuModels: z
      .array(z.string().trim().min(2).max(120))
      .max(20)
      .default([]),
    expectedIssuer: z.string().trim().min(2).max(240),
    expectedNonce: z.string().regex(/^[A-Za-z0-9_-]{16,160}$/u),
    maxTokenAgeSeconds: z.number().int().min(60).max(3_600).default(600),
    provider: z.literal("NvidiaConfidentialGPU"),
    requireDebugDisabled: z.boolean().default(true),
    requireSecureBoot: z.boolean().default(true),
    signedStatement: z.string().min(80).max(1_000_000),
    workloadId: z.string().trim().min(3).max(240)
  })
  .strict();

export const VerifyConfidentialAttestationInputSchema = z.discriminatedUnion(
  "provider",
  [
    VerifyGenericConfidentialAttestationInputSchema,
    VerifyNvidiaConfidentialGpuAttestationInputSchema
  ]
);

export const ConfidentialAttestationSchema = z.object({
  checkedAt: z.iso.datetime(),
  claimsVersion: z.string().nullable(),
  confidentialAttestationId: z.uuid(),
  debugDisabled: z.boolean().nullable(),
  deviceCount: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime().nullable(),
  findings: z.array(z.string()),
  hardwareModels: z.array(z.string()),
  measurement: Sha256Schema.nullable(),
  ordinarySignatureIsHardwareAttestation: z.literal(false),
  outcome: z.enum(["Verified", "Rejected", "NotConfigured"]),
  provider: ConfidentialAttestationProviderSchema,
  rawClaimsHash: Sha256Schema,
  region: z.string().nullable(),
  resultClaimsHash: Sha256Schema.nullable(),
  secureBoot: z.boolean().nullable(),
  signatureVerified: z.boolean(),
  tenantId: z.uuid(),
  trustAnchorConfigured: z.boolean(),
  evidenceMediaType: z.string().nullable(),
  veraisonSessionId: z.uuid().nullable(),
  verifierOrigin: z.url().nullable(),
  verifierType: z.enum(["Native", "NvidiaNVAT", "Veraison"]),
  workloadId: z.string()
});

const VeraisonExpectedClaimValueSchema = z.union([
  z.string().max(1_000),
  z.number().finite(),
  z.boolean()
]);

export const CreateVeraisonAttestationSessionInputSchema = z
  .object({
    authorizationReason: z.string().trim().min(10).max(1_000),
    provider: z.enum(["ArmPSA", "ArmCCA", "AMDSEVSNP", "TPM"]),
    scopeId: z.uuid(),
    verifierUrl: z.url().max(2_000),
    workloadId: z.string().trim().min(3).max(240)
  })
  .strict();

export const VeraisonAttestationSessionSchema = z.object({
  acceptedMediaTypes: z.array(z.string().min(1).max(240)).max(20),
  completedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  failureReason: z.string().nullable(),
  nonce: z.string().max(88).nullable(),
  policyDecisionId: z.uuid(),
  provider: z.enum(["ArmPSA", "ArmCCA", "AMDSEVSNP", "TPM"]),
  scopeId: z.uuid(),
  state: z.enum(["Waiting", "Processing", "Complete", "Failed"]),
  tenantId: z.uuid(),
  veraisonSessionId: z.uuid(),
  verifierOrigin: z.url(),
  workloadId: z.string()
});

export const VerifyVeraisonAttestationInputSchema = z
  .object({
    evidenceBase64: z
      .string()
      .min(4)
      .max(7_000_000)
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u
      ),
    evidenceMediaType: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:;[a-z0-9!#$&^_.+;= -]+)?$/iu
      )
      .max(240),
    expectedClaims: z
      .record(
        z.string().regex(/^[A-Za-z0-9_.:-]{1,240}$/u),
        VeraisonExpectedClaimValueSchema
      )
      .refine((claims) => Object.keys(claims).length <= 20, {
        message: "At most 20 expected claims can be checked."
      })
      .default({}),
    veraisonSessionId: z.uuid()
  })
  .strict();

export const VerifyVeraisonAttestationResultSchema = z.object({
  attestation: ConfidentialAttestationSchema,
  session: VeraisonAttestationSessionSchema
});

export const ExtensionCapabilitySchema = z.enum([
  "ReadEvidence",
  "WriteEvidence",
  "NetworkVerifiedScope",
  "RequestRunnerTask"
]);

export const ExtensionExecutionContractSchema = z
  .object({
    capabilities: z.array(ExtensionCapabilitySchema).max(20),
    contractVersion: z.literal("1.0"),
    cpuLimitMillis: z.number().int().min(50).max(8_000),
    imageDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    imageReference: z
      .string()
      .regex(/^[a-z0-9.-]+(?::\d+)?\/[A-Za-z0-9._/-]+@sha256:[a-f0-9]{64}$/u),
    maxOutputBytes: z.number().int().min(1_024).max(50_000_000),
    memoryLimitMb: z.number().int().min(32).max(16_384),
    networkAllowlist: z.array(z.string().trim().min(1).max(255)).max(200),
    outputSchema: z.record(z.string(), z.unknown()),
    packageName: z.string().regex(/^[a-z][a-z0-9-]{1,62}$/u),
    redactionFields: z.array(z.string().trim().min(1).max(160)).max(100),
    signature: z.string().regex(/^[A-Za-z0-9+/=_-]{40,12000}$/u),
    signerIdentity: z.string().trim().min(3).max(240),
    signerPublicKeyPem: z.string().min(100).max(20_000),
    timeoutSeconds: z.number().int().min(1).max(900)
  })
  .strict();

export const ExtensionCompatibilityReportSchema = z.object({
  arbitraryPythonUploadAllowed: z.literal(false),
  checks: z.array(
    z.object({
      checkId: z.string(),
      message: z.string(),
      status: z.enum(["Pass", "Fail"])
    })
  ),
  compatible: z.boolean(),
  contractDigest: Sha256Schema,
  executionAuthorized: z.literal(false),
  generatedAt: z.iso.datetime(),
  requiresCatalogAndSecurityReview: z.literal(true)
});

export type AgentProtocolEndpoint = z.infer<typeof AgentProtocolEndpointSchema>;
export type A2AAgentCardConformanceReport = z.infer<
  typeof A2AAgentCardConformanceReportSchema
>;
export type RegisterAgentProtocolEndpointInput = z.infer<
  typeof RegisterAgentProtocolEndpointInputSchema
>;
export type ReviewAgentProtocolEndpointInput = z.infer<
  typeof ReviewAgentProtocolEndpointInputSchema
>;
export type DiscoverAgentProtocolEndpointResult = z.infer<
  typeof DiscoverAgentProtocolEndpointResultSchema
>;
export type RunA2ATckInput = z.infer<typeof RunA2ATckInputSchema>;
export type A2ATckRun = z.infer<typeof A2ATckRunSchema>;
export type A2ATckRequirementResult = z.infer<
  typeof A2ATckRequirementResultSchema
>;
export type A2ATckTransportResult = z.infer<typeof A2ATckTransportResultSchema>;
export type VerifyAgentSignedReceiptInput = z.infer<
  typeof VerifyAgentSignedReceiptInputSchema
>;
export type AgentSignedReceipt = z.infer<typeof AgentSignedReceiptSchema>;
export type CreateAgentDidTrustProfileInput = z.infer<
  typeof CreateAgentDidTrustProfileInputSchema
>;
export type RevokeAgentDidTrustProfileInput = z.infer<
  typeof RevokeAgentDidTrustProfileInputSchema
>;
export type RefreshAgentDidTrustProfileInput = z.infer<
  typeof RefreshAgentDidTrustProfileInputSchema
>;
export type VerifyAgentVerifiableCredentialInput = z.infer<
  typeof VerifyAgentVerifiableCredentialInputSchema
>;
export type AgentDidTrustProfile = z.infer<typeof AgentDidTrustProfileSchema>;
export type AgentVerifiableCredential = z.infer<
  typeof AgentVerifiableCredentialSchema
>;
export type CreateAgentExchangeObjectInput = z.infer<
  typeof CreateAgentExchangeObjectInputSchema
>;
export type UpdateAgentExchangeObjectStateInput = z.infer<
  typeof UpdateAgentExchangeObjectStateInputSchema
>;
export type AgentExchangeObject = z.infer<typeof AgentExchangeObjectSchema>;
export type VerifyConfidentialAttestationInput = z.infer<
  typeof VerifyConfidentialAttestationInputSchema
>;
export type CreateConfidentialAttestationChallengeInput = z.infer<
  typeof CreateConfidentialAttestationChallengeInputSchema
>;
export type ConfidentialAttestationChallenge = z.infer<
  typeof ConfidentialAttestationChallengeSchema
>;
export type VerifyNvidiaConfidentialGpuAttestationInput = z.infer<
  typeof VerifyNvidiaConfidentialGpuAttestationInputSchema
>;
export type ConfidentialAttestation = z.infer<
  typeof ConfidentialAttestationSchema
>;
export type CreateVeraisonAttestationSessionInput = z.infer<
  typeof CreateVeraisonAttestationSessionInputSchema
>;
export type VeraisonAttestationSession = z.infer<
  typeof VeraisonAttestationSessionSchema
>;
export type VerifyVeraisonAttestationInput = z.infer<
  typeof VerifyVeraisonAttestationInputSchema
>;
export type VerifyVeraisonAttestationResult = z.infer<
  typeof VerifyVeraisonAttestationResultSchema
>;
export type ExtensionExecutionContract = z.infer<
  typeof ExtensionExecutionContractSchema
>;
export type ExtensionCompatibilityReport = z.infer<
  typeof ExtensionCompatibilityReportSchema
>;
