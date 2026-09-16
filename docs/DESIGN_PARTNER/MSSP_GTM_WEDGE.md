# MSSP multi-tenancy as Execute wedge (GTM)

**Status:** process durable — architecture shipped; live channel packaging not claimed  
**Tickets:** P12-18 / #256, P13-16 / #274  
**Real-first:** no fake MSSP logos, portfolio case studies, or “dozens of partners”

## Why this exists

Architecture is **Wave-positive** for multi-tenant MSSP (parent → child tenants,
isolation proof, portfolio rollups, white-label evidence packs, short-term
assessment meters). GTM previously underplayed that **Execute** wedge and
over-indexed on feature breadth.

Commercial packaging (invoice band, partner unit economics, dogfood portfolio
reference) remains **open** until a real partner runs two child tenants.

## Forced GTM narrative (wartime)

**Lead line for MSSP / vCISO buyers:**

> Periscan gives your operators one measured proof loop per client tenant —
> scope → validate → remediate → re-verify → evidence pack — with isolation
> leave-behinds your customers can trust.

**Do not lead with:** connector counts, autonomous theater, full BAS libraries,
or public Marketplace self-serve.

## Architecture already sold (honest)

| Capability | Product truth | GTM phrase |
| ---------- | ------------- | ---------- |
| Tenant hierarchy | `TenantType` Client / MSSP + `parentTenantId` | Multi-client portfolio |
| Context switch | `x-periscan-tenant-id` membership-checked | Operator works one client at a time |
| Isolation proof | Tenant isolation report API | Leave-behind for client security review |
| White-label packs | Report branding on child evidence packs | Your brand; Periscan evidence IDs intact |
| Portfolio | API-derived client readiness / meters | QBR truth, not theater |
| Entitlement | `MSSPPartner` package + meters | Invoice band C on deal desk |

Detail: `DEAL_DESK.md` band **C — MSSPPartner**, product MSSP surfaces under
`/mssp`, billing ledger without payment processor.

## Commercial packaging honesty (still open)

| Claim | Current truth |
| ----- | ------------- |
| Public partner price list | **Forbidden** |
| Self-serve MSSP signup + card checkout | **NotConfigured** |
| Dogfood partner with two production child tenants | **Zero evidenced** |
| Isolation leave-behind delivered to a real client CISO | **Zero evidenced** |
| PSA-native ticket product | Workflow destinations exist; not a free custom BAS build |

Until one dogfood partner completes the expansion trigger in `DEAL_DESK.md`,
treat MSSP as **scale wedge after Snapshot land**, not company existence proof.

## SE / demo rules for MSSP

1. Demo **one client tenant** end-to-end on the Snapshot proof loop first.  
2. Show portfolio only after one measured path + evidence pack on a child.  
3. Show isolation proof export as the trust artifact — not a SOC 2 claim.  
4. Refuse “white-label automated pentest for all our clients” RFPs.  
5. Never invent partner logos on slides.

Demo spine still follows `docs/competitive/DEMO_AND_SE_RULES.md`.

## GTM sequence

1. Land direct Snapshot design partners (band A).  
2. Recruit **one** MSSP design partner; provision two child tenants.  
3. Deliver isolation leave-behind + one client evidence pack.  
4. Record unit economics privately (per-ClientTenant floor, packs, assessments).  
5. Only then elevate MSSP as primary channel motion / Wave Execute story.

## Related

- [`DEAL_DESK.md`](./DEAL_DESK.md)  
- [`ICP_WEDGE.md`](./ICP_WEDGE.md) — MSSP is scale, not day-one existence ICP alone  
- [`WARTIME_SALES_MOTION.md`](./WARTIME_SALES_MOTION.md)  
- [`../competitive/POSITIONING.md`](../competitive/POSITIONING.md)  
- [`../MOAT_TRUTH_ARCHITECTURE.md`](../MOAT_TRUTH_ARCHITECTURE.md)  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Initial MSSP Execute wedge GTM note. Architecture yes; live packaging no. |
