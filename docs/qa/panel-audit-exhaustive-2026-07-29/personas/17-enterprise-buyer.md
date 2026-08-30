# Panel P17 — Enterprise Procurement / InfoSec Buyer

| Field | Value |
| --- | --- |
| **Persona** | Enterprise Procurement + InfoSec Buyer (5k–25k employee GRC/procurement co-buyer; security questionnaire + commercial redlines) |
| **Date** | 2026-07-29 |
| **Repo root** | `/Volumes/DataSSD1/test/periscan` |
| **Mode** | Docs-only exhaustive audit; code/docs grounded; no product changes |
| **Contract** | `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md` |
| **Prior synthesis** | `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` (prior score ~3.1/5 RFP; U-19 enterprise gate) |
| **Primary evidence** | `apps/api/src/services/sso.ts`, `auth.ts`, `tenant.ts`, `subscriptions.ts`, `enterprise-readiness.ts`, `runtime-services.ts` (billing catalog, trust safety, audit export), `packages/shared/src/domain.ts` (roles, webhooks), `packages/reports/src/compliance-catalog.ts` + `index.ts`, `apps/web/src/lib/primary-nav.tsx`, `docs/PRODUCTION_READINESS.md`, `docs/SUBSCRIPTION_OPERATIONS_RUNBOOK.md`, `docs/AWS_MARKETPLACE_RUNBOOK.md`, `docs/PERISCAN_FULL_PRODUCT_PRD.md` Phase 8, `tests/modules/prd-build-phases-coverage.test.ts`, `docs/qa/HANDOFF.md`, `docs/qa/UI_RELEASE_ICP_ROADMAP.md` |

---

## 1. Verdict (enterprise buy-readiness)

**Verdict: 2.8 / 5.0** as a platform-of-record enterprise SaaS buy  
**Prior panel:** ~3.1/5 RFP — slightly lowered after re-inspecting SCIM string-match “coverage,” webhook thinness, SOC 2 pack depth, and commercial gates.

### 5.0 definition (this lens)

A 5.0 enterprise buy means:

1. **Identity lifecycle complete** — SSO + SCIM (or contractual JIT with SLA) + group→role claims + force-MFA / SSO-enforced policy.
2. **Trust pack complete** — published DPA, subprocessors, BAA path (if PHI), pen-test summary process, SOC 2 Type II (or bridge letter), public status page + contractual SLA/RTO/RPO.
3. **Commercial complete** — order form / invoice / Marketplace or payment path that Legal/Procurement can execute without inventing process.
4. **Data control complete** — tenant residency that routes storage, encryption statement, optional BYOK/CMK for regulated buyers.
5. **Audit & SIEM complete** — continuous audit export/stream to customer SIEM; not only pull-capped CSV.
6. **RBAC claims honest** — roles map to least-privilege operator personas buyers put on the RFP matrix.
7. **RFP surface coherent** — product catalog does not force InfoSec to buy “swarm + MCP + confidential GPU” to get proof-loop CTEM.

**Buy posture today:** **Paid design partner / controlled pilot only.**  
Not ready for enterprise MSA + security review as platform-of-record. Strong technical honesty and safety floor (agree with CISO/Security eng panels) do **not** substitute for procurement gates.

---

## 2. Top 5 moves to reach 5.0

1. **Ship or formally decline SCIM/JIT** with a sales-assisted provisioning SLA (24h / 5 seats) and group→role mapping on SSO claims — stop letting Phase 8 tests pass on the token `"SCIM"` alone.
2. **Publish Trust Center pack** — DPA template, subprocessors list (not empty env), BAA process, encryption-at-rest attestation, pen-test summary request path; link from `/trust-safety`.
3. **Public status page + support SLA language** (even if status is Statuspage/Better Stack and SLA is contractual, not in-product).
4. **Commercial close path** — invoice/order-form workflow + AWS Marketplace Limited→Public gate; keep honesty that cards are not charged, but Procurement must not hit a dead ledger.
5. **Audit SIEM stream** — signed webhook/`audit.event` (or Splunk HEC/S3 batch) for authz, policy.denied, role changes, export, SSO failures; raise or paginate export caps with completeness honesty.

