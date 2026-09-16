# Production Readiness

This document summarizes repository readiness. Deployment-specific settings still need environment configuration and customer credentials.

## Ready In Repo

- API-first product surface.
- Tenant isolation and RBAC tests.
- API-first tenant OIDC/SAML SSO configuration and generic SSO login enforcement with encrypted write-only OIDC client secrets, write-only SAML IdP certificate handling, sanitized reads, OIDC authorization URL generation, SAML service-provider metadata, public start/callback routes, JWKS/issuer/audience/nonce/email-domain validation for OIDC, signed-response/request-correlation validation for SAML, enforced-password-login denial, and audit events.
- Verified-scope policy gates.
- Evidence redaction, hashing, and authorization tests.
- Report generation from normalized evidence.
- Runner signed-task and local scope enforcement tests.
- Runner credential rotation audit and identity-mismatch tests.
- Non-root runner Docker packaging plus Docker Compose, Kubernetes, and systemd deployment examples.
- Runner artifact upload through scoped URLs with hash/size enforcement.
- Runner local lab E2E gate in `pnpm verify`.
- Runner deployment artifact validation in `pnpm verify`.
- OSS runtime readiness and license checks.
- CI gate through `pnpm verify`.
- Browser route accessibility gate through Playwright axe WCAG A/AA checks in `pnpm verify`.
- Trust and safety API surface.
- (P3) DB/acc/verify infra reliability: compose port override, actionable guidance on local Postgres port conflicts, early probes in tests + verify.sh (GAP-P3-VERIFY-DB-01 closed).
- Billing meter foundation.
- API-derived MSSP client portfolio dashboard.

## Enterprise Topology Honesty (P10-5 / P10-6 / P10-7)

These items are **documented limits**, not silent readiness:

- **Fleet scale / HA (P10-5):** Heartbeat-derived fleet health and sealed policy exist. The product does **not** claim production soak, multi-node failure qualification, or 10k concurrent runners. Publish soak numbers before commercial capacity guarantees.
- **Production deploy / IaC (P10-6):** `infra/production/docker-compose.prod.yml` is a single-replica reference. Terraform under `infra/terraform` is fixture/provider scaffold, not a vendor multi-AZ topology. No Helm chart is shipped yet — platform teams must bring managed Postgres/Redis/S3.
- **Air-gap / on-prem MCP (P10-7):** Hybrid SaaS + outbound runner is the shippable product. Air-gapped Managed Control Plane packaging is **roadmap**, not GA. Ansible/Terraform RemOps modules are planning fixtures, not offline MCP.

## Dual Runner Packaging (P10-2 / P10-12)

- Go runner deploy examples: `apps/runner/deploy/`
- Runner-agent (measured/AgentLocal) deploy examples: `apps/runner-agent/deploy/`
- **WindowsService** deployment mode is **Planned** (enum wire-compat only; no MSI)
- **ServiceViaProxy** run mode is **NotAvailable** as a product channel (local SOCKS SEAM only)
- Commercial mid-tier package: **Hybrid Runner** (`HybridRunner` billing key) with RunnerMinutes; payment processor remains `NotConfigured`

## Integration Breadth Honesty (P10-8 / P10-9)

Catalog size is not GA depth. Prefer contract-tested + live-smoke connectors for RFP claims. Cisco stack GA depth order: Duo contract test → Umbrella (keep) → Secure Endpoint → Secure Firewall — do not expand Meraki/DNA until top-N are deep.

## Deployment-Managed

- Database backups and restore tests.
- Redis persistence policy.
- Object-store retention, encryption, and backup policy.
- Log aggregation.
- Alert routing.
- Incident contact and escalation path.
- Production domain, TLS, cookie settings, and direct-browser API CORS allowlist
  if an external UI will call the API from a browser.
- Customer-specific integration credentials.

## First-Customer Checklist

