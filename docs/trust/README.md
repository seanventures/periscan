# Periscan Trust Pack (customer-facing security questionnaire kit)

**Audience:** enterprise InfoSec / procurement completing vendor security questionnaires (CAIQ Lite, SIG Lite, custom RFI).  
**Honesty rule:** Prefer exact product capability language over marketing. Where a control is partial, say so.  
**Version:** align with product release; last structural update 2026-07-31 (PERISCAN-30 identity residual).

This pack is **documentation + in-product proof surfaces**, not a SOC 2 Type II report or independent pen-test certificate. Pair with NDA-gated third-party assurance when required.

Ops residual (SCIM / Type II / pen-test): [`docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md`](../ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md)

In-product mirror: Trust & Safety (`/trust-safety`) panels:

- **Identity & access control plane** — `identityProvisioning` (**Partial** plane; SCIM/JIT **NotConfigured**; order-form CTA)
- **Enterprise commercial honesty** — `enterpriseCommercial` on `GET /api/v1/tenants/current/trust-safety`
- **Enterprise trust pack** — SCIM decision, scorecard freeze, zero-ref market presence, artifact pointers
- **GTM claim language** — code-exported prove / integrate / refuse (`getGtmClaimLanguageSummary()`)

---

## 0. E13 decisions (durable)

| Decision | Status | Close path |
|----------|--------|------------|
| Trust pack artifact set | **Shipped** (this directory + Trust & Safety UI) | Keep honest; expand only with real controls |
| SCIM for Periscan users | **NotConfigured** + sales-assisted SLA in order form | Full inbound SCIM residual; `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` + residual memo |
| IdP plane overall | **Partial** (SSO + force-MFA + claim→role) | Never claim SCIM Production or full lifecycle |
| Vendor SOC 2 Type II | **None / NotClaimed** | Real Type II program only; never invent reports |
| Scorecard freeze | **External Leading frozen** without matrix Fully-E2E | Blind rescore before Wave/MQ claims; `docs/DESIGN_PARTNER/BLIND_RESCORE_GATE.md` |
| Design-partner / customer refs | **Zero public references** → market presence **fail** | ≥3 production partners + written consent; `docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md` |

**Do not close Wave/MQ market presence while public references = 0.** Templates and checklists are not customers.

---

## 1. What to send first (RFP-safe scope)

Default RFP product surface (avoid feature zoo — P17-13):

| Surface | In product | Notes |
|---------|------------|--------|
| Validation Snapshot | Yes | Primary proof loop |
| Attack paths / findings / remediation | Yes | Measured language only when measured |
| Evidence packs & audit | Yes | Tenant-scoped, redacted exports |
| SSO (OIDC/SAML) | Yes | Configure IdP; JIT/SCIM incomplete |
| RBAC | Yes — **six fixed roles** | Owner, Admin, SecurityEngineer, Viewer, MSSPOwner, ClientAdmin. No custom/ABAC roles yet |
| Trust & Safety / isolation proof | Yes (authenticated) | Customer tenancy evidence, not vendor Type II |
| Autonomous / Swarm / MCP / Labs | **Out of default RFP scope** | Label as Labs / roadmap unless contracted |

---

## 2. Architecture & data flow (pointers)

| Topic | Canonical source |
|-------|------------------|
| System architecture | `ARCHITECTURE.md`, `docs/ARCHITECTURE.md` |
| Runner control plane (outbound HTTPS, signed tasks, mTLS) | `docs/RUNNER_SPEC.md`, `RUNNER_ARCHITECTURE.md` |
| Safety floor & policy PEP | `SECURITY_BOUNDARIES.md`, `packages/policy` |
| Threat model (STRIDE, residuals) | `docs/THREAT_MODEL.md` |
| Production deployment | `docs/PRODUCTION_READINESS.md`, `infra/production/` |
| Export control / authorized use | `docs/EXPORT_CONTROL_AND_AUTHORIZED_USE.md` |
| Identity lifecycle honesty | `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` |

