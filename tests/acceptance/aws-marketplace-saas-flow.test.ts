import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import {
  awsMarketplaceConfigFromEnv,
  type AwsMarketplaceProvider
} from "../../apps/api/src/services/aws-marketplace.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

class FakeAwsMarketplaceProvider implements AwsMarketplaceProvider {
  batchCalls = 0;
  entitled = true;
  licenseArn = `arn:aws:license-manager::123456789012:license:l-${randomUUID()}`;

  async resolveCustomer(registrationToken: string) {
    expect(registrationToken).toBe("aws-registration-token-123456789");
    return {
      customerAwsAccountId: "123456789012",
      customerIdentifier: "customer-legacy-id",
      licenseArn: this.licenseArn,
      productCode: "periscan-product"
    };
  }

  async getEntitlements() {
    return this.entitled
      ? [
          {
            dimension: "enterprise",
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            licenseArn: this.licenseArn,
            value: 1
          }
        ]
      : [];
  }

  async batchMeterUsage(
    input: Parameters<AwsMarketplaceProvider["batchMeterUsage"]>[0]
  ) {
    this.batchCalls += 1;
    expect(input.productCode).toBe("periscan-product");
    expect(input.records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerAwsAccountId: "123456789012",
          dimension: "validation_runs",
          licenseArn: this.licenseArn
        })
      ])
    );
    return input.records.map((record) => ({
      dimension: record.dimension,
      meteringRecordId: `meter-${record.dimension}-${randomUUID()}`,
      status: "Success" as const
    }));
  }
}

