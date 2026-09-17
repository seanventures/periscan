/**
 * P11-5 quarantine — Living-map / Cyber Terrain / swarm-KB fixture helpers.
 *
 * These helpers fabricate inventory, terrain summaries, swarm KB facts, and
 * dollar-impact estimates. They MUST NOT be re-exported from the production
 * `@periscan/evidence` package index, MUST NOT be imported by apps/api or
 * apps/web production paths, and MUST NEVER be presented as real customer
 * terrain, continuous living map, or financial impact.
 *
 * Allowed uses: unit tests, Labs prototypes under an explicit lab flag, or
 * clearly labeled sample/demo content.
 *
 * Real inventory/path truth lives on Asset + GraphNode via
 * createPrismaEvidenceGraphService / createInMemoryEvidenceGraphService.
 */

import { randomUUID } from "node:crypto";

import {
  CampaignMemoryEntrySchema,
  COVERAGE_TAGS_VERBATIM,
  LivingMapDeltaSchema,
  TerrainQueryInputSchema,
  type AssetCoverageTag,
  type AssetInventoryEntry,
  type CampaignMemoryEntry,
  type LivingMapDelta,
  type RiskScoreInput,
  type TerrainQueryInput
} from "@periscan/shared";

/** Fixture watermark — always present so callers can refuse product wiring. */
export const LIVING_MAP_FIXTURE_WATERMARK = {
  kind: "fixture" as const,
  surface: "living-map-terrain",
  productStatus: "not-configured",
  labOnly: true,
  note: "Labs/stub — not a real continuous living map or Cyber Terrain product surface."
};

export type FixtureAssetInventoryEntry = AssetInventoryEntry;

export function computeAssetInventoryChange(
  previous: AssetInventoryEntry[],
  current: AssetInventoryEntry[]
): { added: number; removed: number; changed: number; deltaSummary: string } {
  // Simple change detection stub for continuous ASM inventory (real: diff via evidence graph nodes + timestamps + recon/connector signals).
  const prevKeys = new Set(previous.map((a) => `${a.assetType}:${a.assetId}`));
  const currKeys = new Set(current.map((a) => `${a.assetType}:${a.assetId}`));
  const added = current.filter(
    (a) => !prevKeys.has(`${a.assetType}:${a.assetId}`)
  ).length;
  const removed = previous.filter(
    (a) => !currKeys.has(`${a.assetType}:${a.assetId}`)
  ).length;
  const changed = Math.max(0, current.length - added); // rough
  return {
    added,
    removed,
    changed,
    deltaSummary: `ASM inventory delta: +${added} -${removed} (EASM+CAASM+internal broad recon swarm feed; living graph nodes updated) [fixture/lab-only]`
  };
}

/** Stub seed for discovery assets — synthetic IDs and coverage tags only. */
/** Map free fixture source labels onto closed AssetTypeSchema members (P11-12). */
function fixtureAssetType(
  type: string
): AssetInventoryEntry["assetType"] {
  const allowed = [
    "Repository",
    "Service",
    "Host",
    "Container",
    "Kubernetes",
    "CloudResource",
    "Domain",
    "Application",
    "IdentityStore",
    "Other"
  ] as const;
  if ((allowed as readonly string[]).includes(type)) {
    return type as AssetInventoryEntry["assetType"];
  }
  return "Other";
}

/** Tag subsets by asset type — never stamp the full tag set on every fixture row (P11-12). */
function fixtureCoverageTags(
  assetType: AssetInventoryEntry["assetType"]
): AssetCoverageTag[] {
  switch (assetType) {
    case "Kubernetes":
    case "Container":
      return ["Cloud", "K8s", "Container"];
    case "CloudResource":
      return ["Cloud", "CAASM"];
    case "Domain":
      return ["EASM", "Domain"];
    case "Host":
      return ["Internal", "Host"];
    case "Repository":
      return ["CodeRepo", "Internal"];
    case "IdentityStore":
      return ["IdP", "SaaSApp"];
    default:
      return ["Internal"];
  }
}

