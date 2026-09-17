# Periscan Full Product PRD + Technical Specification

> **Not shipped product claims. Not GitHub GTM.** This is an internal vision /
> backlog document. Community edition and public copy follow
> [`docs/SETTLED.md`](SETTLED.md), [`docs/competitive/POSITIONING.md`](competitive/POSITIONING.md),
> and [`COMMUNITY.md`](../COMMUNITY.md). Do not read “full BAS”, “automated
> pentest”, or “full product complete” here as current product truth.

## Product Name

Periscan

## Product Category

Self-service Automated Security Validation platform

## Core Product Promise

Find the path. Validate the risk. Prove it's fixed.

## One-Sentence Product Definition

Periscan validates exposure, controls, attack paths, AI applications, and fixes - then turns the results into proof customers can use.

## Founder / Market Context

Periscan was founded in 2004 by Sean Heiney around continuous, attacker-informed security assessment. The new Periscan is being rebuilt in 2026 as a self-service Automated Security Validation platform for the modern attack surface: cloud, identity, SaaS, code, AI applications, internal systems, and security controls.

Internal market context: the uploaded Frost report frames Automated Security Validation as a market converging across autonomous penetration testing, red-team automation, breach-and-attack simulation, and continuous exposure management, with emphasis on evidence-based risk, SecOps integrations, RemOps, AI-specific validation, MSSP delivery, and audit-ready evidence. Treat that report as internal strategy material only.

## 1. Product Vision

Periscan is the validation and proof layer for modern security.

Security teams already have scanners, EDR, SIEM, cloud alerts, tickets, dashboards, compliance screenshots, and pentest PDFs.

They still struggle to answer:

- What can actually compromise us?
- Would our controls catch it?
- Which path matters most?
- What should we fix first?
- Did the fix actually work?
- Can we prove it?

Periscan answers those questions by continuously validating exposure, controls, attack paths, AI applications, and remediation outcomes.

The product is not a scanner dashboard. It is not a traditional pentest. It is not a generic BAS tool. It is an evidence-backed validation system.

Third-party validation tools must also move through evidence-backed proof. A newly proposed OSS/security tool is not usable until Periscan can certify reviewed catalog metadata, module/capability implementation, required evidence, tenant governance, runtime readiness, runner prerequisites, policy gates, and safety boundaries through API-visible reports.

## 2. Product Principles

### 2.1 Proof Over Findings

Periscan should not primarily show raw scanner findings.

It should show:

- validated exposure
- attack paths
- control verdicts
- remediation actions
- verification status
- evidence packs

Raw tool output belongs in a technical appendix, not the main product experience.

### 2.2 Self-Service, Not Low-End

Periscan should be easy to start, but it should not feel cheap or small.

The product should feel premium, serious, and capable of serving security teams, SaaS companies, AI product teams, MSSPs, vCISOs, business units, and enterprise programs.

### 2.3 AI in the Workflow, Not the Headline

AI should help Periscan:

- choose what to validate
- correlate signals
- explain attack paths
- prioritize remediation
- write fix steps
- re-test fixes
- generate evidence

But the validation must prove itself. AI output must be evidence-grounded.

### 2.4 Safety Is Product

Periscan must be safe enough to run continuously.

Rules:

- verified customer scope required
- no destructive actions
- no real data exfiltration
- no persistence
- no credential theft
- no uncontrolled exploit chaining
- no unauthorized third-party testing
- policy approvals for sensitive validation
- audit logs for all validation
- clear test boundaries
- emergency kill switch

### 2.5 Land With Proof, Expand Into Platform

The first product experience is the Validation Snapshot.

Expansion path:

Land with Validation Snapshot → master the 6 Pillars (ASV/EASM, APV, SCV, DRV, CSV, EXV) via Marketplace Packs + continuous schedules → Agentic BAS + Virtual Analyst (Find-Fix-Verify) → closed-loop RemOps + automated attestations → Unified Fabric + Deep Integrations → full Emerging/Edge + MSSP multi-tenancy scale with Evidence Packs, Internal Runner, and billing enforcement.

The 6 Pillars + layers (BAS, Agentic, RemOps, Quant/Compliance, Fabric, Edge) are the mandatory coverage to dominate the sector. See 3.0 for taxonomy and 3.9+ for advanced layers.

## 3. Product Modules

### 3.0 The 6 Pillars (Mandatory Core Capabilities for Sector Dominance)

Periscan unifies six validation disciplines into a single self-serve console with shared evidence, paths, CTEM/EXV scoring, RemOps, attestations, and marketplace-distributed content. Pillars are first-class: selectable in pickers/schedules, produce specialized verdicts + evidence that roll up into unified EXV risk dashboard + compliance packs. All built on safe, policy-gated execution (control-plane, Internal Runner, or agentic orchestration) and governed via the OSS Package Marketplace (Threat Library + Attack Packs).

The six pillars:

1. **Attack Surface Validation (ASV) / External Attack Surface Management (EASM)**: Continuous external asset discovery, exposure mapping, and reachability validation across internet-facing assets, SaaS, and cloud.
2. **Attack Path Validation (APV)**: Modeling and validation of chained attack paths across hybrid networks, exposure graphs, choke-point analysis, and business-impact prioritization.
3. **Security Control Validation (SCV)**: Empirical testing of control effectiveness (URL filtering, detection analytics for Mac/Linux/Windows, EDR/SIEM/XDR rules, email security, etc.).
4. **Detection Rule Validation (DRV)**: Continuous, safe testing that SIEM/EDR/XDR/MDR detection rules fire accurately against real threats (emulated + observed).
5. **Cloud Security Validation (CSV)**: Dedicated validation for cloud infrastructure, Kubernetes, containers, IaC posture, and CSPM findings.
6. **Exposure Validation (EXV)**: Trend tracking, validation-aware risk scoring (including business impact: financial/regulatory/operational), exploitability-driven prioritization, and the dynamic EXV/CTEM risk dashboard.

Pillars are implemented via:

- Reusable safe modules/profiles (packages/modules + OSS marketplace "PillarPacks" and "AttackPacks").
- Unified evidence graph + VerdictCard variants.
- Pillar-aware pickers, schedules, and continuous runs.
- Rollup into EXV dashboard, business scoring, and automated compliance attestations (DORA, NIS2, SEC, GDPR, PCI DSS, ISO 27001, EU AI Act/ISO 42001).

See 3.1–3.6 for detailed module coverage and 3.9+ for BAS/agentic layers built on the pillars.

### 3.1 Validation Snapshot

The Validation Snapshot is the land-and-expand wedge.

It is a focused first report that gives the customer a fast proof moment.

User Question

"What can Periscan prove about our environment right now?"

Inputs

- verified domain
- cloud account
- identity provider
- code repository
- SaaS system
- AI app endpoint
- security control integration
- optional internal runner

Outputs

- top validated exposure paths
- control observations
- AI app risks, if applicable
- attack-path evidence
- business impact
- remediation priorities
- verification plan
- evidence summary
- technical appendix

Requirements

- Must be usable without deploying internal software.
- Must support API-first onboarding.
- Must produce 3-5 high-value results, not 500 findings.
- Must show evidence and remediation for every result.
- Must include a verification plan.
- Must be exportable as HTML and PDF.

### 3.2 Continuous Exposure Validation

Validates which exposures are real, reachable, exploitable, detected, blocked, mitigated, fixed, or reopened.

Coverage

- external assets
- cloud resources
- identity paths
- SaaS posture
- code and secrets
- containers
- Kubernetes
- internal exposure
- AI apps
- vulnerabilities from existing VM/EAP tools
- asset context from CAASM/ASM tools

Validation States

- Discovered
- Reachable
- Validated
- Exploitable
- Detected
- Blocked
- Mitigated
- Inconclusive
- Fixed
- Reopened

Requirements

- Support recurring validation schedules.
- Detect drift and reopened exposure.
- Separate theoretical findings from validated risk.
- Support CTEM-style reporting:
- scope
- discover
- prioritize
- validate
- mobilize
- verify

### 3.3 Control Validation

BAS-lite validation for security controls.

User Question

"Do our controls actually work?"

Controls

- EDR
- XDR
- SIEM
- SOAR
- MDR
- WAF
- firewall
- email security
- MFA
- cloud guardrails
- AI guardrails
- logging platforms
- ticketing / response workflows

Outcomes

- Detected
- Blocked
- Logged
- Alerted
- Routed
- Missed
- No Evidence
- Needs Tuning

Requirements

- Validate whether controls detect, block, log, alert, and route.
- Map scenarios to MITRE ATT&CK where applicable.
- Provide control tuning recommendations.
- Support before/after control trend reporting.
- Support evidence for control validation.

Atomic Red Team is a good initial open-source content source because it provides portable tests mapped to MITRE ATT&CK.

### 3.4 Attack-Path Validation

Maps and validates realistic paths to impact.

Example Paths

- repo secret -> cloud role -> production data
- identity gap -> privileged access -> business system
- external service -> vulnerable host -> internal reachability
- AI assistant -> RAG abuse -> restricted content
- missed control -> undetected activity -> real exposure

Core Concepts

- path
- entry point
- intermediate step
- impact target
- control response
- path breaker
- business impact
- verification plan

Requirements

- Generate graph-based attack paths.
- Identify "path breakers" that reduce the most risk.
- Show evidence for each path edge.
- Show control response where available.
- Show MITRE ATT&CK mapping where applicable.
- Support before/after comparison after remediation.

BloodHound Community Edition is a useful reference or module for identity attack-path analysis across Active Directory and Entra ID.

### 3.5 AI App Security Validation

Validates AI applications, RAG systems, copilots, agents, and tool-calling workflows.

User Question

"Can our AI app leak data, misuse tools, or violate policy?"

Coverage