---

## 3. Feature-zoo / IA notes (RFP confusion)

| Action | Items |
| --- | --- |
| **Cut / Labs** for RFP demos | `/swarm`, `/mcp`, Agent Swarm, Autonomous rail, confidential-compute theater until proof loop is the only story |
| **Merge** | Threat Center + Threat Feed + Signal Activity; Validation Ops + Schedules + Runners into one “Operate validation” surface |
| **Rename for buyers** | “SOC 2 Support Pack” → “Customer control evidence for *your* SOC 2 (not Periscan’s Type II)”; “Trust & Safety” → “Trust Center (data, subprocessors, runner model)” |
| **Demote from primary rail** | AI Apps, Machine Identities, ATT&CK catalog, Tool Governance until after Paths/Findings/Remediation |
| **RFP package SKUs** | Sell **Validation Snapshot / Core Validation** only; hide Enterprise/MSSP/Autonomous packages from first security questionnaire unless scoped |

**RFP confusion risk (high):** An InfoSec questionnaire filled by browsing primary nav will score “AI agent platform / BAS / NHI / MCP” and miss that the real product is **measured path + fix proof**. Agree with previous Jobs/Horowitz/Palantir zoo themes (U-03, U-16).

---

## 4. What is already excellent (do not break)

1. **SSO OIDC/SAML is real** — encrypted secrets, SP metadata, domain allowlist, enforced SSO blocks password login (`auth.ts` + `sso.ts`); not a mock checkbox.
2. **Honest commercial boundary** — `paymentProcessorStatus: "NotConfigured"` and explicit “does not charge cards / tax / invoices” language (`subscriptions.ts`, `SUBSCRIPTION_OPERATIONS_RUNBOOK.md`). Prefer this over fake Stripe.
3. **Trust & Safety API** — residency selection, encryption status, BAA env link, runner outbound model, retention disclosure (`buildTrustSafetySummary`).
4. **Safety floor** — verified scope, denied-never-queued, Fixed-only-on-retest, signed runners — strongest enterprise trust story in the product core.
5. **Audit export exists** — JSON/CSV with truncation honesty (`createAuditExport`, `AUDIT_EXPORT_MAX_EVENTS = 5000`).
6. **MFA optional enrollment** with QR + recovery codes and session version rotation (user-level security hygiene is real).
7. **Tenant data region routing** implemented (not purely decorative after HANDOFF Wave 3) when multi-region storage is configured.
8. **Marketplace app-side integration** ready without lying about Public listing (`AWS_MARKETPLACE_RUNBOOK.md`, enterprise-readiness marketplace ExternalDependency).

---

## 5. Findings (machine-parseable)

