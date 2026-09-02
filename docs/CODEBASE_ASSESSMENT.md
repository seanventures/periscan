# Periscan Codebase Assessment

Assessment date: 2026-06-03

## Current Stack

- Monorepo: `pnpm` workspace.
- Web app: Next.js App Router in `apps/web`.
- API: Fastify in `apps/api`.
- Worker: TypeScript worker in `apps/worker`.
- Runner: Go runner in `apps/runner`.
- Shared contracts: Zod schemas and TypeScript types in `packages/shared`.
- Database and ORM: Prisma with PostgreSQL in `packages/db`.
- Queue: BullMQ-compatible mission queue with Redis wiring in `apps/api` and `apps/worker`.
- Evidence storage: S3-compatible storage service in `packages/evidence`, with MinIO/Supabase-compatible environment aliases.
- Tests: Vitest, Playwright, Go tests, security tests, acceptance tests.
- CI: GitHub Actions at `.github/workflows/ci.yml`, running the repo verification gate.

## Package Manager

Use `pnpm@9.15.0`, declared in `package.json`.

## App Structure

- `apps/web`: Next.js UI that consumes API routes.
- `apps/api`: Fastify API, auth/session handling, route definitions, runtime services.
- `apps/worker`: module job execution and evidence persistence.
- `apps/runner`: outbound-only Go internal runner.
- `packages/shared`: public schemas, API constants, runner contracts, validation catalogs.
- `packages/db`: Prisma schema, migrations, seed/demo helpers, repository helpers.
- `packages/policy`: safety and external-validation policy.
- `packages/evidence`: evidence storage, graph, risk, path, remediation logic.
- `packages/connectors`: integration manifests and connector interfaces.
- `packages/modules`: validation modules and OSS toolchain catalog.
- `packages/reports`: evidence pack and report generation.
- `packages/operators`: operator recommendations and evidence-grounded summaries.

## Existing Auth Model

The API uses email/password signup and login with JWT session cookies. API requests resolve tenant context from the session and optional tenant header. RBAC is enforced in runtime services.

## Existing Database Model

Prisma models cover tenants, users, memberships, scopes, integrations, assets, identities, control sources, AI apps, exposures, missions, runs, signals, evidence artifacts, graph nodes/edges, attack paths, remediations, verification events, evidence packs, runners, schedules, billing, design-partner settings, and analyst notes.

## Existing API Pattern

Fastify routes are declared in `apps/api/src/app.ts`. Business logic lives mostly in `apps/api/src/runtime-services.ts`; shared Zod contracts live in `packages/shared`. Public API discovery is exposed through OpenAPI and `/api/v1/api-reference`.

## Existing Job/Queue Pattern

Mission start creates validation runs and jobs. Worker processing uses module manifests, policy decisions, module execution, evidence storage, signal normalization, and graph updates. Redis/BullMQ is the MVP queue target.

## Existing Storage Pattern

Evidence artifacts are persisted through `packages/evidence/src/storage.ts`. Metadata is stored in PostgreSQL, and artifact content is stored in S3-compatible storage or local in-memory test stores. Redaction and hashing are tested.

## Existing UI Conventions

The web app uses focused API-backed operational pages and components under `apps/web/src/components`. Public demo data is isolated and labeled. Product UI should not display mock metrics as real tenant state.

## Existing Test Commands

- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:e2e`
- `pnpm test:security`
- `pnpm test:acceptance`
- `pnpm test:runner`
- `pnpm verify`

## Existing CI Commands

CI runs `pnpm verify`, which includes lint, typecheck, unit/integration tests, builds, runner tests, runner local lab E2E, OSS readiness, license checks, Prisma validation/migration deploy, E2E, security tests, and acceptance tests.

## Existing Deployment Assumptions

Local dependencies use `infra/docker-compose/docker-compose.yml` for PostgreSQL, Redis, and MinIO. Production deployment must provide database URL, Redis URL, session secret, evidence storage settings, retention/backups, logging, alerting, and real integration credentials.

## Existing Security Patterns

- Tenant-scoped API services.
- Verified scope required before validation.
- Policy decisions before mission execution.
- External validation guardrails.
- Evidence redaction and tenant authorization.
- Runner signed tasks, local scope enforcement, credential rotation, scoped artifact upload, and local lab E2E.
- OSS license checks and legal-review blocking.
- Audit events for security-relevant actions.

## What Should Be Preserved

- Current monorepo structure.
- Fastify API and runtime-service boundary.
- Next.js web app as API consumer.
- Prisma/PostgreSQL data layer.
- Existing Zod shared schemas.
- Existing policy/evidence/modules/connectors/reports packages.
- Runner outbound-long-poll, signed-task, scoped artifact upload, and local lab design.
- Verification script and CI gate.

## What Should Not Be Changed Without Approval

- Auth/session model.
- Prisma schema ownership and migration strategy.
- API route naming under `/api/v1`.
- Evidence redaction/storage boundaries.
- Runner transport model.
- OSS license/legal-review policy.
- Existing proof-loop acceptance and security tests.

## PRD Coverage And External Prerequisites

- Threat Center manual import, API routes, Prisma persistence, missing-signal domain objects, non-executing validation plans, readiness reports, HTML/PDF readiness report export, API-backed web navigation, public super-feed ingestion, CISA KEV import, tenant schedules, and feed-alert correlation are implemented. Commercial/private feed onboarding remains a customer/business decision.
- MSSP client portfolio support is implemented as an API-derived parent dashboard with child tenant readiness, coverage, risk, usage, branding, and latest activity summaries.
- Executive trends and remediation velocity are implemented as an API-derived tenant summary from validated findings, remediations, verification events, evidence packs, scopes, and integrations.
- Missing-signal intelligence is first-class for Threat Center, signal-driven trigger readiness, validated finding confidence impact, and executive trends; signal-trigger approval remains intentionally policy-gated and creates reviewable draft missions only.
- Signal-driven trigger rules and API evaluation exist for CVE, asset, policy, and missed-detection events; approval creates draft missions without queueing execution and returns tenant routing readiness for connected workflow destinations.
- Detection-rule validation now has an API-first rule-coverage model for dry-run scenarios, observed behaviors, evidence IDs, stale coverage, logged-only gaps, and tuning recommendations.
- GitHub PAT metadata sync, GitLab PAT metadata sync, Bitbucket Cloud app-password/API-token repository metadata sync, Azure DevOps PAT repository/policy metadata sync, Buildkite API-token pipeline/repository-link metadata sync, CircleCI API-token pipeline/repository-link metadata sync, Jenkins API-token job/build-status metadata sync, Docker Hub repository/tag metadata sync, GitHub Container Registry package/version metadata sync, AWS ECR repository/image metadata sync, Tenable Workbenches asset/vulnerability summary sync, Rapid7 InsightVM asset/vulnerability summary sync, Wiz CNAPP cloud-resource/security issue summary sync, Prisma Cloud alert/resource summary sync, Qualys VMDR host/detection summary sync, runZero Export API asset inventory sync, AbuseIPDB APIv2 IP reputation checks, VirusTotal API v3 IoC search, GreyNoise Community API IP context, Microsoft Entra ID app-only Graph read-only identity inventory, Microsoft Defender for Office 365 Graph read-only email-security alert/incident observation, Okta API-token read-only identity inventory, Google Workspace Admin Directory read-only identity inventory, AWS static read-only inventory plus STS AssumeRole auth, Azure service-principal read-only subscription/resource/NSG inventory, Azure Front Door WAF read-only policy posture sync, Google Cloud access-token read-only project/resource/firewall inventory, Kubernetes service-account token read-only namespace/workload/service/network-policy inventory, Cloudflare API-token read-only edge/WAF sync, AWS WAFv2 read-only web ACL posture sync, OpenAI API-key read-only model inventory, Anthropic API-key read-only model inventory, Azure OpenAI API-key read-only deployment inventory, Azure AI Search API-key read-only index/service-stat inventory, Chroma API-key read-only collection metadata inventory, Lakera Guard read-only project/policy metadata inventory, AWS Bedrock read-only foundation model inventory, Jira Cloud API-token workflow delivery, GitHub Issues PAT workflow delivery, Linear API-key workflow delivery, PagerDuty Events API workflow delivery, Opsgenie API-key workflow delivery, ServiceNow Table API workflow delivery, ConnectWise Manage API-key PSA/ticket sync and workflow delivery, NinjaOne access-token RMM device/alert sync, HaloPSA OAuth client/ticket sync and workflow delivery, Autotask REST company/ticket sync and workflow delivery, Syncro API-token customer/asset/ticket sync and workflow delivery, N-able N-central API-token/JWT customer/device/active-issue sync, Slack incoming-webhook workflow delivery, Microsoft Teams incoming-webhook workflow delivery, Splunk API-token read-only SIEM observation, Elastic Security API-key read-only SIEM observation, Datadog Cloud SIEM API-key read-only SIEM observation, Microsoft Sentinel OAuth read-only SIEM observation, Sumo Logic Access ID/Access Key read-only SIEM observation, Rapid7 InsightIDR API-key read-only SIEM observation, IBM QRadar SEC-token read-only SIEM observation, Microsoft Defender XDR OAuth read-only Advanced Hunting EDR observation, SentinelOne API-token read-only EDR observation, Carbon Black API-key read-only EDR observation, and CrowdStrike Falcon OAuth read-only EDR observation are implemented with fixture-backed/mocked-live tests; remaining real customer connectors require credentials and setup, and planned integrations must remain non-connectable.
- Sophos Central Service Principal ReadOnly EDR observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer Sophos Central API credentials, tenant/data-region context, and authorized endpoint alert scope.
- Trend Vision One API-token Workbench alert observation is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer API token with Workbench view/filter/search access and authorized EDR/XDR scope.
- Palo Alto Networks Cortex XDR standard API-key incident observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer Cortex XDR API credentials, tenant API FQDN, and authorized endpoint incident scope.
- Fastly Next-Gen WAF API-token site-event observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer Fastly WAF API credentials, corp/site context, and authorized WAF event scope.
- Akamai Kona/App & API Protector EdgeGrid SIEM security-event observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer Akamai EdgeGrid credentials, SIEM configuration ID, and authorized WAF event scope.
- Imperva Cloud WAF API-key protected-site and WAF-rule posture observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer Imperva API credentials and authorized Cloud WAF scope.
- Palo Alto Networks Panorama/PAN-OS API-key firewall log observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer PAN-OS API credentials, Panorama/firewall API base URL, and authorized traffic/threat/URL/WildFire log scope.
- Fortinet FortiGate/FortiOS API-token firewall policy monitor observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer FortiOS API credentials, FortiGate API base URL, authorized monitor/firewall policy read access, and authorized VDOM/scope.
- Zscaler Internet Access OAuth read-only firewall filtering policy observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer ZIA OAuth client credentials, API base URL, token URL, and authorized firewall policy API role/scope.
- Proofpoint TAP SIEM API read-only email-security event observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer TAP SIEM API service principal/secret, authorized Threat Insight scope, and a one-hour-or-less `sinceSeconds` query window.
- Google Gmail Security read-only Alert Center phishing/malware alert observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer OAuth access with Alert Center read-only permissions.
- Mimecast SIEM API read-only email-security MTA log observation is implemented with fixture-backed/mocked-live tests; live tenant use requires customer Mimecast API application credentials, the account-specific API base URL, Enhanced Logging, and `Gateway | Tracking | Read` permission.
- Abnormal Security Threats API read-only email-security threat-log observation is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer Abnormal Security API token and Threats API read access.
- Google Security Operations OAuth read-only Chronicle API UDM search observation is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer-approved OAuth token and authorized SecOps instance resource.
- Lacework/FortiCNAPP read-only host vulnerability observation sync is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer API token and host vulnerability observation read access.
- Orca Security read-only alert and cloud-asset summary sync is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer API token with viewer/read-only alert and asset visibility.
- Assetnote ASM read-only asset and exposure summary sync is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer API token with read-only asset and exposure visibility.
- Axonius CAASM read-only asset and adapter-coverage summary sync is implemented with fixture-backed/mocked-live tests; live tenant use requires customer API key/secret credentials with read-only asset visibility.
- Armis read-only asset, unmanaged-device, coverage-gap, exposure, and CVE summary sync is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer API token with read-only asset/device visibility.
- Cortex Xpanse read-only external attack-surface asset, service, exposure, risk, and CVE summary sync is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer API token with read-only asset and exposure visibility.
- DigitalOcean API-token read-only cloud inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer DigitalOcean API token and authorized account scope.
- Heroku Platform API-token read-only app inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer Heroku API token and authorized app scope.
- Databricks PAT read-only workspace metadata inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer Databricks workspace URL, personal access token, and authorized workspace scope.
- Snowflake SQL API read-only metadata inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer Snowflake account URL, OAuth access token, metadata-readable role, and authorized account scope.
- Cisco Duo Admin API read-only identity/MFA inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer Duo Admin API integration key/secret with read-resource permissions and authorized scope.
- OneLogin OAuth read-only identity inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires customer OneLogin OAuth API credentials with read-only user, role, and app scopes.
- PingOne OAuth read-only identity inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer PingOne Worker application with read-only user, group, and application access.
- Auth0 Management API read-only identity inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer Auth0 machine-to-machine application with read-only Management API user, role, and client scopes.
- JumpCloud Admin API-key read-only identity inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires customer JumpCloud Admin API key access with read-only users, user groups, and applications permissions.
- CyberArk Identity SCIM read-only identity inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires customer CyberArk Identity SCIM bearer-token access with read-only users and groups permissions.
- Active Directory LDAP/LDAPS read-only identity inventory is implemented with fixture-backed and mocked-live tests; live tenant use requires customer internal network or runner access plus a read-only bind account scoped to an approved base DN.
- Google Vertex AI read-only endpoint and Model Garden inventory is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer Google OAuth access token with read-only Vertex AI list permissions.
- Pinecone read-only vector index inventory is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer Pinecone API key with control-plane index-list permissions.
- Weaviate read-only REST schema and metadata inventory is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer Weaviate API key with schema/meta read permissions.
- Azure AI Search read-only index definition and service-stat inventory is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer Azure AI Search API key with index/service-stat read access.
- Chroma read-only collection list/count inventory is implemented with fixture-backed/mocked-live tests; live tenant use requires a customer Chroma API key with collection metadata read access.
- LangChain configuration-import application metadata inventory is implemented with fixture-backed/non-mock tests; tenant use requires customer-supplied component metadata and does not execute chains, agents, tools, callbacks, retrievers, vector stores, embeddings, or models.
- LlamaIndex configuration-import application metadata inventory is implemented with fixture-backed/non-mock tests; tenant use requires customer-supplied component metadata and does not execute query engines, retrievers, agents, tools, workflows, vector stores, embeddings, or models.
- Guardrails AI configuration-import metadata inventory is implemented with fixture-backed/non-mock tests; tenant use requires customer-supplied guard/validator/policy metadata and does not execute guards, validators, RAIL specs, server endpoints, prompts, LLMs, or models. Lakera Guard read-only project/policy metadata inventory is implemented with fixture-backed/mocked-live tests; tenant use requires customer API-key credentials and configured project/policy IDs, and does not call `/guard`, `/guard/results`, submit prompts/outputs, or fetch runtime screening results.
- AlienVault OTX read-only indicator detail sync is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer OTX API key and configured indicators.
- Recorded Future read-only vulnerability search and entity-match enrichment is implemented with fixture-backed and mocked-live tests; live tenant use requires a customer Recorded Future API token and configured CVEs or entity names.
- Mandiant Advantage read-only API v4 enrichment is implemented with fixture-backed and mocked-live tests; live tenant use requires customer Key ID/Secret ID credentials and configured IoCs, CVEs, or threat actor names.
- Live control validation remains intentionally disabled until approved internal-runner workflows exist.
- Broader customer-specific local lab targets should be added during onboarding, but the repo now includes a deterministic loopback runner lab gate.

## Customer Onboarding And Expansion Guidance

1. Preserve the existing API-first architecture and add new shared contracts only where a future PRD delta requires them.
2. Convert any future PRD delta into traceable shared schemas and API contracts before UI work.
3. Add customer-specific workflow delivery only after Jira, ServiceNow, ConnectWise Manage, HaloPSA, Autotask, Syncro, Slack, or equivalent customer workflow credentials are configured during onboarding; N-able N-central remains read-only inventory/control-observation context and does not provide workflow ticket creation.
4. Keep future UI empty states honest: show `Not configured`, `Requires integration`, `Requires verified scope`, `Requires internal runner`, `Requires approval`, or an explicit unavailable-state reason instead of sample data.
5. Add customer-specific local lab fixtures during onboarding without presenting fake tenant results.
