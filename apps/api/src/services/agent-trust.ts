import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { lookup } from "node:dns/promises";

import type { Prisma } from "@prisma/client";
import { A2A_TCK_PINNED_VERSION } from "@periscan/modules";
import { evaluatePolicy, isReservedIpAddress } from "@periscan/policy";
import {
  compactVerify,
  decodeProtectedHeader,
  importJWK,
  type JWK
} from "jose";
import {
  A2ATckRunSchema,
  A2AAgentCardConformanceReportSchema,
  AgentDidTrustProfileSchema,
  AgentExchangeObjectSchema,
  AgentProtocolEndpointSchema,
  AgentSignedReceiptSchema,
  AgentVerifiableCredentialSchema,
  ConfidentialAttestationChallengeSchema,
  ConfidentialAttestationSchema,
  TeeAssuranceDecisionSchema,
  TeeAssuranceRequirementSchema,
  TeeAssuranceWorkspaceSchema,
  VeraisonAttestationSessionSchema,
  VerifyVeraisonAttestationResultSchema,
  type A2ATckRun,
  type AgentDidTrustProfile,
  type AgentExchangeObject,
  type A2AAgentCardConformanceReport,
  type AgentProtocolEndpoint,
  type AgentSignedReceipt,
  type AgentVerifiableCredential,
  type ConfidentialAttestation,
  type MembershipRole,
  type TeeAssuranceDecision,
  type TeeAssuranceRequirement,
  type VeraisonAttestationSession,
  type VerifyAgentSignedReceiptInput,
  type VerifyNvidiaConfidentialGpuAttestationInput
} from "@periscan/shared";
import { z } from "zod";

import {
  AppServiceError,
  buildSafeRequestedAction,
  requireRole,
  writeAuditEvent,
  type AppServices,
  type AuthenticatedContext,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const TRUST_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);
const TRUST_OPERATOR_ROLES = new Set<MembershipRole>([
  ...TRUST_ADMIN_ROLES,
  "SecurityEngineer"
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function canonicalBytes(value: unknown) {
  return Buffer.from(JSON.stringify(canonicalize(value)));
}

function sha256(value: unknown) {
  return createHash("sha256").update(canonicalBytes(value)).digest("hex");
}

export function signableAgentReceipt(input: VerifyAgentSignedReceiptInput) {
  const unsigned = Object.fromEntries(
    Object.entries(input).filter(([key]) => key !== "signature")
  );
  return canonicalBytes(unsigned);
}

function assertRedactedPayload(value: unknown, path = "payloadRedacted") {
  const encoded = JSON.stringify(value);
  if (encoded.length > 100_000) {
    throw new AppServiceError(
      "Agent exchange payload exceeds 100 KB.",
      400,
      "agent_payload_too_large"
    );
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      assertRedactedPayload(child, `${path}[${index}]`)
    );
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[-_\s]/gu, "").toLowerCase();
    if (
      /^(?:password|secret|privatekey|clientsecret|credential|authorization|apikey|accesstoken|refreshtoken)$/u.test(
        normalized
      )
    ) {
      throw new AppServiceError(
        `Agent exchange payload contains forbidden secret field ${path}.${key}.`,
        400,
        "agent_payload_contains_secret"
      );
    }
    assertRedactedPayload(child, `${path}.${key}`);
  }
}

function serializeEndpoint(record: {
  a2aConformance: Prisma.JsonValue | null;
  agentProtocolEndpointId: string;
  allowedCapabilityNames: string[];
  createdAt: Date;
  createdBy: string;
  discoveredAt: Date | null;
  discoveredCapabilities: Prisma.JsonValue;
  endpointUrl: string;
  name: string;
  protocol: string;
  publicKeyPem: string | null;
  reviewReason: string | null;
  status: string;
  tenantId: string;
  trustPolicy: Prisma.JsonValue;
  updatedAt: Date;
}): AgentProtocolEndpoint {
  return AgentProtocolEndpointSchema.parse({
    ...record,
    a2aConformance: record.a2aConformance,
    createdAt: record.createdAt.toISOString(),
    discoveredAt: record.discoveredAt?.toISOString() ?? null,
    hasPublicKey: Boolean(record.publicKeyPem),
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializeReceipt(record: {
  agentProtocolEndpointId: string;
  agentSignedReceiptId: string;
  agentVerifiableCredentialId: string | null;
  audience: string;
  evidenceIds: string[];
  expiresAt: Date;
  issuedAt: Date;
  nonce: string;
  payloadDigest: string;
  receiptKind: string;
  senderWorkloadId: string;
  tenantId: string;
  verificationReason: string;
  verificationStatus: string;
  verifiedAt: Date;
}): AgentSignedReceipt {
  return AgentSignedReceiptSchema.parse({
    ...record,
    expiresAt: record.expiresAt.toISOString(),
    issuedAt: record.issuedAt.toISOString(),
    verifiedAt: record.verifiedAt.toISOString()
  });
}

function serializeDidTrustProfile(record: {
  agentDidTrustProfileId: string;
  agentProtocolEndpointId: string;
  allowedCredentialTypes: string[];
  authorizationReason: string;
  createdAt: Date;
  createdBy: string;
  expectedAudience: string;
  expectedEndpointOrigin: string;
  issuerDid: string;
  issuerDidDocumentHash: string;
  issuerResolutionUrl: string;
  issuerResolvedAt: Date;
  policyDecisionId: string;
  revokedAt: Date | null;
  revokedBy: string | null;
  revocationReason: string | null;
  scopeId: string;
  status: string;
  subjectDid: string;
  subjectDidDocumentHash: string;
  subjectResolutionUrl: string;
  subjectResolvedAt: Date;
  tenantId: string;
  updatedAt: Date;
}): AgentDidTrustProfile {
  return AgentDidTrustProfileSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    issuerResolvedAt: record.issuerResolvedAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
    subjectResolvedAt: record.subjectResolvedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializeAgentVerifiableCredential(record: {
  agentDidTrustProfileId: string;
  agentVerifiableCredentialId: string;
  algorithm: string | null;
  allowedCapabilities: string[];
  claimsHash: string;
  credentialHash: string;
  credentialId: string | null;
  credentialTypes: string[];
  findings: Prisma.JsonValue;
  issuerDid: string;
  issuerDidDocumentHash: string;
  status: string;
  subjectDid: string;
  tenantId: string;
  validFrom: Date | null;
  validUntil: Date | null;
  verificationMethodId: string | null;
  verifiedAt: Date;
  workloadId: string | null;
}): AgentVerifiableCredential {
  return AgentVerifiableCredentialSchema.parse({
    ...record,
    validFrom: record.validFrom?.toISOString() ?? null,
    validUntil: record.validUntil?.toISOString() ?? null,
    verifiedAt: record.verifiedAt.toISOString()
  });
}

function serializeExchange(record: {
  agentExchangeObjectId: string;
  agentProtocolEndpointId: string;
  createdAt: Date;
  evidenceIds: string[];
  idempotencyKey: string;
  kind: string;
  parentObjectId: string | null;
  payloadRedacted: Prisma.JsonValue;
  signedReceiptId: string | null;
  state: string;
  stateReason: string | null;
  tenantId: string;
  updatedAt: Date;
}): AgentExchangeObject {
  return AgentExchangeObjectSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializeAttestation(record: {
  checkedAt: Date;
  claimsVersion: string | null;
  confidentialAttestationId: string;
  debugDisabled: boolean | null;
  deviceCount: number;
  expiresAt: Date | null;
  findings: Prisma.JsonValue;
  hardwareModels: string[];
  measurement: string | null;
  outcome: string;
  provider: string;
  rawClaimsHash: string;
  region: string | null;
  resultClaimsHash: string | null;
  secureBoot: boolean | null;
  signatureVerified: boolean;
  tenantId: string;
  trustAnchorConfigured: boolean;
  evidenceMediaType: string | null;
  veraisonSessionId: string | null;
  verifierOrigin: string | null;
  verifierType: string;
  workloadId: string;
}): ConfidentialAttestation {
  return ConfidentialAttestationSchema.parse({
    ...record,
    checkedAt: record.checkedAt.toISOString(),
    expiresAt: record.expiresAt?.toISOString() ?? null,
    ordinarySignatureIsHardwareAttestation: false
  });
}

function serializeA2ATckRun(record: {
  a2aTckRunId: string;
  agentProtocolEndpointId: string;
  authorizationReason: string;
  compatible: boolean;
  completedAt: Date | null;
  failureReason: string | null;
  level: string;
  mayCompatibility: number | null;
  mustCompatibility: number | null;
  overallCompatibility: number | null;
  policyDecisionId: string;
  reportHash: string | null;
  requirementResults: Prisma.JsonValue;
  scopeId: string;
  shouldCompatibility: number | null;
  specVersion: string | null;
  startedAt: Date;
  status: string;
  tenantId: string;
  toolVersion: string;
  transportResults: Prisma.JsonValue;
  transports: string[];
  triggeredBy: string;
}): A2ATckRun {
  return A2ATckRunSchema.parse({
    ...record,
    completedAt: record.completedAt?.toISOString() ?? null,
    startedAt: record.startedAt.toISOString()
  });
}

function serializeVeraisonSession(
  record: {
    acceptedMediaTypes: string[];
    completedAt: Date | null;
    createdAt: Date;
    expiresAt: Date;
    failureReason: string | null;
    policyDecisionId: string;
    provider: string;
    scopeId: string;
    state: string;
    tenantId: string;
    veraisonSessionId: string;
    verifierOrigin: string;
    workloadId: string;
  },
  nonce: string | null = null
): VeraisonAttestationSession {
  return VeraisonAttestationSessionSchema.parse({
    ...record,
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    nonce
  });
}

type TeeAssuranceDecisionRecord = {
  attestationCheckedAt: Date;
  attestationId: string;
  attestationRawClaimsHash: string;
  attestationResultClaimsHash: string | null;
  decidedAt: Date;
  decidedBy: string;
  decisionReason: string;
  decisionReference: string;
  decisionType: string;
  findings: Prisma.JsonValue;
  qualifiedUntil: Date | null;
  teeAssuranceDecisionId: string;
  teeAssuranceRequirementId: string;
  tenantId: string;
};

type TeeAssuranceRequirementRecord = {
  authorizationReason: string;
  createdAt: Date;
  createdBy: string;
  decisions: TeeAssuranceDecisionRecord[];
  escalationReference: string;
  evidenceMediaType: string | null;
  expectedMeasurement: string | null;
  expectedRegion: string | null;
  maxAttestationAgeMinutes: number;
  policyDecisionId: string;
  policyReference: string;
  provider: string;
  qualificationValidityMinutes: number;
  requireDebugDisabled: boolean;
  requireSecureBoot: boolean;
  scopeId: string;
  supportOwner: string;
  teeAssuranceRequirementId: string;
  tenantId: string;
  verifierType: string;
  workloadId: string;
};

function serializeTeeAssuranceDecision(
  record: TeeAssuranceDecisionRecord
): TeeAssuranceDecision {
  return TeeAssuranceDecisionSchema.parse({
    ...record,
    attestationCheckedAt: record.attestationCheckedAt.toISOString(),
    decidedAt: record.decidedAt.toISOString(),
    findings: z.array(z.string()).parse(record.findings),
    qualifiedUntil: record.qualifiedUntil?.toISOString() ?? null
  });
}

function serializeTeeAssuranceRequirement(
  record: TeeAssuranceRequirementRecord,
  now = new Date()
): TeeAssuranceRequirement {
  const latestDecision = record.decisions[0]
    ? serializeTeeAssuranceDecision(record.decisions[0])
    : null;
  const status =
    latestDecision?.decisionType === "Qualified" &&
    latestDecision.qualifiedUntil &&
    new Date(latestDecision.qualifiedUntil) <= now
      ? "Expired"
      : (latestDecision?.decisionType ?? "AwaitingEvidence");
  return TeeAssuranceRequirementSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    latestDecision,
    status
  });
}

export function evaluateTeeAssuranceEvidence(
  requirement: {
    evidenceMediaType: string | null;
    expectedMeasurement: string | null;
    expectedRegion: string | null;
    maxAttestationAgeMinutes: number;
    provider: string;
    requireDebugDisabled: boolean;
    requireSecureBoot: boolean;
    scopeId: string;
    verifierType: string;
    workloadId: string;
  },
  attestation: {
    checkedAt: Date;
    debugDisabled: boolean | null;
    evidenceMediaType: string | null;
    expiresAt: Date | null;
    measurement: string | null;
    outcome: string;
    provider: string;
    region: string | null;
    secureBoot: boolean | null;
    signatureVerified: boolean;
    trustAnchorConfigured: boolean;
    verifierType: string;
    workloadId: string;
  },
  session: {
    policyDecisionId: string;
    scopeId: string;
    state: string;
    tenantId: string;
  } | null,
  tenantId: string,
  now = new Date()
) {
  const findings: string[] = [];
  if (attestation.outcome !== "Verified")
    findings.push("The selected verifier result is not Verified.");
  if (!attestation.trustAnchorConfigured)
    findings.push(
      "The selected verifier did not confirm a configured trust anchor."
    );
  if (!attestation.signatureVerified)
    findings.push("The selected evidence signature was not verified.");
  if (attestation.provider !== requirement.provider)
    findings.push("The attestation provider does not match the requirement.");
  if (attestation.verifierType !== requirement.verifierType)
    findings.push("The verifier type does not match the requirement.");
  if (attestation.workloadId !== requirement.workloadId)
    findings.push("The attested workload does not match the requirement.");
  if (!session)
    findings.push("The attestation has no persisted Veraison session binding.");
  if (session && session.tenantId !== tenantId)
    findings.push("The Veraison session belongs to another tenant.");
  if (session && session.scopeId !== requirement.scopeId)
    findings.push(
      "The Veraison session is bound to a different verified scope."
    );
  if (session && session.state !== "Complete")
    findings.push("The Veraison session is not complete.");
  if (session && !session.policyDecisionId)
    findings.push("The Veraison session has no policy decision binding.");

  const oldestAllowed = new Date(
    now.getTime() - requirement.maxAttestationAgeMinutes * 60_000
  );
  if (attestation.checkedAt < oldestAllowed)
    findings.push(
      "The attestation is older than the allowed freshness window."
    );
  if (attestation.checkedAt.getTime() > now.getTime() + 60_000)
    findings.push("The attestation timestamp is in the future.");
  if (!attestation.expiresAt)
    findings.push("The attestation has no verifier expiry.");
  else if (attestation.expiresAt <= now)
    findings.push("The attestation has expired.");
  if (
    requirement.expectedMeasurement &&
    attestation.measurement !== requirement.expectedMeasurement
  )
    findings.push("The workload measurement does not match the requirement.");
  if (
    requirement.expectedRegion &&
    attestation.region !== requirement.expectedRegion
  )
    findings.push("The attested region does not match the requirement.");
  if (
    requirement.evidenceMediaType &&
    attestation.evidenceMediaType !== requirement.evidenceMediaType
  )
    findings.push("The evidence media type does not match the requirement.");
  if (requirement.requireSecureBoot && attestation.secureBoot !== true)
    findings.push("Secure boot is required but was not proven.");
  if (requirement.requireDebugDisabled && attestation.debugDisabled !== true)
    findings.push("Debug-disabled state is required but was not proven.");
  return findings;
}

async function assertDiscoveryTarget(endpointUrl: string, devMode: boolean) {
  const url = new URL(endpointUrl);
  if (url.username || url.password || url.hash) {
    throw new AppServiceError(
      "Protocol endpoints cannot contain credentials or URL fragments.",
      400,
      "agent_endpoint_url_unsafe"
    );
  }
  const localDevTarget =
    devMode && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(localDevTarget && url.protocol === "http:")
  ) {
    throw new AppServiceError(
      "Protocol endpoints must use HTTPS.",
      400,
      "agent_endpoint_https_required"
    );
  }
  // Shared post-resolve reserved/private ranges (policy package) — same SSRF
  // boundary as external validation + threat feeds (P03-5 residual drift fix).
  const addresses = await lookup(url.hostname, { all: true });
  if (
    !localDevTarget &&
    addresses.some((entry) => isReservedIpAddress(entry.address))
  ) {
    throw new AppServiceError(
      "Protocol endpoint resolves to a private or link-local address.",
      400,
      "agent_endpoint_private_address"
    );
  }
  return url;
}

const VC_CONTEXT_V2 = "https://www.w3.org/ns/credentials/v2";
const DID_CONTEXT_V1 = "https://www.w3.org/ns/did/v1";
const AGENT_VC_ALGORITHMS = ["ES256", "ES384", "EdDSA"] as const;
const PRIVATE_JWK_FIELDS = new Set([
  "d",
  "p",
  "q",
  "dp",
  "dq",
  "qi",
  "oth",
  "k"
]);

const DidVerificationMethodSchema = z
  .object({
    controller: z.string().min(1).max(2_000),
    id: z.string().min(1).max(2_000),
    publicKeyJwk: z.record(z.string(), z.unknown()),
    type: z.enum(["JsonWebKey", "JsonWebKey2020"])
  })
  .passthrough();

const DidDocumentSchema = z
  .object({
    "@context": z.union([
      z.string(),
      z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).max(20)
    ]),
    assertionMethod: z
      .array(z.union([z.string().max(2_000), DidVerificationMethodSchema]))
      .max(100),
    id: z.string().min(1).max(2_000),
    verificationMethod: z
      .array(DidVerificationMethodSchema)
      .max(100)
      .default([])
  })
  .passthrough();

type DidDocument = z.infer<typeof DidDocumentSchema>;

export interface ResolvedDidWebDocument {
  document: DidDocument;
  documentHash: string;
  resolutionUrl: string;
  resolvedAt: Date;
}

function contextIncludes(value: unknown, required: string) {
  return (
    value === required || (Array.isArray(value) && value.includes(required))
  );
}

export function didWebToResolutionUrl(did: string, devMode: boolean) {
  if (!did.startsWith("did:web:")) {
    throw new AppServiceError(
      "Only the did:web method is supported by this trust profile.",
      400,
      "agent_did_method_unsupported"
    );
  }
  const encodedSegments = did.slice("did:web:".length).split(":");
  let segments: string[];
  try {
    segments = encodedSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    throw new AppServiceError(
      "The did:web identifier contains invalid percent encoding.",
      400,
      "agent_did_invalid"
    );
  }
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[/?#\\]/u.test(segment)
    )
  ) {
    throw new AppServiceError(
      "The did:web identifier contains an unsafe host or path segment.",
      400,
      "agent_did_invalid"
    );
  }
  const host = segments[0] as string;
  let hostname: string;
  try {
    hostname = new URL(`https://${host}`).hostname;
  } catch {
    throw new AppServiceError(
      "The did:web identifier does not contain a valid host.",
      400,
      "agent_did_invalid"
    );
  }
  const localDevTarget =
    devMode && ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const path =
    segments.length === 1
      ? "/.well-known/did.json"
      : `/${segments
          .slice(1)
          .map((segment) => encodeURIComponent(segment))
          .join("/")}/did.json`;
  return `${localDevTarget ? "http" : "https"}://${host}${path}`;
}