### FINDING | P17-1 | P0 | feature | auth | No inbound SCIM for Periscan user lifecycle
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `apps/api/src/services/sso.ts` L178–181, L739–756: SSO “login for pre-provisioned users”; `sso_user_not_provisioned` if no Active membership. Grep of `apps/` finds no `/scim/v2` service for Periscan users — only CyberArk *connector* SCIM as **read-only identity inventory** (`packages/connectors`, acceptance criteria for CyberArk). HANDOFF: “SCIM/JIT provisioning remains a follow-on.” Phase 8 test only asserts token `"SCIM"` appears somewhere in combined sources (`tests/modules/prd-build-phases-coverage.test.ts` L414–434).
- **Problem:** Enterprise buyers require automated joiner/mover/leaver for SaaS apps (Okta/Entra SCIM). Manual invite (`inviteToCurrentTenant`) does not meet IdP governance or offboarding SLA.
- **Impact:** Security questionnaire hard fail on “SCIM 2.0 provisioning”; Legal will not accept “admin emails invites” for 500+ seats; Phase 8/PRD claims become procurement misrepresentation risk.
- **Recommendation:** Implement SCIM 2.0 Users/Groups against tenant memberships **or** publish a contractual “sales-assisted provisioning SLA” and remove SCIM from Phase 8 “Implemented” / acceptance language until true. Distinguish product SCIM from CyberArk inventory SCIM in all RFP responses.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P17-2 | P0 | feature | auth | SSO has no group → role claim mapping
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `sso.ts` complete login path maps **email only** (OIDC `email` / SAML nameid); no `groups`, `roles`, or attribute mapping fields on `TenantSsoConfig` update path inspected. Membership role remains whatever was invite-time provisioned. `MembershipRoleSchema` is fixed enum only (`packages/shared/src/domain.ts` L13–20).
- **Problem:** Enterprises assign app roles from IdP groups (e.g. `periscan-admins` → Admin). Without mapping, access drift and manual role edits become audit findings.
- **Impact:** Fails common SIG/CAIQ “SSO attribute/group mapping” rows; forces standing privileged accounts; increases insider-risk review friction.
- **Recommendation:** Add configurable claim/group → `MembershipRole` map (with deny-by-default, last-owner protection, audit on role change from SSO). Document claim conventions in Trust Center.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P17-3 | P1 | feature | security | No tenant force-MFA policy (optional user MFA only)
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** MFA is enforced only when `user.mfaEnabledAt` is set (`apps/api/src/services/auth.ts` L319–334, L555–569). No tenant policy flag for `requireMfa` / force enrollment. `mfaEnforced` exists only inside SSPM *module* config for *customer SaaS posture* (`packages/modules/src/index.ts`), not for Periscan control-plane login. SSO enforce exists (`ssoConfig.enforced`) but password tenants can run without MFA indefinitely.
- **Problem:** Buyer policy often requires MFA for all console users, including break-glass admins not on SSO yet.
- **Impact:** Questionnaire fail on “enforce MFA for all users”; residual credential-stuffing risk on password path.
- **Recommendation:** Tenant Admin setting `mfaRequired: true` with grace period + login block + admin report of non-enrolled users; combine with SSO-enforced as preferred path.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P17-4 | P0 | improvement | compliance | “SOC 2 pack” is thin customer evidence, not vendor attestation
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** Customer-facing `SOC2Attestation` catalog has **three** CC controls only (CC7.1, CC7.2, CC7.4) in `packages/reports/src/compliance-catalog.ts` L343–362. Report template `SOC2Support` is “audit support” language (`packages/reports/src/index.ts` L321–336). No public vendor SOC 2 Type II, bridge letter, or pen-test summary process in product/docs for *Periscan as a processor*.
- **Problem:** Buyers conflate “SOC 2 evidence pack about *their* controls” with “vendor has SOC 2 Type II.” Product honesty in reports helps; GTM/RFP surface still confuses procurement.
- **Impact:** Security review stalls until vendor provides real SOC 2/ISO/pen-test package; risk of overclaim if sales uses product pack as vendor attestation.
- **Recommendation:** Rename UI to “Customer SOC 2 *support evidence*”; publish separate Trust Center “Periscan vendor compliance” with status (None / In progress / Report under NDA). Expand control matrix only when measured mappings exist (agree U-24).
- **Effort:** M (rename/disclosure S; full vendor SOC 2 program XL)
- **Zoo-related:** no
- **Previous-panel-link:** U-24

### FINDING | P17-5 | P0 | feature | security | DPA / BAA / subprocessors not default-ready for legal redlines
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `buildTrustSafetySummary` (`runtime-services.ts` L14071–14132): `baaStatus` is `NotConfigured` unless `PERISCAN_BAA_REFERENCE_URL` is https; `subprocessors` from `PERISCAN_SUBPROCESSORS_JSON` defaults to **[]**; encryption defaults to “Deployment-managed…” string. No in-repo DPA template or click-wrap processing terms surfaced as product artifact.
- **Problem:** Procurement requires executed DPA + subprocessor list *before* production data. Empty subprocessors and NotConfigured BAA fail legal intake.
- **Impact:** Multi-week legal loop; deal slips; design partners cannot put real evidence in prod without offline PDF chase.
- **Recommendation:** Ship Trust Center page with versioned DPA PDF, subprocessor table (AWS/GCP/email/etc.), data categories processed, deletion/export process; keep env override for customer-specific BAA. Never ship empty list as “none.”
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Wave C #17 (previous synthesis)

