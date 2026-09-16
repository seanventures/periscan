import type { Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@periscan/db";
import {
  createPrismaEvidenceService,
  type EvidenceService
} from "@periscan/evidence";

import { logger } from "./logger.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function getObjectStorageRetentionDays(
  env: NodeJS.ProcessEnv = process.env
) {
  const parsed = Number.parseInt(
    env.PERISCAN_OBJECT_STORAGE_RETENTION_DAYS ?? "",
    10
  );

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export interface EvidencePurgeRecord {
  evidenceIds: string[];
  olderThan: string;
  purgedByTenant: Record<string, number>;
  purgedCount: number;
  retentionDays: number;
}

// A first-class, per-tenant audit record for an evidence-retention purge.
// Evidence deletion is a destructive, chain-of-custody action, so each affected
// tenant gets a queryable AuditEvent in its own audit log (not only a log line).
export interface EvidencePurgeAuditRecord {
  olderThan: string;
  purgedCount: number;
  retentionDays: number;
  tenantId: string;
}

export interface RunEvidenceRetentionPurgeOptions {
  env?: NodeJS.ProcessEnv;
  evidenceService?: EvidenceService;
  limit?: number;
  now?: Date;
  // Sink for the auditable purge record. Evidence deletion is a destructive,
  // chain-of-custody action; in the deployment-managed retention model the
  // audit trail is a structured log shipped to the configured aggregation
  // target. Defaults to a machine-parseable stdout line.
  recordPurge?: (record: EvidencePurgeRecord) => void;
  // Sink for the first-class per-tenant AuditEvent rows. Defaults to a
  // Prisma-backed write so the purge shows up in each tenant's audit log.
  recordAudit?: (records: EvidencePurgeAuditRecord[]) => void | Promise<void>;
}

function defaultRecordEvidencePurge(record: EvidencePurgeRecord): void {
  logger.info(
    { op: "evidence.retention.purged", ...record },
    "evidence retention purged"
  );
}

// Turn the per-tenant purge counts into one audit record per affected tenant.
function buildEvidencePurgeAuditRecords(
  record: EvidencePurgeRecord
): EvidencePurgeAuditRecord[] {
  return Object.entries(record.purgedByTenant).map(
    ([tenantId, purgedCount]) => ({
      olderThan: record.olderThan,
      purgedCount,
      retentionDays: record.retentionDays,
      tenantId
    })
  );
}

// Write one AuditEvent per affected tenant. Mirrors the worker's existing direct
// audit writes (model-gateway-turn.ts) — the DB enum value is written directly
// rather than importing the API's action map across the package boundary.
async function defaultWriteEvidencePurgeAuditEvents(
  records: EvidencePurgeAuditRecord[],
  prisma: PrismaClient = getPrismaClient()
): Promise<void> {
  for (const record of records) {
    await prisma.auditEvent.create({
      data: {
        action: "evidence_retention_purged",
        actorType: "System",
        entityId: null,
        entityType: "EvidencePack",
        metadata: {
          olderThan: record.olderThan,
          purgedCount: record.purgedCount,
          retentionDays: record.retentionDays
        } as Prisma.InputJsonValue,
        tenantId: record.tenantId,
        userId: null
      }
    });
  }
}

export async function runEvidenceRetentionPurge(
  options: RunEvidenceRetentionPurgeOptions = {}
) {
  const env = options.env ?? process.env;
  const retentionDays = getObjectStorageRetentionDays(env);

  if (retentionDays === null) {
    // Retention is managed by the deployment platform; nothing to purge here.
    return {
      evidenceIds: [],
      purgedCount: 0,
      skipped: true as const
    };
  }

  const now = options.now ?? new Date();
  const olderThan = new Date(
    now.getTime() - retentionDays * MILLISECONDS_PER_DAY
  );
  const evidenceService =
    options.evidenceService ?? createPrismaEvidenceService();
  const result = await evidenceService.purgeExpiredEvidence({
    limit: options.limit,
    olderThan
  });

  if (result.purgedCount > 0) {
    const purgeRecord: EvidencePurgeRecord = {
      evidenceIds: result.evidenceIds,
      olderThan: olderThan.toISOString(),
      purgedByTenant: result.purgedByTenant,
      purgedCount: result.purgedCount,
      retentionDays
    };

    // Structured log (for aggregation) + first-class per-tenant AuditEvents.
    (options.recordPurge ?? defaultRecordEvidencePurge)(purgeRecord);
    await (options.recordAudit ?? defaultWriteEvidencePurgeAuditEvents)(
      buildEvidencePurgeAuditRecords(purgeRecord)
    );
  }

  return {
    ...result,
    skipped: false as const
  };
}