export async function resolveDidWebDocument(
  did: string,
  options: { devMode: boolean; fetchImpl: typeof fetch }
): Promise<ResolvedDidWebDocument> {
  const resolutionUrl = didWebToResolutionUrl(did, options.devMode);
  const url = await assertDiscoveryTarget(resolutionUrl, options.devMode);
  const response = await options.fetchImpl(url, {
    headers: { accept: "application/did+json, application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) {
    throw new AppServiceError(
      `DID resolution returned HTTP ${response.status}.`,
      502,
      "agent_did_resolution_http_error"
    );
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) {
    throw new AppServiceError(
      "DID resolution did not return JSON.",
      502,
      "agent_did_resolution_content_type"
    );
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > 1_000_000) {
    throw new AppServiceError(
      "The DID document exceeded 1 MB.",
      502,
      "agent_did_document_too_large"
    );
  }
  let document: DidDocument;
  try {
    document = DidDocumentSchema.parse(JSON.parse(body) as unknown);
  } catch {
    throw new AppServiceError(
      "DID resolution returned an invalid or unsupported DID document.",
      502,
      "agent_did_document_invalid"
    );
  }
  if (
    document.id !== did ||
    !contextIncludes(document["@context"], DID_CONTEXT_V1)
  ) {
    throw new AppServiceError(
      "The resolved DID document identity or DID Core context did not match the requested DID.",
      502,
      "agent_did_document_identity_mismatch"
    );
  }
  return {
    document,
    documentHash: sha256(document),
    resolutionUrl: url.toString(),
    resolvedAt: new Date()
  };
}

function findAssertionVerificationMethod(document: DidDocument, kid: string) {
  const embedded = document.assertionMethod.find(
    (method): method is z.infer<typeof DidVerificationMethodSchema> =>
      typeof method !== "string" && method.id === kid
  );
  if (embedded) return embedded;
  const authorized = document.assertionMethod.some(
    (method) => typeof method === "string" && method === kid
  );
  return authorized
    ? (document.verificationMethod.find((method) => method.id === kid) ?? null)
    : null;
}

function readVcIssuer(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const id = (value as Record<string, unknown>).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function readStringArray(value: unknown) {
  if (typeof value === "string") return [value];
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function readIsoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface AgentCredentialVerificationProfile {
  allowedCapabilityNames: string[];
  allowedCredentialTypes: string[];
  expectedAudience: string;
  expectedEndpointOrigin: string;
  issuerDid: string;
  maxCredentialTtlSeconds: number;
  subjectDid: string;
}

export async function verifyAgentCredentialJwt(
  credentialJwt: string,
  profile: AgentCredentialVerificationProfile,
  options: { devMode: boolean; fetchImpl: typeof fetch; now?: Date }
) {
  const now = options.now ?? new Date();
  const findings: string[] = [];
  const credentialHash = createHash("sha256")
    .update(credentialJwt)
    .digest("hex");
  let header: ReturnType<typeof decodeProtectedHeader>;
  let payload: Record<string, unknown>;
  try {
    header = decodeProtectedHeader(credentialJwt);
    const encodedPayload = credentialJwt.split(".")[1];
    if (!encodedPayload) throw new Error("missing payload");
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Record<string, unknown>;
  } catch {
    throw new AppServiceError(
      "The credential is not a valid compact JOSE envelope.",
      400,
      "agent_vc_envelope_invalid"
    );
  }
  const claimsHash = sha256(payload);
  const vc =
    payload.vc && typeof payload.vc === "object" && !Array.isArray(payload.vc)
      ? (payload.vc as Record<string, unknown>)
      : {};
  const credentialSubject =
    vc.credentialSubject &&
    typeof vc.credentialSubject === "object" &&
    !Array.isArray(vc.credentialSubject)
      ? (vc.credentialSubject as Record<string, unknown>)
      : {};
  const credentialTypes = readStringArray(vc.type);
  const allowedCapabilities = readStringArray(
    credentialSubject.allowedCapabilities
  );
  const issuerDid =
    readVcIssuer(vc.issuer) ??
    (typeof payload.iss === "string" ? payload.iss : profile.issuerDid);
  const subjectDid =
    typeof credentialSubject.id === "string"
      ? credentialSubject.id
      : typeof payload.sub === "string"
        ? payload.sub
        : profile.subjectDid;
  const credentialId =
    typeof vc.id === "string"
      ? vc.id
      : typeof payload.jti === "string"
        ? payload.jti
        : null;
  const workloadId =
    typeof credentialSubject.workloadId === "string"
      ? credentialSubject.workloadId
      : null;
  const validFrom = readIsoDate(vc.validFrom);
  const validUntil = readIsoDate(vc.validUntil);
  const alg = typeof header.alg === "string" ? header.alg : null;
  const kid = typeof header.kid === "string" ? header.kid : null;

  if (header.typ !== "vc+jwt") findings.push("JOSE typ must be vc+jwt.");
  if (
    !alg ||
    !AGENT_VC_ALGORITHMS.includes(alg as (typeof AGENT_VC_ALGORITHMS)[number])
  ) {
    findings.push(
      "JOSE algorithm is not in the ES256, ES384, or EdDSA allowlist."
    );
  }
  if (!kid || !kid.startsWith(`${profile.issuerDid}#`)) {
    findings.push(
      "JOSE kid must be an absolute issuer DID assertion-method URL."
    );
  }
  if (!contextIncludes(vc["@context"], VC_CONTEXT_V2)) {
    findings.push("Credential context must include the W3C VC 2.0 context.");
  }
  if (!credentialTypes.includes("VerifiableCredential")) {
    findings.push("Credential type must include VerifiableCredential.");
  }
  const delegatedTypes = credentialTypes.filter(
    (type) => type !== "VerifiableCredential"
  );
  if (
    delegatedTypes.length === 0 ||
    delegatedTypes.some(
      (type) => !profile.allowedCredentialTypes.includes(type)
    )
  ) {
    findings.push("Credential type is outside the trust profile allowlist.");
  }
  if (issuerDid !== profile.issuerDid || payload.iss !== profile.issuerDid) {
    findings.push("Credential issuer does not match the trust profile.");
  }
  if (subjectDid !== profile.subjectDid || payload.sub !== profile.subjectDid) {
    findings.push("Credential subject does not match the trust profile.");
  }
  if (payload.aud !== profile.expectedAudience) {
    findings.push("Credential audience does not match the trust profile.");
  }
  if (credentialSubject.endpointOrigin !== profile.expectedEndpointOrigin) {
    findings.push(
      "Credential endpoint origin does not match the reviewed endpoint."
    );
  }
  if (
    !workloadId ||
    !/^spiffe:\/\/[a-z0-9.-]+\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/u.test(
      workloadId
    )
  ) {
    findings.push("Credential subject must bind a valid SPIFFE workload ID.");
  }
  if (
    allowedCapabilities.length === 0 ||
    allowedCapabilities.some(
      (capability) => !profile.allowedCapabilityNames.includes(capability)
    )
  ) {
    findings.push("Delegated capabilities exceed the endpoint allowlist.");
  }
  if (!validFrom || !validUntil) {
    findings.push("Credential must declare validFrom and validUntil.");
  } else {
    const ttlSeconds = (validUntil.getTime() - validFrom.getTime()) / 1_000;
    if (validFrom.getTime() > now.getTime() + 60_000) {
      findings.push("Credential is not yet valid.");
    }
    if (validUntil <= now) findings.push("Credential has expired.");
    if (ttlSeconds <= 0 || ttlSeconds > profile.maxCredentialTtlSeconds) {
      findings.push("Credential validity exceeds the endpoint TTL policy.");
    }
    if (
      typeof payload.nbf !== "number" ||
      typeof payload.exp !== "number" ||
      Math.abs(payload.nbf * 1_000 - validFrom.getTime()) > 1_000 ||
      Math.abs(payload.exp * 1_000 - validUntil.getTime()) > 1_000
    ) {
      findings.push("JWT time claims must match VC validity dates.");
    }
  }
  if (vc.credentialStatus !== undefined) {
    findings.push(
      "Credential status methods are not yet supported; verification fails closed."
    );
  }

  const resolved = await resolveDidWebDocument(profile.issuerDid, options);
  const method = kid
    ? findAssertionVerificationMethod(resolved.document, kid)
    : null;
  if (!method) {
    findings.push(
      "JOSE kid is not authorized by the issuer assertionMethod relationship."
    );
  } else {
    if (method.controller !== profile.issuerDid) {
      findings.push(
        "Assertion method controller does not match the issuer DID."
      );
    }
    if (
      Object.keys(method.publicKeyJwk).some((key) =>
        PRIVATE_JWK_FIELDS.has(key)
      )
    ) {
      findings.push("Issuer DID document exposed private JWK material.");
    } else if (
      alg &&
      AGENT_VC_ALGORITHMS.includes(alg as (typeof AGENT_VC_ALGORITHMS)[number])
    ) {
      try {
        const key = await importJWK(method.publicKeyJwk as JWK, alg);
        await compactVerify(credentialJwt, key, {
          algorithms: [...AGENT_VC_ALGORITHMS]
        });
      } catch {
        findings.push("Credential signature verification failed.");
      }
    }
  }

  return {
    algorithm: alg,
    allowedCapabilities,
    claimsHash,
    credentialHash,
    credentialId,
    credentialTypes,
    findings,
    issuerDid,
    issuerDidDocumentHash: resolved.documentHash,
    status:
      findings.length === 0 ? ("Verified" as const) : ("Rejected" as const),
    subjectDid,
    validFrom,
    validUntil,
    verificationMethodId: kid,
    workloadId
  };
}

const VERAISON_SESSION_MEDIA_TYPE =
  "application/vnd.veraison.challenge-response-session+json";
const VeraisonWireSessionSchema = z.object({
  accept: z.array(z.string().trim().min(1).max(240)).min(1).max(20),
  expiry: z.iso.datetime(),
  nonce: z.string().min(1).max(88),
  result: z
    .object({
      claims: z.record(z.string(), z.unknown()).default({}),
      is_valid: z.boolean()
    })
    .optional(),
  state: z.enum(["waiting", "processing", "complete", "failed"])
});

type VeraisonWireSession = z.infer<typeof VeraisonWireSessionSchema>;

function sanitizeOperationalError(error: unknown) {
  return (error instanceof Error ? error.message : String(error))
    .replace(
      /authorization\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/giu,
      "authorization=[redacted]"
    )
    .replace(/bearer\s+[A-Za-z0-9._~+/=-]+/giu, "Bearer [redacted]")
    .replace(/[A-Za-z0-9+/=_-]{160,}/gu, "[long-value-redacted]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 1_000);
}

function veraisonHeaders(extra: Record<string, string> = {}) {
  return {
    accept: VERAISON_SESSION_MEDIA_TYPE,
    ...extra
  };
}

async function readVeraisonSessionResponse(
  response: Response,
  allowedStatuses: number[]
): Promise<VeraisonWireSession> {
  if (!allowedStatuses.includes(response.status)) {
    throw new AppServiceError(
      `The configured Veraison service returned HTTP ${response.status}.`,
      502,
      "veraison_http_error"
    );
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) {
    throw new AppServiceError(
      "The configured Veraison service did not return a session JSON document.",
      502,
      "veraison_content_type_invalid"
    );
  }
  const body = await response.text();
  if (Buffer.byteLength(body) > 10 * 1024 * 1024) {
    throw new AppServiceError(
      "The configured Veraison session response exceeded 10 MB.",
      502,
      "veraison_response_too_large"
    );
  }
  try {
    return VeraisonWireSessionSchema.parse(JSON.parse(body) as unknown);
  } catch {
    throw new AppServiceError(
      "The configured Veraison service returned an invalid challenge-response session document.",
      502,
      "veraison_session_invalid"
    );
  }
}

function hostnameFromScopeValue(value: string) {
  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function scopeAuthorizesHostname(
  scope: { scopeType: string; value: string },
  targetHostname: string
) {
  if (
    !["Domain", "Subdomain", "AIApplicationEndpoint"].includes(scope.scopeType)
  ) {
    return false;
  }
  const scopedHostname = hostnameFromScopeValue(scope.value);
  if (!scopedHostname) return false;
  const normalizedTarget = targetHostname.toLowerCase();
  return (
    normalizedTarget === scopedHostname ||
    normalizedTarget.endsWith(`.${scopedHostname}`)
  );
}

function deriveA2ATckSutHost(endpointUrl: string) {
  const url = new URL(endpointUrl);
  return url.origin;
}

function readClaimPath(claims: Record<string, unknown>, path: string) {
  let current: unknown = claims;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function claimValuesEqual(left: unknown, right: unknown) {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  );
}

function waitFor(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

async function readJsonResponse(response: Response) {
  if (!response.ok) {
    throw new AppServiceError(
      `Protocol discovery returned HTTP ${response.status}.`,
      502,
      "agent_discovery_http_error"
    );
  }
  const type = response.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("json")) {
    throw new AppServiceError(
      "Protocol discovery did not return JSON.",
      502,
      "agent_discovery_content_type"
    );
  }
  const text = await response.text();
  if (text.length > 1_000_000) {
    throw new AppServiceError(
      "Protocol discovery response exceeded 1 MB.",
      502,
      "agent_discovery_too_large"
    );
  }
  return JSON.parse(text) as Record<string, unknown>;
}

async function discoverCapabilities(
  endpoint: { endpointUrl: string; protocol: string },
  devMode: boolean
) {
  const url = await assertDiscoveryTarget(endpoint.endpointUrl, devMode);
  const signal = AbortSignal.timeout(5_000);
  if (endpoint.protocol === "MCP") {
    const response = await fetch(url, {
      body: JSON.stringify({
        id: "periscan-discovery",
        jsonrpc: "2.0",
        method: "tools/list",
        params: {}
      }),
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json"
      },
      method: "POST",
      redirect: "error",
      signal
    });
    const body = await readJsonResponse(response);
    const result = body.result as { tools?: unknown[] } | undefined;
    const tools = Array.isArray(result?.tools) ? result.tools : [];
    return {
      a2aConformance: null,
      capabilities: tools.slice(0, 200).map((raw) => {
        const tool = raw as Record<string, unknown>;
        const inputSchema = tool.inputSchema;
        return {
          description:
            typeof tool.description === "string"
              ? tool.description.slice(0, 2_000)
              : null,
          inputSchemaHash: inputSchema ? sha256(inputSchema) : null,
          name: String(tool.name ?? "").slice(0, 160)
        };
      })
    };
  }

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    redirect: "error",
    signal
  });
  const card = await readJsonResponse(response);
  const skills = Array.isArray(card.skills) ? card.skills : [];
  return {
    a2aConformance: evaluateA2AAgentCard(card, devMode),
    capabilities: skills.slice(0, 200).map((raw) => {
      const skill = raw as Record<string, unknown>;
      return {
        description:
          typeof skill.description === "string"
            ? skill.description.slice(0, 2_000)
            : null,
        inputSchemaHash: skill.inputSchema ? sha256(skill.inputSchema) : null,
        name: String(skill.id ?? skill.name ?? "").slice(0, 160)
      };
    })
  };
}

type ConformanceCheck = A2AAgentCardConformanceReport["checks"][number];

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.length > 0 && value.every(nonEmptyString)
  );
}

export function evaluateA2AAgentCard(
  card: Record<string, unknown>,
  devMode = false,
  checkedAt = new Date()
): A2AAgentCardConformanceReport {
  const checks: ConformanceCheck[] = [];
  const add = (
    checkId: string,
    status: ConformanceCheck["status"],
    message: string
  ) => checks.push({ checkId, message, status });

  const identityValid =
    nonEmptyString(card.name) && nonEmptyString(card.description);
  add(
    "card-identity",
    identityValid ? "Pass" : "Fail",
    identityValid
      ? "Agent Card declares a human-readable name and description."
      : "Agent Card must declare non-empty name and description fields."
  );

  const interfaces = Array.isArray(card.supportedInterfaces)
    ? card.supportedInterfaces
    : [];
  const parsedInterfaces: Array<{
    protocolBinding: string;
    protocolVersion: string;
    url: string;
  }> = [];
  let transportWarning = false;
  for (const raw of interfaces) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (
      !nonEmptyString(item.url) ||
      !nonEmptyString(item.protocolBinding) ||
      !nonEmptyString(item.protocolVersion)
    ) {
      continue;
    }
    try {
      const interfaceUrl = new URL(item.url);
      const localDev =
        devMode &&
        interfaceUrl.protocol === "http:" &&
        ["localhost", "127.0.0.1", "::1"].includes(interfaceUrl.hostname);
      if (interfaceUrl.protocol !== "https:" && !localDev) continue;
      if (localDev) transportWarning = true;
      parsedInterfaces.push({
        protocolBinding: item.protocolBinding,
        protocolVersion: item.protocolVersion,
        url: interfaceUrl.toString()
      });
    } catch {
      // Invalid interfaces are reported by the aggregate check below.
    }
  }
  add(
    "supported-interfaces",
    parsedInterfaces.length > 0 ? "Pass" : "Fail",
    parsedInterfaces.length > 0
      ? `${parsedInterfaces.length} ordered interface declaration${parsedInterfaces.length === 1 ? "" : "s"} include URL, binding, and protocol version.`
      : "Agent Card must declare at least one valid supportedInterfaces entry with URL, protocolBinding, and protocolVersion."
  );
  if (transportWarning) {
    add(
      "development-transport",
      "Warning",
      "A loopback HTTP interface was accepted only because the API is in development mode; production A2A interfaces require HTTPS."
    );
  }

  const modesValid =
    stringArray(card.defaultInputModes) && stringArray(card.defaultOutputModes);
  add(
    "default-content-modes",
    modesValid ? "Pass" : "Fail",
    modesValid
      ? "Default input and output media types are declared."
      : "Agent Card must declare non-empty defaultInputModes and defaultOutputModes arrays."
  );

  const skills = Array.isArray(card.skills) ? card.skills : [];
  const skillsValid =
    skills.length > 0 &&
    skills.every((raw) => {
      if (!raw || typeof raw !== "object") return false;
      const skill = raw as Record<string, unknown>;
      return (
        nonEmptyString(skill.id) &&
        nonEmptyString(skill.name) &&
        nonEmptyString(skill.description) &&
        stringArray(skill.tags)
      );
    });
  add(
    "skill-contracts",
    skillsValid ? "Pass" : "Fail",
    skillsValid
      ? `${skills.length} skill contract${skills.length === 1 ? "" : "s"} declare id, name, description, and tags.`
      : "Every advertised skill must declare id, name, description, and at least one tag."
  );

  const capabilities = card.capabilities;
  const capabilitiesValid =
    capabilities !== null &&
    typeof capabilities === "object" &&
    !Array.isArray(capabilities);
  add(
    "capabilities",
    capabilitiesValid ? "Pass" : "Fail",
    capabilitiesValid
      ? "Agent Card includes an explicit capabilities object."
      : "Agent Card must include an explicit capabilities object."
  );

  const schemes =
    card.securitySchemes && typeof card.securitySchemes === "object"
      ? new Set(Object.keys(card.securitySchemes as Record<string, unknown>))
      : new Set<string>();
  const requirements = Array.isArray(card.security) ? card.security : [];
  const missingSchemes = requirements.flatMap((raw) =>
    raw && typeof raw === "object"
      ? Object.keys(raw as Record<string, unknown>).filter(
          (name) => !schemes.has(name)
        )
      : ["<invalid security requirement>"]
  );
  add(
    "security-references",
    missingSchemes.length === 0 ? "Pass" : "Fail",
    missingSchemes.length === 0
      ? requirements.length > 0
        ? "Every security requirement references a declared security scheme."
        : "No authentication requirement is declared; tenant review must confirm that public access is intentional."
      : `Security requirements reference undeclared schemes: ${missingSchemes.join(", ")}.`
  );

  add(
    "core-operation-probe",
    "Warning",
    "Discovery validates the Agent Card only. SendMessage, GetTask, and CancelTask are not invoked without an explicit, scope-bound interoperability test."
  );

  return A2AAgentCardConformanceReportSchema.parse({
    agentName: nonEmptyString(card.name) ? card.name.slice(0, 160) : null,
    agentVersion: nonEmptyString(card.version)
      ? card.version.slice(0, 120)
      : null,
    cardHash: sha256(card),
    checkedAt: checkedAt.toISOString(),
    checks,
    coreOperationsProbe: "NotRun",
    preferredInterface: parsedInterfaces[0] ?? null,
    signatureStatus:
      Array.isArray(card.signatures) && card.signatures.length > 0
        ? "PresentUnverified"
        : "NotPresent",
    specification: "A2A 1.0 Agent Card",
    structurallyConformant: checks.every((check) => check.status !== "Fail")
  });
}