### FINDING | P17-6 | P1 | feature | mssp | Billing is a ledger without procurement settlement
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `paymentProcessorStatus: "NotConfigured"` hard-coded in subscription workspace (`subscriptions.ts` L258–264, L309–315) and every `BILLING_PACKAGE_CATALOG` entry (`runtime-services.ts` ~5066+). Runbook: does not charge cards, tax, invoices, or attest settlement (`docs/SUBSCRIPTION_OPERATIONS_RUNBOOK.md` L11–16). Marketplace procurement ExternalDependency (`enterprise-readiness.ts` L363–370). Packages list many SKUs (LightExternalScan → Enterprise-class) all contact-sales.
- **Problem:** Procurement needs PO, order form, invoice, renewal calendar, and entitlement proof. Product has excellent *usage ledger* but no *buy* path.
- **Impact:** Cannot self-serve or even semi-automate enterprise purchase; every deal is custom ops; finance cannot reconcile usage to invoice without offline process.
- **Recommendation:** Keep processor honesty; add **Order form / Invoice lifecycle** (external invoice ID, amount optional, signed PDF store, entitlement binding) and Marketplace Limited qualification checklist as explicit sales engineering gate. Collapse package zoo to 2–3 RFP SKUs.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** U-19; Horowitz “ledger without a bank”

### FINDING | P17-7 | P1 | feature | ops | No public SLA status page or contractual uptime surface
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** API exposes process metrics `/metrics` and Prometheus uptime for *operators* (`apps/api/src/app.ts` metrics helpers) — not a customer status page. No `status.periscan.com` (or equivalent) in web app/docs. Trust & Safety covers backups/alerts as *deployment-managed* readiness, not public incident history. Product “SLA” language found is **remediation target SLA** (findings due dates), not platform availability SLA.
- **Problem:** Enterprise MSA annexes require status page URL + support tiers + RTO/RPO.
- **Impact:** Legal inserts unfavorable boilerplate or blocks signature; InfoSec cannot assess historical incident transparency.
- **Recommendation:** Stand up external status page (even manual at first); document support hours, severity matrix, RTO/RPO for control plane vs runner; link from Trust Center. Do not invent 99.99% claims without measurement.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P17-8 | P1 | feature | auth | “Advanced RBAC” claimed; product has six fixed roles only
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `MembershipRoleSchema`: Owner, Admin, SecurityEngineer, Viewer, MSSPOwner, ClientAdmin only (`domain.ts` L13–20). PRD Phase 8 requires “advanced RBAC” (`docs/PERISCAN_FULL_PRODUCT_PRD.md` L1973); phase coverage test treats `MembershipRoleSchema` + role names as proof (`prd-build-phases-coverage.test.ts`). Operator personas (Red/Blue Team Operator etc.) are **recommendation agents** (`packages/operators`), not RBAC roles. No custom roles, ABAC, or permission matrices for GRC-only / rem-only / evidence-only humans.
- **Problem:** RFP matrices ask for least-privilege roles (auditor read-only reports, remediator without admin, breaker of last owner, etc.). Six coarse roles force over-privilege.
- **Impact:** SOX/SOX-adjacent access reviews fail; buyers must accept shared Admin; increases blast radius of compromised accounts.
- **Recommendation:** Either implement custom role claims (permission sets) **or** rename PRD/acceptance to “baseline multi-role RBAC” and sell advanced RBAC as roadmap with date. Map GRC persona to Viewer + report scopes.
- **Effort:** L (true advanced); S (honesty rename)
- **Zoo-related:** no
- **Previous-panel-link:** U-19; PRD-PHASE-005 overclaim risk

