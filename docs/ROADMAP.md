# Roadmap

This roadmap fits the current codebase and keeps work incremental.

## Phase 0: Foundation

Status: Done for the first-customer surface.

- Monorepo, shared schemas, Prisma, Fastify API, Next.js UI.
- Auth, tenant/RBAC, scope verification, policy engine.
- Connector and module registries.
- Evidence storage, graph, reports, worker, runner contracts.

## Phase 1: Validation Snapshot

Status: Done for fixture/lab validation and first-customer onboarding; real customer runs need credentials and verified targets.

- Verified scope.
- GitHub/AWS/Azure/GCP/Kubernetes/domain-safe validation surfaces.
- Evidence-backed paths, remediations, reports, fix verification.
- Unified validated findings API.

## Phase 2: Real-First Connector Expansion

Status: Done for tested/API-first first-customer scope; live tenant use remains credential and customer-scope dependent. Third-party tool expansion now includes candidate intake, batch import, readiness summaries, implementation work orders, promotion packages, governance handoff, read-only promotion certification reports, and durable certification snapshot history before tenant use.

- GitHub PAT repository metadata sync is implemented.
- Bitbucket Cloud app-password/API-token repository metadata sync is implemented.
- Azure DevOps PAT repository and branch-policy metadata sync is implemented.
- Buildkite API-token pipeline and repository-link metadata sync is implemented.
- CircleCI API-token pipeline and repository-link metadata sync is implemented.
- Jenkins API-token job and last-build metadata sync is implemented.
- Docker Hub repository and tag metadata sync is implemented.
- GitHub Container Registry package, version, and tag metadata sync is implemented.
- AWS ECR repository, image digest, tag, scan-on-push, and tag-mutability metadata sync is implemented.
- Tenable Workbenches read-only asset and vulnerability summary sync is implemented.
- Rapid7 InsightVM read-only asset and vulnerability summary sync is implemented.
- Wiz CNAPP read-only cloud-resource and security issue summary sync is implemented.
- Prisma Cloud read-only alert and cloud-resource summary sync is implemented.
- Lacework/FortiCNAPP read-only host vulnerability observation sync is implemented.
- Orca Security read-only alert and cloud-asset summary sync is implemented.
- Qualys VMDR read-only host and detection summary sync is implemented.
- runZero Export API read-only asset inventory sync is implemented.
- Assetnote ASM read-only asset and exposure summary sync is implemented.
- Axonius CAASM read-only asset and adapter-coverage summary sync is implemented.
- Armis read-only asset, unmanaged-device, coverage-gap, exposure, and CVE summary sync is implemented.
- Cortex Xpanse read-only external attack-surface asset, service, exposure, risk, and CVE summary sync is implemented.
- AbuseIPDB APIv2 read-only IP reputation checks are implemented.
- VirusTotal API v3 read-only IoC search is implemented.
- GreyNoise Community API read-only IP context is implemented.
- AlienVault OTX read-only indicator detail sync is implemented.
- Recorded Future read-only vulnerability/entity enrichment is implemented.
- Mandiant Advantage read-only API v4 enrichment is implemented.
- AWS read-only static credential and STS AssumeRole workflows are implemented; live sync requires customer credentials and scope.
- AWS WAFv2 read-only web ACL posture sync is implemented; live sync requires customer WAFv2 read-only permissions and scope.
- Azure service-principal read-only subscription/resource/network exposure sync is implemented; live sync requires customer credentials and scope.
- Azure Front Door WAF read-only policy posture sync is implemented; live sync requires customer Azure Network read-only permissions and scope.
- Google Cloud access-token read-only project/resource/firewall exposure sync is implemented; live sync requires customer credentials and scope.
- Kubernetes service-account token read-only namespace/workload/service/deployment/network-policy inventory sync is implemented; live sync requires customer Kubernetes API credentials, RBAC, and scope.
- DigitalOcean API-token read-only account/Droplet/Firewall/Kubernetes inventory sync is implemented; live sync requires customer DigitalOcean credentials and scope.
- Heroku Platform API-token read-only app/formation/domain inventory sync is implemented; live sync requires customer Heroku credentials and scope.
- Databricks PAT read-only workspace/cluster/job/SQL warehouse/workspace-object metadata sync is implemented; live sync requires customer Databricks workspace credentials and scope.
- Snowflake SQL API read-only account/warehouse/database/schema/user/role-grant metadata sync is implemented; live sync requires a customer Snowflake OAuth token, metadata-readable role, account URL, and scope.
- Google Vertex AI access-token read-only endpoint and Model Garden inventory sync is implemented; live sync requires customer credentials and scope.
- Pinecone API-key read-only vector-index inventory sync is implemented; live sync requires customer credentials and scope.
- Weaviate API-key read-only schema and metadata sync is implemented; live sync requires customer credentials and scope.
- Azure AI Search API-key read-only index/service-stat inventory sync is implemented; live sync requires customer credentials and scope.
- Chroma API-key read-only collection metadata sync is implemented; live sync requires customer credentials and scope.
- LangChain configuration-import application metadata sync is implemented; it requires customer-supplied component metadata and does not execute chains, agents, tools, retrievers, vector stores, embeddings, or models.
- LlamaIndex configuration-import application metadata sync is implemented; it requires customer-supplied component metadata and does not execute query engines, retrievers, agents, tools, workflows, vector stores, embeddings, or models.
- Guardrails AI configuration-import metadata sync is implemented; it requires customer-supplied guard/validator/policy metadata and does not execute guards, validators, RAIL specs, server endpoints, prompts, LLMs, or models.
- Lakera Guard read-only project/policy metadata sync is implemented; it requires customer API-key credentials and configured project/policy IDs, and does not call `/guard`, `/guard/results`, submit prompts/outputs, or fetch runtime screening results.
- Cisco Duo Admin API read-only user/group/phone/protected-application inventory sync is implemented; live sync requires a customer-created Duo Admin API integration with read-resource permissions.
- OneLogin OAuth read-only user/role/app inventory sync is implemented; live sync requires customer API credentials with read-only user/app/role scopes.
- PingOne Worker-app OAuth read-only user/group/application inventory sync is implemented; live sync requires customer PingOne client credentials with read-only environment access.
- Auth0 Management API read-only user/role/client inventory sync is implemented; live sync requires customer machine-to-machine credentials with read-only Management API scopes.
- JumpCloud Admin API-key read-only user/user-group/application inventory sync is implemented; live sync requires customer Admin API key access with read-only users, user groups, and applications permissions.
- CyberArk Identity SCIM read-only user/group inventory sync is implemented; live sync requires customer SCIM bearer-token access with read-only users and groups permissions.
- Active Directory read-only LDAP/LDAPS user/group/computer/service-account inventory sync is implemented; live sync requires customer internal network or runner access plus a read-only bind account scoped to an approved base DN.
- Proofpoint TAP SIEM API read-only blocked/delivered/issue/click event observation is implemented; live sync requires customer Threat Insight service principal/secret credentials, TAP SIEM API access, and a bounded one-hour-or-less event window.
- Google Gmail Security read-only Alert Center phishing/malware alert observation is implemented; live sync requires customer OAuth access with Alert Center read-only permissions.
- Mimecast SIEM API read-only MTA log observation is implemented; live sync requires customer Mimecast API application credentials, Enhanced Logging, account-specific API base URL, and `Gateway | Tracking | Read` permission.
- Abnormal Security read-only threat-log observation is implemented; live sync requires a customer Abnormal Security API token and Threats API read access.
- GitLab PAT metadata sync, Bitbucket Cloud app-password/API-token metadata sync, Azure DevOps PAT repository/policy metadata sync, Buildkite API-token pipeline metadata sync, CircleCI API-token pipeline metadata sync, Jenkins API-token job/build-status metadata sync, Docker Hub repository/tag metadata sync, GitHub Container Registry package/version metadata sync, AWS ECR repository/image metadata sync, Tenable Workbenches asset/vulnerability summary sync, Rapid7 InsightVM asset/vulnerability summary sync, Wiz CNAPP cloud-resource/security issue summary sync, Prisma Cloud alert/resource summary sync, Lacework/FortiCNAPP host vulnerability observation sync, Orca Security alert/cloud-asset summary sync, Qualys VMDR host/detection summary sync, runZero asset export sync, Assetnote ASM asset/exposure summary sync, Axonius CAASM asset/adapter-coverage summary sync, Armis asset/unmanaged-device/coverage-gap summary sync, Cortex Xpanse external attack-surface summary sync, AbuseIPDB IP reputation checks, VirusTotal IoC search, GreyNoise IP context, AlienVault OTX indicator detail sync, Recorded Future vulnerability/entity enrichment, Mandiant Advantage API v4 enrichment, Microsoft Entra ID app-only Graph read-only identity inventory, Microsoft Defender for Office 365 Graph read-only email-security alert/incident observation, Google Gmail Security Alert Center read-only phishing/malware alert observation, Okta API-token read-only identity inventory, Google Workspace Admin Directory read-only identity inventory, Kubernetes service-account token read-only cluster inventory, Cloudflare API-token read-only edge/WAF sync, Fastly Next-Gen WAF API-token read-only site-event observation, Akamai Kona/App & API Protector EdgeGrid read-only SIEM security-event observation, Imperva Cloud WAF API-key read-only protected-site and WAF-rule posture observation, Palo Alto Panorama/PAN-OS API-key read-only firewall log observation, Fortinet FortiGate/FortiOS API-token read-only firewall policy monitor observation, Zscaler Internet Access OAuth read-only firewall filtering policy observation, OpenAI API-key read-only model inventory, Anthropic API-key read-only model inventory, Azure OpenAI API-key read-only deployment inventory, Azure AI Search API-key read-only index/service-stat inventory, Chroma API-key read-only collection metadata inventory, AWS Bedrock read-only foundation model inventory, Jira Cloud API-token issue creation, GitHub Issues PAT issue creation, Linear API-key issue creation, PagerDuty Events API incident routing, Opsgenie API-key alert routing, ServiceNow Table API issue creation, ConnectWise Manage API-key PSA/ticket sync and ticket creation, NinjaOne access-token RMM device/alert sync, HaloPSA OAuth client/ticket sync and ticket creation, Autotask REST company/ticket sync and ticket creation, Syncro API-token customer/asset/ticket sync and ticket creation, N-able N-central API-token/JWT customer/device/active-issue sync, Slack incoming-webhook delivery, Microsoft Teams incoming-webhook delivery, Splunk API-token read-only SIEM observation, Elastic Security API-key read-only SIEM observation, Datadog Cloud SIEM API-key read-only SIEM observation, Microsoft Sentinel OAuth read-only SIEM observation, Sumo Logic Access ID/Access Key read-only SIEM observation, Rapid7 InsightIDR API-key read-only SIEM observation, IBM QRadar SEC-token read-only SIEM observation, Microsoft Defender XDR OAuth read-only Advanced Hunting EDR observation, SentinelOne API-token read-only EDR observation, Carbon Black API-key read-only EDR observation, Sophos Central OAuth read-only EDR observation, Trend Vision One API-token read-only Workbench observation, Palo Alto Cortex XDR standard API-key read-only incident observation, and CrowdStrike Falcon OAuth read-only EDR observation are implemented; live use requires customer credentials.
- Google Security Operations OAuth read-only Chronicle API UDM search observation is implemented; live use requires a customer-approved OAuth token with `chronicle.events.udmSearch` access to an authorized SecOps instance.
- Planned integrations remain non-connectable.

