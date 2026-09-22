# Enterprise identity lifecycle (honest status)

Last reviewed: 2026-09-17  
Tickets: P04-4 (#111), P17-1, P17-3, P17-14 (JIT honesty), U-19, **PERISCAN-30**

Residual memo (SCIM / Type II / pen-test): [`docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md`](./ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md)

## What is real today

| Capability | Status | Surface |
|---|---|---|
| Tenant OIDC / SAML SSO | Ready (customer IdP setup still required) | `/api/v1/tenants/current/sso`, public `/api/v1/auth/sso/*` |
| SSO enforce (deny password for tenant) | Ready | SSO config `enforced` |
| Force-MFA for password humans | Ready | Env `PERISCAN_REQUIRE_MFA=true` **or** tenant `requireMfa` via `PUT /api/v1/tenants/current/security-settings/require-mfa` |
| Per-user MFA enroll/verify/recovery | Ready | `/api/v1/auth/mfa/*` |
| CyberArk SCIM **connector** (inventory) | Ready (read-only) | Integration connector — users/groups/MFA posture for *customer* identity attack-path context |
| Inbound SCIM 2.0 for **Periscan** users | **Ready** when a tenant SCIM token is issued; otherwise **NotConfigured** | `/api/v1/scim/v2/*` Users/Groups with hashed tenant bearer token. Unauthenticated **401**. Deprovision sets membership Inactive (evidence retained). Login remains SSO or password. |
| JIT create-on-first-SSO | **Optional** (P17-14) | Tenant opt-in: `jitEnabled` + `jitEmailDomains[]` + `jitDefaultRole` (Viewer default, never Owner). First verified SSO for an unknown email creates an Active membership and audits `user.jit_provisioned`. Disabled tenants still fail with `sso_user_not_provisioned`. Prefer inbound SCIM for disable/delete. Product honesty: `identityProvisioning.jitProvisioning.status = Optional`. |
| IdP group → Periscan role mapping | Partial (ships; not full lifecycle) | OIDC/SAML claim rules map groups/roles for pre-provisioned members. Not a SCIM/JIT substitute. |
| **IdP plane overall** | **Partial** | API: `identityProvisioning.planeStatus = Partial`. Optional JIT ships as tenant opt-in. Inbound SCIM is Ready after a tenant token is issued. |

## Force-MFA policy (closed portion of P04-4 / P03-7 / P17-3)

When `PERISCAN_REQUIRE_MFA=true` **or** `tenant.requireMfa === true`:

1. Password login without enrolled MFA does not grant full product access.
2. Session is limited to MFA setup paths: enroll, verify, `/me`, tenant current, logout.
3. Users who already activated MFA continue normal password + TOTP/recovery flow.
4. SSO sessions are not forced through Periscan MFA (IdP owns second factor).
5. API keys / system jobs are out of scope.
6. Unknown/malformed `PERISCAN_REQUIRE_MFA` values **fail closed in production** (treated as required).
7. Tenant admins can read/set `requireMfa` via `GET|PUT /api/v1/tenants/current/security-settings/require-mfa`.

Tests: `apps/api/src/mfa-policy.test.ts`, force-MFA cases in `apps/api/src/app.test.ts`.

### Step-up / reauth residual (open portion of P03-7)

| Action | Step-up today |
|--------|----------------|
| Password change | Current password (+ TOTP if MFA enrolled) |
| MFA disable / recovery-code regenerate | Password reauth (`reauth_required`) |
| API key create / rotate | Role check only — **no** MFA step-up |
| Offensive-validation flip | Admin role + attestation reference — **no** MFA step-up |
| Runner / model kill switch | Admin role — **no** MFA step-up |

General privileged-action step-up policy remains roadmap. Force-MFA for password humans is the closed enterprise baseline.

## SCIM honesty (open residual)

Do **not** equate these:

- **CyberArk Identity SCIM connector** — pulls authorized customer identity inventory into Periscan signals. Not Periscan account provisioning.
- **Inbound SCIM for Periscan** — creates/updates/deprovisions tenant members and roles from the customer IdP via `/api/v1/scim/v2`. Requires a tenant SCIM bearer token (hashed at rest). Not Okta/Azure certified. JIT create-on-first-SSO remains NotConfigured.

JIT remains NotConfigured. Until a tenant SCIM token is issued, treat inbound
SCIM as NotConfigured and use the interim SLA below. Paste the SLA into
enterprise order forms / DPA annexes when SCIM is not yet configured for that
tenant.

### Sales-assisted provisioning SLA (interim — order-form annex)

| Event | Commitment |
|---|---|
| New seat / role change | Operator invite within one business day for ≤25 seats; five business days for larger bulk loads unless contracted otherwise |
| Offboarding | Disable membership same business day of written request; session invalidation on next request |
| Access certification | Quarterly review of Active members + roles with customer IAM |
| Emergency break-glass | Documented owner account + MFA; rotate after use |

RFP language:

> Periscan supports SSO (OIDC/SAML) for pre-provisioned users, optional force-MFA for password users, and inbound SCIM 2.0 Users/Groups provisioning with a tenant bearer token (not Okta/Azure certified; JIT create-on-first-SSO is NotConfigured). CyberArk SCIM in the catalog is a read-only identity inventory connector, not Periscan user provisioning.

## Safety / real-first

- Do not claim Okta/Azure SCIM certification, JIT, or a full IdP joiner/mover/leaver plane.
- Phase 8 / PRD mentions of SCIM must distinguish inbound membership SCIM (`/api/v1/scim/v2`) from CyberArk connector inventory SCIM.
