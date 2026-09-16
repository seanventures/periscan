import {
  mergeThreatIntelFields,
  NormalizedThreatIntelItemSchema,
  type MergeableThreatIntelFields,
  type NormalizedThreatIntelItem,
  type ThreatSeverity
} from "@periscan/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export interface ThreatIntelIngestResult {
  /** Items the adapter handed us (post-validation). */
  ingested: number;
  /** Canonical records created for the first time this run. */
  created: number;
  /** Existing canonical records merged with a new report. */
  merged: number;
  /** Provenance rows added (a source reporting an item it had not before). */
  newProvenance: number;
  /** Items rejected because they failed the normalized-item contract. */
  rejected: number;
  /** IDs of canonical records created THIS run — the new-item set to alert on. */
  createdItemIds: string[];
}

type DbClient = PrismaClient | Prisma.TransactionClient;

function toMergeable(
  item: NormalizedThreatIntelItem
): MergeableThreatIntelFields {
  return {
    title: item.title,
    summary: item.summary ?? "",
    cveIds: item.cveIds ?? [],
    cvssScore: item.cvssScore ?? null,
    epssScore: item.epssScore ?? null,
    severity: (item.severity ?? "Unknown") as ThreatSeverity,
    kev: item.kev ?? false,
    kevRansomware: item.kevRansomware ?? false,
    techniqueIds: item.techniqueIds ?? [],
    tags: item.tags ?? [],
    publishedAt: item.publishedAt ?? null
  };
}

/**
 * Upsert one normalized item into the GLOBAL catalog with cross-feed dedup.
 *
 * The canonicalKey is the dedup identity: a CVE reported by NVD then CISA-KEV
 * is ONE ThreatIntelItem with two provenance rows. Merge is worst-wins (the
 * pure mergeThreatIntelFields), so a later, blander report never downgrades a
 * KEV/critical item. Returns which kind of write happened so the poller can
 * report new-item counts (the basis for "realtime" alerts).
 *
 * Runs in a transaction so the read-modify-write of the canonical row plus its
 * provenance + sourceCount stay consistent under a single feed's serial poll.
 */
