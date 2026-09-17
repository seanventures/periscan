# Periscan User Stories

This file tracks PRD-derived stories implemented in the current build. The long-form source of truth remains [PERISCAN_FULL_PRODUCT_PRD.md](PERISCAN_FULL_PRODUCT_PRD.md).

## Product Meta Source Coverage

Requirement labels: `SRC-0-META`, `PRD-META-001`, `PRD-META-002`, `PRD-META-003`, `PRD-META-004`, `PRD-META-005`.

As a customer evaluating Periscan, I want the product name, category, promise, and one-sentence definition to be consistent across docs and app metadata, so that I understand what the product does before connecting systems.

As an API customer replacing the bundled UI, I want the product identity and promise to be stable public contracts, so that my own interface and documentation can align to the same Periscan positioning.

As a product reviewer, I want founder and Frost-report market context kept out of public product surfaces unless explicitly approved, so that internal strategy material does not leak into customer-facing UX or API docs.

## Product Vision Source Coverage

Requirement labels: `SRC-1-VISION`, `PRD-VISION-001`, `PRD-VISION-002`, `PRD-VISION-003`, `PRD-VISION-004`, `PRD-VISION-005`, `PRD-VISION-006`.

As a security leader, I want Periscan to answer what can compromise us, what controls caught it, which path matters most, what to fix first, whether the fix worked, and how to prove it through API-backed evidence, so that the product vision is operational rather than a tagline.

As an API customer replacing the first-party UI, I want findings, attack paths, control verdicts, remediations, fix verification, evidence, Snapshot, and report APIs to map directly to the PRD’s vision questions, so that I can build my own interface without losing product semantics.

As a product reviewer, I want continuous validation domains and no-raw-output positioning verified from source section 1, so that Periscan cannot regress into a scanner dashboard, pentest PDF, or generic BAS facade.

As a platform administrator expanding the third-party tool library, I want new tools certified through reviewed metadata, module/capability implementation, evidence, governance, runtime, runner, policy, and safety checks before use, so that OSS expansion follows the same proof model as customer validation.

## System Architecture Source Coverage

Requirement labels: `SRC-4-ARCHITECTURE`, `PRD-ARCH-001`, `PRD-ARCH-002`, `PRD-ARCH-003`, `PRD-ARCH-004`, `PRD-ARCH-005`, `PRD-ARCH-006`.

As an API customer replacing the first-party UI, I want every SaaS Control Plane responsibility in the PRD exposed through stable API, service, persistence, evidence, report, billing, and audit surfaces, so that the product architecture is usable outside the bundled web app.

As an integration engineer, I want every PRD connector category mapped to a connector marketplace category and manifest capability metadata, so that new agentless integrations can be added without inventing a parallel extension model.

As a security reviewer, I want the external point of attack to be limited to verified-scope, safe-profile Nuclei, DNS, TLS, and HTTP checks with policy/resource boundaries, so that outside-in validation cannot drift into unsafe scanning.

As a customer deploying an internal runner, I want runner architecture evidence for outbound signed-task polling, local scope enforcement, kill switch, and evidence upload, so that internal validation works through firewalls without inbound remote-access assumptions.

As an analyst, I want the Evidence Graph system-of-record bullets mapped to shared schemas, Prisma models, graph services, correlation, and reports, so that assets, identities, permissions, controls, exposures, signals, runs, paths, fixes, verification, evidence, and reports remain linked.

## Recommended Tech Stack Source Coverage

Requirement labels: `SRC-5-TECH-STACK`, `PRD-TECH-001`, `PRD-TECH-002`, `PRD-TECH-003`, `PRD-TECH-004`, `PRD-TECH-005`, `PRD-TECH-006`, `PRD-TECH-007`.

As a platform engineer, I want the PRD-recommended monorepo structure verified against real workspace packages and infra roots, so that missing package boundaries cannot be hidden by broad architecture prose.

As a frontend engineer, I want the Next.js app to expose TypeScript, Tailwind, TanStack Query, and shared Zod schema contracts, so that API-driven UI work can be refactored without inventing new client conventions.

As a backend engineer, I want the Fastify, Prisma, Postgres, Redis/BullMQ, MinIO/S3, worker, evidence, graph, and risk package boundaries tested from PRD section 5, so that stack drift is caught before release.

As a release reviewer, I want runner mTLS client-certificate authentication, outbound signed-task polling, and local enforcement tested together, so that stack coverage cannot falsely claim runner safety from transport direction alone.

## Real-First Existing-Codebase Source Coverage

Requirement labels: `SRC-25-REAL-FIRST-ADDENDUM`, `PRD-REALFIRST-001`, `PRD-REALFIRST-002`, `PRD-REALFIRST-003`, `PRD-REALFIRST-004`, `PRD-REALFIRST-005`, `PRD-REALFIRST-006`.

As a product reviewer, I want the Real-First addendum parsed from the PRD and tied to enforcement tests, so that product-visible tenant data cannot silently degrade into mocks, placeholders, or stale demo data.

As a customer API user, I want missing capabilities to return honest states such as Not configured, Requires integration, Requires verified scope, Requires internal runner, Requires approval, or Not implemented, so that automation can distinguish unavailable prerequisites from validated proof.

As a demo viewer, I want sample reports and demo data clearly labeled and isolated, so that I never mistake deterministic sample content for real customer validation.

As a platform engineer, I want the current monorepo architecture, API-first services, evidence stores, module registry, runner design, tests, and CI gates preserved as the source of truth, so that future feature expansion builds on the working product instead of bypassing it.

## Definition of Done for V1 Source Coverage

Requirement labels: `SRC-23-DOD-V1`, `PRD-DOD-001`, `PRD-DOD-002`, `PRD-DOD-003`, `PRD-DOD-004`, `PRD-DOD-005`.

As a release owner, I want every V1 Definition of Done bullet parsed from the PRD and mapped to implementation/test evidence, so that V1 readiness cannot be claimed from a stale completion report or broad feature label.

As a first customer, I want to self-onboard, verify scope, connect GitHub and AWS, run a Snapshot, receive 3-5 evidence-backed paths, create remediation, verify the fix, and export proof through APIs, so that Periscan works even if I replace the bundled UI.

As a report consumer, I want reports to include remediation, verification plan, and the latest fix-verification outcome, so that new evidence updates the proof package I share with customers, auditors, or executives.

As a safety reviewer, I want the V1 DoD to require policy/audit controls, no raw secret storage, and isolated polished demo/design-partner modes, so that first-customer readiness does not weaken security boundaries.

## Final Build Rule Source Coverage

Requirement labels: `SRC-24-FINAL-BUILD-RULE`, `PRD-FINAL-001`, `PRD-FINAL-002`, `PRD-FINAL-003`, `PRD-FINAL-004`.

As an API customer replacing the UI, I want the full proof loop exposed as stable API routes, so that I can connect systems, validate, retrieve evidence, create fixes, verify fixes, and generate reports without depending on the first-party web app.

As a security engineer, I want the first-customer flow to prove the ordered loop end to end, so that Periscan’s product promise is validated through evidence-backed remediation and report export rather than disconnected feature checks.

As a product reviewer, I want the final build rule to have its own source-derived regression, so that broad MVP, demo, Snapshot, remediation, or report coverage cannot hide a missing loop stage.

## UX Requirements Source Coverage

Requirement labels: `SRC-15-UX`, `PRD-UX-001`, `PRD-UX-002`, `PRD-UX-003`, `PRD-UX-004`.

As a security engineer, I want the primary navigation to use the PRD product language, so that I can move directly between Dashboard, Validation Snapshot, Exposure, Attack Paths, Controls, AI Apps, Remediation, Evidence, Reports, Integrations, Runners, Policies, and Admin.

As an API customer replacing the UI, I want PRD navigation labels to map to route-backed, API-consuming pages, so that first-party UX labels describe real public API surfaces rather than UI-only placeholders.

As a security leader, I want Dashboard cards for top validated exposure paths, missed controls, failed AI checks, fixes awaiting re-test, risk reduced, and evidence packs ready, so that the first screen answers the PRD’s proof questions from tenant data.

As a product reviewer, I want the PRD status badges and Snapshot flow steps to be executable UI contracts, so that a green route or accessibility test cannot hide renamed or missing product vocabulary.

## Product Modules Parent Source Coverage

Requirement labels: `SRC-3-MODULES`, `PRD-MODULES-001`, `PRD-MODULES-002`.

As a product reviewer, I want every Product Modules subsection in the PRD to have a child source coverage row and source-derived test, so that a broad parent row cannot hide an unaudited module area.

As an implementation agent, I want the section 3 parent inventory to fail when a module subsection is added, renamed, or removed without traceability updates, so that the product roadmap and test coverage stay synchronized.

## Reports Source Coverage

Requirement labels: `SRC-16-REPORTS`, `PRD-REPORT-001`, `PRD-REPORT-002`.

As a security leader, I want Validation Snapshot reports to expose the exact PRD sections in HTML and PDF, so that the proof package consistently answers executive summary, path, control, AI, remediation, verification, evidence, and methodology questions.

As an auditor, insurer, customer reviewer, MSSP client, or technical reviewer, I want audience-specific report variants backed by the same normalized evidence, so that Periscan can produce the right proof package without changing the underlying evidence model.

As an API customer replacing the first-party UI, I want report headings and audience behavior to be stable public contracts, so that downstream consumers can render or transform reports without depending on implementation-internal labels.

## Continuous Exposure Source Coverage

Requirement labels: `SRC-3.2-CONTINUOUS-EXPOSURE`, `PRD-CONTEXP-001`, `PRD-CONTEXP-002`, `PRD-CONTEXP-003`, `PRD-CONTEXP-004`, `PRD-CONTEXP-005`, `PRD-CONTEXP-006`.

As a security engineer, I want continuous exposure coverage across external assets, cloud, identity, SaaS, code/secrets, containers, Kubernetes, internal exposure, AI apps, VM/EAP, and CAASM/ASM sources, so that recurring validation reflects the modern attack surface described by the PRD.

As an API customer replacing the UI, I want recurring schedules, due runs, schedule diffs, and CTEM stages exposed through stable API contracts, so that I can automate continuous exposure management without scraping the first-party web app.

As a remediation owner, I want scheduled validation to detect reopened exposure and create auditable verification records, so that fixed risks cannot silently regress.

As a product reviewer, I want validated-risk fields to distinguish evidence-backed results from theoretical or inferred findings, so that Periscan does not collapse scanner theory into proof.

## Control Validation Source Coverage

Requirement labels: `SRC-3.3-CONTROL-VALIDATION`, `PRD-CONTROL-001`, `PRD-CONTROL-002`, `PRD-CONTROL-003`, `PRD-CONTROL-004`, `PRD-CONTROL-005`, `PRD-CONTROL-006`.

As a blue-team operator, I want Periscan to cover EDR, XDR, SIEM/logging, SOAR/ticketing, MDR, WAF/firewall, email security, MFA, cloud guardrails, and AI guardrails, so that control validation reflects the control categories named by the PRD.

As a detection engineer, I want control verdicts to distinguish detected, blocked, logged, alerted, routed, missed, no-evidence, and needs-tuning states, so that I can tune controls without overclaiming proof.

As a security engineer, I want dry-run ATT&CK-mapped control scenarios and rule coverage to produce evidence IDs, tuning guidance, and validation history, so that before/after control trends can be reviewed without live unsafe BAS execution.

As a safety reviewer, I want Atomic-style control validation to remain dry-run/fixture-only by default and policy-gated, so that control validation cannot become uncontrolled host execution.

## Product Principles Source Coverage

Requirement labels: `SRC-2-PRINCIPLES`, `PRD-PRINCIPLES-001`, `PRD-PRINCIPLES-002`, `PRD-PRINCIPLES-003`, `PRD-PRINCIPLES-004`, `PRD-PRINCIPLES-005`, `PRD-PRINCIPLES-006`.

As a security leader, I want the primary product experience to show validated results, attack paths, control verdicts, remediation, verification status, and evidence packs instead of raw scanner dumps, so that Periscan delivers proof rather than another findings table.

As an API customer replacing the first-party UI, I want the same proof surfaces exposed through stable APIs, so that onboarding, validation, reporting, runners, and MSSP workflows remain self-service and integration-ready.

As a security engineer using AI-assisted workflows, I want operators and model tools to recommend and explain work from normalized evidence only, so that AI helps the workflow without becoming the source of truth.

As a safety reviewer, I want every Product Principles safety bullet mapped to central policy, runner, scope, audit, and kill-switch enforcement, so that continuous validation remains safe by design.

As a product reviewer, I want the land-with-proof expansion path mapped to public API surfaces, so that Validation Snapshot can expand into continuous validation, controls, AI apps, fix verification, evidence packs, runner, and MSSP scale without UI-only behavior.

## Validation Snapshot Source Coverage

Requirement labels: `SRC-3.1-VALIDATION-SNAPSHOT`, `PRD-SNAPSHOT-001`, `PRD-SNAPSHOT-002`, `PRD-SNAPSHOT-003`, `PRD-SNAPSHOT-004`, `PRD-SNAPSHOT-005`, `PRD-SNAPSHOT-006`.

As a self-service security engineer, I want a Validation Snapshot to accept verified domain, cloud, identity, code, SaaS, AI app, control, and optional runner context through API-visible surfaces, so that I can onboard without depending on a fixed first-party UI.

As a security leader reviewing a Snapshot, I want 3-5 high-value evidence-backed paths and observations instead of a raw findings dump, so that I can understand what Periscan can prove right now.

As a remediation owner, I want every displayed Snapshot result to include evidence IDs, business impact, remediation priority, and a verification method, so that no result is presented without a proof and fix path.

As an API customer replacing the UI, I want Snapshot reports and exports to be generated from normalized evidence as HTML and PDF, so that downstream systems can consume the same proof package.

## PRD Audit Protocol

Requirement labels: `PRD-AUDIT-001`, `PRD-AUDIT-002`, `PRD-AUDIT-003`, `PRD-COMPLETE-001`, `PRD-ReleaseTraceability`.

As a product owner reviewing completion claims, I want source-first PRD requirement atoms tracked separately from newest-first execution history, so that broad traceability rows and passing tests cannot hide incomplete product features.

As a release reviewer, I want every major long-form PRD section indexed in a source coverage ledger before implementation status is considered, so that features documented outside the latest execution slice are not invisible during completion review.

As an autonomous implementation agent, I want a clear completion-claim policy and requirement ledger, so that I can distinguish a completed slice from a fully completed product.

As a release reviewer, I want missed implied requirements like certification history to become separate ledger atoms, so that durable state, audit history, and activity requirements are not collapsed into read-only report requirements.

As a release reviewer, I want scheduler, persistence, API, and security changes validated under accumulated-state release conditions, so that focused passing tests do not hide full-suite failures or shared-data timeouts.

As a release reviewer, I want an executable PRD audit gate with normal and strict modes, so that unresolved source-ledger sections and requirement atoms cannot be hidden by broad report wording or green test runs.

## OSS Acceleration Plan Source Coverage

Requirement labels: `SRC-10-OSS-PLAN`, `SRC-10.1-INITIAL-ENGINES`, `SRC-10.2-OSS-POLICY`, `PRD-OSS-001`, `PRD-OSS-002`, `PRD-OSS-003`, `PRD-OSS-004`.

As a validation engineer, I want every PRD-named OSS engine mapped to reviewed toolchain metadata, product capabilities, and module manifests, so that Periscan can safely expand validation engines without hidden catalog gaps.

As a safety reviewer, I want unsafe or legally sensitive OSS engines to remain deferred, content/import-only, or legal-review blocked, so that new tool coverage does not imply unsafe live execution.

As a release reviewer, I want every OSS policy bullet mapped to automated certification, license, evidence, and report checks, so that section 10 completion is proved from source text rather than inferred from the size of the tool catalog.

## Policy and Safety Engine Source Coverage

Requirement labels: `SRC-11-POLICY-SAFETY`, `PRD-POL-001`, `PRD-POL-002`, `PRD-POL-003`, `PRD-POL-004`.

As a security engineer requesting validation, I want the policy engine to evaluate tenant policy, role, scope, mission, module safety level, target, execution environment, and requested action, so that execution decisions are predictable and API-visible.

As a tenant administrator, I want tenant policy to make validation stricter without weakening Periscan safety boundaries, so that my organization can cap safety level, block mission types, require time windows, or restrict execution environments.

As an auditor, I want every policy decision to be written as an audit event, so that allowed, denied, and approval-required decisions are traceable after the fact.

## Evidence Graph Source Coverage

Requirement labels: `SRC-12-EVIDENCE-GRAPH`, `PRD-GRAPH-001`, `PRD-GRAPH-002`, `PRD-GRAPH-003`, `PRD-GRAPH-004`.

As a security engineer, I want every PRD graph node and edge represented in durable graph contracts, so that evidence, assets, identities, controls, attack paths, remediations, and verification events can be linked consistently.

As an analyst, I want the graph to answer reachability, identity access, secret-to-role, control-response, path-impact, path-breaker, closed-without-proof, and reopened-risk questions, so that Periscan can explain validated risk from evidence instead of raw findings.

As a release reviewer, I want Evidence Graph coverage parsed directly from PRD section 12, so that graph completion is not inferred only from the presence of graph tables or attack path APIs.

## Risk Scoring Source Coverage

Requirement labels: `SRC-13-RISK-SCORING`, `PRD-RISK-001`, `PRD-RISK-002`, `PRD-RISK-003`, `PRD-RISK-004`.

As a security engineer, I want risk scores to include validation state, reachability, exploitability, control response, privilege, criticality, impact, threat context, confidence, recurrence, remediation, and verification status, so that prioritization reflects the full PRD risk model.

As an API customer, I want risk factors to expose attack feasibility, business impact, control failure, confidence, and threat relevance, so that a replacement UI can explain why a path is Critical, High, Medium, Low, Informational, or Fixed.

As a release reviewer, I want every risk modifier parsed from PRD section 13 and tested directionally, so that blocked/detected/missed, reopened, sensitive-data, privileged-path, and inconclusive semantics cannot drift silently.

As a remediation owner, I want a path marked Fixed only when validation or verification evidence proves it, so that closing a ticket or setting remediation status cannot overclaim risk reduction.

## Runner Source Coverage

Requirement labels: `SRC-14-RUNNER`, `PRD-RUNNER-001`, `PRD-RUNNER-002`, `PRD-RUNNER-003`, `PRD-RUNNER-004`, `PRD-RUNNER-005`, `PRD-RUNNER-006`.

As a tenant administrator deploying an internal runner, I want Docker, Linux service, Kubernetes, and future Windows deployment modes represented in runner contracts and artifacts, so that customer-network validation can be planned without ad hoc install assumptions.

As a network/security administrator, I want the runner to communicate outbound over firewall-friendly HTTPS signed-task polling with no inbound firewall rule, reverse SSH tunnel, arbitrary tunnel, or shell channel, so that customer-network deployment preserves the PRD safety boundary.

As a release reviewer, I want the PRD section 14 mTLS/certificate language mapped to real certificate issuance, stored certificate fingerprints, TLS-terminator fingerprint enforcement, and outbound signed-envelope polling, so that Runner completion is evidence-backed rather than inferred.

As a runner operator, I want signed tasks, local allowlists, scope constraints, nonce replay defense, resource/time limits, local audit hashes, kill switch behavior, and evidence upload to be tested from source requirements, so that runner execution is auditable and bounded.

As an API customer replacing the UI, I want runner registration, credential issuance, polling, task results, evidence upload, and audit events exposed through API-backed lifecycle routes, so that the first-party UI is not the only way to operate runners.

## Signal Fabric Source Coverage

Requirement labels: `SRC-8-SIGNAL-FABRIC`, `PRD-SF-001`, `PRD-SF-002`, `PRD-SF-003`, `PRD-SF-004`.

As an API customer replacing the Periscan UI, I want every PRD-listed Signal Fabric integration and capability category represented by catalog or platform contracts, so that I can discover what Periscan can connect to without relying on marketing copy.

As a security engineer onboarding the MVP flow, I want AWS, GitHub, verified domain/external validation, Slack/Jira workflows, AI app endpoint registration, and mock EDR/SIEM observers to remain source-audited, so that first Snapshot prerequisites cannot silently regress.

As a product engineer expanding integrations, I want capability nouns like CI/CD, container registries, RAG systems, guardrails, and agent frameworks mapped explicitly, so that PRD audits distinguish connector products from platform surfaces.

## Module Registry Source Coverage

Requirement labels: `SRC-9-MODULE-REGISTRY`, `PRD-MOD-001`, `PRD-MOD-002`, `PRD-MOD-003`.