### FINDING | P17-9 | P1 | improvement | security | Residency exists but multi-region/trust proof is deployment-fragile
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** Signup/tenant `dataRegion` + evidence routing (HANDOFF Wave 3 complete); `availableRegions` labels for us-east-1, eu-central-1, uk-south-1, ap-southeast-1 (`runtime-services.ts` L14008–14015). `routingStatus` is `SingleRegion` unless multiple regions configured. Fail-closed when regional target absent (good). Localization explicitly does **not** move data (`localization.ts` / product-help copy).
- **Problem:** EU/UK buyers need contractual residency + transfer mechanism (SCCs) + proof writes never leave region. Single-region default + env-only multi-region is easy to misconfigure in enterprise SaaS ops.
- **Impact:** GDPR/DPA questionnaire stalls; “we selected eu-central-1” without configured EU storage is a silent compliance failure mode if not fail-closed everywhere.
- **Recommendation:** Sales SKU “EU residency” that only provisions when EU storage endpoints health-check green; show continuous residency attestation in Trust Center + isolation proof pack; document SCC/transfer basis in DPA.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** none (improves prior residency critique)

### FINDING | P17-10 | P1 | feature | integrations | Audit is pull-export, not SIEM-stream enterprise monitoring
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `createAuditExport` caps at `AUDIT_EXPORT_MAX_EVENTS = 5000` with truncation flag (`runtime-services.ts` L2399; `tenant.ts` L1569–1647). Webhook catalog is only five types: `mission.completed|failed`, `snapshot.ready`, `remediation.created`, `policy.denied` (`domain.ts` L878–884) — **no** `audit.event`, login, role.change, sso.*, export, or `remediation.verified`. Prior panel U-08: `policy.denied` may be subscribed without reliable emit.
- **Problem:** Enterprise InfoSec requires continuous control-plane audit into Splunk/Sentinel (immutable, near-real-time), not occasional admin CSV downloads.
- **Impact:** Fails “SIEM integration for admin audit logs” RFP rows; IR cannot detect mass invite/role change without polling API.
- **Recommendation:** Add signed webhook event family for security-relevant audit actions + optional S3/GCS batch export; document completeness; fix `policy.denied` emit-or-remove (U-08). Keep CSV for offline legal holds.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-08, U-21

### FINDING | P17-11 | P2 | feature | security | No BYOK / customer-managed encryption keys
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** Trust Safety `encryptionAtRestStatus` is `Configured` only via free-text env `PERISCAN_EVIDENCE_ENCRYPTION_AT_REST`, else `DeploymentManaged` (`runtime-services.ts` L14069–14125). No CMK/KMS key ARN per tenant, no key rotation API, no envelope encryption customer-held key. Integration secrets use platform encryption keys (production checklist), not customer BYOK.
- **Problem:** Highly regulated buyers (finance/health/gov-adjacent) often require CMK or exclusive key control for evidence stores.
- **Impact:** Loses regulated RFPs or forces private deployment exception process.
- **Recommendation:** Phase 1: document platform KMS + annual rotation under DPA. Phase 2: optional customer AWS KMS CMK for evidence bucket. Do not advertise BYOK until implemented.
- **Effort:** XL (full BYOK); S (honest disclosure)
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P17-12 | P0 | bug | gtm | RFP/Phase 8 “SCIM + advanced RBAC” proven by string presence tests
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `tests/modules/prd-build-phases-coverage.test.ts` L383–434 expects phase tokens including `"SCIM"` and `"advanced RBAC"` (via earlier list L147) against concatenated sources — connectors + docs can satisfy SCIM via CyberArk connector prose. `docs/ACCEPTANCE_CRITERIA.md` L2381 asserts Phase 8 includes SCIM and advanced RBAC as proven. `docs/PRD_REQUIREMENT_LEDGER.md` PRD-PHASE-005 marks Implemented mapping including SCIM/advanced RBAC.
- **Problem:** Coverage tests create **false confidence** for sales engineers answering RFPs from internal “Implemented” ledgers.
- **Impact:** Misrepresentation risk in security questionnaires; CISO panel score inflation theme (U-07) applies to enterprise gates too.
- **Recommendation:** Split PRD tokens: `SCIM-inbound-user-provisioning` vs `SCIM-connector-cyberark-readonly`. Require route/OpenAPI operation existence for Implemented. Freeze Leading/Implemented without executable proof (agree Slice 10 blind rescore).
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-07, U-19

