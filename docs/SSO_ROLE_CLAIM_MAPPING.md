# SSO group / claim → role mapping

Periscan maps IdP group or role claims to tenant `MembershipRole` values on each
successful OIDC or SAML SSO login. This is **not** SCIM and does **not** create
users. Users must already be provisioned (invite/accept) with a tenant
membership; SSO only authenticates and optionally **syncs the membership role**
from claims.

## Configuration

Tenant admins set mapping fields on `PUT /api/v1/tenants/current/sso` (also in
**Settings → Single sign-on**):

| Field | Purpose |
| --- | --- |
| `roleClaimName` | OIDC claim or SAML attribute name (default at login: `groups`) |
| `roleMappings` | Array of `{ claimValue, role }` rules (max 64) |
| `defaultMappedRole` | Optional fallback role when no claim matches |

### Example

```json
{
  "providerType": "OIDC",
  "roleClaimName": "groups",
  "roleMappings": [
    { "claimValue": "periscan-owners", "role": "Owner" },
    { "claimValue": "periscan-admins", "role": "Admin" },
    { "claimValue": "periscan-engineers", "role": "SecurityEngineer" },
    { "claimValue": "periscan-viewers", "role": "Viewer" }
  ],
  "defaultMappedRole": "Viewer",
  "scopes": ["openid", "email", "profile", "groups"]
}
```

For Azure AD / Entra ID, set `roleClaimName` to the group claim you emit (for
example a short name `groups`, or a full URI claim when configured that way).
For SAML, use the attribute name your IdP puts in the assertion.

## Behavior

1. **Empty `roleMappings`** — mapping is **disabled**. The membership role stays
   whatever was set at invite / admin edit time.
2. **Non-empty `roleMappings`** — mapping is **enabled** (deny-by-default):
   - Read string or string-array values from the configured claim.
   - Match is case-insensitive on `claimValue`.
   - If several groups match, the **highest-privilege** role wins
     (`Owner` > `MSSPOwner` > `Admin` > `ClientAdmin` > `SecurityEngineer` > `Viewer`).
   - If none match and `defaultMappedRole` is set, that role is used.
   - If none match and no default, login fails with `sso_role_unmapped` (403).
3. **Last-owner protection** — SSO mapping cannot demote the last `Owner`. The
   login succeeds, the role stays `Owner`, and login audit metadata records
   `last_owner_protected`.
4. **Role changes** emit `role.changed` with `metadata.source = "sso_claim_mapping"`.
   Successful logins include a compact `roleMapping` summary on
   `sso.login_completed`.

## IdP setup notes

- OIDC: include the group claim in the **ID token** (or configure the IdP so
  groups appear on the verified ID token Periscan already consumes). Add the
  corresponding scope (often `groups`) to the tenant SSO scopes list.
- SAML: release the group attribute in the assertion Periscan validates.
- Pre-provision users (invite flow). Unprovisioned emails still fail with
  `sso_user_not_provisioned`.

## Out of scope

- Full SCIM 2.0 user lifecycle (create/disable/deprovision from the IdP)
- Just-in-time (JIT) user creation on first SSO
- Custom permission sets beyond the fixed `MembershipRole` enum

Those remain sales-assisted / roadmap items; this feature only closes the
group → role claim mapping gap for enterprise SSO.
