# Periscan Production Readiness Checklist

This checklist tracks the first-customer readiness gates for the API-first Periscan build. It maps to the PRD requirements for verified scope, no destructive validation, tenant isolation, evidence-backed reporting, auditability, runner security, and release validation.

## Status Summary

| Area                                 | Status                      | Gate or Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth and tenant isolation            | Ready for first customer    | JWT HttpOnly session flow, tenant-scoped repositories, RBAC, cross-tenant evidence denial in `tests/security`, and API-first generic OIDC/SAML SSO configuration/login enforcement.                                                                                                                                                                                                                                                                                                     |
| Scope and validation safety          | Ready for first customer    | Verified scope required before Snapshot and validation execution; denied policy decisions do not queue jobs.                                                                                                                                                                                                                                                                                                                                                                            |
| External validation abuse prevention | Ready for first customer    | Safe template profile, verified domain matching, reserved/private target denial, rate limits, blocklist, kill switch.                                                                                                                                                                                                                                                                                                                                                                   |
| Evidence and redaction               | Ready for first customer    | Raw secret redaction and evidence tenant authorization covered by unit, acceptance, and security tests.                                                                                                                                                                                                                                                                                                                                                                                 |
| Runner control plane                 | Ready for first customer    | Outbound HTTPS signed-task polling, registration tokens, signed task envelopes, result/artifact receipt, rejection audit, credential rotation, local scope enforcement, kill switch, non-root Docker packaging, Docker Compose/Kubernetes/systemd deployment examples, runner deploy validation, and runner lab gates are implemented. CI pins the runner toolchain from `apps/runner/go.mod` (`go 1.22`), while local validation falls back to a Go 1.22 Docker toolchain when needed. |
| Integrations and OSS modules         | Ready for first customer    | API-driven connector manifests and grouped public-API acceptance cover currently connectable cloud, identity, code/DevSecOps, VM/EAP/ASM/CNAPP, SIEM/EDR/WAF/security-control, workflow, AI-provider/AI-stack, threat-intel, and other intelligence/compliance categories. OSS modules expose runtime readiness, policy metadata, fixture/live-readiness paths, certification, and fail-closed license inventory.                                                                       |
| Reports and evidence packs           | Ready for first customer    | Snapshot and evidence-pack reports are generated from normalized data with evidence IDs and redaction controls; HTML/PDF/export/share paths are API-backed, audited, and covered by tests.                                                                                                                                                                                                                                                                                              |
| CI and release validation            | Ready                       | GitHub Actions runs `pnpm verify`; local `pnpm verify` runs lint, typecheck, tests, build, OSS/license checks, fail-closed dependency audits, Prisma validation/migration deploy, Playwright E2E including axe WCAG A/AA route scans, security, and acceptance.                                                                                                                                                                                                                         |
| Dependency security audit            | Ready                       | `pnpm audit --prod` and `pnpm audit --audit-level high` return no known vulnerabilities after upgrading AWS SDK clients and enforcing pnpm overrides for patched `fast-xml-parser` and `postcss` versions.                                                                                                                                                                                                                                                                              |
| Observability and auditability       | Ready for first customer    | Security-relevant actions emit audit events for auth, scope, policy, mission, evidence, report, remediation, verification, runner, invite, role-change, SSO, report-share, and connector flows. Tenant admins can query persisted mission latency, policy denial, connector sync timing, and process metrics through API-backed operational-readiness/metrics endpoints.                                                                                                                |
| Reliability and backups              | API-visible deployment gate | Local Compose and migrations are ready; production backup/restore, object-store retention, monitoring, alert routing, and incident-contact settings are disclosed through the Trust & Safety API when configured.                                                                                                                                                                                                                                                                       |

## Customer trust pack

- Customer-facing security questionnaire answer bank and claim boundaries: `docs/trust/README.md` (pen-test residual, SLA/status honesty, MSSP isolation packaging, API-key scope ceilings, model-gateway advanced-safety stubs, board-pack measurement rules).
- In-product tenant isolation proof pack is **customer tenancy evidence**, not a Periscan SOC 2 Type II substitute.
- Independent platform pen-test and public status/SLA pages are **external / commercial gates** — documented residual, not product checkboxes.

## Auth and Tenant Isolation

- Use email/password with Argon2 password hashing and HttpOnly session cookies for MVP authentication.
- Require tenant context on every authenticated API route.
- Enforce **baseline multi-role RBAC** (six fixed roles: owner/admin/security-engineer/viewer and MSSP/client). Custom/ABAC roles are roadmap, not shipped.
- Session JWTs use HS256 with `kid`; production requires non-default `PERISCAN_JWT_SECRET` and purpose-split `PERISCAN_REPORT_SHARE_SECRET`.
- Support explicit tenant switching only for memberships the user owns.
- Support API-first tenant OIDC and SAML SSO configuration and login enforcement: tenant admins can create/read/disable SSO config; OIDC client secrets are encrypted and write-only; SAML IdP certificates are stored for verification and surfaced only as `samlIdpCertificateSet`; OIDC authorization URL generation is API-backed; SAML service-provider metadata is available at `/api/v1/tenants/current/sso/metadata`; public SSO start/callback flows validate OIDC tokens or SAML signed responses, enforce tenant email domains, and create sessions only for active provisioned tenant members; enforced-SSO tenants deny password login and non-SSO tenant switching; SSO configuration and login events are audited. Live customer use still requires an authorized IdP, redirect URI, credentials/certificates, and customer-specific claim mapping.
- Test gate: `tests/security/security-boundaries.test.ts` and `tests/acceptance/enterprise-foundation.test.ts`.

