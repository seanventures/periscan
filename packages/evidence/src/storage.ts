import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@periscan/db";
import {
  EvidenceArtifactSchema,
  RedactionStatusSchema,
  RelatedEntityTypeSchema,
  SensitivityLevelSchema,
  type EvidenceArtifact,
  type RedactionStatus,
  type SensitivityLevel
} from "@periscan/shared";
import { z } from "zod";

import {
  appendEvidenceIdsAtomically,
  LINKABLE_EVIDENCE_ID_ENTITY_TYPES,
  type LinkableEvidenceIdEntityType
} from "./evidence-ids";

const LooseObjectSchema = z.record(z.string(), z.unknown());

const PutEvidenceArtifactInputSchema = z.object({
  artifactType: z.enum([
    "RawModuleOutput",
    "NormalizedEvidence",
    "ReportExport",
    "Screenshot",
    "Transcript",
    "Attachment"
  ]),
  content: z.union([
    z.string(),
    z.instanceof(Uint8Array),
    LooseObjectSchema,
    z.array(z.unknown())
  ]),
  contentType: z.string().min(1).optional(),
  evidenceId: z.string().uuid().optional(),
  filename: z.string().min(1).optional(),
  relatedEntityId: z.string().uuid(),
  relatedEntityType: RelatedEntityTypeSchema,
  sensitivityLevel: SensitivityLevelSchema,
  tenantId: z.string().uuid()
});

const CreateEvidenceMetadataInputSchema = z.object({
  artifactType: PutEvidenceArtifactInputSchema.shape.artifactType,
  evidenceId: z.string().uuid().optional(),
  redactionStatus: RedactionStatusSchema,
  relatedEntityId: z.string().uuid(),
  relatedEntityType: RelatedEntityTypeSchema,
  sensitivityLevel: SensitivityLevelSchema,
  sha256: z.string().min(1),
  storageUri: z.string().min(1),
  tenantId: z.string().uuid()
});

const LinkEvidenceInputSchema = z.object({
  entityId: z.string().uuid(),
  entityType: RelatedEntityTypeSchema,
  evidenceId: z.string().uuid()
});

export type PutEvidenceArtifactInput = z.infer<
  typeof PutEvidenceArtifactInputSchema
>;
export type CreateEvidenceMetadataInput = z.infer<
  typeof CreateEvidenceMetadataInputSchema
>;
export type LinkEvidenceInput = z.infer<typeof LinkEvidenceInputSchema>;

export interface EvidenceBlobStore {
  deleteObject(storageUri: string): Promise<void>;
  getObject(
    storageUri: string
  ): Promise<{ body: Uint8Array; contentType: string | null }>;
  putObject(input: {
    body: Uint8Array;
    contentType: string;
    key: string;
  }): Promise<{ storageUri: string }>;
  // Overwrite the object at an EXISTING storageUri in place (used by authorized
  // post-ingest redaction to replace the stored blob without minting a new key).
  putObjectAtUri(input: {
    body: Uint8Array;
    contentType: string | null;
    storageUri: string;
  }): Promise<void>;
}

export interface EvidenceBlobStoreEnvConfig {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  forcePathStyle?: boolean;
  region?: string;
  secretAccessKey: string;
}

export interface RegionRoutedEvidenceBlobStoreInput {
  defaultRegion: string;
  resolveTenantRegion: (tenantId: string) => Promise<string>;
  stores: ReadonlyMap<string, EvidenceBlobStore>;
}

// Retention purge must delete blob bytes without deleting the chain link.
// Tombstoned rows keep evidenceId/sha256/chainSeq/prevChainHash/chainHash so
// verifyEvidenceChain still sees a contiguous per-tenant sequence after an
// authorized retention purge. storageUri is NOT part of the chain commitment.
export const RETENTION_PURGED_STORAGE_URI_PREFIX =
  "periscan://retention-purged/";

export function retentionPurgedStorageUri(evidenceId: string): string {
  return `${RETENTION_PURGED_STORAGE_URI_PREFIX}${evidenceId}`;
}

export function isRetentionPurgedStorageUri(storageUri: string): boolean {
  return storageUri.startsWith(RETENTION_PURGED_STORAGE_URI_PREFIX);
}

export interface EvidenceMetadataStore {
  appendEvidenceToEntity(input: LinkEvidenceInput): Promise<void>;
  createEvidenceMetadata(
    input: CreateEvidenceMetadataInput
  ): Promise<EvidenceArtifact>;
  deleteEvidenceMetadata(evidenceId: string): Promise<void>;
  getEvidenceMetadata(evidenceId: string): Promise<EvidenceArtifact | null>;
  // Record an authorized redaction: flip redactionStatus to Redacted and store
  // the redacted copy's hash + timestamp. Leaves sha256/chainHash (the ingest
  // commitment) untouched so the tamper-evident chain still verifies.
  markEvidenceRedacted(
    evidenceId: string,
    input: { redactedSha256: string; redactedAt: Date }
  ): Promise<EvidenceArtifact>;
  // Authorized retention tombstone: rewrite storageUri to a purged sentinel and
  // keep the chain-link fields. Content becomes unreadable; integrity chain stays
  // contiguous. Idempotent when already tombstoned.
  markEvidenceRetentionPurged(evidenceId: string): Promise<EvidenceArtifact>;
  listEvidenceCreatedBefore(
    olderThan: Date,
    limit: number
  ): Promise<EvidenceArtifact[]>;
  // Recompute the tenant's tamper-evident hash chain from stored rows and report
  // whether every link is intact (detects a mutated/deleted/reordered row).
  verifyEvidenceChain(tenantId: string): Promise<EvidenceChainVerification>;
}

export interface PutEvidenceArtifactResult {
  artifact: EvidenceArtifact;
  content: string;
  redactionStatus: RedactionStatus;
}

export interface PurgeExpiredEvidenceResult {
  evidenceIds: string[];
  purgedCount: number;
  // Count of purged artifacts per tenant — attribution for the retention audit
  // trail ("whose evidence was deleted").
  purgedByTenant: Record<string, number>;
}