As a validation module author, I want every PRD-required manifest field represented in the shared module schema, so that new modules expose predictable API and policy metadata.

As a safety reviewer, I want the PRD safety levels to map directly to shared enum values, so that policy, UI, and worker behavior cannot drift from documented safety language.

As a release reviewer, I want module-registry completion proved from source section 9, so that module count or OSS-tool history does not hide a missing manifest or safety-level requirement.

## Data Model Source Coverage

Requirement labels: `SRC-6-DATA-MODEL`, `PRD-DATA-001`, `PRD-DATA-002`, `PRD-DATA-003`, `PRD-DATA-004`.

As an API customer building against Periscan data, I want every PRD core entity to have a shared schema and Prisma model, so that public DTOs and persisted records do not drift.

As a product engineer extending the platform, I want every PRD field under each core entity to be checked against shared contracts and persistence, so that field-level gaps are caught before features rely on missing data.

As a security engineer defining validation scope, I want PRD scope types to stay aligned with shared and Prisma enums, so that authorization and policy checks cannot miss a documented scope kind.

As a release reviewer, I want field aliases to be explicit and tested, so that implementation naming choices do not silently hide missing PRD data requirements.

## API Specification Route Coverage

Requirement labels: `SRC-7-API-SPEC`, `PRD-API-001`, `PRD-API-002`, `PRD-API-003`, `PRD-API-004`, `PRD-API-First`.

As an API customer replacing the first-party UI, I want every route listed in the PRD API specification to exist in the generated OpenAPI contract, so that I can build against Periscan without discovering missing endpoints at integration time.

As a security engineer running validation missions, I want to cancel queued or running missions through the API, so that unsafe, stale, or mistaken work can be stopped and audited without manual database intervention.

As a security engineer reviewing attack paths, I want to request verification through the API, so that path validation stays policy-gated and does not fabricate proof or fixed state.

As a release reviewer, I want the PRD route list mechanically compared against OpenAPI, so that future completion audits cannot infer API completeness from broad traceability labels alone.

## Frontier Gateway Scope-Bound Context

Requirement labels: `SRC-3.X-FRONTIER-GATEWAY`, `PRD-FG-003`, `PRD-FG-004`, `PRD-FG-010`.

As a security engineer using Frontier Gateway, I want the model to receive only redacted data matching the session's verified scopes, so that the model cannot reason over unrelated tenant assets.

As an API customer replacing the UI, I want read-only model tools to enforce the same verified scope boundary as context bundles, so that automation cannot bypass scope restrictions through typed tools.

As a security reviewer, I want out-of-scope tenant data excluded when a scope match cannot be proven, so that conservative filtering prevents cross-scope context leakage.

## Third-Party Tool Promotion Certification History

Requirement labels: `PRD-ThirdPartyToolPromotionCertificationHistory`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

As a tenant administrator promoting a reviewed security tool, I want to save certification snapshots for a promotion package, so that I can prove when a tool was ready or still blocked before governed use.

As a customer API user replacing the UI, I want `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications` to list saved certification snapshots, so that automation can audit certification history without scraping current-state reports.

As a security reviewer, I want saved certification snapshots to remain non-executing governance artifacts, so that saving history cannot enable tools, install runtimes, queue missions, dispatch runner tasks, or execute modules.

## Third-Party Tool Promotion Certification

Requirement labels: `PRD-ThirdPartyToolPromotionCertification`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

As a tenant administrator promoting a reviewed security tool, I want a certification report for the promotion package, so that I can see whether catalog, module, evidence, governance, runtime, runner, policy, and safety requirements are satisfied before use.

As a customer API user replacing the UI, I want `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certification-report` to return certified-for-governance, runtime, mission, and runner-dispatch flags, so that automation can gate enablement and execution workflows without scraping the UI.

As a security reviewer, I want certification reports to be read-only and non-executing, so that certification cannot enable tools, install runtimes, queue missions, dispatch runner tasks, or execute modules.

## Third-Party Tool Candidate Readiness Summary

Requirement labels: `PRD-ThirdPartyToolCandidateReadinessSummary`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`.

As a tenant administrator expanding the Periscan tool library, I want to summarize implementation readiness across all submitted tool candidates, so that large imported tool backlogs can be triaged without opening each candidate one by one.

As a customer API user replacing the UI, I want `/api/v1/third-party-tools/intake/candidates/readiness-summary` to return per-candidate readiness, aggregate counts, and top required actions, so that automation can route catalog/module/parser/policy work systematically.

As a security reviewer, I want the readiness summary to be read-only and non-executing, so that bulk triage cannot create catalog entries, install runtimes, enable tools, queue missions, dispatch runner tasks, or execute modules.

## Third-Party Tool Candidate Batch Import

Requirement labels: `PRD-ThirdPartyToolCandidateBatchImport`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`.

As a tenant administrator expanding the Periscan tool library, I want to import a batch of proposed third-party tool manifests, so that many candidate tools can enter the same reviewed backlog without manually submitting each one.

As a customer API user replacing the UI, I want `/api/v1/third-party-tools/intake/candidates/import` to return per-item submitted, failed, rejected, or needs-changes outcomes, so that automation can distinguish malformed, duplicate, and accepted candidate manifests without guessing from a single batch status.

As a security reviewer, I want batch import to persist only candidate backlog records and audit metadata, so that proposed tools cannot become catalog entries, tenant-enabled tools, queued missions, runner tasks, or executed modules until the existing review, implementation, promotion, policy, and runtime gates pass.

## Third-Party Tool Due Refresh

Requirement labels: `PRD-ThirdPartyToolDueRefresh`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`.

As a tenant administrator managing a growing validation tool library, I want to refresh all due reviewed tools from one API action, so that Periscan can systematically detect upstream drift without manually checking every tool.

As a customer API user replacing the UI, I want `/api/v1/third-party-tools/refresh-due` to return checked, skipped, not-due, and failed tool states with linked upstream-check and update-recommendation records, so that automation can decide what review or approval work remains.

As a security reviewer, I want due refresh to skip disabled, deferred, and legal-review tools by default and never install, enable, queue missions, dispatch runner tasks, or execute modules, so that library expansion remains policy-gated and auditable.

## Third-Party Tool Runner Task Activity

Requirement labels: `PRD-ThirdPartyToolRunnerTaskActivity`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

As a tenant administrator using governed runner tools, I want each tool activity timeline to include runner task lifecycle entries, so that I can see when a tool was dispatched and what persisted task status it has.

As a customer API user replacing the UI, I want `/api/v1/third-party-tools/:toolId/activity` to include runner task activity alongside audits, validation runs, install jobs, updates, and promotion artifacts, so that automation can reconstruct tool usage from one API surface.

As a security reviewer, I want runner task activity to expose task metadata without raw targets or credentials, so that execution observability does not become a target-disclosure surface.

## Third-Party Tool Runner Dispatch UI

Requirement labels: `PRD-ThirdPartyToolRunnerDispatchUX`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

As a tenant administrator with a governed runner-ready tool, I want Registry Center to dispatch a signed runner task through the third-party tool API, so that I can use approved tools inside customer networks without leaving the governance workflow.

As a customer API user replacing the UI, I want the first-party UI to submit the same `/api/v1/third-party-tools/:toolId/runner-dispatch` payload that public clients use, so that dispatch behavior remains API-driven and replaceable.

As a security reviewer, I want Registry Center to render dispatch controls only after the server reports dispatchable capabilities, so that UI state cannot bypass tenant enablement, verified scope, runner readiness, or server allowlists.

## Third-Party Tool Promotion Governance Handoff

Requirement labels: `PRD-ThirdPartyToolPromotionHandoff`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

As a tenant administrator promoting a reviewed tool, I want a governance handoff report for each promotion package, so that I can see whether the tool is blocked, needs enablement, needs runtime readiness, needs runner prerequisites, or is ready for explicit policy-gated execution.

As a customer API user replacing the UI, I want the handoff report to list exact next API actions, action statuses, execution side effects, and policy-gate requirements, so that automation can use newly promoted tools without guessing which endpoints are safe to call.

As a security reviewer, I want promotion handoff reports to be computed from current tenant governance, runtime, and runner eligibility without installing, enabling, queueing, dispatching, or executing anything, so that the report cannot become hidden execution.

## Connector Health Truthfulness

Requirement labels: `PRD-ConnectorHealthTruthfulness`, `PRD-Real-First`, `PRD-SignalFabric`, `GAP-CONNECTOR-UNKNOWN-HEALTH-INTENTIONAL-001`.

As a security reviewer, I want connectors with no safe non-mutating live health endpoint to return an honest `Unknown` readiness state, so that Periscan does not create webhook deliveries, incidents, prompt screening calls, or fabricated signals just to prove connectivity.

As a customer API user replacing the UI, I want incoming-webhook, Events API, and unconfigured inventory connectors to expose readiness-only sync results with no assets or signals, so that automation can distinguish configured-but-unverified destinations from evidence-backed validation or workflow delivery.

## API Test Build-Artifact Isolation

Requirement labels: `PRD-ReleaseValidationDeterminism`, `PRD-AuditActionContractGuard`, `PRD-ProductionReadiness`, `GAP-API-TEST-DIST-EXCLUDE-001`.

As a release reviewer, I want focused API test commands to ignore compiled `dist` artifacts, so that stale build output cannot create false audit-contract failures or hide source-level behavior during release validation.

As a Periscan engineer adding audited workflows, I want the audit action contract guard to run against source tests only, so that shared schemas, API mapping, and Prisma enums are checked from the current working tree.

## Tenant Webhook Lifecycle Audit Completeness

Requirement labels: `PRD-Audit-Log-Completeness`, `PRD-Webhooks`, `PRD-API-First`, `PRD-IntegrationCredentialRedaction`, `GAP-WEBHOOK-LIFECYCLE-AUDIT-COMPLETENESS-001`.

As a tenant administrator managing outbound webhooks, I want create, update, delete, and test actions to write secret-free audit events, so that webhook configuration changes are reviewable without exposing signing secrets, endpoint URLs, or payload content.

As a customer API user replacing the UI, I want webhook lifecycle audit events to identify the affected tenant webhook through `/api/v1/audit-events`, so that automation can reconstruct webhook configuration history from the API without relying on hidden UI state.

## Trust Safety Integration Readiness Metadata

Requirement labels: `PRD-TrustSafety`, `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-TRUST-SAFETY-INTEGRATION-READINESS-METADATA-001`.

As a tenant administrator reviewing Trust & Safety, I want each connected system to show implementation tier, execution readiness, and live-support status from the tenant API, so that I can understand connector posture without switching to the marketplace.

As a customer API user replacing the UI, I want `/api/v1/tenants/current/trust-safety` to include the same connected integration readiness metadata available on integration records, so that the trust page can be rebuilt from one API response.

As a tenant administrator reviewing Trust & Safety, I want connector readiness metadata without raw integration configuration or credential material, so that trust transparency does not become a secret-exposure surface.

## Typed Integration Permissions Summary

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `GAP-INTEGRATION-PERMISSIONS-SUMMARY-SCHEMA-001`.

As a customer API user, I want connected integration readiness metadata to be documented in the shared API schema, so that generated clients can use the fields without reverse-engineering loose JSON.

As a Periscan engineer adding integration metadata, I want the shared schema to validate known readiness enum values while preserving compatibility for additional connector-specific permission details.

## Connected Integration Metadata UI

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-CONNECTED-METADATA-UI-001`.

As a tenant administrator reviewing connected systems, I want connected Integration Marketplace cards to show the implementation tier and readiness stored on the integration record, so that I can verify what is actually connected without relying on catalog-only context.

As a customer API user replacing the UI, I want the first-party UI to prove connected integration records are self-describing, so that I can trust `/api/v1/integrations` as a standalone surface for connected-system inventory.

## Persisted Integration Catalog Metadata

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-PERSISTED-CATALOG-METADATA-001`.

As a customer API user replacing the Periscan UI, I want created and listed integration records to include connector implementation tier and readiness metadata, so that I can render onboarding and trust surfaces without joining back to the catalog endpoint.

As a tenant administrator reviewing connected systems, I want each integration record to show whether it is a dedicated live connector or standardized catalog connector, so that setup expectations remain clear after connection.

As a security reviewer auditing integration onboarding, I want `integration.connected` audit events to identify the connector without including raw config or credentials, so that auditability does not leak secrets.

## Registry Capability Readiness Visibility

Requirement labels: `PRD-RegistryCenter-APISurface`, `PRD-OSS-Productization`, `PRD-API-First`, `GAP-REGISTRY-CAPABILITY-READINESS-VISIBILITY-001`.

As a tenant security engineer reviewing the Registry Center, I want each OSS capability card to show execution readiness and runtime reason, so that blocked or fixture-only capabilities are visible before any mission planning.

As a customer API user replacing the UI, I want the first-party UI to consume the same capability readiness fields exposed by `/api/v1/open-source-capabilities`, so that UI behavior proves the API contract is sufficient for replacement clients.

As a release reviewer, I want component tests covering Ready, FixtureOnly, and Blocked capability states, so that future UI changes cannot hide policy/readiness metadata from the product surface.

## Integration Catalog API Tier Metadata

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-CATALOG-API-TIER-METADATA-001`.

As a customer API user replacing the Periscan UI, I want `/api/v1/integrations/catalog` to expose implementation tier and execution readiness for every connector, so that I can build onboarding flows without scraping generated docs or guessing from `availability`.

As a tenant administrator evaluating connectors, I want the Integration Marketplace to show whether a connector is a dedicated client, standardized catalog manifest, or planned entry, so that I understand what is credential-ready and what is only roadmap-visible.

## Integration Catalog Connectability Truthfulness

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-CATALOG-CONNECTABILITY-TRUTHFULNESS-001`.

As a customer API user replacing the Periscan UI, I want the generated integration directory to expose dedicated live clients separately from planned catalog coverage, so that credential setup is never offered before a vendor-specific implementation is certified.

As a tenant administrator evaluating integrations, I want public docs to describe the 267-entry catalog as 126 dedicated live integrations plus 141 planned, non-connectable entries, so that marketplace breadth never overstates operational coverage.

## Production Redis Queue Configuration

Requirement labels: `PRD-ProductionRedisConfig`, `PRD-JobScheduler`, `PRD-ProductionReadiness`.

As a platform operator deploying Periscan for customers, I want API, worker, model-gateway, and webhook queues to require an explicit Redis URL in production, so that jobs cannot silently enqueue against a local development Redis instance.

As a release reviewer, I want deployment readiness to reject malformed Redis URLs, so that production queue startup and readiness checks use the same Redis connection contract.

## Production Web API Proxy Configuration

Requirement labels: `PRD-ProductionWebApiProxyConfig`, `PRD-API-First`, `PRD-ProductionReadiness`.

As a customer deploying the first-party web app, I want production web proxy routes to require an explicit API URL, so that customer API calls cannot silently route to a local development API fallback.

As a customer replacing the UI, I want web proxy failures to use stable API-style error codes, so that custom clients can distinguish product misconfiguration from upstream API outages.

## Runner Task Signing Production Readiness

Requirement labels: `PRD-RunnerTaskSigningProductionReadiness`, `PRD-Runner-SignedTasks`, `PRD-ProductionReadiness`.

As a tenant admin, I want deployment readiness to require a valid runner task-signing key in production, so that runner registration cannot fail later because signing material is absent.

As a platform operator, I want the same key validation used by readiness and runner registration, so that malformed or mismatched signing material is caught before customer runner deployment.

## Production Dev Mode Disabled

Requirement labels: `PRD-ProductionDevModeDisabled`, `PRD-SafetyBoundaries`, `PRD-ProductionReadiness`.

As a tenant admin, I want production startup to reject development fixture mode, so that manual scope bypasses, mock integrations, and fixture validations cannot be enabled accidentally.

As a worker operator, I want production workers to reject development fixture targets, so that queued validation cannot execute synthetic evidence paths in customer environments.

As a release reviewer, I want deployment readiness to flag `PERISCAN_DEV_MODE=true` in production, so that the admin readiness API matches runtime safety boundaries.

## Production Session Secret Readiness

Requirement labels: `PRD-ProductionSessionSecretReadiness`, `PRD-Auth-Tenant-RBAC`, `PRD-ProductionReadiness`.

As a tenant admin, I want deployment readiness to reject the development session secret in production, so that session tokens are not signed with known default material.

As a platform operator, I want readiness checks to match API startup behavior, so that deployment status cannot claim production readiness for a configuration the API will refuse to boot.

## Evidence Object Storage Production Config

Requirement labels: `PRD-EvidenceObjectStorageProductionConfig`, `PRD-Evidence-Packs`, `PRD-ProductionReadiness`.

As a tenant admin, I want production readiness to require complete evidence object storage configuration, so that proof artifacts are not written to ephemeral local filesystem storage.

As a platform operator, I want local MinIO shortcuts to stay development-only, so that production deployments use explicit S3-compatible bucket and credential configuration.

As a release reviewer, I want tests proving incomplete production evidence storage fails closed, so that reports and evidence packs always have durable storage prerequisites.

## Production CORS Origin Allowlist

Requirement labels: `PRD-ProductionCorsOriginAllowlist`, `PRD-API-First`, `PRD-ProductionReadiness`.

As an API customer, I want direct-browser API access to use an explicit production-safe origin allowlist, so that replacement UIs can call Periscan APIs without opening credentialed CORS to unsafe origins.

As a tenant admin, I want deployment readiness to flag unsafe configured CORS origins, so that production deployments do not silently accept wildcard, localhost, or non-HTTPS browser callers.

As a release reviewer, I want startup and readiness tests for production CORS origins, so that API-first extensibility does not weaken browser security defaults.

## OSS Capability Coverage

Requirement labels: `PRD-OSSCapabilityCoverage`, `PRD-OSS-Safety`, `PRD-API-First`.

As an API customer, I want every visible OSS tool to expose at least one typed capability, so that replacement UIs and automations can understand what each tool does without relying on implementation details.

As a tenant security engineer, I want safe recon tools to be marked implemented and high-impact dry-run tools to be marked fixture-only, so that Periscan does not overstate what can run live.

As a release reviewer, I want tests that fail if any OSS registry tool has zero capabilities, so that future tool additions cannot silently bypass API productization.

## sqlmap Capability Blocked

Requirement labels: `PRD-SqlmapCapabilityBlocked`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-NoUnauthorizedOffense`.

As a tenant security engineer, I want high-impact SQL injection tooling to be visible as blocked instead of executable, so that Periscan cannot run live sqlmap probes in the current release.

As an API customer, I want sqlmap readiness to report blocked/legal-review status even when Docker or a binary is installed, so that replacement UIs do not present SQL injection probing as available.

As a release reviewer, I want catalog tests proving sqlmap has an explicit blocked capability, so that high-impact dry-run modules cannot appear as unclassified planned work.

## ScoutSuite Live Posture Disabled

Requirement labels: `PRD-ScoutSuiteLivePostureDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-CloudValidationControls`.

As a tenant security engineer, I want legal-review cloud posture tools to fail closed by default, so that Periscan does not run ScoutSuite against customer cloud accounts until legal and safety review explicitly enables it.

As an API customer, I want ScoutSuite readiness to report blocked/legal-review status even when a runtime is installed, so that replacement UIs do not present the tool as executable.

As a release reviewer, I want direct module execution tests proving ScoutSuite is not invoked outside fixture/import mode, so that scheduler bypasses cannot run live legal-review tooling.

## WhatWeb Live Fingerprint Disabled

Requirement labels: `PRD-WhatWebLiveFingerprintDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

As a tenant security engineer, I want legal-review web fingerprinting tools to fail closed by default, so that Periscan does not run WhatWeb against customer apps until legal and safety review explicitly enables it.

As an API customer, I want WhatWeb readiness to report blocked/legal-review status even when a runtime is installed, so that replacement UIs do not present the tool as executable.

As a release reviewer, I want direct module execution tests proving WhatWeb is not invoked outside fixture/import mode, so that scheduler bypasses cannot run live legal-review tooling.

## testssl Live TLS Audit Disabled

Requirement labels: `PRD-TestsslLiveAuditDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

As a tenant security engineer, I want live TLS validation to use Periscan's built-in safe checks rather than legal-review scanners by default, so that Periscan can validate TLS posture without invoking testssl.sh until legal and safety review approves it.

As an API customer, I want testssl readiness to report blocked/legal-review status even when a runtime is installed, so that replacement UIs do not present testssl.sh as executable.

As a release reviewer, I want direct module execution tests proving testssl.sh is not invoked outside fixture/import mode, so that scheduler bypasses cannot run live legal-review tooling.

