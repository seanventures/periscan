import { createHash, randomBytes } from "node:crypto";

import {
  GetEntitlementsCommand,
  MarketplaceEntitlementServiceClient,
  type Entitlement as AwsEntitlement
} from "@aws-sdk/client-marketplace-entitlement-service";
import {
  BatchMeterUsageCommand,
  MarketplaceMeteringClient,
  ResolveCustomerCommand,
  type UsageRecord
} from "@aws-sdk/client-marketplace-metering";
import type { Prisma } from "@prisma/client";
import {
  AwsMarketplaceEntitlementPackageMapSchema,
  AwsMarketplaceEntitlementSchema,
  AwsMarketplaceMeteringSyncResultSchema,
  AwsMarketplaceRegistrationResolutionSchema,
  AwsMarketplaceStatusSchema,
  BillingPackageKeySchema,
  UsageMeterNameSchema,
  type AwsMarketplaceEntitlement,
  type AwsMarketplaceMeteringSyncResult,
  type AwsMarketplaceRegistrationResolution,
  type AwsMarketplaceStatus,
  type BillingPackageKey,
  type ClaimAwsMarketplaceRegistrationInput,
  type UsageMeterName
} from "@periscan/shared";
import { z } from "zod";

import {
  AppServiceError,
  buildBillingUsage,
  requireRole,
  TENANT_ADMIN_ROLES,
  writeAuditEvent,
  type AppServices,
  type AuthenticatedContext,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const HOUR_MS = 60 * 60 * 1_000;
const CLAIM_TTL_MS = 60 * 60 * 1_000;

const DimensionMapSchema = z.partialRecord(
  UsageMeterNameSchema,
  z.string().trim().min(1).max(255)
);

export interface AwsMarketplaceConfig {
  dimensionMappings: Partial<Record<UsageMeterName, string>>;
  entitlementPackageMappings: Record<string, BillingPackageKey>;
  listingState: "NotConfigured" | "IntegrationReady" | "Limited" | "Public";
  productCode: string | null;
}

export interface AwsMarketplaceProvider {
  batchMeterUsage(input: {
    productCode: string;
    records: Array<{
      customerAwsAccountId: string;
      dimension: string;
      licenseArn: string;
      quantity: number;
      usageHour: Date;
    }>;
  }): Promise<
    Array<{
      dimension: string;
      meteringRecordId: string | null;
      status:
        | "Success"
        | "CustomerNotSubscribed"
        | "DuplicateRecord"
        | "Unprocessed"
        | "Failed";
    }>
  >;
  getEntitlements(input: {
    customerAwsAccountId: string;
    licenseArn: string;
    productCode: string;
  }): Promise<AwsMarketplaceEntitlement[]>;
  resolveCustomer(registrationToken: string): Promise<{
    customerAwsAccountId: string;
    customerIdentifier: string | null;
    licenseArn: string;
    productCode: string;
  }>;
}

type MarketplaceServices = Pick<
  AppServices,
  | "claimAwsMarketplaceRegistration"
  | "getAwsMarketplaceStatus"
  | "refreshAwsMarketplaceEntitlements"
  | "resolveAwsMarketplaceRegistration"
  | "syncAwsMarketplaceMetering"
>;

function parseJsonObject(value: string | undefined): unknown {
  if (!value?.trim()) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new AppServiceError(
      "AWS Marketplace mapping configuration is not valid JSON.",
      503,
      "aws_marketplace_config_invalid"
    );
  }
}

/**
 * Resolve Marketplace listing honesty from env.
 *
 * - No product code → NotConfigured (never invent a live listing).
 * - Public requires an independent ops attestation env
 *   (`PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN=true`) in addition to
 *   LISTING_STATE=Public. Product code alone never proves public availability.
 * - Without that attestation, requested Public is clamped to IntegrationReady.
 */