## Evidence and Data Protection

- Keep raw evidence separate from normalized evidence and primary UX.
- Redact secrets and token-like values before evidence, summaries, or reports expose them.
- Require tenant authorization for evidence detail, download, and redaction APIs.
- Include evidence IDs in conclusions, remediation, reports, and verification events.
- Deployment gate: configure encrypted S3-compatible storage, retention policy, and backup lifecycle.

## Validation Safety and Abuse Prevention

- Deny validation against unverified scope.
- Deny destructive actions, real data exfiltration, persistence, credential theft, and uncontrolled exploit chaining.
- Deny `Disallowed` and default-deny `AdvancedAdversarial` policy levels.
- Use only safe/passive external validation templates for the external point of attack.
- Enforce external validation tenant/global rate limits, reserved/private target denial (pre-resolve string check **and** post-resolve DNS), target blocklist, and admin kill switch.
- Test gate: `pnpm test:security`.

## Runner Security

- Prefer outbound HTTPS long-poll through customer firewalls.
- Do not use reverse SSH as the default customer runner control channel.
- Issue short-lived registration tokens.
- Sign runner tasks with tenant, runner, scope, module, expiry, and nonce.
- Reject unsigned, expired, mismatched-runner, or mismatched-scope tasks and audit rejections.
- Require runner mTLS fingerprint enforcement in production: set `PERISCAN_RUNNER_REQUIRE_MTLS=true` (compose and env templates default this; code also defaults on when `NODE_ENV=production` unless explicitly `false`). TLS terminator must forward the verified cert SHA-256 header.
- Deployment gate: build and sign the Go runner binary with Go 1.22+; CI installs the `apps/runner/go.mod` version before running `pnpm test:runner`.

## Integrations and OSS Tooling

- Expose connector and module capabilities through Periscan API manifests, not raw OSS branding in primary UX.
- Every connector must declare permissions, health behavior, signal categories, supported missions, and fixture strategy.
- Every module must declare safety level, required inputs, parser, evidence types, resource limits, and license metadata.
- Run `pnpm tools:check -- --phase=Current` before release.

## Observability and Auditability

- Audit auth, tenant, integration, scope, policy, mission, module, evidence, report, remediation, verification, runner, invitation, and role-change events.
- Preserve denial reasons for policy and external-validation guard outcomes.
- Expose tenant-scoped operational metrics for mission start latency, policy denial rates, and connector sync timing through the API, derived from persisted audit and tenant state.
- Deployment gate: configure production log aggregation, alerting, and incident-response contacts with non-secret descriptive values in `PERISCAN_LOG_AGGREGATION_TARGET`, `PERISCAN_ALERT_ROUTING_TARGET`, and `PERISCAN_INCIDENT_CONTACT`.

## Reliability, Backups, and Deployment

- Postgres is the primary database; migrations must pass `db:migrate:deploy`.
- Redis/BullMQ is the MVP queue; queue failures update mission/job/run status.
- MinIO is local-only; production should use encrypted S3-compatible storage.
- Deployment gate: define database backup cadence, restore test process, object storage retention, object backup policy, and Redis persistence expectations with non-secret descriptive values in `PERISCAN_DATABASE_BACKUP_CADENCE`, `PERISCAN_DATABASE_RESTORE_TESTED_AT`, `PERISCAN_OBJECT_STORAGE_RETENTION_DAYS`, `PERISCAN_OBJECT_STORAGE_BACKUP_POLICY`, and `PERISCAN_REDIS_PERSISTENCE_MODE`.

## Trust & Safety Operational Readiness API

The tenant Trust & Safety API includes an `operationalReadiness` block so customer reviewers can see which production controls are configured versus deployment-managed. Configure:

- `PERISCAN_DEPLOYMENT_ENVIRONMENT`
- `PERISCAN_DATABASE_BACKUP_CADENCE`
- `PERISCAN_DATABASE_RESTORE_TESTED_AT`
- `PERISCAN_OBJECT_STORAGE_RETENTION_DAYS`
- `PERISCAN_OBJECT_STORAGE_BACKUP_POLICY`
- `PERISCAN_REDIS_PERSISTENCE_MODE`
- `PERISCAN_LOG_AGGREGATION_TARGET`
- `PERISCAN_ALERT_ROUTING_TARGET`
- `PERISCAN_INCIDENT_CONTACT`

Values should be labels, cadences, dates, or contact aliases only. Do not store secrets, webhook URLs, API tokens, or credentials in these variables.

## Compliance Roadmap

- Maintain audit export support for customer reviews.
- Maintain evidence redaction and retention controls.
- Track OSS module licenses and flag AGPL/unknown tools for legal review through `pnpm licenses:check`.
- Prepare customer security review material from this checklist, `SECURITY_BOUNDARIES.md`, `RUNNER_ARCHITECTURE.md`, and `OPEN_SOURCE_POLICY.md`.

## Release Gates

Before first-customer onboarding:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm tools:check -- --phase=Current`
- `pnpm licenses:check`
- `pnpm test:license`
- `pnpm --filter @periscan/db db:validate`
- `pnpm --filter @periscan/db db:migrate:deploy`
- `pnpm test:e2e`
- `pnpm test:security`
- `pnpm test:acceptance`
- `pnpm verify`
  (P3 infra: acc/verify now robust to common 5432 port conflicts via PERISCAN_POSTGRES_PUBLISHED_PORT + early DB probes + guidance in verify.sh + acc tests + .env.example; see README/AGENTS for commands.)