## Nikto Live Scan Disabled

Requirement labels: `PRD-NiktoLiveScanDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

As a tenant security engineer, I want legal-review web scanners to fail closed by default, so that Periscan does not run live Nikto checks until legal and safety review explicitly enables them.

As an API customer, I want Nikto readiness to report blocked/legal-review status even when a runtime is installed, so that replacement UIs do not present the scanner as executable.

As a release reviewer, I want direct module execution tests proving Nikto is not invoked outside fixture/import mode, so that scheduler bypasses cannot run live legal-review tooling.

## Web Content Discovery Fuzzing Disabled

Requirement labels: `PRD-WebContentDiscoveryFuzzingDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

As a tenant security engineer, I want web content discovery to fail closed instead of running default path fuzzing, so that Periscan does not probe customer web apps beyond explicitly safe and approved validation boundaries.

As an API customer, I want the module manifest and start-constraint API to show live content discovery is disabled, so that replacement UIs and automations do not present `ffuf` fuzzing as available.

As a release reviewer, I want direct module execution tests proving `ffuf` is not invoked outside fixture/import mode, so that scheduler bypasses cannot re-enable live fuzzing.

## Runner Accepted-Task Halt Guard

Requirement labels: `PRD-RunnerAcceptedTaskHaltGuard`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-Real-First`.

As a tenant security engineer, I want runner revocation and kill switch actions to halt accepted-but-unfinished tasks, so that evidence cannot be added after I revoke or halt a customer-side runner.

As an API customer, I want accepted tasks to receive explicit terminal states when a runner is revoked or halted, so that replacement UIs and automations can explain why validation stopped.

As a release reviewer, I want DB-backed acceptance coverage for accepted-task halt and revoke paths, so that runner lifecycle sweeps cannot regress to only queued or running states.

## Runner Reject Terminal State Guard

Requirement labels: `PRD-RunnerRejectTerminalStateGuard`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-Real-First`.

As a tenant security engineer, I want runner reject callbacks to preserve already-terminal task states, so that a closed task cannot be rewritten into a different denial state.

As an API customer, I want closed-task reject attempts to return `runner_task_invalid_state`, so that automation can distinguish a lifecycle violation from a valid local-policy denial.

As a release reviewer, I want acceptance coverage proving a `Rejected` task remains `Rejected`, so that all runner lifecycle transitions use the same terminal-state contract.

## Runner Artifact Terminal State Guard

Requirement labels: `PRD-RunnerArtifactTerminalStateGuard`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-Real-First`.

As a tenant security engineer, I want completed, failed, cancelled, expired, rejected, or policy-denied runner tasks to reject late artifact uploads, so that new evidence cannot be attached after a task lifecycle is closed.

As an API customer, I want runner artifact upload failures to return a clear `runner_task_invalid_state` error, so that replacement UIs and automation can distinguish late evidence from hash, size, or expiry errors.

As a release reviewer, I want DB-backed acceptance coverage proving terminal-task uploads create no evidence and write a rejection audit, so that runner proof integrity cannot regress.

## Audit Action Contract Guard

Requirement labels: `PRD-AuditActionContractGuard`, `PRD-Audit-Completeness`, `PRD-API-First`.

As a release reviewer, I want shared audit action schemas, API mapping, and Prisma enum values to be checked together, so that adding a new audited workflow cannot silently break audit persistence.

As an API customer, I want every documented audit action to persist consistently, so that external governance tools can rely on the audit log contract.

As a security engineer, I want CI to fail when an audit action is only partially wired, so that security-relevant actions do not disappear from evidence and compliance trails.

## Threat Correlation Evidence Gate

Requirement labels: `PRD-ThreatCorrelationEvidenceGate`, `PRD-Evidence-Auditable`, `PRD-ValidationSnapshot`, `PRD-Real-First`.

As a security leader, I want Snapshot threat-advisory exposure counts to require validation evidence IDs, so that executive reports do not overstate exposure from completed-but-unproven runs.

As an API customer, I want `correlatedThreatAdvisoryCount` to mean "matched tenant validation evidence," so that replacement UIs can trust the metric without inspecting internal run state.

As a release reviewer, I want a regression proving indicator-matched runs without evidence do not correlate advisories, so that the proof loop remains evidence-backed.

## OSS Current Phase Canonicalization

Requirement labels: `PRD-OSS-CurrentPhaseCanonicalization`, `PRD-OSS-CurrentPhaseAlias`, `PRD-API-First`.

As an API customer, I want current OSS toolchain phases to be stored and returned as `Current`, so that API clients and replacement UIs do not need to understand legacy internal MVP terminology.

As an existing automation owner, I want `phase=CurrentMvp` requests to keep working as an alias, so that old clients can upgrade without a breaking API change.

As a validation engineer, I want the Current OSS phase to include every tool marked current in the active workstream, so that readiness checks cover the same modules the product exposes.

As a release reviewer, I want tests proving no default capability output uses `CurrentMvp`, so that legacy phase labels cannot leak back into customer-facing catalog data.

## OSS Current Phase Readiness Docs

Requirement labels: `PRD-OSS-CurrentPhaseReadinessDocs`, `PRD-OSS-CurrentPhaseAlias`, `PRD-ReleaseTraceability`.

As a release engineer, I want production-readiness commands to use the same `Current` OSS phase label exposed by the API and CLI, so that first-customer validation runbooks do not depend on stale internal names.

As an API customer, I want legacy `CurrentMvp` compatibility to remain an input alias only, so that existing automation does not break while new docs and outputs use stable customer-facing terminology.

As a future coding agent, I want active OSS workstream docs to reject stale phase names, so that documentation drift cannot reintroduce completed-phase ambiguity.

## Jira Mock Shortcut Production Guard

Requirement labels: `PRD-RealFirst-JiraMockShortcutGuard`, `PRD-RealFirst-MockIntegrationGuard`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Real-First`.

As an API customer, I want connector-specific mock shortcut endpoints to be denied outside dev mode, so that replacement UIs cannot accidentally create fixture-backed integrations in production.

As a tenant administrator, I want Jira workflow setup in production to require real connector credentials, so that remediation workflow evidence is not sourced from mock configuration.

As a release reviewer, I want the dedicated Jira mock shortcut route covered by acceptance tests, so that generic mock-integration guards cannot regress around convenience endpoints.

## Primary Navigation Contract Drift Guard

Requirement labels: `PRD-WebNavigationContract`, `PRD-WebRouteCoverage`, `PRD-UX-MainNavigation`, `PRD-API-First`, `PRD-Accessibility`.

As an API customer using a replacement UI, I want Periscan's bundled web routes to stay synchronized with the published navigation contract, so that public product surfaces do not become hidden or untested.

As a security operator, I want every first-party product page to remain reachable through the primary navigation, so that validation, evidence, remediation, runner, threat, and trust workflows are discoverable without relying on direct URLs.

As a release reviewer, I want CI to fail when a static Next.js page is added without registration in the route contract, so that app-shell and accessibility coverage cannot silently skip new product surfaces.

## Fixture Mission Target Guard

Requirement labels: `PRD-RealFirst-MissionTargetGuard`, `PRD-PolicyEngine`, `PRD-JobScheduler`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

As a security engineer, I want policy-preview and mission-start targets to reject fixture execution hints in production, so that validation jobs cannot be queued with synthetic module inputs.

As an API customer, I want fixture target denial to happen before policy or job writes, so that replacement UIs and automation get clear feedback without leaving misleading audit or queue state.

As a release reviewer, I want nested fixture target payloads covered through public API tests, so that arbitrary target fields cannot bypass Real-First evidence boundaries.

## Mock Integration Dev-Mode Guard

Requirement labels: `PRD-RealFirst-MockIntegrationGuard`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

As a tenant administrator, I want production integrations to require real connector configuration, so that connected-system data in Periscan is not accidentally created from mock fixtures.

As an API customer, I want mock integration requests rejected clearly outside dev mode, so that replacement UIs and automation cannot mix fixture connectors with customer evidence.

As a test engineer, I want mock integrations preserved in dev mode, so that deterministic connector acceptance tests and local lab flows remain fast and isolated.

## Control Validation Fixture Verdict Guard

Requirement labels: `PRD-RealFirst-ControlFixtureGuard`, `PRD-ControlValidation`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

As a blue-team operator, I want production control validation verdicts to come from real control observers or explicitly dry-run module behavior, so that Periscan does not turn caller-supplied fixture outcomes into proof.

As an API customer, I want synthetic control observer outcomes rejected clearly outside dev mode, so that my automation cannot accidentally mix lab verdicts with customer evidence.

As a release reviewer, I want this boundary covered through the public control validation API, so that Real-First control verdict behavior does not regress.

## Scope Posture Fixture Mode Guard

Requirement labels: `PRD-RealFirst-ScopePostureFixtureGuard`, `PRD-ScopePostureChecks`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

As a security engineer, I want scope posture checks to run from measured live modules in production, so that posture evidence is not accidentally based on fixture inputs.

As an API customer, I want fixture posture requests rejected clearly outside dev mode, so that my integration can distinguish lab data from customer evidence.

As a release reviewer, I want production fixture-denial behavior covered through the public API, so that Real-First posture evidence boundaries do not regress.

## Threat Intel, Security Rating, and Compliance Connector API Acceptance

Requirement labels: `PRD-OtherConnector-Acceptance`, `PRD-ThreatIntel-Connectors`, `PRD-SecurityRatings-Connectors`, `PRD-ComplianceEvidence-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect threat-intelligence, external-intelligence, security-rating, and compliance-evidence systems through public API routes, so that Periscan can enrich validation and evidence workflows without depending on the bundled UI.

As a security reviewer, I want these connector credentials redacted from responses and encrypted at rest, so that API keys, tokens, and private keys are not exposed during onboarding or sync.

As a tenant administrator, I want threat-intel/compliance sync evidence, signals, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my external evidence connectors.

## Security Control Connector API Acceptance

Requirement labels: `PRD-SecurityControlConnector-Acceptance`, `PRD-ControlValidation`, `PRD-EDR-XDR-Connectors`, `PRD-SIEM-Connectors`, `PRD-WAF-Firewall-Connectors`, `PRD-EmailSecurity-Connectors`, `PRD-SOAR-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a blue-team operator, I want to connect security controls through public API routes, so that Periscan can observe control evidence without depending on the bundled UI.

As a security reviewer, I want control connector credentials redacted from responses and encrypted at rest, so that API keys, tokens, secrets, and key identifiers are protected during onboarding and sync.

As a tenant administrator, I want control sync evidence, signals, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my EDR, SIEM, WAF, firewall, email-security, or SOAR connectors.

## Cloud Connector API Acceptance

Requirement labels: `PRD-CloudConnector-Acceptance`, `PRD-AWS-CloudConnector`, `PRD-Azure-CloudConnector`, `PRD-GCP-CloudConnector`, `PRD-Cloudflare-CloudConnector`, `PRD-Kubernetes-CloudConnector`, `PRD-CloudPosture-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect cloud, Kubernetes, edge, workload, and data-platform systems through public API routes, so that cloud posture and exposure context can feed validation without depending on the bundled UI.

As a security reviewer, I want cloud connector credentials redacted from responses and encrypted at rest, so that access keys, client secrets, API tokens, bearer tokens, and PATs are not exposed during onboarding or sync.

As a tenant administrator, I want cloud sync evidence, signals, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my cloud connectors.

## Identity Connector API Acceptance

Requirement labels: `PRD-IdentityConnector-Acceptance`, `PRD-MicrosoftEntra-IdentityConnector`, `PRD-Okta-IdentityConnector`, `PRD-GoogleWorkspace-IdentityConnector`, `PRD-Duo-IdentityConnector`, `PRD-OneLogin-IdentityConnector`, `PRD-PingOne-IdentityConnector`, `PRD-Auth0-IdentityConnector`, `PRD-JumpCloud-IdentityConnector`, `PRD-CyberArk-IdentityConnector`, `PRD-ActiveDirectory-IdentityConnector`, `PRD-MarketLeaderIdentity-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect identity, MFA, PAM, IGA, MDM, and machine-identity systems through public API routes, so that identity posture and access context can feed validation without depending on the bundled UI.

As a security reviewer, I want identity connector credentials redacted from responses and encrypted at rest, so that connector onboarding does not leak tokens, API keys, access keys, private keys, or passwords.

As a tenant administrator, I want identity sync evidence, signals, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my identity connectors.

## VM/EAP/ASM/CNAPP Connector API Acceptance

Requirement labels: `PRD-ExposureConnector-Acceptance`, `PRD-TenableVM-Connector`, `PRD-Rapid7InsightVM-Connector`, `PRD-WizCNAPP-Connector`, `PRD-PrismaCloudCNAPP-Connector`, `PRD-LaceworkFortiCNAPP-Connector`, `PRD-OrcaSecurityCNAPP-Connector`, `PRD-QualysVMDR-Connector`, `PRD-RunZero-Connector`, `PRD-AssetnoteASM-Connector`, `PRD-AxoniusCAASM-Connector`, `PRD-Armis-Connector`, `PRD-CortexXpanse-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect VM, EAP, ASM, CNAPP, and CAASM sources through public API routes, so that exposure and asset context can feed validation without depending on the bundled UI.

As a security reviewer, I want vulnerability-management and attack-surface connector credentials redacted from responses and encrypted at rest, so that connector onboarding does not leak customer credentials.

As a tenant administrator, I want exposure-source sync evidence, signals, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my exposure-management connectors.

## Code/DevSecOps Connector API Acceptance

Requirement labels: `PRD-CodeDevSecOps-ConnectorAcceptance`, `PRD-GitLab-Connector`, `PRD-Bitbucket-Connector`, `PRD-AzureDevOps-Connector`, `PRD-Buildkite-Connector`, `PRD-CircleCI-Connector`, `PRD-Jenkins-Connector`, `PRD-DockerHub-Connector`, `PRD-GitHubContainerRegistry-Connector`, `PRD-AWSECR-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect code hosts, CI/CD systems, and container registries through public API routes, so that repository, delivery, and image context can feed validation without depending on the bundled UI.

As a security reviewer, I want Code/DevSecOps connector tokens and cloud credentials redacted from responses and encrypted at rest, so that connector onboarding does not leak customer credentials.

As a tenant administrator, I want Code/DevSecOps sync evidence, signals, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my code and registry connectors.

## AI Provider Connector API Acceptance

Requirement labels: `PRD-AIProvider-ConnectorAcceptance`, `PRD-OpenAI-Connector`, `PRD-Anthropic-Connector`, `PRD-AzureOpenAI-Connector`, `PRD-AzureAISearch-Connector`, `PRD-Chroma-Connector`, `PRD-AWSBedrock-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect AI providers, model deployment inventories, and vector/search stores through public API routes, so that AI app validation context can be collected without depending on the bundled UI.

As a security reviewer, I want AI provider and vector-store credentials redacted from responses and encrypted at rest, so that connector onboarding does not leak provider credentials.

As a tenant administrator, I want AI provider sync evidence, signal context, Trust & Safety visibility, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my AI provider connectors.

## AI Stack Connector API Acceptance

Requirement labels: `PRD-AIStack-ConnectorAcceptance`, `PRD-VertexAI-Connector`, `PRD-Pinecone-Connector`, `PRD-Weaviate-Connector`, `PRD-LangChain-Connector`, `PRD-LlamaIndex-Connector`, `PRD-GuardrailsAI-Connector`, `PRD-LakeraGuard-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect AI-stack providers and AI framework metadata through public API routes, so that AI app validation context can be collected without depending on the bundled UI.

As a security reviewer, I want AI-stack API tokens redacted from responses and encrypted at rest, so that connector onboarding does not leak provider credentials.

As a tenant administrator, I want AI-stack sync evidence, signal context, and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my AI-stack connectors.

## Workflow Destination API Acceptance

Requirement labels: `PRD-Jira-WorkflowAcceptance`, `PRD-MicrosoftTeams-WorkflowAcceptance`, `PRD-Slack-WorkflowAcceptance`, `PRD-Opsgenie-WorkflowAcceptance`, `PRD-PagerDuty-WorkflowAcceptance`, `PRD-Linear-WorkflowAcceptance`, `PRD-GitHubIssues-WorkflowAcceptance`, `PRD-ServiceNow-WorkflowAcceptance`, `PRD-Remediation API`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect Jira Cloud and create remediation tickets through public API routes, so that the proof loop can hand off work to engineering or IT without depending on the bundled UI.

As a security reviewer, I want Jira API tokens redacted from responses and encrypted at rest, so that workflow onboarding does not leak issue-tracker credentials.

As a tenant administrator, I want Jira ticket delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As a security engineer, I want to connect Microsoft Teams and send remediation workflow notifications through public API routes, so that teams can receive evidence-backed validation updates in an authorized channel without depending on the bundled UI.

As a security reviewer, I want Microsoft Teams webhook URLs redacted from responses and encrypted at rest, so that workflow onboarding does not leak notification credentials.

As a security reviewer, I want live Microsoft Teams webhook sync to report only readiness until an actual workflow delivery occurs, so that Periscan does not present fixture notifications as customer evidence.

As a tenant administrator, I want Microsoft Teams delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As a security engineer, I want to connect Slack and send remediation workflow notifications through public API routes, so that teams can receive evidence-backed validation updates in an authorized channel without depending on the bundled UI.

As a security reviewer, I want Slack webhook URLs redacted from responses and encrypted at rest, so that workflow onboarding does not leak notification credentials.

As a security reviewer, I want live Slack webhook sync to report only readiness until an actual workflow delivery occurs, so that Periscan does not present fixture notifications as customer evidence.

As a tenant administrator, I want Slack delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As an incident response owner, I want to connect Opsgenie and route remediation alerts through public API routes, so that urgent validated risks can enter the escalation workflow without depending on the bundled UI.

As a security reviewer, I want Opsgenie API keys redacted from responses and encrypted at rest, so that workflow onboarding does not leak escalation credentials.

As a tenant administrator, I want Opsgenie delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As an incident response owner, I want to connect PagerDuty and route remediation incidents through public API routes, so that urgent validated risks can enter the on-call workflow without depending on the bundled UI.

As a security reviewer, I want PagerDuty routing keys redacted from responses and encrypted at rest, so that workflow onboarding does not leak escalation credentials.

As a tenant administrator, I want PagerDuty delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As a remediation owner, I want to connect Linear and create remediation issues through public API routes, so that product and engineering teams can receive evidence-backed security work in their normal issue queue.

As a security reviewer, I want Linear API keys redacted from responses and encrypted at rest, so that workflow onboarding does not leak issue-tracker credentials.

As a tenant administrator, I want Linear delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As a security engineer, I want to connect GitHub Issues and create remediation issues through public API routes, so that repository-native work tracking can participate in the proof loop without depending on the bundled UI.

As a security reviewer, I want GitHub Issues tokens redacted from responses and encrypted at rest, so that workflow onboarding does not leak repository-scoped credentials.

As a tenant administrator, I want GitHub Issues delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

As a security engineer, I want to connect ServiceNow and create remediation tickets through public API routes, so that the proof loop can hand off work to ITSM without depending on the bundled UI.

As a security reviewer, I want ServiceNow credentials redacted from responses and encrypted at rest, so that workflow onboarding does not leak customer secrets.

As a tenant administrator, I want ServiceNow ticket delivery, sync evidence, and audit events to be tenant-scoped, so that one tenant cannot read or operate another tenant's remediation workflow.

## Threat Intelligence Connector API Acceptance