export function resolveAwsMarketplaceListingState(input: {
  productCode: string | null;
  requestedListingState: string | undefined;
  publicAvailabilityProven: boolean;
}): AwsMarketplaceConfig["listingState"] {
  if (!input.productCode) {
    return "NotConfigured";
  }
  const requested = z
    .enum(["NotConfigured", "IntegrationReady", "Limited", "Public"])
    .catch("IntegrationReady")
    .parse(input.requestedListingState ?? "IntegrationReady");
  if (requested === "NotConfigured") {
    return "IntegrationReady";
  }
  if (requested === "Public" && !input.publicAvailabilityProven) {
    // Honesty: env LISTING_STATE=Public without ops attestation is not a live
    // public Marketplace claim.
    return "IntegrationReady";
  }
  return requested;
}

export function awsMarketplaceConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): AwsMarketplaceConfig {
  const productCode = env.PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE?.trim() || null;
  const publicAvailabilityProven =
    env.PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN?.trim().toLowerCase() ===
    "true";
  const listingState = resolveAwsMarketplaceListingState({
    productCode,
    publicAvailabilityProven,
    requestedListingState: env.PERISCAN_AWS_MARKETPLACE_LISTING_STATE
  });
  return {
    dimensionMappings: DimensionMapSchema.parse(
      parseJsonObject(env.PERISCAN_AWS_MARKETPLACE_DIMENSIONS_JSON)
    ),
    entitlementPackageMappings: AwsMarketplaceEntitlementPackageMapSchema.parse(
      parseJsonObject(env.PERISCAN_AWS_MARKETPLACE_PACKAGE_MAP_JSON)
    ),
    listingState,
    productCode
  };
}

function entitlementValue(entitlement: AwsEntitlement) {
  const value = entitlement.Value;
  if (value?.IntegerValue !== undefined) return value.IntegerValue;
  if (value?.DoubleValue !== undefined) return value.DoubleValue;
  if (value?.BooleanValue !== undefined) return value.BooleanValue;
  if (value?.StringValue !== undefined) return value.StringValue;
  return null;
}

function normalizeEntitlement(entitlement: AwsEntitlement) {
  if (!entitlement.Dimension) return null;
  return {
    dimension: entitlement.Dimension,
    expiresAt: entitlement.ExpirationDate?.toISOString() ?? null,
    licenseArn: entitlement.LicenseArn ?? null,
    value: entitlementValue(entitlement)
  } satisfies AwsMarketplaceEntitlement;
}

export class AwsSdkMarketplaceProvider implements AwsMarketplaceProvider {
  readonly entitlementClient: MarketplaceEntitlementServiceClient;
  readonly meteringClient: MarketplaceMeteringClient;

  constructor(input?: {
    entitlementClient?: MarketplaceEntitlementServiceClient;
    meteringClient?: MarketplaceMeteringClient;
  }) {
    this.entitlementClient =
      input?.entitlementClient ??
      new MarketplaceEntitlementServiceClient({ region: "us-east-1" });
    this.meteringClient =
      input?.meteringClient ?? new MarketplaceMeteringClient({});
  }

  async resolveCustomer(registrationToken: string) {
    const response = await this.meteringClient.send(
      new ResolveCustomerCommand({ RegistrationToken: registrationToken })
    );
    if (
      !response.CustomerAWSAccountId ||
      !response.LicenseArn ||
      !response.ProductCode
    ) {
      throw new Error("ResolveCustomer returned an incomplete identity.");
    }
    return {
      customerAwsAccountId: response.CustomerAWSAccountId,
      customerIdentifier: response.CustomerIdentifier ?? null,
      licenseArn: response.LicenseArn,
      productCode: response.ProductCode
    };
  }

