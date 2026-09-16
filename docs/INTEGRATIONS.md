# Periscan Integrations

Periscan catalogs **267 enterprise security platforms** across the detection, exposure, identity, cloud, and code-security stack. **126** are **dedicated live integrations** with hand-authored API clients; **29** of those are additionally verified by recorded-fixture contract tests. **141** standardized catalog entries are **Planned and not connectable** until a vendor-specific live client and credentialed contract tests are implemented and reviewed.

_This file is generated from the connector catalog (`scripts/generate-integrations.ts`) — do not edit by hand; run `npx tsx scripts/generate-integrations.ts` to refresh._

**Legend:** ✅ Dedicated live integration · ◷ Planned catalog coverage. External tiers are **Production / Beta / Planned** (P12-14). Dedicated connectors remain **Beta** until customer-credential live-smoke certification; the **contract-tested** subset has automated request-contract + normalization coverage in CI but is **not** Production. Planned stays non-connectable.

## External maturity tiers (Production / Beta / Planned)

Customer and analyst-facing tier table. **Production** requires customer-credential live-smoke evidence — fixture contract tests alone never mint Production.

_0 Production-certified connectors — dedicated live clients remain Beta until design-partner live-smoke receipts; 126 Beta; 141 Planned._

| External tier | Count | Meaning |
| --- | ---: | --- |
| **Production** | 0 | Customer-credential live-smoke certified |
| **Beta** | 126 | Dedicated live client; connectable with credentials; not Production-certified |
| **Planned** | 141 | Catalog coverage only — **not connectable** until a dedicated client ships |

### Top-10 Production certification targets

Priority stack for SIEM / EDR / CNAPP / ITSM / IdP depth (P12-14). Honest status until customer-credential evidence lands.

| Priority | Connector | Stack | External tier | Cert status | Evidence note |
| ---: | --- | --- | --- | --- | --- |
| 1 | Splunk Splunk (`splunk`) | SIEM | Beta | ContractTestedOnly | Fixture contract tests only — not Production. Customer-credential live-smoke required. |
| 2 | Microsoft Microsoft Sentinel (`microsoft-sentinel`) | SIEM | Beta | NotCertified | Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable. |
| 3 | CrowdStrike Falcon (`crowdstrike`) | EDR | Beta | ContractTestedOnly | Fixture contract tests only — not Production. Customer-credential live-smoke required. |
| 4 | Microsoft Microsoft Defender XDR (`microsoft-defender-xdr`) | EDR | Beta | NotCertified | Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable. |
| 5 | Wiz Wiz (`wiz`) | CNAPP | Beta | NotCertified | Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable. |
| 6 | Tenable Tenable (`tenable`) | CNAPP | Beta | ContractTestedOnly | Fixture contract tests only — not Production. Customer-credential live-smoke required. |
| 7 | Atlassian Jira Cloud (`jira`) | ITSM | Beta | NotCertified | Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable. |
| 8 | ServiceNow ServiceNow (`servicenow`) | ITSM | Beta | NotCertified | Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable. |
| 9 | Okta Okta (`okta`) | IdP | Beta | ContractTestedOnly | Fixture contract tests only — not Production. Customer-credential live-smoke required. |
| 10 | Microsoft Microsoft Entra ID (`microsoft-entra-id`) | IdP | Beta | NotCertified | Not Production-certified. Dedicated client may be Beta; Planned entries stay non-connectable. |

## Live integrations