Requirement labels: `PRD-ThreatIntel-ConnectorAcceptance`, `PRD-AlienVaultOTX-Connector`, `PRD-RecordedFuture-Connector`, `PRD-MandiantAdvantage-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to connect AlienVault OTX, Recorded Future, and Mandiant Advantage through public API routes, so that enrichment signals can support validation context without depending on the bundled UI.

As a security reviewer, I want threat-intelligence API keys and secrets redacted from responses and encrypted at rest, so that connector onboarding does not leak provider credentials.

As a tenant administrator, I want threat-intelligence sync evidence and audit events to be tenant-scoped, so that another tenant cannot inspect or operate my enrichment connectors.

## MSSP/RMM Connector API Acceptance

Requirement labels: `PRD-ConnectWiseManage-AcceptanceCoverage`, `PRD-Syncro-AcceptanceCoverage`, `PRD-Autotask-AcceptanceCoverage`, `PRD-HaloPSA-AcceptanceCoverage`, `PRD-NinjaOne-AcceptanceCoverage`, `PRD-NCentral-AcceptanceCoverage`, `PRD-DattoRMM-AcceptanceCoverage`, `PRD-KaseyaVSA-AcceptanceCoverage`, `PRD-ConnectWiseAutomate-AcceptanceCoverage`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a tenant administrator, I want to create and sync Beta MSSP/RMM connectors through public API routes, so that customer automation can onboard integrations without depending on the bundled UI.

As a security engineer, I want ConnectWise Manage, Syncro, Autotask, HaloPSA, NinjaOne, N-able N-central, Datto RMM, Kaseya VSA, and ConnectWise Automate syncs to persist assets, normalized signals, evidence artifacts, and audit events, so that MSSP/PSA/RMM telemetry is usable as validation context and proof inputs.

As a security reviewer, I want connector secrets redacted from API responses and encrypted at rest, so that integration onboarding does not leak customer credentials.

As a tenant administrator, I want integration reads and syncs to be tenant-isolated, so that another tenant cannot inspect or operate my connectors.

## Readiness Health

Requirement labels: `PRD-ReadinessRouteCoverage`, `PRD-Production-Readiness`, `PRD-API-First`, `PRD-Operational-Hardening`, `PRD-Observability`.

As an operator, I want the readiness endpoint to report database, queue, evidence-store, and continuous-validation sweep health, so that deployment automation can distinguish a healthy API process from missing validation dependencies.

As a release reviewer, I want the readiness route to expose skipped or degraded checks explicitly, so that production readiness gaps are visible without falsely marking the process down for non-blocking background issues.

## Deployment Readiness Status

Requirement labels: `PRD-DeploymentStatusRouteCoverage`, `PRD-Production-Readiness`, `PRD-API-First`, `PRD-Security-Hardening`, `PRD-Operational-Hardening`.

As a tenant administrator, I want to read deployment readiness through the API, so that production configuration gaps are visible before onboarding customers.

As a security reviewer, I want deployment status to redact secret values while still showing whether required secrets are configured, so that readiness can be audited without exposing sensitive material.

As a viewer, I should not be able to inspect deployment readiness details, so that operational configuration remains admin-only.

## Due Fix Re-Verification

Requirement labels: `PRD-DueReverificationRouteCoverage`, `PRD-Fix-Verification`, `PRD-Continuous-Validation`, `PRD-API-First`, `PRD-Evidence-Auditable`.

As a security engineer, I want an API route to re-verify due fixed or mitigated remediations, so that stale fixes are checked again without depending on the UI.

As a security reviewer, I want due re-verification to create a fresh verification event through the same fix-verification path, so that Periscan never trusts a historical fixed state without current proof.

As a tenant administrator, I want due re-verification to be tenant-scoped and RBAC-gated, so that another tenant cannot trigger or inspect my remediation proof loop.

## Continuous Threat Feed Ingestion

Requirement labels: `PRD-ThreatFeedScheduleRouteCoverage`, `PRD-ThreatCenter`, `PRD-API-First`, `PRD-Signal-Fabric`, `PRD-Evidence-Auditable`.

As a security engineer, I want to ingest a supported public threat feed through the API, so that new advisory context creates evidence-backed Threat Center records without depending on the bundled UI.

As a security engineer, I want repeated feed ingestion to skip already-imported advisory entries, so that recurring ingestion remains idempotent and does not duplicate readiness reports.

As a tenant administrator, I want to set and read a recurring threat-feed ingestion schedule through the API, so that continuous threat context can be managed by automation.

As a security reviewer, I want scheduled threat-feed ingestion to advance due schedules and remain tenant-scoped, so that another tenant cannot see or inherit feed configuration.

## Mission And Job API Visibility

Requirement labels: `PRD-MissionJobRouteCoverage`, `PRD-API-First`, `PRD-Job-Scheduler`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As an API customer, I want mission start to create visible queue jobs and validation runs, so that automation can track validation progress without depending on the bundled UI.

As a security engineer, I want to read a specific validation run and queue job by ID, so that every queued validation action remains traceable to tenant, mission, run, and job payload data.

As a security reviewer, I want run and job detail routes to be tenant-isolated, so that another tenant cannot inspect validation queue activity.

## Account Security

Requirement labels: `PRD-AccountSecurityRouteCoverage`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a user, I want to reset my password through a single-use token, so that I can regain access without exposing whether an account exists.

As an invited user, I want to accept a tenant invite through an API token and set my password, so that onboarding works without depending on the bundled UI.

As a user, I want to verify my email and enable MFA with recovery codes, so that my account has auditable second-factor protection.

As a user, I want recovery-code regeneration and MFA disable to require re-authentication, so that a stolen session cannot silently weaken my account.

## Governed Autonomous Engagements

Requirement labels: `PRD-EngagementRouteCoverage`, `PRD-API-First`, `PRD-Safety-Policy`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a security engineer, I want to run a governed engagement over a verified scope through the API, so that multi-step validation can be orchestrated without coupling to the bundled UI.

As a security engineer, I want PlanOnly engagements to return a non-executing preview, so that I can review planned validation without touching customer scope.

As a security engineer, I want Execute engagements to create evidence-backed step results through allowed modules only, so that engagement output remains grounded in validation evidence.

As a security reviewer, I want engagement read/list routes to be tenant-scoped and audited, so that another tenant or a viewer cannot inspect or mutate engagement history.

## Outbound Webhooks

Requirement labels: `PRD-WebhookRouteCoverage`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a tenant administrator, I want to create an outbound webhook and receive its signing secret only once, so that customer automation can receive Periscan events without later API reads exposing the secret.

As a tenant administrator, I want to list, update, delete, and test tenant webhooks through the API, so that webhook operations do not depend on the bundled UI.

As a tenant administrator, I want to inspect recent webhook deliveries and dead-lettered deliveries, so that failed customer automation can be diagnosed from API data.

As a security reviewer, I want webhook lifecycle and delivery routes to be admin-only and tenant-scoped, so that another tenant or a viewer cannot inspect or mutate delivery automation.

## API Key Access

Requirement labels: `PRD-ApiKeyRouteCoverage`, `PRD-ApiKeyAuthRouteCoverage`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

As a tenant administrator, I want to create an API key and receive the secret only once, so that automation can access Periscan without exposing long-lived credentials in later reads.

As a tenant administrator, I want to list, rotate, and revoke API keys through tenant-scoped API routes, so that customer-owned automation access can be governed without UI coupling.

As a security reviewer, I want API key lifecycle actions to be auditable and isolated by tenant, so that customers can prove who created, rotated, or revoked API access.

As an API customer, I want an active API key to authenticate documented API routes with scope-derived permissions, so that automation can use Periscan without a browser session.

As a tenant administrator, I want rotated and revoked API key secrets to stop authenticating immediately, so that compromised or retired automation credentials cannot continue accessing the API.

## Policy Approval Governance

Requirement labels: `PRD-PolicyApprovalRouteCoverage`, `PRD-Safety-Policy`, `PRD-API-First`, `PRD-Evidence-Auditable`, `PRD-Tenant-Isolation`.

As a tenant administrator, I want to list policy decisions awaiting approval, so that sensitive validation requests cannot execute until an authorized human approves them.

As a tenant administrator, I want to approve or deny a policy decision through the API, so that policy-gated missions have an auditable authorization state before execution.

As a security reviewer, I want policy approval actions to be tenant-scoped and audited, so that another tenant cannot mutate my validation approvals and every approval decision is reviewable.

## Internal Runner

Requirement labels: `PRD-Runner-OutboundOnly`, `PRD-Runner-SignedTasks`, `PRD-Runner-ScopeEnforcement`, `PRD-Safety-VerifiedScope`, `PRD-Evidence-Auditable`, `PRD-API-First`.

As a tenant administrator, I want to issue a short-lived runner registration token, so that an internal runner can register without exposing a standing credential.

As an internal runner, I want to register over the API and receive control-channel settings, credentials, and task-signing material, so that I can poll Periscan Cloud outbound-only through firewalls.

As an internal runner, I want to rotate my task-signing key material and credential-expiry metadata without re-registering or receiving a new standing bearer token, so that customer deployments can maintain secure long-lived outbound operation.

As a customer platform administrator, I want a non-root Docker runner package and compose example, so that I can deploy the outbound-only runner through standard container operations without opening inbound firewall ports.

As a customer platform administrator, I want Kubernetes and systemd runner deployment examples with a release validation gate, so that I can install the outbound-only runner in common customer environments without relying on reverse SSH or undocumented firewall exceptions.

As a security architect, I want an API endpoint that exposes allowed runner transport decisions and rationale, so that customer network design can be validated before installing any internal agent.

As a tenant administrator, I want to create a safe internal reachability task against verified scope, so that Periscan can validate internal exposure without scanning unauthorized targets.

As an internal runner, I want to upload larger task evidence through a scoped artifact URL before submitting the final result, so that Periscan stores runner evidence in the same redacted, hashed, tenant-scoped evidence store as other validation artifacts.

As an internal runner, I want to poll for signed task envelopes, so that I only execute tasks issued by Periscan Cloud for my tenant and runner identity.

As an internal runner, I want to submit execution results and evidence manifests, so that Periscan can update validation state and evidence records.

As a security reviewer, I want rejected or mismatched runner operations audited, so that unsafe or malformed runner activity is visible.

## First-Customer Hardening

Requirement labels: `PRD-Core-ProofLoop`, `PRD-E2E-Test-Harness`, `PRD-API-First`, `PRD-API-Reference`, `PRD-Safety-VerifiedScope`, `PRD-Safety-ExternalValidation`, `PRD-Tenant-Isolation`, `PRD-CI-ReleaseGates`.

As a self-service security user, I want to sign up, verify scope, connect authorized systems (fixture-backed only in explicit test/lab mode), run a Validation Snapshot, create remediation, verify the fix, and export evidence through the API, so that Periscan can prove the end-to-end product loop before the UI is replaced or extended.

As a tenant administrator, I want domain and subdomain scope verification to use a tenant-specific DNS TXT token by default, so that Periscan proves authorized ownership before any external validation can run.

As a web user creating a domain scope, I want the Workspace to show the exact `_periscan.<domain>` TXT record and verify it through the API without a dev-mode bypass, so that the bundled UI follows the same safety boundary as replacement API clients.

As a tenant administrator, I want validation to be denied before scope verification, so that Periscan cannot test unauthorized targets.

As a security reviewer, I want external validation against reserved or private targets denied, so that Periscan cannot be used for unsafe third-party or internal scanning from the external point of attack.

As a customer, I want evidence access isolated by tenant, so that another tenant cannot read my validation artifacts.

As a security engineer, I want fix verification to expose the selected targeted retest family and module IDs, so that I can see which evidence path Periscan used before accepting a remediation as fixed.

As a release owner, I want CI to run lint, typecheck, unit tests, build, migration deploy, OSS runtime checks, and acceptance tests, so that regressions are caught before customer delivery.

As a release owner, I want a Playwright E2E proof-loop test over real HTTP API calls, so that signup, scope verification, integrations, Snapshot, remediation, fix verification, and evidence report export are validated as a deployed customer workflow.

As an API customer, I want to list allowlisted external validation profiles, so that I know which Nuclei template sets can be safely requested before creating a mission.

As a security reviewer, I want narrowed safe external profiles for fingerprinting, header review, and public metadata, so that Periscan can expand validation coverage without enabling arbitrary template execution.

As an API customer, I want a machine-readable API reference with endpoint groups and auth modes, so that I can automate Periscan without reverse-engineering the current web UI.

## Operational Hardening

Requirement labels: `PRD-Operational-Hardening`, `PRD-Security-Boundary-Tests`, `PRD-Production-Readiness`, `PRD-CI-ReleaseGates`.

As a release owner, I want a dedicated security-boundary regression suite, so that customer-readiness checks continuously prove Periscan cannot validate unverified scope, queue denied policy decisions, leak tenant evidence, expose raw secrets, accept unsigned runner tasks, or bypass external-validation limits.

As a security reviewer, I want a production readiness checklist tied to the PRD safety model, so that auth, tenant isolation, evidence protection, runner security, OSS tooling, auditability, backups, and release gates are explicit before customer onboarding.

As a customer security reviewer, I want production backup, retention, logging, alerting, and incident-contact readiness exposed through the Trust & Safety API, so that I can distinguish configured controls from deployment-managed controls before onboarding.

As a release owner, I want onboarding and recovery emails to use a public HTTPS product base URL in production, so that invite, verification, and password-reset links never point customers at localhost or an insecure endpoint.

## Evidence Packs and Exports

Requirement labels: `PRD-Evidence-Packs`, `PRD-Reports-HTML-PDF`, `PRD-Evidence-Pack-Templates`, `PRD-No-Raw-Findings`, `PRD-API-First`.

As a security user, I want to export evidence packs as HTML or PDF through the API, so that I can share proof with customers, auditors, insurers, and executives without depending on the current UI.

As a security user, I want the Snapshot report page to export HTML/PDF and create share links through the report API, so that report delivery remains API-backed even when I use the bundled web app.

As a report reviewer, I want a failed report export or share action to keep the loaded report visible and offer a safe preview reload, so that I can recover from a transient delivery error without replaying the export/share mutation.

As a security administrator, I want public report share-link creation to write an audit event without storing the bearer token, so that report delivery is reviewable without leaking the share secret.

As a release owner, I want public report-share tokens signed with a dedicated production secret, so that rotating session tokens does not implicitly rotate public report links and public-link signing does not reuse authentication secret material.

As a report consumer, I want exported reports generated from normalized evidence with evidence IDs and no raw scanner dump as the primary content, so that the report is proof-oriented and safe to distribute.

As a prospect or design partner, I want to view a public sample Validation Snapshot before connecting systems, so that I can understand Periscan's proof loop without exposing real customer data.

As an auditor, insurer, customer reviewer, executive, MSSP operator, or security engineer, I want report templates tailored to my audience, so that Periscan can present the same normalized evidence with the right redaction posture and sections for my review workflow.

As a remediation owner, I want a closure pack to keep unverified items visible, so that risk is not marked closed without supporting verification evidence.

## Design Partner Delivery

Requirement labels: `PRD-DesignPartner-Mode`, `PRD-Analyst-Notes`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a design-partner operator, I want a guided onboarding and integration checklist, so that I can move a new tenant from setup to Snapshot delivery without relying on undocumented steps.

As a tenant administrator, I want to toggle design-partner mode through the API, so that the feature can be enabled per tenant without coupling it to the current UI.

As a founder or operator, I want to attach a clearly labeled Periscan analyst note to a report, so that customer-facing delivery can include manual context without changing validated evidence.

As a report reviewer, I want to preview the latest Snapshot report with the analyst note applied before sharing it externally, so that the first-customer delivery flow remains controlled and auditable.

## Trust And Safety

Requirement labels: `PRD-Trust-Safety-Page`, `PRD-Audit-Log-Completeness`, `PRD-API-First`, `PRD-Production-Readiness`.

As a tenant administrator, I want a tenant-scoped Trust & Safety view backed by the API, so that I can review connected systems, permissions, data collection, evidence retention posture, runner controls, and validation safety without relying on internal notes.

As a tenant administrator, I want to disconnect an integration from the Trust & Safety workflow, so that access can be revoked from the same operational surface that explains what Periscan reads.

As a tenant administrator, I want to sync or refresh the health of a connected integration from the Trust & Safety workflow, so that health and last-sync evidence refresh through the API without relying on a hidden background action.

As a returning user, I want Workspace and Threat Center to show a loading state while my API session is restored, so that I do not see an incorrect unauthenticated form before my tenant data loads.

As a report reviewer, I want Snapshot report previews to show API-backed loading, retryable error, and empty states, so that missing auth, missing report content, or transient API failures do not leave me at a dead end.

As an MSSP operator, I want the client portfolio page to distinguish loading, signed-out, API-error, empty, and loaded states, so that portfolio readiness is never confused with missing data or UI failure.

As a keyboard or assistive-technology user, I want a skip-to-content link and live state announcements, so that I can navigate API-driven status changes without relying on visual color alone.

As a security operator, I want one consistent primary app navigation shell across Periscan routes, so that Workspace, Integrations, Threat Center, MSSP, Trust & Safety, and Demo surfaces do not feel like siloed or dead-end screens.

As an API customer, I want web navigation to be a thin route-level consumer of stable product surfaces, so that Periscan can swap or extend UI clients without changing the API-driven product model.

As a security reviewer, I want to filter audit history by event type, date, and user, so that I can quickly confirm who changed scope, integrations, reports, or validation workflows.

## API Safety Edge Cases

Requirement labels: `PRD-Policy-Binding`, `PRD-Evidence-Auditable`, `PRD-API-First`, `PRD-Production-Readiness`.

As an API customer, I want policy-decision binding failures to return stable error codes, so that my client can distinguish scope, mission type, and safety-level mismatch from ordinary validation failure.

As a security reviewer, I want policy-decision binding failures to emit audit events, so that denied mission creation or start attempts remain explainable and reviewable.

As a validation operator, I want a mission start without an explicit target to persist the approved policy-decision target into validation runs, so that every queued run remains evidence-backed and scope-auditable.

As a returning user, I want malformed or expired session cookies to be treated as unauthenticated and logout-clearable, so that stale browser state cannot cause server errors or trap me in a broken session.

## Integration Marketplace

Requirement labels: `PRD-Integration-Marketplace`, `PRD-Signal-Fabric`, `PRD-API-First`.

As a tenant administrator, I want to view implemented and planned integrations through the API catalog, so that I understand Periscan coverage before connecting systems.

As a tenant administrator, I want marketplace connections to sync immediately through the API after setup and expose manual sync/health refresh controls once connected, so that the connected list reflects usable system data instead of stale `Unknown` health.

As a security reviewer, I want each connector entry to explain what Periscan reads, writes, and requires, so that integration permissions are transparent.

As a tenant administrator, I want planned integrations to be visible but not connectable, so that the product does not imply unavailable backend functionality.

As a UI consumer, I want marketplace search and category/status filters backed by connector manifests, so that the web app can be replaced without losing catalog semantics.

As a tenant administrator, I want marketplace filters to show a clear empty state, so that I can tell the filter matched nothing instead of assuming the catalog failed to load.

As a security engineer, I want GitHub PAT-backed repository metadata sync through the same connector API as mock mode, so that authorized repositories can produce assets and branch-protection/permission signals without storing repository contents.

As a security engineer, I want GitLab PAT-backed project metadata sync through the same connector API as mock mode, so that authorized projects can produce repository assets and branch-protection/permission signals without storing repository contents.

As an identity security engineer, I want to connect Okta with a read-only API token, so that Periscan can import authorized user, group, MFA posture, and SaaS application context for identity attack-path analysis without changing Okta configuration.

As an identity security engineer, I want to connect Cisco Duo with a read-only Admin API integration, so that Periscan can import authorized users, groups, MFA device posture, and protected application context without changing Duo policies, users, or authentication behavior.

As an identity security engineer, I want to connect OneLogin with read-only OAuth API credentials, so that Periscan can import authorized users, roles, MFA posture indicators, and SaaS application context without changing OneLogin users, roles, apps, or policies.

As an identity security engineer, I want to connect PingOne with a read-only Worker application, so that Periscan can import authorized users, groups, MFA posture indicators, and application context without changing PingOne users, groups, apps, passwords, MFA devices, or policies.

As an identity security engineer, I want to connect Auth0 with read-only Management API machine-to-machine credentials, so that Periscan can import authorized users, roles, MFA posture indicators, and application context without changing Auth0 users, roles, clients, passwords, role assignments, or tenant settings.

As an identity security engineer, I want to connect JumpCloud with a read-only Admin API key, so that Periscan can import authorized users, user groups, MFA posture indicators, and SSO application context without changing JumpCloud users, groups, commands, applications, passwords, MFA state, or memberships.

As an identity security engineer, I want to connect CyberArk Identity through read-only SCIM access, so that Periscan can import authorized users, groups, and MFA posture indicators without retrieving passwords, checking out privileged accounts, changing safes, mutating users/groups, or altering MFA state.

As an identity security engineer, I want to connect Active Directory with a read-only LDAP/LDAPS bind account, so that Periscan can import authorized users, groups, computers, and service-account indicators without reading passwords, hashes, Kerberos tickets, changing memberships, resetting accounts, or running attack tooling.

As an identity security engineer, I want to connect Microsoft Entra ID with read-only Microsoft Graph app credentials, so that Periscan can import authorized users, groups, roles, and application registration context for identity attack-path analysis without changing Entra configuration.

As an identity security engineer, I want to connect Google Workspace with read-only Admin Directory credentials, so that Periscan can import authorized users, groups, admin posture, and MFA enrollment context without reading Gmail/Drive content or changing Google Workspace configuration.

As a cloud security administrator, I want to connect AWS through a customer-created read-only AssumeRole workflow, so that Periscan can inventory authorized AWS resources without long-lived customer account keys in the primary integration path.

As a cloud security administrator, I want to connect Azure through a least-privilege service principal, so that Periscan can inventory authorized subscriptions, resources, and network exposure without changing Azure configuration.

As a cloud security administrator, I want to connect Google Cloud through a read-only access-token path, so that Periscan can inventory authorized projects, resources, firewall posture, and public exposure without changing Google Cloud configuration.

As a platform security engineer, I want to connect Kubernetes with a read-only service-account token, so that Periscan can inventory authorized namespaces, workloads, services, deployments, and network-policy coverage without reading Secrets, logs, exec sessions, port-forwarding, proxying, or changing cluster state.

As a cloud security administrator, I want to connect DigitalOcean with a read-only API token, so that Periscan can inventory authorized accounts, Droplets, firewalls, and managed Kubernetes clusters without creating resources, retrieving kubeconfigs, or exposing raw IP addresses.

As an application platform owner, I want to connect Heroku with a read-only Platform API token, so that Periscan can inventory authorized apps, formation posture, and domain exposure without reading config vars, logs, builds, releases, dyno command output, or mutating apps.

As a data platform owner, I want to connect Databricks with a read-only workspace token, so that Periscan can inventory authorized clusters, jobs, SQL warehouses, and workspace object metadata without exporting notebooks, reading DBFS/secrets, running commands, starting jobs, or mutating compute.

As a data platform security engineer, I want to connect Snowflake through read-only SQL API metadata access, so that Periscan can inventory authorized account, warehouse, database, schema, user, MFA posture, and role-grant context without executing arbitrary SQL, reading table data, or changing Snowflake objects.

As an API customer, I want Snowflake metadata normalized into assets and SignalEnvelope records, so that validation snapshots and attack-path workflows can consume data-platform posture through public APIs without raw query dumps.

As a tenant administrator, I want integration config values that look like tokens or secrets redacted from API responses, so that connected systems can be managed without exposing credentials to UI or API consumers.

As a tenant administrator, I want to connect Slack with an incoming webhook, so that Periscan can route approved workflow notifications to an authorized channel without exposing the webhook URL.

As a tenant administrator, I want to connect Microsoft Teams with an incoming webhook, so that Periscan can route approved workflow notifications to an authorized channel without exposing the webhook URL.

As a remediation owner, I want to connect Jira Cloud with an API token, so that Periscan can create policy-gated workflow issues in an authorized project without exposing Jira credentials through the API.

As a remediation owner, I want to connect GitHub Issues with a repository-scoped token, so that Periscan can create policy-gated remediation issues in an authorized repository without exposing GitHub credentials through the API.

As a remediation owner, I want to connect Linear with an API key, so that Periscan can create policy-gated remediation issues in an authorized team without exposing Linear credentials through the API.

As a remediation owner, I want to connect PagerDuty with an Events API routing key, so that Periscan can route policy-gated validation and remediation escalations into an authorized service without exposing PagerDuty credentials through the API.

As a remediation owner, I want to connect Opsgenie with an API key, so that Periscan can route policy-gated validation and remediation alerts into an authorized Opsgenie account without exposing Opsgenie credentials through the API.

As a remediation owner, I want to connect ServiceNow with least-privilege Table API credentials, so that Periscan can create policy-gated workflow records in an authorized ServiceNow table without exposing ServiceNow credentials through the API.

As an MSSP service delivery manager, I want to connect ConnectWise Manage with least-privilege API keys, so that Periscan can import authorized client/ticket context and create policy-gated remediation workflow tickets without mutating PSA configuration, agreements, invoices, projects, companies, devices, or RMM agents.

As an MSSP endpoint operations lead, I want to connect ConnectWise Automate with read-only REST API credentials, so that Periscan can import authorized client, managed-computer, offline-state, and alert context without running scripts, agent procedures, commands, patch jobs, remote-control sessions, file/log retrieval, ticket mutation, client/computer changes, or system configuration writes.

As an API customer integrating ConnectWise Automate, I want the public integration APIs to prove credential redaction, encrypted storage, persisted sync results, Trust & Safety visibility, and tenant isolation, so that I can trust the connector contract without relying on UI-only behavior.

As an MSSP endpoint operations lead, I want to connect NinjaOne with read-only Public API access, so that Periscan can import authorized organization, device, offline-state, and alert context without running scripts, actions, automations, patch operations, remote sessions, ticket mutations, or policy changes.

As an MSSP service coordinator, I want to connect HaloPSA with OAuth client credentials, so that Periscan can import authorized client/ticket context and create policy-gated remediation tickets without mutating PSA clients, sites, users, assets, billing, projects, configuration, or ticket state outside explicit ticket creation.

As an MSSP service desk lead, I want to connect Autotask PSA with API-user credentials, so that Periscan can import authorized company/ticket context and create policy-gated remediation tickets without mutating companies, contacts, contracts, configuration items, projects, time entries, billing, users, or existing ticket state.

As an MSSP operations lead, I want to connect Syncro with an API token, so that Periscan can import authorized customer, RMM asset, offline-state, and ticket context and create policy-gated remediation tickets without mutating customers, assets, policies, scripts, invoices, payments, products, timers, line items, attachments, or existing ticket state.

As an MSSP operations lead, I want to connect N-able N-central with an API token, so that Periscan can import authorized customer, device, offline-state, and active-service-issue context without running scheduled tasks, scripts, patching, reboot, remote-control, credential, user, rule, probe, or agent mutation actions.

As a detection engineer, I want to connect Splunk with a read-only API token, so that Periscan can query authorized logging evidence for control validation without exposing Splunk credentials or raw log plumbing.

As a detection engineer, I want to connect Elastic Security with a read-only API key, so that Periscan can query authorized alert evidence for control validation without exposing Elastic credentials or raw SIEM plumbing.

As a detection engineer, I want to connect Datadog Cloud SIEM with read-only API/application keys, so that Periscan can query authorized security-signal evidence for control validation without exposing Datadog credentials or raw SIEM plumbing.

As a detection engineer, I want to connect Google Security Operations with a read-only OAuth token, so that Periscan can query authorized UDM event evidence for control validation without exposing Google credentials or raw Chronicle plumbing.

As a detection engineer, I want to connect Sumo Logic with Access ID/Access Key credentials, so that Periscan can query authorized Search Job evidence for control validation without exposing Sumo credentials or raw SIEM plumbing.

As a detection engineer, I want to connect Rapid7 InsightIDR with a read-only API key, so that Periscan can query authorized Log Search evidence for control validation without exposing Rapid7 credentials or raw SIEM plumbing.

As a detection engineer, I want to connect IBM QRadar with a read-only SEC token, so that Periscan can query authorized Ariel AQL evidence for control validation without exposing QRadar credentials or raw SIEM plumbing.

As a detection engineer, I want to connect Microsoft Sentinel with least-privilege Log Analytics query credentials, so that Periscan can query authorized alert and log evidence without exposing Azure credentials or raw SIEM plumbing.

As an endpoint security engineer, I want to connect Microsoft Defender XDR with least-privilege Advanced Hunting credentials, so that Periscan can classify detection evidence without triggering response actions from the cloud control plane.

As an endpoint security engineer, I want to connect SentinelOne Singularity with a read-only API token, so that Periscan can classify endpoint threat evidence without triggering mitigation, quarantine, policy, or remote-script actions from the cloud control plane.

As an endpoint security engineer, I want to connect VMware Carbon Black Cloud with read-only Alerts v7 credentials, so that Periscan can classify endpoint alert evidence without changing alert workflow, notes, policies, devices, or live response state.

As an endpoint security engineer, I want to connect Sophos Intercept X with read-only Sophos Central service-principal credentials, so that Periscan can classify endpoint alert evidence without acknowledging alerts, isolating devices, running scans, cleaning threats, changing endpoint policy, or triggering remediation from the cloud control plane.

As an endpoint security engineer, I want to connect Trend Vision One with a read-only API token, so that Periscan can classify Workbench alert evidence without modifying alert status, assigning owners, adding notes, executing playbooks, isolating endpoints, updating detection models, or triggering remediation from the cloud control plane.

As an endpoint security engineer, I want to connect Palo Alto Networks Cortex XDR with a read-only standard API key, so that Periscan can classify incident evidence without updating incidents, isolating endpoints, running scripts, managing blocklists, changing policies, or triggering remediation from the cloud control plane.

As an endpoint security engineer, I want to connect CrowdStrike Falcon with read-only OAuth credentials, so that Periscan can classify detected or blocked control-validation evidence without running live adversarial actions from the cloud control plane.

As an edge security engineer, I want to connect Cloudflare with a read-only API token, so that Periscan can import authorized zone, DNS, and WAF posture signals without exposing Cloudflare credentials or changing edge configuration.

As an edge security engineer, I want to connect Fastly Next-Gen WAF with a read-only API access token, so that Periscan can classify WAF event evidence without changing rules, lists, redactions, alerts, agent keys, simulator inputs, edge deployments, or delivery integrations.

As an edge security engineer, I want to connect Akamai Kona Site Defender with EdgeGrid credentials for SIEM security events, so that Periscan can classify WAF evidence without changing App & API Protector policies, match targets, security configurations, network lists, activations, or remediation state.

As an edge security engineer, I want to connect Imperva Cloud WAF with read-only API credentials, so that Periscan can inventory protected sites and WAF rule posture without changing sites, certificates, custom rules, DNS, DDoS, caching, or SIEM delivery configuration.

As a network security engineer, I want to connect Palo Alto Networks Panorama with a read-only PAN-OS API key, so that Periscan can classify firewall and WAF log evidence without changing policies, objects, commits, User-ID state, dynamic objects, or remediation actions.

As a network security engineer, I want to connect Fortinet FortiGate with a read-only FortiOS API token, so that Periscan can classify firewall policy monitor evidence without changing sessions, policies, objects, address fabric state, configuration, or remediation actions.

As a network security engineer, I want to connect Zscaler Internet Access with OAuth client credentials, so that Periscan can classify cloud firewall filtering policy evidence without changing rules, activating policies, exporting policies, modifying locations, PAC files, VPN credentials, or remediation actions.

As an edge security engineer, I want to connect AWS WAF with read-only AWS credentials, so that Periscan can import authorized web ACL posture and protected-resource coverage without changing AWS configuration.

As an edge security engineer, I want to connect Azure Front Door WAF with a read-only service principal, so that Periscan can import authorized WAF policy posture and protected endpoint coverage without changing Azure configuration.

As an AI platform owner, I want to connect OpenAI with a read-only API key path, so that Periscan can inventory available model context without executing prompts or collecting customer AI data through the connector.

As an AI platform owner, I want to connect Anthropic with a read-only API key path, so that Periscan can inventory available model context without executing prompts or collecting customer AI data through the connector.

As an Azure AI platform owner, I want to connect Azure OpenAI with a read-only API key path, so that Periscan can inventory authorized deployments without executing prompts or collecting customer AI data through the connector.

As a Google AI platform owner, I want to connect Vertex AI with a read-only access-token path, so that Periscan can inventory authorized endpoints and Model Garden context without invoking models or sending prompts.

As an AI application owner, I want to connect Pinecone with a read-only API-key path, so that Periscan can inventory authorized vector indexes used by RAG workflows without querying vectors or reading records.

As an AI application owner, I want to connect Weaviate with a read-only API-key path, so that Periscan can inventory authorized vector collections and RAG schema context without querying stored objects or GraphQL data.

As an AI application owner, I want to connect Azure AI Search with a read-only API-key path, so that Periscan can inventory authorized search indexes, vector fields, and semantic configuration used by RAG workflows without querying documents.

As an AI application owner, I want to connect Chroma with a read-only API-key path, so that Periscan can inventory authorized vector collections used by RAG workflows without reading records or querying embeddings.

As an AI application owner, I want to import LangChain application metadata through the API, so that Periscan can inventory chains, agents, tools, retrievers, vector stores, callbacks, and runnables without executing the app runtime.

As an AI application owner, I want to import LlamaIndex application metadata through the API, so that Periscan can inventory indexes, query engines, retrievers, agents, tools, data sources, vector stores, and workflows without executing retrieval or agent runtime behavior.

As an AI platform owner, I want to import Guardrails AI configuration metadata through the API, so that Periscan can inventory input guards, output guards, validators, on-fail policies, RAIL specs, server endpoints, and telemetry sinks without executing guardrail validation.

As an AI platform owner, I want to connect Lakera Guard with read-only project and policy metadata access, so that Periscan can inventory prompt-defense, data-leakage, malicious-link, and content-moderation guardrail coverage without screening prompts or fetching runtime guard results.

As an AWS AI platform owner, I want to connect AWS Bedrock with read-only model inventory permissions, so that Periscan can understand available foundation-model context without invoking models or sending prompts.

## Continuous Validation

Requirement labels: `PRD-Continuous-Validation`, `PRD-API-First`, `PRD-Safety-VerifiedScope`.

As a security engineer, I want to schedule recurring validation against verified scope, so that Periscan continuously detects drift and reopened risk instead of producing only one-time Snapshots.

As an API customer, I want schedule run results to include current-vs-previous diffs, so that I can automate reporting and alerting without depending on the current web UI.

As a remediation owner, I want previously fixed paths to be marked reopened when a scheduled validation sees them again, so that closed risk cannot silently return.

## Signal-Driven Triggers

Requirement labels: `PRD-SignalDriven-Triggers`, `PRD-Continuous-Validation`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

As an API customer, I want to list Periscan's supported signal triggers, so that I can understand which tenant events can recommend validation without depending on the web UI.

As a security engineer, I want CVE, asset-change, policy-change, and missed-detection triggers evaluated from current tenant scopes, integrations, signals, runners, controls, and audit events, so that recommendations reflect real readiness rather than static advice.

As a tenant administrator, I want trigger evaluation to return missing prerequisites and `NeedsApproval` statuses instead of starting jobs automatically, so that every triggered validation remains policy-gated and auditable.

As a tenant administrator, I want to approve a `NeedsApproval` signal trigger through the API, so that Periscan creates a policy decision and draft mission without starting execution.

As a tenant administrator, I want to configure signal-trigger routing to connected workflow destinations, so that approved draft missions can be escalated without bypassing validation policy gates.

As a SecOps integrator, I want an activity feed of matched trigger recommendations with evidence IDs, audit IDs, and an optional API limit, so that I can route recommended validation work into existing workflows without depending on unbounded responses.

As a security engineer, I want missing proof inputs to appear on validated findings and executive trends, so that I know which conclusions are evidence-backed and which are limited by missing scope, telemetry, integrations, or runner coverage.

As an MSSP operator, I want child portfolio coverage and readiness to include missing proof inputs, so that client QBR and escalation views do not overstate readiness when Threat Center identifies missing scope, telemetry, integrations, or runner coverage.

## Operators and Evidence-Grounded Summaries

Requirement labels: `PRD-Operators`, `PRD-Evidence-Grounded-Summaries`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

As a security operator, I want Periscan Operators to recommend safe missions with evidence IDs, uncertainty labels, required integrations, and policy requirements, so that I can decide what to validate next without the system executing automatically.

As a tenant administrator, I want to approve an operator recommendation through the API, so that Periscan creates a policy decision and draft mission that can be reviewed before execution.

As a report author, I want generated summaries to use only tenant-authorized normalized evidence and cite evidence IDs, so that executive, remediation, attack-path, and evidence-pack summaries do not invent unsupported claims.

## Periscan Operators Source Coverage

Requirement labels: `SRC-3.8-OPERATORS`, `PRD-OP-001`, `PRD-OP-002`, `PRD-OP-003`, `PRD-OP-004`, `PRD-OP-005`, `PRD-OP-006`, `PRD-OP-007`.

As a security operator, I want all six PRD-defined Periscan Operators exposed through API profiles, so that I can understand which recommendation workflow supports attack paths, controls, exposure, remediation, evidence packs, and AI app security.

As a tenant administrator, I want every operator recommendation to cite evidence IDs, show uncertainty, list safety level, and require approval before mission creation or execution, so that AI-assisted workflows cannot fabricate or silently run validation work.

As a security reviewer, I want proofless tenant configuration counts to produce no operator recommendation instead of a weak recommendation, so that operators do not invent outcomes when there is no normalized evidence to cite.

As a release reviewer, I want PRD section 3.8 parsed directly by tests and linked to requirement atoms, so that broad operator/model-gateway traceability cannot hide missing evidence, uncertainty, approval, or safety behavior again.

## Safe AI And Control Validation Catalogs

Requirement labels: `PRD-AI-Control-Safe-Catalogs`, `PRD-AI-App-Validation`, `PRD-Control-Validation`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

As an API customer, I want to list safe AI validation suites and dry-run control validation scenarios, so that I can understand supported checks, safety levels, prohibited behaviors, evidence types, and required scope before requesting validation.

As a security engineer validating an AI app, I want live-safe endpoint probing to be the API default and fixture-backed outcomes to require explicit dev/test mode, so that Periscan cannot accidentally present fabricated AI validation as customer proof.

As an AI application owner, I want live-safe endpoint probes to be labeled as inconclusive reachability evidence unless an approved harness report proves a pass or failure, so that Periscan does not overstate AI guardrail validation from a benign HTTP response.

As a blue-team operator validating controls, I want dry-run control validation to be the default and live runner execution to be rejected unless it uses an approved runner workflow, so that Periscan cannot accidentally execute Atomic-style scenarios from the cloud control plane.

As a blue-team operator, I want rule coverage summaries for each control source, so that I can see which ATT&CK-mapped scenarios are covered, blocked, logged-only, missed, stale, or not tested.

As a detection engineer, I want coverage gaps to include evidence IDs and tuning recommendations, so that I can improve SIEM/EDR rules without treating raw logs as the main product output.

## Unified Validated Findings

Requirement labels: `PRD-Delta-EPIC-1`, `PRD-Delta-EPIC-3`, `PRD-Delta-EPIC-4`, `PRD-Delta-EPIC-5`, `PRD-Delta-EPIC-9`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a security engineer, I want BAS, attack-path, and exposure validation results in one prioritized findings queue, so that I can work evidence-backed risk without switching between module dashboards.

As an API customer, I want every finding to include source motion, evidence IDs, impact, remediation, priority rationale, exploitability, lifecycle status, and cross-links, so that downstream systems can automate triage without scraping the UI.

As a remediation owner, I want findings to reflect routed and revalidated states from remediation and verification workflows, so that operational closure is visible from the same queue that introduced the risk.

## OSS Tool Productization

Requirement labels: `PRD-OSS-ProductizedModules`, `PRD-OSS-Policy-GatedExecution`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`, `PRD-No-Raw-Findings`.