  async getEntitlements(input: {
    customerAwsAccountId: string;
    licenseArn: string;
    productCode: string;
  }) {
    const entitlements: AwsMarketplaceEntitlement[] = [];
    let nextToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      if (seenTokens.size >= 100) {
        throw new Error("GetEntitlements exceeded the 100-page safety limit.");
      }
      const response = await this.entitlementClient.send(
        new GetEntitlementsCommand({
          Filter: {
            CUSTOMER_AWS_ACCOUNT_ID: [input.customerAwsAccountId]
          },
          MaxResults: 25,
          NextToken: nextToken,
          ProductCode: input.productCode
        })
      );
      for (const raw of response.Entitlements ?? []) {
        if (raw.LicenseArn && raw.LicenseArn !== input.licenseArn) continue;
        const normalized = normalizeEntitlement(raw);
        if (normalized) entitlements.push(normalized);
      }
      nextToken = response.NextToken;
      if (nextToken) {
        if (seenTokens.has(nextToken)) {
          throw new Error("GetEntitlements returned a repeated page token.");
        }
        seenTokens.add(nextToken);
      }
    } while (nextToken);
    return entitlements;
  }

  async batchMeterUsage(input: {
    productCode: string;
    records: Array<{
      customerAwsAccountId: string;
      dimension: string;
      licenseArn: string;
      quantity: number;
      usageHour: Date;
    }>;
  }) {
    const usageRecords: UsageRecord[] = input.records.map((record) => ({
      CustomerAWSAccountId: record.customerAwsAccountId,
      Dimension: record.dimension,
      LicenseArn: record.licenseArn,
      Quantity: record.quantity,
      Timestamp: record.usageHour
    }));
    const response = await this.meteringClient.send(
      new BatchMeterUsageCommand({
        ProductCode: input.productCode,
        UsageRecords: usageRecords
      })
    );
    const results = new Map<
      string,
      Awaited<ReturnType<AwsMarketplaceProvider["batchMeterUsage"]>>[number]
    >(
      (response.Results ?? []).map((result) => [
        result.UsageRecord?.Dimension ?? "",
        {
          dimension: result.UsageRecord?.Dimension ?? "",
          meteringRecordId: result.MeteringRecordId ?? null,
          status:
            result.Status === "Success" ||
            result.Status === "CustomerNotSubscribed" ||
            result.Status === "DuplicateRecord"
              ? result.Status
              : ("Failed" as const)
        }
      ])
    );
    for (const record of response.UnprocessedRecords ?? []) {
      if (!record.Dimension) continue;
      results.set(record.Dimension, {
        dimension: record.Dimension,
        meteringRecordId: null,
        status: "Unprocessed"
      });
    }
    return input.records.map(
      (record) =>
        results.get(record.dimension) ?? {
          dimension: record.dimension,
          meteringRecordId: null,
          status: "Failed" as const
        }
    );
  }
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isEntitled(
  entitlements: AwsMarketplaceEntitlement[],
  now = new Date()
) {
  return entitlements.some((entitlement) => {
    if (
      entitlement.expiresAt &&
      new Date(entitlement.expiresAt).getTime() <= now.getTime()
    ) {
      return false;
    }
    return !(
      entitlement.value === null ||
      entitlement.value === false ||
      entitlement.value === 0 ||
      entitlement.value === "0" ||
      entitlement.value === ""
    );
  });
}

function mask(value: string, visible = 4) {
  const suffix = value.slice(-visible);
  return `${"•".repeat(Math.min(8, Math.max(4, value.length - visible)))}${suffix}`;
}

function serializeMeteringRecord(record: {
  dimension: string;
  meteringRecordId: string | null;
  quantity: number;
  status: string;
  usageHour: Date;
}) {
  return {
    dimension: record.dimension,
    meteringRecordId: record.meteringRecordId,
    quantity: record.quantity,
    status: record.status,
    usageHour: record.usageHour.toISOString()
  };
}

