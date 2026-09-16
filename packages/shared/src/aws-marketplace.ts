import { z } from "zod";

import { BillingPackageKeySchema } from "./domain";

const TimestampSchema = z.iso.datetime();

export const AwsMarketplaceListingStateSchema = z.enum([
  "NotConfigured",
  "IntegrationReady",
  "Limited",
  "Public"
]);

export const AwsMarketplaceEntitlementSchema = z.object({
  dimension: z.string().min(1).max(255),
  expiresAt: TimestampSchema.nullable(),
  licenseArn: z.string().min(1).max(2_000).nullable(),
  value: z.union([z.number(), z.boolean(), z.string()]).nullable()
});

export const ClaimAwsMarketplaceRegistrationInputSchema = z
  .object({
    claimToken: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/u)
  })
  .strict();

export const AwsMarketplaceSubscriptionSchema = z.object({
  customerAwsAccountIdMasked: z.string().min(1),
  entitlementCheckedAt: TimestampSchema,
  entitlements: z.array(AwsMarketplaceEntitlementSchema),
  lastMeteredAt: TimestampSchema.nullable(),
  licenseArnMasked: z.string().min(1),
  productCode: z.string().min(1),
  status: z.enum(["Active", "NotEntitled"])
});

export const AwsMarketplaceMeteringRecordSchema = z.object({
  dimension: z.string().min(1),
  meteringRecordId: z.string().min(1).nullable(),
  quantity: z.number().int().nonnegative(),
  status: z.enum([
    "Pending",
    "Success",
    "CustomerNotSubscribed",
    "DuplicateRecord",
    "Unprocessed",
    "Failed"
  ]),
  usageHour: TimestampSchema
});

export const AwsMarketplaceStatusSchema = z.object({
  configured: z.boolean(),
  dimensionMappings: z.array(
    z.object({
      awsDimension: z.string().min(1),
      meterName: z.string().min(1)
    })
  ),
  listingState: AwsMarketplaceListingStateSchema,
  publicMarketplaceAvailabilityProven: z.boolean(),
  recentMeteringRecords: z.array(AwsMarketplaceMeteringRecordSchema),
  subscription: AwsMarketplaceSubscriptionSchema.nullable()
});

export const AwsMarketplaceMeteringSyncResultSchema = z.object({
  accepted: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  records: z.array(AwsMarketplaceMeteringRecordSchema),
  skipped: z.number().int().nonnegative(),
  usageHour: TimestampSchema
});

export const AwsMarketplaceRegistrationResolutionSchema = z.object({
  claimExpiresAt: TimestampSchema,
  claimToken: z.string().min(32),
  redirectUrl: z.url(),
  registrationId: z.uuid()
});

export const AwsMarketplaceEntitlementPackageMapSchema = z.record(
  z.string().min(1),
  BillingPackageKeySchema
);

export type AwsMarketplaceEntitlement = z.infer<
  typeof AwsMarketplaceEntitlementSchema
>;
export type AwsMarketplaceStatus = z.infer<typeof AwsMarketplaceStatusSchema>;
export type AwsMarketplaceMeteringSyncResult = z.infer<
  typeof AwsMarketplaceMeteringSyncResultSchema
>;
export type AwsMarketplaceRegistrationResolution = z.infer<
  typeof AwsMarketplaceRegistrationResolutionSchema
>;
export type ClaimAwsMarketplaceRegistrationInput = z.infer<
  typeof ClaimAwsMarketplaceRegistrationInputSchema
>;
