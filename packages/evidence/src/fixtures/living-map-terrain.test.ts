import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import * as evidence from "../index.js";
import {
  applyCrownJewelImpactToRiskInput,
  computeAssetInventoryChange,
  computeCrownJewelRiskImpact,
  computeLivingMapDelta,
  type FixtureAssetInventoryEntry,
  LIVING_MAP_FIXTURE_WATERMARK,
  LIVING_MAP_TERRAIN_STUB_EXPORTS,
  queryContinuousInventory,
  queryForTerrain,
  seedDiscoveryAssetsForASVEASM
} from "./living-map-terrain.js";

const FIXTURE_DIR = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_SRC = join(FIXTURE_DIR, "..");
const REPO_ROOT = join(FIXTURE_DIR, "../../../..");

describe("P11-5 living-map / terrain / swarm-KB quarantine", () => {
  it("does not re-export terrain stubs from the production package index", () => {
    const evidenceExports = evidence as Record<string, unknown>;
    for (const name of LIVING_MAP_TERRAIN_STUB_EXPORTS) {
      expect(evidenceExports).not.toHaveProperty(name);
    }
    // Production graph service remains available.
    expect(typeof evidence.createInMemoryEvidenceGraphService).toBe("function");
    expect(typeof evidence.createPrismaEvidenceGraphService).toBe("function");
    expect(typeof evidence.calculateRiskScore).toBe("function");
    expect(typeof evidence.estimateFinancialExposure).toBe("function");
  });

  it("keeps fixture helpers watermarked as Labs/stub not-configured", () => {
    expect(LIVING_MAP_FIXTURE_WATERMARK.kind).toBe("fixture");
    expect(LIVING_MAP_FIXTURE_WATERMARK.labOnly).toBe(true);
    expect(LIVING_MAP_FIXTURE_WATERMARK.productStatus).toBe("not-configured");

    const inventory = seedDiscoveryAssetsForASVEASM("tenant-demo-id", [
      { type: "Domain", id: "recon.subdomain_enum" },
      { type: "Host", id: "connector.caasm" },
      { type: "CloudResource", id: "recon.dns" }
    ]);
    expect(inventory).toHaveLength(3);
    expect(inventory[0]?.properties).toMatchObject(LIVING_MAP_FIXTURE_WATERMARK);
    // P11-12: type-appropriate tags only — never full EASM+CAASM+K8s+… stamp.
    expect(inventory[0]?.coverageTags).toEqual(["EASM", "Domain"]);
    expect(inventory[0]?.coverageTags).not.toContain("Kubernetes");
    expect(inventory[1]?.coverageTags).toEqual(["Internal", "Host"]);
    expect(inventory[2]?.coverageTags).toEqual(["Cloud", "CAASM"]);

    const terrain = queryForTerrain("tenant-demo-id", inventory);
    expect(terrain.fixture).toEqual(LIVING_MAP_FIXTURE_WATERMARK);
    expect(terrain.terrainSummary).toMatch(/Labs\/stub not-configured/i);
    expect(terrain.swarmKbFacts).toContain("productStatus:not-configured");
    expect(terrain.swarmKbFacts).toContain("source:fixture-living-map-terrain");

    const delta = computeLivingMapDelta([], inventory);
    expect(delta.fixture).toEqual(LIVING_MAP_FIXTURE_WATERMARK);
    expect(delta.deltaSummary).toMatch(/fixture\/lab-only/i);

    const impact = computeCrownJewelRiskImpact(
      inventory.filter((a) => a.crownJewel)
    );
    expect(impact.fixture).toEqual(LIVING_MAP_FIXTURE_WATERMARK);
    expect(impact.summary).toMatch(/fixture\/lab-only/i);
    // Synthetic $$ scale is explicitly disclaimed — not FAIR / product valuation.
    expect(impact.summary).toMatch(/not product valuation/i);
  });

  it("supports inventory delta / filter helpers without implying product graph truth", () => {
    const now = new Date().toISOString();
    const previous: FixtureAssetInventoryEntry[] = [
      {
        assetId: "11111111-1111-4111-8111-111111111111",
        assetType: "Domain",
        coverageTags: ["EASM"],
        crownJewel: true,
        discoveredBy: "fixture",
        firstSeen: now,
        lastSeen: now,
        properties: {},
        riskScore: 80
      }
    ];
    const current: FixtureAssetInventoryEntry[] = [
      ...previous,
      {
        assetId: "22222222-2222-4222-8222-222222222222",
        assetType: "Host",
        coverageTags: ["CAASM"],
        crownJewel: false,
        discoveredBy: "fixture",
        firstSeen: now,
        lastSeen: now,
        properties: {},
        riskScore: 20
      }
    ];
    const change = computeAssetInventoryChange(previous, current);
    expect(change.added).toBe(1);
    expect(change.deltaSummary).toMatch(/fixture\/lab-only/i);

    const filtered = queryContinuousInventory(current, {
      coverageTags: ["EASM"],
      crownJewelsOnly: true
    });
    expect(filtered).toHaveLength(1);
    expect(filtered.every((a) => a.crownJewel)).toBe(true);

    const folded = applyCrownJewelImpactToRiskInput(
      {
        businessCriticality: "Moderate",
        confidence: 0.5,
        controlResponse: null,
        impactScore: 40,
        internetExposed: false,
        privilegedPath: false,
        validationState: "Validated",
        verificationStatus: null,
        financialImpact: 10
      },
      { estimatedDollarImpact: 50_000, riskContribution: 10 }
    );
    expect(folded.financialImpact).toBeGreaterThan(10);
  });

  it("does not leave stub symbols in production graph.ts / risk.ts source", () => {
    const graphSrc = readFileSync(join(EVIDENCE_SRC, "graph.ts"), "utf8");
    const riskSrc = readFileSync(join(EVIDENCE_SRC, "risk.ts"), "utf8");
    const indexSrc = readFileSync(join(EVIDENCE_SRC, "index.ts"), "utf8");

    for (const banned of [
      "export function seedDiscoveryAssetsForASVEASM",
      "export function queryForTerrain",
      "export function computeLivingMapDelta",
      "export function queryContinuousInventory",
      "export function computeAssetInventoryChange",
      "export function computeCrownJewelRiskImpact",
      "export function applyCrownJewelImpactToRiskInput",
      "swarmKbFacts",
      "living-delta-"
    ]) {
      expect(graphSrc).not.toContain(banned);
      expect(riskSrc).not.toContain(banned);
    }
    expect(indexSrc).not.toMatch(/fixtures\/living-map/);
    // Explicit quarantine pointer remains for maintainers.
    expect(graphSrc).toMatch(/P11-5/);
    expect(riskSrc).toMatch(/P11-5/);
  });

  it("bans apps/* production imports of living-map terrain fixtures", () => {
    const appsRoot = join(REPO_ROOT, "apps");
    const offenders: string[] = [];
    // Only flag actual import/require wiring — comments may document the quarantine.
    const importLine =
      /^\s*(?:import\s|export\s.+from\s|const\s.+=\s*require\()/;
    const symbols = [
      "living-map-terrain",
      "seedDiscoveryAssetsForASVEASM",
      "queryForTerrain",
      "computeLivingMapDelta",
      "queryContinuousInventory",
      "computeCrownJewelRiskImpact",
      "applyCrownJewelImpactToRiskInput",
      "computeAssetInventoryChange"
    ];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === ".next" ||
          // Runtime artifact roots (e.g. apps/api/.periscan evidence store)
          // are not production source; dot-prefixed dirs are never imports.
          entry.name.startsWith(".")
        ) {
          continue;
        }
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
        if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
        const text = readFileSync(full, "utf8");
        for (const line of text.split("\n")) {
          if (!importLine.test(line)) continue;
          for (const symbol of symbols) {
            if (line.includes(symbol)) {
              offenders.push(`${full}: ${line.trim()}`);
            }
          }
        }
      }
    }

    walk(appsRoot);
    expect(offenders).toEqual([]);
  });
});