async function loadStatus(
  deps: RuntimeServiceDeps,
  context: AuthenticatedContext,
  config: AwsMarketplaceConfig
): Promise<AwsMarketplaceStatus> {
  const [subscription, records] = await Promise.all([
    deps.prisma.awsMarketplaceSubscription.findUnique({
      where: { tenantId: context.tenant.tenantId }
    }),
    deps.prisma.awsMarketplaceMeteringRecord.findMany({
      orderBy: { usageHour: "desc" },
      take: 25,
      where: { tenantId: context.tenant.tenantId }
    })
  ]);
  // listingState is already honesty-clamped in awsMarketplaceConfigFromEnv /
  // resolveAwsMarketplaceListingState: Public only when ops-attested.
  const publicMarketplaceAvailabilityProven = config.listingState === "Public";
  return AwsMarketplaceStatusSchema.parse({
    configured: Boolean(config.productCode && deps.awsMarketplaceProvider),
    dimensionMappings: Object.entries(config.dimensionMappings).map(
      ([meterName, awsDimension]) => ({ awsDimension, meterName })
    ),
    listingState: config.listingState,
    publicMarketplaceAvailabilityProven,
    recentMeteringRecords: records.map(serializeMeteringRecord),
    subscription: subscription
      ? {
          customerAwsAccountIdMasked: mask(subscription.customerAwsAccountId),
          entitlementCheckedAt: subscription.entitlementCheckedAt.toISOString(),
          entitlements: subscription.entitlements,
          lastMeteredAt: subscription.lastMeteredAt?.toISOString() ?? null,
          licenseArnMasked: mask(subscription.licenseArn, 12),
          productCode: subscription.productCode,
          status: subscription.status
        }
      : null
  });
}

function requireConfigured(
  deps: RuntimeServiceDeps,
  config: AwsMarketplaceConfig
) {
  if (!config.productCode || !deps.awsMarketplaceProvider) {
    throw new AppServiceError(
      "AWS Marketplace SaaS integration is not configured.",
      503,
      "aws_marketplace_not_configured"
    );
  }
  return {
    productCode: config.productCode,
    provider: deps.awsMarketplaceProvider
  };
}

function packageForEntitlements(
  config: AwsMarketplaceConfig,
  entitlements: AwsMarketplaceEntitlement[]
) {
  for (const entitlement of entitlements) {
    const packageKey = config.entitlementPackageMappings[entitlement.dimension];
    if (packageKey && isEntitled([entitlement])) {
      return BillingPackageKeySchema.parse(packageKey);
    }
  }
  return null;
}