**Data flow (summary):** Customer-authorized scope → policy decision → mission/validation run → runner or ExternalPoA → evidence store (tenant-namespaced) → findings/paths/remediation → reports. No destructive/live exploit chaining without explicit governance flips.

---

## 3. Questionnaire answer bank (short form)

### Identity & access

| Question theme | Honest answer |
|----------------|---------------|
| MFA | TOTP + hashed recovery codes; tenant `requireMfa` and env force-MFA available for password sessions |
| SSO | OIDC + SAML per tenant; enforce-SSO blocks password login |
| SCIM / JIT | **Not full product SCIM.** Inbound SCIM/JIT provisioning is incomplete; members are invite/provisioned today |
| Roles | Six fixed membership roles (see above); API keys map coarse scopes → role ceiling |
| Session crypto | HS256 session JWTs with `kid`; purpose-split report-share secret; optional previous-key dual-verify |

### Isolation & encryption

| Question theme | Honest answer |
|----------------|---------------|
| Multi-tenant isolation | App-layer `tenantId` filters + Postgres RLS **write-path** backstop (`app.current_tenant`). Reads are correct-by-convention unless `runWithTenantRls` |
| Proof pack | In-app Tenant Isolation & Data Protection report (`/api/v1/reports/tenant-isolation-proof`) |
| Encryption in transit | TLS for control plane and runner channel |
| Encryption at rest | Deployment-managed (`PERISCAN_EVIDENCE_ENCRYPTION_AT_REST`, integration/model credential keys) — confirm per deployment |
| Secrets | API keys / tokens hashed at rest; connector/model credentials AES-GCM when keys configured |
| BYOK / CMK | **Not shipped** as customer-held keys. Do not claim BYOK until implemented |

### Validation safety

| Question theme | Honest answer |
|----------------|---------------|
| Scope | Only verified customer-authorized scope |
| Policy | Dual gates; denied work never queued |
| Fixed claims | Remediation cannot be Fixed without verification event |
| Offensive modules | Governed safety levels; destructive flags require explicit tier |
| External PoA / SSRF | Scope + template allowlist + post-resolve private-IP denial |
| Runner trust | Ed25519 task envelopes; mandatory result signing; mTLS fingerprint default-on in production |

### Operations, billing, SLA (P17 residual honesty)

| Question theme | Honest answer |
|----------------|---------------|
| Logging / audit | Security-relevant actions emit audit events (auth, scope, policy, mission, evidence, report share, runner, SSO, …) |
| Audit SIEM stream | **Pull-export only** today (`/api/v1/audit-events`, hard cap **5000** events/export; `truncated=true` when capped). Continuous SIEM-native stream status is **`NotConfigured`** (not shipped). Product webhooks deliver discrete proof-loop events (HMAC), not a full continuous audit bus. Keep CSV for legal hold |
| Backups / RTO / RPO | **Deployment-managed** — document per environment; not a SaaS SLA page in-product |
| Public status page / contractual uptime | **Not shipped.** Do not invent 99.x% claims. Operator metrics exist for deployers; customer status page is external when published |
| Incident contact | Deployment-configured operational readiness fields |
| Billing / payment processor | **Usage + entitlement ledger only.** `paymentProcessorStatus: NotConfigured` — no card capture, tax, or automated settlement. Sales-led order form / invoice / Marketplace |
| Invoice lifecycle | Entitlement + usage meters exist; PO/invoice PDF store and procurement settlement are offline / sales ops |
| Vulnerability disclosure | Process via security contact (deployment-managed); no public bug bounty claim unless contracted |
| Pen test | Independent platform pen-test is an external assurance gate — request under NDA; not a product checkbox |

### Residency (P17-9)

| Question theme | Honest answer |
|----------------|---------------|
| Tenant data region | Selected at signup / tenant config (`dataRegion`) |
| Multi-region routing | **Deployment-dependent.** `routingStatus` is `RegionRouted` only when multiple regions are configured with storage; otherwise `SingleRegion` / SingleRegionDeploymentDependent |
| Fail-closed | Regional target missing should fail closed — verify deployment health before promising EU/UK-only residency in MSA |
| Localization | UI locale does **not** move data residency |
| SCC / transfer | Document in customer DPA (legal), not as automatic product guarantee |

