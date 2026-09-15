import { describe, expect, it } from "vitest";

import { AwsMarketplaceStatusSchema } from "./aws-marketplace";

describe("AwsMarketplaceStatus honesty (PERISCAN-469)", () => {
  it("accepts default NotConfigured status without inventing a public listing", () => {
    const status = AwsMarketplaceStatusSchema.parse({
      configured: false,
      dimensionMappings: [],
      listingState: "NotConfigured",
      publicMarketplaceAvailabilityProven: false,
      recentMeteringRecords: [],
      subscription: null
    });
    expect(status.listingState).toBe("NotConfigured");
    expect(status.publicMarketplaceAvailabilityProven).toBe(false);
    expect(status.configured).toBe(false);
  });

  it("allows IntegrationReady without public availability proven", () => {
    const status = AwsMarketplaceStatusSchema.parse({
      configured: true,
      dimensionMappings: [{ awsDimension: "validation_runs", meterName: "ValidationRuns" }],
      listingState: "IntegrationReady",
      publicMarketplaceAvailabilityProven: false,
      recentMeteringRecords: [],
      subscription: null
    });
    expect(status.publicMarketplaceAvailabilityProven).toBe(false);
    expect(status.listingState).not.toBe("Public");
  });

  it("refuses invalid listing states that would invent a live market", () => {
    expect(() =>
      AwsMarketplaceStatusSchema.parse({
        configured: true,
        dimensionMappings: [],
        listingState: "Live",
        publicMarketplaceAvailabilityProven: true,
        recentMeteringRecords: [],
        subscription: null
      })
    ).toThrow();
  });
});