| Vendor | Product | Category | Type | External tier |
| --- | --- | --- | --- | --- |
| Abnormal Security | Inbound Email Security | Email Security | Control observer | Beta |
| AbuseIPDB | AbuseIPDB | Threat Intelligence | Signal source | Beta |
| Akamai | Kona Site Defender | WAF/Firewall | Control observer | Beta |
| Alibaba | Alibaba Cloud | Cloud | Control observer | Beta |
| AlienVault | Open Threat Exchange | Threat Intelligence | Signal source | Beta |
| Anomali | ThreatStream | Threat Intelligence | Signal source | Beta |
| Anthropic | Anthropic | AI Stack | Signal source | Beta |
| Armis | Armis | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Assetnote | Attack Surface Management | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Atlassian | Bitbucket Cloud | Code/DevSecOps | Signal source | Beta |
| Atlassian | Jira Cloud | SOAR/ITSM | Signal source | Beta |
| Atlassian | Opsgenie | SOAR/ITSM | Signal source | Beta |
| AWS | Elastic Container Registry | Code/DevSecOps | Signal source | Beta |
| AWS | AWS | Cloud | Signal source | Beta |
| AWS | AWS WAF | WAF/Firewall | Control observer | Beta |
| AWS | AWS Bedrock | AI Stack | Signal source | Beta |
| Axonius | CAASM | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Bitsight | Bitsight | Threat Intelligence | Signal source | Beta |
| Broadcom | vCenter Server | Cloud | Signal source | Beta |
| Buildkite | Buildkite | Code/DevSecOps | Control observer | Beta |
| Censys | Censys | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Chroma | Chroma | AI Stack | Signal source | Beta |
| CircleCI | CircleCI | Code/DevSecOps | Control observer | Beta |
| Cisco | Duo | Identity | Control observer | Beta |
| Cisco | Umbrella | SSE/SASE | Control observer | Beta |
| Cloudflare | Cloudflare | WAF/Firewall | Control observer | Beta |
| ConnectWise | ConnectWise Manage | MSSP/PSA/RMM | Signal source | Beta |
| ConnectWise | ConnectWise Automate | MSSP/PSA/RMM | Control observer | Beta |
| CrowdStrike | Falcon | EDR/XDR | Control observer | Beta |
| CyberArk | CyberArk | Identity | Control observer | Beta |
| Databricks | Databricks | Cloud | Control observer | Beta |
| Datadog | Cloud SIEM | SIEM | Control observer | Beta |
| DigitalOcean | DigitalOcean | Cloud | Control observer | Beta |
| Docker | Docker Hub | Code/DevSecOps | Signal source | Beta |
| DomainTools | Iris Investigate | Threat Intelligence | Signal source | Beta |
| Elastic | Elastic Security | SIEM | Control observer | Beta |
| Fastly | Next-Gen WAF | WAF/Firewall | Control observer | Beta |
| Fortinet | FortiCNAPP | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Fortinet | FortiGate | WAF/Firewall | Control observer | Beta |
| GitGuardian | GitGuardian | AppSec/SCA | Signal source | Beta |
| GitHub | GitHub Cloud | Code/DevSecOps | Signal source | Beta |
| GitHub | GitHub Container Registry | Code/DevSecOps | Signal source | Beta |
| GitHub | GitHub Issues | SOAR/ITSM | Signal source | Beta |
| GitLab | GitLab | Code/DevSecOps | Signal source | Beta |
| Google | Google Cloud | Cloud | Signal source | Beta |
| Google | Google Workspace | Identity | Signal source | Beta |
| Google | VirusTotal | Threat Intelligence | Signal source | Beta |
| Google | Mandiant Advantage | Threat Intelligence | Signal source | Beta |
| Google | Gmail Security | Email Security | Control observer | Beta |
| Google | Google Security Operations | SIEM | Control observer | Beta |
| Google | Vertex AI | AI Stack | Signal source | Beta |
| GreyNoise | GreyNoise | Threat Intelligence | Signal source | Beta |
| Guardrails AI | Guardrails AI | AI Stack | Control observer | Beta |
| Halo Service Solutions | HaloPSA | MSSP/PSA/RMM | Signal source | Beta |
| IBM | QRadar | SIEM | Control observer | Beta |
| Imperva | Cloud WAF | WAF/Firewall | Control observer | Beta |
| Intel 471 | Intel 471 | Threat Intelligence | Signal source | Beta |
| Jenkins | Jenkins | Code/DevSecOps | Control observer | Beta |
| JFrog | Xray | AppSec/SCA | Signal source | Beta |
| JumpCloud | JumpCloud | Identity | Control observer | Beta |
| Kaseya | Autotask PSA | MSSP/PSA/RMM | Signal source | Beta |
| Kaseya | Datto RMM | MSSP/PSA/RMM | Control observer | Beta |
| Kaseya | VSA | MSSP/PSA/RMM | Control observer | Beta |
| Kubernetes | Kubernetes | Cloud | Control observer | Beta |
| Lakera | Lakera Guard | AI Stack | Control observer | Beta |
| LangChain | LangChain | AI Stack | Signal source | Beta |
| Linear | Linear | SOAR/ITSM | Signal source | Beta |
| LlamaIndex | LlamaIndex | AI Stack | Signal source | Beta |
| Microsoft | Azure DevOps | Code/DevSecOps | Signal source | Beta |
| Microsoft | Azure | Cloud | Signal source | Beta |
| Microsoft | Azure Front Door WAF | WAF/Firewall | Control observer | Beta |
| Microsoft | Active Directory | Identity | Control observer | Beta |
| Microsoft | Microsoft Entra ID | Identity | Signal source | Beta |
| Microsoft | Microsoft Teams | SOAR/ITSM | Signal source | Beta |
| Microsoft | Defender for Office 365 | Email Security | Control observer | Beta |
| Microsoft | Microsoft Sentinel | SIEM | Control observer | Beta |
| Microsoft | Microsoft Defender XDR | EDR/XDR | Control observer | Beta |
| Microsoft | Azure OpenAI | AI Stack | Signal source | Beta |
| Microsoft | Azure AI Search | AI Stack | Signal source | Beta |
| Mimecast | Email Security Cloud Gateway | Email Security | Control observer | Beta |
| N-able | N-central | MSSP/PSA/RMM | Control observer | Beta |
| Netskope | Netskope One | SSE/SASE | Control observer | Beta |
| NinjaOne | NinjaOne | MSSP/PSA/RMM | Control observer | Beta |
| Okta | Okta | Identity | Signal source | Beta |
| Okta | Auth0 | Identity | Control observer | Beta |
| OneLogin | OneLogin | Identity | Control observer | Beta |
| OpenAI | OpenAI | AI Stack | Signal source | Beta |
| Oracle | Oracle Cloud Infrastructure | Cloud | Control observer | Beta |
| Orca Security | Orca | VM/EAP/ASM/CNAPP | Signal source | Beta |
| PagerDuty | PagerDuty | SOAR/ITSM | Signal source | Beta |
| Palo Alto Networks | Prisma Cloud | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Palo Alto Networks | Cortex Xpanse | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Palo Alto Networks | Cortex XDR | EDR/XDR | Control observer | Beta |
| Palo Alto Networks | Cortex XSIAM | EDR/XDR | Control observer | Beta |
| Palo Alto Networks | Panorama | WAF/Firewall | Control observer | Beta |
| Pinecone | Pinecone | AI Stack | Signal source | Beta |
| Ping Identity | PingOne | Identity | Control observer | Beta |
| Proofpoint | Targeted Attack Protection | Email Security | Control observer | Beta |
| Qualys | Qualys VMDR | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Rapid7 | InsightVM | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Rapid7 | InsightIDR | SIEM | Control observer | Beta |
| Recorded Future | Recorded Future | Threat Intelligence | Signal source | Beta |
| runZero | runZero | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Salesforce | Salesforce Platform | Identity | Control observer | Beta |
| Salesforce | Heroku | Cloud | Control observer | Beta |
| SecurityScorecard | SecurityScorecard | Threat Intelligence | Signal source | Beta |
| Semgrep | Semgrep | AppSec/SCA | Signal source | Beta |
| SentinelOne | Singularity | EDR/XDR | Control observer | Beta |
| ServiceNow | ServiceNow | SOAR/ITSM | Signal source | Beta |
| Shodan | Shodan | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Slack | Slack | SOAR/ITSM | Signal source | Beta |
| Snowflake | Snowflake | Cloud | Control observer | Beta |
| Snyk | Snyk | AppSec/SCA | Signal source | Beta |
| SonarSource | SonarQube | AppSec/SCA | Signal source | Beta |
| Sophos | Intercept X | EDR/XDR | Control observer | Beta |
| Splunk | Splunk Cloud | SIEM | Control observer | Beta |
| Spur | Spur | Threat Intelligence | Signal source | Beta |
| Sumo Logic | Sumo Logic | SIEM | Control observer | Beta |
| Syncro | Syncro | MSSP/PSA/RMM | Control observer | Beta |
| Sysdig | Sysdig Secure | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Tenable | Tenable Vulnerability Management | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Trend Micro | Vision One | EDR/XDR | Control observer | Beta |
| VMware | Carbon Black | EDR/XDR | Control observer | Beta |
| Weaviate | Weaviate | AI Stack | Signal source | Beta |
| Wiz | Wiz | VM/EAP/ASM/CNAPP | Signal source | Beta |
| Zscaler | Zscaler Internet Access | WAF/Firewall | Control observer | Beta |

## Full catalog by category