export interface EvidenceService {
  createEvidenceMetadata(
    input: CreateEvidenceMetadataInput
  ): Promise<EvidenceArtifact>;
  getEvidenceArtifact(
    evidenceId: string,
    // Optional defense-in-depth tenant guard. When provided, the artifact is
    // only returned if it belongs to this tenant; otherwise null is returned
    // (same as not-found). Back-compatible: existing callers omit it and the
    // primary authorization check still lives in the API layer.
    tenantId?: string
  ): Promise<{
    artifact: EvidenceArtifact;
    // sha256 recomputed from the fetched content at read time.
    computedSha256: string;
    content: string;
    // True when the recomputed hash matches the sha256 recorded at write time —
    // i.e. the stored evidence has not been altered (chain-of-custody check).
    integrityVerified: boolean;
  } | null>;
  linkEvidenceToEntity(input: LinkEvidenceInput): Promise<void>;
  purgeExpiredEvidence(input: {
    limit?: number;
    olderThan: Date;
  }): Promise<PurgeExpiredEvidenceResult>;
  putEvidenceArtifact(
    input: PutEvidenceArtifactInput
  ): Promise<PutEvidenceArtifactResult>;
  // Authorized post-ingest redaction: re-run redaction over the STORED content,
  // overwrite the blob with the redacted copy, and mark the row Redacted. The
  // ingest hash/chain are preserved (redaction is recorded, not history-rewritten).
  // Returns the resulting state, or null if the artifact does not exist.
  redactStoredEvidence(
    evidenceId: string,
    tenantId: string
  ): Promise<{
    artifact: EvidenceArtifact;
    content: string;
    redactionStatus: RedactionStatus;
    changed: boolean;
  } | null>;
  // Verify the tenant's tamper-evident evidence hash chain (see
  // EvidenceMetadataStore.verifyEvidenceChain).
  verifyEvidenceChain(tenantId: string): Promise<EvidenceChainVerification>;
}

const SECRET_REDACTION_PATTERNS: Array<{
  replace: string | ((...args: string[]) => string);
  pattern: RegExp;
}> = [
  // Private key material (RSA/EC/OPENSSH/PKCS8/etc.). Redact the entire block.
  {
    pattern:
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
    replace: "[REDACTED_PRIVATE_KEY]"
  },
  {
    pattern: /\bgh[pousr]_[A-Za-z0-9]{10,}\b/g,
    replace: "[REDACTED_GITHUB_TOKEN]"
  },
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replace: "[REDACTED_AWS_ACCESS_KEY]"
  },
  // Google / GCP API keys.
  {
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g,
    replace: "[REDACTED_GCP_API_KEY]"
  },
  // GCP service-account private_key_id / oauth client secrets are caught by the
  // generic key=value rule; the JSON "private_key" field is caught above.
  // Slack tokens (bot/user/app/legacy/refresh) and webhooks.
  {
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    replace: "[REDACTED_SLACK_TOKEN]"
  },
  // Azure AD client secrets and SAS tokens tend to appear as key=value; also
  // catch Azure storage account keys (base64, 88 chars ending '==').
  {
    pattern: /\b[A-Za-z0-9+/]{86}==\b/g,
    replace: "[REDACTED_AZURE_KEY]"
  },
  // JSON Web Tokens (header.payload.signature).
  {
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replace: "[REDACTED_JWT]"
  },
  // Generic bearer tokens.
  {
    pattern: /\b[Bb]earer\s+[A-Za-z0-9._~+/-]{12,}=*/g,
    replace: "Bearer [REDACTED]"
  },
  {
    pattern:
      /((?:"|')?(?:secret|token|password|passwd|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)(?:"|')?\s*[:=]\s*["']?)([A-Za-z0-9_./+=:-]{6,})/gi,
    replace: "$1[REDACTED]"
  }
];

function appendUniqueIds(existing: string[], evidenceId: string) {
  return [...new Set([...existing, evidenceId])];
}

function supportsEntityEvidenceAppend(
  entityType: LinkEvidenceInput["entityType"]
) {
  return [
    "AttackPath",
    "EvidencePack",
    "Exposure",
    "RemediationTask",
    "ValidationMission",
    "ValidationRun",
    "VerificationEvent"
  ].includes(entityType);
}

function getFileExtension(contentType: string) {
  switch (contentType) {
    case "application/pdf":
      return "pdf";
    case "application/json":
      return "json";
    case "text/html":
      return "html";
    case "text/plain":
      return "txt";
    default:
      return "bin";
  }
}

function toTextContent(
  content: PutEvidenceArtifactInput["content"],
  explicitContentType?: string
) {
  if (typeof content === "string") {
    return {
      contentType: explicitContentType ?? "text/plain",
      text: content
    };
  }

  if (content instanceof Uint8Array) {
    return {
      contentType: explicitContentType ?? "application/octet-stream",
      text: Buffer.from(content).toString("utf8")
    };
  }

  return {
    contentType: explicitContentType ?? "application/json",
    text: JSON.stringify(content, null, 2)
  };
}

async function streamBodyToBytes(body: unknown) {
  if (body instanceof Uint8Array) {
    return body;
  }

  if (typeof body === "string") {
    return Buffer.from(body);
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return Uint8Array.from(await body.transformToByteArray());
  }

  if (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in body
  ) {
    const chunks: Buffer[] = [];

    for await (const chunk of body as AsyncIterable<
      Uint8Array | Buffer | string
    >) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk)
      );
    }

    return Buffer.concat(chunks);
  }

  throw new Error("Unsupported object store body.");
}

function serializeEvidenceArtifact(record: {
  artifactType: EvidenceArtifact["artifactType"];
  createdAt: Date;
  evidenceId: string;
  redactedAt?: Date | null;
  redactedSha256?: string | null;
  redactionStatus: EvidenceArtifact["redactionStatus"];
  relatedEntityId: string;
  relatedEntityType: EvidenceArtifact["relatedEntityType"];
  sensitivityLevel: EvidenceArtifact["sensitivityLevel"];
  sha256: string;
  storageUri: string;
  tenantId: string;
  updatedAt: Date;
}): EvidenceArtifact {
  return EvidenceArtifactSchema.parse({
    artifactType: record.artifactType,
    createdAt: record.createdAt.toISOString(),
    evidenceId: record.evidenceId,
    redactedAt: record.redactedAt ? record.redactedAt.toISOString() : null,
    redactedSha256: record.redactedSha256 ?? null,
    redactionStatus: record.redactionStatus,
    relatedEntityId: record.relatedEntityId,
    relatedEntityType: record.relatedEntityType,
    sensitivityLevel: record.sensitivityLevel,
    sha256: record.sha256,
    storageUri: record.storageUri,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  });
}