async function upsertOne(
  db: DbClient,
  raw: NormalizedThreatIntelItem,
  reportedAt: Date
): Promise<{
  created: boolean;
  merged: boolean;
  newProvenance: boolean;
  itemId: string;
}> {
  const existing = await db.threatIntelItem.findUnique({
    where: { canonicalKey: raw.canonicalKey },
    select: {
      threatIntelItemId: true,
      title: true,
      summary: true,
      cveIds: true,
      cvssScore: true,
      epssScore: true,
      severity: true,
      kev: true,
      kevRansomware: true,
      techniqueIds: true,
      tags: true,
      publishedAt: true
    }
  });

  if (!existing) {
    const fields = toMergeable(raw);
    const created = await db.threatIntelItem.create({
      data: {
        kind: raw.kind,
        canonicalKey: raw.canonicalKey,
        title: fields.title,
        summary: fields.summary,
        cveIds: fields.cveIds,
        cvssScore: fields.cvssScore,
        epssScore: fields.epssScore,
        severity: fields.severity,
        kev: fields.kev,
        kevRansomware: fields.kevRansomware,
        iocType: raw.iocType ?? null,
        iocValue: raw.iocValue ?? null,
        techniqueIds: fields.techniqueIds,
        tags: fields.tags,
        publishedAt: fields.publishedAt ? new Date(fields.publishedAt) : null,
        firstSeenAt: reportedAt,
        lastSeenAt: reportedAt,
        sourceCount: 1
      },
      select: { threatIntelItemId: true }
    });
    await db.threatIntelProvenance.create({
      data: {
        threatIntelItemId: created.threatIntelItemId,
        sourceKey: raw.sourceKey,
        externalId: raw.externalId ?? null,
        sourceUrl: raw.sourceUrl ?? null,
        reportedAt
      }
    });
    return {
      created: true,
      merged: false,
      newProvenance: true,
      itemId: created.threatIntelItemId
    };
  }

  const merged = mergeThreatIntelFields(
    {
      title: existing.title,
      summary: existing.summary,
      cveIds: existing.cveIds,
      cvssScore: existing.cvssScore,
      epssScore: existing.epssScore,
      severity: (existing.severity ?? "Unknown") as ThreatSeverity,
      kev: existing.kev,
      kevRansomware: existing.kevRansomware,
      techniqueIds: existing.techniqueIds,
      tags: existing.tags,
      publishedAt: existing.publishedAt
        ? existing.publishedAt.toISOString()
        : null
    },
    toMergeable(raw)
  );

  await db.threatIntelItem.update({
    where: { threatIntelItemId: existing.threatIntelItemId },
    data: {
      title: merged.title,
      summary: merged.summary,
      cveIds: merged.cveIds,
      cvssScore: merged.cvssScore,
      epssScore: merged.epssScore,
      severity: merged.severity,
      kev: merged.kev,
      kevRansomware: merged.kevRansomware,
      techniqueIds: merged.techniqueIds,
      tags: merged.tags,
      publishedAt: merged.publishedAt ? new Date(merged.publishedAt) : null,
      lastSeenAt: reportedAt
    }
  });

  // Record this source's report. The unique (item, sourceKey) means a repeat
  // poll from the same feed updates reportedAt rather than inflating sourceCount.
  const priorProvenance = await db.threatIntelProvenance.findUnique({
    where: {
      threatIntelItemId_sourceKey: {
        threatIntelItemId: existing.threatIntelItemId,
        sourceKey: raw.sourceKey
      }
    },
    select: { threatIntelProvenanceId: true }
  });

  if (priorProvenance) {
    await db.threatIntelProvenance.update({
      where: {
        threatIntelProvenanceId: priorProvenance.threatIntelProvenanceId
      },
      data: {
        reportedAt,
        externalId: raw.externalId ?? null,
        sourceUrl: raw.sourceUrl ?? null
      }
    });
    return {
      created: false,
      merged: true,
      newProvenance: false,
      itemId: existing.threatIntelItemId
    };
  }

  await db.threatIntelProvenance.create({
    data: {
      threatIntelItemId: existing.threatIntelItemId,
      sourceKey: raw.sourceKey,
      externalId: raw.externalId ?? null,
      sourceUrl: raw.sourceUrl ?? null,
      reportedAt
    }
  });
  await db.threatIntelItem.update({
    where: { threatIntelItemId: existing.threatIntelItemId },
    data: { sourceCount: { increment: 1 } }
  });
  return {
    created: false,
    merged: true,
    newProvenance: true,
    itemId: existing.threatIntelItemId
  };
}

/**
 * Ingest a batch of normalized items from one feed poll into the global
 * catalog. Each item is validated against the normalized contract; malformed
 * items are counted as rejected (never silently dropped) and skipped. Returns
 * the create/merge/provenance tallies that drive feed health + new-item alerts.
 */
export async function ingestThreatIntelItems(
  prisma: PrismaClient,
  items: ReadonlyArray<unknown>,
  options: { now?: Date } = {}
): Promise<ThreatIntelIngestResult> {
  const reportedAt = options.now ?? new Date();
  const result: ThreatIntelIngestResult = {
    ingested: 0,
    created: 0,
    merged: 0,
    newProvenance: 0,
    rejected: 0,
    createdItemIds: []
  };

  for (const candidate of items) {
    const parsed = NormalizedThreatIntelItemSchema.safeParse(candidate);
    if (!parsed.success) {
      result.rejected += 1;
      continue;
    }
    const outcome = await prisma.$transaction((tx) =>
      upsertOne(tx, parsed.data, reportedAt)
    );
    result.ingested += 1;
    if (outcome.created) {
      result.created += 1;
      result.createdItemIds.push(outcome.itemId);
    }
    if (outcome.merged) {
      result.merged += 1;
    }
    if (outcome.newProvenance) {
      result.newProvenance += 1;
    }
  }

  return result;
}