### AI Stack (13)

- ✅ **Anthropic Anthropic** — Reads authorized Anthropic model inventory and AI stack context without executing prompts.
- ✅ **AWS AWS Bedrock** — Reads authorized AWS Bedrock foundation model inventory and AI-stack context without invoking models or sending prompts.
- ✅ **Chroma Chroma** — Reads authorized Chroma collection metadata for RAG/vector-store context without reading records, querying embeddings, or mutating collections.
- ✅ **Google Vertex AI** — Reads authorized Google Vertex AI endpoint and Model Garden inventory without invoking models, prompts, prediction, or generation APIs.
- ✅ **Guardrails AI Guardrails AI** — Imports authorized Guardrails AI guard, validator, policy, and server configuration metadata for AI guardrail coverage context without executing validation.
- ✅ **Lakera Lakera Guard** — Reads authorized Lakera Guard project and policy metadata for AI guardrail coverage context without screening prompts or fetching runtime results.
- ✅ **LangChain LangChain** — Imports authorized LangChain application structure for AI-app and agent risk context without executing chains, tools, retrievers, vector stores, or model calls.
- ✅ **LlamaIndex LlamaIndex** — Imports authorized LlamaIndex application structure for AI-app, RAG, query-engine, and agent risk context without executing retrieval or model workflows.
- ✅ **Microsoft Azure OpenAI** — Reads authorized Azure OpenAI deployment inventory and AI workflow context without executing prompts.
- ✅ **Microsoft Azure AI Search** — Reads authorized Azure AI Search index definitions and service statistics for RAG/search context without querying documents or mutating search resources.
- ✅ **OpenAI OpenAI** — Reads authorized OpenAI model inventory and AI stack context without executing prompts.
- ✅ **Pinecone Pinecone** — Reads authorized Pinecone control-plane index metadata for RAG/vector-store context without querying, listing, upserting, deleting, embedding, or reranking records.
- ✅ **Weaviate Weaviate** — Reads authorized Weaviate REST schema and cluster metadata for RAG/vector-store context without querying objects, GraphQL, vectors, backups, or mutating collections.

### AppSec/SCA (18)

- ◷ **42Crunch 42Crunch API Security** — 42Crunch API contract audit and conformance findings as exposure signals.
- ◷ **Apiiro Apiiro ASPM** — Apiiro ASPM application and design risk findings as exposure signals.
- ◷ **Bright Security Bright** — Bright Security developer-first DAST findings as exposure signals.
- ◷ **Chainguard Chainguard** — Chainguard hardened-image vulnerability + provenance status as exposure signals.
- ◷ **Checkmarx Checkmarx One** — Checkmarx One SAST/SCA findings as exposure signals.
- ◷ **Cycode Cycode ASPM** — Cycode ASPM/SCA/secrets findings as exposure signals.
- ◷ **Endor Labs Endor Labs** — Endor Labs SCA reachability-based dependency findings as exposure signals.
- ✅ **GitGuardian GitGuardian** — Reads GitGuardian secret incidents and normalizes leaked-credential exposure to signals. Read-only: Periscan does not resolve/ignore incidents, share, or mutate GitGuardian data.
- ◷ **Invicti Invicti** — Invicti DAST web-application vulnerability findings as exposure signals.
- ◷ **Invicti Acunetix** — Acunetix DAST web-application vulnerability findings as exposure signals.
- ✅ **JFrog Xray** — Reads JFrog Xray security/license violations and normalizes artifact/dependency exposure to signals. Read-only: Periscan does not create watches/policies, ignore violations, or mutate Xray data.
- ◷ **Legit Security Legit Security** — Legit Security ASPM software-supply-chain + SDLC risk findings as exposure signals.
- ◷ **OX Security OX Security** — OX Security ASPM end-to-end application + pipeline risk findings as exposure signals.
- ✅ **Semgrep Semgrep** — Reads Semgrep deployment findings (SAST + secrets) and normalizes them to exposure signals. Read-only: Periscan does not triage/ignore findings, mutate policies, run scans, or change Semgrep configuration.
- ✅ **Snyk Snyk** — Reads Snyk organization issues (SCA/SAST/container vulnerabilities) and normalizes them to exposure signals. Read-only: Periscan does not ignore/fix issues, mutate projects, run tests, or change Snyk configuration.
- ◷ **Socket Socket** — Socket software-supply-chain dependency-risk alerts (malware, risky packages) as exposure signals.
- ✅ **SonarSource SonarQube** — Reads SonarQube/SonarCloud project issues (security vulnerabilities, hotspots, code smells) and normalizes them to exposure signals. Read-only: Periscan does not change issue status, mutate projects, trigger analyses, or modify SonarQube configuration.
- ◷ **Veracode Veracode Platform** — Veracode SAST/DAST/SCA findings as exposure signals.

### Cloud (11)

- ✅ **Alibaba Alibaba Cloud** — Reads authorized Alibaba Cloud ECS instance, security group, and RAM role inventory without performing create, update, delete, credential, or remote access actions.
- ✅ **AWS AWS** — Reads AWS account identity, EC2 instances, security groups, S3 buckets, IAM roles, and exposure indicators without performing write actions.
- ✅ **Broadcom vCenter Server** — Partial (read-only inventory): builds a vCenter topology view from datacenters, clusters, ESXi hosts, networks, and virtual machines. Not virtualization lifecycle, power ops, migration, snapshots, or remediation control.
- ✅ **Databricks Databricks** — Reads authorized Databricks workspace metadata for clusters, jobs, SQL warehouses, and workspace object inventory without exporting notebooks, reading DBFS or secrets, running commands, starting jobs, or mutating resources.
- ✅ **DigitalOcean DigitalOcean** — Reads authorized DigitalOcean account, Droplet, Firewall, and Kubernetes cluster metadata without creating, updating, deleting, retrieving kubeconfigs, or exposing raw network addresses.
- ✅ **Google Google Cloud** — Reads Google Cloud projects, Cloud Asset Inventory resources, firewall posture, and public exposure indicators without performing write actions.
- ✅ **Kubernetes Kubernetes** — Reads authorized Kubernetes workload, service, namespace, deployment, and network-policy metadata without exec, logs, port-forwarding, secret reads, or write operations.
- ✅ **Microsoft Azure** — Reads Azure subscriptions, resources, and network security group exposure indicators without performing write actions.
- ✅ **Oracle Oracle Cloud Infrastructure** — Reads authorized Oracle Cloud Infrastructure compute, VCN, and security list metadata using signed GET requests without creating, updating, deleting, console, shell, or data-content access.
- ✅ **Salesforce Heroku** — Reads authorized Heroku account, app, formation, and domain metadata without reading config vars, logs, builds, releases, dyno command output, or mutating apps.
- ✅ **Snowflake Snowflake** — Reads authorized Snowflake account metadata, warehouses, databases, schemas, users, and role grants through generated read-only SQL API statements.