export function redactEvidenceArtifact(
  content: string,
  options?: { sensitivityLevel?: SensitivityLevel }
) {
  let redacted = content;
  let wasRedacted = false;

  for (const rule of SECRET_REDACTION_PATTERNS) {
    const next = redacted.replace(rule.pattern, rule.replace as never);

    if (next !== redacted) {
      wasRedacted = true;
      redacted = next;
    }
  }

  // P4 hardening: High/Restricted sensitivity content is redaction-required by
  // default. Even when no pattern matched, never persist it as "NotRequired" —
  // this function also gates model-gateway context exposure.
  const sensitivity = options?.sensitivityLevel;
  const redactionRequired =
    sensitivity === "High" || sensitivity === "Restricted";

  return {
    content: redacted,
    redactionStatus: (wasRedacted || redactionRequired
      ? "Redacted"
      : "NotRequired") as RedactionStatus
  };
}

export function hashEvidenceArtifact(content: string | Uint8Array) {
  const hash = createHash("sha256");

  hash.update(typeof content === "string" ? Buffer.from(content) : content);

  return hash.digest("hex");
}

// The identity + content commitment a chain link binds. Deliberately excludes
// server clocks (createdAt) — it binds the record's position (chainSeq), identity
// (evidenceId + relation), and content (the per-record sha256), which is what a
// tamper needs to alter to forge history.
export interface EvidenceChainLinkFields {
  artifactType: string;
  chainSeq: bigint;
  evidenceId: string;
  relatedEntityId: string;
  relatedEntityType: string;
  sha256: string;
  tenantId: string;
}

// chainHash = SHA-256 over (predecessor's chainHash) + this row's committed
// fields, in a stable order. Mutating or deleting any row changes the input to
// every later link, so verification fails from the first altered position
// onward. The genesis row of a tenant's chain has prevChainHash = null.
export function computeEvidenceChainHash(
  prevChainHash: string | null,
  fields: EvidenceChainLinkFields
): string {
  const commitment = JSON.stringify([
    prevChainHash ?? "",
    fields.tenantId,
    fields.chainSeq.toString(),
    fields.evidenceId,
    fields.sha256,
    fields.artifactType,
    fields.relatedEntityType,
    fields.relatedEntityId
  ]);

  return createHash("sha256").update(commitment, "utf8").digest("hex");
}

export interface EvidenceChainVerification {
  // The chainSeq of the first link whose recomputed hash did not match (or whose
  // predecessor pointer was wrong); undefined when the whole chain is intact.
  brokenAtSeq?: string;
  checked: number;
  reason?: string;
  valid: boolean;
}

export type StoredEvidenceChainLink = EvidenceChainLinkFields & {
  prevChainHash: string | null;
  chainHash: string;
};

export type EvidenceChainLinkVerificationStatus =
  | "Verified"
  | "Broken"
  | "NotChecked";

export interface EvidenceChainLinkInspection {
  chainHash: string;
  chainSeq: string;
  evidenceId: string;
  prevChainHash: string | null;
  reason?: string;
  status: EvidenceChainLinkVerificationStatus;
  valid: boolean;
}

export interface EvidenceChainInspection extends EvidenceChainVerification {
  links: EvidenceChainLinkInspection[];
  total: number;
}

// Return operator-facing detail without weakening the simple aggregate verifier.
// Once a link is broken, later links are intentionally NotChecked: their hashes
// depend on a predecessor that can no longer be trusted, so calling them valid or
// invalid would overstate what this pass proved.
export function inspectChainLinks(
  links: StoredEvidenceChainLink[]
): EvidenceChainInspection {
  const inspected: EvidenceChainLinkInspection[] = [];
  let prevChainHash: string | null = null;
  let expectedSeq = 1n;
  let brokenAtSeq: string | undefined;
  let failureReason: string | undefined;

  for (const link of links) {
    if (brokenAtSeq) {
      inspected.push({
        chainHash: link.chainHash,
        chainSeq: link.chainSeq.toString(),
        evidenceId: link.evidenceId,
        prevChainHash: link.prevChainHash,
        reason: `not checked after the chain broke at sequence ${brokenAtSeq}`,
        status: "NotChecked",
        valid: false
      });
      continue;
    }

    let reason: string | undefined;

    if (link.chainSeq !== expectedSeq) {
      reason = `expected chainSeq ${expectedSeq.toString()} but found ${link.chainSeq.toString()} (a link was deleted or reordered)`;
    } else if ((link.prevChainHash ?? null) !== prevChainHash) {
      reason = `predecessor hash mismatch at chainSeq ${link.chainSeq.toString()}`;
    } else {
      const recomputed = computeEvidenceChainHash(prevChainHash, {
        artifactType: link.artifactType,
        chainSeq: link.chainSeq,
        evidenceId: link.evidenceId,
        relatedEntityId: link.relatedEntityId,
        relatedEntityType: link.relatedEntityType,
        sha256: link.sha256,
        tenantId: link.tenantId
      });

      if (recomputed !== link.chainHash) {
        reason = `chainHash mismatch at chainSeq ${link.chainSeq.toString()} (record was tampered)`;
      }
    }

    if (reason) {
      brokenAtSeq = link.chainSeq.toString();
      failureReason = reason;
      inspected.push({
        chainHash: link.chainHash,
        chainSeq: link.chainSeq.toString(),
        evidenceId: link.evidenceId,
        prevChainHash: link.prevChainHash,
        reason,
        status: "Broken",
        valid: false
      });
      continue;
    }

    inspected.push({
      chainHash: link.chainHash,
      chainSeq: link.chainSeq.toString(),
      evidenceId: link.evidenceId,
      prevChainHash: link.prevChainHash,
      status: "Verified",
      valid: true
    });
    prevChainHash = link.chainHash;
    expectedSeq += 1n;
  }

  return {
    ...(brokenAtSeq ? { brokenAtSeq } : {}),
    checked: inspected.filter((link) => link.status === "Verified").length,
    links: inspected,
    ...(failureReason ? { reason: failureReason } : {}),
    total: links.length,
    valid: !brokenAtSeq
  };
}

