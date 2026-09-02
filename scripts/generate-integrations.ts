/**
 * Generates docs/INTEGRATIONS.md from the live connector catalog so the published
 * integration list never drifts from code. A connector is "Live" (real outbound
 * API integration) when it is connectable, not Planned, and NOT produced by the
 * standardized market-leader connector factory. Factory-generated catalog
 * coverage is Planned and non-connectable until a vendor-specific live client
 * and credentialed contract tests are implemented and reviewed.
 *
 * Run: npx tsx scripts/generate-integrations.ts
 */
import { readdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

import { getConnectorCatalog } from "../packages/connectors/src/index.js";
import { summarizeCatalogProductionHonesty } from "../packages/shared/src/connector-production-qualification.js";
import {
  buildTop10ProductionCertBoard,
  resolveExternalIntegrationTier,
  summarizeExternalTierCounts
} from "../packages/shared/src/integration-external-tiers.js";

const catalog = getConnectorCatalog();

function isLive(manifest: (typeof catalog)[number]) {
  return manifest.live;
}

function kind(manifest: (typeof catalog)[number]) {
  return (manifest.controlObservationCapabilities?.length ?? 0) > 0
    ? "Control observer"
    : "Signal source";
}

const liveCount = catalog.filter((c) => isLive(c)).length;
const plannedCount = catalog.filter(
  (connector) => connector.executionReadiness === "NotConnectable"
).length;
const connectableCount = catalog.filter(
  (connector) => connector.connectable !== false
).length;
const contractTestFiles = readdirSync("packages/connectors/src").filter((f) =>
  f.endsWith(".contract.test.ts")
);
const contractTested = contractTestFiles.length;
const contractTestedKeys = new Set(
  contractTestFiles.map((f) => basename(f, ".contract.test.ts"))
);

const byCategory = new Map<string, typeof catalog>();
for (const manifest of catalog) {
  const category = manifest.marketplaceCategory ?? "Other";
  const list = byCategory.get(category) ?? [];
  list.push(manifest);
  byCategory.set(category, list);
}

const lines: string[] = [];
lines.push("# Periscan Integrations");
lines.push("");
lines.push(
  `Periscan catalogs **${catalog.length} enterprise security platforms** across the detection, exposure, identity, cloud, and code-security stack. **${liveCount}** are **dedicated live integrations** with hand-authored API clients; **${contractTested}** of those are additionally verified by recorded-fixture contract tests. **${plannedCount}** standardized catalog entries are **Planned and not connectable** until a vendor-specific live client and credentialed contract tests are implemented and reviewed.`
);
lines.push("");
lines.push(
  "_This file is generated from the connector catalog (`scripts/generate-integrations.ts`) — do not edit by hand; run `npx tsx scripts/generate-integrations.ts` to refresh._"
);
lines.push("");
lines.push(
  "**Legend:** ✅ Dedicated live integration · ◷ Planned catalog coverage. External tiers are **Production / Beta / Planned** (P12-14). Dedicated connectors remain **Beta** until customer-credential live-smoke certification; the **contract-tested** subset has automated request-contract + normalization coverage in CI but is **not** Production. Planned stays non-connectable."
);
lines.push("");

// P12-14: external tier summary + top-10 Production cert board
const externalTiers = catalog.map((manifest) =>
  resolveExternalIntegrationTier({
    availability: manifest.availability,
    connectable: manifest.connectable,
    live: manifest.live,
    executionReadiness: manifest.executionReadiness,
    productionCertified: false
  })
);
const tierCounts = summarizeExternalTierCounts(externalTiers);
// productionCertified stays false until a validated receipt elevates a key
// (packages/shared connector-production-qualification gate). Never invent.
const top10Board = buildTop10ProductionCertBoard({
  overrides: Object.fromEntries(
    [...contractTestedKeys].map((key) => [key, { contractTested: true }])
  )
});
const catalogHonesty = summarizeCatalogProductionHonesty({
  productionCertifiedCount: tierCounts.Production,
  betaCount: tierCounts.Beta,
  plannedCount: tierCounts.Planned
});

lines.push("## External maturity tiers (Production / Beta / Planned)");
lines.push("");
lines.push(
  "Customer and analyst-facing tier table. **Production** requires customer-credential live-smoke evidence — fixture contract tests alone never mint Production."
);
lines.push("");
lines.push(`_${catalogHonesty.customerFacingSummary}_`);
lines.push("");
lines.push("| External tier | Count | Meaning |");
lines.push("| --- | ---: | --- |");
lines.push(
  `| **Production** | ${tierCounts.Production} | Customer-credential live-smoke certified |`
);
lines.push(
  `| **Beta** | ${tierCounts.Beta} | Dedicated live client; connectable with credentials; not Production-certified |`
);
lines.push(
  `| **Planned** | ${tierCounts.Planned} | Catalog coverage only — **not connectable** until a dedicated client ships |`
);
lines.push("");
lines.push("### Top-10 Production certification targets");
lines.push("");
lines.push(
  "Priority stack for SIEM / EDR / CNAPP / ITSM / IdP depth (P12-14). Honest status until customer-credential evidence lands."
);
lines.push("");
lines.push(
  "| Priority | Connector | Stack | External tier | Cert status | Evidence note |"
);
lines.push("| ---: | --- | --- | --- | --- | --- |");
for (const row of top10Board) {
  lines.push(
    `| ${row.priority} | ${row.vendor} ${row.product} (\`${row.connectorKey}\`) | ${row.stackClass} | ${row.externalTier} | ${row.certStatus} | ${row.evidenceNote} |`
  );
}
lines.push("");

// Live integrations summary table.
lines.push("## Live integrations");
lines.push("");
lines.push("| Vendor | Product | Category | Type | External tier |");
lines.push("| --- | --- | --- | --- | --- |");
for (const manifest of catalog
  .filter((c) => isLive(c))
  .sort((a, b) => (a.vendor ?? "").localeCompare(b.vendor ?? ""))) {
  const tier = resolveExternalIntegrationTier({
    availability: manifest.availability,
    connectable: manifest.connectable,
    live: manifest.live,
    executionReadiness: manifest.executionReadiness,
    productionCertified: false
  });
  lines.push(
    `| ${manifest.vendor} | ${manifest.product} | ${manifest.marketplaceCategory} | ${kind(manifest)} | ${tier} |`
  );
}
lines.push("");

// Full catalog grouped by marketplace category.
lines.push("## Full catalog by category");
lines.push("");
for (const category of [...byCategory.keys()].sort()) {
  const connectors = byCategory
    .get(category)!
    .sort((a, b) => (a.vendor ?? "").localeCompare(b.vendor ?? ""));
  lines.push(`### ${category} (${connectors.length})`);
  lines.push("");
  for (const manifest of connectors) {
    const badge = isLive(manifest) ? "✅" : "◷";
    lines.push(
      `- ${badge} **${manifest.vendor} ${manifest.product}** — ${manifest.customerVisibleDescription}`
    );
  }
  lines.push("");
}

writeFileSync("docs/INTEGRATIONS.md", lines.join("\n"));

// Machine-readable data for the website to render the integrations directory.
const websiteData = {
  generatedFrom: "Periscan connector catalog",
  totals: {
    catalog: catalog.length - liveCount,
    categories: byCategory.size,
    connectable: connectableCount,
    contractTested,
    externalTiers: tierCounts,
    integrations: catalog.length,
    live: liveCount,
    productionCertified: tierCounts.Production,
    hasAnyProductionCertified: catalogHonesty.hasAnyProduction,
    productionHonestySummary: catalogHonesty.customerFacingSummary
  },
  top10ProductionCert: top10Board,
  integrations: [...byCategory.keys()].sort().flatMap((category) =>
    byCategory
      .get(category)!
      .sort((a, b) => (a.vendor ?? "").localeCompare(b.vendor ?? ""))
      .map((m) => {
        const externalTier = resolveExternalIntegrationTier({
          availability: m.availability,
          connectable: m.connectable,
          live: m.live,
          executionReadiness: m.executionReadiness,
          productionCertified: false
        });
        return {
          category,
          connectable: m.connectable !== false,
          dedicatedClient: m.dedicatedClient,
          description: m.customerVisibleDescription,
          executionReadiness: m.executionReadiness,
          executionReadinessReason: m.executionReadinessReason,
          externalTier,
          implementationTier: m.implementationTier,
          live: isLive(m),
          product: m.product,
          status: m.availability ?? "Beta",
          type: kind(m),
          vendor: m.vendor
        };
      })
  )
};
writeFileSync(
  "docs/integrations.json",
  `${JSON.stringify(websiteData, null, 2)}\n`
);

console.log(
  `Wrote docs/INTEGRATIONS.md + docs/integrations.json — ${catalog.length} catalog entries (${liveCount} live, ${plannedCount} planned, ${contractTested} contract-tested) across ${byCategory.size} categories.`
);