export function seedDiscoveryAssetsForASVEASM(
  tenantId: string,
  sources: Array<{ type: string; id: string }>
): AssetInventoryEntry[] {
  // Fixture-only for active recon parts (real: from packages/evidence + modules + connectors collectSignals).
  return sources.map((s, i) => {
    const assetType = fixtureAssetType(s.type);
    return {
      // UUID so CampaignMemoryEntrySchema IdList validation accepts fixture links.
      assetId: randomUUID(),
      assetType,
      // P11-12: type-appropriate tags only (no full EASM+CAASM+… stamp).
      coverageTags: fixtureCoverageTags(assetType),
      crownJewel: i % 3 === 0,
      discoveredBy: s.id,
      firstSeen: new Date(Date.now() - 86400000 * (i + 1)).toISOString(),
      lastSeen: new Date().toISOString(),
      properties: {
        pillar: "ASV_EASM",
        coverage: "broad-recon-swarm",
        source: s.id,
        fixtureTenantHint: tenantId.slice(0, 8),
        ...LIVING_MAP_FIXTURE_WATERMARK
      },
      riskScore: 20 + (i % 40)
    };
  });
}

export function queryForTerrain(
  tenantId: string,
  inventory: AssetInventoryEntry[],
  input?: Partial<TerrainQueryInput>
): {
  terrainSummary: string;
  assetCount: number;
  crownJewels: AssetInventoryEntry[];
  swarmKbFacts: string[];
  campaignMemory?: CampaignMemoryEntry[];
  fixture: typeof LIVING_MAP_FIXTURE_WATERMARK;
} {
  const parsed = input
    ? TerrainQueryInputSchema.partial().parse({ tenantId, ...input })
    : { tenantId };
  let filtered = [...inventory];
  if (parsed.coverageTags && parsed.coverageTags.length > 0) {
    const want = new Set(parsed.coverageTags);
    filtered = filtered.filter((a) =>
      (a.coverageTags ?? []).some((t) => want.has(t))
    );
  }
  if (parsed.crownJewelsOnly) {
    filtered = filtered.filter((a) => a.crownJewel);
  }
  const crownJewels = filtered.filter(
    (a) => a.crownJewel || (a.riskScore ?? 0) >= 70
  );
  const summary = `[Labs/stub not-configured] Cyber Terrain Map fixture: tenant=${tenantId} assets=${filtered.length} crownJewels=${crownJewels.length} coverage=${COVERAGE_TAGS_VERBATIM}. Not a real living map.`;
  const swarmKbFacts: string[] = [
    `nodes:${filtered.length}`,
    `crownJewels:${crownJewels.length}`,
    `tags:${COVERAGE_TAGS_VERBATIM}`,
    `tenant:${tenantId}`,
    "source:fixture-living-map-terrain",
    "productStatus:not-configured"
  ];
  return {
    terrainSummary: summary,
    assetCount: filtered.length,
    crownJewels,
    swarmKbFacts,
    campaignMemory: parsed.includeCampaignMemory ? [] : undefined,
    fixture: LIVING_MAP_FIXTURE_WATERMARK
  };
}

export function computeLivingMapDelta(
  previous: AssetInventoryEntry[],
  current: AssetInventoryEntry[],
  priorCampaigns: CampaignMemoryEntry[] = []
): LivingMapDelta & { fixture: typeof LIVING_MAP_FIXTURE_WATERMARK } {
  const base = computeAssetInventoryChange(previous, current);
  const prevCrownCount = previous.filter((a) => a.crownJewel).length;
  const currCrownCount = current.filter((a) => a.crownJewel).length;
  const crownJewelImpactDelta = currCrownCount - prevCrownCount;
  // risk $$ impact on crown jewels (fixture scale for $$; NEVER customer-facing financial impact)
  const crownRiskSum = current
    .filter((a) => a.crownJewel)
    .reduce((sum, a) => sum + (a.riskScore ?? 50), 0);
  const dollarImpact = Math.round(crownRiskSum * 1250); // $$ modeled impact fixture
  const deltaSummary = `${base.deltaSummary}; crownJewelCountDelta=${crownJewelImpactDelta} risk$$Impact≈$${dollarImpact} [fixture/lab-only, not product valuation]; priorCampaigns:${priorCampaigns.length}`;
  const campaignMemoryUpdates: CampaignMemoryEntry[] =
    priorCampaigns.length > 0 || crownJewelImpactDelta !== 0
      ? [
          CampaignMemoryEntrySchema.parse({
            campaignId: `living-delta-fixture-${Date.now()}`,
            timestamp: new Date().toISOString(),
            affectedAssets: current
              .filter((a) => a.crownJewel)
              .map((a) => a.assetId),
            riskImpact: dollarImpact,
            summary:
              "[fixture/lab-only] Persistent campaign memory update from living map delta — not customer financial impact.",
            terrainDelta: {
              added: base.added,
              crownDelta: crownJewelImpactDelta,
              dollarImpact,
              ...LIVING_MAP_FIXTURE_WATERMARK
            }
          })
        ]
      : [];
  return {
    ...LivingMapDeltaSchema.parse({
      added: base.added,
      removed: base.removed,
      changed: base.changed,
      crownJewelImpactDelta,
      deltaSummary,
      campaignMemoryUpdates
    }),
    fixture: LIVING_MAP_FIXTURE_WATERMARK
  };
}