describe("AWS Marketplace SaaS integration", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "aws-market",
        "aws-mkt-honesty"
      ]);
      await prisma.awsMarketplaceRegistration.deleteMany({
        where: {
          productCode: {
            in: ["periscan-product", "prod-honesty-example"]
          }
        }
      });
      await prisma.$disconnect();
    }
  });

  it("defaults listing honesty to NotConfigured and never invents Public (Slice B / row 98)", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    // Env path: bare process never invents a Public listing.
    const bareEnv = awsMarketplaceConfigFromEnv({});
    expect(bareEnv.listingState).toBe("NotConfigured");
    expect(bareEnv.productCode).toBeNull();
    const publicWithoutProof = awsMarketplaceConfigFromEnv({
      PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE: "prod-honesty-example",
      PERISCAN_AWS_MARKETPLACE_LISTING_STATE: "Public"
    });
    expect(publicWithoutProof.listingState).toBe("IntegrationReady");
    expect(publicWithoutProof.listingState).not.toBe("Public");

    // No product code / provider → honest NotConfigured surface on the live API.
    const notConfiguredApp = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        awsMarketplaceConfig: bareEnv,
        dataRegion: "us-east-1",
        devMode: true,
        prisma,
        webBaseUrl: "http://localhost:3000"
      })
    });
    try {
      const owner = await testHelpers.performSignup(
        notConfiguredApp,
        "aws-mkt-honesty",
        "Marketplace Honesty Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const status = await notConfiguredApp.inject({
        cookies,
        method: "GET",
        url: "/api/v1/billing/aws-marketplace"
      });
      expect(status.statusCode).toBe(200);
      expect(status.json()).toMatchObject({
        configured: false,
        listingState: "NotConfigured",
        publicMarketplaceAvailabilityProven: false,
        subscription: null
      });
      expect(status.json().listingState).not.toBe("Public");

      // Register / claim / meter must fail closed when NotConfigured.
      const register = await notConfiguredApp.inject({
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
        payload: "x-amzn-marketplace-token=aws-registration-token-123456789",
        url: "/api/v1/billing/aws-marketplace/register"
      });
      expect(register.statusCode).toBeGreaterThanOrEqual(400);
      expect(register.statusCode).not.toBe(200);
    } finally {
      await notConfiguredApp.close();
    }

    // Product code + LISTING_STATE=Public without ops attestation never becomes Public.
    const clampedApp = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        awsMarketplaceConfig: {
          ...publicWithoutProof,
          dimensionMappings: { ValidationRuns: "validation_runs" },
          entitlementPackageMappings: { enterprise: "Enterprise" }
        },
        awsMarketplaceProvider: new FakeAwsMarketplaceProvider(),
        dataRegion: "us-east-1",
        devMode: true,
        prisma,
        webBaseUrl: "http://localhost:3000"
      })
    });
    try {
      const owner = await testHelpers.performSignup(
        clampedApp,
        "aws-mkt-honesty",
        "Marketplace Clamped Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const status = await clampedApp.inject({
        cookies,
        method: "GET",
        url: "/api/v1/billing/aws-marketplace"
      });
      expect(status.statusCode).toBe(200);
      expect(status.json().listingState).toBe("IntegrationReady");
      expect(status.json().listingState).not.toBe("Public");
      expect(status.json().publicMarketplaceAvailabilityProven).toBe(false);
      expect(status.json().configured).toBe(true);
    } finally {
      await clampedApp.close();
    }
  });

  it("resolves a buyer, claims entitlements, meters once per hour, and fails closed on cancellation", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const provider = new FakeAwsMarketplaceProvider();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        awsMarketplaceConfig: {
          dimensionMappings: { ValidationRuns: "validation_runs" },
          entitlementPackageMappings: { enterprise: "Enterprise" },
          listingState: "Limited",
          productCode: "periscan-product"
        },
        awsMarketplaceProvider: provider,
        dataRegion: "us-east-1",
        devMode: true,
        prisma,
        webBaseUrl: "http://localhost:3000"
      })
    });

    try {
      const registration = await app.inject({
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST",
        payload: "x-amzn-marketplace-token=aws-registration-token-123456789",
        url: "/api/v1/billing/aws-marketplace/register"
      });
      expect(registration.statusCode).toBe(303);
      const redirect = new URL(registration.headers.location!);
      expect(redirect.pathname).toBe("/billing");
      const claimToken = new URLSearchParams(redirect.hash.slice(1)).get(
        "awsMarketplaceClaim"
      );
      expect(claimToken).toMatch(/^[A-Za-z0-9_-]{40,}$/u);

      const owner = await testHelpers.performSignup(
        app,
        "aws-market",
        "AWS Marketplace Tenant"
      );
      const tenantId = owner.response.json().tenant.tenantId as string;
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const claim = await app.inject({
        cookies,
        method: "POST",
        payload: { claimToken },
        url: "/api/v1/billing/aws-marketplace/claim"
      });
      expect(claim.statusCode, claim.body).toBe(200);
      expect(claim.json()).toMatchObject({
        configured: true,
        listingState: "Limited",
        publicMarketplaceAvailabilityProven: false,
        subscription: {
          status: "Active"
        }
      });
      expect(claim.json().subscription.customerAwsAccountIdMasked).not.toBe(
        "123456789012"
      );
      expect(
        await prisma.tenant.findUniqueOrThrow({
          select: { billingPackageKey: true },
          where: { tenantId }
        })
      ).toMatchObject({ billingPackageKey: "Enterprise" });

      const metering = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/billing/aws-marketplace/metering/sync"
      });
      expect(metering.statusCode).toBe(200);
      expect(metering.json()).toMatchObject({
        accepted: 1,
        failed: 0,
        skipped: 0
      });
      expect(provider.batchCalls).toBe(1);

      const idempotentMetering = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/billing/aws-marketplace/metering/sync"
      });
      expect(idempotentMetering.statusCode).toBe(200);
      expect(idempotentMetering.json()).toMatchObject({
        accepted: 1,
        skipped: 1
      });
      expect(provider.batchCalls).toBe(1);

      provider.entitled = false;
      const refreshed = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/billing/aws-marketplace/entitlements/refresh"
      });
      expect(refreshed.statusCode).toBe(200);
      expect(refreshed.json().subscription.status).toBe("NotEntitled");
      expect(
        await prisma.tenant.findUniqueOrThrow({
          select: { billingPackageKey: true },
          where: { tenantId }
        })
      ).toMatchObject({ billingPackageKey: null });
    } finally {
      await app.close();
    }
  });
});
