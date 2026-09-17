import { describe, expect, it } from "vitest";

import {
  awsMarketplaceConfigFromEnv,
  resolveAwsMarketplaceListingState
} from "./aws-marketplace.js";

describe("AWS Marketplace listing honesty (PERISCAN-469)", () => {
  it("defaults to NotConfigured without a product code", () => {
    const config = awsMarketplaceConfigFromEnv({});
    expect(config.productCode).toBeNull();
    expect(config.listingState).toBe("NotConfigured");
  });

  it("does not invent Public listing from product code alone", () => {
    const config = awsMarketplaceConfigFromEnv({
      PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE: "prod-example",
      PERISCAN_AWS_MARKETPLACE_LISTING_STATE: "Public"
    });
    expect(config.productCode).toBe("prod-example");
    // Public without ops attestation clamps to IntegrationReady
    expect(config.listingState).toBe("IntegrationReady");
    expect(config.listingState).not.toBe("Public");
  });

  it("allows Public only when ops attest public availability", () => {
    const config = awsMarketplaceConfigFromEnv({
      PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE: "prod-example",
      PERISCAN_AWS_MARKETPLACE_LISTING_STATE: "Public",
      PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN: "true"
    });
    expect(config.listingState).toBe("Public");
  });

  it("keeps Limited when product code is set without Public claim", () => {
    const config = awsMarketplaceConfigFromEnv({
      PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE: "prod-example",
      PERISCAN_AWS_MARKETPLACE_LISTING_STATE: "Limited"
    });
    expect(config.listingState).toBe("Limited");
  });

  it("resolveAwsMarketplaceListingState refuses live Public without proof", () => {
    expect(
      resolveAwsMarketplaceListingState({
        productCode: null,
        publicAvailabilityProven: false,
        requestedListingState: "Public"
      })
    ).toBe("NotConfigured");

    expect(
      resolveAwsMarketplaceListingState({
        productCode: "x",
        publicAvailabilityProven: false,
        requestedListingState: "Public"
      })
    ).toBe("IntegrationReady");

    expect(
      resolveAwsMarketplaceListingState({
        productCode: "x",
        publicAvailabilityProven: true,
        requestedListingState: "Public"
      })
    ).toBe("Public");
  });
});
