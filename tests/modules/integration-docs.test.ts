import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type IntegrationDocsJson = {
  integrations: Array<{
    connectable: boolean;
    dedicatedClient: boolean;
    executionReadiness: string;
    executionReadinessReason: string;
    implementationTier: string;
    live: boolean;
    product: string;
    status: string;
    vendor: string;
  }>;
  totals: {
    catalog: number;
    connectable: number;
    live: number;
  };
};

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("generated integration docs", () => {
  it("does not present planned connectors as live integrations", async () => {
    const [markdown, jsonText, readme, productPlan, traceability] =
      await Promise.all([
        readRepoFile("docs/INTEGRATIONS.md"),
        readRepoFile("docs/integrations.json"),
        readRepoFile("README.md"),
        readRepoFile("docs/PRODUCT_COMPLETION_PLAN.md"),
        readRepoFile("docs/TRACEABILITY_MATRIX.md")
      ]);
    const directory = JSON.parse(jsonText) as IntegrationDocsJson;
    const liveItems = directory.integrations.filter((item) => item.live);
    const catalogItems = directory.integrations.filter((item) => !item.live);
    const total = directory.totals.live + directory.totals.catalog;

    expect(directory.totals.live).toBe(liveItems.length);
    expect(directory.totals.catalog).toBe(catalogItems.length);
    expect(directory.totals.connectable).toBe(
      directory.integrations.filter((item) => item.connectable).length
    );
    expect(directory.totals.connectable).toBe(directory.totals.live);
    expect(
      directory.integrations.filter((item) => !item.connectable).length
    ).toBe(directory.totals.catalog);
    expect(liveItems.filter((item) => item.status === "Planned")).toEqual([]);
    expect(liveItems.every((item) => item.dedicatedClient)).toBe(true);
    expect(catalogItems.every((item) => !item.dedicatedClient)).toBe(true);
    expect(
      liveItems.every((item) => item.implementationTier === "DedicatedClient")
    ).toBe(true);
    expect(
      catalogItems.every(
        (item) =>
          item.implementationTier === "StandardizedCatalog" &&
          item.status === "Planned" &&
          item.executionReadiness === "NotConnectable"
      )
    ).toBe(true);
    expect(
      liveItems.every(
        (item) =>
          item.executionReadiness === "ReadyForCredentials" &&
          item.executionReadinessReason.length > 0
      )
    ).toBe(true);
    expect(markdown).toContain(
      `**${directory.totals.catalog}** standardized catalog entries are **Planned and not connectable**`
    );
    expect(markdown).not.toContain("connectable Beta catalog manifests");

    expect(
      directory.integrations.find(
        (item) => item.vendor === "Kaseya" && item.product === "Datto RMM"
      )
    ).toMatchObject({
      live: true,
      status: "Beta"
    });
    expect(
      directory.integrations.find(
        (item) => item.vendor === "Kaseya" && item.product === "VSA"
      )
    ).toMatchObject({
      live: true,
      status: "Beta"
    });
    expect(
      directory.integrations.find(
        (item) =>
          item.vendor === "ConnectWise" &&
          item.product === "ConnectWise Automate"
      )
    ).toMatchObject({
      live: true,
      status: "Beta"
    });
    expect(
      directory.integrations.find(
        (item) =>
          item.vendor === "Oracle" &&
          item.product === "Oracle Cloud Infrastructure"
      )
    ).toMatchObject({
      live: true,
      status: "Beta"
    });
    expect(
      directory.integrations.find(
        (item) => item.vendor === "Alibaba" && item.product === "Alibaba Cloud"
      )
    ).toMatchObject({
      live: true,
      status: "Beta"
    });

    expect(readme).toContain(
      `${total}-entry connector catalog: ${directory.totals.live} dedicated live integrations and ${directory.totals.catalog} planned, non-connectable catalog entries`
    );
    expect(productPlan).toContain(
      `integration catalog with ${total} marketplace entries (${directory.totals.live} dedicated live integrations plus ${directory.totals.catalog} planned, non-connectable catalog entries)`
    );
    expect(traceability).toContain(
      `Implemented as a ${total}-entry API catalog (${directory.totals.live} dedicated live clients and ${directory.totals.catalog} planned, non-connectable catalog entries)`
    );
    expect(`${readme}\n${productPlan}\n${traceability}`).not.toContain(
      "standardized connectable Beta catalog manifests"
    );
    expect(`${readme}\n${productPlan}\n${traceability}`).not.toContain(
      "108-entry"
    );
  });
});
