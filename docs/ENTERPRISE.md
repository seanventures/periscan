# Community vs commercial

**Audience:** CISO and enterprise admin evaluating self-hosted Community against
commercial product. Not a first-hour fold.

License split: [`OPEN_CORE.md`](../OPEN_CORE.md). Community start:
[`COMMUNITY.md`](../COMMUNITY.md).

---

## Community (what this repo is)

Self-host the Apache-2.0 **validation slice**. Community start is an **authorized
local clone path** you own (or are contracted to test) plus
**Gitleaks-class secrets** (`jobsQueued=1`). Keep proving. Remediations stay Open until a
**retest**. **Fixed** only after that verification event.

Full BAS/AEV is the development objective. Current enterprise controls are not a claim of automated pentest delivery or a Wiz / Tenable replacement,
and not a Nuclei wrapper.

Need **Node 24** and **Docker**. Clone this repo, inspect it, then install.
Details: [`COMMUNITY.md`](../COMMUNITY.md), [`USING.md`](../USING.md).

---

## CTEM in Periscan

In this product, CTEM is a **proof layer on authorized scope**
(Scope → Discover → Prioritize → Validate → Mobilize → Verify). That loop maps
to operator **Authorize → Verify**. It is **not** a Microsoft CTEM replacement.
Periscan has a full BAS/AEV development program. Scenario execution requires
qualified adapters and measured evidence.

Community first hour is still **Gitleaks-class secrets** (`jobsQueued=1`) on an
authorized local path. **Live Atomic** requires a qualified adapter before execution. Hosted product and MSSP
portfolio are commercial.

---

## What exists in-product (do not over-read)

These are real, API-first controls documented in
[`PRODUCTION_READINESS.md`](../PRODUCTION_READINESS.md). They are **not**
“SSO in one click” and **not** a SOC 2 pack (vendor Type II). Customer
auditor follow-up packs are separate — see [`SOC2.md`](./SOC2.md).

| Control | Honest status |
| --- | --- |
| Tenant isolation | Tenant-scoped APIs, RBAC, cross-tenant evidence denial. The in-product isolation proof pack is **customer tenancy evidence**, not a Periscan SOC 2 Type II substitute. |
| Audit events | Auth, scope, policy, mission, evidence, report, remediation, verification, runner, invite, role-change, SSO, and connector flows emit audit events. |
| OIDC / SAML | API-first **configuration** and login enforcement for **pre-provisioned** tenant members. You still supply IdP, redirect URI, credentials/certificates, and claim mapping. |
| Inbound SCIM / JIT | **NotConfigured.** CyberArk SCIM in the catalog is read-only identity *inventory*, not Periscan user provisioning. See [`ENTERPRISE_IDENTITY_LIFECYCLE.md`](./ENTERPRISE_IDENTITY_LIFECYCLE.md). |

Vendor SOC 2 Type II is **not claimed**. Customer support pack vs Type II:
[`SOC2.md`](./SOC2.md). Questionnaire kit:
[`trust/README.md`](./trust/README.md). Vendor-assurance honesty:
[`trust/VENDOR_COMPLIANCE.md`](./trust/VENDOR_COMPLIANCE.md).

---

## What is commercial

Hosted product, not this LICENSE file. Canonical list:
[`OPEN_CORE.md`](../OPEN_CORE.md).

| Surface | Why it is not Community |
| --- | --- |
| Hosted multi-tenant SaaS | Cloud ops, tenancy at scale, support SLAs |
| Managed SSO / SCIM | Funded identity edge. Community has API-first *configuration*, not a managed IdP or joiner/mover/leaver product |
| MSSP portfolio / multi-client operations | Commercial services |
| Premium catalogs, payments, Marketplace, Production connector certification | Partner keys and counsel |

MSSP or billing routes in this tree are **not** Community-supported.

---

## Safety floor (both editions)

- Only **verified, customer-authorized** scope
- Denied tasks **never** queue
- **Fixed** requires a verification event
- Atomic, Caldera, SharpHound and Metasploit execution requires a qualified
  adapter, an approved scenario, and measured evidence under the [BAS/AEV program](BAS_AEV_PROGRAM.md)
- Runner transport is outbound HTTPS signed-task polling

[`SECURITY_BOUNDARIES.md`](../SECURITY_BOUNDARIES.md) ·
[`SETTLED.md`](./SETTLED.md)

---

## Vulnerability reports

Open a **title-only** GitHub issue with the `[SECURITY]` prefix. Keep the public
body free of PoCs. Maintainers follow up privately. Do not invent a mailbox.

[`SECURITY.md`](../SECURITY.md)

---

## Pointers

| Want | File |
| --- | --- |
| License / open-core split | [`OPEN_CORE.md`](../OPEN_CORE.md) |
| Community first hour | [`COMMUNITY.md`](../COMMUNITY.md) |
| Production readiness (isolation, audit, SSO config) | [`PRODUCTION_READINESS.md`](../PRODUCTION_READINESS.md) |
| Identity lifecycle (SCIM / JIT honesty) | [`ENTERPRISE_IDENTITY_LIFECYCLE.md`](./ENTERPRISE_IDENTITY_LIFECYCLE.md) |
| SOC 2 (vendor Type II vs customer support pack) | [`SOC2.md`](./SOC2.md) |
| Trust / questionnaire kit | [`trust/README.md`](./trust/README.md) |
| Local / self-host setup | [`SETUP.md`](./SETUP.md) |
| Vuln intake | [`SECURITY.md`](../SECURITY.md) |
| Settled axioms | [`SETTLED.md`](./SETTLED.md) |
