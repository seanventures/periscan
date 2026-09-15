# AWS Marketplace SaaS integration runbook

Periscan implements the application side of AWS Marketplace SaaS buyer
registration, entitlement checks, and usage metering. This integration does not
make the product publicly available. Seller registration, pricing, tax, legal,
banking, product creation, limited-listing review, and public publication remain
AWS/commercial operations.

## GTM decision (P08-17) — park public listing

**Marketplace is a channel, not the wartime GTM strategy.** Keep the application
integration code and this runbook. Do **not** staff Marketplace seller ops,
public listing, or tax/banking work as primary GTM until:

1. At least **two direct paid conversions** (invoice / approval, not freemium), and  
2. At least **one referenceable design partner** with written consent.

Until then: listing state stays `NotConfigured` / integration-ready only; sales
motion is direct ICP wedge + proof loop (see
[`DESIGN_PARTNER/WARTIME_SALES_MOTION.md`](./DESIGN_PARTNER/WARTIME_SALES_MOTION.md)).

**Ops path (payments + what real listing requires):**
[`ops/MARKETPLACE_PAYMENTS_PATH.md`](./ops/MARKETPLACE_PAYMENTS_PATH.md)
(PERISCAN-469). Public listing needs
`PERISCAN_AWS_MARKETPLACE_LISTING_STATE=Public` **and**
`PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN=true`; product code alone
never proves public availability.

## Published contracts

- Buyer registration uses `ResolveCustomer` and stores the returned
  `CustomerAWSAccountId`, `LicenseArn`, product code, and legacy customer
  identifier. New integrations use the AWS account ID and License ARN so one
  account can hold concurrent agreements.
- Contract entitlements use paginated `GetEntitlements` requests in
  `us-east-1`. Empty, expired, false, and zero-value results fail closed.
- Hourly usage uses `BatchMeterUsage`. Periscan submits the previous completed
  UTC hour, at most once for each subscription, dimension, and hour. AWS
  `Success`, `CustomerNotSubscribed`, `DuplicateRecord`, unprocessed, and failed
  results are persisted separately.

References: [AWS SaaS integration](https://docs.aws.amazon.com/marketplace/latest/userguide/saas-integration-metering-and-entitlement-apis.html),
[contract integration scenarios](https://docs.aws.amazon.com/marketplace/latest/userguide/saas-integrate-contract-with-pay.html),
and [API permissions](https://docs.aws.amazon.com/marketplace/latest/userguide/iam-user-policy-for-aws-marketplace-actions.html).

## Configuration

Set these only after AWS issues the real values:

```dotenv
PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE=product-code-from-aws
PERISCAN_AWS_MARKETPLACE_LISTING_STATE=Limited
# Public only after independent reachability proof — both required:
# PERISCAN_AWS_MARKETPLACE_LISTING_STATE=Public
# PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN=true
PERISCAN_AWS_MARKETPLACE_DIMENSIONS_JSON={"ValidationRuns":"validation_runs","ValidatedAssets":"validated_assets"}
PERISCAN_AWS_MARKETPLACE_PACKAGE_MAP_JSON={"enterprise":"Enterprise"}
```

The workload identity needs only the Marketplace operations used by the chosen
pricing model: `aws-marketplace:ResolveCustomer`,
`aws-marketplace:GetEntitlements`, and, for metered usage,
`aws-marketplace:BatchMeterUsage`. Do not add seller-portal or unrelated AWS
permissions to the application role.

Configure the listing registration URL as:

```text
https://API_HOST/api/v1/billing/aws-marketplace/register
```

AWS posts `x-amzn-marketplace-token`. Periscan resolves it immediately, stores
only a SHA-256 hash of the one-time tenant claim token, and redirects to the
billing page. The claim expires after one hour and cannot be reused.

## Limited-listing qualification

Before changing listing state from `IntegrationReady` to `Limited`:

1. Subscribe with an AWS test buyer and confirm the redirect reaches Billing.
2. Attach the purchase and verify the masked account/license, product code, and
   expected entitlement dimensions.
3. Remove the entitlement and confirm refresh changes the subscription to
   `NotEntitled` and removes Marketplace-derived package access.
4. Create known activity in a completed UTC hour, synchronize it, and reconcile
   the persisted quantities and AWS/CloudTrail response IDs.
5. Repeat synchronization and confirm no second AWS call is made for terminal
   dimension/hour records.
6. Exercise transient/unprocessed results and verify a later retry does not
   alter an already successful dimension/hour record.

Change listing state to `Public` only after the public offer is independently
reachable and transactable. The application never derives public availability
from product code configuration.

## Recovery

- Registration failure: restart from the AWS subscription page; never ask the
  buyer to email the temporary registration token.
- Entitlement outage: preserve the last state and report refresh failure. Do
  not silently grant a new Marketplace entitlement.
- Empty/cancelled entitlement: fail closed and remove Marketplace-derived plan
  access.
- Unprocessed metering record: retain it for retry. Do not change a terminal
  success or resubmit a different quantity for the same dimension/hour.
- Product-code mismatch or license already claimed: reject and investigate;
  never reassign across tenants without an audited commercial correction.