### FINDING | P17-13 | P1 | improvement | gtm | Feature zoo confuses RFP scope and expands risk questionnaires
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `PRIMARY_NAV` includes Autonomous (Swarm, Workflows, Operators, Engagements, MCP), Machine Identities, Threat Center/Feed, Tool Governance, AI Apps, etc. (`apps/web/src/lib/primary-nav.tsx` L330–591). Enterprise readiness packs advertise confidential attestation, OT/ICS, credential exposure marketplace-gated packs (`enterprise-readiness.ts`). Package catalog includes many capability bundles with contact-sales pricing.
- **Problem:** Procurement risk questionnaires expand with every AI/agent/OT surface even when the commercial intent is “proof loop CTEM.”
- **Impact:** Longer security review, more redlines (AI training data? agent autonomy? industrial safety?), higher chance of no-bid.
- **Recommendation:** RFP response pack = Snapshot + Paths + Findings + Remediation + Evidence + SSO + Audit + Trust Center only. Move Autonomous/MCP/Swarm to Labs with explicit “not in scope for this agreement” schedule. Agree U-03/U-16 packaging.
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-03, U-16

### FINDING | P17-14 | P2 | feature | auth | JIT provisioning absent; SSO is invite-gated
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `sso.ts` L750–756 rejects unprovisioned users; HANDOFF L502 SCIM/JIT follow-on; invite flow is admin-driven (`tenant.ts` inviteToCurrentTenant). PRODUCTION_READINESS.md L27: sessions only for “active provisioned tenant members.”
- **Problem:** Even without full SCIM, many IdPs expect just-in-time create-on-first-login with default Viewer role + domain allowlist.
- **Impact:** Day-0 enterprise rollout needs manual invites for every analyst; blocks IdP-only onboarding pilots.
- **Recommendation:** Optional JIT flag: domain allowlist + default role Viewer + audit `user.jit_provisioned`; still prefer SCIM for disable/delete.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-19

### FINDING | P17-15 | P1 | request | gtm | No customer-facing security questionnaire / trust pack artifact set
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** Trust Safety is authenticated in-app API/UI; no public trust center site; production readiness lists deployment-managed backups/alerts/incident contact (`docs/PRODUCTION_READINESS.md`); no CAIQ/SIG Lite answers repo; pen-test summary process not productized; marketplace legal approvals still ExternalDependency.
- **Problem:** Enterprise InfoSec sends a fixed questionnaire pack; vendors with a downloadable trust kit win cycle time.
- **Impact:** Every deal reinvents answers; inconsistent claims across SE/AE; longer time-to-close.
- **Recommendation:** Create `docs/trust/` or public site: architecture diagram, data flow, subprocessors, DPA, encryption, SSO/SCIM status (honest), backup/RTO, vulnerability disclosure, pen-test request under NDA. Version it with product releases.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Wave C #17

### FINDING | P17-16 | P2 | improvement | api | Marketplace procurement gate honest but commercially incomplete
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `AWS_MARKETPLACE_RUNBOOK.md` — app-side ready; listing Limited/Public is commercial/AWS ops; `enterprise-readiness` marketplace check ExternalDependency until pricing/tax/legal/DPA approvals. Prefer honesty over fake “Buy on AWS” button.
- **Problem:** Many enterprise buyers *only* purchase via Marketplace or existing AWS commit. Incomplete listing blocks preferred procurement path.
- **Impact:** Deals stuck on private order forms; no self-serve commit drawdown.
- **Recommendation:** Treat Marketplace Public as a **go-to-market milestone** equal to SOC pack; do not expand connector zoo before listing qualifications complete.
- **Effort:** L (business); S (product already mostly ready)
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P17-17 | P2 | improvement | security | Isolation proof pack is strong; buyer cannot use it as vendor assurance alone
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** `enterprise-readiness.ts` L347–353 marks tenant-isolation proof pack Satisfied; reports can generate isolation/data-protection pack. Excellent for *customer* evidence of *their* tenancy configuration.
- **Problem:** Procurement still needs independent assurance (SOC 2, pen test) that multi-tenant isolation holds under adversarial review.
- **Impact:** Over-reliance on product-generated proof in sales decks invites skeptical CISOs (agree score inflation concern).
- **Recommendation:** Position isolation pack as customer evidence; pair with third-party test summary in Trust Center. Keep generating pack — do not sell it as Type II.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-07