### Code/DevSecOps (10)

- ✅ **Atlassian Bitbucket Cloud** — Reads authorized Bitbucket Cloud repository inventory and branch restriction posture without cloning or storing repository contents.
- ✅ **AWS Elastic Container Registry** — Reads authorized AWS Elastic Container Registry repository and image metadata without pulling images, manifests, blobs, or layers.
- ✅ **Buildkite Buildkite** — Reads authorized Buildkite organization pipeline metadata and repository links without reading build logs, artifacts, or secrets.
- ✅ **CircleCI CircleCI** — Reads authorized CircleCI project pipeline metadata without reading job logs, artifacts, environment variables, or triggering workflows.
- ✅ **Docker Docker Hub** — Reads authorized Docker Hub repository and tag metadata for container exposure context without pulling images, manifests, or layers.
- ✅ **GitHub GitHub Cloud** — Reads repository inventory, permissions, code owners, branch protection, and secret path seeds.
- ✅ **GitHub GitHub Container Registry** — Reads authorized GitHub Container Registry package, version, and tag metadata without pulling images, manifests, blobs, or layers.
- ✅ **GitLab GitLab** — Reads authorized GitLab project inventory and branch protection posture without storing repository contents.
- ✅ **Jenkins Jenkins** — Reads authorized Jenkins job and last-build metadata without triggering builds, reading console logs, downloading artifacts, reading credentials, or accessing script console.
- ✅ **Microsoft Azure DevOps** — Reads authorized Azure DevOps project, repository, and branch-policy posture without cloning repositories or reading source files.

### Data Security (15)

- ◷ **Adaptive Shield Adaptive Shield SSPM** — Adaptive Shield SSPM SaaS security-check findings as exposure signals.
- ◷ **AppOmni AppOmni SSPM** — AppOmni SSPM SaaS configuration and data-exposure findings as exposure signals.
- ◷ **BigID BigID Data Security Platform** — BigID DSPM sensitive-data discovery and risk findings as exposure signals.
- ◷ **Cohesity Cohesity DataHawk** — Cohesity DataHawk data classification + threat findings as exposure signals.
- ◷ **Commvault Commvault Cloud** — Commvault Cloud backup integrity + threat-scan events as exposure signals.
- ◷ **Cyera Cyera DSPM** — Cyera DSPM sensitive-data risk findings as exposure signals.
- ◷ **Druva Druva Data Security Cloud** — Druva backup integrity + ransomware-anomaly events as exposure signals.
- ◷ **Microsoft Purview** — Microsoft Purview DLP/data-governance alerts as exposure signals.
- ◷ **Obsidian Security Obsidian SaaS Security** — Obsidian Security SSPM SaaS misconfiguration and threat findings as exposure signals.
- ◷ **Palo Alto Networks Dig Security DSPM** — Dig Security DSPM/DDR cloud data risk findings as exposure signals.
- ◷ **Rubrik Rubrik Security Cloud** — Rubrik data security posture + sensitive-data/anomaly findings as exposure signals.
- ◷ **Sentra Sentra DSPM** — Sentra DSPM cloud sensitive-data risk findings as exposure signals.
- ◷ **Valence Security Valence SaaS Security** — Valence Security SSPM SaaS configuration, identity, and integration risks as exposure signals.
- ◷ **Varonis Varonis Data Security Platform** — Varonis data-access/exposure alerts as exposure signals.
- ◷ **Veeam Veeam Data Platform** — Veeam backup integrity + malware-detection events as exposure signals.

### EDR/XDR (16)

- ◷ **Bitdefender GravityZone** — Bitdefender GravityZone detection/response evidence for control validation.
- ◷ **Cisco Secure Endpoint** — Cisco Secure Endpoint (AMP) detection/response evidence for control validation.
- ✅ **CrowdStrike Falcon** — Reads authorized Falcon endpoint detection and prevention evidence for control validation. Deep native adapter (manifest + safe validation) for unified fabric ingest of EDR signals as seeds for pillar validation; supports 'Validate from external finding' flows + noise reduction correlation.
- ◷ **Cybereason Cybereason XDR** — Cybereason XDR Malop detection/response evidence for control validation.
- ◷ **Deep Instinct Deep Instinct DSF** — Deep Instinct deep-learning prevention evidence for control validation.
- ◷ **ESET ESET Inspect** — ESET Inspect EDR detection/remediation evidence for control validation.
- ✅ **Microsoft Microsoft Defender XDR** — Queries Microsoft Defender XDR Advanced Hunting read-only data as EDR/XDR control evidence for validation outcomes.
- ◷ **Morphisec Morphisec** — Morphisec moving-target-defense prevention evidence for control validation.
- ✅ **Palo Alto Networks Cortex XDR** — Reads authorized Palo Alto Networks Cortex XDR incident evidence for EDR/XDR control validation.
- ✅ **Palo Alto Networks Cortex XSIAM** — Partial depth: reads authorized Cortex XSIAM incidents through the Cortex XDR-compatible public incident REST API (get_incidents)—the same read-only incident surface as Cortex XDR. Not full XSIAM data-lake, XQL, dataset, correlation-rule, or SOAR coverage.
- ✅ **SentinelOne Singularity** — Reads authorized SentinelOne Singularity threat evidence for EDR/XDR control validation.
- ✅ **Sophos Intercept X** — Reads authorized Sophos Central Intercept X alert evidence for EDR/XDR control validation.
- ◷ **Trellix Trellix XDR** — Trellix XDR detection/response evidence for control validation.
- ✅ **Trend Micro Vision One** — Reads authorized Trend Vision One Workbench alert evidence for EDR/XDR control validation.
- ✅ **VMware Carbon Black** — Reads authorized Carbon Black Cloud Alerts v7 evidence for EDR/XDR control validation.
- ◷ **WithSecure WithSecure Elements** — WithSecure Elements EDR detection evidence for control validation.

### Email Security (11)

