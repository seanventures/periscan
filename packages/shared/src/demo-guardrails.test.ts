import { describe, expect, it } from "vitest";

import { PUBLIC_DEMO_TENANT_ID } from "./demo-snapshot";
import {
  DEMO_FIXTURE_WATERMARK,
  applyDemoFixtureWatermark,
  isCatalogOnlySimulationModule,
  isDemoTenantId,
  shouldShowModuleInCustomerCatalog
} from "./demo-guardrails";

describe("P05-18 demo guardrails", () => {
  it("identifies the public demo tenant", () => {
    expect(isDemoTenantId(PUBLIC_DEMO_TENANT_ID)).toBe(true);
    expect(isDemoTenantId("11111111-1111-4111-8111-111111111111")).toBe(false);
  });

  it("watermarks labels without double-prefix", () => {
    expect(applyDemoFixtureWatermark("TLS weak cipher")).toBe(
      `${DEMO_FIXTURE_WATERMARK}: TLS weak cipher`
    );
    expect(
      applyDemoFixtureWatermark(`${DEMO_FIXTURE_WATERMARK}: already`)
    ).toBe(`${DEMO_FIXTURE_WATERMARK}: already`);
  });

  it("hides catalog-only sims for production tenants", () => {
    expect(
      isCatalogOnlySimulationModule({
        featureTags: ["simulation", "catalog-only"]
      })
    ).toBe(true);
    expect(
      shouldShowModuleInCustomerCatalog({
        tenantId: "11111111-1111-4111-8111-111111111111",
        featureTags: ["catalog-only", "planning-only"]
      })
    ).toBe(false);
    expect(
      shouldShowModuleInCustomerCatalog({
        tenantId: PUBLIC_DEMO_TENANT_ID,
        featureTags: ["catalog-only"]
      })
    ).toBe(true);
  });
});