function attestationAnchors() {
  try {
    const parsed = JSON.parse(
      process.env.PERISCAN_ATTESTATION_TRUST_ANCHORS_JSON ?? "{}"
    ) as Record<string, string>;
    return parsed;
  } catch {
    return {};
  }
}

function decodeJwsClaims(statement: string) {
  const parts = statement.split(".");
  if (parts.length !== 3) return null;
  try {
    return {
      claims: JSON.parse(
        Buffer.from(parts[1]!, "base64url").toString("utf8")
      ) as Record<string, unknown>,
      header: JSON.parse(
        Buffer.from(parts[0]!, "base64url").toString("utf8")
      ) as Record<string, unknown>,
      payload: Buffer.from(`${parts[0]}.${parts[1]}`),
      signature: Buffer.from(parts[2]!, "base64url")
    };
  } catch {
    return null;
  }
}

interface LabeledJws {
  label: string | null;
  token: string;
}

function collectDetachedEatTokens(
  value: unknown,
  label: string | null = null,
  tokens: LabeledJws[] = []
): LabeledJws[] {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value[0] === "JWT" &&
    typeof value[1] === "string"
  ) {
    tokens.push({ label, token: value[1] });
    return tokens;
  }
  if (Array.isArray(value)) {
    value.forEach((child) => collectDetachedEatTokens(child, label, tokens));
    return tokens;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) =>
      collectDetachedEatTokens(child, key, tokens)
    );
  }
  return tokens;
}