As an API customer, I want OSS tool and capability readiness exposed through the API, so that I can tell which internal validation engines are executable, fixture-only, unavailable, or blocked without depending on the current UI.

As an API customer, I want to filter open-source tools and capabilities by phase and policy-status inclusion flags, so I can show only enabled/currently-shippable features to operations workflows and executive surfaces.

As a security engineer, I want safe passive OSS modules such as Trivy, OSV, and BloodHound graph import to run through normal mission APIs, so that repository, dependency, container, and identity-path evidence uses the same policy, worker, evidence, and graph pipeline as every other validation.

As a platform administrator, I want Atomic live execution, SharpHound collection, and Caldera advanced execution denied before jobs are queued, so that unavailable or unsafe OSS capabilities cannot appear to run successfully.

As a report consumer, I want OSS module output normalized into Periscan evidence and signals rather than raw tool dumps, so that reports stay proof-oriented and safe to share.

## OSS License Governance

Requirement labels: `PRD-OSS-License-Governance`, `PRD-OSS-ProductizedModules`, `PRD-CI-ReleaseGates`.

As a release owner, I want generated third-party notices and fail-closed license checks, so that Periscan can use OSS validation engines without accidentally enabling AGPL, unknown, or legal-review-required software.

As a security and legal reviewer, I want SharpHound and similar non-permissive collectors visible but blocked behind legal review, so that the product catalog is transparent without implying executable customer capability.

## Enterprise Foundation

Requirement labels: `PRD-MSSP-Multitenancy`, `PRD-WhiteLabel-Reports`, `PRD-Billing-Metering`, `PRD-API-First`.

As an MSSP owner, I want to create child client tenants through the API, so that I can manage multiple customer environments from one parent tenant.

As an MSSP operator, I want to switch tenant context with an explicit API header, so that client data access remains tenant-scoped and auditable.