- ✅ **Abnormal Security Inbound Email Security** — Reads authorized Abnormal Security threat-log records as email-security control evidence.
- ◷ **Cisco Secure Email Threat Defense** — Cisco Secure Email Threat Defense message verdict evidence for control validation.
- ◷ **Cofense Cofense** — Cofense phishing-detection-and-response evidence for control validation.
- ✅ **Google Gmail Security** — Reads authorized Google Alert Center Gmail security alerts as email-security control evidence without reading mailbox content.
- ◷ **IRONSCALES IRONSCALES** — IRONSCALES email-security incident block/detect evidence for control validation.
- ◷ **KnowBe4 KnowBe4** — KnowBe4 security-awareness + phishing-simulation human-risk scores as identity signals.
- ◷ **Material Security Material Security** — Material Security email protection and data-access enforcement evidence for control validation.
- ✅ **Microsoft Defender for Office 365** — Reads authorized Microsoft Defender for Office 365 security incidents and alerts as email-security control evidence.
- ✅ **Mimecast Email Security Cloud Gateway** — Reads authorized Mimecast SIEM MTA logs as email-security control evidence.
- ✅ **Proofpoint Targeted Attack Protection** — Reads authorized Proofpoint TAP SIEM threat events as email-security control evidence.
- ◷ **Sublime Security Sublime Security** — Sublime Security email threat detection/block evidence for control validation.

### Identity (22)

- ✅ **Cisco Duo** — Reads authorized Cisco Duo users, groups, MFA device posture, and protected application inventory for identity and control validation context.
- ✅ **CyberArk CyberArk** — Reads authorized CyberArk Identity SCIM users, groups, and MFA posture indicators for identity attack-path context.
- ✅ **Google Google Workspace** — Reads authorized Google Workspace users, groups, admin posture, and MFA enrollment context for identity attack-path analysis.
- ◷ **HashiCorp Vault** — HashiCorp Vault secrets-access/audit posture as identity signals.
- ✅ **JumpCloud JumpCloud** — Reads authorized JumpCloud users, user groups, MFA posture indicators, and SSO application inventory for identity attack-path context.
- ◷ **Keyfactor Keyfactor Command** — Keyfactor machine-identity (PKI certificate) inventory + risk as identity signals.
- ✅ **Microsoft Active Directory** — Reads authorized Active Directory users, groups, computers, and service-account indicators through read-only LDAP/LDAPS inventory.
- ✅ **Microsoft Microsoft Entra ID** — Reads authorized Microsoft Entra ID users, groups, directory roles, and applications for identity attack-path context.
- ✅ **Okta Okta** — Reads authorized Okta user, group, MFA posture, and application inventory for identity attack-path context.
- ✅ **Okta Auth0** — Reads authorized Auth0 users, roles, MFA posture indicators, and application inventory for identity attack-path context.
- ◷ **Omada Omada Identity Cloud** — Omada identity-governance entitlement/access posture as identity signals.
- ◷ **One Identity One Identity Manager** — One Identity Manager entitlement/governance posture as identity signals.
- ✅ **OneLogin OneLogin** — Reads authorized OneLogin users, roles, MFA posture indicators, and application inventory for identity attack-path context.
- ◷ **Permiso Security Permiso** — Permiso cloud identity threat detections (ITDR) as identity signals.
- ✅ **Ping Identity PingOne** — Reads authorized PingOne users, groups, MFA posture indicators, and application inventory for identity attack-path context.
- ◷ **RSA RSA SecurID / ID Plus** — RSA SecurID / ID Plus MFA authentication-event posture as identity signals.
- ◷ **SailPoint Identity Security Cloud** — SailPoint IGA identity/access governance as identity signals.
- ✅ **Salesforce Salesforce Platform** — Reads authorized Salesforce organization and user posture through versioned REST Query resources. Optional login-history access is off by default. Periscan does not query business objects or mutate Salesforce.
- ◷ **Saviynt Identity Cloud** — Saviynt IGA identity/access governance as identity signals.
- ◷ **Semperis Directory Services Protector** — Semperis Active Directory/Entra security posture + attack detections as identity signals.
- ◷ **Silverfort Silverfort** — Silverfort identity-threat-detection + MFA/auth enforcement evidence for control validation.
- ◷ **Venafi Venafi TLS Protect** — Venafi machine-identity (TLS certificate/key) inventory + risk as identity signals.

### MDM/Device (9)

- ◷ **Automox Automox** — Automox endpoint patch/configuration posture as asset signals.
- ◷ **Ivanti Ivanti Neurons** — Ivanti Neurons UEM/patch device-compliance posture as asset signals.
- ◷ **Jamf Jamf Pro** — Jamf Pro managed-device inventory/compliance as asset signals.
- ◷ **Kandji Kandji** — Kandji Apple-device inventory/compliance as asset signals.
- ◷ **Lookout Lookout Mobile Endpoint Security** — Lookout mobile endpoint risk + threat posture as asset signals.
- ◷ **Microsoft Intune** — Microsoft Intune managed-device compliance as asset signals.
- ◷ **Omnissa Workspace ONE** — Omnissa Workspace ONE UEM device-compliance posture as asset signals.
- ◷ **Tanium Tanium** — Tanium real-time endpoint inventory/posture as asset signals.
- ◷ **Zimperium Zimperium MTD** — Zimperium mobile threat defense detection evidence for control validation.

### MSSP/PSA/RMM (9)

- ✅ **ConnectWise ConnectWise Manage** — Reads authorized ConnectWise Manage company and service-ticket context for MSSP delivery and can create approved remediation workflow tickets.
- ✅ **ConnectWise ConnectWise Automate** — Reads authorized ConnectWise Automate client, managed computer, and alert context for MSSP validation planning and endpoint-control coverage.
- ✅ **Halo Service Solutions HaloPSA** — Reads authorized HaloPSA client and ticket context for MSSP service delivery and creates approved remediation workflow tickets.
- ✅ **Kaseya Autotask PSA** — Reads authorized Autotask PSA company and ticket context for MSSP service delivery and creates approved remediation workflow tickets.
- ✅ **Kaseya Datto RMM** — Reads authorized Datto RMM managed-device inventory and online posture for MSSP validation planning and control-observation evidence.
- ✅ **Kaseya VSA** — Reads authorized Kaseya VSA asset and agent inventory for MSSP validation planning and endpoint-control coverage context.
- ✅ **N-able N-central** — Reads authorized N-able N-central customer, device, and active issue context for MSSP validation planning and control-observation evidence.
- ✅ **NinjaOne NinjaOne** — Reads authorized NinjaOne organization, device, and alert context for MSSP endpoint validation and remediation readiness.
- ✅ **Syncro Syncro** — Reads authorized Syncro customer, RMM asset, and ticket context for MSSP service delivery and creates approved remediation workflow tickets.