export function queryContinuousInventory(
  assets: AssetInventoryEntry[],
  query: {
    coverageTags?: AssetCoverageTag[];
    minRisk?: number;
    crownJewelsOnly?: boolean;
  }
): AssetInventoryEntry[] {
  return assets.filter((asset) => {
    if (query.coverageTags?.length) {
      const have = asset.coverageTags ?? [];
      if (!query.coverageTags.some((t) => have.includes(t))) return false;
    }
    if (
      typeof query.minRisk === "number" &&
      (asset.riskScore ?? 0) < query.minRisk
    ) {
      return false;
    }
    if (query.crownJewelsOnly && !asset.crownJewel) return false;
    return true;
  });
}

/**
 * Fixture $$ impact on crown jewels — never product FAIR valuation.
 * Multiplier default 1250 is deliberate theater scale for Labs demos only.
 */
export function computeCrownJewelRiskImpact(
  crownJewels: AssetInventoryEntry[],
  options?: {
    financialMultiplier?: number;
    campaigns?: Array<{ riskImpact?: number }>;
  }
): {
  crownJewelCount: number;
  estimatedDollarImpact: number;
  riskContribution: number;
  summary: string;
  fixture: typeof LIVING_MAP_FIXTURE_WATERMARK;
} {
  const count = crownJewels.length;
  if (count === 0) {
    return {
      crownJewelCount: 0,
      estimatedDollarImpact: 0,
      riskContribution: 0,
      summary:
        "[fixture/lab-only] No crown jewels identified in living terrain inventory stub.",
      fixture: LIVING_MAP_FIXTURE_WATERMARK
    };
  }
  const avgRisk =
    crownJewels.reduce((s, a) => s + (a.riskScore ?? 50), 0) / count;
  const mult = options?.financialMultiplier ?? 1250;
  const dollar = Math.round(avgRisk * mult);
  const priorCampaignImpact = (options?.campaigns ?? []).reduce(
    (s, c) => s + (c.riskImpact ?? 0),
    0
  );
  const totalImpact = dollar + priorCampaignImpact;
  const contribution = Math.min(30, Math.round(avgRisk / 4));
  return {
    crownJewelCount: count,
    estimatedDollarImpact: totalImpact,
    riskContribution: contribution,
    summary: `[fixture/lab-only] Crown jewels stub: ${count} assets, $${totalImpact} est. impact (not product valuation).`,
    fixture: LIVING_MAP_FIXTURE_WATERMARK
  };
}

/** Fold fixture crown-jewel $$ into a RiskScoreInput — lab-only, never production scoring path. */
export function applyCrownJewelImpactToRiskInput(
  input: RiskScoreInput,
  crownImpact: { estimatedDollarImpact?: number; riskContribution?: number }
): RiskScoreInput {
  const fin = input.financialImpact ?? 0;
  const added = Math.round(
    (crownImpact.estimatedDollarImpact ?? 0) / 10000 +
      (crownImpact.riskContribution ?? 0) / 2
  );
  return {
    ...input,
    financialImpact: Math.min(100, fin + added)
  };
}

/** Symbol list used by quarantine tests — must stay out of package index. */
export const LIVING_MAP_TERRAIN_STUB_EXPORTS = [
  "computeAssetInventoryChange",
  "seedDiscoveryAssetsForASVEASM",
  "queryForTerrain",
  "computeLivingMapDelta",
  "queryContinuousInventory",
  "computeCrownJewelRiskImpact",
  "applyCrownJewelImpactToRiskInput",
  "LIVING_MAP_FIXTURE_WATERMARK",
  "LIVING_MAP_TERRAIN_STUB_EXPORTS"
] as const;