- prompt injection
- RAG authorization failure
- sensitive data leakage
- unsafe tool invocation
- agent over-permissioning
- system prompt exposure
- cross-tenant retrieval
- guardrail drift
- AI security review evidence

Outcomes

- Passed
- Failed
- Inconclusive
- Leakage Observed
- Unauthorized Retrieval Observed
- Unsafe Tool Call Attempted
- Unsafe Tool Call Blocked
- Guardrail Bypassed
- Guardrail Held
- Regressed

Requirements

- Register AI apps and endpoints.
- Support test accounts and customer-defined scope.
- Run safe validation tests only.
- Redact sensitive outputs.
- Generate AI security evidence packs.
- Support baseline and drift comparison.

Promptfoo, PyRIT, and similar tools are good candidates for AI-app validation because they support LLM red teaming, RAG-oriented testing, and generative-AI risk identification.

### 3.6 Fix Verification

Re-tests remediation and proves whether risk actually closed.

### 3.7 RemOps & Closed-Loop Mitigation (Mandatory)

Finding the gap is not enough; Periscan actively closes it:

- Auto-Mitigate: One-click control tuning and automated safe execution of fixes (where policy + classification allows).
- Prescriptive Mitigation Planning: Dedicated "Planner" feature providing step-by-step mitigation suggestions, workflows, and IaC/ticket previews.
- Automated Revalidation: Automatically re-trigger pillar/BAS/FixVerification simulations after a fix to mathematically verify closure (before/after evidence + EXV delta).
- ITSM/SOAR/IaC Automation: Deep API integrations (ServiceNow, Jira, etc.) to auto-generate tickets with full EvidencePack/attestation links and push infrastructure-as-code updates.

RemOps is the closed loop on top of FixVerification + pillars + agentic. All changes produce auditable verification events and updated risk/paths.

See 4.x (new) and remediation/fix services + marketplace for fix packs.

User Question

"Did the fix work?"

Outcomes

- Fixed
- Partially Fixed
- Still Exposed
- Mitigated
- Inconclusive
- Reopened
- Closed Without Evidence

Requirements

- Link remediation to exposure, path, or control failure.
- Track ticket status.
- Detect closed-without-verification.
- Trigger targeted re-test.
- Create verification event.
- Update attack path and risk score.
- Update evidence pack.

### 3.7 Evidence Packs

Role-specific reports that turn validation into proof.

Evidence Pack Types

- Executive Risk Summary
- Customer Security Review Pack
- Cyber Insurance Evidence Pack
- SOC 2 / ISO Support Pack
- PCI Support Pack
- BAS / Control Validation Report
- AI Security Validation Report
- CTEM Program Summary
- MSSP Client QBR
- Technical Appendix
- Remediation Closure Pack

Requirements

- Reports must be generated from normalized evidence.
- Reports must include evidence IDs.
- Reports must redact sensitive data.
- Reports must support different audiences.
- Reports must export as HTML and PDF.
- Reports must support white-labeling for MSSPs.

### 3.8 Periscan Operators

AI-assisted validation workflows, not hypey "agents."

### 3.9 Advanced Threat Simulation & Full AI-Powered BAS (Mandatory)

Periscan provides empirical, attacker-informed simulation beyond "lite" or theoretical data:

- AI-Powered Breach Attack Simulation (BAS) with multi-agent orchestration and conversational threat builder (powered by Model Gateway + Operators).
- Continually Updated Threat Library: MITRE ATT&CK-mapped scenarios and Attack Packs delivered and evolved via the OSS Package Marketplace (enable/load like any tool; upstream checks for freshness).
- Agent-Based and Agentless Execution: Picker choice; runner for agent-based, control-plane/connectors for agentless web/app sims, autonomous safe pentest flows.
- Multi-Vector Attack Scenarios: Safe, production-ready simulations (malware, email, app, infrastructure, identity abuse, data exfil over DNS, etc.).
- Dynamic Attack Paths: Simulations that adapt in real time based on live environmental context from the evidence graph/EXV.
- Automated Scheduling: Unattended continuous BAS + pillar validation for trending without manual intervention.

BAS missions compose multiple pillars, produce unified EvidencePacks + EXV impact, and feed Find-Fix-Verify loops. All safe by policy (no disruptive live offensive without explicit controlled classification + approval).

**Competitive Swarm Architecture Requirements (to dominate vs NodeZero/Armadin/etc.):**

Core AI Engine ("The Brain"):

- Multi-agentic swarm orchestration with 10+ specialized agents: Recon, Credential Harvester, Lateral Mover, Exploit Chain Builder, Data Pilferer, Evasion Specialist, Social Eng Simulator, Web/App Specialist, Cloud Config Breaker, Identity/SSO Cracker, and more (dynamically spawned or persistent).
- Full agentic reasoning + planning + adaptation loop: reason → plan → execute (safe modules/runner) → observe → replan in real-time. Target 95%+ autonomy with tunable human-in-the-loop (1-3 decision points per campaign).
- Hybrid AI stack: Self-expanding Graph knowledge base (Cyber Terrain Map equivalent built on evidence graph + persistent memory), classical ML for classification/prioritization, deterministic exploit engines (safe), scoped GenAI/LLMs for narrative/plan generation, custom fine-tuned models on red-team playbooks + breach data. Verification layer to eliminate hallucinations.
- Self-improving collective intelligence: Learns from every (anonymized opt-in) customer campaign + internal simulations; "what-if" simulation engine for proposed fixes/config changes.
- Safety engine: Blast-radius controls, kill-switches, scoped execution, zero-disruption guarantees, behavioral anomaly detection (sim vs real), audit-proof logs. Integrated with existing policy-enforcement and scope-filter.

Deployment & Onboarding:

- Zero-touch SaaS + optional on-prem/air-gapped/Managed Control Plane + hybrid.
- One-click connectors for AWS/Azure/GCP (org-level), Kubernetes, AD/Entra ID, EDR/XDR (CrowdStrike etc.), vuln scanners, etc.
- Lightweight: Docker/OVA/VM for internal (agentless-first, optional beacon), cloud-native external runner, full agent swarm in isolated VPCs.
- Scoped campaigns with auto-discovery, consent boundaries, compliance presets (PCI, NIS2, FedRAMP, SOC2, etc.).
- Multi-tenant MSSP/MSP mode + peer benchmarking.

Asset Discovery & Attack Surface (EASM + CAASM + Full Internal):

- Passive + active recon swarm: OSINT, DNS, CT, people profiling, shadow IT/SaaS, supply-chain mapping.
- Continuous attack surface inventory, risk scoring, change detection, living visual graph (assets, identities, trusts, data flows).
- Expanded coverage: External + Internal + Cloud + K8s/Containers/Serverless + Web Apps/APIs + Mobile + IoT/OT + LLMs/Code Repos + Backups/Hypervisors + IdPs + SaaS/3rd Party + Email/Collaboration.

Recon & Intelligence:

- Quiet parallel recon swarm for hosts/services/people/defenses/configs/exposed secrets.
- Adaptive OSINT + threat intel (STIX/TAXII + curated).
- Real-time learning + persistent memory of prior campaigns (total recall).

Attack Simulation & Exploitation (Core Engine – More Relentless):

- Full kill-chain chaining: Credential → Lateral → PrivEsc → Persistence → Exfil/Pilfer → Ransomware sim → Domain compromise → Web/API takeovers → Cloud breakout → Identity forgery, etc.
- Parallel precision strikes with 50k+ evolving exploit templates + live CVE/0-day (Rapid Response).
- Specialized autonomous modules: AD/Entra/Identity audits + spraying/cracking sim; Phishing/social impact testing (safe payloads); Endpoint/EDR/XDR effectiveness (harmless RAT, bypass checks); High-Value Targeting + Data Pilfering + Sensitive Data proof; K8s/cloud misconfig chaining, web/API exploits, LLM prompt injection.
- Differentiators: Multi-modal (network+app+human+code+AI-specific), supply-chain sim, physical proxy, custom scripting/API for red-teamers, "hyperattack" machine-speed parallel swarms.

See Model Gateway (swarm orchestrator), Runner (agent execution), Marketplace (exploit/attack packs), Evidence Graph (terrain).

See 3.0 (Pillars) and Model Gateway / Marketplace for implementation.

### 3.9.1 Full Competitive Feature Requirements (1-13) — Market Analysis Thread 2026-07-03

The following exhaustive feature and function list was identified as necessary to be competitive (surpass NodeZero, Horizon3/Armadin etc.). Periscan implements this as a modular, API-first platform:

- Freemium/light external scan tier (limited ASV/EASM via billing catalog free tier or light package, zero-touch SaaS entry point to drive adoption; full swarm/ internal requires paid packs).
- Core IP focus: agent swarm orchestration + self-expanding knowledge graph (evidence graph as Cyber Terrain) + safety layer first.
- All other surfaces built on top: discovery, recon, kill-chain sim, analysis, remediation, verification, reporting, integrations, UI extensibility via Marketplace + full API/CLI/TF/webhooks.

**1. Core Architecture & AI Engine (The "Brain" – Must Surpass Both)**