### NDR (8)

- ◷ **Acalvio ShadowPlex** — Acalvio ShadowPlex deception detection evidence for control validation.
- ◷ **Corelight Open NDR** — Corelight Open NDR Zeek/Suricata network evidence for control validation.
- ◷ **CounterCraft The Platform** — CounterCraft cyber-deception engagement/alert evidence for control validation.
- ◷ **Darktrace Darktrace** — Darktrace DETECT/RESPOND network anomaly and model-breach evidence for control validation.
- ◷ **ExtraHop Reveal(x)** — ExtraHop Reveal(x) network detection and response evidence for control validation.
- ◷ **Nozomi Networks Nozomi Vantage** — Nozomi Networks OT/IoT network threat detections as control-observation signals.
- ◷ **Stamus Networks Stamus Security Platform** — Stamus Networks NDR detection evidence for control validation.
- ◷ **Vectra AI Vectra AI Platform** — Vectra AI network/identity threat detection evidence for control validation.

### Other (3)

- ◷ **Drata Drata** — Drata continuous-compliance control/monitor status as audit signals.
- ◷ **Secureframe Secureframe** — Secureframe compliance control/test posture as audit signals.
- ◷ **Vanta Vanta** — Vanta automated compliance test/control posture as audit signals.

### PAM (7)

- ◷ **Akeyless Akeyless Platform** — Akeyless secrets-management access/audit posture as identity signals.
- ◷ **BeyondTrust Password Safe** — BeyondTrust Password Safe privileged-access evidence as identity signals.
- ◷ **Delinea Secret Server** — Delinea Secret Server privileged-access audit as identity signals.
- ◷ **Doppler Doppler** — Doppler secrets-management activity/audit logs as identity signals.
- ◷ **Keeper Security Keeper** — Keeper secrets/credential vault event audit as identity signals.
- ◷ **StrongDM StrongDM** — StrongDM infrastructure-access activity/audit as identity signals.
- ◷ **Teleport Teleport Access Platform** — Teleport infrastructure access + session audit as identity signals.

### SIEM (16)

- ✅ **Datadog Cloud SIEM** — Runs authorized read-only Datadog Cloud SIEM security signal searches for control-validation evidence.
- ◷ **Devo Devo Platform** — Devo SIEM/analytics alert evidence for control validation.
- ✅ **Elastic Elastic Security** — Runs authorized read-only Elastic Security alert searches for logging, alerting, and control-validation evidence.
- ◷ **Exabeam Exabeam Security Operations Platform** — Exabeam UEBA/SIEM detection evidence for control validation.
- ✅ **Google Google Security Operations** — Runs authorized read-only Google Security Operations UDM searches for control-validation evidence.
- ◷ **Gurucul Gurucul REVEAL** — Gurucul UEBA/SIEM risk-alert evidence for control validation.
- ◷ **Hunters Hunters SOC Platform** — Hunters SOC platform detection evidence for control validation.
- ✅ **IBM QRadar** — Runs authorized read-only IBM QRadar Ariel AQL searches for logging and control-validation evidence.
- ◷ **Logpoint Logpoint** — Logpoint SIEM incident evidence for control validation.
- ◷ **LogRhythm LogRhythm Axon** — LogRhythm Axon SIEM alarm evidence for control validation.
- ✅ **Microsoft Microsoft Sentinel** — Runs authorized read-only Microsoft Sentinel/Log Analytics queries for logging, alerting, and control-validation evidence.
- ◷ **Panther Panther** — Panther detection-as-code SIEM alert evidence for control validation.
- ✅ **Rapid7 InsightIDR** — Runs authorized read-only Rapid7 InsightIDR Log Search queries for logging and control-validation evidence.
- ◷ **Securonix Unified Defense SIEM** — Securonix SIEM/UEBA detection evidence for control validation.
- ✅ **Splunk Splunk Cloud** — Runs authorized read-only Splunk searches for detection, logging, and routing evidence.
- ✅ **Sumo Logic Sumo Logic** — Runs authorized read-only Sumo Logic Search Job queries for logging, alerting, and control-validation evidence.

### SOAR/ITSM (13)

- ✅ **Atlassian Jira Cloud** — Creates remediation and validation workflow issues in authorized Jira Cloud projects and reads workflow status signals.
- ✅ **Atlassian Opsgenie** — Routes policy-gated Periscan validation and remediation workflow alerts into authorized Opsgenie teams without exposing Opsgenie API keys.
- ✅ **GitHub GitHub Issues** — Creates remediation and validation workflow issues in an authorized GitHub repository without exposing GitHub token plumbing.
- ✅ **Linear Linear** — Creates remediation and validation workflow issues in authorized Linear teams without exposing Linear credential plumbing.
- ✅ **Microsoft Microsoft Teams** — Routes validation and remediation workflow notifications to authorized Microsoft Teams channels.
- ✅ **PagerDuty PagerDuty** — Routes policy-gated Periscan validation and remediation workflow events into authorized PagerDuty services without exposing PagerDuty routing keys.
- ◷ **Palo Alto Networks Cortex XSOAR** — Palo Alto Cortex XSOAR playbook/incident response evidence for control validation.
- ✅ **ServiceNow ServiceNow** — Creates remediation and validation workflow tickets in authorized ServiceNow tables without exposing ServiceNow credentials.
- ✅ **Slack Slack** — Routes validation and remediation workflow notifications to authorized Slack workspaces.
- ◷ **Splunk Splunk SOAR** — Splunk SOAR (Phantom) container/playbook response evidence for control validation.
- ◷ **Swimlane Swimlane Turbine** — Swimlane Turbine SOAR case/playbook response evidence for control validation.
- ◷ **Tines Tines** — Tines workflow automation run evidence for control validation.
- ◷ **Torq Torq** — Torq hyperautomation workflow run evidence for control validation.

### SSE/SASE (8)