function verifyNvidiaJwsSignature(
  decoded: NonNullable<ReturnType<typeof decodeJwsClaims>>,
  trustAnchor: string
) {
  if (decoded.header.alg !== "ES384") return false;
  try {
    return verify(
      "sha384",
      decoded.payload,
      {
        dsaEncoding: "ieee-p1363",
        key: createPublicKey(trustAnchor)
      },
      decoded.signature
    );
  } catch {
    return false;
  }
}

export function verifyNvidiaDetachedEatBundle(
  input: VerifyNvidiaConfidentialGpuAttestationInput,
  trustAnchor: string,
  checkedAt = new Date()
) {
  const findings: string[] = [];
  const addFinding = (finding: string) => {
    if (!findings.includes(finding)) findings.push(finding);
  };
  let bundle: unknown;
  try {
    bundle = JSON.parse(input.signedStatement);
  } catch {
    addFinding(
      "NVIDIA attestation response is not a JSON-encoded detached EAT bundle."
    );
    bundle = null;
  }

  const tokens = collectDetachedEatTokens(bundle);
  const decodedTokens = tokens
    .map((token) => ({ ...token, decoded: decodeJwsClaims(token.token) }))
    .filter(
      (
        token
      ): token is LabeledJws & {
        decoded: NonNullable<ReturnType<typeof decodeJwsClaims>>;
      } => Boolean(token.decoded)
    );
  const overallTokens = decodedTokens.filter(
    ({ decoded }) =>
      typeof decoded.claims["x-nvidia-overall-att-result"] === "boolean"
  );
  const deviceTokens = decodedTokens.filter(
    ({ decoded, label }) =>
      /^gpu-\d+$/iu.test(label ?? "") ||
      Object.keys(decoded.claims).some((key) =>
        /^x-(?:nv|nvidia)-gpu-/u.test(key)
      )
  );

  if (tokens.length === 0)
    addFinding("The detached EAT bundle contains no JWT entries.");
  if (overallTokens.length !== 1) {
    addFinding("The bundle must contain exactly one NVIDIA overall EAT token.");
  }
  if (deviceTokens.length === 0) {
    addFinding("The bundle contains no per-GPU detached EAT tokens.");
  }
  if (tokens.some(({ token }) => !decodeJwsClaims(token))) {
    addFinding("One or more detached EAT JWT entries are malformed.");
  }

  const policyTokens = [...overallTokens, ...deviceTokens];
  const signatureVerified =
    policyTokens.length > 1 &&
    policyTokens.every(({ decoded }) =>
      verifyNvidiaJwsSignature(decoded, trustAnchor)
    );
  if (policyTokens.some(({ decoded }) => decoded.header.alg !== "ES384")) {
    addFinding(
      "Every NVIDIA policy token must use the configured NVAT ES384 signing profile."
    );
  }
  if (!signatureVerified) {
    addFinding("One or more NVIDIA EAT signatures could not be verified.");
  }

  const overall = overallTokens[0]?.decoded.claims ?? {};
  const claimsVersion =
    typeof overall["x-nvidia-ver"] === "string"
      ? overall["x-nvidia-ver"]
      : null;
  if (claimsVersion !== "2.0" && claimsVersion !== "3.0") {
    addFinding("NVIDIA claims version must be 2.0 or 3.0.");
  }
  if (overall["x-nvidia-overall-att-result"] !== true) {
    addFinding("NVIDIA overall attestation result is not successful.");
  }
  if (overall.iss !== input.expectedIssuer) {
    addFinding("NVIDIA overall token issuer does not match tenant policy.");
  }
  if (overall.eat_nonce !== input.expectedNonce) {
    addFinding("NVIDIA overall token nonce does not match the challenge.");
  }

  const nowSeconds = Math.floor(checkedAt.getTime() / 1_000);
  const issuedAt = typeof overall.iat === "number" ? overall.iat : null;
  const expiresAt = typeof overall.exp === "number" ? overall.exp : null;
  if (
    issuedAt === null ||
    issuedAt > nowSeconds + 60 ||
    issuedAt < nowSeconds - input.maxTokenAgeSeconds
  ) {
    addFinding("NVIDIA overall token is outside the allowed freshness window.");
  }
  if (expiresAt === null || expiresAt <= nowSeconds) {
    addFinding("NVIDIA overall token is expired or has no valid expiry.");
  }

  const submods =
    overall.submods && typeof overall.submods === "object"
      ? (overall.submods as Record<string, unknown>)
      : {};
  const deviceLabels = deviceTokens.map(({ label }, index) =>
    /^gpu-\d+$/iu.test(label ?? "") ? label! : `GPU-${index}`
  );
  for (const label of deviceLabels) {
    if (!(label in submods)) {
      addFinding(`Overall token does not bind detached device ${label}.`);
    }
  }

  const hardwareModels: string[] = [];
  for (const [index, { decoded }] of deviceTokens.entries()) {
    const claims = decoded.claims;
    const device = deviceLabels[index] ?? `GPU-${index}`;
    if (claims.iss !== input.expectedIssuer)
      addFinding(`${device} issuer does not match tenant policy.`);
    if (claims.eat_nonce !== input.expectedNonce)
      addFinding(`${device} nonce does not match the challenge.`);
    if (claims["x-nvidia-gpu-arch-check"] !== true)
      addFinding(`${device} architecture check did not pass.`);
    if (
      claims["x-nvidia-gpu-attestation-report-signature-verified"] !== true &&
      claims["x-nv-gpu-attestation-report-verified"] !== true
    ) {
      addFinding(`${device} attestation report signature was not verified.`);
    }
    if (claims["x-nvidia-gpu-driver-rim-signature-verified"] !== true)
      addFinding(`${device} driver RIM signature was not verified.`);
    if (claims["x-nvidia-gpu-vbios-rim-signature-verified"] !== true)
      addFinding(`${device} vBIOS RIM signature was not verified.`);
    if (
      claims["x-nvidia-gpu-attestation-report-nonce-match"] !== true &&
      claims["x-nvidia-gpu-nonce-match"] !== true &&
      claims["x-nv-gpu-nonce-match"] !== true
    ) {
      addFinding(`${device} report nonce check did not pass.`);
    }
    if (
      claims.measres !== "success" &&
      claims.measres !== "comparison-successful" &&
      claims["x-nvidia-gpu-measurements-match"] !== true &&
      claims["x-nv-gpu-measurements-match"] !== "success"
    ) {
      addFinding(`${device} runtime measurements do not match its RIM.`);
    }
    if (input.requireSecureBoot && claims.secboot !== true)
      addFinding(`${device} secure boot is not enabled.`);
    if (input.requireDebugDisabled && claims.dbgstat !== "disabled")
      addFinding(`${device} debug facilities are not disabled.`);
    if (typeof claims.hwmodel === "string") hardwareModels.push(claims.hwmodel);
  }

  if (
    input.expectedGpuModels.length > 0 &&
    hardwareModels.some(
      (model) =>
        !input.expectedGpuModels.some((expected) =>
          model.toLowerCase().includes(expected.toLowerCase())
        )
    )
  ) {
    addFinding("One or more GPU models are outside the tenant allowlist.");
  }
  if (
    input.expectedGpuModels.length > 0 &&
    hardwareModels.length !== deviceTokens.length
  ) {
    addFinding("One or more GPU tokens have no hardware model claim.");
  }

  return {
    claimsVersion,
    debugDisabled:
      deviceTokens.length > 0
        ? deviceTokens.every(
            ({ decoded }) => decoded.claims.dbgstat === "disabled"
          )
        : null,
    deviceCount: deviceTokens.length,
    expiresAt: expiresAt === null ? null : new Date(expiresAt * 1_000),
    findings,
    hardwareModels,
    signatureVerified,
    secureBoot:
      deviceTokens.length > 0
        ? deviceTokens.every(({ decoded }) => decoded.claims.secboot === true)
        : null
  };
}

export function createAgentTrustServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "createAgentExchangeObject"
  | "createAgentDidTrustProfile"
  | "createConfidentialAttestationChallenge"
  | "createTeeAssuranceRequirement"
  | "createVeraisonAttestationSession"
  | "discoverAgentProtocolEndpoint"
  | "getAgentExchangeObject"
  | "getTeeAssuranceWorkspace"
  | "listA2ATckRuns"
  | "listAgentDidTrustProfiles"
  | "listAgentExchangeObjects"
  | "listAgentProtocolEndpoints"
  | "listAgentVerifiableCredentials"
  | "listConfidentialAttestations"
  | "listVeraisonAttestationSessions"
  | "registerAgentProtocolEndpoint"
  | "refreshAgentDidTrustProfile"
  | "reviewAgentProtocolEndpoint"
  | "evaluateTeeAssurance"
  | "revokeTeeAssurance"
  | "revokeAgentDidTrustProfile"
  | "runA2ATck"
  | "updateAgentExchangeObjectState"
  | "verifyAgentSignedReceipt"
  | "verifyAgentVerifiableCredential"
  | "verifyConfidentialAttestation"
  | "verifyVeraisonAttestation"