// Walk a tenant's links in chainSeq order, recomputing each link from the running
// predecessor hash. Any mutation (sha256/identity), reordering, or a deleted
// middle row breaks the recomputation from that point on. `links` must already be
// sorted by chainSeq ascending.
export function verifyChainLinks(
  links: StoredEvidenceChainLink[]
): EvidenceChainVerification {
  const inspection = inspectChainLinks(links);

  return {
    ...(inspection.brokenAtSeq ? { brokenAtSeq: inspection.brokenAtSeq } : {}),
    checked: inspection.checked,
    ...(inspection.reason ? { reason: inspection.reason } : {}),
    valid: inspection.valid
  };
}

export function createInMemoryEvidenceBlobStore(): EvidenceBlobStore {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();

  return {
    async deleteObject(storageUri) {
      objects.delete(storageUri);
    },

    async getObject(storageUri) {
      const record = objects.get(storageUri);

      if (!record) {
        throw new Error(`Evidence object not found: ${storageUri}`);
      }

      return {
        body: record.body,
        contentType: record.contentType
      };
    },

    async putObject(input) {
      const storageUri = `memory://${input.key}`;

      objects.set(storageUri, {
        body: input.body,
        contentType: input.contentType
      });

      return {
        storageUri
      };
    },

    async putObjectAtUri(input) {
      objects.set(input.storageUri, {
        body: input.body,
        contentType: input.contentType ?? "application/octet-stream"
      });
    }
  };
}

export function createFilesystemEvidenceBlobStore(
  baseDir = path.resolve(process.cwd(), ".periscan/evidence")
): EvidenceBlobStore {
  return {
    async deleteObject(storageUri) {
      await rm(fileURLToPath(storageUri), {
        force: true
      });
    },

    async getObject(storageUri) {
      const filePath = fileURLToPath(storageUri);
      const body = await readFile(filePath);

      return {
        body,
        contentType: null
      };
    },

    async putObject(input) {
      const filePath = path.resolve(baseDir, input.key);

      await mkdir(path.dirname(filePath), {
        recursive: true
      });
      await writeFile(filePath, input.body);

      return {
        storageUri: pathToFileURL(filePath).toString()
      };
    },

    async putObjectAtUri(input) {
      const filePath = fileURLToPath(input.storageUri);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.body);
    }
  };
}

export function createS3EvidenceBlobStore(input: {
  accessKeyId: string;
  bucket: string;
  client?: Pick<S3Client, "send">;
  endpoint: string;
  forcePathStyle?: boolean;
  region?: string;
  secretAccessKey: string;
}): EvidenceBlobStore {
  const client =
    input.client ??
    new S3Client({
      credentials: {
        accessKeyId: input.accessKeyId,
        secretAccessKey: input.secretAccessKey
      },
      endpoint: input.endpoint,
      forcePathStyle: input.forcePathStyle ?? true,
      region: input.region ?? "us-east-1"
    });
  let bucketReadyPromise: Promise<void> | null = null;

  function isMissingBucketError(error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "Code" in error &&
      typeof error.Code === "string"
        ? error.Code
        : null;
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof error.$metadata === "object" &&
      error.$metadata !== null &&
      "httpStatusCode" in error.$metadata &&
      typeof error.$metadata.httpStatusCode === "number"
        ? error.$metadata.httpStatusCode
        : null;

    return code === "NoSuchBucket" || code === "NotFound" || statusCode === 404;
  }

  function isExistingBucketError(error: unknown) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "Code" in error &&
      typeof error.Code === "string"
        ? error.Code
        : null;
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "$metadata" in error &&
      typeof error.$metadata === "object" &&
      error.$metadata !== null &&
      "httpStatusCode" in error.$metadata &&
      typeof error.$metadata.httpStatusCode === "number"
        ? error.$metadata.httpStatusCode
        : null;

    return (
      code === "BucketAlreadyOwnedByYou" ||
      code === "BucketAlreadyExists" ||
      statusCode === 409
    );
  }

  async function ensureBucket() {
    if (!bucketReadyPromise) {
      bucketReadyPromise = (async () => {
        try {
          await client.send(
            new HeadBucketCommand({
              Bucket: input.bucket
            })
          );
        } catch (error) {
          if (!isMissingBucketError(error)) {
            throw error;
          }

          try {
            await client.send(
              new CreateBucketCommand({
                Bucket: input.bucket
              })
            );
          } catch (createError) {
            if (!isExistingBucketError(createError)) {
              throw createError;
            }
          }
        }
      })().catch((error) => {
        bucketReadyPromise = null;
        throw error;
      });
    }

    await bucketReadyPromise;
  }

  return {
    async deleteObject(storageUri) {
      await ensureBucket();
      const key = storageUri.replace(`s3://${input.bucket}/`, "");

      await client.send(
        new DeleteObjectCommand({
          Bucket: input.bucket,
          Key: key
        })
      );
    },

    async getObject(storageUri) {
      await ensureBucket();
      const key = storageUri.replace(`s3://${input.bucket}/`, "");
      const response = await client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: key
        })
      );

      return {
        body: await streamBodyToBytes(response.Body),
        contentType: response.ContentType ?? null
      };
    },

    async putObject(payload) {
      await ensureBucket();
      await client.send(
        new PutObjectCommand({
          Body: payload.body,
          Bucket: input.bucket,
          ContentType: payload.contentType,
          Key: payload.key
        })
      );

      return {
        storageUri: `s3://${input.bucket}/${payload.key}`
      };
    },

    async putObjectAtUri(payload) {
      await ensureBucket();
      const key = payload.storageUri.replace(`s3://${input.bucket}/`, "");
      await client.send(
        new PutObjectCommand({
          Body: payload.body,
          Bucket: input.bucket,
          ContentType: payload.contentType ?? "application/octet-stream",
          Key: key
        })
      );
    }
  };
}

const REGION_STORAGE_URI_PREFIX = "periscan-region://";

function wrapRegionStorageUri(region: string, storageUri: string) {
  return `${REGION_STORAGE_URI_PREFIX}${encodeURIComponent(region)}/${encodeURIComponent(storageUri)}`;
}

