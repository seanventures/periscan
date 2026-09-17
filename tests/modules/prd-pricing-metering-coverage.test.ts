import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  BILLING_PACKAGE_CATALOG,
  USAGE_METER_DEFINITIONS
} from "../../apps/api/src/runtime-services.js";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseBulletsBetween(
  section: string,
  startLabel: string,
  endLabel: string
) {
  return sectionBetween(section, startLabel, endLabel)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function parseBulletsFrom(section: string, startLabel: string) {
  const start = section.indexOf(startLabel);

  if (start === -1) {
    throw new Error(`Unable to find section label: ${startLabel}`);
  }

  return section
    .slice(start)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

const PRD_METER_TO_USAGE_METER = new Map([
  ["validated assets", "ValidatedAssets"],
  ["identities", "Identities"],
  ["control sources", "ControlSources"],
  ["AI apps/workflows", "AIApplications"],
  ["internal runners", "RunnerMinutes"],
  ["scenario executions", "ValidationRuns"],
  ["evidence workflows", "EvidencePacks"],
  ["MSSP client tenants", "ClientTenants"],
  ["retention", "EvidenceRetention"],
  ["API usage", "APIUsage"]
]);

describe("PRD section 17 Pricing and Metering coverage", () => {
  it("keeps every PRD metering unit represented by a public usage meter", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const pricingSection = sectionBetween(
      prd,
      "## 17. Pricing and Metering",
      "## 18. Build Phases"
    );
    const sourceMeters = parseBulletsBetween(
      pricingSection,
      "Metering Units",
      "Packaging"
    );
    const meterNames = new Set(
      USAGE_METER_DEFINITIONS.map((meter) => meter.meterName)
    );

    expect(sourceMeters).toEqual([...PRD_METER_TO_USAGE_METER.keys()]);

    for (const sourceMeter of sourceMeters) {
      const expectedMeter = PRD_METER_TO_USAGE_METER.get(sourceMeter);
      expect(
        expectedMeter,
        `Missing meter mapping for ${sourceMeter}`
      ).toBeDefined();
      expect(
        meterNames.has(expectedMeter!),
        `Missing usage meter ${expectedMeter}`
      ).toBe(true);
    }

    const retentionMeter = USAGE_METER_DEFINITIONS.find(
      (meter) => meter.meterName === "EvidenceRetention"
    );
    expect(retentionMeter).toMatchObject({
      label: "Evidence retention",
      unit: "days"
    });
  });

  it("keeps every PRD package available without publishing exact prices", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const pricingSection = sectionBetween(
      prd,
      "## 17. Pricing and Metering",
      "## 18. Build Phases"
    );
    const sourcePackages = parseBulletsFrom(pricingSection, "Packaging");
    const packageLabels = new Set(
      BILLING_PACKAGE_CATALOG.map((billingPackage) => billingPackage.label)
    );

    expect(pricingSection).toContain("Do not publish exact prices initially.");
    expect(pricingSection).toContain("Pay for what you validate.");
    expect(sourcePackages).toEqual([
      "Light External Scan",
      "Validation Snapshot",
      "Core Validation",
      "Control Validation",
      "AI Security Validation",
      "Evidence Packs",
      "MSSP / Partner",
      "Enterprise"
    ]);

    for (const sourcePackage of sourcePackages) {
      expect(
        packageLabels.has(sourcePackage),
        `Missing PRD package ${sourcePackage}`
      ).toBe(true);
    }

    for (const billingPackage of BILLING_PACKAGE_CATALOG) {
      // Support tier-specific descriptive language (no exact prices per PRD 17 + 1-13 freemium requirement)
      expect(typeof billingPackage.publicPricingLanguage).toBe("string");
      expect(billingPackage.publicPricingLanguage.length).toBeGreaterThan(0);
      expect(billingPackage.paymentProcessorStatus).toBe("NotConfigured");
      expect(JSON.stringify(billingPackage)).not.toMatch(
        /\$\d|\bprice\b|\bcurrency\b/iu
      );
    }
  });

  it("keeps pricing and metering API-first and visible through API-backed UI", async () => {
    const [apiSource, dashboardSource, clientSource] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/web/src/components/validation-ops-dashboard.tsx"),
      readRepoFile("apps/web/src/lib/periscan-api-client.ts")
    ]);

    for (const route of [
      "/api/v1/billing/meters",
      "/api/v1/billing/packages",
      "/api/v1/billing/usage",
      "/api/v1/billing/active-package"
    ]) {
      expect(apiSource, `Missing billing API route ${route}`).toContain(route);
    }

    for (const clientMethod of [
      "getBillingMeters",
      "getBillingPackages",
      "getBillingUsage",
      "getActiveBillingPackage"
    ]) {
      expect(
        clientSource,
        `Missing billing API client method ${clientMethod}`
      ).toContain(clientMethod);
      expect(
        dashboardSource,
        `Dashboard does not consume ${clientMethod}`
      ).toContain(`browserPeriscanApiClient.${clientMethod}()`);
    }

    expect(dashboardSource).toContain("Pay for what you validate.");
    expect(dashboardSource).toContain("Exact pricing");
  });
});