## Phase 3: BAS and Detection Rule Validation

Status: Done for dry-run/API-first rule coverage; live execution remains policy-gated.

- Safe control-source registry and dry-run Atomic-style catalog exist.
- Rule coverage, logged-but-not-alerted, stale evidence detection, and tuning recommendations exist through API-derived control coverage summaries.
- Live BAS execution needs an explicitly approved internal-runner workflow.

## Phase 3A: Third-Party Tool Governance Center

Status: Implemented for API-first tenant governance, install-worker queueing, and non-executing systematic tool-library intake.

- Governed third-party tool APIs expose readiness, pinned runtime metadata, license/legal disposition, install/check jobs, tenant enablement, and audit history.
- Existing read-only catalog APIs remain stable: `/api/v1/open-source-tools`, `/api/v1/open-source-capabilities`, and `/api/v1/modules`.
- Mutable governance lives under `/api/v1/third-party-tools`.
- Proposed tools are evaluated through `/api/v1/third-party-tools/intake/validate` before they can become reviewed catalog/module entries.
- Proposed tools can be persisted as tenant-scoped review backlog records through `/api/v1/third-party-tools/intake/candidates`; candidate records are auditable but non-executing.
- Candidate readiness is exposed through `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness`; it reports actual missing catalog/module/governance/runtime/runner/legal work and remains read-only.
- Candidate review is exposed through `/api/v1/third-party-tools/intake/candidates/:candidateId/review`; tenant Owner/Admin users can mark candidates as needs-changes, accepted, rejected, or promoted only after readiness proves promotion is safe.
- Candidate implementation work orders are exposed through `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`; accepted candidates can receive auditable task/scaffold plans that guide catalog/module/parser/policy/runner/evidence/license work without creating repo files or execution jobs.
- Candidate implementation bundles are exposed through `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle`; accepted work orders can produce deterministic scaffold content, SHA-256 hashes, validation commands, required actions, and safety notes without writing files or executing tools.
- Candidate promotion packages are exposed through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`; promoted candidates receive durable reviewed snapshots of catalog, module/capability, governance, runtime, readiness, evidence, and safety state without installing, enabling, queueing, or executing tools.
- Trusted upstream version checks are exposed through `/api/v1/third-party-tools/:toolId/upstream-version-checks`; admins can discover newer candidate versions from reviewed metadata, but candidates remain review inputs until catalog/module/parser/license/runtime updates are completed.
- Reviewed tool update recommendations are exposed through `/api/v1/third-party-tools/:toolId/update-recommendations`; admins can detect catalog-version drift, apply reviewed pins, and queue install jobs without accepting arbitrary versions or bypassing policy.
- Tool activity is exposed through `/api/v1/third-party-tools/:toolId/activity`; admins and API customers can review a tenant-scoped lifecycle timeline assembled from governance records, runtime jobs, validation runs, upstream checks, update recommendations, candidates, work orders, and audit events.
- Tool runner eligibility is exposed through `/api/v1/third-party-tools/:toolId/runner-eligibility`; admins and API customers can see whether a governed tool is control-plane only, missing runner/runtime/scope prerequisites, approval-gated, blocked, implementation-gated, or ready for signed internal-runner dispatch.
- Tool runner dispatch is exposed through `/api/v1/third-party-tools/:toolId/runner-dispatch`; admins and API customers can request execution for a specific reviewed capability only after eligibility is `Ready`, and the implementation delegates to existing signed runner task builders rather than bypassing policy, scope, audit, or local allowlists.
- Tenant Owner/Admin can enable or disable approved tools; legal-review, blocked, unsafe, or disallowed tools remain visible but non-executable.
- Install/pull requests use allowlisted manifest artifacts only. Customers cannot submit arbitrary packages, images, repositories, URLs, or shell commands.
- Mission start must deny disabled tool runtimes before queueing validation jobs.
- New tools follow a systematic onboarding lifecycle: intake validation report or batch import -> candidate backlog record -> candidate readiness summary for backlog triage -> candidate readiness report -> candidate review decision -> implementation work order -> implementation bundle -> catalog manifest -> promotion package -> governance handoff -> certification report -> durable certification snapshot -> trusted upstream candidate check -> update recommendation when reviewed versions change -> module manifest -> parser/redaction fixtures -> license/safety certification -> control-plane or runner execution contract -> evidence/graph/report integration -> API governance visibility.
- Customer-network execution uses outbound-only signed-task Internal Runner workflows with local allowlists, scoped targets, resource limits, evidence upload, runner task history, governance dispatch audit events, and no arbitrary module/package execution.

## Phase 4: Threat Center

Status: Done for manual import, readiness, missing-signal impact, export scope,
and public global super-feed correlation. Commercial/private threat-feed vendor
onboarding remains a customer/business decision.

- Shared advisory/missing-signal schemas are present.
- Manual advisory import is persisted and audited.
- Raw advisory evidence storage uses redaction and hashing.
- CVE/IoC/TTP extraction is deterministic and conservative.
- Missing signal analysis is computed from tenant state.
- Validation plans are non-executing recommendations until policy approval.
- Readiness report HTML/PDF exports include evidence IDs.
- Missing-signal impact on validated findings and executive trends is implemented.
- Public global threat-intel super-feed is implemented with 13 source adapters,
  global dedupe/provenance, feed health, high-frequency SSRF-guarded polling,
  tenant-scoped alerts, alert acknowledgement/dismissal, and the `/threat-feed`
  web route.
- Threat-feed alerts are awareness/readiness signals only; they do not claim
  validation, exploitability, detection, or fix status without normal
  policy-gated Periscan validation evidence.

## Phase 5: Signal-Driven Triggers

Status: Done for API-first recommendation/evaluation/approval; execution remains policy-gated.

- CVE trigger.
- Asset-change trigger.
- Policy-change trigger.
- Missed-detection trigger.
- Triggered validation activity stream.
- Tenant routing settings for connected workflow destinations.
- Trigger evaluation creates recommendations only; approval creates a draft mission and policy decision without queueing jobs or starting execution.

## Phase 6: Internal Runner Expansion

Status: Ready for first-customer install validation; customer-specific environment testing is deployment-dependent. Full spec: [RUNNER_SPEC.md](RUNNER_SPEC.md). GAP-OSS-AGENT-01 resolved — outbound-only signed-task transport, no reverse SSH/shell/tunnel.

- Runner registration, signed tasks, heartbeat, credential rotation, continuous polling, non-root Docker packaging, Docker Compose/Kubernetes/systemd install examples, GHCR image publish workflow, scoped evidence upload, local lab E2E, deployment artifact validation, and reachability checks exist.
- Local module allowlist + safety-level allowlist + nonce-replay cache + server kill-switch handling in the Go runner, plus customer kill-switch, accept/reject, list-tasks, and evidence APIs (RBAC + tenant + audit) exist. The Go runner executes `runner.reachability_check`, `runner.dns_resolution_check`, `runner.tls_certificate_check`, and `runner.http_health_check`; the TypeScript runner-agent handles policy-gated AgentLocal `periscan.*` measured modules and safe `recon.*` discovery modules through the same signed-task control-plane API.
- Next work: WebSocket streaming and any restricted task-tunnel remain design-only/future (NOT reverse SSH); validate a specific customer environment after issued runner mTLS credentials, firewall allowlist, and target internal scope are available.

## Phase 7: MSSP, Billing, and Executive Reporting

Status: Done for API-first first-customer reporting; payment processing remains out of scope.

- MSSP tenant foundation, white-label reports, billing meters, API-derived client portfolio dashboard, executive trends, remediation velocity, and proof-delivery metrics exist.

## Phase 8: Frontier Gateway

Status: Done for API-first BYO-model orchestration; live model turns require a customer-supplied provider API key, and the web UI is an optional follow-on.

- Tenant-scoped data model (providers, policy profiles, sessions, context bundles, tools, tool requests/results, gateway audit events) plus shared Zod contracts and migration exist.
- Control-plane CRUD, REST routes under `/api/v1/model-gateway/*`, RBAC/tenant isolation, audit, and a per-tenant kill switch exist.
- `packages/model-gateway` provides the `ModelProviderAdapter` interface, OpenAI/Anthropic-compatible adapters, a fail-closed specialized-cyber-model extension point that is not customer-connectable yet, encrypted BYO-key storage, and a `test-connection` endpoint.
- A context broker with redaction and a code-defined typed tool catalog exist; read-only/plan tools map to existing evidence/operators services.
- A `model-gateway-turns` BullMQ queue and worker turn executor run the provider tool-calling loop through a policy enforcement point with mode gating, approval pause/resume, kill switch, and timeout.
- Approval-gated validation/remediation/reporting tools reuse `previewPolicyDecision` -> `createMission` and operators/reports; the no-fix-without-verification invariant is enforced.
- Live model turns and connectable providers require a customer-supplied frontier-model API key; a specialized cyber model can drop in as a new adapter only after a concrete provider, tests, policy review, and customer-facing docs land together.