function parseRegionStorageUri(storageUri: string) {
  if (!storageUri.startsWith(REGION_STORAGE_URI_PREFIX)) return null;
  const remainder = storageUri.slice(REGION_STORAGE_URI_PREFIX.length);
  const separator = remainder.indexOf("/");
  if (separator < 1) throw new Error("Invalid region-routed evidence URI.");

  return {
    region: decodeURIComponent(remainder.slice(0, separator)),
    storageUri: decodeURIComponent(remainder.slice(separator + 1))
  };
}

export function createRegionRoutedEvidenceBlobStore(
  input: RegionRoutedEvidenceBlobStoreInput
): EvidenceBlobStore {
  function storeForRegion(region: string) {
    const store = input.stores.get(region);
    if (!store) {
      throw new Error(
        `Evidence storage is not configured for tenant data region ${region}.`
      );
    }
    return store;
  }

  function routedStorageUri(storageUri: string) {
    return (
      parseRegionStorageUri(storageUri) ?? {
        region: input.defaultRegion,
        storageUri
      }
    );
  }

  return {
    async deleteObject(storageUri) {
      const routed = routedStorageUri(storageUri);
      await storeForRegion(routed.region).deleteObject(routed.storageUri);
    },

    async getObject(storageUri) {
      const routed = routedStorageUri(storageUri);
      return storeForRegion(routed.region).getObject(routed.storageUri);
    },

    async putObject(payload) {
      const tenantId = payload.key.split("/", 1)[0];
      if (!tenantId)
        throw new Error("Evidence storage key is missing a tenant ID.");
      const region = await input.resolveTenantRegion(tenantId);
      const stored = await storeForRegion(region).putObject(payload);
      return {
        storageUri: wrapRegionStorageUri(region, stored.storageUri)
      };
    },

    async putObjectAtUri(payload) {
      const routed = routedStorageUri(payload.storageUri);
      await storeForRegion(routed.region).putObjectAtUri({
        ...payload,
        storageUri: routed.storageUri
      });
    }
  };
}

export function resolveEvidenceRegionConfigsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): Map<string, EvidenceBlobStoreEnvConfig> {
  const configured = env.PERISCAN_EVIDENCE_REGIONS_JSON?.trim();
  if (configured) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configured);
    } catch {
      throw new Error("PERISCAN_EVIDENCE_REGIONS_JSON must be valid JSON.");
    }

    const schema = z.record(
      z.string().min(1),
      z.object({
        accessKeyId: z.string().min(1),
        bucket: z.string().min(1),
        endpoint: z.url(),
        forcePathStyle: z.boolean().optional(),
        region: z.string().min(1).optional(),
        secretAccessKey: z.string().min(1)
      })
    );
    return new Map(Object.entries(schema.parse(parsed)));
  }

  const legacy = resolveEvidenceBlobStoreConfigFromEnv(env);
  return legacy
    ? new Map([
        [env.PERISCAN_DATA_REGION ?? legacy.region ?? "us-east-1", legacy]
      ])
    : new Map();
}

export function getAvailableEvidenceDataRegions(
  env: NodeJS.ProcessEnv = process.env
) {
  const configured = [...resolveEvidenceRegionConfigsFromEnv(env).keys()];
  return configured.length
    ? configured.sort()
    : [env.PERISCAN_DATA_REGION ?? "us-east-1"];
}

export function createEvidenceBlobStoreFromEnv(input?: {
  env?: NodeJS.ProcessEnv;
  resolveTenantRegion?: (tenantId: string) => Promise<string>;
}) {
  const env = input?.env ?? process.env;
  const regionConfigs = resolveEvidenceRegionConfigsFromEnv(env);
  const defaultRegion = env.PERISCAN_DATA_REGION ?? "us-east-1";
  const stores = new Map<string, EvidenceBlobStore>();

  for (const [region, config] of regionConfigs) {
    stores.set(region, createS3EvidenceBlobStore(config));
  }

  if (
    stores.size === 0 &&
    env.PERISCAN_DEPLOYMENT_ENVIRONMENT !== "production"
  ) {
    const baseDir = env.PERISCAN_EVIDENCE_DIR
      ? path.resolve(env.PERISCAN_EVIDENCE_DIR)
      : path.resolve(process.cwd(), ".periscan/evidence");
    stores.set(
      defaultRegion,
      createFilesystemEvidenceBlobStore(path.join(baseDir, defaultRegion))
    );
  }

  if (stores.size === 0) {
    throw new Error(
      "PERISCAN_EVIDENCE_S3_ENDPOINT, PERISCAN_EVIDENCE_S3_BUCKET, PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID, and PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY (or PERISCAN_EVIDENCE_REGIONS_JSON) must be configured in production; refusing to fall back to local filesystem evidence storage."
    );
  }

  const effectiveDefaultRegion = stores.has(defaultRegion)
    ? defaultRegion
    : (stores.keys().next().value ?? defaultRegion);

  return createRegionRoutedEvidenceBlobStore({
    defaultRegion: effectiveDefaultRegion,
    resolveTenantRegion:
      input?.resolveTenantRegion ?? (async () => effectiveDefaultRegion),
    stores
  });
}

export function resolveEvidenceBlobStoreConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): EvidenceBlobStoreEnvConfig | null {
  const isProduction = env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production";
  const endpoint =
    env.PERISCAN_EVIDENCE_S3_ENDPOINT ??
    env.SUPABASE_STORAGE_ENDPOINT ??
    (!isProduction && env.MINIO_ENDPOINT
      ? `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT ?? "9000"}`
      : undefined);
  const bucket =
    env.PERISCAN_EVIDENCE_S3_BUCKET ??
    env.SUPABASE_STORAGE_BUCKET ??
    (!isProduction ? env.MINIO_BUCKET : undefined);
  const accessKeyId =
    env.PERISCAN_EVIDENCE_S3_ACCESS_KEY_ID ??
    env.SUPABASE_STORAGE_ACCESS_KEY_ID ??
    (!isProduction ? env.MINIO_ROOT_USER : undefined);
  const secretAccessKey =
    env.PERISCAN_EVIDENCE_S3_SECRET_ACCESS_KEY ??
    env.SUPABASE_STORAGE_SECRET_ACCESS_KEY ??
    (!isProduction ? env.MINIO_ROOT_PASSWORD : undefined);

  if (!(endpoint && bucket && accessKeyId && secretAccessKey)) {
    return null;
  }

  const forcePathStyleEnv =
    env.PERISCAN_EVIDENCE_S3_FORCE_PATH_STYLE ??
    env.SUPABASE_STORAGE_FORCE_PATH_STYLE;
  const forcePathStyle =
    forcePathStyleEnv === undefined
      ? endpoint.includes("supabase.co")
        ? false
        : true
      : forcePathStyleEnv !== "false";

  return {
    accessKeyId,
    bucket,
    endpoint,
    forcePathStyle,
    region:
      env.PERISCAN_EVIDENCE_S3_REGION ??
      env.SUPABASE_STORAGE_REGION ??
      "us-east-1",
    secretAccessKey
  };
}