> {
  const { prisma } = deps;

  async function authorizeTrustValidation(
    context: AuthenticatedContext,
    input: {
      authorizationReason: string;
      scopeId: string;
      safetyLevel: "PassiveReadOnly" | "ActiveNonInvasive";
      target: Record<string, unknown>;
      targetHostname?: string;
    }
  ) {
    const scope = await prisma.scope.findFirst({
      where: {
        scopeId: input.scopeId,
        tenantId: context.tenant.tenantId
      }
    });
    if (!scope) {
      throw new AppServiceError(
        "The authorization scope was not found for this tenant.",
        404,
        "agent_trust_scope_not_found"
      );
    }
    const requestedAction = buildSafeRequestedAction("ControlPlane");
    const evaluated = evaluatePolicy({
      adminApproval: TRUST_ADMIN_ROLES.has(context.membership.role),
      executionEnvironment: "ControlPlane",
      explicitMissionApproval: true,
      missionType: "AIAppValidation",
      requestedAction,
      safetyLevel: input.safetyLevel,
      scopeContext: scope,
      scopeVerificationStatus: scope.verificationStatus,
      target: input.target,
      timeWindowApproved: false,
      userRole: context.membership.role
    });
    const targetInScope = input.targetHostname
      ? scopeAuthorizesHostname(scope, input.targetHostname)
      : true;
    const outcome = targetInScope ? evaluated.outcome : "Denied";
    const approvalState = targetInScope ? evaluated.approvalState : "Rejected";
    const rationale = targetInScope
      ? evaluated.rationale
      : "The A2A endpoint hostname is outside the selected verified domain, subdomain, or AI application endpoint scope.";
    const now = new Date();
    const decision = await prisma.policyDecision.create({
      data: {
        approvalState,
        approvedAt: approvalState === "Approved" ? now : null,
        approvedBy: approvalState === "Approved" ? context.user.userId : null,
        executionEnvironment: "ControlPlane",
        missionType: "AIAppValidation",
        outcome,
        rationale,
        requestedAction: requestedAction as Prisma.InputJsonValue,
        safetyLevel: input.safetyLevel,
        scopeId: scope.scopeId,
        target: {
          ...input.target,
          authorizationReason: input.authorizationReason
        } as Prisma.InputJsonValue,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      }
    });
    await writeAuditEvent(prisma, {
      action: "policy.decision",
      actorType: "User",
      entityId: decision.policyDecisionId,
      entityType: "Scope",
      metadata: {
        missionType: "AIAppValidation",
        outcome,
        scopeId: scope.scopeId,
        trustValidation: true
      },
      tenantId: context.tenant.tenantId,
      userId: context.user.userId
    });
    return { approvalState, decision, outcome, rationale, scope };
  }

  async function readTeeAssuranceRequirement(
    tenantId: string,
    teeAssuranceRequirementId: string
  ) {
    const record = await prisma.teeAssuranceRequirement.findFirst({
      include: {
        decisions: { orderBy: { decidedAt: "desc" }, take: 1 }
      },
      where: { teeAssuranceRequirementId, tenantId }
    });
    if (!record) {
      throw new AppServiceError(
        "The TEE assurance requirement was not found for this tenant.",
        404,
        "tee_assurance_not_found"
      );
    }
    return record;
  }

  return {
    async listAgentProtocolEndpoints(context) {
      const records = await prisma.agentProtocolEndpoint.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeEndpoint);
    },

    async registerAgentProtocolEndpoint(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "register agent protocol endpoints"
      );
      await assertDiscoveryTarget(input.endpointUrl, deps.devMode);
      if (input.publicKeyPem) {
        try {
          createPublicKey(input.publicKeyPem);
        } catch {
          throw new AppServiceError(
            "The endpoint public key is invalid.",
            400,
            "agent_endpoint_public_key_invalid"
          );
        }
      }
      const record = await prisma.agentProtocolEndpoint.create({
        data: {
          createdBy: context.user.userId,
          endpointUrl: input.endpointUrl,
          name: input.name,
          protocol: input.protocol,
          publicKeyPem: input.publicKeyPem ?? null,
          tenantId: context.tenant.tenantId,
          trustPolicy: input.trustPolicy
        }
      });
      return serializeEndpoint(record);
    },

    async reviewAgentProtocolEndpoint(context, endpointId, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "review agent protocol endpoints"
      );
      const existing = await prisma.agentProtocolEndpoint.findFirst({
        where: {
          agentProtocolEndpointId: endpointId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!existing) {
        throw new AppServiceError(
          "Agent protocol endpoint not found.",
          404,
          "agent_endpoint_not_found"
        );
      }
      const discoveredNames = new Set(
        (existing.discoveredCapabilities as Array<{ name: string }>).map(
          (capability) => capability.name
        )
      );
      if (
        input.allowedCapabilityNames.some((name) => !discoveredNames.has(name))
      ) {
        throw new AppServiceError(
          "Only discovered capabilities can be allowlisted.",
          400,
          "agent_capability_not_discovered"
        );
      }
      const updated = await prisma.agentProtocolEndpoint.update({
        data: {
          allowedCapabilityNames: input.allowedCapabilityNames,
          reviewReason: input.reason,
          status: input.status
        },
        where: { agentProtocolEndpointId: endpointId }
      });
      return serializeEndpoint(updated);
    },

    async discoverAgentProtocolEndpoint(context, endpointId) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "discover agent protocol capabilities"
      );
      const endpoint = await prisma.agentProtocolEndpoint.findFirst({
        where: {
          agentProtocolEndpointId: endpointId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!endpoint) {
        throw new AppServiceError(
          "Agent protocol endpoint not found.",
          404,
          "agent_endpoint_not_found"
        );
      }
      if (endpoint.status !== "Approved") {
        throw new AppServiceError(
          "Endpoint must be approved before outbound discovery.",
          409,
          "agent_endpoint_not_approved"
        );
      }
      const discovery = await discoverCapabilities(endpoint, deps.devMode);
      const capabilities = discovery.capabilities.filter(
        (item) => item.name.length > 0
      );
      const discoveredAt = new Date();
      const updated = await prisma.agentProtocolEndpoint.update({
        data: {
          a2aConformance: discovery.a2aConformance ?? undefined,
          allowedCapabilityNames: [],
          discoveredAt,
          discoveredCapabilities: capabilities,
          reviewReason:
            "Capabilities changed or were refreshed; explicit import review is required."
        },
        where: { agentProtocolEndpointId: endpointId }
      });
      return {
        a2aConformance: discovery.a2aConformance,
        capabilities,
        discoveredAt: discoveredAt.toISOString(),
        endpoint: serializeEndpoint(updated),
        importedAutomatically: false as const,
        protocol: endpoint.protocol as "MCP" | "A2A"
      };
    },

    async listA2ATckRuns(context) {
      const records = await prisma.a2ATckRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeA2ATckRun);
    },

    async runA2ATck(context, endpointId, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "run A2A protocol conformance tests"
      );
      const endpoint = await prisma.agentProtocolEndpoint.findFirst({
        where: {
          agentProtocolEndpointId: endpointId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!endpoint || endpoint.protocol !== "A2A") {
        throw new AppServiceError(
          "An A2A endpoint was not found for this tenant.",
          404,
          "a2a_tck_endpoint_not_found"
        );
      }
      if (endpoint.status !== "Approved") {
        throw new AppServiceError(
          "The A2A endpoint must be approved before the TCK can send test traffic.",
          409,
          "a2a_tck_endpoint_not_approved"
        );
      }
      const cardConformance = endpoint.a2aConformance
        ? A2AAgentCardConformanceReportSchema.parse(endpoint.a2aConformance)
        : null;
      if (!cardConformance?.structurallyConformant) {
        throw new AppServiceError(
          "Run successful Agent Card discovery before invoking the official A2A TCK.",
          409,
          "a2a_tck_discovery_required"
        );
      }
      const endpointTarget = await assertDiscoveryTarget(
        endpoint.endpointUrl,
        deps.devMode
      );
      const authorization = await authorizeTrustValidation(context, {
        authorizationReason: input.authorizationReason,
        safetyLevel: "ActiveNonInvasive",
        scopeId: input.scopeId,
        target: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          level: input.level,
          testTrafficAcknowledged: input.acknowledgeTestTraffic,
          transports: input.transports
        },
        targetHostname: endpointTarget.hostname
      });
      const startedAt = new Date();
      const initial = await prisma.a2ATckRun.create({
        data: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          authorizationReason: input.authorizationReason,
          failureReason:
            authorization.outcome === "Allowed"
              ? null
              : authorization.rationale,
          level: input.level,
          policyDecisionId: authorization.decision.policyDecisionId,
          scopeId: authorization.scope.scopeId,
          startedAt,
          status:
            authorization.outcome === "Allowed" ? "Running" : "DeniedByPolicy",
          tenantId: context.tenant.tenantId,
          toolVersion: A2A_TCK_PINNED_VERSION,
          transports: input.transports,
          triggeredBy: context.user.userId
        }
      });
      if (authorization.outcome !== "Allowed") {
        return serializeA2ATckRun(initial);
      }

      try {
        const proof = await deps.a2aTckExecutor({
          level: input.level,
          sutHost: deriveA2ATckSutHost(endpoint.endpointUrl),
          transports: input.transports
        });
        const completedAt = new Date();
        const completed = await prisma.a2ATckRun.update({
          data: {
            compatible: proof.compatible,
            completedAt,
            mayCompatibility: proof.mayCompatibility,
            mustCompatibility: proof.mustCompatibility,
            overallCompatibility: proof.overallCompatibility,
            reportHash: proof.reportHash,
            requirementResults:
              proof.requirementResults as Prisma.InputJsonValue,
            shouldCompatibility: proof.shouldCompatibility,
            specVersion: proof.specVersion,
            status: "Completed",
            toolVersion: proof.toolVersion,
            transportResults: proof.transportResults as Prisma.InputJsonValue
          },
          where: { a2aTckRunId: initial.a2aTckRunId }
        });
        await writeAuditEvent(prisma, {
          action: "module.executed",
          actorType: "User",
          entityId: authorization.scope.scopeId,
          entityType: "Scope",
          metadata: {
            a2aTckRunId: initial.a2aTckRunId,
            compatible: proof.compatible,
            endpointId: endpoint.agentProtocolEndpointId,
            reportHash: proof.reportHash,
            tool: "a2a-tck",
            toolVersion: proof.toolVersion
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return serializeA2ATckRun(completed);
      } catch (error) {
        const failureReason = sanitizeOperationalError(error);
        const failed = await prisma.a2ATckRun.update({
          data: {
            completedAt: new Date(),
            failureReason:
              failureReason || "The official A2A TCK execution failed.",
            status: "Failed"
          },
          where: { a2aTckRunId: initial.a2aTckRunId }
        });
        await writeAuditEvent(prisma, {
          action: "module.executed",
          actorType: "User",
          entityId: authorization.scope.scopeId,
          entityType: "Scope",
          metadata: {
            a2aTckRunId: initial.a2aTckRunId,
            endpointId: endpoint.agentProtocolEndpointId,
            status: "Failed",
            tool: "a2a-tck"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return serializeA2ATckRun(failed);
      }
    },

    async listAgentDidTrustProfiles(context) {
      const records = await prisma.agentDidTrustProfile.findMany({
        orderBy: { updatedAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeDidTrustProfile);
    },

    async createAgentDidTrustProfile(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "establish AgentDID trust profiles"
      );
      const endpoint = await prisma.agentProtocolEndpoint.findFirst({
        where: {
          agentProtocolEndpointId: input.agentProtocolEndpointId,
          tenantId: context.tenant.tenantId
        }
      });
      const conformance = endpoint?.a2aConformance
        ? A2AAgentCardConformanceReportSchema.parse(endpoint.a2aConformance)
        : null;
      if (
        !endpoint ||
        endpoint.protocol !== "A2A" ||
        endpoint.status !== "Approved" ||
        !conformance?.structurallyConformant ||
        endpoint.allowedCapabilityNames.length === 0
      ) {
        throw new AppServiceError(
          "AgentDID trust requires an approved, structurally conformant A2A endpoint with reviewed capabilities.",
          409,
          "agent_did_endpoint_not_ready"
        );
      }
      const endpointTarget = await assertDiscoveryTarget(
        endpoint.endpointUrl,
        deps.devMode
      );
      const expectedEndpointOrigin = new URL(
        conformance.preferredInterface?.url ?? endpoint.endpointUrl
      ).origin;
      const endpointPolicy = endpoint.trustPolicy as {
        allowedAudience: string;
      };
      if (input.expectedAudience !== endpointPolicy.allowedAudience) {
        throw new AppServiceError(
          "The credential audience must match the endpoint receipt audience.",
          400,
          "agent_did_audience_mismatch"
        );
      }
      const duplicate = await prisma.agentDidTrustProfile.findFirst({
        where: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          issuerDid: input.issuerDid,
          status: "Active",
          subjectDid: input.subjectDid,
          tenantId: context.tenant.tenantId
        }
      });
      if (duplicate) return serializeDidTrustProfile(duplicate);

      const authorization = await authorizeTrustValidation(context, {
        authorizationReason: input.authorizationReason,
        safetyLevel: "PassiveReadOnly",
        scopeId: input.scopeId,
        target: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          issuerDid: input.issuerDid,
          operation: "ResolveAgentDids",
          subjectDid: input.subjectDid
        },
        targetHostname: endpointTarget.hostname
      });
      if (authorization.outcome !== "Allowed") {
        throw new AppServiceError(
          authorization.rationale,
          403,
          "agent_did_policy_denied"
        );
      }
      const [subject, issuer] = await Promise.all([
        resolveDidWebDocument(input.subjectDid, {
          devMode: deps.devMode,
          fetchImpl: deps.fetchImpl
        }),
        resolveDidWebDocument(input.issuerDid, {
          devMode: deps.devMode,
          fetchImpl: deps.fetchImpl
        })
      ]);
      const record = await prisma.agentDidTrustProfile.create({
        data: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          allowedCredentialTypes: [...new Set(input.allowedCredentialTypes)],
          authorizationReason: input.authorizationReason,
          createdBy: context.user.userId,
          expectedAudience: input.expectedAudience,
          expectedEndpointOrigin,
          issuerDid: input.issuerDid,
          issuerDidDocumentHash: issuer.documentHash,
          issuerResolutionUrl: issuer.resolutionUrl,
          issuerResolvedAt: issuer.resolvedAt,
          policyDecisionId: authorization.decision.policyDecisionId,
          scopeId: authorization.scope.scopeId,
          subjectDid: input.subjectDid,
          subjectDidDocumentHash: subject.documentHash,
          subjectResolutionUrl: subject.resolutionUrl,
          subjectResolvedAt: subject.resolvedAt,
          tenantId: context.tenant.tenantId
        }
      });
      await writeAuditEvent(prisma, {
        action: "module.executed",
        actorType: "User",
        entityId: endpoint.agentProtocolEndpointId,
        entityType: "Integration",
        metadata: {
          agentDidTrustProfileId: record.agentDidTrustProfileId,
          issuerDidDocumentHash: issuer.documentHash,
          operation: "AgentDIDTrustEstablished",
          rawCredentialStored: false,
          rawDidDocumentStored: false,
          subjectDidDocumentHash: subject.documentHash
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeDidTrustProfile(record);
    },

    async refreshAgentDidTrustProfile(context, profileId, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "refresh AgentDID trust profiles"
      );
      const profile = await prisma.agentDidTrustProfile.findFirst({
        where: {
          agentDidTrustProfileId: profileId,
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });
      if (!profile) {
        throw new AppServiceError(
          "Active AgentDID trust profile not found.",
          404,
          "agent_did_profile_not_found"
        );
      }
      const [subject, issuer] = await Promise.all([
        resolveDidWebDocument(profile.subjectDid, {
          devMode: deps.devMode,
          fetchImpl: deps.fetchImpl
        }),
        resolveDidWebDocument(profile.issuerDid, {
          devMode: deps.devMode,
          fetchImpl: deps.fetchImpl
        })
      ]);
      const changed =
        subject.documentHash !== profile.subjectDidDocumentHash ||
        issuer.documentHash !== profile.issuerDidDocumentHash;
      const updated = await prisma.$transaction(async (tx) => {
        const refreshed = await tx.agentDidTrustProfile.update({
          data: {
            authorizationReason: input.reason,
            issuerDidDocumentHash: issuer.documentHash,
            issuerResolutionUrl: issuer.resolutionUrl,
            issuerResolvedAt: issuer.resolvedAt,
            subjectDidDocumentHash: subject.documentHash,
            subjectResolutionUrl: subject.resolutionUrl,
            subjectResolvedAt: subject.resolvedAt
          },
          where: { agentDidTrustProfileId: profileId }
        });
        if (changed) {
          await tx.agentVerifiableCredential.updateMany({
            data: {
              findings: [
                "DID document changed after verification; credential must be re-issued and re-verified."
              ],
              status: "Revoked"
            },
            where: {
              agentDidTrustProfileId: profileId,
              status: "Verified"
            }
          });
        }
        return refreshed;
      });
      await writeAuditEvent(prisma, {
        action: "module.executed",
        actorType: "User",
        entityId: profile.agentProtocolEndpointId,
        entityType: "Integration",
        metadata: {
          agentDidTrustProfileId: profileId,
          credentialsRevoked: changed,
          didDocumentsChanged: changed,
          operation: "AgentDIDTrustRefreshed",
          reason: input.reason
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeDidTrustProfile(updated);
    },

    async revokeAgentDidTrustProfile(context, profileId, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "revoke AgentDID trust profiles"
      );
      const profile = await prisma.agentDidTrustProfile.findFirst({
        where: {
          agentDidTrustProfileId: profileId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!profile) {
        throw new AppServiceError(
          "AgentDID trust profile not found.",
          404,
          "agent_did_profile_not_found"
        );
      }
      if (profile.status === "Revoked")
        return serializeDidTrustProfile(profile);
      const revokedAt = new Date();
      const revoked = await prisma.$transaction(async (tx) => {
        const updated = await tx.agentDidTrustProfile.update({
          data: {
            revokedAt,
            revokedBy: context.user.userId,
            revocationReason: input.reason,
            status: "Revoked"
          },
          where: { agentDidTrustProfileId: profileId }
        });
        await tx.agentVerifiableCredential.updateMany({
          data: {
            findings: ["The tenant revoked the AgentDID trust profile."],
            status: "Revoked"
          },
          where: {
            agentDidTrustProfileId: profileId,
            status: "Verified"
          }
        });
        return updated;
      });
      await writeAuditEvent(prisma, {
        action: "module.executed",
        actorType: "User",
        entityId: profile.agentProtocolEndpointId,
        entityType: "Integration",
        metadata: {
          agentDidTrustProfileId: profileId,
          operation: "AgentDIDTrustRevoked",
          reason: input.reason
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeDidTrustProfile(revoked);
    },

    async listAgentVerifiableCredentials(context) {
      await prisma.agentVerifiableCredential.updateMany({
        data: {
          findings: ["Credential validity window has ended."],
          status: "Expired"
        },
        where: {
          status: "Verified",
          tenantId: context.tenant.tenantId,
          validUntil: { lt: new Date() }
        }
      });
      const records = await prisma.agentVerifiableCredential.findMany({
        orderBy: { verifiedAt: "desc" },
        take: 200,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeAgentVerifiableCredential);
    },

    async verifyAgentVerifiableCredential(context, input) {
      requireRole(
        context.membership.role,
        TRUST_OPERATOR_ROLES,
        "verify agent verifiable credentials"
      );
      const profile = await prisma.agentDidTrustProfile.findFirst({
        include: { endpoint: true },
        where: {
          agentDidTrustProfileId: input.profileId,
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });
      if (!profile || profile.endpoint.status !== "Approved") {
        throw new AppServiceError(
          "An active AgentDID profile for an approved endpoint was not found.",
          409,
          "agent_did_profile_untrusted"
        );
      }
      const credentialHash = createHash("sha256")
        .update(input.credentialJwt)
        .digest("hex");
      const existing = await prisma.agentVerifiableCredential.findUnique({
        where: {
          agentDidTrustProfileId_credentialHash: {
            agentDidTrustProfileId: profile.agentDidTrustProfileId,
            credentialHash
          }
        }
      });
      if (existing) return serializeAgentVerifiableCredential(existing);

      let result: Awaited<ReturnType<typeof verifyAgentCredentialJwt>>;
      try {
        const policy = profile.endpoint.trustPolicy as {
          maxCredentialTtlSeconds: number;
        };
        result = await verifyAgentCredentialJwt(
          input.credentialJwt,
          {
            allowedCapabilityNames: profile.endpoint.allowedCapabilityNames,
            allowedCredentialTypes: profile.allowedCredentialTypes,
            expectedAudience: profile.expectedAudience,
            expectedEndpointOrigin: profile.expectedEndpointOrigin,
            issuerDid: profile.issuerDid,
            maxCredentialTtlSeconds: policy.maxCredentialTtlSeconds,
            subjectDid: profile.subjectDid
          },
          { devMode: deps.devMode, fetchImpl: deps.fetchImpl }
        );
      } catch (caught) {
        result = {
          algorithm: null,
          allowedCapabilities: [],
          claimsHash: credentialHash,
          credentialHash,
          credentialId: null,
          credentialTypes: [],
          findings: [sanitizeOperationalError(caught)],
          issuerDid: profile.issuerDid,
          issuerDidDocumentHash: profile.issuerDidDocumentHash,
          status: "Rejected",
          subjectDid: profile.subjectDid,
          validFrom: null,
          validUntil: null,
          verificationMethodId: null,
          workloadId: null
        };
      }
      const record = await prisma.agentVerifiableCredential.create({
        data: {
          agentDidTrustProfileId: profile.agentDidTrustProfileId,
          algorithm: result.algorithm,
          allowedCapabilities: result.allowedCapabilities,
          claimsHash: result.claimsHash,
          credentialHash: result.credentialHash,
          credentialId: result.credentialId,
          credentialTypes: result.credentialTypes,
          findings: result.findings,
          issuerDid: result.issuerDid,
          issuerDidDocumentHash: result.issuerDidDocumentHash,
          status: result.status,
          subjectDid: result.subjectDid,
          tenantId: context.tenant.tenantId,
          validFrom: result.validFrom,
          validUntil: result.validUntil,
          verificationMethodId: result.verificationMethodId,
          verifiedAt: new Date(),
          workloadId: result.workloadId
        }
      });
      await writeAuditEvent(prisma, {
        action: "module.executed",
        actorType: "User",
        entityId: profile.agentProtocolEndpointId,
        entityType: "Integration",
        metadata: {
          agentDidTrustProfileId: profile.agentDidTrustProfileId,
          agentVerifiableCredentialId: record.agentVerifiableCredentialId,
          credentialHash: record.credentialHash,
          operation: "AgentVerifiableCredentialVerified",
          rawCredentialStored: false,
          status: record.status
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeAgentVerifiableCredential(record);
    },

    async verifyAgentSignedReceipt(context, input) {
      requireRole(
        context.membership.role,
        TRUST_OPERATOR_ROLES,
        "verify agent receipts"
      );
      const endpoint = await prisma.agentProtocolEndpoint.findFirst({
        where: {
          agentProtocolEndpointId: input.agentProtocolEndpointId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!endpoint || endpoint.status !== "Approved") {
        throw new AppServiceError(
          "Receipt endpoint is not approved for this tenant.",
          409,
          "agent_receipt_endpoint_untrusted"
        );
      }
      const evidenceCount = await prisma.evidenceArtifact.count({
        where: {
          evidenceId: { in: input.evidenceIds },
          tenantId: context.tenant.tenantId
        }
      });
      if (evidenceCount !== new Set(input.evidenceIds).size) {
        throw new AppServiceError(
          "One or more receipt evidence references were not found.",
          400,
          "agent_receipt_evidence_not_found"
        );
      }
      const replayedNonce = await prisma.agentSignedReceipt.findUnique({
        where: {
          tenantId_nonce: {
            nonce: input.nonce,
            tenantId: context.tenant.tenantId
          }
        }
      });
      if (replayedNonce) {
        throw new AppServiceError(
          "Receipt nonce has already been used.",
          409,
          "agent_receipt_nonce_replayed"
        );
      }
      const policy = endpoint.trustPolicy as {
        allowedAudience: string;
        maxCredentialTtlSeconds: number;
        requireAgentDidCredential?: boolean;
        requireSpiffeIdentity: boolean;
      };
      const issuedAt = new Date(input.issuedAt);
      const expiresAt = new Date(input.expiresAt);
      const now = new Date();
      const ttlSeconds = (expiresAt.getTime() - issuedAt.getTime()) / 1_000;
      const reasons: string[] = [];
      const agentCredential = input.agentVerifiableCredentialId
        ? await prisma.agentVerifiableCredential.findFirst({
            include: { profile: true },
            where: {
              agentVerifiableCredentialId: input.agentVerifiableCredentialId,
              tenantId: context.tenant.tenantId
            }
          })
        : null;
      if (
        policy.requireAgentDidCredential &&
        !input.agentVerifiableCredentialId
      ) {
        reasons.push("verified AgentDID credential required");
      }
      if (input.agentVerifiableCredentialId && !agentCredential) {
        reasons.push("AgentDID credential was not found for this tenant");
      }
      if (agentCredential) {
        if (
          agentCredential.status !== "Verified" ||
          agentCredential.profile.status !== "Active" ||
          agentCredential.profile.agentProtocolEndpointId !==
            endpoint.agentProtocolEndpointId
        ) {
          reasons.push("AgentDID credential is not active for this endpoint");
        }
        if (
          !agentCredential.validFrom ||
          !agentCredential.validUntil ||
          issuedAt < agentCredential.validFrom ||
          expiresAt > agentCredential.validUntil ||
          agentCredential.validUntil <= now
        ) {
          reasons.push(
            "receipt is outside the AgentDID credential validity window"
          );
        }
        if (agentCredential.workloadId !== input.senderWorkloadId) {
          reasons.push(
            "receipt workload does not match the AgentDID credential"
          );
        }
      }
      if (input.audience !== policy.allowedAudience)
        reasons.push("audience mismatch");
      if (expiresAt <= now) reasons.push("receipt expired");
      if (issuedAt.getTime() > now.getTime() + 60_000)
        reasons.push("issued in the future");
      if (ttlSeconds <= 0 || ttlSeconds > policy.maxCredentialTtlSeconds) {
        reasons.push("credential TTL exceeds tenant policy");
      }
      if (
        policy.requireSpiffeIdentity &&
        !input.senderWorkloadId.startsWith("spiffe://")
      ) {
        reasons.push("SPIFFE workload identity required");
      }
      let signatureValid = false;
      if (endpoint.publicKeyPem) {
        try {
          signatureValid = verify(
            "sha256",
            signableAgentReceipt(input),
            createPublicKey(endpoint.publicKeyPem),
            Buffer.from(input.signature, "base64url")
          );
        } catch {
          signatureValid = false;
        }
      }
      if (!signatureValid) reasons.push("signature verification failed");
      const verificationStatus = reasons.length === 0 ? "Verified" : "Rejected";
      const record = await prisma.agentSignedReceipt.create({
        data: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          agentVerifiableCredentialId:
            agentCredential?.agentVerifiableCredentialId ?? null,
          audience: input.audience,
          evidenceIds: [...new Set(input.evidenceIds)],
          expiresAt,
          issuedAt,
          nonce: input.nonce,
          payloadDigest: input.payloadDigest,
          receiptKind: input.receiptKind,
          senderWorkloadId: input.senderWorkloadId,
          signature: input.signature,
          tenantId: context.tenant.tenantId,
          verificationReason:
            reasons.length === 0
              ? agentCredential
                ? "Signature, AgentDID delegation, SPIFFE workload identity, audience, freshness, nonce, and evidence references verified."
                : "Signature, workload identity, audience, freshness, nonce, and evidence references verified."
              : reasons.join("; "),
          verificationStatus,
          verifiedAt: now
        }
      });
      return serializeReceipt(record);
    },

    async listAgentExchangeObjects(context) {
      const records = await prisma.agentExchangeObject.findMany({
        orderBy: { updatedAt: "desc" },
        take: 200,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeExchange);
    },

    async getAgentExchangeObject(context, objectId) {
      const record = await prisma.agentExchangeObject.findFirst({
        where: {
          agentExchangeObjectId: objectId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!record) {
        throw new AppServiceError(
          "Agent exchange object not found.",
          404,
          "agent_exchange_object_not_found"
        );
      }
      return serializeExchange(record);
    },

    async createAgentExchangeObject(context, input) {
      requireRole(
        context.membership.role,
        TRUST_OPERATOR_ROLES,
        "create agent exchange objects"
      );
      assertRedactedPayload(input.payloadRedacted);
      const endpoint = await prisma.agentProtocolEndpoint.findFirst({
        where: {
          agentProtocolEndpointId: input.agentProtocolEndpointId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!endpoint || endpoint.status !== "Approved") {
        throw new AppServiceError(
          "Agent endpoint is not approved.",
          409,
          "agent_endpoint_not_approved"
        );
      }
      const existing = await prisma.agentExchangeObject.findUnique({
        where: {
          tenantId_idempotencyKey: {
            idempotencyKey: input.idempotencyKey,
            tenantId: context.tenant.tenantId
          }
        }
      });
      if (existing) return serializeExchange(existing);
      const policy = endpoint.trustPolicy as {
        requireSignedArtifacts: boolean;
      };
      let receipt: Awaited<
        ReturnType<typeof prisma.agentSignedReceipt.findFirst>
      > = null;
      if (input.signedReceiptId) {
        receipt = await prisma.agentSignedReceipt.findFirst({
          where: {
            agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
            agentSignedReceiptId: input.signedReceiptId,
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        });
      }
      if (
        policy.requireSignedArtifacts &&
        input.kind === "Artifact" &&
        !receipt
      ) {
        throw new AppServiceError(
          "Tenant policy requires a verified signed receipt for artifacts.",
          409,
          "agent_artifact_receipt_required"
        );
      }
      if (receipt) {
        if (receipt.expiresAt <= new Date()) {
          throw new AppServiceError(
            "The signed receipt has expired.",
            409,
            "agent_receipt_expired"
          );
        }
        if (receipt.payloadDigest !== sha256(input.payloadRedacted)) {
          throw new AppServiceError(
            "Signed receipt digest does not match the redacted payload.",
            409,
            "agent_receipt_payload_mismatch"
          );
        }
      }
      const record = await prisma.agentExchangeObject.create({
        data: {
          agentProtocolEndpointId: endpoint.agentProtocolEndpointId,
          evidenceIds: input.evidenceIds,
          idempotencyKey: input.idempotencyKey,
          kind: input.kind,
          parentObjectId: input.parentObjectId ?? null,
          payloadRedacted: input.payloadRedacted as Prisma.InputJsonValue,
          signedReceiptId: receipt?.agentSignedReceiptId ?? null,
          tenantId: context.tenant.tenantId
        }
      });
      return serializeExchange(record);
    },

    async updateAgentExchangeObjectState(context, objectId, input) {
      requireRole(
        context.membership.role,
        TRUST_OPERATOR_ROLES,
        "transition agent exchange objects"
      );
      const object = await prisma.agentExchangeObject.findFirst({
        where: {
          agentExchangeObjectId: objectId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!object) {
        throw new AppServiceError(
          "Agent exchange object not found.",
          404,
          "agent_exchange_object_not_found"
        );
      }
      const allowed: Record<string, string[]> = {
        InputRequired: ["Working", "Cancelled"],
        Submitted: ["Working", "Cancelled", "Failed"],
        Working: ["InputRequired", "Completed", "Failed", "Cancelled"]
      };
      if (!(allowed[object.state] ?? []).includes(input.state)) {
        throw new AppServiceError(
          `Agent exchange transition ${object.state} → ${input.state} is not allowed.`,
          409,
          "agent_exchange_transition_invalid"
        );
      }
      const updated = await prisma.agentExchangeObject.update({
        data: { state: input.state, stateReason: input.reason },
        where: { agentExchangeObjectId: objectId }
      });
      return serializeExchange(updated);
    },

    async getTeeAssuranceWorkspace(context) {
      const [requirements, attestations, scopes] = await Promise.all([
        prisma.teeAssuranceRequirement.findMany({
          include: {
            decisions: { orderBy: { decidedAt: "desc" }, take: 1 }
          },
          orderBy: { createdAt: "desc" },
          take: 100,
          where: { tenantId: context.tenant.tenantId }
        }),
        prisma.confidentialAttestation.findMany({
          orderBy: { checkedAt: "desc" },
          take: 100,
          where: {
            tenantId: context.tenant.tenantId,
            verifierType: "Veraison"
          }
        }),
        prisma.scope.findMany({
          orderBy: { createdAt: "desc" },
          select: {
            scopeId: true,
            scopeType: true,
            value: true,
            verificationStatus: true
          },
          take: 100,
          where: {
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        })
      ]);
      return TeeAssuranceWorkspaceSchema.parse({
        assurances: requirements.map((record) =>
          serializeTeeAssuranceRequirement(record)
        ),
        attestations: attestations.map(serializeAttestation),
        qualificationRulesVersion: "1.0",
        scopes
      });
    },

    async createTeeAssuranceRequirement(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "create TEE assurance requirements"
      );
      const authorization = await authorizeTrustValidation(context, {
        authorizationReason: input.authorizationReason,
        safetyLevel: "PassiveReadOnly",
        scopeId: input.scopeId,
        target: {
          action: "define_tee_assurance_requirement",
          provider: input.provider,
          verifierType: input.verifierType,
          workloadId: input.workloadId
        }
      });
      if (authorization.outcome !== "Allowed") {
        throw new AppServiceError(
          authorization.rationale,
          400,
          "policy_denied"
        );
      }
      const record = await prisma.teeAssuranceRequirement.create({
        data: {
          ...input,
          createdBy: context.user.userId,
          policyDecisionId: authorization.decision.policyDecisionId,
          tenantId: context.tenant.tenantId
        },
        include: { decisions: true }
      });
      await writeAuditEvent(prisma, {
        action: "tee_assurance.requirement_created",
        actorType: "User",
        entityId: authorization.scope.scopeId,
        entityType: "Scope",
        metadata: {
          policyDecisionId: authorization.decision.policyDecisionId,
          provider: input.provider,
          teeAssuranceRequirementId: record.teeAssuranceRequirementId,
          verifierType: input.verifierType,
          workloadId: input.workloadId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeTeeAssuranceRequirement(record);
    },

    async evaluateTeeAssurance(context, teeAssuranceRequirementId, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "evaluate TEE assurance requirements"
      );
      const requirement = await readTeeAssuranceRequirement(
        context.tenant.tenantId,
        teeAssuranceRequirementId
      );
      const priorDecision = await prisma.teeAssuranceDecision.findFirst({
        where: {
          attestationId: input.attestationId,
          decisionType: { in: ["Qualified", "Rejected"] },
          teeAssuranceRequirementId,
          tenantId: context.tenant.tenantId
        }
      });
      if (priorDecision) {
        throw new AppServiceError(
          "This attestation already has a sealed qualification decision for the requirement. Collect fresh evidence before deciding again.",
          409,
          "tee_assurance_attestation_already_decided"
        );
      }
      const attestation = await prisma.confidentialAttestation.findFirst({
        include: { veraisonSession: true },
        where: {
          confidentialAttestationId: input.attestationId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!attestation) {
        throw new AppServiceError(
          "The selected attestation was not found for this tenant.",
          404,
          "tee_assurance_attestation_not_found"
        );
      }
      const now = new Date();
      const findings = evaluateTeeAssuranceEvidence(
        requirement,
        attestation,
        attestation.veraisonSession,
        context.tenant.tenantId,
        now
      );
      const decisionType = findings.length === 0 ? "Qualified" : "Rejected";
      const requestedUntil = new Date(
        now.getTime() + requirement.qualificationValidityMinutes * 60_000
      );
      const qualifiedUntil =
        decisionType === "Qualified" && attestation.expiresAt
          ? new Date(
              Math.min(
                requestedUntil.getTime(),
                attestation.expiresAt.getTime()
              )
            )
          : null;
      const decision = await prisma.teeAssuranceDecision.create({
        data: {
          attestationCheckedAt: attestation.checkedAt,
          attestationId: attestation.confidentialAttestationId,
          attestationRawClaimsHash: attestation.rawClaimsHash,
          attestationResultClaimsHash: attestation.resultClaimsHash,
          decidedAt: now,
          decidedBy: context.user.userId,
          decisionReason: input.decisionReason,
          decisionReference: input.decisionReference,
          decisionType,
          findings,
          qualifiedUntil,
          teeAssuranceRequirementId,
          tenantId: context.tenant.tenantId
        }
      });
      await writeAuditEvent(prisma, {
        action: "tee_assurance.evaluated",
        actorType: "User",
        entityId: requirement.scopeId,
        entityType: "Scope",
        metadata: {
          attestationId: attestation.confidentialAttestationId,
          decisionReference: input.decisionReference,
          decisionType,
          qualifiedUntil: qualifiedUntil?.toISOString() ?? null,
          teeAssuranceDecisionId: decision.teeAssuranceDecisionId,
          teeAssuranceRequirementId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeTeeAssuranceRequirement(
        await readTeeAssuranceRequirement(
          context.tenant.tenantId,
          teeAssuranceRequirementId
        ),
        now
      );
    },

    async revokeTeeAssurance(context, teeAssuranceRequirementId, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "revoke TEE assurance qualifications"
      );
      const requirement = await readTeeAssuranceRequirement(
        context.tenant.tenantId,
        teeAssuranceRequirementId
      );
      const latest = requirement.decisions[0];
      if (!latest || latest.decisionType !== "Qualified") {
        throw new AppServiceError(
          "Only the latest qualified receipt can be revoked.",
          409,
          "tee_assurance_not_qualified"
        );
      }
      const decidedAt = new Date();
      const decision = await prisma.teeAssuranceDecision.create({
        data: {
          attestationCheckedAt: latest.attestationCheckedAt,
          attestationId: latest.attestationId,
          attestationRawClaimsHash: latest.attestationRawClaimsHash,
          attestationResultClaimsHash: latest.attestationResultClaimsHash,
          decidedAt,
          decidedBy: context.user.userId,
          decisionReason: input.decisionReason,
          decisionReference: input.decisionReference,
          decisionType: "Revoked",
          findings: ["The previous qualification was explicitly revoked."],
          qualifiedUntil: null,
          teeAssuranceRequirementId,
          tenantId: context.tenant.tenantId
        }
      });
      await writeAuditEvent(prisma, {
        action: "tee_assurance.revoked",
        actorType: "User",
        entityId: requirement.scopeId,
        entityType: "Scope",
        metadata: {
          attestationId: latest.attestationId,
          decisionReference: input.decisionReference,
          teeAssuranceDecisionId: decision.teeAssuranceDecisionId,
          teeAssuranceRequirementId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeTeeAssuranceRequirement(
        await readTeeAssuranceRequirement(
          context.tenant.tenantId,
          teeAssuranceRequirementId
        ),
        decidedAt
      );
    },

    async listConfidentialAttestations(context) {
      const records = await prisma.confidentialAttestation.findMany({
        orderBy: { checkedAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeAttestation);
    },

    async listVeraisonAttestationSessions(context) {
      const records = await prisma.veraisonAttestationSession.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map((record) => serializeVeraisonSession(record));
    },

    async createVeraisonAttestationSession(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "create Veraison attestation sessions"
      );
      const verifierBase = await assertDiscoveryTarget(
        input.verifierUrl,
        deps.devMode
      );
      const authorization = await authorizeTrustValidation(context, {
        authorizationReason: input.authorizationReason,
        safetyLevel: "PassiveReadOnly",
        scopeId: input.scopeId,
        target: {
          provider: input.provider,
          verifierOrigin: verifierBase.origin,
          workloadId: input.workloadId
        }
      });
      if (authorization.outcome !== "Allowed") {
        throw new AppServiceError(
          authorization.rationale,
          400,
          "policy_denied"
        );
      }

      const newSessionUrl = new URL(
        "/challenge-response/v1/newSession",
        verifierBase
      );
      newSessionUrl.searchParams.set("nonceSize", "32");
      let response: Response;
      try {
        response = await deps.fetchImpl(newSessionUrl, {
          headers: veraisonHeaders(),
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(10_000)
        });
      } catch (error) {
        throw new AppServiceError(
          `The configured Veraison service could not create a session. ${sanitizeOperationalError(error)}`,
          502,
          "veraison_session_unreachable"
        );
      }
      const wire = await readVeraisonSessionResponse(response, [201]);
      if (wire.state !== "waiting") {
        throw new AppServiceError(
          "The configured Veraison service did not create a waiting session.",
          502,
          "veraison_session_state_invalid"
        );
      }
      const nonceBytes = Buffer.from(wire.nonce, "base64");
      if (nonceBytes.length < 8 || nonceBytes.length > 64) {
        throw new AppServiceError(
          "The configured Veraison service returned a nonce outside the required 8–64 byte range.",
          502,
          "veraison_nonce_invalid"
        );
      }
      const expiresAt = new Date(wire.expiry);
      if (expiresAt <= new Date()) {
        throw new AppServiceError(
          "The configured Veraison service returned an expired challenge.",
          502,
          "veraison_expiry_invalid"
        );
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new AppServiceError(
          "The configured Veraison service did not return a session Location header.",
          502,
          "veraison_location_missing"
        );
      }
      const remoteSessionUrl = new URL(location, newSessionUrl);
      await assertDiscoveryTarget(remoteSessionUrl.toString(), deps.devMode);
      if (
        remoteSessionUrl.origin !== verifierBase.origin ||
        !remoteSessionUrl.pathname.includes("/challenge-response/v1/session/")
      ) {
        throw new AppServiceError(
          "The configured Veraison service returned a cross-origin or non-session Location.",
          502,
          "veraison_location_invalid"
        );
      }

      const record = await prisma.veraisonAttestationSession.create({
        data: {
          acceptedMediaTypes: [...new Set(wire.accept)],
          createdBy: context.user.userId,
          expiresAt,
          nonceHash: createHash("sha256").update(wire.nonce).digest("hex"),
          policyDecisionId: authorization.decision.policyDecisionId,
          provider: input.provider,
          remoteSessionUrl: remoteSessionUrl.toString(),
          scopeId: authorization.scope.scopeId,
          tenantId: context.tenant.tenantId,
          verifierOrigin: verifierBase.origin,
          workloadId: input.workloadId
        }
      });
      return serializeVeraisonSession(record, wire.nonce);
    },

    async verifyVeraisonAttestation(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "submit evidence to a Veraison attestation session"
      );
      let session = await prisma.veraisonAttestationSession.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          veraisonSessionId: input.veraisonSessionId
        }
      });
      if (!session) {
        throw new AppServiceError(
          "The Veraison session was not found for this tenant.",
          404,
          "veraison_session_not_found"
        );
      }
      if (["Complete", "Failed"].includes(session.state)) {
        throw new AppServiceError(
          "The Veraison session is already terminal and cannot accept evidence again.",
          409,
          "veraison_session_terminal"
        );
      }
      if (session.expiresAt <= new Date()) {
        await prisma.veraisonAttestationSession.update({
          data: {
            completedAt: new Date(),
            failureReason: "The remote challenge expired before verification.",
            state: "Failed"
          },
          where: { veraisonSessionId: session.veraisonSessionId }
        });
        throw new AppServiceError(
          "The Veraison challenge has expired. Create a new session and collect fresh evidence.",
          409,
          "veraison_session_expired"
        );
      }
      if (!session.acceptedMediaTypes.includes(input.evidenceMediaType)) {
        throw new AppServiceError(
          "The evidence media type is not accepted by this Veraison session.",
          400,
          "veraison_evidence_type_not_accepted"
        );
      }
      const evidence = Buffer.from(input.evidenceBase64, "base64");
      if (evidence.length === 0 || evidence.length > 5 * 1024 * 1024) {
        throw new AppServiceError(
          "Veraison evidence must be between 1 byte and 5 MB.",
          400,
          "veraison_evidence_size_invalid"
        );
      }
      const evidenceHash = createHash("sha256").update(evidence).digest("hex");
      if (session.evidenceHash && session.evidenceHash !== evidenceHash) {
        throw new AppServiceError(
          "This in-progress Veraison session is already bound to different evidence.",
          409,
          "veraison_evidence_mismatch"
        );
      }
      await assertDiscoveryTarget(session.remoteSessionUrl, deps.devMode);
      const remoteUrl = new URL(session.remoteSessionUrl);
      if (remoteUrl.origin !== session.verifierOrigin) {
        throw new AppServiceError(
          "The persisted Veraison session origin no longer matches its verifier profile.",
          409,
          "veraison_origin_mismatch"
        );
      }

      let wire: VeraisonWireSession;
      try {
        if (session.state === "Waiting") {
          const claimed = await prisma.veraisonAttestationSession.updateMany({
            data: {
              evidenceHash,
              failureReason: null,
              state: "Processing"
            },
            where: {
              evidenceHash: null,
              state: "Waiting",
              veraisonSessionId: session.veraisonSessionId
            }
          });
          if (claimed.count !== 1) {
            throw new AppServiceError(
              "The Veraison session is already being processed.",
              409,
              "veraison_session_in_progress"
            );
          }
          session = await prisma.veraisonAttestationSession.findUniqueOrThrow({
            where: { veraisonSessionId: session.veraisonSessionId }
          });
          const response = await deps.fetchImpl(remoteUrl, {
            body: new Uint8Array(evidence),
            headers: veraisonHeaders({
              "content-type": input.evidenceMediaType
            }),
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(30_000)
          });
          wire = await readVeraisonSessionResponse(response, [200, 202]);
        } else {
          const response = await deps.fetchImpl(remoteUrl, {
            headers: veraisonHeaders(),
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(10_000)
          });
          wire = await readVeraisonSessionResponse(response, [200]);
        }

        for (
          let attempt = 0;
          wire.state === "processing" && attempt < 8;
          attempt += 1
        ) {
          await waitFor(250);
          const response = await deps.fetchImpl(remoteUrl, {
            headers: veraisonHeaders(),
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(10_000)
          });
          wire = await readVeraisonSessionResponse(response, [200]);
        }
      } catch (error) {
        await prisma.veraisonAttestationSession.update({
          data: {
            failureReason: `Remote verification is still recoverable: ${sanitizeOperationalError(error)}`
          },
          where: { veraisonSessionId: session.veraisonSessionId }
        });
        if (error instanceof AppServiceError) throw error;
        throw new AppServiceError(
          `The configured Veraison session could not be completed. ${sanitizeOperationalError(error)}`,
          502,
          "veraison_verification_unreachable"
        );
      }

      const returnedNonceHash = createHash("sha256")
        .update(wire.nonce)
        .digest("hex");
      if (returnedNonceHash !== session.nonceHash) {
        await prisma.veraisonAttestationSession.update({
          data: {
            completedAt: new Date(),
            failureReason:
              "The verifier response nonce did not match the session challenge.",
            state: "Failed"
          },
          where: { veraisonSessionId: session.veraisonSessionId }
        });
        throw new AppServiceError(
          "The Veraison response was rejected because its nonce did not match the session.",
          502,
          "veraison_nonce_mismatch"
        );
      }
      if (wire.state === "processing" || wire.state === "waiting") {
        await prisma.veraisonAttestationSession.update({
          data: {
            failureReason:
              "The verifier is still processing; retry this same evidence to resume polling."
          },
          where: { veraisonSessionId: session.veraisonSessionId }
        });
        throw new AppServiceError(
          "Veraison is still processing the evidence. Retry shortly to resume polling without resubmitting different evidence.",
          504,
          "veraison_processing_timeout"
        );
      }
      if (wire.state === "complete" && !wire.result) {
        throw new AppServiceError(
          "Veraison marked the session complete without an attestation result.",
          502,
          "veraison_result_missing"
        );
      }

      const claims = wire.result?.claims ?? {};
      const verifierAccepted = wire.result?.is_valid === true;
      const findings: string[] = [];
      if (!verifierAccepted) {
        findings.push(
          wire.state === "failed"
            ? "The configured Veraison service marked the challenge-response session failed."
            : "The configured Veraison service returned is_valid=false; inspect verifier-side trust-anchor and endorsement provisioning."
        );
      }
      for (const [claimPath, expectedValue] of Object.entries(
        input.expectedClaims
      )) {
        if (
          !claimValuesEqual(readClaimPath(claims, claimPath), expectedValue)
        ) {
          findings.push(`Expected claim ${claimPath} did not match.`);
        }
      }
      const resultClaimsHash = sha256(claims);
      const remoteResultHash = sha256({
        claims,
        is_valid: wire.result?.is_valid ?? false,
        state: wire.state
      });
      const checkedAt = new Date();
      const terminalState = wire.state === "failed" ? "Failed" : "Complete";
      const transactionResult = await prisma.$transaction(async (tx) => {
        const attestation = await tx.confidentialAttestation.create({
          data: {
            checkedAt,
            claimsVersion: null,
            debugDisabled: null,
            deviceCount: 0,
            evidenceMediaType: input.evidenceMediaType,
            expiresAt: session.expiresAt,
            findings,
            hardwareModels: [],
            measurement: null,
            outcome:
              verifierAccepted && findings.length === 0
                ? "Verified"
                : "Rejected",
            provider: session.provider,
            rawClaimsHash: remoteResultHash,
            region: null,
            resultClaimsHash,
            secureBoot: null,
            signatureVerified: verifierAccepted,
            tenantId: context.tenant.tenantId,
            trustAnchorConfigured: verifierAccepted,
            veraisonSessionId: session.veraisonSessionId,
            verifierOrigin: session.verifierOrigin,
            verifierType: "Veraison",
            workloadId: session.workloadId
          }
        });
        const updatedSession = await tx.veraisonAttestationSession.update({
          data: {
            completedAt: checkedAt,
            failureReason: findings.length > 0 ? findings.join(" ") : null,
            remoteResultHash,
            state: terminalState
          },
          where: { veraisonSessionId: session.veraisonSessionId }
        });
        return { attestation, session: updatedSession };
      });

      await deps
        .fetchImpl(remoteUrl, {
          headers: veraisonHeaders(),
          method: "DELETE",
          redirect: "error",
          signal: AbortSignal.timeout(5_000)
        })
        .catch(() => undefined);
      await writeAuditEvent(prisma, {
        action: "verification.run",
        actorType: "User",
        entityId: session.scopeId,
        entityType: "Scope",
        metadata: {
          attestationId:
            transactionResult.attestation.confidentialAttestationId,
          evidenceHash,
          outcome: transactionResult.attestation.outcome,
          provider: session.provider,
          veraisonSessionId: session.veraisonSessionId,
          verifierOrigin: session.verifierOrigin
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return VerifyVeraisonAttestationResultSchema.parse({
        attestation: serializeAttestation(transactionResult.attestation),
        session: serializeVeraisonSession(transactionResult.session)
      });
    },

    async createConfidentialAttestationChallenge(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "create confidential deployment attestation challenges"
      );
      const nonce = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      const record = await prisma.confidentialAttestationChallenge.create({
        data: {
          expiresAt,
          nonceHash: createHash("sha256").update(nonce).digest("hex"),
          provider: input.provider,
          tenantId: context.tenant.tenantId,
          workloadId: input.workloadId
        }
      });
      return ConfidentialAttestationChallengeSchema.parse({
        challengeId: record.challengeId,
        expiresAt: record.expiresAt.toISOString(),
        nonce,
        provider: record.provider,
        workloadId: record.workloadId
      });
    },

    async verifyConfidentialAttestation(context, input) {
      requireRole(
        context.membership.role,
        TRUST_ADMIN_ROLES,
        "verify confidential deployment attestations"
      );
      const anchors = attestationAnchors();
      const trustAnchor = anchors[input.provider];
      if (input.provider === "NvidiaConfidentialGPU") {
        const checkedAt = new Date();
        const challenge =
          await prisma.confidentialAttestationChallenge.findFirst({
            where: {
              challengeId: input.challengeId,
              expiresAt: { gt: checkedAt },
              provider: input.provider,
              tenantId: context.tenant.tenantId,
              usedAt: null,
              workloadId: input.workloadId
            }
          });
        const nonceHash = createHash("sha256")
          .update(input.expectedNonce)
          .digest("hex");
        if (!challenge || challenge.nonceHash !== nonceHash) {
          throw new AppServiceError(
            "The NVIDIA attestation challenge is invalid, expired, already used, or bound to another workload.",
            409,
            "attestation_challenge_invalid"
          );
        }
        const consumed =
          await prisma.confidentialAttestationChallenge.updateMany({
            data: { usedAt: checkedAt },
            where: {
              challengeId: challenge.challengeId,
              expiresAt: { gt: checkedAt },
              usedAt: null
            }
          });
        if (consumed.count !== 1) {
          throw new AppServiceError(
            "The NVIDIA attestation challenge was already consumed.",
            409,
            "attestation_challenge_replayed"
          );
        }
        if (!trustAnchor) {
          const record = await prisma.confidentialAttestation.create({
            data: {
              checkedAt,
              claimsVersion: null,
              debugDisabled: null,
              deviceCount: 0,
              expiresAt: null,
              findings: [
                "No NvidiaConfidentialGPU NVAT ES384 trust anchor is configured; an SDK result without relying-party signature verification is not hardware proof."
              ],
              hardwareModels: [],
              measurement: null,
              outcome: "NotConfigured",
              provider: input.provider,
              rawClaimsHash: createHash("sha256")
                .update(input.signedStatement)
                .digest("hex"),
              region: null,
              secureBoot: null,
              signatureVerified: false,
              tenantId: context.tenant.tenantId,
              trustAnchorConfigured: false,
              evidenceMediaType: "application/json",
              verifierType: "NvidiaNVAT",
              workloadId: input.workloadId
            }
          });
          return serializeAttestation(record);
        }
        const result = verifyNvidiaDetachedEatBundle(
          input,
          trustAnchor,
          checkedAt
        );
        const record = await prisma.confidentialAttestation.create({
          data: {
            ...result,
            checkedAt,
            measurement: null,
            outcome:
              result.signatureVerified && result.findings.length === 0
                ? "Verified"
                : "Rejected",
            provider: input.provider,
            rawClaimsHash: createHash("sha256")
              .update(input.signedStatement)
              .digest("hex"),
            region: null,
            tenantId: context.tenant.tenantId,
            trustAnchorConfigured: true,
            evidenceMediaType: "application/json",
            verifierType: "NvidiaNVAT",
            workloadId: input.workloadId
          }
        });
        return serializeAttestation(record);
      }
      const decoded = decodeJwsClaims(input.signedStatement);
      const claims = decoded?.claims ?? {};
      const findings: string[] = [];
      let signatureVerified = false;
      if (!trustAnchor) {
        findings.push(
          `No ${input.provider} attestation trust anchor is configured; ordinary image or workload signatures are not hardware attestation.`
        );
      } else if (!decoded) {
        findings.push("Attestation statement is not a valid compact JWS.");
      } else {
        const algorithm = decoded.header.alg;
        if (algorithm !== "RS256") {
          findings.push(
            "Only the configured RS256 verifier profile is enabled."
          );
        } else {
          try {
            signatureVerified = verify(
              "RSA-SHA256",
              decoded.payload,
              createPublicKey(trustAnchor),
              decoded.signature
            );
          } catch {
            signatureVerified = false;
          }
          if (!signatureVerified)
            findings.push("Provider signature verification failed.");
        }
      }
      const nowSeconds = Math.floor(Date.now() / 1_000);
      if (trustAnchor && signatureVerified) {
        if (claims.aud !== input.expectedAudience)
          findings.push("Audience mismatch.");
        if (claims.nonce !== input.expectedNonce)
          findings.push("Nonce mismatch.");
        if (claims.measurement !== input.expectedMeasurement) {
          findings.push("Workload measurement mismatch.");
        }
        if (claims.region !== input.expectedRegion)
          findings.push("Region mismatch.");
        if (claims.workloadId !== input.workloadId)
          findings.push("Workload identity mismatch.");
        if (claims.hardwareProtected !== true)
          findings.push("Hardware-protected execution claim is absent.");
        if (input.noLogRequired && claims.noLog !== true)
          findings.push("No-log runtime claim is absent.");
        if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
          findings.push("Attestation is expired or has no valid expiry.");
        }
        if (
          typeof claims.iat !== "number" ||
          claims.iat > nowSeconds + 60 ||
          claims.iat < nowSeconds - 600
        ) {
          findings.push(
            "Attestation freshness is outside the ten-minute policy window."
          );
        }
      }
      const outcome = !trustAnchor
        ? "NotConfigured"
        : signatureVerified && findings.length === 0
          ? "Verified"
          : "Rejected";
      const checkedAt = new Date();
      const record = await prisma.confidentialAttestation.create({
        data: {
          checkedAt,
          claimsVersion: "PeriscanGenericJws1",
          debugDisabled: null,
          deviceCount: 1,
          expiresAt:
            typeof claims.exp === "number"
              ? new Date(claims.exp * 1_000)
              : null,
          findings,
          hardwareModels: [],
          measurement:
            typeof claims.measurement === "string" ? claims.measurement : null,
          outcome,
          provider: input.provider,
          rawClaimsHash: createHash("sha256")
            .update(input.signedStatement)
            .digest("hex"),
          region: typeof claims.region === "string" ? claims.region : null,
          secureBoot: null,
          signatureVerified,
          tenantId: context.tenant.tenantId,
          trustAnchorConfigured: Boolean(trustAnchor),
          workloadId: input.workloadId
        }
      });
      return serializeAttestation(record);
    }
  };
}
