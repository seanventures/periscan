# External control-plane pen test process (P13-13)

**Status:** Process and packaging — not a completed pen-test certificate.  
**Audience:** Trust / SE / procurement under NDA.  
**Honesty:** An independent assessment of control plane + runner is still required before claiming external security diligence is closed. Product mTLS defaults do **not** replace a pen test.

## 1. Scope of engagement

| Surface | In scope | Out of scope (unless contracted) |
|---------|----------|----------------------------------|
| Control-plane API (`apps/api`) authn/authz, tenancy, policy gates | Yes | Destructive live exploitation against customer assets |
| Web session / CSRF / cookie model | Yes | Social engineering of customers |
| Runner registration, task poll, artifact upload, result signing | Yes | Customer on-prem networks beyond the runner host |
| Evidence store integrity APIs | Yes | Physical data-center assessment |
| Postgres RLS / tenant isolation proof paths | Yes | Cloud provider shared-responsibility layers |

Safety floor always applies: no uncontrolled exploit chaining, no credential theft tooling delivery, no unauthorized scope.

## 2. Prerequisites before kickoff

1. Freeze a release candidate build and commit SHA for the engagement window.
2. Production posture checklist:
   - `NODE_ENV=production`
   - Runner mTLS fingerprint enforcement default-on (`shouldRequireRunnerMtls()` / `PERISCAN_RUNNER_REQUIRE_MTLS` unset or `true`)
   - Session secrets, evidence encryption keys, and integration credential keys set
3. Provide isolated lab tenant(s) with synthetic authorized scope only.
4. Provide NDA + rules of engagement + emergency contact.

## 3. Engagement package (what we give the firm)

- Architecture: `ARCHITECTURE.md`, `docs/RUNNER_SPEC.md`, `RUNNER_ARCHITECTURE.md`
- Threat model: `docs/THREAT_MODEL.md`
- Safety floor: `SECURITY_BOUNDARIES.md`
- Trust pack: `docs/trust/README.md`
- Known residuals: enterprise identity SCIM/JIT incomplete; audit SIEM stream is pull-export; payment processor NotConfigured

## 4. Executive summary process (for buyer NDA diligence)

After the firm delivers findings:

1. **Triage** within 10 business days: Critical/High owned with fix plan; Medium/Low scheduled.
2. **Remediation** tracked as product work with verification evidence (tests or retest notes).
3. **Executive summary (1–3 pages)** under NDA for prospects:
   - Engagement dates, firm, build SHA, scope
   - Count of Critical/High/Medium/Low at delivery and at retest
   - Open residuals with honest residual language
   - Explicit statement that summary is not a certification
4. **Do not** publish full reports publicly. Do not claim “pen-tested” without a dated summary available under NDA.

## 5. Product gates already closed vs still external

| Gate | Product status |
|------|----------------|
| Runner mTLS default-on in production | Implemented (`shouldRequireRunnerMtls`) |
| Ed25519 signed tasks + result provenance | Implemented |
| Denied tasks never queued | Implemented (policy dual-gate) |
| Tenant isolation proof pack | In-product evidence for *customer* tenancy |
| Independent pen test of control plane + runner | **External commission required** |
| Public executive summary under NDA process | **This document** — execute when firm engaged |

## 6. Commission checklist

- [ ] Select independent firm with SaaS multi-tenant + mTLS experience
- [ ] Contract scope matching §1
- [ ] Lab environment + credentials
- [ ] Kickoff + mid-point + close-out
- [ ] Remediation + retest window
- [ ] NDA executive summary template filled
- [ ] Trust pack §4 checklist updated with summary availability date

## 7. Claims we refuse until retest closes

- “Independently pen-tested and clean” without dated summary + residual list  
- “Bank-grade certified” or any certification substitution  
- Equating internal isolation matrices with third-party assessment  

Parent finding: P13-13 / synthesis U-20.
