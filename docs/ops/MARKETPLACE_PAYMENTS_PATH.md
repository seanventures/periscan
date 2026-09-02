# Marketplace + payments path (PERISCAN-469)

**Honesty default:** payments and public Marketplace listing are **NotConfigured**
until commercial ops completes external work. Application code may be
integration-ready without inventing a live listing, checkout bank, or public
offer URL.

**Related:**

- Application SaaS integration:
  [`docs/AWS_MARKETPLACE_RUNBOOK.md`](../AWS_MARKETPLACE_RUNBOOK.md)
- Billing schema: `paymentProcessorStatus: z.literal("NotConfigured")` in
  `@periscan/shared` subscriptions / domain packages
- UI: `apps/web/src/components/billing-workbench.tsx` (sales-led banner +
  Marketplace panel)
- GTM park: AWS Marketplace runbook § “GTM decision (P08-17)”

---

## 1. What ships today (honest)

| Surface | State | Meaning |
| --- | --- | --- |
| Payment processor | **NotConfigured** (schema-hardcoded) | Usage + entitlement ledger only. No card capture, tax, automated invoice settlement, or self-serve checkout. |
| Direct agreement lifecycle | Sales-led | Order form / invoice / approval-reference design partners. |
| AWS Marketplace SaaS code | Optional IntegrationReady | ResolveCustomer, GetEntitlements, BatchMeterUsage when product code + provider are configured. |
| Marketplace listing | **NotConfigured** by default | No product code → not configured. Product code alone → IntegrationReady (or Limited after ops). |
| Public Marketplace claim | **Only with dual ops attestation** | `PERISCAN_AWS_MARKETPLACE_LISTING_STATE=Public` **and** `PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN=true`. Without the second flag, Public is clamped to IntegrationReady. |
| Public offer URL in product | **Never invent** | UI and APIs do not fabricate marketplace.amazon.com listing URLs. |

---

## 2. What a real payments path requires (not product code)

Do **not** flip `paymentProcessorStatus` off NotConfigured until all of these are
real:

1. **Payment service provider** contract (Stripe/Adyen/etc.) with production keys
   in secrets — not committed fixtures.
2. **Tax / invoicing / settlement** ops (or explicit partner of record).
3. **Legal** terms of service, refund, DPA alignment for self-serve if offered.
4. **Schema + API change** that admits a non-`NotConfigured` processor status
   with tests; today the shared schema **literally** only allows NotConfigured.
5. **UI** checkout that is not sales-led banner theater — only after 1–4.

Until then: keep sales-led Contact sales / Manage with sales paths.

---

## 3. What a real AWS Marketplace **public listing** requires

Application integration (register / claim / entitlement / metering) is
**necessary but not sufficient**. Public listing is an external commercial fact.

### 3.1 Seller / commercial ops (outside product)

1. AWS Marketplace seller registration (tax, banking, legal entity).
2. SaaS product creation in Seller Portal with dimensions matching
   `PERISCAN_AWS_MARKETPLACE_DIMENSIONS_JSON` / package map.
3. Pricing, free trial, and contract terms approved by AWS review.
4. Limited listing qualification using the checklist in
   [`AWS_MARKETPLACE_RUNBOOK.md`](../AWS_MARKETPLACE_RUNBOOK.md) § Limited-listing.
5. Public offer published and **independently reachable / transactable** by a
   buyer not on the allowlist.
6. GTM gate (wartime): prefer **two direct paid conversions + one referenceable
   design partner** before staffing public listing as primary channel.

### 3.2 Application config (after 3.1)

```dotenv
PERISCAN_AWS_MARKETPLACE_PRODUCT_CODE=product-code-from-aws
PERISCAN_AWS_MARKETPLACE_LISTING_STATE=Public
# Required for Public; without this, LISTING_STATE=Public clamps to IntegrationReady
PERISCAN_AWS_MARKETPLACE_PUBLIC_AVAILABILITY_PROVEN=true
PERISCAN_AWS_MARKETPLACE_DIMENSIONS_JSON={"ValidationRuns":"validation_runs","ValidatedAssets":"validated_assets"}
PERISCAN_AWS_MARKETPLACE_PACKAGE_MAP_JSON={"enterprise":"Enterprise"}
```

Registration URL (after listing exists):

```text
https://API_HOST/api/v1/billing/aws-marketplace/register
```

### 3.3 Honesty rules for agents and SE

| Claim | Allowed? |
| --- | --- |
| “We have SaaS integration code for AWS Marketplace” | Yes, if product code path exists |
| “We are IntegrationReady / Limited for test buyers” | Only when listingState says so after real config |
| “We are live / public on AWS Marketplace” | Only when `listingState === Public` **and** `publicMarketplaceAvailabilityProven` |
| Fake public listing URL, logo wall of Marketplace badge | **Refuse** |
| “Self-serve card checkout is live” | **Refuse** while processor is NotConfigured |

Claim refuse catalog ids: `self-serve-card-checkout`, `live-public-marketplace-without-ops`
in `packages/shared/src/claim-deny-list.ts`.

---

## 4. Default local / CI expectation

Without Marketplace env vars:

- `GET /api/v1/billing/aws-marketplace` → `listingState: NotConfigured`,
  `configured: false`, `publicMarketplaceAvailabilityProven: false`
- Packages / active package / subscription → `paymentProcessorStatus: NotConfigured`
- Billing UI shows sales-led banner; Marketplace panel says seller integration
  not configured; no public listing URL

That is the correct shipping honesty state for PERISCAN-469 residual work.

---

## 5. Exit criteria for closing PERISCAN-469 as “live”

Do **not** mark payments/Marketplace residual Done as live commerce until:

- [ ] Payment processor production path + non-NotConfigured schema (if product
      chooses self-serve), **or** explicit permanent sales-led decision recorded
- [ ] Seller ops complete for intended listing tier
- [ ] Limited qualification checklist green (if Limited/Public)
- [ ] Public: independent reachability proof + both env attestations
- [ ] No product UI invents listing URLs or checkout CTAs

Until then: residual may be **Backlog** / **dormant honesty complete** —
application gates and docs only.
