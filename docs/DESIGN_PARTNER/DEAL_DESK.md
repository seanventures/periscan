# Private deal desk (pricing bands + conversion ops)

Status: **process durable** — no public rate card; no payment processor  
Related: P08-5 / #179, P08-13 / #187, P08-14 / #188  
Commerce boundary: `paymentProcessorStatus: NotConfigured` always (ledger without a bank)

## Non-negotiable commercial boundary

| Claim | Truth |
| ----- | ----- |
| Self-serve card checkout | **NotConfigured** |
| Public dollar rate card | **Forbidden** until ICP closed and two boring paid invoices |
| Package catalog meters / entitlements | **Real** (fail-closed 402) |
| Trial → paid conversion | **approvalReference** required |
| Continuous subscription start | Agreement / order-form reference required |

Do not build a payment processor until **two** paid invoice conversions are boring.

## Private three-band desk

Still **no public prices**. Floors and ACV bands live only in CRM / this sheet for
founders and wartime sellers.

| Band | Package key(s) | Intent | Primary meters / value | Expansion trigger |
| ---- | -------------- | ------ | ---------------------- | ----------------- |
| **A — Snapshot design partner** | `ValidationSnapshot` | Land + learning | ValidationMissions, ValidationRuns, EvidencePacks | First measured Fixed (or honest still-open) + proof pack delivered |
| **B — Core continuous** | `CoreValidation` (+ optional Control / Evidence) | Expand after one verified fix | ValidatedAssets, Identities, ValidationRuns, schedules | Weekly measured loop without narrator |
| **C — MSSPPartner** | `MSSPPartner` | Scale channel | **ClientTenants + EvidencePacks + ShortTermAssessments** | One dogfood partner, two child tenants, isolation leave-behind |

**Enterprise** = governance / deployment posture band (SSO path, private runners,
retention, advanced API, multi-BU) sold **on top of** A/B — not “unlock everything
because we cannot say no.” ContactSales only.

**LightExternalScan** = teaser freemium only. Never productize as Tenable-lite or
compete on scan volume. Every freemium path ends in Band A Snapshot upgrade CTA.

## CRM / conversion fields (required)

Record on every design-partner and paid conversion:

| Field | Purpose |
| ----- | ------- |
| `band` | A / B / C / Enterprise governance |
| `floorAcv` | Internal floor (never publish) |
| `packageKey` | Catalog key activated |
| `metersExpected` | Anticipated meter burn |
| `approvalReference` | Invoice / order-form / exception ref |
| `supportOwner` | Named human for the term |
| `nextExpansionTrigger` | What unlocks next band |
| `referenceConsent` | None / call / logo / quote (real only) |

Product already requires `approvalReference` on trial convert and agreement refs on
subscription start (`docs/SUBSCRIPTION_OPERATIONS_RUNBOOK.md`). This sheet is the
**sales system of record** around those refs.

## Package activation checklist

1. Confirm ICP fit (`ICP_WEDGE.md`) — refuse non-ICP  
2. Band selection + floor approved (founder or wartime seller)  
3. Package key matches demoed surface (Snapshot first)  
4. Approval / order-form reference recorded  
5. Support owner assigned  
6. Entitlement activated in Billing → Renewal continuity  
7. Next expansion trigger written in CRM  

## MSSPPartner unit economics (private partner sheet)

Partners buy margin models. Until a channel program exists, share only under NDA:

| Unit | What partners model |
| ---- | ------------------- |
| Per **ClientTenant** floor | Minimum monthly / term contribution per child |
| **EvidencePacks** included | Packs per client per term before overage conversation |
| **ShortTermAssessments** pack | Co-managed ASV-style assessment resale unit |
| White-label | Included on MSSPPartner (does not alter evidence IDs) |
| PSA ticket path | Included workflow; not a free custom BAS build |

Commerce remains **invoice**. Product shows meter burn in the client portfolio for
partner QBR truth — not public pricing.

## Explicit non-goals

- No public Marketplace GTM until two direct paid conversions + one reference  
- No Stripe / card processor “so we can scale”  
- No freemium ASV volume competition  
- No fake customer logos or ARR on the desk  

## Links

- Wartime motion: [`WARTIME_SALES_MOTION.md`](./WARTIME_SALES_MOTION.md)  
- ICP: [`ICP_WEDGE.md`](./ICP_WEDGE.md)  
- Subscription ops: [`../SUBSCRIPTION_OPERATIONS_RUNBOOK.md`](../SUBSCRIPTION_OPERATIONS_RUNBOOK.md)  
- Hard vs fake hard: [`HARD_VS_FAKE_HARD.md`](./HARD_VS_FAKE_HARD.md)  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial private deal desk: three bands, CRM fields, MSSP unit sheet, freemium trap guard. |
