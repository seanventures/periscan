import { createHash } from "node:crypto";

import type {
  ModelPolicyProfile as PrismaModelPolicyProfile,
  ModelSession as PrismaModelSession
} from "@prisma/client";
import type {
  ContextBundle,
  ContextPruningManifest,
  SensitivityLevel
} from "@periscan/shared";

import type { GatewayPrisma } from "./audit.js";
import {
  loadAssetsForVerifiedScopes,
  loadAttackPathsForScopedEntities,
  loadExposuresForScopedAssets
} from "./scope-filter.js";

export type ModelSessionWithPolicy = PrismaModelSession & {
  policyProfile: PrismaModelPolicyProfile;
};

type ContextBundleItem = {
  entityType: ContextBundle["items"][number]["entityType"];
  entityId: string;
  evidenceIds: string[];
  redactionStatus: ContextBundle["items"][number]["redactionStatus"];
  includedReason: string;
};

export interface BuiltContextBundle {
  items: ContextBundleItem[];
  pruningManifest: ContextPruningManifest;
  sensitivityLevel: SensitivityLevel;
  sourceTokenEstimate: number;
  tokenBudget: number;
  tokenEstimate: number;
}

const SENSITIVITY_RANK: Record<SensitivityLevel, number> = {
  High: 2,
  Low: 0,
  Moderate: 1,
  Restricted: 3
};

const ORDERED_SENSITIVITY: SensitivityLevel[] = [
  "Low",
  "Moderate",
  "High",
  "Restricted"
];

// Keep bundles bounded so a model prompt and the persisted record stay small.
const MAX_ASSETS = 25;
const MAX_EXPOSURES = 50;
const MAX_PATHS = 25;
// Rough per-item token cost for a small redacted JSON reference.
const TOKENS_PER_ITEM = 40;
const DEFAULT_TOKEN_BUDGET = 2_000;

const ENTITY_PRIORITY: Partial<
  Record<ContextBundleItem["entityType"], number>
> = {
  Asset: 1,
  AttackPath: 3,
  Exposure: 2
};

function itemDigest(item: ContextBundleItem): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        entityId: item.entityId,
        entityType: item.entityType,
        evidenceIds: [...item.evidenceIds].sort()
      })
    )
    .digest("hex");
}

/**
 * Keep the most decision-useful references inside an explicit prompt budget.
 * The selection is stable across replays: cited attack paths and exposures win,
 * ties use evidence count and entity id, and the final bundle returns to source
 * order so downstream summaries remain human-readable.
 */
export function pruneContextBundleItems(input: {
  items: ContextBundleItem[];
  tokenBudget?: number;
}): {
  items: ContextBundleItem[];
  manifest: ContextPruningManifest;
} {
  const tokenBudget = Math.max(
    TOKENS_PER_ITEM,
    Math.floor(input.tokenBudget ?? DEFAULT_TOKEN_BUDGET)
  );
  const sourceTokenEstimate = input.items.length * TOKENS_PER_ITEM;
  const keepCount = Math.min(
    input.items.length,
    Math.floor(tokenBudget / TOKENS_PER_ITEM)
  );
  const ranked = input.items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => {
      const leftAllowed = left.item.redactionStatus === "Blocked" ? 0 : 1;
      const rightAllowed = right.item.redactionStatus === "Blocked" ? 0 : 1;
      return (
        rightAllowed - leftAllowed ||
        Number(right.item.evidenceIds.length > 0) -
          Number(left.item.evidenceIds.length > 0) ||
        (ENTITY_PRIORITY[right.item.entityType] ?? 0) -
          (ENTITY_PRIORITY[left.item.entityType] ?? 0) ||
        right.item.evidenceIds.length - left.item.evidenceIds.length ||
        left.item.entityId.localeCompare(right.item.entityId)
      );
    });
  const retainedRows = ranked.slice(0, keepCount);
  const retainedIndexes = new Set(retainedRows.map((row) => row.sourceIndex));
  const items = retainedRows
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
    .map((row) => row.item);
  const omittedItems = input.items
    .filter((_, index) => !retainedIndexes.has(index))
    .map((item) => ({
      digest: itemDigest(item),
      entityId: item.entityId,
      entityType: item.entityType
    }));
  const retainedTokenEstimate = items.length * TOKENS_PER_ITEM;

  return {
    items,
    manifest: {
      applied: omittedItems.length > 0,
      omittedItems,
      retainedEvidenceIds: [
        ...new Set(items.flatMap((item) => item.evidenceIds))
      ].sort(),
      retainedItemCount: items.length,
      retainedTokenEstimate,
      sourceItemCount: input.items.length,
      sourceTokenEstimate,
      strategy: "EvidencePriorityDeterministicV1",
      tokenBudget,
      version: 1
    }
  };
}

function maxSensitivity(
  current: SensitivityLevel,
  candidate: SensitivityLevel
): SensitivityLevel {
  return SENSITIVITY_RANK[candidate] > SENSITIVITY_RANK[current]
    ? candidate
    : current;
}

/**
 * Context broker: enumerates the redacted, in-scope entities a model may reason
 * over for a session and records exactly what was included versus blocked.
 *
 * Safety invariants:
 * - The bundle only ever stores references (entity ids + grounding evidence ids
 *   + redaction status), never raw evidence content, so no secret can reach a
 *   model through the bundle.
 * - Evidence whose sensitivity exceeds the policy ceiling (Restricted/High when
 *   `allowSensitiveContext` is false) is `Blocked`: its ids are excluded and the
 *   item documents the policy reason.
 * - The overall sensitivity classification is computed from what was actually
 *   included and is capped at the policy ceiling.
 */
