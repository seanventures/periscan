import { randomUUID } from "node:crypto";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { describe, expect, it } from "vitest";

import {
  computeEvidenceChainHash,
  createS3EvidenceBlobStore,
  createEvidenceBlobStoreFromEnv,
  createInMemoryEvidenceBlobStore,
  createInMemoryEvidenceService,
  createRegionRoutedEvidenceBlobStore,
  getAvailableEvidenceDataRegions,
  hashEvidenceArtifact,
  inspectChainLinks,
  isRetentionPurgedStorageUri,
  resolveEvidenceBlobStoreConfigFromEnv,
  resolveEvidenceRegionConfigsFromEnv,
  redactEvidenceArtifact,
  retentionPurgedStorageUri,
  verifyChainLinks
} from "./storage";

function withCleanEvidenceEnv<T>(runner: () => T) {
  const originalEnv = { ...process.env };

  process.env = {};

  try {
    return runner();
  } finally {
    process.env = originalEnv;
  }
}

describe("evidence storage service", () => {
  it("redacts secrets before storing evidence", async () => {
    const { metadataStore, service } = createInMemoryEvidenceService();
    const tenantId = randomUUID();
    const runId = randomUUID();

    const result = await service.putEvidenceArtifact({
      artifactType: "RawModuleOutput",
      content: {
        api_key: "AKIA1234567890ABCDEF",
        note: "ghp_supersecrettokenvalue",
        password: "super-secret-password"
      },
      relatedEntityId: runId,
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "High",
      tenantId
    });

    expect(result.redactionStatus).toBe("Redacted");
    expect(result.content).not.toContain("AKIA1234567890ABCDEF");
    expect(result.content).not.toContain("ghp_supersecrettokenvalue");
    expect(result.content).not.toContain("super-secret-password");
    expect(result.artifact.relatedEntityId).toBe(runId);
    expect(metadataStore.entityEvidence.get(`ValidationRun:${runId}`)).toEqual([
      result.artifact.evidenceId
    ]);

    const loaded = await service.getEvidenceArtifact(
      result.artifact.evidenceId
    );

    expect(loaded?.content).toBe(result.content);
  });

  it("redactStoredEvidence actually removes stored sensitive content, flips status, and keeps the chain intact", async () => {
    const blobStore = createInMemoryEvidenceBlobStore();
    const { service } = createInMemoryEvidenceService(blobStore);
    const tenantId = randomUUID();

    // Store a Low-sensitivity artifact whose content is safe at ingest.
    const put = await service.putEvidenceArtifact({
      artifactType: "RawModuleOutput",
      content: "benign observation",
      relatedEntityId: randomUUID(),
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Low",
      tenantId
    });
    expect(put.redactionStatus).toBe("NotRequired");

    // Simulate sensitive content having landed in the stored blob (e.g. a newly
    // recognized secret pattern) by overwriting the blob in place.
    await blobStore.putObjectAtUri({
      body: Buffer.from("leaked ghp_supersecrettokenvalue in the log", "utf8"),
      contentType: "text/plain",
      storageUri: put.artifact.storageUri
    });

    const redacted = await service.redactStoredEvidence(
      put.artifact.evidenceId,
      tenantId
    );

    // The action is real: content changed, status flipped, timestamp + hash set.
    expect(redacted?.changed).toBe(true);
    expect(redacted?.redactionStatus).toBe("Redacted");
    expect(redacted?.artifact.redactedAt).toBeTruthy();
    expect(redacted?.artifact.redactedSha256).toBeTruthy();

    // The secret is genuinely gone from storage (not a phantom no-op).
    const after = await service.getEvidenceArtifact(put.artifact.evidenceId);
    expect(after?.content).not.toContain("ghp_supersecrettokenvalue");
    expect(after?.content).toContain("[REDACTED_GITHUB_TOKEN]");

    // Ingest commitment (sha256/chainHash) untouched → the tamper-evident chain
    // still verifies after an authorized redaction.
    const verification = await service.verifyEvidenceChain(tenantId);
    expect(verification.valid).toBe(true);

    // Cross-tenant redaction is refused.
    const wrongTenant = await service.redactStoredEvidence(
      put.artifact.evidenceId,
      randomUUID()
    );
    expect(wrongTenant).toBeNull();
  });

  it("removes the entire stored payload when explicit redaction finds no known secret pattern", async () => {
    const blobStore = createInMemoryEvidenceBlobStore();
    const { service } = createInMemoryEvidenceService(blobStore);
    const tenantId = randomUUID();
    const sensitiveProse =
      "Patient Jane Doe has diagnosis alpha and internal case notes.";

    const put = await service.putEvidenceArtifact({
      artifactType: "RawModuleOutput",
      content: sensitiveProse,
      relatedEntityId: randomUUID(),
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Restricted",
      tenantId
    });

    const redacted = await service.redactStoredEvidence(
      put.artifact.evidenceId,
      tenantId
    );
    const stored = await service.getEvidenceArtifact(put.artifact.evidenceId);

    expect(redacted?.changed).toBe(true);
    expect(redacted?.redactionStatus).toBe("Redacted");
    expect(redacted?.content).toBe("[REDACTED_BY_OPERATOR]");
    expect(stored?.content).toBe("[REDACTED_BY_OPERATOR]");
    expect(stored?.content).not.toContain("Jane Doe");
    expect(stored?.computedSha256).toBe(redacted?.artifact.redactedSha256);
  });

  it("verifies evidence integrity on read and detects tampering", async () => {
    const blobStore = createInMemoryEvidenceBlobStore();
    const { service } = createInMemoryEvidenceService(blobStore);
    const tenantId = randomUUID();

    const result = await service.putEvidenceArtifact({
      artifactType: "NormalizedEvidence",
      content: { finding: "benign validation evidence body" },
      relatedEntityId: randomUUID(),
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Low",
      tenantId
    });

    // Untampered: the recomputed hash matches the recorded sha256.
    const intact = await service.getEvidenceArtifact(
      result.artifact.evidenceId
    );
    expect(intact?.integrityVerified).toBe(true);
    expect(intact?.computedSha256).toBe(result.artifact.sha256);

    // Tamper with the stored object behind the metadata's back.
    const storageKey = result.artifact.storageUri.replace(/^memory:\/\//u, "");
    await blobStore.putObject({
      body: Buffer.from("tampered evidence content", "utf8"),
      contentType: "application/json",
      key: storageKey
    });

    // The integrity check now fails — the content no longer matches its hash.
    const tampered = await service.getEvidenceArtifact(
      result.artifact.evidenceId
    );
    expect(tampered?.integrityVerified).toBe(false);
    expect(tampered?.computedSha256).not.toBe(result.artifact.sha256);
  });

  it("enforces the optional tenant guard on getEvidenceArtifact", async () => {
    const { service } = createInMemoryEvidenceService();
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const runId = randomUUID();

    const result = await service.putEvidenceArtifact({
      artifactType: "NormalizedEvidence",
      content: { note: "tenant-scoped evidence" },
      relatedEntityId: runId,
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Moderate",
      tenantId
    });

    // No tenant supplied -> back-compatible behavior, artifact returned.
    expect(
      (await service.getEvidenceArtifact(result.artifact.evidenceId))?.artifact
        .evidenceId
    ).toBe(result.artifact.evidenceId);

    // Matching tenant -> artifact returned.
    expect(
      (await service.getEvidenceArtifact(result.artifact.evidenceId, tenantId))
        ?.artifact.evidenceId
    ).toBe(result.artifact.evidenceId);

    // Mismatched tenant -> treated as not-found.
    expect(
      await service.getEvidenceArtifact(
        result.artifact.evidenceId,
        otherTenantId
      )
    ).toBeNull();
  });

  it("produces stable hashes and leaves safe content untouched", () => {
    expect(hashEvidenceArtifact("hello")).toBe(hashEvidenceArtifact("hello"));
    expect(
      redactEvidenceArtifact("safe fixture evidence").redactionStatus
    ).toBe("NotRequired");
  });

  it("stores integration-scoped evidence artifacts without requiring entity append support", async () => {
    const { service } = createInMemoryEvidenceService();
    const integrationId = randomUUID();
    const tenantId = randomUUID();

    const result = await service.putEvidenceArtifact({
      artifactType: "NormalizedEvidence",
      content: {
        connectorKey: "github",
        signalCount: 2
      },
      relatedEntityId: integrationId,
      relatedEntityType: "Integration",
      sensitivityLevel: "Moderate",
      tenantId
    });

    expect(result.artifact.relatedEntityType).toBe("Integration");
    expect(result.artifact.relatedEntityId).toBe(integrationId);
    expect(
      (await service.getEvidenceArtifact(result.artifact.evidenceId))?.content
    ).toContain('"connectorKey": "github"');
  });

  it("stores report exports with format-specific file extensions", async () => {
    const { service } = createInMemoryEvidenceService();
    const evidencePackId = randomUUID();
    const tenantId = randomUUID();

    const html = await service.putEvidenceArtifact({
      artifactType: "ReportExport",
      content: "<html><body>report</body></html>",
      contentType: "text/html",
      filename: "executive-risk-summary",
      relatedEntityId: evidencePackId,
      relatedEntityType: "EvidencePack",
      sensitivityLevel: "Moderate",
      tenantId
    });
    const pdf = await service.putEvidenceArtifact({
      artifactType: "ReportExport",
      content: "%PDF-1.4\n%%EOF\n",
      contentType: "application/pdf",
      filename: "executive-risk-summary",
      relatedEntityId: evidencePackId,
      relatedEntityType: "EvidencePack",
      sensitivityLevel: "Moderate",
      tenantId
    });

    expect(html.artifact.storageUri).toMatch(/\.html$/);
    expect(pdf.artifact.storageUri).toMatch(/\.pdf$/);
  });

  it("purges only evidence created before the retention cutoff", async () => {
    const { metadataStore, service } = createInMemoryEvidenceService();
    const tenantId = randomUUID();

    const stale = await service.putEvidenceArtifact({
      artifactType: "RawModuleOutput",
      content: { note: "old" },
      relatedEntityId: randomUUID(),
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Low",
      tenantId
    });
    const fresh = await service.putEvidenceArtifact({
      artifactType: "RawModuleOutput",
      content: { note: "new" },
      relatedEntityId: randomUUID(),
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Low",
      tenantId
    });

    // Backdate the stale artifact well past the retention cutoff.
    const staleArtifact = metadataStore.artifacts.get(
      stale.artifact.evidenceId
    )!;
    metadataStore.artifacts.set(stale.artifact.evidenceId, {
      ...staleArtifact,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    });

    const result = await service.purgeExpiredEvidence({
      olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    expect(result.purgedCount).toBe(1);
    expect(result.evidenceIds).toEqual([stale.artifact.evidenceId]);
    // Per-tenant attribution of what was purged (retention audit trail).
    expect(result.purgedByTenant).toEqual({ [tenantId]: 1 });
    expect(
      await service.getEvidenceArtifact(stale.artifact.evidenceId)
    ).toBeNull();
    expect(
      await service.getEvidenceArtifact(fresh.artifact.evidenceId)
    ).not.toBeNull();

    // Content is gone, but the chain-link tombstone remains so integrity stays
    // contiguous after an authorized retention purge.
    const tombstone = metadataStore.artifacts.get(stale.artifact.evidenceId);
    expect(tombstone).toBeTruthy();
    expect(isRetentionPurgedStorageUri(tombstone!.storageUri)).toBe(true);
    expect(tombstone!.storageUri).toBe(
      retentionPurgedStorageUri(stale.artifact.evidenceId)
    );
    const chain = await service.verifyEvidenceChain(tenantId);
    expect(chain.valid).toBe(true);
    expect(chain.checked).toBe(2);
  });

  it("keeps the tamper-evident chain valid after purging the oldest prefix", async () => {
    const { metadataStore, service } = createInMemoryEvidenceService();
    const tenantId = randomUUID();
    const runId = randomUUID();

    const written = [];
    for (let i = 0; i < 4; i += 1) {
      written.push(
        await service.putEvidenceArtifact({
          artifactType: "NormalizedEvidence",
          content: { index: i },
          relatedEntityId: runId,
          relatedEntityType: "ValidationRun",
          sensitivityLevel: "Low",
          tenantId
        })
      );
    }

    // Expire the oldest two links (seq 1 and 2). Hard-deleting them would leave
    // the tip at chainSeq=3 and permanently fail verifyEvidenceChain.
    for (const item of written.slice(0, 2)) {
      const current = metadataStore.artifacts.get(item.artifact.evidenceId)!;
      metadataStore.artifacts.set(item.artifact.evidenceId, {
        ...current,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    const result = await service.purgeExpiredEvidence({
      olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    });

    expect(result.purgedCount).toBe(2);
    expect(
      await service.getEvidenceArtifact(written[0]!.artifact.evidenceId)
    ).toBeNull();
    expect(
      await service.getEvidenceArtifact(written[2]!.artifact.evidenceId)
    ).not.toBeNull();

    const verification = await service.verifyEvidenceChain(tenantId);
    expect(verification).toMatchObject({
      checked: 4,
      valid: true
    });
    expect(verification.brokenAtSeq).toBeUndefined();

    // A later write still appends after the preserved tip.
    await service.putEvidenceArtifact({
      artifactType: "NormalizedEvidence",
      content: { index: 4 },
      relatedEntityId: runId,
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "Low",
      tenantId
    });
    expect(await service.verifyEvidenceChain(tenantId)).toMatchObject({
      checked: 5,
      valid: true
    });
  });

  it("creates the evidence bucket on first write when MinIO starts empty", async () => {
    const commands: string[] = [];
    const client = {
      async send(command: unknown) {
        commands.push(
          (command as { constructor: { name: string } }).constructor.name
        );

        if (command instanceof HeadBucketCommand) {
          const error = new Error("bucket missing") as Error & {
            $metadata: { httpStatusCode: number };
            Code: string;
          };

          error.$metadata = {
            httpStatusCode: 404
          };
          error.Code = "NoSuchBucket";
          throw error;
        }

        if (command instanceof CreateBucketCommand) {
          return {};
        }

        if (command instanceof PutObjectCommand) {
          return {};
        }

        throw new Error(`Unexpected command: ${String(command)}`);
      }
    };
    const blobStore = createS3EvidenceBlobStore({
      accessKeyId: "periscan",
      bucket: "periscan-evidence",
      client,
      endpoint: "http://127.0.0.1:9000",
      secretAccessKey: "periscan123"
    });

    await blobStore.putObject({
      body: Buffer.from("fixture report"),
      contentType: "text/plain",
      key: "tenant/report.txt"
    });

    expect(commands).toEqual([
      "HeadBucketCommand",
      "CreateBucketCommand",
      "PutObjectCommand"
    ]);
  });

  it("resolves Supabase storage alias env vars", () =>
    withCleanEvidenceEnv(() => {
      process.env.SUPABASE_STORAGE_ENDPOINT =
        "https://example.supabase.co/storage/v1/s3";
      process.env.SUPABASE_STORAGE_BUCKET = "periscan-storage";
      process.env.SUPABASE_STORAGE_ACCESS_KEY_ID = "sb-access";
      process.env.SUPABASE_STORAGE_SECRET_ACCESS_KEY = "sb-secret";

      const resolved = resolveEvidenceBlobStoreConfigFromEnv();

      expect(resolved).toMatchObject({
        accessKeyId: "sb-access",
        bucket: "periscan-storage",
        endpoint: "https://example.supabase.co/storage/v1/s3",
        forcePathStyle: false,
        region: "us-east-1",
        secretAccessKey: "sb-secret"
      });
    }));

  it("routes tenant evidence to the store configured for its persisted region", async () => {
    const tenantUs = randomUUID();
    const tenantEu = randomUUID();
    const usStore = createInMemoryEvidenceBlobStore();
    const euStore = createInMemoryEvidenceBlobStore();
    const router = createRegionRoutedEvidenceBlobStore({
      defaultRegion: "us-east-1",
      resolveTenantRegion: async (tenantId) =>
        tenantId === tenantEu ? "eu-central-1" : "us-east-1",
      stores: new Map([
        ["us-east-1", usStore],
        ["eu-central-1", euStore]
      ])
    });

    const usKey = `${tenantUs}/ValidationRun/us.json`;
    const euKey = `${tenantEu}/ValidationRun/eu.json`;
    const us = await router.putObject({
      body: Buffer.from("us"),
      contentType: "application/json",
      key: usKey
    });
    const eu = await router.putObject({
      body: Buffer.from("eu"),
      contentType: "application/json",
      key: euKey
    });

    expect(us.storageUri).toContain("periscan-region://us-east-1/");
    expect(eu.storageUri).toContain("periscan-region://eu-central-1/");
    expect(
      Buffer.from((await router.getObject(us.storageUri)).body).toString()
    ).toBe("us");
    expect(
      Buffer.from((await router.getObject(eu.storageUri)).body).toString()
    ).toBe("eu");
    await expect(usStore.getObject(`memory://${euKey}`)).rejects.toThrow(
      /not found/u
    );
    await expect(euStore.getObject(`memory://${usKey}`)).rejects.toThrow(
      /not found/u
    );
  });

  it("parses a multi-region server-side storage map without exposing credentials", () =>
    withCleanEvidenceEnv(() => {
      process.env.PERISCAN_EVIDENCE_REGIONS_JSON = JSON.stringify({
        "eu-central-1": {
          accessKeyId: "eu-access",
          bucket: "periscan-eu",
          endpoint: "https://eu-storage.example.com",
          secretAccessKey: "eu-secret"
        },
        "us-east-1": {
          accessKeyId: "us-access",
          bucket: "periscan-us",
          endpoint: "https://us-storage.example.com",
          secretAccessKey: "us-secret"
        }
      });

      expect([...resolveEvidenceRegionConfigsFromEnv().keys()].sort()).toEqual([
        "eu-central-1",
        "us-east-1"
      ]);
      expect(getAvailableEvidenceDataRegions()).toEqual([
        "eu-central-1",
        "us-east-1"
      ]);
    }));

  it("does not use local MinIO shorthand in production", () =>
    withCleanEvidenceEnv(() => {
      process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";
      process.env.MINIO_BUCKET = "periscan-evidence";
      process.env.MINIO_ENDPOINT = "127.0.0.1";
      process.env.MINIO_ROOT_PASSWORD = "periscan123";
      process.env.MINIO_ROOT_USER = "periscan";

      expect(resolveEvidenceBlobStoreConfigFromEnv()).toBeNull();
      expect(() => createEvidenceBlobStoreFromEnv()).toThrow(
        /PERISCAN_EVIDENCE_S3_ENDPOINT/u
      );
    }));

  it("requires complete object storage config in production", () =>
    withCleanEvidenceEnv(() => {
      process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = "production";
      process.env.PERISCAN_EVIDENCE_S3_ENDPOINT =
        "https://evidence.example.com";

      expect(resolveEvidenceBlobStoreConfigFromEnv()).toBeNull();
      expect(() => createEvidenceBlobStoreFromEnv()).toThrow(
        /PERISCAN_EVIDENCE_S3_BUCKET/u
      );
    }));

  it("returns null when evidence storage config is incomplete", () =>
    withCleanEvidenceEnv(() => {
      delete process.env.SUPABASE_STORAGE_ENDPOINT;

      expect(resolveEvidenceBlobStoreConfigFromEnv()).toBeNull();
    }));
});

describe("evidence tamper-evident hash chain", () => {
  it("builds a verifiable chain across a tenant's evidence writes", async () => {
    const { service } = createInMemoryEvidenceService();
    const tenantId = randomUUID();
    const runId = randomUUID();

    for (let i = 0; i < 4; i += 1) {
      await service.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: { index: i, note: `evidence ${i}` },
        relatedEntityId: runId,
        relatedEntityType: "ValidationRun",
        sensitivityLevel: "Low",
        tenantId
      });
    }

    const result = await service.verifyEvidenceChain(tenantId);

    expect(result.valid).toBe(true);
    expect(result.checked).toBe(4);
    expect(result.brokenAtSeq).toBeUndefined();
  });

  it("isolates chains per tenant", async () => {
    const { service } = createInMemoryEvidenceService();
    const tenantA = randomUUID();
    const tenantB = randomUUID();

    for (const tenantId of [tenantA, tenantB, tenantA]) {
      await service.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: { tenantId },
        relatedEntityId: randomUUID(),
        relatedEntityType: "ValidationRun",
        sensitivityLevel: "Low",
        tenantId
      });
    }

    // Each tenant's chain is independent and starts at seq 1.
    expect((await service.verifyEvidenceChain(tenantA)).checked).toBe(2);
    expect((await service.verifyEvidenceChain(tenantB)).checked).toBe(1);
    expect((await service.verifyEvidenceChain(tenantA)).valid).toBe(true);
  });

  it("detects a tampered record (mutated content hash)", () => {
    const tenantId = randomUUID();
    const links = buildChain(tenantId, 3);

    expect(verifyChainLinks(links).valid).toBe(true);

    // Mutate the middle record's content hash without re-chaining — exactly what
    // an attacker altering stored evidence in the database would do.
    const tampered = links.map((link, index) =>
      index === 1 ? { ...link, sha256: "tampered-sha256" } : link
    );
    const result = verifyChainLinks(tampered);

    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe("2");
    expect(result.checked).toBe(1);
  });

  it("detects a deleted middle record (sequence gap)", () => {
    const tenantId = randomUUID();
    const links = buildChain(tenantId, 3);

    // Drop the middle link — the chain now jumps 1 -> 3.
    const result = verifyChainLinks([links[0]!, links[2]!]);

    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe("3");
  });

  it("returns per-link proof and stops trusting descendants after a break", () => {
    const tenantId = randomUUID();
    const links = buildChain(tenantId, 4);
    const tampered = links.map((link, index) =>
      index === 1 ? { ...link, sha256: "tampered-sha256" } : link
    );

    const result = inspectChainLinks(tampered);

    expect(result).toMatchObject({
      brokenAtSeq: "2",
      checked: 1,
      total: 4,
      valid: false
    });
    expect(result.links.map((link) => link.status)).toEqual([
      "Verified",
      "Broken",
      "NotChecked",
      "NotChecked"
    ]);
    expect(result.links[1]?.reason).toContain("record was tampered");
    expect(result.links[2]?.reason).toContain("chain broke at sequence 2");
  });
});

// Build a valid, correctly-linked chain of N records for a tenant.
function buildChain(tenantId: string, count: number) {
  const links: Array<{
    artifactType: string;
    chainHash: string;
    chainSeq: bigint;
    evidenceId: string;
    prevChainHash: string | null;
    relatedEntityId: string;
    relatedEntityType: string;
    sha256: string;
    tenantId: string;
  }> = [];
  let prevChainHash: string | null = null;

  for (let i = 0; i < count; i += 1) {
    const chainSeq = BigInt(i + 1);
    const fields = {
      artifactType: "NormalizedEvidence",
      chainSeq,
      evidenceId: randomUUID(),
      relatedEntityId: randomUUID(),
      relatedEntityType: "ValidationRun",
      sha256: `sha-${i}`,
      tenantId
    };
    const chainHash = computeEvidenceChainHash(prevChainHash, fields);
    links.push({ ...fields, chainHash, prevChainHash });
    prevChainHash = chainHash;
  }

  return links;
}
