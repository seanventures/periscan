import type { Prisma } from "@prisma/client";

/**
 * Whitelisted physical targets for atomic evidenceIds union.
 * Table/column names are never taken from caller input.
 */
export const EVIDENCE_ID_TABLE_TARGETS = {
  AdvisoryImpactAssessment: {
    idColumn: "advisory_impact_assessment_id",
    table: "advisory_impact_assessments"
  },
  AdvisoryReadinessReport: {
    idColumn: "advisory_readiness_report_id",
    table: "advisory_readiness_reports"
  },
  AttackPath: {
    idColumn: "path_id",
    table: "attack_paths"
  },
  EvidencePack: {
    idColumn: "evidence_pack_id",
    table: "evidence_packs"
  },
  Exposure: {
    idColumn: "exposure_id",
    table: "exposures"
  },
  GraphEdge: {
    idColumn: "graph_edge_id",
    table: "graph_edges"
  },
  GraphNode: {
    idColumn: "graph_node_id",
    table: "graph_nodes"
  },
  RemediationTask: {
    idColumn: "remediation_id",
    table: "remediation_tasks"
  },
  ThreatAdvisory: {
    idColumn: "threat_advisory_id",
    table: "threat_advisories"
  },
  ThreatPackage: {
    idColumn: "threat_package_id",
    table: "threat_packages"
  },
  ThreatValidationPlan: {
    idColumn: "threat_validation_plan_id",
    table: "threat_validation_plans"
  },
  ThreatValidationPlanItem: {
    idColumn: "threat_validation_plan_item_id",
    table: "threat_validation_plan_items"
  },
  ValidationMission: {
    idColumn: "mission_id",
    table: "validation_missions"
  },
  ValidationRun: {
    idColumn: "run_id",
    table: "validation_runs"
  },
  VerificationEvent: {
    idColumn: "verification_id",
    table: "verification_events"
  }
} as const;

export type EvidenceIdEntityType = keyof typeof EVIDENCE_ID_TABLE_TARGETS;

/** RelatedEntityType values that support evidenceIds append via storage linking. */
export const LINKABLE_EVIDENCE_ID_ENTITY_TYPES = [
  "AdvisoryImpactAssessment",
  "AdvisoryReadinessReport",
  "AttackPath",
  "EvidencePack",
  "Exposure",
  "RemediationTask",
  "ThreatAdvisory",
  "ThreatPackage",
  "ThreatValidationPlan",
  "ThreatValidationPlanItem",
  "ValidationMission",
  "ValidationRun",
  "VerificationEvent"
] as const satisfies ReadonlyArray<Exclude<EvidenceIdEntityType, "GraphEdge" | "GraphNode">>;

export type LinkableEvidenceIdEntityType =
  (typeof LINKABLE_EVIDENCE_ID_ENTITY_TYPES)[number];

type Tx = Prisma.TransactionClient;

export type EvidenceIdDb = {
  $transaction: <T>(
    fn: (tx: Tx) => Promise<T>,
    options?: {
      isolationLevel?: Prisma.TransactionIsolationLevel;
      maxWait?: number;
      timeout?: number;
    }
  ) => Promise<T>;
};

export function unionEvidenceIds(
  ...lists: Array<string[] | string | null | undefined>
): string[] {
  const next = new Set<string>();

  for (const list of lists) {
    if (list == null) {
      continue;
    }

    if (typeof list === "string") {
      if (list.length > 0) {
        next.add(list);
      }
      continue;
    }

    for (const id of list) {
      if (typeof id === "string" && id.length > 0) {
        next.add(id);
      }
    }
  }

  return [...next];
}

export function evidenceIdsLockKey(table: string, entityId: string): string {
  return `evidence-ids:${table}:${entityId}`;
}

/**
 * Serialize per-entity evidenceIds appends with a transaction-scoped advisory
 * lock, then apply the mutator. Prevents unlocked find→merge→update lost updates
 * when two writers append distinct evidence IDs to the same row.
 */
export async function withEvidenceIdsAppendLock<T>(
  db: EvidenceIdDb,
  table: string,
  entityId: string,
  run: (tx: Tx) => Promise<T>
): Promise<T> {
  const lockKey = evidenceIdsLockKey(table, entityId);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
    return run(tx);
  });
}

/**
 * Atomically union `incoming` into `evidence_ids` for a whitelisted entity row.
 * Returns the post-update id list. Throws when the row is missing.
 */
export async function appendEvidenceIdsAtomically(
  db: EvidenceIdDb,
  entityType: EvidenceIdEntityType,
  entityId: string,
  incoming: string[] | string
): Promise<string[]> {
  const target = EVIDENCE_ID_TABLE_TARGETS[entityType];
  const toAdd = unionEvidenceIds(incoming);

  return withEvidenceIdsAppendLock(db, target.table, entityId, async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<{ evidence_ids: string[] }>>(
      `SELECT evidence_ids FROM ${target.table} WHERE ${target.idColumn} = $1::uuid FOR UPDATE`,
      entityId
    );
    const current = rows[0];

    if (!current) {
      throw new Error(`${entityType} not found: ${entityId}`);
    }

    const next = unionEvidenceIds(current.evidence_ids, toAdd);

    if (
      next.length === (current.evidence_ids?.length ?? 0) &&
      toAdd.every((id) => (current.evidence_ids ?? []).includes(id))
    ) {
      return next;
    }

    await tx.$executeRawUnsafe(
      `UPDATE ${target.table}
       SET evidence_ids = $1::uuid[], updated_at = NOW()
       WHERE ${target.idColumn} = $2::uuid`,
      next,
      entityId
    );

    return next;
  });
}
