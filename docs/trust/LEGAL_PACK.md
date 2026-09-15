# Legal pack honesty (DPA / BAA / subprocessors)

**Status:** product surfaces disclose NotConfigured honestly; executed legal PDFs are deployment-supplied  
**Tickets:** P17-5 / #333  
**Audience:** enterprise legal / procurement + deploy operators

## Non-negotiable honesty

| Artifact | Product default | Meaning |
| -------- | --------------- | ------- |
| DPA reference URL | `NotConfigured` unless `PERISCAN_DPA_REFERENCE_URL=https://…` | No in-product click-wrap DPA until operators publish a versioned PDF |
| BAA reference URL | `NotConfigured` unless `PERISCAN_BAA_REFERENCE_URL=https://…` | Customer-specific BAA stays env-linked; do not infer HIPAA eligibility |
| Subprocessors list | `[]` → status **NotConfigured** | **Empty is not “none.”** Hosting stacks always have processors; disclosure must be filled for production |
| Vendor SOC 2 Type II | `None` unless `PERISCAN_VENDOR_SOC2_STATUS` | Separate from customer SOC 2 *support evidence* packs (see `VENDOR_COMPLIANCE.md`) |

## API / UI

- `GET /api/v1/tenants/current/trust-safety` → `dataGovernance.dpaStatus`, `baaStatus`, `subprocessorsStatus`, `subprocessorsHonesty`, `dataCategoriesProcessed`, `dataSubjectRequestProcess`
- Trust & Safety UI renders badges and refuses empty-list-as-none language

## Operator setup (before production customer data)

1. Publish versioned DPA PDF (or counsel-approved processing terms) and set `PERISCAN_DPA_REFERENCE_URL`.
2. If HIPAA is in scope, set `PERISCAN_BAA_REFERENCE_URL` to the customer-specific BAA.
3. Set `PERISCAN_SUBPROCESSORS_JSON` to the live stack, for example:

```json
[
  {
    "name": "Amazon Web Services",
    "purpose": "Control plane compute, managed database, object storage",
    "privacyUrl": "https://aws.amazon.com/privacy/"
  },
  {
    "name": "Example transactional email",
    "purpose": "Auth and invite email delivery",
    "privacyUrl": "https://example.com/privacy"
  }
]
```

4. Confirm data categories and deletion/export process text in Trust & Safety match the MSA annex.
5. Never ship production with empty subprocessors while claiming “no third parties.”

## Data categories (product default list)

Always disclosed in Trust & Safety (not optional marketing):

- Account identity (email, display name)
- Tenant membership and role assignments
- Authorized scope metadata and verification state
- Validation findings, attack paths, and remediation records
- Evidence metadata and redacted artifacts
- Integration configuration (credentials encrypted when keys configured)
- Security audit events

## Data subject requests

Default process is **sales-assisted** until a self-serve path ships: tenant owner ticket → export via product APIs/audit export → deletion per MSA/DPA. Self-serve GDPR click-through remains NotConfigured without a linked DPA.

## Related

- `docs/trust/README.md` — questionnaire kit
- `docs/trust/VENDOR_COMPLIANCE.md` — vendor SOC 2 status
- `.env.example` — `PERISCAN_DPA_REFERENCE_URL`, `PERISCAN_BAA_REFERENCE_URL`, `PERISCAN_SUBPROCESSORS_JSON`, `PERISCAN_VENDOR_SOC2_STATUS`