- ◷ **Cato Networks Cato SASE Cloud** — Cato SASE Cloud security event evidence for control validation.
- ✅ **Cisco Umbrella** — Reads Cisco Umbrella DNS-layer activity (OAuth2 client credentials) and observes whether malicious destinations were blocked. Read-only: Periscan does not change policies/destination lists or mutate Umbrella data.
- ◷ **Forcepoint Forcepoint ONE** — Forcepoint ONE SSE/DLP enforcement evidence for control validation.
- ◷ **Island Island Enterprise Browser** — Island Enterprise Browser policy enforcement evidence for control validation.
- ✅ **Netskope Netskope One** — Reads Netskope One SSE alert/events and observes whether the SSE control blocked or alerted on validated activity. Read-only: Periscan does not create/modify policies, mutate events, or change Netskope configuration.
- ◷ **Palo Alto Networks Talon Enterprise Browser** — Palo Alto Talon Enterprise Browser policy enforcement evidence for control validation.
- ◷ **Skyhigh Security Skyhigh SSE** — Skyhigh Security SSE/CASB enforcement evidence for control validation.
- ◷ **Zscaler Zscaler Private Access** — Zscaler Private Access ZTNA access-policy enforcement evidence for control validation.

### Threat Intelligence (17)

- ✅ **AbuseIPDB AbuseIPDB** — Checks tenant-configured IP indicators against AbuseIPDB reputation data without reporting IPs, clearing addresses, or downloading blocklists.
- ✅ **AlienVault Open Threat Exchange** — Queries AlienVault OTX general indicator details for tenant-configured IoCs and normalizes pulse association context without creating pulses, subscribing, exporting feeds, or mutating OTX data.
- ✅ **Anomali ThreatStream** — Reads recent Anomali ThreatStream indicators and normalizes IOC threat-intel context to exposure signals. Read-only: Periscan does not create indicators, import feeds, or mutate ThreatStream data.
- ✅ **Bitsight Bitsight** — Reads Bitsight company findings/ratings for a configured company GUID and normalizes externally observed risk to exposure signals. Read-only ratings; Periscan does not modify ratings, manage portfolios, or mutate Bitsight data.
- ◷ **Cybersixgill Cybersixgill** — Cybersixgill deep/dark-web threat intelligence as exposure signals.
- ✅ **DomainTools Iris Investigate** — Looks up DomainTools Iris Investigate domain risk/intelligence for tenant-configured domains and normalizes it to exposure signals. Read-only Iris Investigate; Periscan does not enrich-in-bulk beyond configured domains or mutate DomainTools data.
- ◷ **Flashpoint Flashpoint** — Flashpoint threat intelligence (illicit communities, leaked creds) as exposure signals.
- ✅ **Google VirusTotal** — Queries VirusTotal v3 search for tenant-configured IoCs and normalizes reputation context without uploading files, submitting URLs, or adding comments/votes.
- ✅ **Google Mandiant Advantage** — Enriches tenant-configured IoCs, CVEs, and threat actor names with Mandiant Advantage Threat Intelligence API v4 context through read-only lookups.
- ✅ **GreyNoise GreyNoise** — Queries GreyNoise Community API IP context for tenant-configured indicators and normalizes scanner, RIOT, and classification context without GNQL searches or write actions.
- ◷ **Group-IB Group-IB Threat Intelligence** — Group-IB threat intelligence (threat actors, compromised data) as exposure signals.
- ✅ **Intel 471 Intel 471** — Reads recent Intel 471 Titan finished-intelligence reports and normalizes adversary intel to exposure signals. Read-only reports; Periscan does not create watchers, export feeds, or mutate Intel 471 data.
- ✅ **Recorded Future Recorded Future** — Enriches tenant-configured CVEs and threat entity names with Recorded Future risk context through read-only APIs without creating lists, alerts, or feed subscriptions.
- ✅ **SecurityScorecard SecurityScorecard** — Reads SecurityScorecard company rating factors for a configured scorecard identifier and normalizes externally observed posture to exposure signals. Read-only ratings; Periscan does not modify scorecards, invite, or mutate SecurityScorecard data.
- ✅ **Spur Spur** — Looks up Spur anonymity/VPN/proxy context for tenant-configured IPs and normalizes anonymous-infrastructure exposure to signals. Read-only per-IP context; Periscan does not feed-export or mutate Spur data.
- ◷ **ThreatConnect ThreatConnect TIP** — ThreatConnect TIP indicators as exposure/threat-intel signals.
- ◷ **ZeroFox ZeroFox** — ZeroFox external/digital-risk-protection alerts (impersonation, leaks) as exposure signals.

### VM/EAP/ASM/CNAPP (40)

