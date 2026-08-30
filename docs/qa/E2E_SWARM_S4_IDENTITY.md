# E2E Swarm S4 — Identity plane (SSO + SCIM honesty)

**Agent:** Swarm S4  
**Date:** 2026-07-31  
**Repo path:** overnight-loop (or main once merged)  
**Epic residual:** PERISCAN-30 / enterprise identity — Partial plane, not full IdP lifecycle

## Goal

Prove the identity plane is **acceptance-complete** for what ships and **honestly residual** for what does not:

| Surface | Product truth | E2E expectation |
| ------- | ------------- | --------------- |
| **OIDC SSO** | Ready (pre-provisioned members) | configure → start → callback → session |
| **SAML SSO** | Ready (pre-provisioned members) | configure → metadata → start → signed callback → session |
| **Force-MFA** | Ready (password humans) | password product routes gated; **SSO sessions not gated** by Periscan MFA |
| **IdP group → role map** | Ready (claim mapping on SSO) | covered on OIDC login acceptance |
| **Inbound SCIM** | **NotConfigured** | all `/api/v1/scim/v2/*` → **HTTP 501**; Trust Safety mirrors; GTM refuse Production |
| **JIT membership** | **NotConfigured** | honesty only (SSO requires Active membership) |

## Forbidden claims

- SCIM **Production** / full IdP joiner-mover-leaver product
- Vendor SOC 2 **Type II** inventing (separate residual)
- Weakening SSO (unsigned assertion acceptance, open redirect, JIT without design)

## Acceptance tests (source of truth)

| File | Covers |
| ---- | ------ |
| `tests/acceptance/tenant-sso-config-flow.test.ts` | OIDC + SAML **configure**, secret safety, OIDC authorization-url, SAML **metadata**, SAML start + invalid callback |
| `tests/acceptance/tenant-sso-login-flow.test.ts` | OIDC live code exchange → session + SSO enforce; role claim map; **SAML signed success → session**; **force-MFA password gate vs SSO unrestricted** |
| `tests/acceptance/scim-inbound-honesty-flow.test.ts` | All SCIM discovery + Users/Groups paths × verbs **501** consistent; Trust Safety `identityProvisioning`; claim refuse catalog |
| `tests/acceptance/helpers/saml-idp-fixture.ts` | Test-only signed IdP Response builder (not a product IdP) |

Supporting unit / UI honesty:

- `apps/api/src/mfa-policy.test.ts`, `apps/api/src/mfa-step-up.test.ts` — SSO out of force-MFA / step-up
- `apps/api/src/app.test.ts` — force-MFA password path; SCIM 501 + trust-safety Partial plane
- `packages/shared/src/domain.ts` → `buildIdentityProvisioningHonesty()`
- `packages/shared/src/claim-deny-list.ts` → `scim-production-inbound`
- `apps/web/src/components/trust-safety-dashboard.tsx` — Partial plane badge; SCIM/JIT NotConfigured
- `apps/web/src/components/admin-console.tsx` — identity lifecycle honesty panel

## Operator journey (manual smoke)

### OIDC

1. Admin: `PUT /api/v1/tenants/current/sso` with OIDC endpoints, client secret, domain allowlist, `enabled: true`.
2. Optional: `GET .../sso/authorization-url` (OIDC only) with state/nonce.
3. Public: `POST /api/v1/auth/sso/start` → IdP authorize URL.
4. IdP redirects: `GET /api/v1/auth/sso/callback?code&state` → session cookie + `/api/v1/me`.
5. Member must already be Active (invite). Unprovisioned emails fail closed.

### SAML

1. Admin: `PUT .../sso` with `providerType: "SAML"`, IdP certificate PEM, ACS `redirectUri`.
2. Admin: `GET .../sso/metadata` → SP EntityDescriptor for IdP registration.
3. Public: `POST /api/v1/auth/sso/start` → IdP URL with `SAMLRequest` + `RelayState`.
4. IdP POSTs signed Response: `POST /api/v1/auth/sso/callback` (`SAMLResponse`, `RelayState`).
5. Session cookie for pre-provisioned member; state replay fails (`sso_state_invalid`).

### Force-MFA

1. `PUT /api/v1/tenants/current/security-settings/require-mfa` `{ "enabled": true }` **or** `PERISCAN_REQUIRE_MFA=true`.
2. Password session without MFA: `/api/v1/scopes` → `403 mfa_enrollment_required`; `/api/v1/me` + MFA enroll/verify still allowed.
3. SSO session for same user: product routes allowed without Periscan TOTP (IdP owns second factor).

### SCIM honesty (no enablement)

1. Probe any of:
   - `/api/v1/scim/v2/ServiceProviderConfig`
   - `/api/v1/scim/v2/ResourceTypes`
   - `/api/v1/scim/v2/Schemas`
   - `/api/v1/scim/v2/Users` (+ `/:id`)
   - `/api/v1/scim/v2/Groups` (+ `/:id`)
2. Expect **501**, `statusName: "NotConfigured"`, SCIM error schema, order-form + residual doc pointers.
3. `GET /api/v1/tenants/current/trust-safety` → `identityProvisioning.planeStatus = "Partial"`, `scimInbound.status = "NotConfigured"`, discovery path matches stub.
4. Sales path: paste SLA from `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` into order form annex.

## Why no feature-flagged SCIM Users list

A partial inbound Users GET that looks “live” would invite IdP pointing and Production RFP language. Residual policy (`docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md`) forbids incomplete SCIM scaffolds as live IdP servers. Honesty product = **consistent 501** until a fully correct membership lifecycle ships with acceptance tests.

## How to run

```bash
export PERISCAN_POSTGRES_PUBLISHED_PORT=5434
docker compose -f infra/docker-compose/docker-compose.yml up -d
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan

pnpm exec vitest run \
  tests/acceptance/tenant-sso-config-flow.test.ts \
  tests/acceptance/tenant-sso-login-flow.test.ts \
  tests/acceptance/scim-inbound-honesty-flow.test.ts \
  --testTimeout=60000

pnpm --filter @periscan/api exec vitest run src/mfa-policy.test.ts src/mfa-step-up.test.ts
pnpm --filter @periscan/shared exec vitest run src/domain.test.ts src/claim-deny-list.test.ts
```

## Related docs

- `docs/ENTERPRISE_IDENTITY_LIFECYCLE.md` — sales-assisted SLA + RFP language
- `docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md` — SCIM / Type II residual
- `docs/SSO_ROLE_CLAIM_MAPPING.md` — claim → role mapping
- `docs/trust/README.md` — trust pack index

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-31 | S4 closeout: SAML success acceptance + force-MFA SSO gate acceptance + SCIM multi-route 501 honesty E2E + discovery ResourceTypes/Schemas stubs + this QA doc. |