class InMemoryEvidenceMetadataStore implements EvidenceMetadataStore {
  public readonly artifacts = new Map<string, EvidenceArtifact>();
  public readonly entityEvidence = new Map<string, string[]>();
  // Chain link fields live here rather than on EvidenceArtifact (the shared DTO
  // deliberately does not surface the internal integrity chain).
  private readonly chainLinks = new Map<
    string,
    EvidenceChainLinkFields & {
      prevChainHash: string | null;
      chainHash: string;
    }
  >();
  private readonly chainTipByTenant = new Map<
    string,
    { chainSeq: bigint; chainHash: string }
  >();

  async appendEvidenceToEntity(input: LinkEvidenceInput) {
    const key = `${input.entityType}:${input.entityId}`;

    this.entityEvidence.set(
      key,
      appendUniqueIds(this.entityEvidence.get(key) ?? [], input.evidenceId)
    );
  }

  async createEvidenceMetadata(input: CreateEvidenceMetadataInput) {
    const timestamp = new Date().toISOString();
    const evidenceId = input.evidenceId ?? randomUUID();
    const artifact = EvidenceArtifactSchema.parse({
      artifactType: input.artifactType,
      createdAt: timestamp,
      evidenceId,
      redactedAt: null,
      redactedSha256: null,
      redactionStatus: input.redactionStatus,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      sensitivityLevel: input.sensitivityLevel,
      sha256: input.sha256,
      storageUri: input.storageUri,
      tenantId: input.tenantId,
      updatedAt: timestamp
    });

    this.artifacts.set(artifact.evidenceId, artifact);

    // Extend the tenant's tamper-evident chain.
    const tip = this.chainTipByTenant.get(input.tenantId);
    const chainSeq = (tip?.chainSeq ?? 0n) + 1n;
    const prevChainHash = tip?.chainHash ?? null;
    const fields: EvidenceChainLinkFields = {
      artifactType: input.artifactType,
      chainSeq,
      evidenceId,
      relatedEntityId: input.relatedEntityId,
      relatedEntityType: input.relatedEntityType,
      sha256: input.sha256,
      tenantId: input.tenantId
    };
    const chainHash = computeEvidenceChainHash(prevChainHash, fields);
    this.chainLinks.set(evidenceId, { ...fields, prevChainHash, chainHash });
    this.chainTipByTenant.set(input.tenantId, { chainSeq, chainHash });

    return artifact;
  }

  async deleteEvidenceMetadata(evidenceId: string) {
    this.artifacts.delete(evidenceId);
    this.chainLinks.delete(evidenceId);
  }

  async markEvidenceRedacted(
    evidenceId: string,
    input: { redactedSha256: string; redactedAt: Date }
  ) {
    const existing = this.artifacts.get(evidenceId);
    if (!existing) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    // Chain fields (sha256/chainHash) are intentionally left untouched.
    const updated = EvidenceArtifactSchema.parse({
      ...existing,
      redactedAt: input.redactedAt.toISOString(),
      redactedSha256: input.redactedSha256,
      redactionStatus: "Redacted",
      updatedAt: input.redactedAt.toISOString()
    });
    this.artifacts.set(evidenceId, updated);
    return updated;
  }

  async markEvidenceRetentionPurged(evidenceId: string) {
    const existing = this.artifacts.get(evidenceId);
    if (!existing) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    if (isRetentionPurgedStorageUri(existing.storageUri)) {
      return existing;
    }
    // Keep chainLinks intact — retention is an authorized content deletion, not
    // an integrity break. Only the blob locator is rewritten to a sentinel.
    const updated = EvidenceArtifactSchema.parse({
      ...existing,
      storageUri: retentionPurgedStorageUri(evidenceId),
      updatedAt: new Date().toISOString()
    });
    this.artifacts.set(evidenceId, updated);
    return updated;
  }

  async verifyEvidenceChain(
    tenantId: string
  ): Promise<EvidenceChainVerification> {
    const links = [...this.chainLinks.values()]
      .filter((link) => link.tenantId === tenantId)
      .sort((left, right) => (left.chainSeq < right.chainSeq ? -1 : 1));

    return verifyChainLinks(links);
  }

  async getEvidenceMetadata(evidenceId: string) {
    return this.artifacts.get(evidenceId) ?? null;
  }

  async listEvidenceCreatedBefore(olderThan: Date, limit: number) {
    return [...this.artifacts.values()]
      .filter(
        (artifact) =>
          new Date(artifact.createdAt) < olderThan &&
          !isRetentionPurgedStorageUri(artifact.storageUri)
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(0, limit);
  }
}

function isLinkableEvidenceIdEntityType(
  entityType: LinkEvidenceInput["entityType"]
): entityType is LinkableEvidenceIdEntityType {
  return (LINKABLE_EVIDENCE_ID_ENTITY_TYPES as readonly string[]).includes(
    entityType
  );
}

async function appendEvidenceIdsToPrismaEntity(
  prisma: PrismaClient,
  input: LinkEvidenceInput
) {
  if (!isLinkableEvidenceIdEntityType(input.entityType)) {
    throw new Error(
      `Evidence linking is not supported for ${input.entityType}.`
    );
  }

  // Atomic locked union — concurrent appends must not drop each other's IDs.
  await appendEvidenceIdsAtomically(
    prisma,
    input.entityType,
    input.entityId,
    input.evidenceId
  );
}

class PrismaEvidenceMetadataStore implements EvidenceMetadataStore {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async appendEvidenceToEntity(input: LinkEvidenceInput) {
    return appendEvidenceIdsToPrismaEntity(this.prisma, input);
  }