Multi-agentic swarm orchestration (10+ specialized agents: Recon, Credential Harvester, Lateral Mover, Exploit Chain Builder, Data Pilferer, Evasion Specialist, Social Eng Simulator, Web/App Specialist, Cloud Config Breaker, Identity/SSO Cracker, etc.).
Full agentic reasoning + planning + adaptation loop (reason, plan, execute, observe, replan in real-time; 95%+ autonomy with tunable human-in-loop at 1-3 decisions/campaign).
Hybrid AI stack: Graph knowledge base (like Horizon3's Cyber Terrain Map, but self-expanding), classical ML for classification, deterministic exploit engines, scoped GenAI/LLMs for narrative/prioritization, custom fine-tuned models trained on red-team playbooks + real breach data (no hallucinations guaranteed via verification layer).
Self-improving collective intelligence: Learns from every customer run (anonymized, opt-in) + your own simulations; includes "what-if" simulation engine for proposed fixes or new configs.
Safety engine: Blast-radius controls, kill-switches, scoped execution, zero-disruption guarantees, behavioral anomaly detection (to distinguish sim from real attacks), audit-proof logs.

**2. Deployment & Onboarding (Faster/Easier Than NodeZero's "Minutes" Setup)**

Zero-touch SaaS + optional on-prem/air-gapped/Managed Control Plane (like Horizon3 MCP) + hybrid.
One-click connectors: AWS/Azure/GCP org-level, Kubernetes, AD/Entra ID, major EDR/XDR, vuln scanners, etc.
Lightweight options: Docker/OVA/VM for internal (agentless-first, optional lightweight beacon for deeper access), cloud-native external runner, or full agent swarm deployable in isolated VPCs.
Scoped campaigns with auto-discovery of assets + consent-based boundaries + compliance presets (PCI, NIS2, FedRAMP, SOC2, etc.).
Multi-tenant MSSP/MSP mode + peer benchmarking out-of-the-box.

**3. Asset Discovery & Attack Surface Management (EASM + CAASM + Full Internal)**

Passive + active recon: OSINT, DNS, certificate transparency, people profiling (LinkedIn-style), shadow IT/SaaS discovery, third-party/supply-chain mapping.
Continuous attack surface inventory with risk scoring, change detection, and "living map" (visual graph of all assets, identities, trusts, data flows).
Expanded coverage beyond competitors: External + Internal + Cloud + K8s + Containers/Serverless + Web Apps/APIs + Mobile + IoT/OT + LLMs/Code Repos + Backups/Hypervisors + Identity Providers + SaaS/3rd Party + Email/Collaboration.

**4. Reconnaissance & Intelligence Gathering**

Quiet parallel recon swarm (hosts, services, people, defenses, configs, exposed creds/secrets).
Adaptive OSINT + threat intel ingestion (custom + STIX/TAXII + your curated feeds).
Real-time environment learning + persistent memory of prior campaigns (total recall of findings).

**5. Attack Simulation & Exploitation (The Core Engine – Must Be More Relentless/Broad)**

Full kill-chain chaining: Credential attacks → Lateral movement → Privilege escalation → Persistence → Data exfil/pilfering → Ransomware simulation → Domain compromise → Web app takeovers → Cloud breakout → Identity forgery → etc.
Parallel precision strikes with 50k+ evolving exploit templates + live CVE/0-day injection (Rapid Response module).
Specific modules (all autonomous):
AD/Entra/Identity audits + password spraying/cracking simulation.
Phishing + social engineering impact testing (with safe simulated payloads).
Endpoint/EDR/XDR effectiveness testing (harmless RAT simulation, bypass checks – expand Horizon3 ESE).
High-Value Targeting + Advanced Data Pilfering + Sensitive Data Exposure proof.
Kubernetes/cloud misconfig chaining, web app/API exploits, LLM prompt injection simulation.

Differentiators to beat: Multi-modal (network + app + human + code + AI-specific), supply-chain attack sim, physical access proxy (if applicable), custom attack scripting/API for red-teamers, and "hyperattack" speed mode (machine-speed parallel swarms that outpace real AI attackers).

**6. Analysis, Prioritization & Insights**

Visual attack path graphs + step-by-step replays + proof-of-exploit evidence (screenshots, logs, timelines).
Risk scoring tied to business impact ($$ loss estimates, crown-jewel compromise probability) + threat actor mapping.
Vulnerability Management Hub + Risk-Based Prioritization that shows "fix this one change → eliminates X% of paths".
Superior extras: Generative executive/board narratives, "Are we secure?" one-page score with confidence %, predictive breach simulation, purple-team collaboration tools, anomaly detection on your own controls.

**7. Remediation & Action**

Actionable, step-by-step fix guidance (systemic + per-issue) with scripts/PowerShell/Ansible snippets.
Prioritization explicitly by "break entire kill chains" (Armadin strength, but automated + visualized).
Beat them: One-click integration to auto-create Jira/ServiceNow tickets + suggested auto-remediation playbooks + direct hooks to patch management/Infra-as-Code tools. Built-in "remediation simulator" to test fixes before applying.

**8. Verification & Continuous Assurance**

Instant re-test / 1-click verify + continuous scheduled/ event-triggered campaigns.
Tripwires + behavioral detectors + Rapid Response to new threats.
Advanced: Continuous passive monitoring + active "health checks," auto-baselining of security posture over time, compliance evidence export, and "fix effectiveness score" trending.

**9. Reporting, Dashboards & Collaboration**

Real-time dashboard + campaign views + exportable reports (PDF, interactive).
Role-based views (CISO summary, analyst deep-dive, board deck, auditor export).
Beaters: AI chat interface ("explain this path," "simulate fix"), shareable interactive attack replays, MSSP white-label, export to all major tools, and peer/industry benchmarking.

**10. Integrations & Extensibility**

Bi-directional with SIEM/SOAR/EDR/XDR/Vuln Mgmt/Ticketing/Cloud APIs/Compliance tools.
Full API + CLI + Terraform provider + webhook ecosystem.
Open extensibility: Bring-your-own agents/threat intel/custom exploits, marketplace for community modules, SDK for red-team customizations.

**11. UI/UX, Usability & Operations**

Intuitive modern portal (drag-drop scopes, visual builder for campaigns, mobile app).
Setup in <5 minutes for basic, full env in <30.
Superior: Gamified training mode for teams, simulation replay video, natural language campaign creation ("test ransomware paths to domain controllers").

**13. Differentiators & "Beat" Features (What Makes You Win)**

True swarm superiority + broader surfaces + higher autonomy + predictive/what-if + partial auto-remediation hooks.
Cost/risk quantification dashboard + ROI calculator ("saved X hours vs manual pentests").
Open-source elements or community edition to build ecosystem.
Partnerships-ready (e.g., XDR vendors, like Armadin/Palo) + white-glove MSSP layer.
Future-proof: Native support for emerging (AI agent attacks, quantum-safe testing, etc.).
Transparency: Full explainability logs + "red team approved" certification.

**Implementation Notes (In-Repo, Honest):**

- Core swarm (10+ agents, agentic loop, hybrid KB via evidence graph + queryCyberTerrainMap/verifyPlanGrounded/runAgenticSwarmLoop), safety (computeSwarmSafety + policy PEP + kill switches), kill-chain + 50k+ stubs + specialized modules, hyperattack, self-improving what-if, AI chat/Virtual Analyst already in packages/model-gateway/src/engine/orchestrator.ts + turn-runner.ts + evidence/graph + policy + shared.
- Living map, recon swarms, broad ASM coverage via connectors + modules + threat-center visual.
- Remediation simulator, replays, role views, NL campaign hints via model-gateway-workbench + reports + operators.
- Continuous verify, tripwires, attest via scheduled non-snap + FixVerification + packTypes + CTEM.
- API-first: all via Fastify routes; Marketplace for packs/agents/ext; billing for freemium tier.
- No real destructive exploits; all safe fixtures, scoped, verified, policy-gated. Gaps (real fine-tunes, live 0day feed, physical proxy) noted honestly as future/out-of-safe-scope.
- Modular: packages/\* + OSS registry-center for enable/load/evolve.

See also 3.0 Pillars, 3.9 BAS, 3.10 Agentic, 3.11-13, architecture section 4, and SRC-COMPETITIVE-SWARM-2026 in ledger.

### 3.10 Agentic AI & Virtual Security Operations (Mandatory)

Leverage generative and agentic AI to replace fragmented manual processes:

- Virtual Security Analyst: Embedded AI assistant (conversational interface) that automates triage, prioritization, reporting, and guidance across pillars, BAS, findings, and RemOps (similar to "Numi AI" style).
- Real-Time "Find-Fix-Verify" Workflows: Structured reasoning architectures combining graph-based search (evidence paths), LLM reasoning (via Frontier/Model Gateway), and deterministic exploitation (safe modules/runner) to automate the entire exposure lifecycle.

The Model Gateway + Operators become the agentic core. Virtual Analyst surfaces in model-gateway-workbench and threat-center. All actions policy-gated, evidence-cited, auditable.

### 3.11 Business-Centric Risk Quantification & Compliance (Mandatory)

Translate technical findings into business impact and regulatory proof:

- Automated Compliance Attestations: Audit-ready Evidence Packs proving control effectiveness for DORA, NIS2, SEC rules, GDPR, PCI DSS, ISO 27001, and EU AI Act / ISO 42001.
- Business Impact Scoring: Quantifying risk based on financial impact, regulatory exposure, and operational disruption (dynamic EXV dashboard).
- AI Control Validation: Offensive security test suites for AI-native controls (guardrails, RAG, agents) aligned with EU AI Act.

New packTypes + renderers in reports. Scoring extends risk/evidence packages. EXV dashboard surfaces scores and compliance posture.

### 3.12 Unified Data Fabric & Ecosystem Interoperability (Mandatory)

Act as the connective tissue for the enterprise security stack:

- Unified Data Fabric: Ingest and correlate siloed datasets (vulnerability scans, asset inventories, EDR alerts, CSPM findings) from the existing tech stack into the evidence graph for pillar validation seeding.
- Deep Native Integrations: Out-of-the-box for CrowdStrike, Wiz, Datadog, Palo Alto XSIAM, VMware vCenter, Tenable, IBM QRadar, CSPMs, and SIEMs (manifest-driven adapters + observers; reduce noise by correlating external signals into Periscan verdicts/paths).

Enhances connectors/signal fabric. "Validate this external finding" flow.

### 3.13 Emerging & Edge Capabilities (Mandatory Innovation Roadmap)

- SSPM/SaaS Validation: Testing configuration and posture of third-party SaaS applications (extend SaaS pillar coverage + marketplace packs).
- Identity-Centric Controls Validation: Simulating advanced identity abuse, credential harvesting, lateral movement (safe scenarios feeding APV/SCV).
- Software Supply Chain Security (SSCS) Validation: CI/CD pipelines and third-party dependencies (SBOM, signed artifacts, dep vulnerabilities via OSS modules/marketplace).
- OT/ICS Attack Packs: Specialized, non-disruptive validation packs for Operational Technology and Industrial Control Systems (safe, marketplace-distributed, runner-supported).
- Multi-Tenancy for MSSPs: Flexible licensing, short-term assessment packs (marketplace time-boxed), robust multitenant architectures for co-managed ASV services, portfolio views, and client-specific attestations.

See Marketplace (for packs), Runner, Tenant/MSSP billing, and 3.0 pillars.

### 3.x Frontier Gateway (Model + Agentic Core)

Operators

Red Team Operator

Builds safe attack scenarios and validates realistic paths.

Blue Team Operator

Checks whether controls detect, block, log, alert, and route correctly.

Exposure Operator

Finds which exposures are real, reachable, exploitable, blocked, or noise.

Remediation Operator

Turns validated risk into fix plans, tickets, and re-tests.

Evidence Operator

Creates proof for customers, auditors, insurers, boards, and executives.

AI App Security Operator

Validates AI apps, RAG systems, copilots, agents, tools, and guardrails.

Requirements

- Operators recommend missions.
- Operators never execute without policy approval.
- Operators must cite evidence IDs.
- Operators must label uncertainty.
- Operators must not invent outcomes.
- Operators must respect safety levels.

### 3.x Frontier Gateway

A policy-controlled control plane that lets a customer-supplied frontier model (BYO OpenAI/Anthropic-compatible API key) drive the operators above by reasoning over redacted evidence and requesting typed Periscan tools. Core rule: the model thinks, Periscan controls, evidence proves.

Capabilities

- BYO providers: customers register their own OpenAI-compatible / Anthropic-compatible (or customer-private/local) endpoints and API keys. There is no Periscan-hosted model. The adapter layer is provider-pluggable so a future specialized cyber model is a new adapter only.
- Sessions and modes: a session binds a provider, a policy profile, scopes, and a mode (`PlanOnly`, `ReadOnlyEvidence`, `SafeValidation`, `GuidedRemediation`, `HighAssurance`) that gates which tools are available.
- Context broker: builds a minimal context bundle from session scopes and runs everything through redaction before any model input; honors `allowRawEvidence=false` and sensitivity limits.
- Typed tool catalog: code-defined tools with input/output schemas, safety class/level, required role, approval default, and allowed modes. Read-only/plan tools map to evidence/operators services; action tools route through `previewPolicyDecision` -> `createMission` -> `startMission` and remediation/report services.
- Turn orchestrator: runs on a queue, calls the provider with tool schemas + redacted context, and for each tool call applies a Policy Enforcement Point before any execution.

Requirements

- No model gets direct network or shell access; typed tools only.
- The model never receives raw secrets; BYO API keys are encrypted at rest and never returned on read.
- Every tool request is policy-checked (`Allowed`/`RequiresApproval`/`Denied`), audited, and evidence-linked.
- Denied requests never queue an underlying action; sensitive action tools are approval-gated.
- A risk can never be marked fixed without a real verification event.
- Tenant isolation and verified-scope enforcement apply to every tool; a per-tenant kill switch and session timeout halt activity.

## 4. System Architecture

### 4.1 High-Level Components

SaaS Control Plane

Main customer application.

Responsibilities:

- tenant management
- user management
- integrations
- validation missions
- evidence graph
- attack paths
- control validation
- AI app validation
- remediation
- fix verification
- reporting
- billing/metering
- audit logs

API Connectors

Agentless integrations into:

- cloud
- identity
- SaaS
- code repositories
- EDR/XDR
- SIEM
- SOAR
- WAF/firewall
- ticketing
- AI apps
- VM/EAP/ASM/CNAPP tools

External Point of Attack

Periscan-hosted outside-in validation.

Used for:

- external exposure validation
- WAF validation
- firewall validation
- internet-facing service checks
- domain / DNS / TLS checks
- outside-in attack-path initiation

Internal Runner

Optional lightweight outbound-only runner (full spec: [RUNNER_SPEC.md](RUNNER_SPEC.md)).
GAP-OSS-AGENT-01 resolved: outbound-only signed-task transport, no reverse SSH / arbitrary
shell / tunnel in MVP. The runner authenticates with an mTLS client certificate plus bearer
token over TLS and enforces signed tasks (identity/tenant/expiry/nonce-replay), a local
module + safety-level allowlist, local scope, a customer kill switch, and an accept/reject
task lifecycle.

Used for:

- internal reachability
- segmentation validation
- control testing
- internal attack paths
- fix verification
- internal AI app validation

Evidence Graph

System of record for:

- assets
- identities
- permissions
- controls
- exposures
- signals
- validation runs
- attack paths
- remediation tasks
- verification events
- evidence artifacts
- reports

## 5. Recommended Tech Stack

Monorepo Structure

```text
apps/
  web/
  api/
  worker/
  runner/
packages/
  shared/
  db/
  policy/
  evidence/
  connectors/
  modules/
  reports/
  risk/
  operators/
infra/
  docker-compose/
  terraform/
docs/
  PRD.md
  ARCHITECTURE.md
  SECURITY_BOUNDARIES.md
  OPEN_SOURCE_POLICY.md
  CODEX_TASKS.md
```

Frontend

- Next.js
- TypeScript
- Tailwind or equivalent design system
- React Query or TanStack Query
- Zod schemas from shared package

Backend

- TypeScript
- Fastify or NestJS
- Prisma
- PostgreSQL
- Redis + BullMQ for MVP queue
- MinIO locally for S3-compatible evidence storage

Worker

- TypeScript worker process
- executes module jobs
- stores raw evidence
- normalizes output
- updates evidence graph

Runner

- Go
- outbound-only
- mTLS
- signed tasks
- local scope enforcement
- signed modules
- local audit logs

Evidence Store

- S3-compatible object storage
- encrypted at rest
- evidence metadata in Postgres
- redaction pipeline

Graph

Start with Postgres tables for graph nodes and edges.

Move to Neo4j or another graph engine only when complexity requires it.

Codex Build Model

Codex can be used as a parallel implementation system because Codex Cloud can work with connected GitHub repositories and create pull requests, and Codex tasks run in cloud environments for delegated software work. Codex can also be triggered from GitHub pull request comments for review/fix workflows.

## 6. Data Model

### 6.1 Core Entities

Tenant

tenant_id
name
type
parent_tenant_id
billing_account_id
data_region
created_at
updated_at

User

user_id
email
name
status
created_at
updated_at

Membership

membership_id
tenant_id
user_id
role
created_at
updated_at

Scope

scope_id
tenant_id
scope_type
value
verification_method
verification_status
verified_at
created_by
created_at
updated_at

Scope types:

- Domain
- Subdomain
- IPRange
- CloudAccount
- Repository
- AIApplicationEndpoint
- InternalNetwork
- ControlSource

Integration

integration_id
tenant_id
vendor
product
category
auth_type
status
health_status
last_sync_at
permissions_summary
created_at
updated_at

SignalEnvelope

signal_id
tenant_id
source_integration_id
source_type
source_vendor
signal_category
signal_subcategory
timestamp_observed
timestamp_ingested
confidence
freshness
sensitivity_level
related_asset_ids
related_identity_ids
related_control_ids
related_path_ids
related_evidence_ids
raw_payload_pointer
redaction_status

Asset

asset_id
tenant_id
asset_type
name
identifiers
environment
owner
business_criticality
internet_exposed
tags
first_seen_at
last_seen_at
status

Identity

identity_id
tenant_id
provider
identity_type
username
email
privilege_level
mfa_status
groups
roles
risk_flags
first_seen_at
last_seen_at

ControlSource

control_source_id
tenant_id
control_type
provider
integration_id
expected_behaviors
telemetry_status
last_validated_at
health_status

AIApplication

ai_app_id
tenant_id
name
app_type
endpoint
auth_method
rag_enabled
tools_enabled
data_sources
guardrails
owner
last_validated_at

Exposure

exposure_id
tenant_id
asset_id
exposure_type
source
severity
confidence
validation_state
first_seen_at
last_seen_at
status

ValidationMission

mission_id
tenant_id
mission_type
requested_by
scope_ids
policy_profile
safety_level
status
started_at
completed_at

ValidationRun

run_id
tenant_id
mission_id
module_id
runner_id
target
status
outcome
validation_state
evidence_ids
started_at
completed_at
error_summary

EvidenceArtifact

evidence_id
tenant_id
artifact_type
storage_uri
sha256
sensitivity_level
redaction_status
related_entity_type
related_entity_id
created_at

AttackPath

path_id
tenant_id
name
entry_node_id
impact_node_id
path_nodes
path_edges
confidence
impact_score
validation_state
path_breakers
evidence_ids
created_at
updated_at

RemediationTask

remediation_id
tenant_id
related_path_id
related_exposure_id
owner
recommended_action
ticket_system
ticket_id
status
verification_required
created_at
updated_at

VerificationEvent

verification_id
tenant_id
remediation_id
validation_run_id
previous_state
new_state
outcome
evidence_ids
verified_at

## 7. API Specification

### 7.1 Auth and Tenant

POST /auth/signup
POST /auth/login
POST /auth/logout
GET /me
GET /tenants/current
POST /tenants/current/invite
GET /audit-events

### 7.2 Scope

GET /scopes
POST /scopes
GET /scopes/:id
POST /scopes/:id/verify
DELETE /scopes/:id

### 7.3 Integrations

GET /integrations/catalog
GET /integrations
POST /integrations
GET /integrations/:id
GET /integrations/:id/health
POST /integrations/:id/sync
DELETE /integrations/:id

### 7.4 Missions

GET /missions
POST /missions
GET /missions/:id
POST /missions/:id/start
POST /missions/:id/cancel
GET /missions/:id/runs

### 7.5 Validation Snapshot

POST /snapshots
GET /snapshots
GET /snapshots/:id
GET /snapshots/:id/report
POST /snapshots/:id/export

### 7.6 Attack Paths

GET /attack-paths
GET /attack-paths/:id
POST /attack-paths/:id/verify
GET /attack-paths/:id/evidence

### 7.7 Controls

GET /control-sources
POST /control-sources
GET /control-sources/:id
POST /control-sources/:id/validate
GET /control-sources/:id/history

### 7.8 AI Applications

GET /ai-apps
POST /ai-apps
GET /ai-apps/:id
POST /ai-apps/:id/validate
GET /ai-apps/:id/history

### 7.9 Remediation

GET /remediations
POST /remediations
GET /remediations/:id
POST /remediations/:id/create-ticket
POST /remediations/:id/mark-ready-for-verification
POST /remediations/:id/verify
GET /remediations/:id/verification-events

### 7.10 Evidence

GET /evidence
GET /evidence/:id
POST /evidence/:id/redact
GET /evidence/:id/download

### 7.11 Reports

GET /reports
POST /reports
GET /reports/:id
POST /reports/:id/export
POST /reports/:id/share-link

### 7.12 Runner

POST /runners/register
GET /runners
GET /runners/:id
POST /runners/:id/revoke
POST /runners/:id/heartbeat
GET /runners/:id/tasks
POST /runners/:id/tasks/:taskId/result

## 8. Integration Signal Fabric

Periscan must be integration-heavy from the start.

The customer's stack is used as:

- signal source
- control observer
- validation target
- remediation destination
- evidence source

### 8.1 Integration Categories

Cloud

AWS, Azure, GCP, Cloudflare, Kubernetes.

Identity

Entra ID, Okta, Google Workspace, Active Directory.

Code / DevSecOps

GitHub, GitLab, Bitbucket, CI/CD, container registries.

Security Controls

EDR, XDR, SIEM, SOAR, MDR, WAF, firewall, email security, MFA.

Vulnerability / Exposure

VM, EAP, ASM, CNAPP, CSPM, CAASM.

Ticketing

Jira, ServiceNow, Linear, GitHub Issues, Slack, Teams.

AI Stack

OpenAI, Azure OpenAI, Anthropic, Bedrock, Vertex, RAG systems, vector DBs, guardrails, agent frameworks.

MSSP / PSA / RMM

ConnectWise, Kaseya, Datto, NinjaOne, HaloPSA, N-able.

### 8.2 Minimum MVP Integrations

- AWS
- GitHub
- verified domain / external validation
- Slack or email
- Jira
- one AI app endpoint registration
- mock EDR
- mock SIEM

### 8.3 V1 Integrations

- Azure
- GCP
- Entra ID
- Okta
- Google Workspace
- GitLab
- CrowdStrike mock/real
- Splunk mock/real
- Microsoft Sentinel
- ServiceNow
- Cloudflare
- OpenAI / Azure OpenAI
- AWS Bedrock

## 9. Module Registry

Periscan modules wrap validation engines.

Each module has a manifest.

### 9.1 Module Manifest

module_id
name
capability_name
tool_name
version
license
safety_level
required_inputs
required_permissions
supported_mission_types
execution_mode
timeout_seconds
resource_limits
parser
output_schema
evidence_types
approval_required
customer_visible_description

### 9.2 Safety Levels

Level 0: Passive / Read-Only

Cloud config read, repo metadata, SBOM parsing.

Level 1: Active Non-Invasive

HTTP checks, banner checks, safe external probes.

Level 2: Controlled Validation

Safe proof checks, limited AI app tests, fix verification.

Level 3: BAS-Lite / AEV

Control validation, approved attacker-like simulations.

Level 4: Advanced Adversarial

Multistep internal scenarios, attack workbench.

Level 5: Disallowed

Destructive payloads, persistence, real exfiltration, credential theft.

## 10. Open Source Acceleration Plan

Use OSS as internal engines, not as customer-facing product identity.

### 10.0 Third-Party Tool Governance Center

Periscan must provide an API-first governance center for Periscan-managed third-party validation tools. The governance center is the operational control surface for open-source and other approved security tools that power validation modules.

Admin capabilities:

- view every Periscan-managed third-party tool
- see runtime readiness, install status, pinned version/image/ref, license, legal disposition, safety level, supported modules, and supported capabilities
- check runtime readiness
- request or run platform-controlled install/pull jobs for allowlisted artifacts only
- enable or disable approved tools per tenant
- see check/install job history and audit events
- check for reviewed catalog version drift and apply reviewed pins
- check trusted upstream metadata for newer candidate versions before catalog review
- see a tenant-scoped tool activity timeline covering governance changes, runtime jobs, validation runs, upstream checks, update recommendations, candidates, work orders, and audit events
- see whether each reviewed tool is eligible for internal-runner dispatch based on tenant enablement, runtime readiness, active runners, verified scope, capability status, approval gates, and the server-side runner allowlist
- download/view license inventory
- validate proposed new tool manifests before they can become catalog entries

API requirements:

- `GET /api/v1/third-party-tools`
- `GET /api/v1/third-party-tools/:toolId`
- `POST /api/v1/third-party-tools/intake/validate`
- `GET /api/v1/third-party-tools/intake/candidates`
- `POST /api/v1/third-party-tools/intake/candidates`
- `POST /api/v1/third-party-tools/intake/candidates/import`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId/readiness`
- `POST /api/v1/third-party-tools/intake/candidates/:candidateId/review`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`
- `POST /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`
- `POST /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certification-report`
- `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certifications`
- `POST /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certifications`
- `GET /api/v1/third-party-tools/:toolId/upstream-version-checks`
- `POST /api/v1/third-party-tools/:toolId/upstream-version-checks/check`
- `GET /api/v1/third-party-tools/:toolId/update-recommendations`
- `POST /api/v1/third-party-tools/:toolId/update-recommendations/check`
- `POST /api/v1/third-party-tools/:toolId/update-recommendations/:recommendationId/apply`
- `POST /api/v1/third-party-tools/:toolId/update-recommendations/:recommendationId/dismiss`
- `POST /api/v1/third-party-tools/:toolId/check`
- `POST /api/v1/third-party-tools/:toolId/install`
- `POST /api/v1/third-party-tools/:toolId/enable`
- `POST /api/v1/third-party-tools/:toolId/disable`
- `GET /api/v1/third-party-tools/:toolId/jobs`
- `GET /api/v1/third-party-tools/:toolId/activity`
- `GET /api/v1/third-party-tools/:toolId/runner-eligibility`
- `GET /api/v1/third-party-tools/licenses`

Governance rules:

- Existing `/api/v1/open-source-tools`, `/api/v1/open-source-capabilities`, and `/api/v1/modules` remain read-only catalog APIs.
- `/api/v1/third-party-tools` is the mutable governance API surface.
- The Registry Center UI must consume these APIs, including `/api/v1/third-party-tools/intake/validate` and `/api/v1/third-party-tools/intake/candidates`, instead of maintaining UI-only tool intake state.
- Tenant Owner/Admin can enable or disable approved tools for that tenant.
- Proposed new tools must first pass `/api/v1/third-party-tools/intake/validate`, which returns a certification report with decision, checks, legal/safety posture, installable runtimes, runner compatibility, required files, required tests, and remediation actions.
- Proposed new tools can then be submitted to `/api/v1/third-party-tools/intake/candidates`, which persists a tenant-scoped candidate review record with the original manifest, validation report, requester, status, timestamps, and audit event. Candidate submission still does not add catalog entries, install tools, queue missions, or enable execution.
- Proposed tool manifests can also be submitted in batches through `/api/v1/third-party-tools/intake/candidates/import`. Each manifest is independently validated, malformed and duplicate entries are returned with item-level errors, successful entries are persisted to the same candidate backlog, and the batch writes audit metadata. Batch import does not add catalog entries, install tools, enable tenant governance, queue missions, dispatch runner tasks, or execute modules.
- Candidate backlog readiness summary must be available at `/api/v1/third-party-tools/intake/candidates/readiness-summary`. The summary returns all current tenant candidates with their readiness reports, readiness counts, review/intake counts, and top required actions so large imported tool libraries can be triaged systematically. It is read-only and must not add catalog entries, install tools, enable tenant governance, queue missions, dispatch runner tasks, or execute modules.
- Candidate readiness must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness`. The report compares the candidate against actual catalog/module/governance state and returns `ReadyForGovernance`, `NeedsImplementation`, or `Blocked` with explicit checks and required actions. It is read-only and must not promote, install, enable, queue, or execute the candidate.
- Candidate review must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/review`. Tenant Owner/Admin users can set `NeedsChanges`, `AcceptedForImplementation`, `Rejected`, or `PromotedToCatalog`; `AcceptedForImplementation` requires an accepted intake decision, and `PromotedToCatalog` requires readiness to prove actual catalog/module/governance/runtime/runner/legal completion. Review updates metadata and audit events only.
- Candidate implementation work orders must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`. A work order can be generated only after a candidate is accepted for implementation; it stores task lists, required evidence, scaffold file maps, readiness/review status, and audit metadata without writing repository files, installing tools, enabling tools, queueing missions, or executing modules.
- Candidate implementation bundles must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle`. A bundle is derived from an accepted work order and includes scaffold file content, SHA-256 hashes, validation commands, required actions, and safety notes. It is a review artifact only and must not write repository files, install tools, enable tools, queue missions, dispatch runner tasks, or execute modules.
- Candidate promotion packages must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`. A package can be generated only after the candidate is readiness-gated as `PromotedToCatalog`; it snapshots reviewed catalog metadata, module/capability bindings, effective governance policy, runtime readiness, readiness checks, required evidence, and safety notes without installing tools, enabling tools, queueing missions, or dispatching runner tasks.
- Candidate promotion certification reports must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certification-report`. A report computes current catalog, module/capability, required-evidence, governance, runtime, runner, policy, and safety checks from real tenant state without installing tools, enabling tools, queueing missions, dispatching runner tasks, or executing modules.
- Candidate promotion certification history must be available at `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certifications`. POST persists a normalized snapshot of the current certification report, writes `third_party_tool.promotion_certified`, and surfaces the snapshot in tool activity; GET lists tenant-scoped snapshots. Snapshot creation is auditable but non-executing.
- Trusted upstream version checks must be available at `/api/v1/third-party-tools/:toolId/upstream-version-checks`. Checks use reviewed tool metadata only, never customer-supplied package names, images, repositories, or URLs, and persist tenant-scoped reports with source, discovered version, catalog version, status, required actions, and audit metadata.
- Upstream `CandidateAvailable` reports are review candidates only. They must not update reviewed catalog metadata, tenant pins, install jobs, mission queues, module execution, or runner tasks until a human-reviewed catalog/module/license/runtime update lands and normal update recommendations are generated.
- Tool update recommendations must be available at `/api/v1/third-party-tools/:toolId/update-recommendations`. Recommendations compare tenant pins with reviewed catalog versions only, persist audit-friendly status/required actions, and can apply a reviewed pin or queue an install job without accepting arbitrary customer-supplied versions.
- Intake validation is non-executing. It does not add catalog entries, run tools, install packages, or accept arbitrary customer-provided runtime artifacts.
- Legal-review, blocked, disallowed, live-adversarial, or unsafe tools cannot be enabled by tenant admins.
- Install API requests create auditable queued jobs. Execution happens only in platform-controlled workers with `PERISCAN_THIRD_PARTY_TOOL_INSTALL_WORKER_ENABLED=true` and `PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE=true`.
- Install jobs must use known manifest artifacts only; no arbitrary package names, images, repositories, URLs, or shell commands are accepted from customers.
- Disabled tools cannot be queued in missions.
- Tool activity timelines must be tenant-scoped and assembled from real governance records, runtime jobs, validation runs, upstream checks, update recommendations, candidates, work orders, and audit events. They must not expose credentials, raw scanner output, or arbitrary customer-provided package data.
- Tool runner eligibility reports must be read-only and tenant-scoped. They must combine governance status, runtime readiness, active runner count, verified compatible scopes, capability status, approval requirements, and server-side runner dispatch allowlists. A tool must not be presented as runner-ready unless the API has a known signed-task dispatch route for at least one implemented internal-runner capability.
- Tool runner dispatch must be available at `/api/v1/third-party-tools/:toolId/runner-dispatch`. It creates signed runner tasks only for reviewed capabilities that are already `Ready` in the eligibility report, and it must delegate to the existing runner task builders so verified scope, policy decisions, runner kill switch, signed envelopes, local allowlists, evidence upload, and audit behavior remain centralized.
- Current safe OSS runner dispatch covers `nmap`, `subfinder`, `httpx`, and `dnsx` through allowlisted `recon.*` runner-agent modules. SharpHound, Caldera live execution, Atomic live execution, credential validation, exploitation checks, and arbitrary package/module dispatch remain blocked or non-executable by default.
- Every check, install, enable, disable, denial, and mission-start block creates an audit event.
- App dependencies remain SBOM/license inventory; they are not customer-installable runtime tools.

Systematic expansion lifecycle:

1. Validate proposed tool metadata through `/api/v1/third-party-tools/intake/validate`.
2. Submit reviewed candidate metadata to `/api/v1/third-party-tools/intake/candidates`, or submit bounded manifest batches through `/api/v1/third-party-tools/intake/candidates/import`, when the tenant wants proposed tools tracked as backlog.
3. Check candidate readiness through `/api/v1/third-party-tools/intake/candidates/:candidateId/readiness`.
4. Review the candidate through `/api/v1/third-party-tools/intake/candidates/:candidateId/review` and assign an owner/status without installing, enabling, queueing, or executing it.
5. Generate an implementation work order through `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders` after the candidate is accepted for implementation.
6. Download the non-executing implementation bundle from `/api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle` when platform engineers need deterministic scaffold content, file hashes, validation commands, and safety notes for reviewed code changes.
7. Resolve the readiness/work-order required actions, including duplicate IDs, legal review, unsafe behavior, missing install metadata, missing catalog entry, missing module manifest, missing module/tool binding, scope contract, runner compatibility, parser/redaction fixtures, evidence wiring, and license notices.
8. Add a reviewed tool catalog entry with ID, category, license, phase, runtime preferences, pinned version/image/ref, and legal disposition.
9. Generate a promotion package through `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages` after readiness proves the candidate can be promoted.
10. Check trusted upstream metadata for newer candidate versions through `/api/v1/third-party-tools/:toolId/upstream-version-checks`; treat candidates as review inputs only.
11. Generate and review tool update recommendations when the reviewed catalog version differs from tenant pins.
12. Add one or more module manifests with safety level, execution plane, permissions, parser, output schema, redaction rules, evidence types, fixture support, and live support flag.
13. Add deterministic parser and redaction tests.
14. Certify the module against policy, license, evidence, and no-raw-findings invariants.
15. Wire the module into the validation ecosystem: missions, policy preview/start, worker/runner execution, evidence storage, graph updates, risk/path/remediation/report outputs.
16. Expose readiness through `/api/v1/third-party-tools/:toolId/runner-eligibility` and, only after the capability is `Ready`, allow dispatch through `/api/v1/third-party-tools/:toolId/runner-dispatch`.
17. Expose readiness and governance through catalog and third-party-tool APIs.
18. Enable live execution only after legal, safety, and runner/control-plane execution reviews pass.

Runner execution:

- Customer-network tools execute only through the outbound-only Internal Runner.
- Runner tasks must be signed, scoped, nonce-protected, resource-limited, and locally allowlisted.
- Runner activity must be visible in tool job history, runner task history, evidence, and audit logs.
- No reverse SSH, arbitrary shell, uncontrolled tunnel, destructive testing, persistence, credential theft, or real data exfiltration is allowed.

Platform install worker:

- The API never runs `docker`, `git`, `pip`, or shell commands directly for customer install requests.
- The API stores a `Queued` install job and writes `third_party_tool.install_requested`.
- A platform worker leases queued jobs, builds commands only from reviewed tool metadata, executes without a shell, redacts output, updates runtime readiness, and writes install success/failure audit events.
- If execution is not explicitly enabled, jobs are marked denied/skipped rather than pretending the tool was installed.

### 10.1 Initial Engines

Nuclei

Use for safe external exposure validation and template-based checks. Nuclei is designed to scan applications, infrastructure, cloud platforms, and networks using YAML templates.

Prowler

Use for cloud posture and compliance-style checks. Use only with least-privilege permissions.

Trivy

Use for vulnerabilities, misconfigurations, secrets, SBOM, containers, Kubernetes, and repositories.

Gitleaks

Use for secrets validation and repo-to-cloud path seeds.

Atomic Red Team

Use for safe BAS-lite control checks mapped to MITRE ATT&CK.

Caldera

Use later for advanced adversary emulation and attack workbench capabilities. Caldera is an adversary emulation platform built on MITRE ATT&CK.

BloodHound CE

Use for identity attack-path concepts and possible module support.

Promptfoo / PyRIT

Use for AI app validation, RAG testing, and generative-AI risk workflows.

Grype

Use for CVE and vulnerability data for rapid response, 0-day enrichment, and kill-chain templates.

Semgrep

Use for code, web, and API exploit rule scanning to expand template-based simulations.

Ollama

Use for local LLM inference in AI validation and self-improving collective intelligence to reduce hallucinations.

Proxmark3

Use for physical RFID/NFC access proxy simulation in multi-modal kill-chains.

HackRF

Use for physical RF simulation data packs.

Ansible

Use for on-prem / air-gapped / MCP IaC playbook simulation and deployment sims in RemOps (safe fixture mode only, G4).

Terraform

Use for IaC plan simulation, on-prem/MCP, and TF provider hooks (safe fixtures, G4/G6).

FFmpeg

Use for simulation replay video export from evidence/playwright (safe fixture, G5). Enables gamified training replays.

CTF / Gamified Pack

Use for OSS CTF training data packs (picoCTF/overthewire style) as gamified Marketplace modules + NL campaign builder with ollama (G5).

OpenAPI Generator

Use for SDK generation (Go/Python/JS) from OpenAPI + Terraform provider scaffold for Periscan (G6, full bi-di/API/CLI/TF/marketplace/SDK).

### 10.2 OSS Policy

- Prefer permissive licenses.
- Track license per module.
- AGPL tools require legal review.
- Every module must be sandboxed.
- Every module must have parser tests.
- Every module must produce normalized evidence.
- Never expose raw tool output as primary UX.

## 11. Policy and Safety Engine

### 11.1 Inputs

- tenant policy
- user role
- scope
- mission type
- module safety level
- target
- execution environment
- requested action

### 11.2 Outputs

- Allowed
- Denied
- RequiresApproval
- RequiresVerifiedScope
- RequiresInternalRunner
- RequiresTimeWindow

### 11.3 Rules

- No validation without verified scope.
- Level 0 and 1 allowed for verified scope.
- Level 2 requires explicit mission approval.
- Level 3 requires admin approval.
- Level 4 disabled by default.
- Level 5 always denied.
- No destructive tests.
- No real data exfiltration.
- No persistence.
- No credential theft.
- No uncontrolled exploit chaining.

### 11.4 Audit

Every policy decision must create an audit event.

## 12. Evidence Graph

### 12.1 Nodes

- Asset
- Identity
- Permission
- CloudResource
- Repository
- Secret
- Exposure
- Vulnerability
- ControlSource
- AIApplication
- ValidationRun
- EvidenceArtifact
- AttackPath
- RemediationTask
- VerificationEvent

### 12.2 Edges

- RELATES_TO
- CAN_ACCESS
- EXPOSES
- DETECTED_BY
- BLOCKED_BY
- MISSED_BY
- VALIDATED_BY
- FIXED_BY
- REOPENED_BY
- LEADS_TO
- OBSERVED_BY
- REMEDIATED_BY

### 12.3 Required Questions

The graph must answer:

- What can reach what?
- Which identity can access which resource?
- Which secret leads to which cloud role?
- Which control should have detected this?
- Did the control work?
- Which path has highest impact?
- Which fix breaks the most paths?
- Which risks were closed without proof?
- Which risks came back?

## 13. Risk Scoring

### 13.1 Inputs

- validation state
- reachability
- exploitability
- control response
- identity privilege
- asset criticality
- business impact
- known exploitation
- threat relevance
- confidence
- recurrence
- remediation status
- verification status

### 13.2 Formula

Real Risk =
Attack Feasibility
x Business Impact
x Control Failure
x Confidence
x Threat Relevance

### 13.3 Modifiers

- Blocked reduces score.
- Detected but not blocked reduces less.
- Missed increases score.
- Verified fix reduces score.
- Reopened increases score.
- Sensitive data increases score.
- Privileged path increases score.
- Inconclusive lowers confidence.

## 14. Periscan Runner Spec

### 14.1 Purpose

Optional internal point of attack and validation runner.

### 14.2 Deployment

- Docker container
- Linux VM
- Kubernetes Helm chart later
- Windows service later

### 14.3 Security

- outbound-only
- mTLS
- signed tasks
- signed modules
- local scope enforcement
- resource limits
- timeouts
- local audit logs
- kill switch
- no inbound firewall rule

### 14.4 Runner Flow

1. User creates runner in control plane.
2. Periscan generates registration token.
3. Runner registers.
4. Runner receives certificate.
5. Runner polls for signed tasks.
6. Runner verifies task signature.
7. Runner enforces local scope.
8. Runner executes task.
9. Runner uploads evidence.
10. Runner writes audit log.

## 15. UX Requirements

### 15.1 Main Navigation

- Dashboard
- Validation Snapshot
- Exposure
- Attack Paths
- Controls
- AI Apps
- Remediation
- Evidence
- Reports
- Integrations
- Runners
- Policies
- Admin

### 15.2 Dashboard Cards

- Priority exposure paths
- Controls needing proof
- AI apps with failed checks
- Fixes awaiting re-test
- Risk reduced this month
- Evidence packs ready

### 15.3 Status Badges

- Validated
- Blocked
- Detected
- Missed
- Mitigated
- Fixed
- Reopened
- Needs Review

### 15.4 Snapshot Flow

1. Define scope
2. Connect systems
3. Run validation
4. Review report
5. Create remediation
6. Verify fix
7. Export evidence

## 16. Reports

### 16.1 Validation Snapshot Report

Sections:

- Executive Summary
- Priority Attack Paths
- Control Verdicts
- AI App Validation
- Remediation Priorities
- Verification Plan
- Evidence Appendix
- Methodology and Safety Notes

### 16.2 Audience Variants

- Executive
- Security Team
- GRC
- Customer Review
- Auditor
- Cyber Insurance
- MSSP Client
- Technical Appendix

## 17. Pricing and Metering

Do not publish exact prices initially.

Public Pricing Language

Pay for what you validate.

Metering Units

- validated assets
- identities
- control sources
- AI apps/workflows
- internal runners
- scenario executions
- evidence workflows
- MSSP client tenants
- retention
- API usage

Packaging

- Light External Scan
- Validation Snapshot
- Core Validation
- Control Validation
- AI Security Validation
- Evidence Packs
- MSSP / Partner
- Enterprise

(Note: Light External Scan is the freemium/light external ASV/EASM tier to drive adoption per competitive requirements.)

Public pricing language examples: "Pay for what you validate." (full tiers); "Freemium: light external ASV/EASM only." (entry tier, no exact prices published).

## 18. Build Phases

Phase 0 - Foundation

Build:

- monorepo
- tenant model
- auth
- RBAC
- integration registry
- module registry
- job scheduler
- raw evidence store
- normalized evidence schema
- basic evidence graph
- report generator
- policy engine
- audit logs

Exit criteria:

- tenant can be created
- verified scope can be created
- mock module can run
- evidence is stored
- simple report renders

Phase 1 - Validation Snapshot

Build:

- domain verification
- GitHub connector
- AWS connector
- external validation via Nuclei
- secrets validation via Gitleaks
- cloud checks via Prowler
- dependency/container checks via Trivy/OSV
- basic attack path correlation
- remediation summaries
- HTML/PDF report

Exit criteria:

- user connects environment
- Periscan returns top 3-5 validated paths
- each path has evidence, impact, fix, verification plan

Phase 2 - AI App Validation

Build:

- AI app registry
- promptfoo integration
- safe AI test harness
- RAG validation fixtures
- AI app report section
- output redaction

Exit criteria:

- user can validate one AI app endpoint
- report includes AI-specific evidence and remediation

Phase 3 - Control Validation

Build:

- Atomic Red Team wrapper in dry-run/fixture mode
- MITRE ATT&CK mapping
- mock EDR observer
- mock SIEM observer
- detected/blocked/missed/no-evidence states
- control report

Exit criteria:

- safe control validation test runs
- observer returns verdict
- report shows control outcome

Phase 4 - Fix Verification

Build:

- remediation tasks
- Jira integration
- ticket status sync
- targeted re-test
- verification event
- before/after evidence

Exit criteria:

- closed task can trigger verification
- result updates attack path state
- evidence pack updates

Phase 5 - Internal Runner

Build:

- Go runner
- outbound-only communication
- task signing
- local scope enforcement
- internal reachability module
- evidence upload

Exit criteria:

- runner registers securely
- rejects unsigned tasks
- executes approved task only
- uploads evidence

Phase 6 - Continuous Validation

Build:

- scheduled missions
- recurring validation
- drift detection
- reopened exposure
- trend reports
- CTEM view

Exit criteria:

- user schedules recurring validation
- Periscan shows what changed
- Periscan identifies reopened risk

Phase 7 - Operators

Build:

- Red Team Operator
- Blue Team Operator
- Exposure Operator
- Remediation Operator
- Evidence Operator
- AI App Security Operator

Exit criteria:

- operators recommend missions
- recommendations cite evidence
- user approves execution
- policy controls action

Phase 8 - MSSP / Enterprise

Build:

- parent/child tenants
- white-label reports
- client dashboards
- SSO/SAML/OIDC
- SCIM
- baseline multi-role RBAC (six fixed roles: Owner, Admin, SecurityEngineer, Viewer, MSSPOwner, ClientAdmin; custom/ABAC roles are roadmap)
- API
- audit exports
- private runners

Exit criteria:

- MSSP can manage multiple clients
- enterprise can govern multiple business units

## 19. First Sellable MVP

Product

Periscan Validation Snapshot

MVP Flow

1. User creates account.
2. User verifies domain.
3. User connects GitHub.
4. User connects AWS.
5. User optionally registers AI app.
6. Periscan runs safe validation modules.
7. Periscan correlates top paths.
8. Periscan generates Snapshot report.
9. User creates remediation.
10. User triggers fix verification.

MVP Report

- executive summary
- top 3-5 validated paths
- control observations
- AI app risks
- remediation priorities
- verification plan
- evidence appendix

MVP Success Signal

The customer says:

"This is not a scanner. This is the report I wish I had before the audit / customer review / insurance renewal / board meeting."

## 20. Codex Master Instruction

Paste this into Codex as the top-level task instruction before implementation.

You are building Periscan, a self-service Automated Security Validation platform.
Product outcome:
Periscan validates exposure, controls, attack paths, AI applications, and fixes, then turns the results into proof.
Core tagline:
Find the path. Validate the risk. Prove it's fixed.
Build philosophy:
Use open-source tools as internal validation engines where useful, but do not expose OSS plumbing to the user. Periscan owns the control plane, policy engine, evidence graph, signal fabric, module registry, risk engine, remediation engine, fix verification, evidence packs, integrations, and product UX.
Safety rules:

- Only validate customer-authorized scope.
- No destructive actions.
- No real data exfiltration.
- No persistence.
- No credential theft.
- No uncontrolled exploit chaining.
- No third-party scanning without verified authorization.
- Default to read-only and passive checks.
- Every validation task must be scoped, policy-approved, logged, auditable, and evidence-backed.
  Engineering rules:
- Implement in small PR-sized slices.
- Add tests for every new service and module.
- Keep modules pluggable.
- Use typed schemas and runtime validation.
- Keep raw evidence separate from normalized evidence.
- Every conclusion must link to evidence.
- Do not mark a risk fixed unless a verification event proves it.
  Stack:
- apps/web: Next.js + TypeScript.
- apps/api: Fastify or NestJS + TypeScript.
- apps/worker: TypeScript worker.
- apps/runner: Go runner.
- packages/shared: shared schemas and types.
- packages/policy: policy/safety engine.
- packages/evidence: evidence graph and storage.
- packages/connectors: integration connectors.
- packages/modules: validation modules.
- packages/reports: evidence pack generator.
- Postgres, Redis/BullMQ, MinIO/S3.

## 21. Codex Implementation Tickets

Use these as separate Codex tasks.

Ticket 1 - Monorepo Scaffold

Build monorepo with:

- apps/web
- apps/api
- apps/worker
- apps/runner
- packages/shared
- packages/policy
- packages/evidence
- packages/connectors
- packages/modules
- packages/reports
- docker-compose for Postgres, Redis, MinIO

Acceptance:

- local dev starts
- API health endpoint works
- web calls API health endpoint
- tests run

Ticket 2 - Shared Schemas

Create Zod schemas and TypeScript types for all core entities.

Acceptance:

- schemas compile
- tests validate examples
- enums include validation states, control states, remediation states, safety levels

Ticket 3 - Database and Prisma

Create schema and migrations.

Acceptance:

- migrations run
- seed creates demo tenant
- tenant isolation indexes exist

Ticket 4 - Auth, Tenant, RBAC

Implement signup/login and tenant membership.

Acceptance:

- user can sign up
- tenant created
- RBAC enforced
- tenant A cannot access tenant B

Ticket 5 - Scope Verification

Implement domain scope and DNS token verification with dev-mode manual verification.

Acceptance:

- unverified scope cannot run validation
- verified scope can run validation

Ticket 6 - Policy Engine

Implement safety levels and policy decisions.

Acceptance:

- unsafe tasks denied
- approval-required tasks marked
- audit events written

Ticket 7 - Signal Fabric

Build connector interface and SignalEnvelope.

Acceptance:

- mock connector syncs signals
- integration health works
- catalog displays mock integrations

Ticket 8 - Module Registry

Build module manifests and mock modules.

Acceptance:

- modules list
- modules validate inputs
- modules produce normalized outputs

Ticket 9 - Job Scheduler

Build BullMQ worker and mission execution.

Acceptance:

- mission creates jobs
- worker executes module
- result stored
- failures handled

Ticket 10 - Raw Evidence Store

Use MinIO/S3 evidence storage.

Acceptance:

- raw output stored
- evidence metadata created
- redaction test passes

Ticket 11 - Evidence Graph MVP

Implement graph nodes and edges in Postgres.

Acceptance:

- module output creates graph nodes
- simple paths can be found
- evidence links to graph

Ticket 12 - Validation Snapshot

Implement Snapshot mission.

Acceptance:

- demo Snapshot runs
- top 3-5 results returned
- report generated

Ticket 13 - GitHub Connector

Implement GitHub mock and initial real connector.

Acceptance:

- repo signals created
- fixture repo works
- no raw secrets stored

Ticket 14 - AWS Connector

Implement AWS mock and initial read-only connector.

Acceptance:

- cloud assets and IAM signals created
- fixture mode works
- no write permissions

Ticket 15 - Gitleaks Module

Wrap Gitleaks safely.

Acceptance:

- fake secret detected in fixture
- secret redacted
- evidence created

Ticket 16 - Prowler Module

Wrap Prowler output parser.

Acceptance:

- fixture findings map to exposures
- report shows normalized cloud issues

Ticket 17 - Nuclei Safe External Module

Run only against verified domains with safe templates.

Acceptance:

- unverified domain denied
- safe fixture works
- rate limit enforced

Ticket 18 - Attack Path Correlation

Build simple path patterns.

Acceptance:

- repo secret -> cloud role path fixture works
- path has evidence, impact, path breaker

Ticket 19 - Risk Scoring

Implement explainable risk score.

Acceptance:

- score factors visible
- fixed item score drops
- missed control increases score

Ticket 20 - Remediation Engine

Generate fix plans.

Acceptance:

- each high-risk path gets remediation
- each remediation has verification method

Ticket 21 - Jira Integration

Create mock Jira workflow.

Acceptance:

- remediation ticket created
- ticket closed triggers verification pending

Ticket 22 - Fix Verification

Implement targeted re-test workflow.

Acceptance:

- verification event created
- outcome updates path state

Ticket 23 - Report Generator

Generate HTML Snapshot report.

Acceptance:

- executive summary
- top paths
- control observations
- AI app risks
- remediation
- verification plan
- evidence appendix

Ticket 24 - Web UI

Build MVP UI.

Pages:

- dashboard
- integrations
- scopes
- validation snapshot
- snapshot report
- attack paths
- remediation
- evidence

Acceptance:

- user can complete demo flow
- UI uses real API

Ticket 25 - AI App Registry

Implement AI app registration.

Acceptance:

- AI app tied to verified scope
- mock validation runs

Ticket 26 - AI App Validation

Implement safe AI validation module with fixtures.

Acceptance:

- prompt injection / leakage / unsafe tool call fixtures classify correctly
- evidence redacted
- report section generated

Ticket 27 - Control Source Registry

Implement control sources.

Acceptance:

- mock EDR/SIEM source added
- control validation can query it

Ticket 28 - Atomic Red Team Safe Wrapper

Implement dry-run/fixture-only control validation.

Acceptance:

- no real execution by default
- policy blocks unsafe execution
- ATT&CK mapping displayed

Ticket 29 - MITRE ATT&CK Mapping

Add technique mapping support.

Acceptance:

- report displays technique tags where applicable
- missing mapping omitted cleanly

Ticket 30 - Internal Runner Skeleton

Build Go runner skeleton.

Acceptance:

- runner registers
- polls for tasks
- rejects unsigned tasks
- executes mock task
- uploads evidence

Ticket 31 - Runner Task Signing

Add signed tasks.

Acceptance:

- unsigned task rejected
- expired task rejected
- wrong runner rejected

Ticket 32 - Runner Reachability Module

Implement safe reachability checks.

Acceptance:

- only approved scope
- no scanning outside scope
- evidence stored

Ticket 33 - Continuous Validation Scheduler

Add recurring missions.

Acceptance:

- scheduled mission runs
- diff summary generated
- reopened risk detected

Ticket 34 - Evidence Pack Templates

Add report templates.

Acceptance:

- executive and technical reports differ
- redaction supported

Ticket 35 - MSSP Multitenancy

Add parent/child tenants.

Acceptance:

- MSSP sees clients
- clients isolated
- white-label report works

Ticket 36 - Billing/Metering

Add usage meters.

Acceptance:

- validated assets counted
- control sources counted
- AI apps counted
- usage page displays

Ticket 37 - Trust & Safety Page

Show integrations, permissions, evidence retention, audit logs, runner model.

Acceptance:

- customer can see what Periscan reads
- customer can revoke integration

Ticket 38 - Audit Log Completeness

Ensure all security-relevant actions emit audit events.

Acceptance:

- tests for each event family

Ticket 39 - Demo Data

Create deterministic demo scenario.

Acceptance:

- demo tenant shows realistic Snapshot
- sample report renders

Ticket 40 - E2E Test

Playwright E2E for full MVP flow.

Acceptance:

- signup
- verify scope
- connect mock GitHub/AWS
- run Snapshot
- create remediation
- verify fix
- generate report

## 22. First Demo Story

The first demo should tell one story:

1. Periscan finds a fake repo secret.
2. Periscan maps it to possible cloud access.
3. Periscan identifies a path to production impact.
4. Periscan checks whether a control saw related activity.
5. Periscan recommends a path breaker.
6. Periscan creates a remediation task.
7. Periscan re-tests.
8. Periscan marks the risk fixed or still exposed.
9. Periscan generates evidence.

That is the first Periscan product moment.

## 23. Definition of Done for V1

Periscan V1 is done when:

- user can self-onboard
- user can verify scope
- user can connect GitHub and AWS
- user can run Validation Snapshot
- user receives top 3-5 evidence-backed paths
- report includes remediation and verification plan
- user can create remediation task
- user can run fix verification
- evidence updates report
- all validation is policy-controlled and auditable
- no raw secrets are stored
- demo mode is polished enough for design partners

### 23.1 PRD Audit Discipline

Full-product completion is not established by a green test run or newest-first
implementation history alone. Completion reviews must start from `PRD.md` and
this long-form product PRD, then atomize every source requirement into actor,
action, API surface, persistence, policy/RBAC/tenant isolation, evidence,
redaction, audit, UI, test, and residual-gap rows.

The source coverage ledger in `docs/PRD_SOURCE_COVERAGE_LEDGER.md` must index
each major PRD section before implementation status is considered. The
source-first requirement ledger in `docs/PRD_REQUIREMENT_LEDGER.md` is the
active atomic audit artifact for this work. A requirement remains partial when a
framework exists but a durable state, activity/history, policy gate, execution
path, report, or test implied by the PRD is missing. Broad parent requirements
are complete only when every source section has been atomized and every child
atom is implemented or explicitly blocked with a safe product behavior.

Do not claim the full product is complete unless the source coverage ledger has
no `SectionIndexed` or `NeedsImplementationAudit` rows, the requirement ledger
has zero `Partial`, `NotStarted`, or `Unknown` rows, every `Blocked` row has an
explicit external blocker and safe fallback, and full validation has passed
after the final implementation, schema, test, and documentation change.

## 24. Final Build Rule

Build the proof loop first.

connect -> validate -> evidence -> fix -> verify -> report

Everything else is expansion.

## 25. Real-First Existing-Codebase Addendum

The current repository is the source of truth. Preserve the existing monorepo, Fastify API, Next.js web app, Prisma data layer, policy engine, evidence packages, module registry, runner design, tests, and CI gates.

Product-visible tenant data must come from real persistence, real integrations, real local lab systems, real validation modules, real evidence storage, or honest empty/not-configured states. Test fixtures remain valid for automated tests. Sample/demo reports must be isolated and clearly labeled as sample data.

Do not present fake EDR, SIEM, attack-path, evidence, AI-app, fix-verification, or dashboard results as real tenant outcomes. If a capability is missing or lacks credentials, the product should show `Not configured`, `Requires integration`, `Requires verified scope`, `Requires internal runner`, `Requires approval`, or `Not implemented`.

Periscan's competitive platform priorities now include a unified validated findings layer, BAS first-run value, explainable exposure prioritization, action and revalidation loop, detection-rule validation surface, signal-driven triggers, executive evidence reporting, better-together UX, and Threat Center for advisory-to-validation workflows.