As a client administrator, I want report branding to be configurable through the API, so that evidence packs can be white-labeled for customer delivery.

As a billing owner, I want usage meter definitions and current usage counts through the API, so that Periscan can support customer-facing metering before payment processing is added.

As a billing owner, I want package metadata through the API without exact prices or checkout fields, so that sales, partner, and customer systems can understand available Periscan packaging while payment processing remains unconfigured.

As an MSSP owner, I want a client portfolio API and dashboard derived from child tenant data, so that I can track validation readiness, proof delivery, and remediation attention across clients without cross-tenant data leakage.

As a partner delivery manager, I want each client portfolio card to show readiness, scope coverage, integration health, latest Snapshot/report activity, evidence-pack counts, and open remediation work, so that QBR preparation is grounded in current Periscan evidence.

As an executive report consumer, I want proof-delivery and remediation-velocity metrics through the API, so that board, customer, and partner reporting can be generated without depending on the current web UI.

As a remediation leader, I want executive trends to show critical/high validated findings, verified fixes, open remediation work, closed-without-evidence counts, and recommendations, so that risk reduction status is grounded in current Periscan evidence.

## Release Completion Reporting

Requirement labels: `PRD-Completion-Report`, `PRD-CI-ReleaseGates`, `PRD-Production-Readiness`.

As a release owner, I want a single completion report tied to PRD labels, tests, assumptions, and manual verification steps, so that first-customer review does not depend on reconstructing state from scattered implementation notes.

As a human reviewer, I want the completion report to identify deployment-managed controls and credential-dependent limits, so that customer readiness claims stay precise.

## Supabase Compatibility

Requirement labels: `PRD-Supabase-DeploymentCompatibility`.

As a platform operator, I want Periscan to run on Supabase-managed PostgreSQL and S3-compatible storage using Supabase environment aliases, so that production deployment requires no custom env-variable translation layer.

As a release engineer, I want the CLI verification path to resolve Supabase aliases for database and evidence storage, so that validation gates can run against a Supabase-hosted environment without local compose rewrites.

## Threat Center Manual Advisory Import

Requirement labels: `PRD-ThreatCenter-ManualImport`, `PRD-API-First`, `PRD-Evidence-Auditable`, `PRD-Safety-Policy-Bounded`.

As a tenant administrator, I want to manually import a threat advisory through the API, so that Periscan can preserve advisory context as evidence before any validation work is approved.

As a security engineer, I want Periscan to extract CVEs, IoCs, and MITRE technique IDs from the advisory and merge explicit inputs, so that I can build a validation plan without treating advisory text as proof.

As an API customer, I want the advisory detail API to include missing signals, impact assessment, validation plan, readiness report, and raw evidence ID, so that downstream systems can automate readiness workflows without scraping the UI.

As a platform administrator, I want advisory import to compute readiness from current tenant configuration and avoid queueing validation jobs, so that the workflow respects verified scope, integrations, runner prerequisites, and policy approval gates.

As a security engineer, I want an in-app Threat Center page backed by the same public advisory APIs, so that I can import advisories, review readiness, inspect missing signals, and select plan items without depending on a hardcoded demo screen.

As a returning Threat Center user, I want backend load failures to show a retryable API error instead of a signed-out form, so that I can distinguish service issues from authentication state.

As a report consumer, I want the Threat Center UI to show evidence IDs and prerequisite gaps instead of raw advisory dumps or feed claims, so that advisory response remains evidence-grounded and safe.

As a security engineer, I want to export an advisory readiness report as HTML or PDF through the API and UI, so that I can share normalized advisory readiness without exposing raw advisory content.

As an API customer, I want generated advisory readiness reports to appear as evidence packs, so that downstream systems can use the same report export contract as Validation Snapshot evidence packs.

## Microsoft Defender Email Connector

Requirement labels: `PRD-EmailSecurity-Connector`, `PRD-Control-Validation`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

As a security engineer, I want to connect Microsoft Defender for Office 365 with read-only Graph permissions, so that Periscan can use real email-security alerts and incidents as control-observation evidence.

As a security engineer, I want to connect Google Gmail Security with read-only Alert Center access, so that Periscan can use authorized Gmail phishing and malware alert evidence without reading mailbox content or changing Google alerts.

As a security engineer, I want to connect Proofpoint TAP with read-only SIEM API credentials, so that Periscan can use authorized blocked, delivered, issue, and click threat events as email-security control-observation evidence without changing Proofpoint enforcement or policy.

As a security engineer, I want to connect Mimecast with read-only SIEM API credentials, so that Periscan can use authorized gateway MTA log evidence for email-security control validation without releasing messages, changing policies, changing groups, or mutating users.

As a security engineer, I want to connect Abnormal Security with a read-only API token, so that Periscan can use authorized threat-log evidence for email-security control validation without changing threat status, moving messages, or performing remediation.

As an API customer, I want Defender email connector manifests, health, sync, and integration creation to be exposed through the same integration APIs as every other connector, so that UI clients can be replaced without losing email-security capability.

As an API customer, I want Gmail Security connector manifests, health, sync, observer outcomes, and integration creation to be exposed through the same integration APIs as every other connector, so that tenant automation can consume Google Alert Center evidence without relying on a fixed UI.

As an API customer, I want Proofpoint TAP connector manifests, health, sync, and integration creation to be exposed through the same integration APIs as every other connector, so that tenant automation can consume Proofpoint evidence without relying on a fixed UI.

As an API customer, I want Mimecast connector manifests, health, sync, and integration creation to be exposed through the same integration APIs as every other connector, so that tenant automation can consume Mimecast SIEM evidence without relying on a fixed UI.

As an API customer, I want Abnormal Security connector manifests, health, sync, and integration creation to be exposed through the same integration APIs as every other connector, so that tenant automation can consume Abnormal threat-log evidence without relying on a fixed UI.

## Bitbucket Connector

Requirement labels: `PRD-Bitbucket-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a security engineer, I want to connect Bitbucket Cloud with read-only repository permissions, so that Periscan can use repository metadata and branch restrictions as validation context without cloning code.

As an API customer, I want Bitbucket repository inventory and posture signals to use the same integration APIs and normalized SignalEnvelope records as GitHub and GitLab, so that code-source integrations are interchangeable from my automation layer.

## Azure DevOps Connector

Requirement labels: `PRD-AzureDevOps-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a security engineer, I want to connect Azure DevOps with a read-only PAT, so that Periscan can use project, repository, and branch-policy posture as validation context without reading source files.

As an API customer, I want Azure DevOps repository signals to use the same API and normalized evidence model as GitHub, GitLab, and Bitbucket, so that customer automations can onboard code systems consistently.

## Buildkite Connector

Requirement labels: `PRD-Buildkite-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a platform engineer, I want to connect Buildkite with read-only pipeline access, so that Periscan can understand CI/CD pipeline context and repository links without reading logs, artifacts, or secrets.

As an API customer, I want Buildkite pipeline context to be normalized into the same integration and SignalEnvelope APIs, so that validation and reporting workflows can reason about code delivery controls without UI-specific logic.

## CircleCI Connector

Requirement labels: `PRD-CircleCI-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a platform engineer, I want to connect CircleCI with read-only project pipeline access, so that Periscan can understand CI/CD context without reading job logs, artifacts, environment variables, or triggering workflows.

As an API customer, I want CircleCI pipeline metadata normalized through the same connector and SignalEnvelope APIs, so that validation snapshots can reason about delivery pipelines without depending on the web UI.

## Jenkins Connector

Requirement labels: `PRD-Jenkins-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a platform engineer, I want to connect Jenkins with read-only job access, so that Periscan can understand CI/CD job and last-build context without triggering builds, reading console logs, downloading artifacts, reading credentials, or using script console.

As an API customer, I want Jenkins job metadata normalized through the same connector and SignalEnvelope APIs, so that validation snapshots and control observations can reason about delivery pipelines without UI-specific logic.

## Docker Hub Connector

Requirement labels: `PRD-DockerHub-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a security engineer, I want to connect Docker Hub with read-only repository metadata access, so that Periscan can understand container registry exposure without pulling image layers or reading manifests.

As an API customer, I want Docker Hub repository and tag metadata normalized into Periscan assets and signals, so that validation and reporting workflows can reason about container images through the public API.

## GitHub Container Registry Connector

Requirement labels: `PRD-GitHubContainerRegistry-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a platform engineer, I want to connect GitHub Container Registry with read-only package metadata access, so that Periscan can understand GHCR container exposure without pulling images or inspecting manifests.

As an API customer, I want GHCR package, version, and tag metadata normalized into Periscan assets and signals, so that validation and reporting workflows can reason about container packages through the public API.

## AWS ECR Connector

Requirement labels: `PRD-AWSECR-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a cloud security engineer, I want to connect AWS ECR with read-only repository metadata access, so that Periscan can understand private container registry posture without pulling images or requesting layer downloads.

As an API customer, I want ECR repository, image digest, tag, scan-on-push, and tag-mutability metadata normalized into Periscan assets and signals, so that validation and reporting workflows can reason about container image posture through the public API.

## Tenable VM Connector

Requirement labels: `PRD-TenableVM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a vulnerability management engineer, I want to connect Tenable with read-only workbench access, so that Periscan can use existing vulnerability and asset summaries as exposure-validation context without starting scans or exposing raw scanner dumps.

As an API customer, I want Tenable asset and vulnerability summaries normalized into Periscan assets and SignalEnvelope records, so that automation and reports can reason about CVE exposure through the public API instead of the UI.

## Rapid7 InsightVM Connector

Requirement labels: `PRD-Rapid7InsightVM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a vulnerability management engineer, I want to connect Rapid7 InsightVM with read-only asset and vulnerability access, so that Periscan can use existing VM context as exposure-validation evidence without launching scans or exports.

As an API customer, I want Rapid7 asset risk and CVE summaries normalized into Periscan assets and SignalEnvelope records, so that vulnerability-management context is available through the public API and not tied to a specific UI.

## Wiz CNAPP Connector

Requirement labels: `PRD-WizCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a cloud security engineer, I want to connect Wiz with read-only GraphQL access, so that Periscan can use existing CNAPP cloud-resource and issue context without changing Wiz or cloud configuration.

As an API customer, I want Wiz cloud-resource, internet-exposure, issue-severity, and CVE summaries normalized into Periscan assets and SignalEnvelope records, so that exposure validation can consume CNAPP context through the public API instead of a fixed UI.

## Prisma Cloud CNAPP Connector

Requirement labels: `PRD-PrismaCloudCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a cloud security engineer, I want to connect Prisma Cloud with a read-only access key, so that Periscan can use existing CNAPP alert and resource context without dismissing alerts, changing alert rules, remediating resources, or changing cloud configuration.

As an API customer, I want Prisma Cloud alert, cloud-resource, internet-exposure, severity, and CVE summaries normalized into Periscan assets and SignalEnvelope records, so that exposure validation can consume CNAPP context through the public API instead of a fixed UI.

## Lacework / FortiCNAPP Connector

Requirement labels: `PRD-LaceworkFortiCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a cloud security engineer, I want to connect Lacework/FortiCNAPP with a read-only API token, so that Periscan can use existing host vulnerability observations without triggering scans, creating exceptions, updating policies, or changing alert state.

As an API customer, I want Lacework host vulnerability, severity, package, and CVE summaries normalized into Periscan assets and SignalEnvelope records, so that exposure validation can consume FortiCNAPP context through the public API instead of a fixed UI.

## Orca Security CNAPP Connector

Requirement labels: `PRD-OrcaSecurityCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a cloud security engineer, I want to connect Orca Security with a read-only API token, so that Periscan can use existing cloud-risk alerts and asset context without acknowledging, dismissing, closing, suppressing, or remediating alerts.

As an API customer, I want Orca alert, cloud-asset, internet-exposure, severity, and CVE summaries normalized into Periscan assets and SignalEnvelope records, so that exposure validation can consume Orca context through the public API instead of a fixed UI.

## Qualys VMDR Connector

Requirement labels: `PRD-QualysVMDR-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a vulnerability management engineer, I want to connect Qualys VMDR with read-only host and detection access, so that Periscan can use existing vulnerability-management evidence without launching scans, creating reports, or changing Qualys configuration.

As an API customer, I want Qualys host, vulnerability severity, and CVE summaries normalized into Periscan assets and SignalEnvelope records, so that exposure-validation workflows can consume VMDR context through public APIs instead of a fixed UI.

## runZero Connector

Requirement labels: `PRD-RunZero-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As an exposure management engineer, I want to connect runZero with a read-only Export Token, so that Periscan can use existing asset and service inventory without triggering scans or changing runZero configuration.

As an API customer, I want runZero asset, service, and public-exposure observations normalized into Periscan assets and SignalEnvelope records, so that attack-path and snapshot workflows can consume asset-inventory context through public APIs instead of a fixed UI.

## Assetnote ASM Connector

Requirement labels: `PRD-AssetnoteASM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As an exposure management engineer, I want to connect Assetnote with read-only attack-surface asset access, so that Periscan can use existing external asset and exposure context without launching scans, creating targets, or changing Assetnote configuration.

As an API customer, I want Assetnote asset, service, public-exposure, risk, and CVE observations normalized into Periscan assets and SignalEnvelope records, so that Snapshot and attack-path workflows can consume ASM context through public APIs instead of a fixed UI.

## Axonius CAASM Connector

Requirement labels: `PRD-AxoniusCAASM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As an asset management engineer, I want to connect Axonius with read-only CAASM asset access, so that Periscan can use existing device, identity, adapter, and coverage context without enforcing policies or changing Axonius assets.

As an API customer, I want Axonius asset, adapter-coverage, exposure, coverage-gap, risk, and CVE observations normalized into Periscan assets and SignalEnvelope records, so that Snapshot and attack-path workflows can consume CAASM context through public APIs instead of a fixed UI.

## Armis Connector

Requirement labels: `PRD-Armis-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As an asset management engineer, I want to connect Armis with read-only device and asset access, so that Periscan can use unmanaged-device, coverage-gap, exposure, and CVE context without enforcing policies, quarantining devices, or changing Armis assets.

As an API customer, I want Armis asset-inventory, unmanaged-asset, internet-exposure, coverage-gap, risk, and CVE observations normalized into Periscan assets and SignalEnvelope records, so that Snapshot and attack-path workflows can consume Armis context through public APIs instead of a fixed UI.

## Cortex Xpanse Connector

Requirement labels: `PRD-CortexXpanse-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As an exposure management engineer, I want to connect Cortex Xpanse with read-only external attack-surface access, so that Periscan can use exposed services, external assets, high-risk observations, and CVEs without launching scans, mutating assets, creating exceptions, or changing Cortex Xpanse configuration.

As an API customer, I want Cortex Xpanse attack-surface asset, service, exposure, risk, and CVE observations normalized into Periscan assets and SignalEnvelope records, so that validation snapshots and attack paths can consume external attack-surface context through public APIs without raw ASM dumps as primary UX.

## AbuseIPDB Connector

Requirement labels: `PRD-AbuseIPDB-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a threat analyst, I want to connect AbuseIPDB with read-only IP reputation access, so that Periscan can enrich advisory IoCs without reporting IPs or mutating an external threat-intelligence system.

As an API customer, I want AbuseIPDB IP reputation checks normalized into Periscan SignalEnvelope records, so that Threat Center readiness and exposure workflows can consume threat-intel context through public APIs without raw reputation dumps as the primary product output.

## VirusTotal Connector

Requirement labels: `PRD-VirusTotal-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a threat analyst, I want to connect VirusTotal with read-only v3 search access, so that Periscan can enrich advisory IP, domain, URL, and file-hash indicators without uploading files, submitting URLs, or mutating VirusTotal data.

As an API customer, I want VirusTotal reputation context normalized into Periscan SignalEnvelope records, so that Threat Center and Snapshot workflows can consume IoC context through public APIs without raw reputation dumps as the primary product output.

## GreyNoise Connector

Requirement labels: `PRD-GreyNoise-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a threat analyst, I want to connect GreyNoise Community API with read-only IP context access, so that Periscan can distinguish internet scanner noise, malicious scanner activity, and known benign RIOT services for advisory IP indicators.

As an API customer, I want GreyNoise scanner and RIOT context normalized into Periscan SignalEnvelope records, so that Threat Center readiness and Snapshot workflows can consume IP reputation context through public APIs without raw lookup dumps as the primary product output.

## AlienVault OTX Connector

Requirement labels: `PRD-AlienVaultOTX-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a threat analyst, I want to connect AlienVault OTX with read-only indicator-detail access, so that Periscan can enrich advisory IP, domain, URL, hash, and CVE context without creating pulses, subscribing to feeds, exporting indicators, or mutating OTX data.

As an API customer, I want OTX pulse-association context normalized into Periscan SignalEnvelope records, so that Threat Center readiness and Snapshot workflows can consume IoC context through public APIs without raw OTX response dumps as the primary product output.

## Recorded Future Connector

Requirement labels: `PRD-RecordedFuture-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a threat analyst, I want to connect Recorded Future with read-only vulnerability search and entity-match access, so that Periscan can enrich advisory CVEs and threat entity names without creating lists, alerts, feed subscriptions, or mutating Recorded Future data.

As an API customer, I want Recorded Future risk and entity context normalized into Periscan SignalEnvelope records, so that Threat Center readiness and Snapshot workflows can consume threat relevance context through public APIs without raw intelligence dumps as the primary product output.

## Mandiant Advantage Connector

Requirement labels: `PRD-MandiantAdvantage-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a threat analyst, I want to connect Mandiant Advantage with read-only API v4 enrichment access, so that Periscan can enrich advisory IoCs, CVEs, and threat actor names without importing feeds, exporting reports, submitting indicators, or mutating Mandiant data.

As an API customer, I want Mandiant MScore, vulnerability exploitation, and threat actor context normalized into Periscan SignalEnvelope records, so that Threat Center readiness and Snapshot workflows can consume Mandiant relevance context through public APIs without raw intelligence dumps as the primary product output.

## Policy Binding and Error Handling (P0 Safety Hardening)

Requirement labels: `PRD-Safety-Policy`, `SPEC-SEC-01`, `SPEC-API-01`, `PRD-Operational-Hardening`, `PRD-Safety-VerifiedScope`.

As a tenant administrator or security engineer (any RBAC role with SCOPE_EDITOR), I want `createMission` and `startMission` to fully bind and re-validate a provided policyDecisionId against the mission's scopeId, missionType, and safetyLevel (mismatches return 400 with machine-readable codes `policy_decision_scope_mismatch`, `policy_decision_mission_type_mismatch`, `policy_decision_safety_level_mismatch`), so that a low-risk decision cannot authorize higher-risk or out-of-scope validation and denied missions never queue jobs.

As an API client or web UI consumer, I want all policy, authz, and target errors to include a stable `code` field in the `{code?, error}` ApiError body (e.g. `policy_decision_required`, `policy_decision_not_found`, `policy_decision_missing`, `unauthorized`, `runner_unauthorized`), so that automated clients and the web UI can distinguish 400 policy errors from 401/404/500 without parsing messages.

As a returning authenticated user with a malformed/expired session cookie (common after deploy or secret rotation), I want protected endpoints to return clean 401 (not 500 from JWT verify) and `/logout` to succeed (clearing the bad cookie), so that users are never stuck in a dead-end after cookie staleness.

As a security reviewer, I want every binding mismatch or auth failure to emit a specific auditable event (policy decision context preserved), so that ops can detect attempted bypasses without relying on generic error logs.

## Validation Target Resolution for Runs (P0)

Requirement labels: `PRD-Safety-ExternalValidation`, `PRD-Core-ProofLoop`, `SPEC-DATA-01`, `PRD-Validation-Snapshot`.

As a security engineer executing external validation (e.g. `nuclei.external_exposure_safe` with safe profiles on verified domain scope), I want `startMission` (when input.target omitted) to resolve `resolvedTarget = input.target ?? decision.target` and persist the full target object to the created ValidationRun (and use it for guards, module constraints, job payload), so that the run record, evidence, and downstream always reflect the policy-approved verified target instead of empty or caller drift.

As an API consumer or auditor, I want GET /missions/:id/runs (and run details) to always include the resolved target used, even for starts that omitted the field in payload, so that proof of "what was validated" is complete and immutable.

As a security reviewer, I want target resolution and binding checks to occur inside the same DB tx before any queue/enqueue, with audit on the mission/run, so that no denied or mis-targeted external PoA run can ever be created.

## UX States, Loading, Empty, Error, Responsive and A11y Polish (P1/P2)

