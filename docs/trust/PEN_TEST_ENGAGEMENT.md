# External control-plane pen test engagement checklist

**Status:** process durable — **no independent platform pen test completed in-repo**  
**Tickets:** P13-13 / #271  
**Real-first:** no fabricated pen-test PDFs, executive summaries, or “clean” claims

## Honesty banner

Periscan’s security posture (tenant isolation matrix, SAST, result signing, threat
model, policy PEP) is **engineering evidence**, not a substitute for an
independent external pen test of the control plane.

Until a real engagement finishes and criticals are remediated:

- Trust pack answers: pen test is an **external assurance gate under NDA**.  
- Do not mark Wave/MQ security dimensions as fully external-validated.  
- Do not attach fictional reports to RFP responses.

## Scope (recommended)

| In scope | Out of scope (unless contracted) |
| -------- | -------------------------------- |
| SaaS control plane APIs (auth, tenant, missions, evidence, reports) | Customer runner hosts without written authorization |
| Web app auth/session, RBAC, tenant switcher | Live Atomic / Caldera / SharpHound destructive modules (disabled) |
| Multi-tenant isolation / IDOR | Third-party CNAPP/RBVM vendors |
| Runner task envelope / result signature verification surfaces | Production card payment (NotConfigured) |
| Report share tokens, evidence export paths | Social engineering of customers |

## Engagement checklist (ops)

1. [ ] Select independent firm (no product team self-test as “external”).  
2. [ ] SOW: control-plane + web + isolation; exclude hard-disabled offensive live.  
3. [ ] Staging or dedicated pen-test environment with production-like auth.  
4. [ ] Rules of engagement + emergency kill switch contacts.  
5. [ ] Data handling: no real customer evidence in pen-test tenant.  
6. [ ] Receive draft report; triage critical/high.  
7. [ ] Remediate or accept risk with written owner.  
8. [ ] Publish **NDA-gated summary** for diligence (not public marketing).  
9. [ ] Attach summary pointer in trust pack SE checklist when real.  
10. [ ] Schedule retest for residual criticals.

## What to send buyers today (no pen test yet)

- `docs/trust/README.md` questionnaire kit  
- Tenant isolation proof (their tenant post-trial)  
- `SECURITY_BOUNDARIES.md` + `docs/THREAT_MODEL.md`  
- Honest statement: independent pen test not yet completed / available under NDA when ready  

## Related

- [`README.md`](./README.md)  
- [`VENDOR_COMPLIANCE.md`](./VENDOR_COMPLIANCE.md)  
- [`../ANALYST_READINESS_ASSESSMENT.md`](../ANALYST_READINESS_ASSESSMENT.md)  
- [`../../SECURITY_BOUNDARIES.md`](../../SECURITY_BOUNDARIES.md)  

## Change log

| Date | Change |
| ---- | ------ |
| 2026-07-29 | Engagement checklist only. Explicit zero completed pen-test claim. |
