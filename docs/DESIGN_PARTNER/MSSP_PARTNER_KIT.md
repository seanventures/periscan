# MSSP partner kit (P13-9 / P13-16)

**Status:** Packaging and playbook — commercial presence still needs live design-partner references.  
**Honesty:** Multi-tenant architecture and PSA connectors exist; payment processor remains `NotConfigured`. Invoice first; card self-serve later.

## 1. Who this is for

Managed security providers and 2–3 SI design partners who will:

1. Run a multi-client portfolio under an MSSP parent tenant  
2. Deliver a quarterly business review (QBR) from real evidence packs  
3. Accept invoice / PO settlement (not card capture)

## 2. Product surfaces to demo (and only these)

| Surface | Route / API | Wave story |
|---------|-------------|------------|
| Portfolio | `/mssp`, client portfolio API | Multi-tenant readiness + attention counts |
| Needs you | Dashboard work queue | Operator Monday queue across clients |
| Proof loop | Findings → Remediation retest → Evidence | Fix-verify honesty |
| Schedules | `/schedules` + work-queue schedule kinds | Continuous validation health |
| Reports | Auditor / Executive packs | QBR export path |
| Trust honesty | Integrations Planned≠connectable | No connector theater |

Do **not** lead with Swarm, MCP, Model Gateway labs, or full feature zoo.

## 3. Commercial packaging (before processor)

1. **Order form / SOW** — seats or client-tenant count, validation run entitlement, runner count.  
2. **Invoice** — monthly/annual; map to existing billing meters (`getBillingUsage`, package catalog).  
3. **Entitlement** — grant package in control plane; do not claim automated tax/settlement.  
4. **Marketplace** — limited listing only after metering proven and ≥1 reference (see `docs/AWS_MARKETPLACE_RUNBOOK.md` GTM freeze).

## 4. Delivery playbook (90-day design partner)

| Week | Outcome |
|------|---------|
| 0–2 | Parent tenant + 1–2 client tenants; SSO optional; verified scope |
| 2–4 | First Measured finding + one Fixed via retest |
| 4–8 | Schedule active continuous pack; schedule health in Needs you |
| 8–12 | QBR report path: executive pack from real snapshot; written reference consent |

Success metrics (presence, not vanity):

- ≥1 paying **or** design-partner MSSP portfolio reference with consent  
- QBR report path proven end-to-end on real data  
- Invoice packaging documented for finance (this kit + order form)

## 5. Partner enablement assets

- Positioning: `docs/competitive/POSITIONING.md` (AEV / CTEM proof layer)  
- SE rules: `docs/competitive/DEMO_AND_SE_RULES.md`  
- Wartime sales: `docs/DESIGN_PARTNER/WARTIME_SALES_MOTION.md`  
- Trust pack: `docs/trust/README.md`  
- Claim deny list: `packages/shared/src/claim-deny-list.ts`

## 6. What we refuse to claim

- “Live MSSP channel with N partners” until references exist  
- Self-serve card processing as GTM path before references  
- Full PSA automation for every logo without certified connectors  

Parent findings: P13-9, P13-16.