Requirement labels: `PRD-BetterTogetherUX`, `SPEC-UI-01`, `PRD-Trust-Safety-Page`, `PRD-ThreatCenter-WebSurface`.

As a returning authenticated user reloading Workspace (/) or Threat Center, I want an explicit `isLoading` state ("Restoring your session...") that hides the auth form until GET /me resolves, so that there is no jarring "Create tenant..." flash on every mount (matching the pattern already in Trust & Safety and MSSP).

As a tenant administrator using the Integration Marketplace, I want initial catalog load to show a loading panel (instead of flash of 0), filter-zero results to render a clear empty state ("No connectors match your filters"), fixture connector setup shortcuts hidden unless explicit lab mode is enabled, and successful fixture-lab or live connector setup to immediately call sync/health and surface fresh healthStatus/lastSyncAt in Marketplace and Trust & Safety, so that post-connect experience is not stale "Unknown"/"Never synced" and customer workspaces are not shown mock setup as primary onboarding.

As a tenant administrator reviewing Registry Center or Validation Ops, I want current API-derived data to remain visible after a transient refresh failure and a safe reload action to re-read API resources, so that I can recover without losing context or replaying mutating operations.

As a tenant administrator connecting an Integration Marketplace connector, I want the created connection to remain visible when the follow-up sync fails and a safe reload action to re-read marketplace data without replaying setup or sync requests, so that connector onboarding failures do not create ambiguous duplicate actions.

As a mobile operator or user on <360px viewport (phone portrait), I want cards to stack responsively, touch targets >=44px, text to wrap without overflow, and grids to degrade gracefully (beyond the single @media 720px rule), so that the full control plane (workspace, marketplace, threat, trust, mssp, report) remains usable without horizontal scroll or cut-off CTAs.

As a user relying on keyboard or screen reader, I want form fields to use proper associated <label> (not just <span>), status pills and dynamic messages to use aria-live or role, segmented controls grouped with role=tablist or fieldset, focus-visible styles on all interactive, and skip-to-main if long, so that basic a11y is met on all primary surfaces.

As a keyboard or screen-reader user completing Workspace authentication or Threat Center advisory import, I want every visible form control to have an explicit accessible label, authentication mode controls to expose selected state, dynamic readiness/count/status labels to be announced as status, and import errors to be dismissible alerts, so that the API-driven workflow remains operable without visual-only cues.

As a keyboard or screen-reader user filtering the Integration Marketplace, I want filter controls to have stable associated labels and catalog/availability/connection counts to be exposed as named status elements, so that connector discovery and readiness do not depend on visual styling alone.

As a keyboard or screen-reader user reviewing Registry Center or Validation Ops, I want route summary badges, readiness bands, counts, and item statuses to expose explicit status names, so that API-backed registry and operations state is understandable without relying on color, layout, or shorthand text.

As a keyboard or screen-reader user running the Workspace proof loop, I want dashboard counts, scope readiness, connector status, snapshot readiness, design-partner checklist state, attack-path risk, and remediation counts to expose explicit status names and the domain input to have a real label, so that the main validation workflow is operable without placeholder text or visual-only pills.

As a public visitor viewing the sample demo, I want every sample metric and sample-data badge to be exposed as a named status, so that it is clear the report is generated from deterministic sample data and not a real customer environment.

As a tenant administrator or customer reviewer using assistive technology, I want Trust & Safety counts, operational readiness badges, audit entity types, and Snapshot report delivery states to expose explicit status names, so that connected-system trust posture and evidence-pack delivery state are understandable without relying on color or layout.

As an API customer or threat analyst using assistive technology, I want API method badges and imported advisory statuses to expose explicit status names, so that customer automation routes and advisory-list state are understandable without relying on visual styling.

As an error-state user (API 4xx/5xx, network fail, 401 on protected), I want consistent error banners with message, code if present, retry affordance (where safe), and distinction of client vs server vs auth vs policy, plus success toasts after connect/disconnect/sync/ticket, so that no dead-ends and feedback is actionable (no raw inline only).

As a tenant administrator reviewing Trust & Safety, I want the page to show API control-plane health from the same public API client used by the web app, so that trust review includes live service reachability rather than an unused or UI-only status widget.

As a security operator starting from the Workspace proof loop, I want production workspaces to hide GitHub/AWS fixture connector shortcuts by default while local lab/demo environments can explicitly expose them, and I want the Workspace to link directly to the full Integration Marketplace and Trust & Safety health view, so that the proof-loop workflow does not trap me in two hardcoded connectors or present fixtures as real customer onboarding.

## PSA / RMM Direct Remediation Tickets (P1-007)

Requirement labels: `PRD-Remediation API`, `SPEC-REM-01`, `PRD-Syncro-MSSPConnector` (and peers), `PRD-SignalDriven-Triggers`.

As an MSSP operations lead or remediation owner (after Snapshot produces a prioritized finding with RemediationTask), I want to select any connected PSA/RMM destination (Syncro, HaloPSA, Autotask, ConnectWise, NinjaOne etc via integrationId) from the snapshot-workbench rem card and POST /remediations/:id/create-ticket, so that a policy-gated (originating from approved mission) ticket is created and attached (ticketSystem set from connector, metadata returned, audit `remediation.ticket.created`) — extending the prior Jira-only direct path and the signal-trigger workflow path.

As an API customer or UI, I want create-ticket with unsupported integration or missing policy context to return specific errors (no queue, no ticket), and success to update the RemediationTask with ticketId/system immediately visible in findings/trends, so that the "action and revalidation loop" is complete end-to-end for expanded PSA catalog without forcing manual trigger setup.

As a security reviewer, I want direct PSA ticket creation to require the same RBAC (SCOPE_EDITOR), remediation existence from prior allowed run, and to never expose secrets (redacted delivery result only), so that safety model holds identically for Jira and Syncro-class PSAs.

## Threat Center Full Vertical (P1-001)

Requirement labels: `PRD-ThreatCenter-ManualImport`, `PRD-ThreatCenter-WebSurface`, `PRD-ThreatCenter-ReadinessExport`, `PRD-Delta-ThreatCenter-Foundation`.

As a security engineer or threat analyst, I want the /threat-center web surface (and API) to support complete real-data journeys: loading states on list/detail, empty "No advisories..." and "Select or import...", import form with busy, detail with readiness pills (Ready/MissingSignals/RequiresApproval), missingSignals grid (impacted by real connector signals e.g. Splunk SecurityControl reducing "control_telemetry"), non-exec validation plan items (NeedsApproval etc), evidence chips, and export (HTML/PDF with evidencePackId + redaction + audit), so that manual advisory + readiness is production usable with honest empty/error/success and no demo-only surfaces.

As an API customer, I want advisory import to compute readiness from current tenant (integrations, runners, scopes, controls) without queuing any validation jobs, and export to produce evidence-backed packs identical in contract to Snapshot reports, so that Threat Center feeds the same reporting/audit/evidence fabric.

As a security reviewer, I want real connector signals (e.g. from ControlValidation via Splunk) to visibly reduce missingSignals counts in advisory readiness and surface in findings/exec trends, so that missing-signal intelligence is first-class and grounded while commercial/private threat-feed onboarding remains customer/business-gated.

## Internal Runner Customer Deployment (P1-003)

Requirement labels: `PRD-Runner-ProductionPackaging`, `PRD-Runner-LocalLabE2E`, `PRD-Production-Readiness`.

As a customer platform administrator, I want documented, copy-pasteable customer deployment artifacts beyond lab (GHCR image via .github/workflows/runner-publish.yml on tags, apps/runner/deploy/k8s/runner-deployment.yaml with non-root + readOnlyRootFS + NetworkPolicy + probes + secret, apps/runner/deploy/systemd/periscan-runner.service hardened, apps/runner/deploy/docker-compose.runner.yml + deploy/README.md with exact prereqs/Supabase aliases/egress-only/verified-scope assumptions/reachability+artifact validation steps using real pnpm test:runner:lab), so that outbound runner can be installed in real k8s or systemd hosts without reverse-engineering.

As an operator reviewing Trust & Safety or docs, I want runner deployment to be explicitly "deployment-managed" (customer provides image pull secret, env for signing keys, host egress, no inbound, verified scope only), with validation that reach/artifact flows work against the deployed runner, so that production assumptions are transparent and no fake "it just works" claims.

As a release owner, I want runner deploy artifacts to be exercised in CI (publish workflow) and referenced from README, PRODUCTION_READINESS, RUNNER_ARCHITECTURE, IMPLEMENTATION_STATUS, ROADMAP Phase 6, so that the "core done, deploy next" is closed for first-customer feasible paths.

## Tenant Operational Metrics API (P2 Observability)

Requirement labels: `PRD-Operational-Hardening`, `PRD-API-First`, `PRD-Trust-Safety-Page`, `PRD-Integration-Registry`, `PRD-Safety-Policy`.

As a tenant administrator, I want an API endpoint for mission-start latency, policy denial rate, and connector sync timing, so that Periscan operations and future UI surfaces can show customer-ready health data without scraping logs.

As an API customer, I want operational metrics derived from tenant-scoped persisted missions, policy decisions, integrations, and audit events, so that automation can monitor validation readiness through `/api/v1` even if the UI is replaced.

As a security reviewer, I want integration sync telemetry and mission-start timing persisted as audit metadata without credentials or raw scanner output, so that operational reports remain auditable and safe.

As a production operator, I want Prometheus-compatible API process metrics, so that deployment monitoring can scrape uptime and memory signals without depending on UI routes or log scraping.

## API Reference and Customer Automation (P2 API-First)

Requirement labels: `PRD-API-First`, `PRD-Product-Principles`, `SPEC-API-01`.

As a customer API user or platform engineer, I want a customer-facing API Reference page generated from the live `/api/v1/api-reference` contract, so that I can automate Periscan workflows without being coupled to the current web UI.

As a customer API user, I want each API Reference endpoint to indicate whether request and response schemas are published in OpenAPI, so that my automation can distinguish fully typed payloads from route-only operations without reverse-engineering the UI.

As a customer API user, I want each API Reference endpoint to list published query parameter names, so that list controls such as `limit`, catalog filters, and SSO state/nonce requirements are discoverable without inspecting implementation code.

As a customer API user, I want each API Reference endpoint to list request content types, response content types, and success statuses, so that replacement UIs and automation can handle JSON, HTML, CSV, PDF, redirect, and no-content endpoints without parsing raw OpenAPI.

As a customer API user, I want API Reference groups to use Periscan product areas such as Threat Center, Model Gateway, Operators, Jobs, Approvals, Policy, Audit, MITRE ATT&CK, and Deployment, so that I can find the workflow surface I need without treating new capabilities as generic system routes.

As a customer API user, I want high-volume list endpoints to return bounded default result sets while supporting an explicit `limit`, so that automation and replacement UIs do not accidentally fetch unbounded evidence, report, or advisory histories.

As a product owner swapping or rebuilding the UI, I want the web API Reference route to consume the same public API metadata as external clients, so that the UI remains a consumer of the API rather than a parallel source of truth.

As a release reviewer, I want the API Reference route included in primary navigation and route-level accessibility gates, so that customer API access does not become a hidden or untested surface.

## Validation Operations API-Backed Web Surface (P2 API-First)

Requirement labels: `PRD-API-First`, `PRD-Core-ProofLoop`, `PRD-UX-MainNavigation`, `PRD-CTEM-View`, `PRD-Billing-Metering`.

As a security engineer operating the proof loop, I want a Validation Ops route that reads attack paths, remediation tasks, evidence artifacts, reports, AI apps, control sources, runners, CTEM status, and billing usage from `/api/v1`, so that I can review operational state without relying on UI-only data.

As a customer platform engineer replacing or extending the UI, I want the same operational state exposed through typed public API client methods, so that a custom UI or automation can consume Periscan without duplicating backend contracts.

As a release reviewer, I want the Validation Ops route to show loading, signed-out, error, empty, and populated states and to be included in primary navigation plus route-level browser accessibility gates, so that hidden PRD navigation areas do not regress silently.

## Registry Center API-Backed Extension Surface (P2 API-First)

Requirement labels: `PRD-Module-Registry`, `PRD-Open-Source-Acceleration`, `PRD-Operators`, `PRD-API-First`.

As a security platform administrator, I want a Registries route that reads module manifests, OSS tool runtime readiness, productized capabilities, operator profiles, and operator recommendations from `/api/v1`, so that I can understand what Periscan can execute, import, recommend, or block without exposing OSS plumbing as the product.

As a security reviewer, I want blocked/deferred/legal-review tools and advanced-adversarial capabilities to remain visible with policy status but not executable from the UI, so that the safety model is transparent and no sensitive capability is accidentally enabled.

As a customer API user replacing the UI, I want typed client methods for modules, open-source tools, open-source capabilities, operators, and recommendations, so that the extension layer can be automated through the same public API surface.

## Operational Metrics and Executive Trends Web Surface (P2 API-First)

Requirement labels: `PRD-Operational-Hardening`, `PRD-Executive-Trends`, `PRD-API-First`, `PRD-Core-ProofLoop`.

As a tenant administrator reviewing Validation Ops, I want mission-start latency, policy denial rate, connector sync counts, remediation velocity, proof delivery, and recommendations to render from `/api/v1/tenants/current/operational-metrics` and `/api/v1/tenants/current/executive-trends`, so that operational health and executive trend signals are visible without scraping logs or fabricating UI metrics.

As a customer API user replacing the UI, I want typed client methods for operational metrics and executive trends, so that my automation can consume the same tenant-scoped data rendered by the current app.

## Tenant OIDC/SAML SSO Foundation (Enterprise Access)

Requirement labels: `PRD-EnterpriseAccess-SSOFoundation`, `PRD-API-First`, `PRD-Auditability`.

As a tenant owner or administrator, I want to configure an OIDC or SAML identity provider through `/api/v1/tenants/current/sso`, so that enterprise access setup is tenant-scoped, auditable, and available to API customers without depending on the current web UI.

As a platform engineer integrating Periscan with an IdP, I want client secrets to be write-only and represented in responses as `clientSecretSet`, so that customer automation can confirm setup without exposing credential material.

As a platform engineer integrating a SAML IdP, I want the IdP certificate to be accepted for response verification but exposed only as `samlIdpCertificateSet`, so that API consumers can confirm setup without leaking certificate configuration through responses or audit logs.

As a platform engineer integrating a SAML IdP, I want Periscan to publish service-provider metadata through `/api/v1/tenants/current/sso/metadata`, so that the IdP can be configured without relying on a UI-only setup screen.

As a security reviewer, I want SSO changes to require tenant-admin RBAC and emit audit events, so that identity configuration changes are traceable before live callback/session enforcement is used.

As an enterprise user, I want to start OIDC or SAML SSO login through `/api/v1/auth/sso/start` and complete it through `/api/v1/auth/sso/callback`, so that I can authenticate through my configured IdP without depending on the current web UI.

As a tenant administrator, I want enforced tenant SSO to block password login for provisioned users, so that enterprise identity policy cannot be bypassed after SSO is enabled.

As a tenant administrator, I want SSO sessions to be honored only for the enforced tenant that issued them, so that SSO from one tenant cannot bypass another tenant's IdP policy.

As a security reviewer, I want OIDC callback state, nonce, issuer, audience, email domain, and provisioned-user membership checks to be validated and audited, so that SSO sessions are tenant-scoped and replay-resistant.

As a security reviewer, I want SAML callbacks to validate signed IdP responses and persisted request correlation before creating a session, so that SAML login cannot bypass tenant scope, replay protection, or provisioned-user membership checks.

## Model Gateway Tool Input Boundary

Requirement labels: `PRD-ModelGatewayToolInputContract`, `PRD-API-First`, `PRD-Evidence-Redaction`, `PRD-FrontierGateway`.

As a security engineer using Frontier Gateway tools, I want model/tool-call arguments to be validated against the code-defined tool catalog before they are persisted, so that undeclared fixture controls, malformed identifiers, and out-of-range values cannot become durable tool requests.

As a tenant administrator reviewing model activity, I want stored tool-request input payloads to be redacted while preserving an integrity hash of the canonical input, so that audits can prove what was requested without exposing raw secret-like values.

As a customer API user replacing the UI, I want invalid tool input to fail with a stable API error before side effects, so that automation can distinguish malformed tool requests from policy denials and execution failures.

## Worker Fixture Target Defense

Requirement labels: `PRD-WorkerFixtureTargetDefense`, `PRD-Real-First`, `PRD-JobScheduler`, `PRD-PolicyEngine`.

As a security reviewer, I want the asynchronous validation worker to fail closed when a queued production validation run contains fixture or mock target hints, so that persistence-layer or stale-job mistakes cannot fabricate product-visible validation evidence.

As a developer running local fixture tests, I want fixture-backed worker execution to require an explicit dev/test opt-in, so that deterministic local tests remain possible without making fixture execution the worker default.

As an API customer, I want denied worker fixture jobs to fail before module execution, evidence creation, signal persistence, graph projection, or audit success records, so that failed synthetic jobs cannot be mistaken for measured proof.

## Runner Result Terminal State Contract