  async createEvidenceMetadata(input: CreateEvidenceMetadataInput) {
    // Generate the id up front so it can be committed into the chain hash.
    const evidenceId = input.evidenceId ?? randomUUID();

    // Serialize per-tenant chain extension with a transaction-scoped advisory
    // lock: two concurrent inserts for the same tenant must not both read the
    // same tip and fork the chain. The lock is keyed on the tenant id and is
    // released automatically at transaction end.
    const artifact = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 0))`;

      const tip = await tx.evidenceArtifact.findFirst({
        orderBy: { chainSeq: "desc" },
        where: { chainSeq: { not: null }, tenantId: input.tenantId }
      });

      const chainSeq = (tip?.chainSeq ?? 0n) + 1n;
      const prevChainHash = tip?.chainHash ?? null;
      const chainHash = computeEvidenceChainHash(prevChainHash, {
        artifactType: input.artifactType,
        chainSeq,
        evidenceId,
        relatedEntityId: input.relatedEntityId,
        relatedEntityType: input.relatedEntityType,
        sha256: input.sha256,
        tenantId: input.tenantId
      });

      return tx.evidenceArtifact.create({
        data: {
          artifactType: input.artifactType,
          chainHash,
          chainSeq,
          evidenceId,
          prevChainHash,
          redactionStatus: input.redactionStatus,
          relatedEntityId: input.relatedEntityId,
          relatedEntityType: input.relatedEntityType,
          sensitivityLevel: input.sensitivityLevel,
          sha256: input.sha256,
          storageUri: input.storageUri,
          tenantId: input.tenantId
        }
      });
    });

    return serializeEvidenceArtifact(artifact);
  }

  async verifyEvidenceChain(
    tenantId: string
  ): Promise<EvidenceChainVerification> {
    const rows = await this.prisma.evidenceArtifact.findMany({
      orderBy: { chainSeq: "asc" },
      select: {
        artifactType: true,
        chainHash: true,
        chainSeq: true,
        evidenceId: true,
        prevChainHash: true,
        relatedEntityId: true,
        relatedEntityType: true,
        sha256: true,
        tenantId: true
      },
      where: { chainSeq: { not: null }, tenantId }
    });

    return verifyChainLinks(
      rows.map((row) => ({
        artifactType: row.artifactType,
        chainHash: row.chainHash ?? "",
        chainSeq: row.chainSeq ?? 0n,
        evidenceId: row.evidenceId,
        prevChainHash: row.prevChainHash,
        relatedEntityId: row.relatedEntityId,
        relatedEntityType: row.relatedEntityType,
        sha256: row.sha256,
        tenantId: row.tenantId
      }))
    );
  }

  async deleteEvidenceMetadata(evidenceId: string) {
    await this.prisma.evidenceArtifact.delete({
      where: {
        evidenceId
      }
    });
  }

  async getEvidenceMetadata(evidenceId: string) {
    const artifact = await this.prisma.evidenceArtifact.findUnique({
      where: {
        evidenceId
      }
    });

    return artifact ? serializeEvidenceArtifact(artifact) : null;
  }

  async markEvidenceRedacted(
    evidenceId: string,
    input: { redactedSha256: string; redactedAt: Date }
  ) {
    // Deliberately does NOT touch sha256/chainHash/chainSeq — the ingest
    // commitment stays intact so verifyEvidenceChain still passes.
    const artifact = await this.prisma.evidenceArtifact.update({
      data: {
        redactedAt: input.redactedAt,
        redactedSha256: input.redactedSha256,
        redactionStatus: "Redacted"
      },
      where: { evidenceId }
    });

    return serializeEvidenceArtifact(artifact);
  }

  async markEvidenceRetentionPurged(evidenceId: string) {
    const existing = await this.prisma.evidenceArtifact.findUnique({
      where: { evidenceId }
    });
    if (!existing) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }
    if (isRetentionPurgedStorageUri(existing.storageUri)) {
      return serializeEvidenceArtifact(existing);
    }

    // Deliberately does NOT touch sha256/chainHash/chainSeq — retention deletes
    // content bytes, not the tamper-evident chain commitment.
    const artifact = await this.prisma.evidenceArtifact.update({
      data: {
        storageUri: retentionPurgedStorageUri(evidenceId)
      },
      where: { evidenceId }
    });

    return serializeEvidenceArtifact(artifact);
  }

  async listEvidenceCreatedBefore(olderThan: Date, limit: number) {
    const artifacts = await this.prisma.evidenceArtifact.findMany({
      orderBy: {
        createdAt: "asc"
      },
      take: limit,
      where: {
        createdAt: {
          lt: olderThan
        },
        // Skip rows already retention-tombstoned so purge is idempotent and
        // never re-selects chain-preserving placeholders.
        NOT: {
          storageUri: {
            startsWith: RETENTION_PURGED_STORAGE_URI_PREFIX
          }
        }
      }
    });

    return artifacts.map(serializeEvidenceArtifact);
  }
}

function createEvidenceService(input: {
  blobStore: EvidenceBlobStore;
  metadataStore: EvidenceMetadataStore;
}): EvidenceService {
  return {
    async createEvidenceMetadata(payload) {
      const parsedPayload = CreateEvidenceMetadataInputSchema.parse(payload);

      return input.metadataStore.createEvidenceMetadata(parsedPayload);
    },

    async getEvidenceArtifact(evidenceId, tenantId) {
      const artifact =
        await input.metadataStore.getEvidenceMetadata(evidenceId);

      if (!artifact) {
        return null;
      }

      // Defense-in-depth: when a tenant is supplied, never surface an artifact
      // that belongs to a different tenant. Treated as not-found to avoid
      // leaking existence across tenants.
      if (tenantId !== undefined && artifact.tenantId !== tenantId) {
        return null;
      }

      // Retention tombstones keep chain metadata but no longer have readable
      // content. Treat them as not-found for content APIs (same as hard-delete
      // from the operator's perspective) while verifyEvidenceChain still sees
      // the preserved link.
      if (isRetentionPurgedStorageUri(artifact.storageUri)) {
        return null;
      }

      const object = await input.blobStore.getObject(artifact.storageUri);
      const content = Buffer.from(object.body).toString("utf8");
      // Chain-of-custody: recompute the hash and compare to the value recorded
      // at write time, so tampering or corruption of the stored object is
      // detected on read rather than silently trusted.
      const computedSha256 = hashEvidenceArtifact(content);

      return {
        artifact,
        computedSha256,
        content,
        integrityVerified: computedSha256 === artifact.sha256
      };
    },

    async linkEvidenceToEntity(payload) {
      const parsedPayload = LinkEvidenceInputSchema.parse(payload);

      await input.metadataStore.appendEvidenceToEntity(parsedPayload);
    },

    async purgeExpiredEvidence(payload) {
      const limit = payload.limit ?? 500;
      const expired = await input.metadataStore.listEvidenceCreatedBefore(
        payload.olderThan,
        limit
      );
      const purgedIds: string[] = [];
      const purgedByTenant: Record<string, number> = {};

      for (const artifact of expired) {
        // Authorized retention: delete blob bytes, then tombstone metadata so
        // the tamper-evident chain stays contiguous. Hard-deleting the row
        // would permanently break verifyEvidenceChain for the tenant.
        const originalStorageUri = artifact.storageUri;
        await input.blobStore.deleteObject(originalStorageUri);
        await input.metadataStore.markEvidenceRetentionPurged(
          artifact.evidenceId
        );
        purgedIds.push(artifact.evidenceId);
        purgedByTenant[artifact.tenantId] =
          (purgedByTenant[artifact.tenantId] ?? 0) + 1;
      }

      return {
        evidenceIds: purgedIds,
        purgedByTenant,
        purgedCount: purgedIds.length
      };
    },

    async putEvidenceArtifact(payload) {
      const parsedPayload = PutEvidenceArtifactInputSchema.parse(payload);
      const evidenceId = parsedPayload.evidenceId ?? randomUUID();
      const normalizedContent = toTextContent(
        parsedPayload.content,
        parsedPayload.contentType
      );
      const redactedContent = redactEvidenceArtifact(normalizedContent.text, {
        sensitivityLevel: parsedPayload.sensitivityLevel
      });
      const fileExtension = getFileExtension(normalizedContent.contentType);
      const storageKey = `${parsedPayload.tenantId}/${parsedPayload.relatedEntityType}/${parsedPayload.relatedEntityId}/${evidenceId}-${parsedPayload.filename ?? parsedPayload.artifactType}.${fileExtension}`;
      const { storageUri } = await input.blobStore.putObject({
        body: Buffer.from(redactedContent.content, "utf8"),
        contentType: normalizedContent.contentType,
        key: storageKey
      });
      const artifact = await input.metadataStore.createEvidenceMetadata({
        artifactType: parsedPayload.artifactType,
        evidenceId,
        redactionStatus: redactedContent.redactionStatus,
        relatedEntityId: parsedPayload.relatedEntityId,
        relatedEntityType: parsedPayload.relatedEntityType,
        sensitivityLevel: parsedPayload.sensitivityLevel,
        sha256: hashEvidenceArtifact(redactedContent.content),
        storageUri,
        tenantId: parsedPayload.tenantId
      });

      if (supportsEntityEvidenceAppend(parsedPayload.relatedEntityType)) {
        await input.metadataStore.appendEvidenceToEntity({
          entityId: parsedPayload.relatedEntityId,
          entityType: parsedPayload.relatedEntityType,
          evidenceId: artifact.evidenceId
        });
      }

      return {
        artifact,
        content: redactedContent.content,
        redactionStatus: redactedContent.redactionStatus
      };
    },

    async redactStoredEvidence(evidenceId, tenantId) {
      const existing =
        await input.metadataStore.getEvidenceMetadata(evidenceId);
      if (!existing || existing.tenantId !== tenantId) {
        return null;
      }
      if (isRetentionPurgedStorageUri(existing.storageUri)) {
        return null;
      }

      const object = await input.blobStore.getObject(existing.storageUri);
      const currentContent = Buffer.from(object.body).toString("utf8");
      const redacted = redactEvidenceArtifact(currentContent, {
        sensitivityLevel: existing.sensitivityLevel
      });
      // An explicit operator redaction must always remove the original bytes.
      // Pattern-based redaction preserves useful context when it finds a known
      // secret, but sensitive free text (PII/PHI/internal prose) may not match a
      // pattern. In that case replace the entire object with a deterministic
      // tombstone instead of falsely marking untouched content as redacted.
      const redactedContent =
        redacted.content === currentContent
          ? "[REDACTED_BY_OPERATOR]"
          : redacted.content;
      const changed = redactedContent !== currentContent;

      // Persist the redacted copy over the SAME blob so sensitive content is
      // genuinely removed from storage, then record the authorized redaction on
      // the row (ingest sha256/chain preserved).
      await input.blobStore.putObjectAtUri({
        body: Buffer.from(redactedContent, "utf8"),
        contentType: object.contentType,
        storageUri: existing.storageUri
      });

      const redactedSha256 = hashEvidenceArtifact(redactedContent);
      const artifact = await input.metadataStore.markEvidenceRedacted(
        evidenceId,
        { redactedAt: new Date(), redactedSha256 }
      );

      return {
        artifact,
        changed,
        content: redactedContent,
        redactionStatus: artifact.redactionStatus
      };
    },

    async verifyEvidenceChain(tenantId) {
      return input.metadataStore.verifyEvidenceChain(tenantId);
    }
  };
}

export function createInMemoryEvidenceService(
  blobStore = createInMemoryEvidenceBlobStore(),
  metadataStore = new InMemoryEvidenceMetadataStore()
) {
  return {
    metadataStore,
    service: createEvidenceService({
      blobStore,
      metadataStore
    })
  };
}

export function createPrismaEvidenceService(input?: {
  blobStore?: EvidenceBlobStore;
  prisma?: PrismaClient;
}) {
  const prisma = input?.prisma ?? getPrismaClient();
  return createEvidenceService({
    blobStore:
      input?.blobStore ??
      createEvidenceBlobStoreFromEnv({
        resolveTenantRegion: async (tenantId) => {
          const tenant = await prisma.tenant.findUnique({
            select: { dataRegion: true },
            where: { tenantId }
          });
          if (!tenant) throw new Error("Evidence tenant not found.");
          return tenant.dataRegion;
        }
      }),
    metadataStore: new PrismaEvidenceMetadataStore(prisma)
  });
}