export function createAwsMarketplaceServices(
  deps: RuntimeServiceDeps
): MarketplaceServices {
  return {
    async resolveAwsMarketplaceRegistration(
      registrationToken
    ): Promise<AwsMarketplaceRegistrationResolution> {
      const config = deps.awsMarketplaceConfig;
      const { productCode, provider } = requireConfigured(deps, config);
      if (registrationToken.length < 10 || registrationToken.length > 4_096) {
        throw new AppServiceError(
          "AWS Marketplace registration token is invalid.",
          400,
          "aws_marketplace_registration_token_invalid"
        );
      }
      let customer: Awaited<ReturnType<typeof provider.resolveCustomer>>;
      let entitlements: AwsMarketplaceEntitlement[];
      try {
        customer = await provider.resolveCustomer(registrationToken);
        if (customer.productCode !== productCode) {
          throw new AppServiceError(
            "The AWS Marketplace token belongs to a different product.",
            400,
            "aws_marketplace_product_mismatch"
          );
        }
        entitlements = await provider.getEntitlements(customer);
      } catch (error) {
        if (error instanceof AppServiceError) throw error;
        throw new AppServiceError(
          "AWS Marketplace could not resolve this registration. Retry from the Marketplace subscription page.",
          502,
          "aws_marketplace_registration_failed"
        );
      }
      const claimToken = randomBytes(32).toString("base64url");
      const claimExpiresAt = new Date(Date.now() + CLAIM_TTL_MS);
      await deps.prisma.awsMarketplaceRegistration.deleteMany({
        where: { claimedAt: null, expiresAt: { lt: new Date() } }
      });
      const registration = await deps.prisma.awsMarketplaceRegistration.create({
        data: {
          claimTokenHash: tokenHash(claimToken),
          customerAwsAccountId: customer.customerAwsAccountId,
          customerIdentifier: customer.customerIdentifier,
          entitled: isEntitled(entitlements),
          entitlements: entitlements as Prisma.InputJsonValue,
          expiresAt: claimExpiresAt,
          licenseArn: customer.licenseArn,
          productCode: customer.productCode
        }
      });
      const redirect = new URL("/billing", deps.webBaseUrl);
      redirect.hash = `awsMarketplaceClaim=${encodeURIComponent(claimToken)}`;
      return AwsMarketplaceRegistrationResolutionSchema.parse({
        claimExpiresAt: claimExpiresAt.toISOString(),
        claimToken,
        redirectUrl: redirect.toString(),
        registrationId: registration.awsMarketplaceRegistrationId
      });
    },

    async getAwsMarketplaceStatus(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view AWS Marketplace status"
      );
      return loadStatus(deps, context, deps.awsMarketplaceConfig);
    },

    async claimAwsMarketplaceRegistration(
      context,
      input: ClaimAwsMarketplaceRegistrationInput
    ) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "claim an AWS Marketplace subscription"
      );
      const config = deps.awsMarketplaceConfig;
      requireConfigured(deps, config);
      const now = new Date();
      const registration =
        await deps.prisma.awsMarketplaceRegistration.findUnique({
          where: { claimTokenHash: tokenHash(input.claimToken) }
        });
      if (
        !registration ||
        registration.claimedAt ||
        registration.expiresAt <= now
      ) {
        throw new AppServiceError(
          "Marketplace claim token is invalid, expired, or already used.",
          409,
          "aws_marketplace_claim_invalid"
        );
      }
      const entitlements = z
        .array(AwsMarketplaceEntitlementSchema)
        .parse(registration.entitlements);
      const entitled = registration.entitled && isEntitled(entitlements, now);
      const packageKey = entitled
        ? packageForEntitlements(config, entitlements)
        : null;
      try {
        await deps.prisma.$transaction(async (tx) => {
          await tx.awsMarketplaceSubscription.upsert({
            create: {
              customerAwsAccountId: registration.customerAwsAccountId,
              customerIdentifier: registration.customerIdentifier,
              entitlementCheckedAt: now,
              entitlements: registration.entitlements as Prisma.InputJsonValue,
              licenseArn: registration.licenseArn,
              productCode: registration.productCode,
              status: entitled ? "Active" : "NotEntitled",
              tenantId: context.tenant.tenantId
            },
            update: {
              customerAwsAccountId: registration.customerAwsAccountId,
              customerIdentifier: registration.customerIdentifier,
              entitlementCheckedAt: now,
              entitlements: registration.entitlements as Prisma.InputJsonValue,
              licenseArn: registration.licenseArn,
              productCode: registration.productCode,
              status: entitled ? "Active" : "NotEntitled"
            },
            where: { tenantId: context.tenant.tenantId }
          });
          await tx.awsMarketplaceRegistration.delete({
            where: {
              awsMarketplaceRegistrationId:
                registration.awsMarketplaceRegistrationId
            }
          });
          await tx.tenant.update({
            data: {
              billingAccountId: `aws-marketplace:${registration.customerAwsAccountId}:${tokenHash(registration.licenseArn).slice(0, 12)}`,
              ...(packageKey ? { billingPackageKey: packageKey } : {})
            },
            where: { tenantId: context.tenant.tenantId }
          });
          await writeAuditEvent(tx, {
            action: "tenant.updated",
            actorType: "User",
            entityId: context.tenant.tenantId,
            entityType: "Tenant",
            metadata: {
              entitlementCount: entitlements.length,
              marketplace: "AWS",
              packageKey,
              productCode: registration.productCode,
              status: entitled ? "Active" : "NotEntitled"
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          throw new AppServiceError(
            "This AWS Marketplace license is already attached to another tenant.",
            409,
            "aws_marketplace_license_already_claimed"
          );
        }
        throw error;
      }
      return loadStatus(deps, context, config);
    },

    async refreshAwsMarketplaceEntitlements(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "refresh AWS Marketplace entitlements"
      );
      const config = deps.awsMarketplaceConfig;
      const { productCode, provider } = requireConfigured(deps, config);
      const subscription =
        await deps.prisma.awsMarketplaceSubscription.findUnique({
          where: { tenantId: context.tenant.tenantId }
        });
      if (!subscription) {
        throw new AppServiceError(
          "No AWS Marketplace subscription is attached.",
          409,
          "aws_marketplace_subscription_missing"
        );
      }
      if (subscription.productCode !== productCode) {
        throw new AppServiceError(
          "The attached Marketplace subscription does not match the configured product.",
          409,
          "aws_marketplace_product_mismatch"
        );
      }
      let entitlements: AwsMarketplaceEntitlement[];
      try {
        entitlements = await provider.getEntitlements(subscription);
      } catch {
        throw new AppServiceError(
          "AWS Marketplace entitlement refresh failed; existing access state was preserved.",
          502,
          "aws_marketplace_entitlement_refresh_failed"
        );
      }
      const now = new Date();
      const entitled = isEntitled(entitlements, now);
      const packageKey = entitled
        ? packageForEntitlements(config, entitlements)
        : null;
      await deps.prisma.$transaction(async (tx) => {
        await tx.awsMarketplaceSubscription.update({
          data: {
            entitlementCheckedAt: now,
            entitlements: entitlements as Prisma.InputJsonValue,
            status: entitled ? "Active" : "NotEntitled"
          },
          where: {
            awsMarketplaceSubscriptionId:
              subscription.awsMarketplaceSubscriptionId
          }
        });
        await tx.tenant.update({
          data: { billingPackageKey: packageKey },
          where: { tenantId: context.tenant.tenantId }
        });
        await writeAuditEvent(tx, {
          action: entitled ? "tenant.updated" : "billing.entitlement_denied",
          actorType: "User",
          entityId: context.tenant.tenantId,
          entityType: "Tenant",
          metadata: {
            entitlementCount: entitlements.length,
            marketplace: "AWS",
            packageKey,
            status: entitled ? "Active" : "NotEntitled"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadStatus(deps, context, config);
    },

    async syncAwsMarketplaceMetering(
      context
    ): Promise<AwsMarketplaceMeteringSyncResult> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "sync AWS Marketplace metering"
      );
      const config = deps.awsMarketplaceConfig;
      const { productCode, provider } = requireConfigured(deps, config);
      const subscription =
        await deps.prisma.awsMarketplaceSubscription.findUnique({
          where: { tenantId: context.tenant.tenantId }
        });
      if (!subscription || subscription.status !== "Active") {
        throw new AppServiceError(
          "An active AWS Marketplace entitlement is required before metering.",
          409,
          "aws_marketplace_subscription_inactive"
        );
      }
      const mappings = Object.entries(config.dimensionMappings) as Array<
        [UsageMeterName, string]
      >;
      if (mappings.length === 0) {
        throw new AppServiceError(
          "No AWS Marketplace usage dimensions are configured.",
          503,
          "aws_marketplace_dimensions_missing"
        );
      }
      const hourEnd = new Date();
      hourEnd.setUTCMinutes(0, 0, 0);
      const usageHour = new Date(hourEnd.getTime() - HOUR_MS);
      const tenant = await deps.prisma.tenant.findUniqueOrThrow({
        where: { tenantId: context.tenant.tenantId }
      });
      const usage = await buildBillingUsage(deps.prisma, tenant, {
        meteringPeriodEnd: hourEnd,
        meteringPeriodStart: usageHour
      });
      const quantityByMeter = new Map(
        usage.meters.map((meter) => [meter.meterName, meter.quantity])
      );
      const existing = await deps.prisma.awsMarketplaceMeteringRecord.findMany({
        where: {
          awsMarketplaceSubscriptionId:
            subscription.awsMarketplaceSubscriptionId,
          usageHour
        }
      });
      const existingByDimension = new Map(
        existing.map((record) => [record.dimension, record])
      );
      const pending = mappings.flatMap(([meterName, dimension]) => {
        const previous = existingByDimension.get(dimension);
        if (
          previous &&
          ["Success", "CustomerNotSubscribed", "DuplicateRecord"].includes(
            previous.status
          )
        ) {
          return [];
        }
        return [
          {
            customerAwsAccountId: subscription.customerAwsAccountId,
            dimension,
            licenseArn: subscription.licenseArn,
            quantity: Math.max(
              0,
              Math.trunc(quantityByMeter.get(meterName) ?? 0)
            ),
            usageHour
          }
        ];
      });
      for (const record of pending) {
        await deps.prisma.awsMarketplaceMeteringRecord.upsert({
          create: {
            awsMarketplaceSubscriptionId:
              subscription.awsMarketplaceSubscriptionId,
            dimension: record.dimension,
            quantity: record.quantity,
            status: "Pending",
            tenantId: context.tenant.tenantId,
            usageHour
          },
          update: { quantity: record.quantity, status: "Pending" },
          where: {
            awsMarketplaceSubscriptionId_dimension_usageHour: {
              awsMarketplaceSubscriptionId:
                subscription.awsMarketplaceSubscriptionId,
              dimension: record.dimension,
              usageHour
            }
          }
        });
      }
      let providerResults: Awaited<
        ReturnType<typeof provider.batchMeterUsage>
      > = [];
      if (pending.length > 0) {
        try {
          providerResults = await provider.batchMeterUsage({
            productCode,
            records: pending
          });
        } catch {
          providerResults = pending.map((record) => ({
            dimension: record.dimension,
            meteringRecordId: null,
            status: "Failed" as const
          }));
        }
      }
      for (const result of providerResults) {
        await deps.prisma.awsMarketplaceMeteringRecord.update({
          data: {
            meteringRecordId: result.meteringRecordId,
            response: { status: result.status },
            status: result.status
          },
          where: {
            awsMarketplaceSubscriptionId_dimension_usageHour: {
              awsMarketplaceSubscriptionId:
                subscription.awsMarketplaceSubscriptionId,
              dimension: result.dimension,
              usageHour
            }
          }
        });
      }
      if (providerResults.some((result) => result.status === "Success")) {
        await deps.prisma.awsMarketplaceSubscription.update({
          data: { lastMeteredAt: new Date() },
          where: {
            awsMarketplaceSubscriptionId:
              subscription.awsMarketplaceSubscriptionId
          }
        });
      }
      const records = await deps.prisma.awsMarketplaceMeteringRecord.findMany({
        orderBy: { dimension: "asc" },
        where: {
          awsMarketplaceSubscriptionId:
            subscription.awsMarketplaceSubscriptionId,
          usageHour
        }
      });
      await writeAuditEvent(deps.prisma, {
        action: "tenant.updated",
        actorType: "User",
        entityId: subscription.awsMarketplaceSubscriptionId,
        entityType: "Tenant",
        metadata: {
          accepted: records.filter((record) => record.status === "Success")
            .length,
          failed: records.filter((record) =>
            ["Failed", "Unprocessed"].includes(record.status)
          ).length,
          marketplace: "AWS",
          usageHour: usageHour.toISOString()
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return AwsMarketplaceMeteringSyncResultSchema.parse({
        accepted: records.filter((record) => record.status === "Success")
          .length,
        failed: records.filter((record) =>
          ["Failed", "Unprocessed"].includes(record.status)
        ).length,
        records: records.map(serializeMeteringRecord),
        skipped: mappings.length - pending.length,
        usageHour: usageHour.toISOString()
      });
    }
  };
}