- ◷ **Aqua Security Aqua Platform** — Aqua CNAPP workload/image risk findings as cloud signals.
- ✅ **Armis Armis** — Imports authorized Armis device, unmanaged-asset, exposure, coverage-gap, and CVE context as normalized evidence without enforcing policy or changing assets.
- ◷ **ARMO Kubescape** — Kubescape Kubernetes posture + misconfiguration findings as cloud signals.
- ✅ **Assetnote Attack Surface Management** — Imports authorized Assetnote attack-surface asset and exposure summaries as normalized ASM context without launching scans or changing assets.
- ✅ **Axonius CAASM** — Imports authorized Axonius CAASM asset inventory and adapter coverage summaries as normalized asset context without enforcing policies or changing assets.
- ◷ **Bishop Fox Cosmos** — Bishop Fox Cosmos continuous attack-surface findings as exposure signals.
- ◷ **Brinqa Brinqa** — Brinqa risk-operations-center aggregated vulnerability findings as exposure signals.
- ◷ **Bugcrowd Bugcrowd** — Bugcrowd crowdsourced vulnerability submissions as exposure signals.
- ✅ **Censys Censys** — Runs a tenant-scoped Censys host search and normalizes internet-exposed services to exposure signals. Read-only: Censys host search only; Periscan does not scan on-demand or mutate Censys data, and never broad-scans the internet.
- ◷ **Claroty Claroty xDome** — Claroty xDome OT/IoT/IoMT asset inventory + exposure as asset/exposure signals.
- ◷ **CyCognito CyCognito** — CyCognito external attack-surface exposed-asset findings as exposure signals.
- ◷ **Cymulate Cymulate Exposure Validation** — Cymulate breach-and-attack-simulation control-validation results.
- ◷ **Detectify Detectify EASM** — Detectify EASM external-asset and vulnerability findings as exposure signals.
- ◷ **Dragos Dragos Platform** — Dragos ICS/OT vulnerability + threat-detection findings as exposure signals.
- ✅ **Fortinet FortiCNAPP** — Imports authorized Lacework/FortiCNAPP host vulnerability observations as normalized exposure context without triggering scans or changing vulnerability policies.
- ◷ **HackerOne HackerOne** — HackerOne crowdsourced vulnerability reports as exposure signals.
- ◷ **IONIX IONIX ASM** — IONIX attack-surface and digital-supply-chain risk findings as exposure signals.
- ◷ **Microsoft Defender for Cloud** — Microsoft Defender for Cloud CSPM/CWPP assessments as cloud signals.
- ◷ **Microsoft Defender EASM** — Microsoft Defender EASM external-attack-surface assets + observations as exposure signals.
- ◷ **Nucleus Security Nucleus** — Nucleus unified vulnerability-management aggregated findings as exposure signals.
- ✅ **Orca Security Orca** — Imports authorized Orca Security cloud-risk alerts as normalized CNAPP exposure context without changing Orca configuration or cloud resources.
- ✅ **Palo Alto Networks Prisma Cloud** — Imports authorized Prisma Cloud alert and resource summaries as normalized CNAPP exposure context without changing Prisma Cloud or cloud configuration.
- ✅ **Palo Alto Networks Cortex Xpanse** — Imports authorized Cortex Xpanse external attack-surface assets, services, exposures, high-risk observations, and CVEs as normalized evidence.
- ◷ **Pentera Pentera Automated Security Validation** — Pentera automated security validation (safe exploitation) results.
- ◷ **Picus Security Picus Security Validation** — Picus security control validation (BAS) results.
- ✅ **Qualys Qualys VMDR** — Imports authorized Qualys VMDR host and detection summaries as normalized exposure context without launching scans, creating reports, or presenting raw scanner output.
- ✅ **Rapid7 InsightVM** — Imports authorized Rapid7 InsightVM asset and vulnerability summaries as normalized exposure context without starting scans or presenting raw scanner tables.
- ✅ **runZero runZero** — Imports authorized runZero organization asset exports as normalized asset and exposure context without triggering scans or mutating runZero.
- ◷ **SafeBreach SafeBreach** — SafeBreach breach-and-attack-simulation control-validation results.
- ✅ **Shodan Shodan** — Runs a tenant-scoped Shodan host search and normalizes internet-exposed services/vulnerabilities to exposure signals. Read-only: Periscan does not scan on-demand, create network alerts, or mutate Shodan data, and never broad-scans the internet.
- ◷ **Stream Security Stream Security** — Stream Security real-time cloud posture and drift findings as cloud signals.
- ◷ **Sweet Security Sweet Security** — Sweet Security cloud runtime detection + risk findings as cloud signals.
- ✅ **Sysdig Sysdig Secure** — Reads Sysdig Secure runtime threat and CSPM posture events and normalizes them to cloud workload-risk signals. Read-only secure-events lookup; Periscan does not mutate Sysdig policies or data.
- ✅ **Tenable Tenable Vulnerability Management** — Imports authorized Tenable Vulnerability Management asset and vulnerability summaries as normalized exposure context without exposing raw scanner dumps. Complements RBVM — does not replace Tenable as the vulnerability system of record.
- ◷ **Tenable Tenable Cloud Security** — Tenable Cloud Security CNAPP/CIEM posture findings as cloud signals.
- ◷ **Tigera Calico Cloud** — Tigera Calico Cloud Kubernetes network-security + runtime findings as cloud signals.
- ◷ **Uptycs Uptycs** — Uptycs CNAPP/XDR detections as cloud signals.
- ◷ **Vulcan Cyber Vulcan Cyber ExposureOS** — Vulcan Cyber risk-based vulnerability-management findings as exposure signals.
- ✅ **Wiz Wiz** — Imports authorized Wiz cloud resources and security issue summaries as normalized CNAPP exposure context without changing cloud or Wiz configuration. Complements CNAPP — does not replace Wiz.
- ◷ **XM Cyber XM Cyber Exposure Management** — XM Cyber attack-path and choke-point exposure findings as exposure signals.

### WAF/Firewall (21)

- ✅ **Akamai Kona Site Defender** — Reads authorized Akamai SIEM security events for WAF control validation.
- ◷ **Akamai Noname API Security** — Akamai Noname API security alert evidence for control validation.
- ◷ **Akamai Guardicore Segmentation** — Akamai Guardicore microsegmentation block/detect evidence for control validation.
- ✅ **AWS AWS WAF** — Reads authorized AWS WAFv2 web ACL posture and associated resource coverage without changing AWS configuration.
- ◷ **Check Point Quantum Security Gateway** — Check Point Quantum firewall/threat-prevention log evidence for control validation.
- ◷ **Cisco Secure Firewall** — Cisco Secure Firewall (Firepower) intrusion/connection evidence for control validation.
- ✅ **Cloudflare Cloudflare** — Reads authorized Cloudflare zones, DNS records, and WAF/ruleset posture for exposure and control validation.
- ◷ **DataDome DataDome** — DataDome bot/fraud-protection block/detect evidence for control validation.
- ◷ **F5 BIG-IP** — F5 BIG-IP Advanced WAF (ASM) request-block evidence for control validation.
- ✅ **Fastly Next-Gen WAF** — Reads authorized Fastly Next-Gen WAF event evidence for WAF control validation.
- ✅ **Fortinet FortiGate** — Reads authorized Fortinet FortiGate FortiOS system status and firewall policy monitor evidence for firewall control validation.
- ◷ **HUMAN Security HUMAN Bot Defender** — HUMAN Security bot-mitigation block/detect evidence for control validation.
- ◷ **Illumio Illumio Zero Trust Segmentation** — Illumio microsegmentation enforcement/blocked-flow evidence for control validation.
- ✅ **Imperva Cloud WAF** — Reads authorized Imperva Cloud WAF site and WAF-rule posture for WAF control validation.
- ✅ **Microsoft Azure Front Door WAF** — Reads authorized Azure Front Door WAF policy posture and protected endpoint coverage without changing Azure configuration.
- ✅ **Palo Alto Networks Panorama** — Reads authorized Palo Alto Networks Panorama/PAN-OS traffic, threat, or URL log evidence for firewall control validation.
- ◷ **Radware Radware Cloud WAF** — Radware Cloud WAF/DDoS block/detect evidence for control validation.
- ◷ **Salt Security Salt Security API Protection** — Salt Security API attack detection evidence for control validation.
- ◷ **Traceable Traceable API Security** — Traceable API-security threat detection/protection evidence for control validation.
- ◷ **Zero Networks Zero Networks Segment** — Zero Networks automated microsegmentation/MFA enforcement evidence for control validation.
- ✅ **Zscaler Zscaler Internet Access** — Reads authorized Zscaler Internet Access firewall filtering policy posture for cloud firewall control validation.
