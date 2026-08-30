# Enterprise trust residual — SCIM / Type II / pen-test (2026-07-31)

**Epic:** PERISCAN-30 (Enterprise trust & GTM)  
**Slice:** Identity honesty + trust-pack residual (no fake Type II)  
**Real-first:** ship honesty and order-form fill path — not theater Production

## Executive status

| Surface | Product status | What operators may say |
| ------- | -------------- | ---------------------- |
| **Inbound SCIM 2.0** (Periscan memberships) | **NotConfigured** | Not shipped. Discovery under `/api/v1/scim/v2/*` returns **HTTP 501** with actionable body (not silent 404). |
| **JIT create-on-first-SSO** | **NotConfigured** | SSO requires pre-provisioned Active membership. |
| **IdP plane overall** | **Partial** | SSO OIDC/SAML + force-MFA + IdP group→role claim mapping ship. Full joiner/mover/leaver is **not** claimed. |
| **CyberArk / connector SCIM** | Ready (inventory) | Read-only external identity inventory for attack-path context — **not** Periscan user provisioning. |
| **Vendor SOC 2 Type II** | **None** (`NotClaimed`) | No publishable vendor Type II. Customer evidence packs ≠ vendor attestation. |
| **Independent control-plane pen test** | **Not completed in-repo** | Process checklist only (`docs/trust/PEN_TEST_ENGAGEMENT.md`). No fabricated PDF. |
| **Market presence / customer refs** | **Zero public refs** | Wave/MQ market presence Fail until real consent ledger. |

Do **not** close PERISCAN-30 as Done on this slice alone. Residual product/GTM work remains: real inbound SCIM (or contracted SLA forever), vendor Type II program, pen-test engagement, payment settlement, and first design-partner references.

## SCIM honesty (code contract)

| Artifact | Truth |
| -------- | ----- |
| `buildIdentityProvisioningHonesty()` | `planeStatus: "Partial"`; `scimInbound.status` / `jitProvisioning.status`: **`NotConfigured`** |
| `orderFormDoc` | `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` (sales-assisted SLA for order form annex) |
| `residualDoc` | this file |
| `/api/v1/scim/v2/ServiceProviderConfig\|Users\|Groups…` | Always **501** + `statusName: NotConfigured` + `nextSteps` + order-form residual pointers |
| Trust & Safety UI | `IdentityLifecycleTrustPanel` — Partial plane badge; SCIM/JIT rows NotConfigured; order-form CTA |
| Admin console | `IdentityLifecycleHonestyPanel` — same honesty + CTA |
| Claim refuse list | `scim-production-inbound`, `vendor-soc2-type-ii-claimed` in `packages/shared/src/claim-deny-list.ts` |

### Partial vs NotConfigured (do not conflate)

- **Partial** = overall IdP *plane* can partially serve enterprise SSO buyers (pre-provisioned SSO works).
- **NotConfigured** = specific capabilities (inbound SCIM, JIT) are absent. Never relabel as Partial “almost ready” theater or Production.

### Order-form fill path (until SCIM ships)

1. Paste **Sales-assisted provisioning SLA** from `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` into the enterprise order form / DPA annex.  
2. RFP language from the same doc (SSO + force-MFA real; inbound SCIM roadmap / NotConfigured).  
3. Provision seats via Admin invite; quarterly access certification.  
4. Point diligence at Trust & Safety live honesty (`GET /api/v1/tenants/current/trust-safety` → `identityProvisioning`).

## Vendor SOC 2 Type II residual

| Item | Status |
| ---- | ------ |
| `vendorAssurance.soc2TypeIiStatus` | Default **None** |
| `enterpriseCommercial.vendorSoc2Attestation.status` | **NotClaimed** |
| Customer SOC 2 *support* packs in product | Evidence assistants only — **not** vendor Type II |
| Bridge letters / public Type II PDF | **None** — refuse in GTM |

Ops path when a real program exists: set `PERISCAN_VENDOR_SOC2_STATUS` to `InProgress` or `ReportUnderNda` only with real evidence; keep NDA-gated distribution. See `docs/trust/VENDOR_COMPLIANCE.md`.

## Pen-test residual

| Item | Status |
| ---- | ------ |
| Independent control-plane pen test completed | **No** (honest) |
| Engagement checklist | `docs/trust/PEN_TEST_ENGAGEMENT.md` |
| Buyer pack today | Questionnaire kit + isolation proof + threat model — not a pen-test report |

## Tests that pin honesty

- `packages/shared/src/domain.test.ts` — `buildIdentityProvisioningHonesty` Partial + NotConfigured + order-form docs  
- `packages/shared/src/claim-deny-list.test.ts` — refuse SCIM Production / Type II  
- `apps/api/src/app.test.ts` — SCIM 501 body + trust-safety identity plane  
- `apps/web/src/components/trust-safety-dashboard.test.tsx` — UI legend + order-form CTA  
- `tests/modules/prd-build-phases-coverage.test.ts` — Phase 8 does not pass on connector `"SCIM"` alone  
- `tests/acceptance/scim-inbound-honesty-flow.test.ts` — all SCIM paths × verbs 501 + Trust Safety mirror (S4)  
- `tests/acceptance/tenant-sso-login-flow.test.ts` — OIDC/SAML success session + force-MFA SSO exemption (S4)  
- `docs/qa/E2E_SWARM_S4_IDENTITY.md` — operator journey + run commands

## Forbidden (this residual)

- Claiming **SCIM Production** or full IdP lifecycle for Periscan memberships  
- Inventing **vendor SOC 2 Type II** / bridge letters  
- Inventing customer references or pen-test “clean” claims  
- Enabling incomplete SCIM scaffold as a live IdP server  
- Silent 404 on SCIM discovery paths (must stay honest 501)

## Related

- `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md`  
- `docs/trust/README.md`, `VENDOR_COMPLIANCE.md`, `PEN_TEST_ENGAGEMENT.md`, `LEGAL_PACK.md`  
- `docs/ops/PLANE_G1_DISPATCH_NOTES.md` (epic #30 slice notes)  
- `docs/ops/MARKET_PRESENCE_PATH_TO_FIRST_REF.md`  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-31 | PERISCAN-30 identity honesty productization: Partial plane vs NotConfigured SCIM/JIT, 501 actionable stubs, order-form CTA, residual doc, claim refuse entries. |
| 2026-07-31 | Swarm S4: SAML signed success acceptance, force-MFA vs SSO gate acceptance, SCIM ResourceTypes/Schemas + scim+json parser so all verbs stay 501 (not 500), `docs/qa/E2E_SWARM_S4_IDENTITY.md`. |