Requirement labels: `PRD-RunnerResultTerminalState`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-API-First`.

As an internal runner, I want the result submission API to accept only terminal task outcomes, so that a result callback cannot leave the validation run, runner task, and mission in contradictory in-flight states.

As a security reviewer, I want malformed runner result states to be rejected before persistence changes, so that only completed or failed signed-task results can update evidence-backed validation state.

## Runner Completion Evidence Requirement

Requirement labels: `PRD-RunnerCompletionEvidence`, `PRD-Evidence-Auditable`, `PRD-FixVerification`, `PRD-Runner-SignedTasks`.

As a security reviewer, I want completed runner task results to require at least one uploaded evidence artifact, so that in-network validation and fix-verification success cannot be recorded without proof.

As a customer running the TypeScript runner-agent, I want the agent to upload a normalized result artifact before it submits a successful result, so that the control plane can redact, hash, and link runner evidence consistently with other validation artifacts.

## Remediation Ready Audit

Requirement labels: `PRD-RemediationReadyAudit`, `PRD-Audit-Completeness`, `PRD-FixVerification`, `PRD-API-First`.

As a security reviewer, I want marking remediation ready for verification to write an audit event, so that the proof loop records who moved a fix into verification-pending state and what the prior state was.

As an API customer replacing the UI, I want the ready-for-verification audit event to be visible through `/api/v1/audit-events`, so that automation can reconstruct remediation lifecycle state changes without relying on hidden UI history.

## Remediation Ticket Audit

Requirement labels: `PRD-RemediationTicketAudit`, `PRD-Audit-Completeness`, `PRD-RemediationEngine`, `PRD-API-First`.

As a remediation owner, I want ticket creation and workflow delivery to have a distinct audit action from remediation-task creation, so that operational routing can be reviewed independently from the creation of the underlying fix task.

As an API customer, I want `/api/v1/audit-events` to expose remediation ticket events with integration and ticket metadata, so that external governance systems can reconcile Periscan remediation routing.

## Measured Posture in Snapshot and Fix Verification

Requirement labels: `PRD-MeasuredPostureSnapshotFixVerification`, `PRD-ValidationSnapshot`, `PRD-FixVerification`, `PRD-Core-ProofLoop`.

As a security engineer running a Validation Snapshot, I want Periscan to automatically run the built-in measured DNS, TLS, HTTP, and email posture checks against verified external scopes before generating the report, so that Snapshot results include current measured evidence without requiring explicit module selection.

As an API customer automating the proof loop, I want external-exposure fix verification to retest with the same measured posture modules and verified-scope hostname targets, so that a fixed/closed result is backed by fresh validation-module evidence.

As a security reviewer, I want development fixture mode to be restricted to dev/test runtime while production Snapshot and fix verification use live-safe non-invasive checks, so that product-visible proof is not fabricated.

## Web Shell Breadcrumbs

Requirement labels: `PRD-WebShellBreadcrumbs`, `PRD-UX-MainNavigation`, `PRD-API-First`.

As a security engineer moving between Periscan product surfaces, I want route-aware breadcrumbs in the global shell, so that I can keep context while moving across validation, operations, integrations, governance, and report pages.

As a customer team replacing the UI, I want breadcrumbs derived from the same public navigation contract as the app shell, so that navigation semantics stay stable and are not hidden in page-specific UI code.

As an accessibility reviewer, I want the current breadcrumb item to be marked with `aria-current="page"`, so that assistive technology can identify the user’s current location.

As a report reviewer on a dynamic Snapshot report route, I want direct links to Workspace, Validation Ops, Trust & Safety, and the API Reference, so that the report preview is not an orphaned page and I can move to adjacent API-backed proof-loop surfaces.

## MSSP Responsive Portfolio

Requirement labels: `PRD-MSSPResponsivePortfolio`, `PRD-MSSP-Multitenancy`, `PRD-UX-Responsive`.

As an MSSP operator reviewing client readiness on a small screen, I want portfolio metric and coverage cards to stack before expanding into columns, so that client status remains readable without horizontal crowding.

As a release reviewer, I want the responsive behavior to be covered by component tests, so that future card layout changes do not silently reintroduce cramped mobile grids.

## CTEM Program Summary Provenance

Requirement labels: `PRD-CTEM-View`, `PRD-API-First`, `PRD-No-Raw-Findings`.

As a security engineer reviewing the CTEM program view, I want the API and UI to show whether the summary came from a real Validation Snapshot or from a live tenant-state baseline, so that I do not mistake an empty/no-snapshot baseline for completed validation proof.

As a customer API user replacing the UI, I want `GET /api/v1/ctem/program` to expose CTEM provenance and the backing `snapshotId` when present, so that custom clients can render Snapshot-derived and baseline summaries truthfully.

## Report List Response Bounding

Requirement labels: `PRD-API-First`, `PRD-Reports`, `PRD-Operational-Hardening`.

As a customer API user with a growing report history, I want `GET /api/v1/reports` to accept an optional `limit` parameter, so that automation and replacement UIs can bound response size while preserving the existing all-reports behavior when no limit is provided.

## Full Product Route Coverage

Requirement labels: `PRD-WebRouteCoverage`, `PRD-UX-MainNavigation`, `PRD-API-First`, `PRD-Accessibility`.

As a customer using the first-party web app, I want every primary navigation route to preserve the shared shell, active route state, breadcrumbs, and mobile reachability, so that no product surface becomes an orphaned or inaccessible page.

As an accessibility reviewer, I want WCAG A/AA axe checks to run across every static route in the primary navigation plus dynamic Snapshot report routes, so that release validation does not silently cover only the most common pages.

## Engagement Fixture Target Guard

Requirement labels: `PRD-RealFirst-EngagementTargetGuard`, `PRD-PeriscanOperators`, `PRD-API-First`, `PRD-Real-First`.

As a tenant administrator running an autonomous engagement through the API, I want production engagement plan targets to reject fixture and mock execution hints, so that engagement results cannot be fabricated through caller-supplied module targets.

As a security reviewer, I want engagement fixture-target denials to happen before persistence, validation execution, evidence writes, or job creation, so that denied synthetic requests cannot become product-visible proof.

## Production Database Configuration

Requirement labels: `PRD-ProductionDatabaseConfig`, `PRD-ProductionReadiness`, `PRD-Supabase-DeploymentCompatibility`.

As a platform operator deploying Periscan for customers, I want production startup to require an explicit database URL, so that the API, workers, and Prisma migrations cannot silently use the local development database.

As a platform operator using Supabase-hosted Postgres, I want `SUPABASE_DATABASE_URL` or `SUPABASE_DB_URL` to satisfy the same database readiness contract as `DATABASE_URL`, so that Supabase deployments are first-class without duplicating configuration.

## Alibaba Cloud Read-Only Connector

Requirement labels: `PRD-SignalFabric`, `PRD-IntegrationMarketplace`, `PRD-CloudValidation`, `PRD-API-First`, `PRD-Real-First`.

As a tenant cloud security engineer, I want to connect Alibaba Cloud with least-privilege read-only RAM credentials, so that Periscan can include ECS, security group, and RAM role context in validation planning without performing write or remote-access actions.

As a customer API user replacing the UI, I want `/api/v1/integrations/catalog` and integration sync APIs to expose Alibaba Cloud as a connectable Beta integration with explicit permissions and normalized evidence signals, so that my automation can onboard and sync it like other cloud connectors.

As a security reviewer, I want Alibaba Cloud live sync to call only signed read-only Describe/List APIs and redact credentials/raw IPs from returned assets and signals, so that product-visible results stay safe, scoped, and API-grounded.

## Oracle Cloud Infrastructure Read-Only Connector

Requirement labels: `PRD-SignalFabric`, `PRD-IntegrationMarketplace`, `PRD-CloudValidation`, `PRD-API-First`, `PRD-Real-First`.

As a tenant cloud security engineer, I want to connect Oracle Cloud Infrastructure with an API signing key scoped to inspect a compartment, so that Periscan can include compute, VCN, and security-list posture in validation planning without using console, shell, object-content, or mutation APIs.

As a customer API user replacing the UI, I want `/api/v1/integrations/catalog` and integration sync APIs to expose OCI as a connectable Beta integration with explicit signed-request requirements, so that my automation can onboard and sync it like other cloud connectors.

As a security reviewer, I want OCI live sync to sign HTTPS GET list requests and redact private key material and network CIDR values from returned assets/signals, so that the output remains safe and evidence-grounded.

## Third-Party Tool Governance Center

Requirement labels: `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

As a tenant administrator, I want to see every Periscan-managed third-party validation tool with readiness, license, pinned runtime metadata, legal disposition, install/check jobs, and enablement state, so that I can govern what tools may support my tenant’s validation missions.

As a security reviewer, I want legal-review, blocked, unsafe, or disabled tools to remain visible but non-executable, so that Periscan never hides risk while still preventing unsafe mission execution.

As a platform engineer expanding Periscan’s tool library, I want new tools to enter through a manifest, module wrapper, parser/redaction fixtures, license/safety certification, execution-plane review, and governance API exposure, so that the library can grow systematically without bypassing safety controls.

As a platform engineer evaluating a proposed new tool, I want `/api/v1/third-party-tools/intake/validate` to return a deterministic certification report with checks, required remediation, installable runtimes, legal/safety posture, and runner compatibility, so that I can decide what must change before adding the tool to the reviewed catalog.

As a tenant administrator using Registry Center, I want to submit proposed tool metadata through a UI backed by `/api/v1/third-party-tools/intake/validate`, so that tool-library expansion uses the same API contract customers can automate against.

As a tenant administrator expanding the validation library, I want accepted or rejected tool proposals persisted as tenant-scoped intake candidates, so that new tools can be reviewed, audited, and tracked without making unreviewed tools executable.

As a tenant administrator reviewing a submitted tool candidate, I want a readiness report that compares the candidate against actual catalog/module/governance/runtime/runner/legal state, so that I can see what implementation work remains before the tool can be governed.

As a tenant administrator reviewing a submitted tool candidate, I want to record needs-changes, accepted, rejected, or readiness-gated promoted decisions through an API and Registry Center, so that proposed tool work can be triaged without making it executable.

As a platform engineer promoting a reviewed tool candidate, I want a durable promotion package that snapshots reviewed catalog metadata, readiness checks, governance policy, runtime installation state, modules, capabilities, required evidence, and safety notes, so that a newly reviewed tool can move into tenant governance without losing the proof behind the promotion decision.

As a tenant administrator using Registry Center, I want to load existing promotion packages for promoted tool candidates, so that I can see backend-generated promotion proof without creating duplicate promotion artifacts.

As a platform engineer implementing an accepted tool candidate, I want an API-generated implementation work order with task status, scaffold files, required evidence, readiness state, and audit metadata, so that catalog/module/parser/policy/runner/evidence/license work can be tracked before any tool becomes executable.

As a platform engineer expanding Periscan’s validation library, I want to download an API-generated implementation bundle from an accepted work order, so that scaffold file content, checksums, validation commands, safety notes, and required evidence can be reviewed consistently without writing repo files or executing a tool.

As a tenant administrator governing tool versions, I want update recommendations that compare my tenant pins to reviewed catalog versions, so that Periscan can use newer approved tools systematically without silently changing runtimes or accepting arbitrary versions.

As a tenant administrator governing tool freshness, I want trusted upstream version checks for reviewed tools, so that Periscan can identify newer candidate versions for review without automatically changing catalog versions, tenant pins, installs, missions, or runner execution.

As a tenant administrator reviewing tool operations, I want a per-tool activity timeline from governance records, runtime jobs, validation runs, upstream checks, update recommendations, candidates, work orders, and audit events, so that I can understand how each approved tool is being managed and used without inspecting raw scanner output.

As a tenant administrator preparing customer-network validation, I want a per-tool runner eligibility report from the API, so that I can see whether a reviewed tool is control-plane only, missing runner/runtime/scope prerequisites, approval-gated, implementation-gated, blocked, or ready for signed internal-runner dispatch.

As a customer API user replacing the UI, I want runner eligibility to include capability-level dispatch routes, server allowlist coverage, active runner count, verified compatible scope count, and required actions, so that my automation never assumes a cataloged tool can run inside my network without proof.

As a tenant administrator executing customer-network validation, I want to dispatch a reviewed third-party tool capability through `/api/v1/third-party-tools/:toolId/runner-dispatch`, so that Periscan uses the newest governed tools through the existing signed runner task system without bypassing scope, policy, audit, or local allowlists.

As a customer deploying an internal runner, I want runner-executed third-party tools to use signed outbound task polling, local allowlists, scoped targets, resource limits, evidence upload, and audit logs, so that customer-network validation works through firewalls without reverse shells or arbitrary tunnels.

As a platform operator, I want third-party tool install requests to be queued and executed only by an explicitly enabled platform worker, so that customer API calls cannot run local shell commands and install results remain truthful.

As a security reviewer auditing PRD coverage, I want a read-only third-party tool coverage audit API that classifies every governed OSS/security tool as executable, content/import-only, deferred, blocked, or needing implementation, so that Periscan cannot claim the tool library is complete while unclassified tools remain.

## Attack-Path Validation Source Coverage

Requirement labels: `SRC-3.4-ATTACK-PATH`, `PRD-ATTACK-001`, `PRD-ATTACK-002`, `PRD-ATTACK-003`, `PRD-ATTACK-004`, `PRD-ATTACK-005`, `PRD-ATTACK-006`, `PRD-ATTACK-007`.

As a security engineer, I want attack paths to be generated from normalized graph and signal evidence for repo secrets, cloud roles, production data, external reachability, AI/RAG risks, identity gaps, and missed controls, so that the product maps realistic paths to impact rather than listing raw scanner findings.

As a security leader reviewing a Snapshot report, I want every attack-path card to show evidence IDs, path breakers, business impact, control response where available, and ATT&CK mappings derived from linked evidence, so that I can explain the risk and next action without reading raw tool output.

As a remediation owner, I want before/after attack-path comparison and verification planning to remain policy-gated and evidence-backed, so that a path is not marked fixed until a real verification event or current validation state proves closure.

As a release reviewer, I want PRD section 3.4 parsed directly by tests and linked to requirement atoms, so that broad graph/risk/remediation coverage cannot hide an unimplemented attack-path example class again.

## AI App Security Validation Source Coverage

Requirement labels: `SRC-3.5-AI-APP-VALIDATION`, `PRD-AIAPP-001`, `PRD-AIAPP-002`, `PRD-AIAPP-003`, `PRD-AIAPP-004`, `PRD-AIAPP-005`, `PRD-AIAPP-006`, `PRD-AIAPP-007`, `PRD-AIAPP-008`.

As an AI application owner, I want Periscan to register AI apps with endpoint, RAG/tool posture, guardrail context, owner, verified scope, and test-account handling notes, so that validation is bounded to authorized customer scope.

As a security engineer, I want every PRD AI risk category to be a first-class safe validation suite, so that prompt injection, RAG authorization, leakage, tool invocation, agent permissions, system prompt exposure, cross-tenant retrieval, guardrail drift, and AI security review evidence cannot be missed by broad labels.

As a tenant admin, I want AI validation to run through policy-gated safe Promptfoo, PyRIT, or similar harness handling with redacted evidence, so that AI testing does not embed harmful payloads or leak sensitive transcripts.

As a report consumer, I want AI App Validation Reports generated from normalized AI evidence and evidence IDs, so that AI security review proof is auditable and not raw harness output.

As a release reviewer, I want PRD section 3.5 parsed directly by tests and linked to requirement atoms, so that connector breadth or demo reports cannot hide missing AI validation outcomes, scope controls, redaction, or drift comparison.

## Fix Verification Source Coverage

Requirement labels: `SRC-3.6-FIX-VERIFICATION`, `PRD-FIXVER-001`, `PRD-FIXVER-002`, `PRD-FIXVER-003`, `PRD-FIXVER-004`, `PRD-FIXVER-005`, `PRD-FIXVER-006`, `PRD-FIXVER-007`, `PRD-FIXVER-008`.

As a remediation owner, I want external ticket closure to be tracked separately from Periscan verification evidence, so that a closed Jira or PSA ticket cannot make a risk look fixed without proof.

As a security engineer, I want Periscan to select targeted retest modules based on the remediated path, exposure, control, or AI app context, so that verification tests the actual risk that was remediated.

As a security leader, I want every fix verification outcome, state transition, evidence ID, and retest method recorded in verification events and reports, so that I can prove whether the fix worked.

As a release reviewer, I want PRD section 3.6 parsed directly by tests and linked to requirement atoms, so that broad remediation, ticketing, or report coverage cannot hide missing closed-without-evidence behavior again.

## Evidence Packs Source Coverage

Requirement labels: `SRC-3.7-EVIDENCE-PACKS`, `PRD-EVPACK-001`, `PRD-EVPACK-002`, `PRD-EVPACK-003`, `PRD-EVPACK-004`, `PRD-EVPACK-005`, `PRD-EVPACK-006`, `PRD-EVPACK-007`, `PRD-EVPACK-008`.

As a security leader, I want role-specific Evidence Packs generated from normalized validation evidence, so that executives, customers, auditors, insurers, MSSPs, and technical teams receive proof formatted for their needs without raw scanner dumps.

As a report consumer, I want every Evidence Pack to include evidence IDs and redaction posture, so that conclusions remain auditable and sensitive details are not exposed in the primary report.

As an MSSP administrator, I want Evidence Packs to support tenant branding and white-label report footers, so that client-facing reports can be delivered under approved partner branding while preserving Periscan evidence IDs and safety notes.

As an API customer replacing the UI, I want Evidence Packs to export as HTML and PDF through stable API routes, so that reports can be embedded, downloaded, or distributed by my own systems.

As a release reviewer, I want PRD section 3.7 parsed directly by tests and linked to requirement atoms, so that broad report-template history cannot hide missing pack types, redaction rules, export support, or white-label behavior again.

## Pricing and Metering Source Coverage

Requirement labels: `SRC-17-PRICING-METERING`, `PRD-BILLING-001`, `PRD-BILLING-002`, `PRD-BILLING-003`, `PRD-BILLING-004`, `PRD-BILLING-005`.

As a tenant administrator, I want billing package metadata to show Periscan’s public pricing language without exact prices or payment processor details, so that customers understand the packaging model without the product publishing commercial terms prematurely.

As a customer API user replacing the UI, I want every PRD metering unit exposed through stable `/api/v1/billing/*` endpoints, so that usage, package entitlement, API usage, runner usage, evidence workflows, retention, and MSSP client usage can be consumed outside the first-party UI.

As a platform operator, I want the retention metering unit to be grounded in configured evidence-retention policy rather than hidden in Trust & Safety copy, so that the PRD meter list is complete and auditable.

As a release reviewer, I want PRD section 17 parsed directly by tests and linked to requirement atoms, so that billing endpoint existence cannot hide missing package labels or metering units again.

## Build Phases Source Coverage

Requirement labels: `SRC-18-BUILD-PHASES`, `PRD-PHASE-001`, `PRD-PHASE-002`, `PRD-PHASE-003`, `PRD-PHASE-004`, `PRD-PHASE-005`, `PRD-PHASE-006`.

As a release reviewer, I want every PRD Build Phase header, build bullet, and exit criterion parsed directly from source, so that roadmap history or broad completion claims cannot skip a phase.

As an API customer replacing the UI, I want the Foundation and Validation Snapshot phases mapped to stable API, worker, evidence, graph, report, policy, integration, and module surfaces, so that the proof loop is not tied to the first-party web app.

As a security engineer, I want AI app validation, control validation, and fix verification phase coverage tied to safe modules, redacted evidence, control observers, tickets, verification events, and reports, so that phase completion means evidence-backed behavior exists.

As an enterprise or MSSP operator, I want runner, continuous validation, operator, tenant hierarchy, SSO/SCIM, audit export, white-label, and private-runner surfaces mapped to tests, so that later enterprise readiness reviews do not rely on prose-only roadmap status.

## Codex Master Instruction Source Coverage

Requirement labels: `SRC-20-CODEX-MASTER-INSTRUCTION`, `PRD-CODEXMASTER-001`, `PRD-CODEXMASTER-002`, `PRD-CODEXMASTER-003`, `PRD-CODEXMASTER-004`, `PRD-CODEXMASTER-005`, `PRD-CODEXMASTER-006`.

As a coding agent working in Periscan, I want the standing product outcome and tagline checked against source docs, so that implementation slices keep optimizing for validation and proof instead of adjacent scanner output.

As a platform architect, I want the OSS-as-internal-engines philosophy mapped to module, policy, evidence, connector, and report surfaces, so that adding tools does not expose OSS plumbing as the product.

As a release reviewer, I want the section 20 safety and engineering bullets parsed directly by tests, so that AGENTS.md existence, broad security tests, or green validation cannot hide a missing standing rule.

As a replacement-UI/API customer, I want the prescribed stack and API-first ownership boundaries preserved, so that Periscan remains automatable through public APIs and not locked to the first-party UI.

## Codex Implementation Tickets Source Coverage

Requirement labels: `SRC-21-CODEX-TICKETS`, `PRD-TICKET-001`, `PRD-TICKET-002`, `PRD-TICKET-003`, `PRD-TICKET-004`, `PRD-TICKET-005`, `PRD-TICKET-006`.

As a release reviewer, I want every PRD Codex implementation ticket number, title, and acceptance block parsed directly from source, so that implementation history cannot hide a missing ticket or acceptance criterion.

As an API customer replacing the UI, I want tickets 1 through 12 mapped to stable API, schema, database, policy, connector, module, worker, evidence, graph, and Snapshot surfaces, so that the foundation proof loop is not tied to the first-party web app.

As a security engineer validating the proof loop, I want tickets 13 through 24 mapped to connectors, safe validation modules, attack-path correlation, risk scoring, remediation, verification, reporting, and API-backed UI evidence, so that the first product moment remains evidence-backed.

As an enterprise or MSSP operator, I want tickets 25 through 40 mapped to AI app validation, control validation, ATT&CK mapping, runner, recurring validation, evidence packs, MSSP, billing, trust, audit, demo, and E2E evidence, so that later platform breadth cannot be claimed from prose-only ticket status.

## First Sellable MVP Source Coverage

Requirement labels: `SRC-19-FIRST-MVP`, `PRD-MVP-001`, `PRD-MVP-002`, `PRD-MVP-003`, `PRD-MVP-004`.

As a security engineer evaluating Periscan, I want to complete the first sellable MVP flow through public APIs, so that I can create an account, verify a domain, connect GitHub and AWS, optionally register an AI app, run a safe Snapshot, create remediation, verify the fix, and export proof without depending on a fixed UI.

As an AI product owner in the MVP onboarding flow, I want optional AI app registration to be included in the default Validation Snapshot package, so that AI app context can be captured before safe AI validation is separately approved and executed.

As an executive or customer-review audience, I want the MVP report to show 3-5 evidence-backed paths plus controls, AI risks, remediation, verification plan, and evidence appendix, so that the output is a proof report rather than a scanner dump.

As a release reviewer, I want PRD section 19 parsed directly by tests, so that Snapshot/demo/E2E existence cannot hide missing onboarding steps, package entitlements, report sections, result counts, or success-signal copy again.

## First Demo Story Source Coverage

Requirement labels: `SRC-22-DEMO-STORY`, `PRD-DEMO-001`, `PRD-DEMO-002`, `PRD-DEMO-003`, `PRD-DEMO-004`.

As a first customer evaluating Periscan, I want the first demo to tell one evidence-backed repo-secret-to-cloud story, so that I can see Periscan find the path, validate the risk, and prove the follow-up state without scanning-dashboard noise.

As a security engineer running the proof loop through APIs, I want the demo story to create a remediation, run a targeted retest, and return `Fixed` or `StillExposed`, so that the product never treats `Inconclusive` as the first proof-loop verdict.

As a report consumer, I want the demo story evidence pack to include redacted evidence IDs for the repo secret, cloud access, missed control, path breaker, remediation, and verification plan, so that the report is proof-backed and does not leak raw secrets.

As a release reviewer, I want PRD section 22 parsed directly by tests, so that broad demo data, Snapshot, remediation, or report coverage cannot hide a missing story beat again.