### FINDING | P17-18 | P2 | request | ops | Support / incident contact is env-deployed, not contractual product surface
- **Persona:** Enterprise Procurement / InfoSec Buyer
- **Evidence:** Trust Safety `operationalReadiness` includes incident contact as configured/deployment-managed (acceptance criteria L1399; PRODUCTION_READINESS deployment-managed list). No in-product severity→response matrix for SaaS incidents affecting customer validation availability.
- **Problem:** Buyers attach Support SLA exhibits; “deployment-managed” is not an answer without named contacts and severity definitions.
- **Impact:** MSA negotiation friction; unclear escalation during outage of validation control plane.
- **Recommendation:** Publish support policy (S1–S4) with response targets; surface status page + support email in Trust Center; keep customer success owner field already used in subscription lifecycle.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** U-19

---

## 6. RFP response cheat-sheet (honest answers)

| RFP row | Honest answer today | Blocker ID |
| --- | --- | --- |
| SAML/OIDC SSO | **Yes** (real) | — |
| SSO enforce / password block | **Yes** | — |
| SCIM user provisioning | **No** (CyberArk SCIM = inventory only) | P17-1, P17-12 |
| Group → role mapping | **No** | P17-2 |
| JIT provisioning | **No** | P17-14 |
| Force MFA policy | **No** (user-optional) | P17-3 |
| RBAC | **Basic 6 roles** — not advanced | P17-8 |
| Audit log export | **Yes** (cap 5k, truncated flag) | P17-10 |
| Audit log SIEM stream | **Partial/No** | P17-10 |
| Data residency selection | **Yes** if multi-region storage configured | P17-9 |
| BYOK | **No** | P17-11 |
| DPA / subprocessors | **Env-dependent; often empty** | P17-15 |
| Vendor SOC 2 Type II | **Not productized** | P17-4 |
| Customer SOC 2 evidence assist | **Thin pack (3 controls)** | P17-4 |
| Public status page / SLA | **No** | P17-7 |
| Self-serve payment | **No** (honest NotConfigured) | P17-6 |
| Invoice / order-form ledger | **Partial** (entitlement ledger only) | P17-6 |
| AWS Marketplace buy | **App ready; listing not Public** | P17-16 |
| Tenant isolation tests | **Strong engineering evidence** | P17-17 |
| Destructive testing / exploit chaining | **Denied by design** (safety strength) | protect |

---

## 7. Agreement / dissent with previous panel

| Theme | Stance |
| --- | --- |
| U-19 SCIM/JIT/group/MFA/status/billing | **Agree strongly** — reconfirmed in code; remain buy blockers |
| Wave C trust pack / pen-test process | **Agree** — still missing as buyer-consumable kit |
| Horowitz “ledger without bank” | **Agree** — do not fake Stripe; do finish invoice/Marketplace path |
| CISO NO-BUY as PoR | **Agree** for 5k+ PoR; pilot OK |
| Real-first honesty | **Agree — protect** — better than competitors’ fake checkout |
| “Phase 8 enterprise done” narrative | **Dissent / reject** — string-match SCIM/advanced RBAC is not enterprise done |
| Feature zoo cut list | **Agree** with Jobs/Horowitz/Palantir — zoo actively harms RFP cycle time |

---

## 8. Bottom line

Periscan is a **technically serious** validation platform with rare honesty about payment, connectors, and safety. For an enterprise procurement / InfoSec buyer, it is still a **design-partner purchase**: identity lifecycle incomplete (no SCIM/JIT/group map/force MFA), trust legal pack incomplete (DPA/subprocessors/vendor SOC/status/SLA), commercial settlement incomplete (no invoice/Marketplace Public), audit SIEM incomplete, and RFP surface diluted by an autonomous feature zoo.

**Do not answer RFPs from Phase 8 “Implemented” rows without this persona’s cheat-sheet.**  
**Ship trust + identity + status + commercial close path before claiming enterprise-ready.**

---

*End of panel P17 — `docs/qa/panel-audit-exhaustive-2026-07-29/personas/17-enterprise-buyer.md`*
