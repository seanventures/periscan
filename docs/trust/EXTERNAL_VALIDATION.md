# External ops & security validation (P12-15)

**Audience:** design partners, enterprise InfoSec, MQ / Wave diligence  
**Honesty rule:** Process and product controls are real; independent pen-test
*results* and multi-tenant soak *reports* are attached only when they exist under
NDA — never invented in this repository.

Related trust pack: [`README.md`](./README.md)

---

## 1. Why this exists

Gartner Ability-to-Execute and enterprise RFPs ask for:

1. Independent control-plane + runner security validation  
2. Production runner trust (mTLS default-on)  
3. Multi-tenant operational evidence (soak / isolation)

Feature depth alone does not close Leaders-band Execute.

---

## 2. Independent pen-test summary process

| Step | Owner | Output |
|------|-------|--------|
| 1. Scope control plane + runner agents (outbound HTTPS signed-task polling, policy PEP, evidence store, auth/session) | Security eng | SOW against `docs/THREAT_MODEL.md` + `SECURITY_BOUNDARIES.md` |
| 2. Engage independent firm (or design-partner red team under NDA) | Founder / security | Engagement letter |
| 3. Execute against non-prod + authorized prod-like staging | Firm | Findings + remediations |
| 4. Publish **summary** (not full report) for design-partner trust pack | Security | 1–2 page residual map: fixed / accepted / deferred |
| 5. Attach under NDA to design-partner workspace | SE / founder | Link in Trust & Safety operational readiness |

**Current honest status:** independent platform pen-test is an **external assurance
gate**. Product questionnaires answer “request under NDA; not a product checkbox”
until a real summary is filed. See `docs/trust/README.md` § Pen test.

**Do not claim:** “SOC 2 / pen-test certified via UI packs.”

---

## 3. mTLS default-on for production runners

| Control | Truth |
|---------|--------|
| Runner transport | Outbound HTTPS signed-task polling (not inbound management plane) |
| Task integrity | Ed25519 task envelopes; mandatory result signing |
| mTLS fingerprint | **Default-on in production** deployments (`docs/RUNNER_SPEC.md`, `RUNNER_ARCHITECTURE.md`) |
| Fail-closed | Invalid / missing result signatures reject the result |

Operator checklist before design-partner production runners:

1. Production deploy uses TLS + mTLS fingerprint enforcement  
2. Signing keys rotated per tenant  
3. Audit events capture lease / complete / reject reasons  

---

## 4. Multi-tenant soak report (one attachable artifact)

Produce **one** design-partner-facing soak report (even if short) that covers:

| Probe | Pass criteria |
|-------|---------------|
| Parent/child tenant isolation | No cross-tenant read of findings/evidence/audit |
| Concurrent missions | Policy Denied still never queued under load |
| Runner fleet | Signature verification rate remains high; no unsigned accept |
| RLS write backstop | App-layer `tenantId` + Postgres RLS write-path still holds |

**Honest status:** isolation proof pack exists in-product
(`/api/v1/reports/tenant-isolation-proof`). A formal multi-tenant soak report is
a **deployment artifact** — attach when run, label date/environment, never
fabricate pass rates.

Template metadata (fill when real):

```text
Soak ID: <uuid>
Environment: <staging|prod-like>
Window: <start>–<end>
Tenants exercised: <n parent / n child>
Signature verification rate: <from honestyTrust>
Denied-never-queued count: <from honestyTrust>
Residual findings: <link or none>
```

---

## 5. Attach to design-partner trust pack

Checklist for SE before partner go-live:

- [ ] This process doc  
- [ ] Latest pen-test **summary** under NDA (or explicit “Not yet executed”)  
- [ ] mTLS production runner config confirmed  
- [ ] Isolation proof pack export for the partner tenant  
- [ ] Optional: multi-tenant soak report for the deploy  
- [ ] Executive honesty trust metrics (`honestyTrust` on executive trends)

---

## 6. Residual map

| Residual | Status | Close path |
|----------|--------|------------|
| Independent pen-test summary | Externally gated | Real engagement + NDA summary |
| Multi-tenant soak report | Deployment artifact | Run soak; attach date-stamped report |
| mTLS production default | Product/deploy contract | Confirm env; fail-closed signatures |
| Public SOC 2 Type II | Not claimed | Vendor assurance path outside product UI |

---

## Change log

| Date | Change |
|------|--------|
| 2026-07-29 | P12-15: pen-test process, mTLS default-on reminder, soak report template for design-partner trust pack. |