1. Set production `DATABASE_URL`, Redis URL, session secret, dedicated integration/model credential encryption keys, public report-share signing secret, public HTTPS `PERISCAN_WEB_BASE_URL`, transactional email transport (`smtp` or explicit `noop`, never `console`), sender address and SMTP host when `PERISCAN_EMAIL_TRANSPORT=smtp`, direct-browser API CORS origins when an external browser UI is used, complete evidence storage variables (`PERISCAN_EVIDENCE_S3_ENDPOINT`, bucket, access key ID, and secret key, or equivalent Supabase aliases), and `PERISCAN_RUNNER_REQUIRE_MTLS=true` (required production runner posture; code also defaults on when `NODE_ENV=production` unless explicitly `false`; TLS terminator must forward the verified runner client-cert SHA-256 header).
2. Run Prisma migrations.
3. Configure object-store retention and backups.
4. Configure logging and alert routing.
5. Register least-privilege GitHub/AWS/Jira credentials for the customer.
6. Verify at least one customer scope.
7. Run `pnpm verify` before release.
8. Run a local lab validation before touching customer targets.
9. Confirm Trust & Safety page shows configured operational controls.
10. Review generated report for evidence IDs and absence of raw secrets.

## Deployment-Managed and Explicitly Out-of-Scope Items

- Threat Center manual import, API persistence, readiness planning, missing signals, and HTML/PDF readiness exports are implemented. External feed ingestion is also implemented: the CISA KEV feed is fetched (SSRF-guarded), normalized, and idempotently imported via `ingestThreatFeed`, with per-tenant recurring scheduling (`setThreatFeedSchedule`) and continuous sweep-driven `runDueThreatFeedIngestion` (tested in `apps/api/src/threat-feeds.test.ts`, `app.test.ts`, and the `threat-feed-ingestion-flow` / `threat-feed-schedule-flow` acceptance suites).
- Missing-signal intelligence is first-class for Threat Center and signal-trigger readiness evaluation; triggered validation execution remains policy-gated and requires explicit approval.
- Public threat-feed ingestion is implemented through the global super-feed registry with CISA KEV, NVD, EPSS, Tor exit nodes, OpenPhish, ThreatFox, Feodo Tracker, URLhaus, MalwareBazaar, AlienVault OTX, Emerging Threats compromised IPs, blocklist.de, and CISA advisories. Commercial/private feed onboarding remains a customer/business decision.
- Live BAS execution remains policy-blocked by default; any customer use requires an explicitly approved runner workflow, verified scope, approved window, and non-destructive scenario.
- Payment processing is intentionally out of scope for this phase. The implemented billing surface is the PRD-specified metering/package foundation with `paymentProcessorStatus: NotConfigured` and no exact price, checkout, payment-intent, or amount fields.
- Generic OIDC and SAML callback handling plus enforced SSO login policy are implemented. Remaining enterprise SSO deployment work is customer IdP setup, redirect URI/client credentials or certificates, and customer-specific claim conventions.
- **Inbound SCIM 2.0 provisioning of Periscan users and groups is not shipped.** Trust & Safety and Admin surfaces report `identityProvisioning.scimInbound.status: NotConfigured`. Discovery stubs under `/api/v1/scim/v2/*` return HTTP 501 with an honest NotConfigured body (and audit `policy.decision` / `inbound_scim_not_configured` when authenticated). Do not answer RFP SCIM questions as supported. CyberArk Identity SCIM is a separate **read-only external identity inventory** connector and does not provision Periscan memberships. Advanced custom-role RBAC is likewise not shipped (`BaselineRolesOnly`).

## P2 Readiness Audit Note (final-polish)

Root [PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md) contains the full item-by-item security, reliability, performance, UX, and operations audit with `.ai` review, test, and verification evidence. This docs copy is a summary; cross-reference the root checklist for the release gates. P2 polish is consolidated, all P1 blockers are closed, and the current `pnpm verify` gate is green.

Primary-route browser accessibility is gated through Playwright axe WCAG A/AA scans in `pnpm verify` (`tests/e2e/web-accessibility.spec.ts`). Dependency audit is currently clean: `pnpm audit --prod` and `pnpm audit --audit-level high` report no known vulnerabilities after the AWS SDK client refresh and pnpm security overrides for patched `fast-xml-parser` and `postcss`.