### Subprocessors & compliance certifications (SOC2/DPA honesty)

| Question theme | Honest answer |
|----------------|---------------|
| Subprocessors | Deployment-specific via `PERISCAN_SUBPROCESSORS_JSON`. Empty list means **not disclosed in this deployment**, not “none exist.” Maintain customer-facing list per environment |
| DPA / BAA | Legal artifacts live outside the repo. BAA reference is env-gated (`PERISCAN_BAA_REFERENCE_URL`); status `NotConfigured` when unset |
| Customer SOC 2 / ISO support packs | Thin **customer control-evidence** assistants in product — help *their* audit, not Periscan’s |
| Vendor SOC 2 Type II / ISO | **Not claimed by this repository as certified.** `enterpriseCommercial.vendorSoc2Attestation.status: NotClaimed` |
| Isolation proof pack | Strong **customer tenancy** evidence; not a substitute for independent vendor assurance |

---

## 4. Artifacts checklist for SE/AE

- [ ] This trust pack (`docs/trust/`)
- [ ] Architecture + threat model PDFs or links (from sources above)
- [ ] DPA / MSA (legal — outside repo)
- [ ] Subprocessor list (deployment)
- [ ] Latest pen-test summary under NDA (if available) — engagement checklist: `PEN_TEST_ENGAGEMENT.md` (none completed in-repo)
- [ ] Screenshot or export of tenant isolation proof pack for *their* tenant (post-trial)
- [ ] SSO runbook + role matrix (six roles)
- [ ] Trust & Safety UI: identity + enterprise commercial honesty panels

---

## 5. Claims we refuse in questionnaires

- “Advanced RBAC / custom roles / ABAC” as shipped today  
- “Full SCIM provisioning” as shipped today  
- “RLS on every read query by default”  
- “SOC 2 Type II / ISO certified by virtue of product UI”  
- “Self-serve payment / automated settlement”  
- “Public contractual 99.x% SLA status page” as product-native  
- “Continuous SIEM stream of all audit events” as shipped (pull-export only)  
- “Multi-region residency guaranteed” without deployment region health proof  
- “Autonomous agent / swarm executes customer systems without policy”  
- Live Atomic/Caldera/SharpHound destructive execution  

---

## 6. Residual map (enterprise buyer tickets)

| Residual | Status label | Close path |
|----------|--------------|------------|
| P17-6 Billing settlement | `paymentSettlement: NotConfigured` | Honesty + sales-led order form; no fake Stripe |
| P17-7 Public SLA status page | `publicSlaStatusPage: NotConfigured` | External status page when ready; no invented uptime % |
| P17-9 Multi-region trust proof | `multiRegionResidency` deployment-dependent | Fail-closed + DPA SCC language |
| P17-10 Audit SIEM stream | `auditStreaming: PullExportOnly` | Keep CSV; stream is roadmap |
| P17-13 Feature zoo / RFP scope | `rfpDefaultScope` included/excluded lists | Default questionnaire = proof loop only |
| SOC2 / DPA | `vendorSoc2Attestation: NotClaimed` | Customer packs ≠ vendor Type II |

---

## Related product surfaces

- Authenticated Trust & Safety / operational readiness APIs  
- Compliance workbench (customer control evidence — not vendor cert)  
- `SECURITY_BOUNDARIES.md` and `docs/THREAT_MODEL.md` for residual risk language  
- `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` for SCIM/MFA honesty  
- `docs/SUBSCRIPTION_OPERATIONS_RUNBOOK.md` for ledger-without-bank billing  
- `packages/shared/src/gtm-claim-language.ts` — prove/integrate/refuse contract  
- `docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md` — zero-ref gate (honest empty)  
- Sibling files: `LEGAL_PACK.md`, `VENDOR_COMPLIANCE.md`, `PEN_TEST_ENGAGEMENT.md`, `PEN_TEST_PROCESS.md`, `EXTERNAL_VALIDATION.md`  