export async function buildModelContextBundle(input: {
  maxTokenEstimate?: number;
  prisma: GatewayPrisma;
  scopeIds: string[];
  session: ModelSessionWithPolicy;
  tenantId: string;
}): Promise<BuiltContextBundle> {
  const { prisma, session, tenantId } = input;
  const allowSensitive = session.policyProfile.allowSensitiveContext;
  const ceiling: SensitivityLevel = allowSensitive ? "Restricted" : "Moderate";

  const assets = await loadAssetsForVerifiedScopes({
    prisma,
    scopeIds: input.scopeIds,
    take: MAX_ASSETS,
    tenantId
  });
  const assetIds = assets.map((asset) => asset.assetId);
  const exposures = await loadExposuresForScopedAssets({
    assetIds,
    prisma,
    take: MAX_EXPOSURES,
    tenantId
  });
  const paths = await loadAttackPathsForScopedEntities({
    entityIds: [
      ...assetIds,
      ...exposures.map((exposure) => exposure.exposureId)
    ],
    prisma,
    take: MAX_PATHS,
    tenantId
  });

  // Resolve sensitivity for every referenced evidence id in one query so each
  // item can decide include vs. block without N+1 reads.
  const referencedEvidenceIds = [
    ...new Set([
      ...exposures.flatMap((exposure) => exposure.evidenceIds),
      ...paths.flatMap((path) => path.evidenceIds)
    ])
  ];
  const evidenceRows =
    referencedEvidenceIds.length > 0
      ? await prisma.evidenceArtifact.findMany({
          select: { evidenceId: true, sensitivityLevel: true },
          where: { evidenceId: { in: referencedEvidenceIds }, tenantId }
        })
      : [];
  const evidenceSensitivity = new Map<string, SensitivityLevel>(
    evidenceRows.map((row) => [
      row.evidenceId,
      row.sensitivityLevel as SensitivityLevel
    ])
  );

  const items: ContextBundleItem[] = [];
  let bundleSensitivity: SensitivityLevel = "Low";

  function classifyEvidence(evidenceIds: string[]): {
    allowedIds: string[];
    blockedCount: number;
    itemSensitivity: SensitivityLevel;
  } {
    const allowedIds: string[] = [];
    let blockedCount = 0;
    let itemSensitivity: SensitivityLevel = "Low";

    for (const evidenceId of evidenceIds) {
      const sensitivity = evidenceSensitivity.get(evidenceId) ?? "Low";
      if (SENSITIVITY_RANK[sensitivity] > SENSITIVITY_RANK[ceiling]) {
        blockedCount += 1;
        continue;
      }
      allowedIds.push(evidenceId);
      itemSensitivity = maxSensitivity(itemSensitivity, sensitivity);
    }

    return { allowedIds, blockedCount, itemSensitivity };
  }

  for (const asset of assets) {
    items.push({
      entityId: asset.assetId,
      entityType: "Asset",
      evidenceIds: [],
      includedReason: `In-scope ${asset.businessCriticality} asset (${asset.assetType}).`,
      redactionStatus: "NotRequired"
    });
  }

  for (const exposure of exposures) {
    const { allowedIds, blockedCount, itemSensitivity } = classifyEvidence(
      exposure.evidenceIds
    );
    const blocked = allowedIds.length === 0 && blockedCount > 0;
    bundleSensitivity = maxSensitivity(bundleSensitivity, itemSensitivity);
    items.push({
      entityId: exposure.exposureId,
      entityType: "Exposure",
      evidenceIds: allowedIds,
      includedReason: blocked
        ? `Exposure (${exposure.severity}) evidence blocked: sensitivity exceeds the policy ceiling (${ceiling}).`
        : blockedCount > 0
          ? `Exposure (${exposure.severity}); ${blockedCount} sensitive evidence reference(s) excluded by policy.`
          : `Exposure (${exposure.severity}, ${exposure.validationState}) in scope.`,
      redactionStatus: blocked
        ? "Blocked"
        : allowedIds.length > 0
          ? "Redacted"
          : "NotRequired"
    });
  }

  for (const path of paths) {
    const { allowedIds, blockedCount, itemSensitivity } = classifyEvidence(
      path.evidenceIds
    );
    const blocked = allowedIds.length === 0 && blockedCount > 0;
    bundleSensitivity = maxSensitivity(bundleSensitivity, itemSensitivity);
    items.push({
      entityId: path.pathId,
      entityType: "AttackPath",
      evidenceIds: allowedIds,
      includedReason: blocked
        ? `Attack path evidence blocked: sensitivity exceeds the policy ceiling (${ceiling}).`
        : `Attack path "${path.name}" (impact ${path.impactScore}, ${path.validationState}).`,
      redactionStatus: blocked
        ? "Blocked"
        : allowedIds.length > 0
          ? "Redacted"
          : "NotRequired"
    });
  }

  // Cap the reported sensitivity at the policy ceiling as defense in depth.
  if (SENSITIVITY_RANK[bundleSensitivity] > SENSITIVITY_RANK[ceiling]) {
    bundleSensitivity = ceiling;
  }
  // With no grounding evidence, reflect the policy posture rather than implying
  // sensitive data is present.
  if (
    items.every((item) => item.evidenceIds.length === 0) &&
    ORDERED_SENSITIVITY.includes(bundleSensitivity)
  ) {
    bundleSensitivity = allowSensitive ? "Moderate" : "Low";
  }

  const pruned = pruneContextBundleItems({
    items,
    tokenBudget: input.maxTokenEstimate
  });

  return {
    items: pruned.items,
    pruningManifest: pruned.manifest,
    sensitivityLevel: bundleSensitivity,
    sourceTokenEstimate: pruned.manifest.sourceTokenEstimate,
    tokenBudget: pruned.manifest.tokenBudget,
    tokenEstimate: pruned.manifest.retainedTokenEstimate
  };
}
