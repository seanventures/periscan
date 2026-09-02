# Periscan Acceptance Criteria

## Product Meta Source Coverage

Requirement labels: `SRC-0-META`, `PRD-META-001`, `PRD-META-002`, `PRD-META-003`, `PRD-META-004`, `PRD-META-005`.

Given the long-form PRD preamble defines Product Name, Product Category, Core Product Promise, One-Sentence Product Definition, and Founder / Market Context, when source coverage tests run, then each heading and value must be parsed directly from source.

Given product identity is audited, when root docs, package metadata, app metadata, home page, and API reference copy are inspected, then Periscan name/category/promise/definition must be present without relying on implementation history.

Given the one-sentence product definition is audited, when public docs and app metadata are inspected, then they must include both validation scope and proof output rather than only listing validation domains.

Given founder and Frost-report market context are audited, when public docs, app metadata, public demo, and report source are inspected, then internal strategy tokens must not appear in those public product surfaces.

Given a full-product completion claim is attempted, when `pnpm prd:audit:strict` runs, then product-meta coverage alone must not close unrelated source rows or partial atoms if any exist.

## Product Vision Source Coverage

Requirement labels: `SRC-1-VISION`, `PRD-VISION-001`, `PRD-VISION-002`, `PRD-VISION-003`, `PRD-VISION-004`, `PRD-VISION-005`, `PRD-VISION-006`.

Given the long-form PRD section 1 defines Product Vision, when source coverage tests run, then the validation/proof-layer claim, six customer questions, continuous-validation domains, anti-scanner/pentest/BAS statement, and third-party proof gate must be parsed directly from source.

Given the six Product Vision questions are audited, when API/backend/report source is inspected, then findings, attack paths, control validation, remediation, fix verification, evidence, reports, and Snapshots must map to concrete public API routes and services.

Given continuous validation domains are audited, when source coverage tests inspect schedules, shared contracts, runtime services, controls, AI apps, and remediations, then exposure, controls, attack paths, AI applications, remediation outcomes, reopened-state behavior, and repeatable validation surfaces must be present.

Given primary UX and reports are audited, when the findings page, navigation, reports, public demo, and security boundaries are inspected, then the product must present validated results, evidence-backed paths, control verdicts, remediation, verification, and evidence packs rather than raw scanner output as the main experience.

Given a newly proposed third-party validation tool is audited, when certification/governance source is inspected, then reviewed catalog metadata, module/capability implementation, required evidence, tenant governance, runtime readiness, runner prerequisites, policy gates, safety boundaries, and API-visible certification reports must be present before governed use.

Given a full-product completion claim is attempted, when `pnpm prd:audit:strict` runs, then Product Vision coverage alone must not close unrelated source rows or partial atoms if any exist.

## System Architecture Source Coverage

Requirement labels: `SRC-4-ARCHITECTURE`, `PRD-ARCH-001`, `PRD-ARCH-002`, `PRD-ARCH-003`, `PRD-ARCH-004`, `PRD-ARCH-005`, `PRD-ARCH-006`.

Given the long-form PRD section 4 defines high-level architecture components, when source coverage tests run, then SaaS Control Plane, API Connectors, External Point of Attack, Internal Runner, and Evidence Graph must be parsed directly from source.

Given SaaS Control Plane responsibilities are audited, when architecture coverage tests inspect API, service, and Prisma files, then tenant/user management, integrations, validation missions, evidence graph, attack paths, control validation, AI app validation, remediation, fix verification, reporting, billing/metering, and audit logs must map to concrete implementation evidence.

Given API Connector categories are audited, when connector source is inspected, then cloud, identity, SaaS-adjacent, code, EDR/XDR, SIEM, SOAR/ITSM, WAF/firewall, ticketing, AI stack, VM/EAP/ASM/CNAPP, and MSSP/PSA/RMM capabilities must map to marketplace categories, connector factories, and manifest permission/capability metadata.

Given External Point of Attack behavior is audited, when module, scope, and policy source is inspected, then safe external modules must require verified scope, use safe template/profile or non-invasive DNS/TLS/HTTP checks, and expose rate/resource boundaries before execution.

Given Internal Runner architecture is audited, when runner API/code/docs are inspected, then the runner must be outbound-only, signed-task based, locally scope-enforced, kill-switch controlled, and evidence-upload capable, with no reverse SSH or arbitrary shell assumption.

Given Evidence Graph is audited, when shared schemas, Prisma models, graph services, correlation, and reports are inspected, then every PRD system-of-record bullet must map to durable contracts or an explicit implementation alias such as permissions through permission summaries, identity roles/groups, repo-permission signals, and open graph node types.

Given full-product completion is claimed, when `pnpm prd:audit:strict` runs, then architecture coverage alone must not hide unresolved source rows or partial atoms.

## Recommended Tech Stack Source Coverage

Requirement labels: `SRC-5-TECH-STACK`, `PRD-TECH-001`, `PRD-TECH-002`, `PRD-TECH-003`, `PRD-TECH-004`, `PRD-TECH-005`, `PRD-TECH-006`, `PRD-TECH-007`.

Given the long-form PRD section 5 defines recommended stack bullets, when source coverage tests run, then the monorepo, frontend, backend, worker, runner, evidence-store, graph, and Codex build-model bullets must be parsed from source.

Given the monorepo structure is audited, when source coverage tests inspect the filesystem and workspace config, then `apps/web`, `apps/api`, `apps/worker`, `apps/runner`, `packages/shared`, `packages/db`, `packages/policy`, `packages/evidence`, `packages/connectors`, `packages/modules`, `packages/reports`, `packages/risk`, `packages/operators`, `infra/docker-compose`, and `infra/terraform` must exist.

Given the frontend stack is audited, when package and App Router files are inspected, then Next.js, TypeScript, Tailwind, TanStack Query, shared Zod schemas, and the Periscan API client must be present and wired through a real provider or package contract.

Given the backend and worker stack is audited, when package, Prisma, Compose, worker, evidence, and graph files are inspected, then Fastify, Prisma/Postgres, Redis/BullMQ, local MinIO/S3-compatible storage, raw evidence hashing/redaction, and Postgres graph nodes/edges must be present.

Given the runner stack is audited, when runner files are inspected, then Go 1.22+, outbound-only behavior, mTLS client-certificate authentication, signed task envelopes, local scope enforcement, and local audit behavior must be visible.

Given a full-product completion claim is attempted, when `pnpm prd:audit:strict` runs, then tech-stack coverage must not hide unresolved source rows or partial atoms.

## Real-First Existing-Codebase Source Coverage

Requirement labels: `SRC-25-REAL-FIRST-ADDENDUM`, `PRD-REALFIRST-001`, `PRD-REALFIRST-002`, `PRD-REALFIRST-003`, `PRD-REALFIRST-004`, `PRD-REALFIRST-005`, `PRD-REALFIRST-006`.

Given the long-form PRD section 25 defines the Real-First addendum, when source coverage tests run, then the repository-preservation, product-visible-data, fixture/demo, honest-status, no-fake-outcome, and platform-priority statements must be parsed from source.

Given production or non-dev API/runtime paths receive fixture or mock targets, when policy, worker, integration, scope, control, or mission guards run, then they must deny the request before persistence, queueing, or evidence creation.

Given a mock/demo validation module exists for tests, when the production module registry or catalog is inspected, then mock/demo modules must not be present in the shipping registry.

Given a public demo or sample report renders, when a user or API client views it, then the content must be clearly labeled as sample/demo data and not real customer proof.

Given a capability lacks credentials, verified scope, runner, approval, or implementation, when API/UI surfaces render it, then the response must use an honest unavailable state rather than fabricated evidence or positive verdicts.

Given platform priorities are reviewed, when source coverage tests run, then validated findings, BAS/control validation, risk prioritization, revalidation, detection validation, signal triggers, executive evidence reporting, better-together UX, and Threat Center must map to API-first product surfaces or child source-derived tests.

## Definition of Done for V1 Source Coverage

Requirement labels: `SRC-23-DOD-V1`, `PRD-DOD-001`, `PRD-DOD-002`, `PRD-DOD-003`, `PRD-DOD-004`, `PRD-DOD-005`.

Given the long-form PRD section 23 lists V1 Definition of Done bullets, when DoD source coverage tests run, then every bullet must be parsed exactly and mapped to code/test evidence.

Given a first-customer tenant uses the API, when the acceptance or E2E proof loop runs, then the tenant can sign up, verify scope, connect GitHub and AWS, run a Validation Snapshot, receive 3-5 evidence-backed paths, create remediation, and run fix verification.

Given a fix-verification event is created, when a report is generated and exported after that verification, then the exported report must include the latest verification outcome and remediation verification plan from normalized evidence.

Given validation is attempted, when policy or scope prerequisites are missing, then validation must be denied or gated before queueing and must write auditable policy events.

Given demo or design-partner mode is used, when sample/demo content renders, then it must be clearly isolated from real tenant proof and must not include raw secrets.

Given full-product completion is claimed, when the PRD audit gate runs in strict mode, then V1 DoD coverage alone must not pass while unrelated source rows or partial atoms remain unresolved.

## Final Build Rule Source Coverage

Requirement labels: `SRC-24-FINAL-BUILD-RULE`, `PRD-FINAL-001`, `PRD-FINAL-002`, `PRD-FINAL-003`, `PRD-FINAL-004`.

Given the long-form PRD section 24 contains the final build rule, when source coverage tests run, then the exact ordered loop must parse as connect, validate, evidence, fix, verify, and report.

Given the product is API-first, when final-build-rule tests inspect API route registration, then every loop stage must have a public API surface for integrations/sync, Snapshot validation, evidence retrieval, remediation creation, fix verification, report creation, and report export.

Given the first-customer API acceptance flow runs, when the proof loop is executed, then integration connection must occur before validation, validation must produce evidence before remediation, remediation must be verified, and report creation/export must happen after verification evidence exists.

Given a full-product completion claim is attempted, when the PRD audit gate runs, then final-build-rule coverage alone must not close `PRD-COMPLETE-001` while unrelated source rows or partial atoms remain unresolved.

## UX Requirements Source Coverage

Requirement labels: `SRC-15-UX`, `PRD-UX-001`, `PRD-UX-002`, `PRD-UX-003`, `PRD-UX-004`.

Given the long-form PRD section 15.1 lists main navigation items, when source coverage tests run, then every listed item must appear in `APP_NAV_ITEMS` and every static first-party page remains represented in the route contract.

Given the first-party shell renders the primary navigation, when a user opens any static product route, then exactly one route is current, the PRD navigation labels are visible, and the page remains reachable through the shared shell.

Given the long-form PRD section 15.2 lists Dashboard cards, when the Dashboard renders for an authenticated tenant, then Top validated exposure paths, Controls that missed validation, AI apps with failed checks, Fixes awaiting re-test, Risk reduced this month, and Evidence packs ready render from API-backed tenant state.

Given no direct metric is available for a card, when the Dashboard renders, then the card must show an honest zero/not-measured value from available API state rather than fabricated data.

Given section 15.3 lists status badges, when shared UI tests run, then Validated, Blocked, Detected, Missed, Mitigated, Fixed, Reopened, and Needs Review render through the shared `StatusPill` vocabulary.

Given section 15.4 lists the Snapshot flow, when the workspace loads, then Define scope, Connect systems, Run validation, Review report, Create remediation, Verify fix, and Export evidence appear as the visible Snapshot flow while the underlying controls remain API-backed and policy/evidence gated.

## Product Modules Parent Source Coverage

Requirement labels: `SRC-3-MODULES`, `PRD-MODULES-001`, `PRD-MODULES-002`.

Given the long-form PRD section 3 lists product module subsections, when product-module source coverage tests run, then every subsection heading maps to a child `SRC-3.*` source coverage row.

Given a child Product Modules row exists, when the parent Product Modules row is marked complete, then each child row must be `EvidenceMapped` with a dedicated source-derived test or explicit approved evidence.

Given section 3 changes, when module tests run, then the parsed PRD heading list must match the expected source row mapping so additions, removals, or renames cannot silently pass.

## Reports Source Coverage

Requirement labels: `SRC-16-REPORTS`, `PRD-REPORT-001`, `PRD-REPORT-002`.

Given the long-form PRD section 16.1 lists Validation Snapshot Report sections, when report source coverage tests run, then Executive Summary, Priority Attack Paths, Control Verdicts, AI App Validation, Remediation Priorities, Verification Plan, Evidence Appendix, and Methodology and Safety Notes render in both HTML and PDF output.

Given a Validation Snapshot report is rendered, when a customer reads the primary report, then the customer-facing labels match the PRD and do not expose implementation-internal labels such as old control-observation or AI-risk headings.

Given section 16.2 lists audience variants, when report source coverage tests run, then Executive, Security Team, GRC, Customer Review, Auditor, Cyber Insurance, MSSP Client, and Technical Appendix each map to an API-stable rendered report template.

Given an API customer supplies an audience, when HTML or PDF reports are generated, then the audience remains visible in the report while the evidence comes from the normalized Snapshot payload and evidence IDs.

## Continuous Exposure Source Coverage

Requirement labels: `SRC-3.2-CONTINUOUS-EXPOSURE`, `PRD-CONTEXP-001`, `PRD-CONTEXP-002`, `PRD-CONTEXP-003`, `PRD-CONTEXP-004`, `PRD-CONTEXP-005`, `PRD-CONTEXP-006`.

Given the long-form PRD section 3.2 lists coverage areas, when module tests run, then external assets, cloud resources, identity paths, SaaS posture, code/secrets, containers, Kubernetes, internal exposure, AI apps, VM/EAP vulnerability context, and CAASM/ASM asset context map to real connector, module, scope, or acceptance surfaces.

Given section 3.2 lists validation states, when shared schema tests and source coverage tests run, then Discovered, Reachable, Validated, Exploitable, Detected, Blocked, Mitigated, Inconclusive, Fixed, and Reopened exist in the public `ValidationStateSchema`.

Given a tenant creates recurring validation, when `/api/v1/schedules` is used, then schedules require verified scope, support `ContinuousValidation`, can be paused/resumed/run manually, can be run when due, and are also driven by the system validation sweep.

Given a scheduled validation has a prior Snapshot, when the current run changes path state or risk, then `ScheduleDiffSchema` reports added/removed/reopened paths, risk delta, status, and summary.

Given a previously fixed path returns in a scheduled run, when the schedule diff runs, then the path/remediation move to `Reopened` and a verification event records the regression without claiming measured revalidation.

Given a customer reviews the unified results API or UI, when a result is theoretical or inferred, then `evidenceBasis`, `sourceMotion`, `validationState`, and `evidenceIds` let clients distinguish it from validated risk.

Given CTEM-style reporting is requested, when `/api/v1/ctem/program` or a CTEM report template renders, then the stages are Scope, Discover, Prioritize, Validate, Mobilize, and Verify.

## Control Validation Source Coverage

Requirement labels: `SRC-3.3-CONTROL-VALIDATION`, `PRD-CONTROL-001`, `PRD-CONTROL-002`, `PRD-CONTROL-003`, `PRD-CONTROL-004`, `PRD-CONTROL-005`, `PRD-CONTROL-006`.

Given the long-form PRD section 3.3 lists control categories, when module tests run, then each category maps to a control-source enum, connector-observer capability, logging/SIEM surface, workflow destination, or response-routing surface.

Given section 3.3 lists control outcomes, when shared schema and source coverage tests run, then Detected, Blocked, Logged, Alerted, Routed, Missed, NoEvidence, and NeedsTuning remain public validation and detection-rule values.

Given a tenant validates a control source, when `/api/v1/control-sources/:id/validate` is called, then Periscan uses dry-run control validation by default, classifies observer evidence into control outcomes, and does not accept caller-supplied fixture verdicts outside dev/test mode.

Given control scenarios are listed, when `/api/v1/control-sources/validation-scenarios` is called, then scenarios include MITRE ATT&CK technique IDs, expected behaviors, prohibited behaviors, dry-run-only defaults, and `atomic.control_validation_safe` module metadata.

Given a control source has no telemetry and then later has logged observer evidence for the same ATT&CK scenario, when rule coverage summaries are generated before and after, then status changes from `NotTested` to `LoggedOnly`, evidence IDs appear only after evidence exists, and the recommendation tells the customer to tune alert routing.

Given a customer reviews control validation in API or UI, when rule coverage or history is returned, then evidence IDs, signal IDs, observed sources, technique IDs, statuses, and tuning recommendations are present without presenting raw scanner or log dumps as the primary experience.

## Product Principles Source Coverage

Requirement labels: `SRC-2-PRINCIPLES`, `PRD-PRINCIPLES-001`, `PRD-PRINCIPLES-002`, `PRD-PRINCIPLES-003`, `PRD-PRINCIPLES-004`, `PRD-PRINCIPLES-005`, `PRD-PRINCIPLES-006`.

Given the long-form PRD section 2.1 lists what Periscan should show, when module tests run, then validated exposure, attack paths, control verdicts, remediation actions, verification status, and evidence packs map to normalized Snapshot/report/UI surfaces.

Given raw tool output belongs only in a technical appendix, when primary navigation and report sections are inspected, then first-party product surfaces label the stable findings API as `Validated Results` / evidence-backed results and reports keep raw scanner output out of the primary experience.

Given AI should help Periscan choose validation, correlate signals, explain paths, prioritize and write remediation, re-test fixes, and generate evidence, when Product Principles tests run, then operator profiles and model-gateway tools map to each workflow without executing actions inline.

Given AI output must be evidence-grounded, when summaries are generated with evidence artifacts, then every claim cites evidence IDs; when no evidence exists, the summary states that normalized evidence is insufficient.

Given PRD section 2.4 lists safety rules, when Product Principles tests run, then verified scope, non-destructive/no-exfil/no-persistence/no-credential-theft/no-uncontrolled-chaining/no-unauthorized-third-party boundaries, approvals, audit events, fixture/test boundaries, and kill switch behavior all map to policy, runner, scope, and security test evidence.

Given section 2.5 lists the expansion path, when Product Principles tests run, then Validation Snapshot, Continuous Validation, Control Validation, AI App Validation, Fix Verification, Evidence Packs, Internal Runner, and MSSP/Enterprise scale map to public API surfaces.

## Validation Snapshot Source Coverage

Requirement labels: `SRC-3.1-VALIDATION-SNAPSHOT`, `PRD-SNAPSHOT-001`, `PRD-SNAPSHOT-002`, `PRD-SNAPSHOT-003`, `PRD-SNAPSHOT-004`, `PRD-SNAPSHOT-005`, `PRD-SNAPSHOT-006`.

Given the long-form PRD section 3.1 lists Snapshot inputs, when module tests run, then every input maps to an API-visible scope type, connector category, AI app/control source contract, SaaS catalog surface, or optional internal runner contract.

Given a tenant has no verified scope, when it requests a Validation Snapshot, then the API returns a verified-scope error instead of queueing validation or fabricating output.

Given a tenant runs a Validation Snapshot, when the Snapshot payload is generated, then the displayed top paths are capped at 5 and the output remains focused on evidence-backed results rather than raw scanner findings.

Given a Snapshot includes top paths, when the payload and report are inspected, then every displayed top path has evidence IDs and a corresponding remediation priority with a verification method.

Given a Snapshot report is exported, when HTML or PDF output is requested, then the report is generated from normalized Snapshot data and includes top validated paths, control observations, AI app risks where present, remediation priorities, verification plan, evidence appendix/summary, methodology, and technical appendix content without raw secrets.

## PRD Audit Protocol

Requirement labels: `PRD-AUDIT-001`, `PRD-AUDIT-002`, `PRD-AUDIT-003`, `PRD-COMPLETE-001`, `PRD-ReleaseTraceability`.

Given an agent audits feature completion, when the agent reads status, traceability, or passing test results, then the agent must still audit `PRD.md` and `docs/PERISCAN_FULL_PRODUCT_PRD.md` directly and produce source-first PRD requirement atoms before claiming the full product is complete.

Given an agent audits feature completion, when a major source PRD section is missing from `docs/PRD_SOURCE_COVERAGE_LEDGER.md`, then the agent must add the source section before reading implementation-status tables as completion evidence.

Given a source section is marked `SectionIndexed` or `NeedsImplementationAudit`, when a release report is written, then the report must not claim that section or the full PRD is complete until detailed atoms are mapped in `docs/PRD_REQUIREMENT_LEDGER.md`.

Given a PRD source sentence contains multiple verbs or durable states, when it is added to the audit ledger, then each verb/state is split into a separate atom with implementation files, tests, status, and residual gaps.

Given a requirement has a framework implementation but lacks a required API, durable state, audit history, activity surface, policy gate, UI behavior, or test, when the ledger is updated, then the requirement remains `Partial` instead of `Implemented`.

Given `docs/PRD_REQUIREMENT_LEDGER.md` has any `Partial`, `NotStarted`, or `Unknown` rows, when a release report is written, then the report must not claim the full product or all PRD features are complete.

Given a slice changes scheduler, persistence, public API, security-boundary, or shared runtime behavior, when focused tests pass, then the release reviewer must still run the broader release gate and treat accumulated-state or concurrency failures as defects to fix or explicitly block before claiming the slice complete.

Given `pnpm verify` runs, when it reaches the PRD audit gate, then `pnpm prd:audit` reports unresolved source sections and requirement atoms and fails if the audit protocol, source coverage ledger, or scoped first-customer readiness wording is missing.

Given any source section remains `SectionIndexed` or `NeedsImplementationAudit` or any requirement atom remains `Partial`, `NotStarted`, or `Unknown`, when `pnpm prd:audit:strict` runs, then it must fail and block any full-product completion claim.

## OSS Acceleration Plan Source Coverage

Requirement labels: `SRC-10-OSS-PLAN`, `SRC-10.1-INITIAL-ENGINES`, `SRC-10.2-OSS-POLICY`, `PRD-OSS-001`, `PRD-OSS-002`, `PRD-OSS-003`, `PRD-OSS-004`.

Given the long-form PRD section 10.1 lists an initial OSS engine, when module tests run, then that engine maps to reviewed toolchain metadata, at least one capability, and one or more module manifests.

Given an OSS engine is legal-review, deferred, or non-live by policy, when module tests run, then the tool or module remains blocked, deferred, content/import-only, or approval-gated rather than advertised as unrestricted live execution.

Given the long-form PRD section 10.2 lists OSS policy bullets, when module tests run, then every bullet maps to automated license, sandbox, parser/output, normalized-evidence, and no-raw-primary-report evidence.

## Policy and Safety Engine Source Coverage

Requirement labels: `SRC-11-POLICY-SAFETY`, `PRD-POL-001`, `PRD-POL-002`, `PRD-POL-003`, `PRD-POL-004`.

Given the long-form PRD section 11.1 lists policy inputs, when module tests run, then each input maps to `PolicyEvaluationInputSchema` or the persisted policy-decision contract.

Given the long-form PRD section 11.2 lists policy outputs, when module tests run, then each output exists in `PolicyDecisionOutcomeSchema` and is reachable through deterministic evaluator scenarios.

Given the long-form PRD section 11.3 lists safety rules, when module tests run, then verified-scope, safety-level, unsafe-action, internal-runner, time-window, and stricter tenant-policy behavior are all exercised.

Given the long-form PRD section 11.4 says every policy decision creates an audit event, when module tests run, then the API validation service must still persist `policy.decision` audit events when policy decisions are created or blocked.

## Evidence Graph Source Coverage

Requirement labels: `SRC-12-EVIDENCE-GRAPH`, `PRD-GRAPH-001`, `PRD-GRAPH-002`, `PRD-GRAPH-003`, `PRD-GRAPH-004`.

Given the long-form PRD section 12.1 lists graph nodes, when module tests run, then each node is representable through `GraphNodeSchema` and the Postgres `GraphNode` model supports durable node type/key/properties/evidence fields.

Given the long-form PRD section 12.2 lists graph edges, when module tests run, then each relationship exists in shared and Prisma edge relationship enums.

Given the long-form PRD section 12.3 lists required graph questions, when module tests run, then graph service primitives exercise reachability, identity access, secret-to-cloud-role paths, control missed/detected semantics, highest-impact path ranking, path breaker evidence, closed-without-proof state, and reopened state.

Given Evidence Graph completion is reviewed, when `SRC-12-EVIDENCE-GRAPH` remains unmapped or the source regression fails, then the product cannot claim Evidence Graph completion.

## Risk Scoring Source Coverage

Requirement labels: `SRC-13-RISK-SCORING`, `PRD-RISK-001`, `PRD-RISK-002`, `PRD-RISK-003`, `PRD-RISK-004`.

Given the long-form PRD section 13.1 lists scoring inputs, when module tests run, then every parsed input maps to `RiskScoreInputSchema` or an explicit implementation alias.

Given the long-form PRD section 13.2 defines `Real Risk`, when module tests run, then calculated risk output includes factors for attack feasibility, business impact, control failure, confidence, and threat relevance.

Given the long-form PRD section 13.3 lists risk modifiers, when module tests run, then blocked scores below detected, detected scores below missed, reopened scores above validated, sensitive data and privileged paths increase score, and inconclusive lowers score.

Given remediation status says `Fixed` without verification evidence, when risk is calculated, then the risk band must not be `Fixed`; only `validationState: Fixed` or `verificationStatus: Fixed` may produce the fixed band.

## Runner Source Coverage

Requirement labels: `SRC-14-RUNNER`, `PRD-RUNNER-001`, `PRD-RUNNER-002`, `PRD-RUNNER-003`, `PRD-RUNNER-004`, `PRD-RUNNER-005`, `PRD-RUNNER-006`.

Given the long-form PRD section 14.2 lists runner deployment modes, when module tests run, then Docker, Linux service, Kubernetes, and future Windows deployment contracts must map to runner schemas and deployment artifacts.

Given PRD section 14.3 requires outbound-only runner security, when module tests run, then the current runner transport must be outbound HTTPS signed-task polling and must explicitly reject or omit inbound firewall rules, reverse SSH, arbitrary tunnels, and arbitrary shell execution.

Given PRD section 14.3 and 14.4 mention mTLS and runner certificates, when audit ledgers and tests run, then `PRD-RUNNER-003` must remain `Implemented` only while registration/rotation issue runner client certificates from CSRs, the API stores certificate fingerprints, runner calls can be gated by forwarded certificate fingerprint, and outbound signed-task polling remains unchanged.

Given PRD section 14.3 lists signed tasks, signed modules, local scope, resource limits, timeouts, local audit logs, and kill switch requirements, when runner coverage tests run, then shared schemas, API services, and Go runner tests must prove signed envelopes, module allowlists, local scope checks, nonce replay rejection, timeouts, local audit hashes, evidence manifests, and kill-switch behavior.

Given PRD section 14.4 lists the runner lifecycle, when route and source-coverage tests run, then runner creation, short-lived registration token generation, registration, credential issuance, signed task polling, local verification, execution, evidence upload, result submission, and audit logging must map to API routes/services and tests.

## Signal Fabric Source Coverage

Requirement labels: `SRC-8-SIGNAL-FABRIC`, `PRD-SF-001`, `PRD-SF-002`, `PRD-SF-003`, `PRD-SF-004`.

Given the long-form PRD section 8 lists integration categories, when module tests run, then every parsed category item maps to connector catalog evidence or an explicit platform surface.

Given the PRD section 8.2 lists MVP integrations, when module tests run, then AWS, GitHub, Slack/Jira, mock EDR, mock SIEM, verified domain/external validation, and AI app endpoint registration are all represented.

Given the PRD section 8.3 lists V1 integrations, when module tests run, then Azure, GCP, Entra ID, Okta, Google Workspace, GitLab, CrowdStrike, Splunk, Microsoft Sentinel, ServiceNow, Cloudflare, OpenAI/Azure OpenAI, and AWS Bedrock are represented in the API-first connector catalog.

Given a connector appears in the Signal Fabric catalog, when module tests run, then catalog manifests continue to expose signal, control-observation, validation, workflow, sensitivity, and health metadata.

## Module Registry Source Coverage

Requirement labels: `SRC-9-MODULE-REGISTRY`, `PRD-MOD-001`, `PRD-MOD-002`, `PRD-MOD-003`.

Given the long-form PRD section 9.1 lists a module manifest field, when module tests run, then `ModuleManifestSchema` and every registered module manifest expose the mapped implementation field.

Given the long-form PRD section 9.2 lists safety levels 0 through 5, when module tests run, then each level maps to a `SafetyLevelSchema` enum value.

Given registered modules declare safety levels, when module tests run, then every declared value belongs to the shared safety enum and the registry uses implemented levels 0 through 4 where relevant.

## Data Model Source Coverage

Requirement labels: `SRC-6-DATA-MODEL`, `PRD-DATA-001`, `PRD-DATA-002`, `PRD-DATA-003`, `PRD-DATA-004`.

Given the long-form PRD section 6 lists a core entity, when module tests run, then a shared Zod schema and Prisma model for that entity must be present.

Given the long-form PRD section 6 lists a field under a core entity, when module tests run, then that field must be represented in both the shared schema and Prisma model either directly or through an explicit audited alias.

Given a PRD field uses an implementation alias, when the alias is inspected, then the alias must be declared in `tests/modules/prd-data-model-coverage.test.ts` and documented in the requirement ledger.

Given the long-form PRD section 6 lists scope types, when module tests run, then each scope type must exist in `ScopeTypeSchema` and Prisma `ScopeType`.

## API Specification Route Coverage

Requirement labels: `SRC-7-API-SPEC`, `PRD-API-001`, `PRD-API-002`, `PRD-API-003`, `PRD-API-004`, `PRD-API-First`.

Given the long-form PRD section 7 lists an API route, when the API OpenAPI document is generated, then the same `/api/v1` path and HTTP method must be present in generated OpenAPI or API tests fail.

Given a tenant user with mission edit rights has a queued or running validation mission, when they call `POST /api/v1/missions/:id/cancel`, then the mission, queued/running runs, queued/running jobs, and audit trail reflect `Cancelled`.

Given the worker receives a payload for a mission, run, or job already in a terminal state such as `Cancelled`, when processing starts, then it returns a skipped result without marking the run/job running or persisting fabricated evidence.

Given a tenant user with scope edit rights requests `POST /api/v1/attack-paths/:id/verify`, when a verified scope is available, then the API creates a draft, policy-gated verification mission and returns `queued: false` with `RequiresApproval`.

Given attack-path verification is requested, when the response is inspected, then it must not mark the path fixed, create validation runs, queue jobs, or claim evidence-backed verification before explicit approval and execution.

## Frontier Gateway Scope-Bound Context

Requirement labels: `SRC-3.X-FRONTIER-GATEWAY`, `PRD-FG-003`, `PRD-FG-004`, `PRD-FG-010`.

Given a Frontier Gateway session is bound to a verified scope, when the context broker builds a context bundle, then only assets matching the verified scope and linked exposures/attack paths are included.

Given the tenant has additional assets, exposures, or attack paths outside the session scope, when the model calls read-only tools such as `list_assets_in_scope` or `query_evidence_graph`, then the response excludes out-of-scope tenant data.

Given a model requests context for an asset outside the session scope, when `get_asset_context` executes, then the tool returns not found rather than exposing the asset.

## Third-Party Tool Promotion Certification History

Requirement labels: `PRD-ThirdPartyToolPromotionCertificationHistory`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

Given a tenant Owner/Admin has a promoted third-party tool package, when they request `POST /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications`, then Periscan computes the current certification report, persists a tenant-scoped snapshot with generated-by metadata, writes `third_party_tool.promotion_certified`, and returns the saved snapshot.

Given a certification snapshot is saved, when mission, job, install, runner task, or module execution state is inspected, then no enablement, install job, mission, runner dispatch, or module execution was created by the snapshot.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certifications`, when snapshots exist, then the API returns only that tenant's saved certification snapshots ordered newest first.

Given Registry Center displays a loaded promotion package, when the admin clicks `Save certification snapshot` or `Load certification history`, then the UI calls the certification history APIs and renders backend snapshot status, created timestamp, generated-by metadata, and no-side-effect boundary.

Given tenant A has saved a certification snapshot, when tenant B requests or attempts to generate snapshots for tenant A's promotion package, then tenant B receives not found and no cross-tenant certification, governance, runtime, runner, or package metadata is exposed.

## Third-Party Tool Promotion Certification

Requirement labels: `PRD-ThirdPartyToolPromotionCertification`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

Given a tenant Owner/Admin has a promoted third-party tool package, when they request `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/certification-report`, then the API returns a tenant-scoped certification report with status, checks, required actions, current governance status, runtime status, runner status, and certified-for-governance/runtime/mission/runner flags.

Given the certification report is generated, when mission, job, install, runner task, or module execution state is inspected, then no enablement, install job, mission, runner dispatch, or module execution was created by certification.

Given a promotion package is blocked, legal-review blocked, missing runtime readiness, missing runner prerequisites, or not tenant-enabled, when the certification report is generated, then the report shows `Blocked` or `NeedsAction` with explicit required actions instead of claiming the tool is usable.

Given Registry Center displays a loaded promotion package, when the admin clicks `Load certification report`, then the UI calls the certification API and renders the backend status, certified flags, checks, required actions, and read-only/no-side-effect boundary.

Given tenant A has a promotion package, when tenant B requests tenant A's certification report, then tenant B receives not found and no cross-tenant certification, governance, runtime, runner, or package metadata is exposed.

## Third-Party Tool Candidate Batch Import

Requirement labels: `PRD-ThirdPartyToolCandidateBatchImport`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`.

Given a tenant Owner/Admin submits `POST /api/v1/third-party-tools/intake/candidates/import` with a bounded manifest batch, when each manifest is valid and unique in the batch, then the API persists each item as a tenant-scoped tool candidate and returns `Submitted` item results with candidate IDs and validation reports.

Given a batch contains malformed or duplicate manifests, when import runs, then those items return `Failed` with item-level errors while other valid items can still be persisted.

Given a batch import succeeds or partially fails, when audit events are read, then Periscan exposes per-candidate `third_party_tool.intake_submitted` events and one `third_party_tool.candidate_batch_imported` event with submitted, failed, total, and tool ID metadata.

Given batch import runs, when mission, job, runner task, install-job, or module execution state is inspected, then no validation mission, queue job, install job, runner task, catalog entry, tenant enablement, or module execution was created by the import.

Given Registry Center imports batch manifest JSON, when the API response returns submitted and failed counts, then the UI renders the backend result, merges successful candidates into the API-backed backlog, and uses no UI-only candidate state.

## Third-Party Tool Due Refresh

Requirement labels: `PRD-ThirdPartyToolDueRefresh`, `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`.

Given a tenant Owner/Admin calls `POST /api/v1/third-party-tools/refresh-due`, when reviewed tools are due based on the requested refresh window, then the API creates tenant-scoped upstream-version checks and reviewed update recommendations for up to the requested batch limit.

Given a reviewed tool is disabled, deferred, or requires legal review, when due refresh runs with default options, then the tool is returned as skipped with explicit reason/actions and no install job, validation mission, runner task, or module execution is created.

Given a tool was checked within the requested refresh window, when due refresh runs, then the API returns `NotDue` for that tool with the latest persisted upstream/update artifacts instead of creating duplicate records.

Given Registry Center renders the toolchain, when an admin clicks `Refresh due tools`, then the UI calls the due-refresh API, renders the backend summary and per-tool statuses, and hydrates per-tool upstream/recommendation panels only from the API response.

## Third-Party Tool Runner Task Activity

Requirement labels: `PRD-ThirdPartyToolRunnerTaskActivity`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

Given a governed third-party tool dispatch creates a runner task, when a tenant admin requests `/api/v1/third-party-tools/:toolId/activity`, then the response includes a `RunnerTask` activity entry with task ID, module ID, runner ID, scope ID, task type, evidence count, status, and tenant/tool IDs.

Given runner task activity is returned, when the payload is serialized, then raw targets and credential material are not included in the activity metadata.

Given a runner task belongs to a module not associated with the requested tool, when the activity endpoint is called for that tool, then the unrelated task is excluded by tenant and module binding.

## Third-Party Tool Runner Dispatch UI

Requirement labels: `PRD-ThirdPartyToolRunnerDispatchUX`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

Given Registry Center has loaded a third-party tool runner eligibility report with at least one `dispatchable` capability, when the tenant admin enters runner ID, verified scope ID, target, and safe execution limits, then the UI submits `POST /api/v1/third-party-tools/:toolId/runner-dispatch` with the selected capability and does not create a UI-only task.

Given the dispatch API returns a signed runner task creation result, when the response is parsed, then Registry Center renders the persisted task status, task ID, mission ID, and run ID from the API response.

Given a tool has no dispatchable runner capabilities, when runner eligibility is displayed, then Registry Center shows the server-provided reasons and does not render dispatch submission controls.

Given the dispatch endpoint rejects a request, when Registry Center receives the error, then the UI surfaces the API error and the server remains responsible for tenant enablement, verified scope, policy decisions, kill switch, server allowlist, signed envelope, and audit enforcement.

## Third-Party Tool Promotion Governance Handoff

Requirement labels: `PRD-ThirdPartyToolPromotionHandoff`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

Given a tenant Owner/Admin has a readiness-satisfied promotion package, when they request `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:packageId/governance-handoff`, then the API returns a tenant-scoped handoff report with current governance status, runtime status, runner eligibility, exact next API actions, action statuses, execution side-effect flags, and policy-gate flags.

Given a promotion package is blocked, the tool is legal-review blocked, the tenant has disabled the tool, runtime readiness is missing, or runner prerequisites are absent, when the handoff report is generated, then the report shows the corresponding blocked or needs-action state without installing, enabling, queueing, dispatching, or executing the tool.

Given Registry Center displays a loaded promotion package, when the admin clicks `Load governance handoff`, then the UI calls the handoff API, renders the backend status/actions/API paths, and clearly labels actions that create execution and require policy gates.

Given tenant A has a promotion package, when tenant B requests tenant A's handoff endpoint, then tenant B receives not found and no cross-tenant package, governance, runtime, runner, or action metadata is exposed.

## Connector Health Truthfulness

Requirement labels: `PRD-ConnectorHealthTruthfulness`, `PRD-Real-First`, `PRD-SignalFabric`, `GAP-CONNECTOR-UNKNOWN-HEALTH-INTENTIONAL-001`.

Given Slack or Microsoft Teams is configured with an incoming webhook URL, when live `healthCheck` or `sync` runs, then Periscan returns `Unknown` readiness without posting to the webhook, returns zero assets and zero signals, and does not expose the webhook URL or secret path in the result.

Given PagerDuty is configured with an Events API routing key, when live `healthCheck` or `sync` runs, then Periscan returns `Unknown` readiness without triggering an incident, returns zero assets and zero signals, and does not expose the routing key.

Given Lakera Guard is configured without project IDs or policy IDs, when live `healthCheck` or `sync` runs, then Periscan returns `Unknown` readiness without calling Lakera metadata or runtime guard endpoints, returns zero assets and zero signals, and does not expose the API key.

## API Test Build-Artifact Isolation

Requirement labels: `PRD-ReleaseValidationDeterminism`, `PRD-AuditActionContractGuard`, `PRD-ProductionReadiness`, `GAP-API-TEST-DIST-EXCLUDE-001`.

Given API TypeScript build output exists under `apps/api/dist`, when a focused API test command such as `pnpm --filter @periscan/api test -- audit-action-contract` runs, then Vitest executes source tests and excludes `dist` tests so stale compiled artifacts cannot affect the result.

Given new audit actions are added to shared schema, API mapping, and Prisma enum definitions, when the audit action contract test runs, then it validates those current source contracts instead of an older compiled mapping.

## Tenant Webhook Lifecycle Audit Completeness

Requirement labels: `PRD-Audit-Log-Completeness`, `PRD-Webhooks`, `PRD-API-First`, `PRD-IntegrationCredentialRedaction`, `GAP-WEBHOOK-LIFECYCLE-AUDIT-COMPLETENESS-001`.

Given a tenant administrator creates, updates, tests, or deletes an outbound webhook, when tenant audit events are listed, then `webhook.created`, `webhook.updated`, `webhook.tested`, and `webhook.deleted` events identify the `TenantWebhook` without exposing the one-time signing secret, endpoint URL, or webhook payload.

Given a tenant viewer attempts webhook lifecycle mutation, when the request is evaluated, then the existing admin-only webhook authorization still prevents the action and no lifecycle audit event is fabricated.

## Trust Safety Integration Readiness Metadata

Requirement labels: `PRD-TrustSafety`, `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-TRUST-SAFETY-INTEGRATION-READINESS-METADATA-001`.

Given an authenticated API client requests `/api/v1/tenants/current/trust-safety`, when connected integrations exist, then each connected integration may include `connectorKey`, `implementationTier`, `executionReadiness`, `executionReadinessReason`, `dedicatedClient`, and `live` from persisted integration metadata with catalog fallback.

Given connected integrations use API keys, access keys, webhook URLs, or source credentials, when `/api/v1/tenants/current/trust-safety` returns connected-system readiness metadata, then connected integrations include no raw `config` object and no raw credential material.

Given a tenant administrator opens Trust & Safety, when connected systems render, then implementation tier, execution readiness, live support, and readiness reason are shown from the Trust & Safety API response.

Given an older connected integration lacks persisted readiness metadata, when the Trust & Safety summary is built, then connector catalog metadata is used as fallback and malformed legacy metadata is omitted instead of breaking the page.

## Typed Integration Permissions Summary

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `GAP-INTEGRATION-PERMISSIONS-SUMMARY-SCHEMA-001`.

Given an API client inspects the shared integration schema or OpenAPI output, when `permissionsSummary` is shown, then known fields include `connectorKey`, `implementationTier`, `executionReadiness`, `executionReadinessReason`, `dedicatedClient`, `live`, and `requiredPermissions`.

Given an integration response includes connector-specific legacy permission details, when `IntegrationSchema` parses the response, then those extra fields remain accepted through catchall compatibility.

Given an integration response includes an unknown execution-readiness value, when `IntegrationSchema` parses it, then validation fails instead of silently documenting an unsupported readiness state.

## Connected Integration Metadata UI

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-CONNECTED-METADATA-UI-001`.

Given an authenticated user opens Integration Marketplace with a connected integration, when the connected card renders, then the connected-state panel shows implementation tier, execution readiness, dedicated/standardized posture, live support, and readiness reason from `permissionsSummary`.

Given an older connected integration lacks persisted readiness metadata, when the card renders, then catalog metadata is used only as a fallback and health/sync controls remain usable.

## Persisted Integration Catalog Metadata

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-PERSISTED-CATALOG-METADATA-001`.

Given an authenticated API client creates a dedicated integration, when the create, list, and read responses are returned, then `permissionsSummary` includes `connectorKey`, `implementationTier`, `dedicatedClient`, `live`, `executionReadiness`, `executionReadinessReason`, and `requiredPermissions`.

Given an integration connection writes an audit event, when tenant audit events are listed, then `integration.connected` metadata includes connector identity context but no raw `config` object and no credential material.

Given an authenticated API client creates a standardized catalog integration, when the create and list responses are returned, then `permissionsSummary.implementationTier` is `StandardizedCatalog`, `dedicatedClient` is false, `live` is false, and credential fields remain redacted.

Given a replacement UI reads connected integration records, when catalog metadata is needed for display, then it can use the integration response directly and does not need to join generated docs or call `/api/v1/integrations/catalog` for the same connector.

## Registry Capability Readiness Visibility

Requirement labels: `PRD-RegistryCenter-APISurface`, `PRD-OSS-Productization`, `PRD-API-First`, `GAP-REGISTRY-CAPABILITY-READINESS-VISIBILITY-001`.

Given an authenticated user opens the Registry Center, when OSS capability cards render, then each card displays execution readiness from API data and falls back to capability status only when runtime readiness is absent.

Given capabilities include Ready, FixtureOnly, and Blocked states, when the Registry Center renders, then all three states are visible as status pills with runtime reasons and no mission is started or enabled from the card.

Given a capability declares safety levels, required scopes, required integrations, and evidence outputs, when the card renders, then those fields are displayed from `/api/v1/open-source-capabilities` response data rather than inferred from local UI constants.

## Integration Catalog API Tier Metadata

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-CATALOG-API-TIER-METADATA-001`.

Given an authenticated API client requests `/api/v1/integrations/catalog`, when connector entries are returned, then each item includes `implementationTier`, `dedicatedClient`, `live`, `executionReadiness`, and `executionReadinessReason`.

Given the API Reference/OpenAPI contract is generated, when the integration catalog operation is inspected, then it documents the enriched connector catalog entry schema rather than only the raw manifest fields.

Given a tenant administrator opens the Integration Marketplace, when catalog cards render, then the UI displays implementation tier and readiness from API data and does not infer those values from docs-only metadata.

## Integration Catalog Connectability Truthfulness

Requirement labels: `PRD-IntegrationMarketplace`, `PRD-API-First`, `PRD-Real-First`, `GAP-INTEGRATION-CATALOG-CONNECTABILITY-TRUTHFULNESS-001`.

Given a replacement UI reads `docs/integrations.json`, when it inspects connector entries, then dedicated live entries are connectable and standardized catalog entries are Planned with `connectable: false`, `live: false`, and `executionReadiness: NotConnectable`.

Given a customer reads README, the product completion plan, or the public traceability matrix, when integration totals are described, then the docs say 126 dedicated live integrations and 141 planned, non-connectable catalog entries.

Given a connector is only a standardized catalog manifest, when it appears in the API, generated docs, or marketplace, then it is labeled Planned and cannot open credential setup; the UI offers a design-partner contact instead.

## Production Redis Queue Configuration

Requirement labels: `PRD-ProductionRedisConfig`, `PRD-JobScheduler`, `PRD-ProductionReadiness`.

Given production API, worker, model-gateway, or webhook queue construction is attempted without `REDIS_URL`, when Redis connection options are resolved, then Periscan fails closed instead of using `redis://127.0.0.1:6379`.

Given `REDIS_URL` is configured with an unsupported protocol, when deployment readiness is evaluated, then `REDIS_URL` is marked not configured and the deployment is not ready.

Given the app runs outside production and `REDIS_URL` is missing, when local dev queues are constructed, then Periscan may use the documented local Redis fallback.

## Production Web API Proxy Configuration

Requirement labels: `PRD-ProductionWebApiProxyConfig`, `PRD-API-First`, `PRD-ProductionReadiness`.

Given the Next.js web app runs in production and `PERISCAN_API_URL` is missing, when `/api/v1/health` or any `/api/v1/*` proxy route is called, then the route returns 503 with code `api_proxy_unavailable` and does not proxy to `http://127.0.0.1:3001`.

Given `PERISCAN_API_URL` is configured with an HTTP(S) upstream, when the web app proxies `/api/v1/*` routes, then it forwards only the allowed request headers, strips hop-by-hop response headers, and preserves the upstream status/body.

Given the web app runs outside production, when `PERISCAN_API_URL` is missing, then local development may still use `http://127.0.0.1:3001`.

## Production Database Configuration

Requirement labels: `PRD-ProductionDatabaseConfig`, `PRD-ProductionReadiness`, `PRD-Supabase-DeploymentCompatibility`.

Given production Prisma client initialization is attempted without `DATABASE_URL`, `SUPABASE_DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL`, when the database URL resolver runs, then it fails closed instead of using the local development database fallback.

Given deployment readiness is evaluated with only `SUPABASE_DATABASE_URL`, `SUPABASE_DB_URL`, or `POSTGRES_URL` configured, when `DATABASE_URL` is absent, then the primary database item is configured, redacted, and not listed as missing.

Given no explicit database URL is configured outside production, when local development starts, then Periscan may still use the documented local Postgres fallback.

## Runner Task Signing Production Readiness

Requirement labels: `PRD-RunnerTaskSigningProductionReadiness`, `PRD-Runner-SignedTasks`, `PRD-ProductionReadiness`.

Given deployment readiness is evaluated for production, when `PERISCAN_RUNNER_TASK_SIGNING_PRIVATE_KEY_PEM` is missing, malformed, not Ed25519, or paired with a mismatched public key, then readiness marks runner task signing as not configured and the deployment is not ready.

Given a valid Ed25519 runner task-signing private key is configured, when runner registration needs signing material, then the API derives the public key and stable key ID unless explicitly supplied matching values are configured.

## Production Dev Mode Disabled

Requirement labels: `PRD-ProductionDevModeDisabled`, `PRD-SafetyBoundaries`, `PRD-ProductionReadiness`.

Given production API startup is attempted, when `PERISCAN_DEV_MODE=true`, then the API fails closed before enabling dev manual verification, mock integration, or fixture validation paths.

Given production worker startup is attempted, when `PERISCAN_DEV_MODE=true`, then the worker fails closed before allowing fixture validation targets.

Given deployment readiness is evaluated for production, when `PERISCAN_DEV_MODE=true`, then readiness marks the setting not configured and the deployment is not ready.

## Production Session Secret Readiness

Requirement labels: `PRD-ProductionSessionSecretReadiness`, `PRD-Auth-Tenant-RBAC`, `PRD-ProductionReadiness`.

Given production deployment readiness is evaluated, when `PERISCAN_JWT_SECRET` is unset or still equals `periscan-dev-session-secret`, then deployment status marks the session secret missing/not configured and the deployment is not ready.

Given production API startup is attempted, when `PERISCAN_JWT_SECRET` still equals `periscan-dev-session-secret`, then the API fails closed instead of signing sessions with default development material.

## Evidence Object Storage Production Config

Requirement labels: `PRD-EvidenceObjectStorageProductionConfig`, `PRD-Evidence-Packs`, `PRD-ProductionReadiness`.

Given deployment readiness is evaluated, when only an evidence object storage endpoint is configured, then readiness is not ready until bucket, access key, and secret key are also configured.

Given production evidence storage is initialized, when complete explicit S3-compatible or Supabase storage config is missing, then Periscan fails closed instead of falling back to local filesystem evidence storage.

Given local MinIO environment shortcuts are configured, when the deployment environment is production, then Periscan does not treat `MINIO_ROOT_*` shorthand values as production evidence storage credentials.

## Production CORS Origin Allowlist

Requirement labels: `PRD-ProductionCorsOriginAllowlist`, `PRD-API-First`, `PRD-ProductionReadiness`.

Given production direct-browser API CORS is configured, when `PERISCAN_CORS_ORIGINS` contains wildcard, localhost, non-HTTPS, path, query, fragment, or credential-bearing origins, then API startup fails closed and deployment readiness marks the setting not configured.

Given production direct-browser API CORS is configured with public HTTPS origins, when a browser request is sent from an allowed origin, then the API returns a credentialed CORS allow-origin header for that normalized origin.

Given no direct-browser API CORS allowlist is configured, when deployment readiness is evaluated, then CORS remains optional because same-origin web-to-api proxying and API-key clients do not require browser CORS.

## OSS Capability Coverage

Requirement labels: `PRD-OSSCapabilityCoverage`, `PRD-OSS-Safety`, `PRD-API-First`.

Given an API client lists OSS tools with all phases and legal-review entries included, when the tool catalog is built, then every visible tool has at least one capability entry.

Given safe recon tools are visible, when capabilities are listed, then `nmap`, `subfinder`, `httpx`, `dnsx`, and `zaproxy` expose implemented validation-module capabilities with required scopes, safety levels, mission types, and API routes.

Given high-impact dry-run tools are visible, when capabilities are listed, then `netexec`, `metasploit`, and `kerbrute` expose fixture-only or blocked execution readiness and do not imply live execution support.

Given runtime metadata is available, when Docker or binary runtimes are present, then safe recon tools can report `Ready` but high-impact dry-run tools remain `FixtureOnly` or `Blocked` according to safety level.

## sqlmap Capability Blocked

Requirement labels: `PRD-SqlmapCapabilityBlocked`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-NoUnauthorizedOffense`.

Given an API client lists OSS tool capabilities with legal-review entries included, when `sqlmap` is returned, then it includes `sqlmap.sqli-probe-plan` with status `BlockedLegalReview`.

Given an API client lists OSS tool runtime metadata, when `sqlmap` is returned and a Docker or binary runtime is present, then aggregate execution readiness remains `Blocked`.

Given an API client lists module manifests, when `web.sqli_probe` is returned, then the module remains `liveSupported:false` and its customer-visible description says live sqlmap probing is disabled in the current release.

Given a caller bypasses mission queueing and directly invokes `web.sqli_probe` with `dryRun:false`, when the module executes, then it returns disabled-live-execution evidence and does not invoke sqlmap.

## ScoutSuite Live Posture Disabled

Requirement labels: `PRD-ScoutSuiteLivePostureDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-CloudValidationControls`.

Given an API client lists module manifests, when `cloud.scoutsuite_posture` is returned, then `liveSupported` is false and the customer-visible description says live ScoutSuite execution is disabled pending legal and safety review.

Given an API client lists OSS tool capabilities with runtime metadata, when `scoutsuite` is returned, then the ScoutSuite capability is `BlockedLegalReview` and aggregate execution readiness is `Blocked` even when a runtime is installed.

Given a mission start request includes `cloud.scoutsuite_posture` without fixture/import mode, when start constraints are evaluated, then the result is denied with `scoutsuite_live_disabled`.

Given a caller bypasses mission queueing and directly invokes `cloud.scoutsuite_posture` without fixture mode, when the module executes, then it returns `scoutsuite_live_execution_disabled`, creates only redacted disabled-live-execution evidence, emits no signals, and does not invoke ScoutSuite.

Given a tenant needs live AWS posture validation in the current release, when they run cloud validation, then `prowler.aws_posture` remains the supported live read-only path while ScoutSuite remains import/fixture-only.

## WhatWeb Live Fingerprint Disabled

Requirement labels: `PRD-WhatWebLiveFingerprintDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

Given an API client lists module manifests, when `web.fingerprint` is returned, then `liveSupported` is false and the customer-visible description says live WhatWeb execution is disabled pending legal and safety review.

Given an API client lists OSS tool capabilities with runtime metadata, when `whatweb` is returned, then the WhatWeb capability is `BlockedLegalReview` and aggregate execution readiness is `Blocked` even when a runtime is installed.

Given a mission start request includes `web.fingerprint` without fixture/import mode, when start constraints are evaluated, then the result is denied with `whatweb_live_disabled`.

Given a caller bypasses mission queueing and directly invokes `web.fingerprint` without fixture mode, when the module executes, then it returns `whatweb_live_execution_disabled`, creates only redacted disabled-live-execution evidence, emits no signals, and does not invoke WhatWeb.

## testssl Live TLS Audit Disabled

Requirement labels: `PRD-TestsslLiveAuditDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

Given an API client lists module manifests, when `web.tls_audit` is returned, then `liveSupported` is false and the customer-visible description says live testssl.sh execution is disabled pending legal and safety review.

Given an API client lists OSS tool capabilities with runtime metadata, when `testssl` is returned, then the testssl capability is `BlockedLegalReview` and aggregate execution readiness is `Blocked` even when a runtime is installed.

Given a mission start request includes `web.tls_audit` without fixture/import mode, when start constraints are evaluated, then the result is denied with `testssl_live_disabled`.

Given a caller bypasses mission queueing and directly invokes `web.tls_audit` without fixture mode, when the module executes, then it returns `testssl_live_execution_disabled`, creates only redacted disabled-live-execution evidence, emits no signals, and does not invoke testssl.sh.

Given a tenant needs live TLS validation in the current release, when they run Periscan TLS checks, then the built-in Periscan TLS modules remain the supported live path.

## Nikto Live Scan Disabled

Requirement labels: `PRD-NiktoLiveScanDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

Given an API client lists module manifests, when `web.nikto_scan` is returned, then `liveSupported` is false and the customer-visible description says live Nikto scanning is disabled pending legal and safety review.

Given an API client lists OSS tool capabilities with runtime metadata, when `nikto` is returned, then the Nikto capability is `BlockedLegalReview` and aggregate execution readiness is `Blocked` even when a runtime is installed.

Given a mission start request includes `web.nikto_scan` without fixture/import mode, when start constraints are evaluated, then the result is denied with `nikto_live_disabled`.

Given a caller bypasses mission queueing and directly invokes `web.nikto_scan` without fixture mode, when the module executes, then it returns `nikto_live_execution_disabled`, creates only redacted disabled-live-execution evidence, emits no signals, and does not invoke Nikto.

## Web Content Discovery Fuzzing Disabled

Requirement labels: `PRD-WebContentDiscoveryFuzzingDisabled`, `PRD-OSS-Safety`, `SECURITY_BOUNDARIES-ExternalValidationControls`.

Given an API client lists module manifests, when `web.content_discovery` is returned, then `liveSupported` is false and the customer-visible description does not claim live `ffuf` fuzzing is available.

Given an API client lists OSS tool capabilities, when `ffuf` is returned with runtime metadata, then the content-discovery capability and aggregate tool execution readiness report `FixtureOnly` rather than `Ready`.

Given a mission start request includes `web.content_discovery` without explicit fixture/import mode, when start constraints are evaluated, then the result is denied with `content_discovery_live_disabled`.

Given a caller bypasses mission queueing and directly invokes `web.content_discovery` without fixture mode, when the module executes, then it returns `content_discovery_live_execution_disabled`, creates only redacted disabled-live-execution evidence, emits no signals, and does not invoke `ffuf`.

Given fixture mode is explicitly used by tests or local labs, when `web.content_discovery` executes, then deterministic fixture paths can still be normalized without claiming live measurement.

## Runner Accepted-Task Halt Guard

Requirement labels: `PRD-RunnerAcceptedTaskHaltGuard`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-Real-First`.

Given a runner task has been accepted but not completed, when a tenant admin revokes the runner, then the task is marked `Cancelled` with the revoke-before-completion summary.

Given a runner task has been accepted but not completed, when a tenant admin activates the runner kill switch, then the task is marked `DeniedByServerPolicy` with the kill-switch-before-completion summary.

Given accepted tasks are included in active-task cleanup, when the runner later attempts artifact or result callbacks, then the existing terminal lifecycle guards prevent proof-state mutation after the halt.

## Runner Reject Terminal State Guard

Requirement labels: `PRD-RunnerRejectTerminalStateGuard`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-Real-First`.

Given a runner task is already in any terminal state, when the runner calls `POST /api/v1/runners/:id/tasks/:taskId/reject`, then the API returns `409 runner_task_invalid_state`.

Given a task is already `Rejected`, when the reject callback is attempted, then the persisted task remains `Rejected` and `rejectedReason` is not overwritten.

Given a terminal-task reject attempt is denied, when audit events are inspected, then a `runner.task.rejected` event exists with reason `reject_after_terminal_state` and the terminal task state.

## Runner Artifact Terminal State Guard

Requirement labels: `PRD-RunnerArtifactTerminalStateGuard`, `PRD-Runner-SignedTasks`, `PRD-Evidence-Auditable`, `PRD-Real-First`.

Given a runner task has reached a terminal state, when the runner calls `POST /api/v1/runners/:id/tasks/:taskId/artifacts`, then the API returns `409 runner_task_invalid_state` before artifact hash validation or evidence storage.

Given a terminal-task artifact upload is rejected, when tenant evidence artifacts are counted before and after the request, then the count is unchanged.

Given a terminal-task artifact upload is rejected, when audit events are inspected, then a `runner.task.rejected` event exists with reason `artifact_after_terminal_state` and the terminal task state.

## Audit Action Contract Guard

Requirement labels: `PRD-AuditActionContractGuard`, `PRD-Audit-Completeness`, `PRD-API-First`.

Given a public audit action is added to the shared schema, when API tests run, then the action must also exist in `AUDIT_ACTION_TO_DB` and map to a Prisma `AuditEventAction` enum value.

Given a Prisma audit action enum value is added or removed, when API tests run, then the runtime audit mapping must be updated so mapped DB values exactly match the Prisma enum.

Given the shared schema, API mapping, and Prisma enum are synchronized, when `pnpm --filter @periscan/api test -- audit-action-contract` runs, then the contract test passes without needing a database connection.

## Worker Fixture Target Defense

Requirement labels: `PRD-WorkerFixtureTargetDefense`, `PRD-Real-First`, `PRD-JobScheduler`, `PRD-PolicyEngine`.

Given the asynchronous validation worker loads a queued validation run whose target contains a `fixture*` or `mockMode` key, when the worker runtime has not explicitly enabled fixture targets, then the worker marks the run and mission failed and throws before module execution.

Given the worker rejects a queued fixture target, when side effects are inspected, then no evidence artifact, normalized signal, graph projection, or module-executed audit success record is created.

Given a local dev/test processor is constructed with fixture targets explicitly allowed, when a fixture-backed module job is processed, then deterministic fixture execution still succeeds for tests and local labs.

Given API services check production mission/engagement targets, when they evaluate fixture hints, then API and worker use the same shared detector so guard semantics do not drift.

## Model Gateway Tool Input Boundary

Requirement labels: `PRD-ModelGatewayToolInputContract`, `PRD-API-First`, `PRD-Evidence-Redaction`, `PRD-FrontierGateway`.

Given a model or API client submits a tool request with a property not declared in that tool's catalog schema, when the request is evaluated, then the API returns `422 invalid_tool_input` before creating a `ModelToolRequest`.

Given a model or API client submits a tool request with a wrong type, out-of-range value, missing required field, or malformed UUID for a catalog-declared field, when the request is evaluated, then the API returns `422 invalid_tool_input` before persistence or execution.

Given a valid tool request includes secret-like text in an allowed rationale field, when the request is persisted and returned through the API, then `inputPayloadRedacted` does not contain the raw secret-like value and the canonical input hash is still recorded for audit integrity.

Given an action tool requires approval, when it is approved and executed after input validation, then it still re-previews policy and creates only a policy-decided mission shell; no model-supplied tool argument can directly queue validation or mark a fix complete.

## Threat Correlation Evidence Gate

Requirement labels: `PRD-ThreatCorrelationEvidenceGate`, `PRD-Evidence-Auditable`, `PRD-ValidationSnapshot`, `PRD-Real-First`.

Given an open threat advisory has indicators that match a completed validation run, when that run has no evidence IDs, then `countCorrelatedThreatAdvisories` returns zero and the advisory detail reports no correlated exposure evidence.

Given the same advisory later matches a completed validation run with evidence IDs, when a Snapshot is generated, then `metrics.correlatedThreatAdvisoryCount` includes that advisory and the advisory detail exposes the matching evidence IDs.

Given a technique-matched validation run is older than the bounded recent-run scan window, when the run carries evidence IDs, then threat correlation still finds it through the authoritative technique lookup.

## OSS Current Phase Canonicalization

Requirement labels: `PRD-OSS-CurrentPhaseCanonicalization`, `PRD-OSS-CurrentPhaseAlias`, `PRD-API-First`.

Given the default OSS toolchain registry is listed, when module tests inspect current capabilities, then at least one capability has `phase: "Current"` and no default capability has `phase: "CurrentMvp"`.

Given an API or CLI client sends `phase=Current`, when OSS tools are listed or checked, then the current tool set is returned with `Current` as the serialized phase.

Given the active OSS workstream marks OSV, promptfoo, PyRIT, and Atomic content as current, when `pnpm tools:list -- --phase=Current` runs, then those tools appear alongside Gitleaks, Nuclei/templates, Trivy, and Prowler while Garak/OpenCTI/Sigma/OCSF remain near-term.

Given Docker is available in the local runtime, when `pnpm tools:check -- --phase=Current` runs, then OSV resolves to `ghcr.io/google/osv-scanner:v2.3.0` instead of reporting an unavailable host binary.

Given an existing API or CLI client sends `phase=CurrentMvp`, when OSS tools are listed or checked, then the same current tool set is returned and responses/output still serialize `Current`.

## OSS Current Phase Readiness Docs

Requirement labels: `PRD-OSS-CurrentPhaseReadinessDocs`, `PRD-OSS-CurrentPhaseAlias`, `PRD-ReleaseTraceability`.

Given a release engineer follows the production-readiness checklist, when they run the OSS readiness command, then the documented command uses `pnpm tools:check -- --phase=Current` and succeeds against the implemented current toolchain.

Given the active OSS workstream index is edited, when `pnpm test:modules -- open-source-workstream-docs` runs, then the index must not contain the stale `CurrentMvp` phase label.

Given an existing API or CLI client still sends `phase=CurrentMvp`, when shared/API/CLI normalization handles the request, then compatibility remains covered by the existing `PRD-OSS-CurrentPhaseAlias` tests while serialized customer-facing output remains `Current`.

## Jira Mock Shortcut Production Guard

Requirement labels: `PRD-RealFirst-JiraMockShortcutGuard`, `PRD-RealFirst-MockIntegrationGuard`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Real-First`.

Given a production-mode API runtime, when an authenticated integration editor calls `POST /api/v1/integrations/jira/mock-connect` without real Jira credentials, then the API returns `fixture_mode_disabled`.

Given the Jira mock shortcut request is denied, when tenant integrations are counted before and after the request, then no mock Jira integration record is persisted.

Given API dev mode is explicitly enabled for deterministic tests or local lab use, when the mock shortcut route is used, then fixture Jira setup remains isolated to dev/test/lab workflows and is not a production customer default.

## Primary Navigation Contract Drift Guard

Requirement labels: `PRD-WebNavigationContract`, `PRD-WebRouteCoverage`, `PRD-UX-MainNavigation`, `PRD-API-First`, `PRD-Accessibility`.

Given a static first-party Next.js page exists under `apps/web/app`, when the web unit tests run, then the page route must be present in `APP_NAV_ITEMS` unless it is an explicitly dynamic route covered by E2E gates.

Given the primary navigation contract contains a route, when the filesystem-backed route contract test compares it with discovered static pages, then the route must correspond to a real page and duplicate nav links are rejected.

Given the dynamic Snapshot report route exists under `apps/web/app/snapshots/[id]`, when the route contract test runs, then it remains explicitly listed as dynamic E2E-covered rather than treated as an unregistered static page.

## Fixture Mission Target Guard

Requirement labels: `PRD-RealFirst-MissionTargetGuard`, `PRD-PolicyEngine`, `PRD-JobScheduler`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

Given a production-mode API runtime, when an authenticated scope editor calls `POST /api/v1/scopes/:id/policy-decisions/preview` with target keys such as `fixtureMode`, `fixtureOutcome`, `fixtureReportPath`, or nested fixture fields, then the API returns `fixture_mode_disabled` before creating a policy decision.

Given a valid production policy decision and mission exist, when an authenticated scope editor calls `POST /api/v1/missions/:id/start` with target keys such as `fixtureMode`, `fixtureOutcome`, `fixtureReportPath`, or `mockMode`, then the API returns `fixture_mode_disabled` before creating validation runs or queue jobs.

Given API dev mode is explicitly enabled for deterministic tests or local lab use, when fixture target fields are supplied, then fixture execution remains available for isolated test evidence and is not a production customer default.

## Mock Integration Dev-Mode Guard

Requirement labels: `PRD-RealFirst-MockIntegrationGuard`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

Given a production-mode API runtime, when an authenticated integration editor calls `POST /api/v1/integrations` with `mockMode: true`, then the API returns `fixture_mode_disabled` before creating an integration record.

Given a production-mode API runtime, when an authenticated integration editor calls `POST /api/v1/integrations` with `authType: "mock"`, then the API returns `fixture_mode_disabled` before creating an integration record.

Given API dev mode is explicitly enabled for deterministic tests or local lab use, when an integration editor creates mock integrations, then fixture connectors remain available for isolated test evidence and are not a production customer default.

## Control Validation Fixture Verdict Guard

Requirement labels: `PRD-RealFirst-ControlFixtureGuard`, `PRD-ControlValidation`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

Given a tenant has a control source in a production-mode API runtime, when an authenticated scope editor calls `POST /api/v1/control-sources/:id/validate` with a caller-supplied `fixtureOutcome`, then the API returns `fixture_mode_disabled` before observer or validation-module execution.

Given a production-mode fixture control verdict request is rejected, when the tenant's validation runs and control-source health fields are inspected, then no validation run is written and `lastValidatedAt`, `healthStatus`, and `telemetryStatus` remain unchanged.

Given API dev mode is explicitly enabled for deterministic tests or local lab use, when a scope editor calls control validation with a fixture outcome, then synthetic observer verdicts remain available for isolated test evidence and are not a production customer default.

## Scope Posture Fixture Mode Guard

Requirement labels: `PRD-RealFirst-ScopePostureFixtureGuard`, `PRD-ScopePostureChecks`, `PRD-API-First`, `PRD-Real-First`, `PRD-Evidence-Auditable`.

Given a tenant has a verified Domain or Subdomain scope in a production-mode API runtime, when an authenticated scope editor calls `POST /api/v1/scopes/:id/posture-check` with `executionMode: "Fixture"` or fixture payload data, then the API returns `fixture_mode_disabled` before executing validation modules.

Given a production-mode fixture posture request is rejected, when the tenant's validation runs and scope posture cadence are inspected, then no validation run is written and `lastPostureCheckAt` / `nextPostureCheckAt` remain unchanged.

Given API dev mode is explicitly enabled for deterministic tests or local lab use, when a scope editor calls posture checks with fixture data, then fixture posture checks remain available for isolated test evidence and are not a production customer default.

## Threat Intel, Security Rating, and Compliance Connector API Acceptance

Requirement labels: `PRD-OtherConnector-Acceptance`, `PRD-ThreatIntel-Connectors`, `PRD-SecurityRatings-Connectors`, `PRD-ComplianceEvidence-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates any connectable Other-category integration through `POST /api/v1/integrations`, when the request includes API keys, tokens, or private keys, then the API response redacts secret fields and the persisted integration config stores credential material encrypted rather than plaintext.

Given a tenant administrator syncs connectable Other-category integrations in explicit fixture/lab mode, when connectors produce read-only threat-intelligence, security-rating, or compliance-evidence context, then the API persists normalized signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw provider dumps.

Given a tenant reads Trust & Safety after these connector syncs, when the connected integrations are listed, then health, last sync, and required read-only provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's external evidence integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## Security Control Connector API Acceptance

Requirement labels: `PRD-SecurityControlConnector-Acceptance`, `PRD-ControlValidation`, `PRD-EDR-XDR-Connectors`, `PRD-SIEM-Connectors`, `PRD-WAF-Firewall-Connectors`, `PRD-EmailSecurity-Connectors`, `PRD-SOAR-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates any connectable SecurityControl-category integration through `POST /api/v1/integrations`, when the request includes API keys, key identifiers, access keys, client secrets, bearer tokens, or passwords, then the API response redacts secret fields and the persisted integration config stores credential material encrypted rather than plaintext.

Given a tenant administrator syncs connectable SecurityControl-category integrations in explicit fixture/lab mode, when connectors produce read-only EDR, XDR, SIEM, SOAR, WAF, firewall, email-security, detection, exposure, or control-observation context, then the API persists tenant assets where applicable, normalized signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw provider dumps.

Given a tenant reads Trust & Safety after security-control sync, when the connected integrations are listed, then health, last sync, and required read-only provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's security-control integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## Cloud Connector API Acceptance

Requirement labels: `PRD-CloudConnector-Acceptance`, `PRD-AWS-CloudConnector`, `PRD-Azure-CloudConnector`, `PRD-GCP-CloudConnector`, `PRD-Cloudflare-CloudConnector`, `PRD-Kubernetes-CloudConnector`, `PRD-CloudPosture-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates any connectable Cloud-category integration through `POST /api/v1/integrations`, when the request includes access keys, client secrets, API tokens, bearer tokens, PATs, or generated key-pair credentials, then the API response redacts secret fields and the persisted integration config stores credential material encrypted rather than plaintext.

Given a tenant administrator syncs connectable Cloud-category integrations in explicit fixture/lab mode, when connectors produce read-only cloud, Kubernetes, edge, data-platform, posture, exposure, or control context, then the API persists tenant assets where applicable, normalized signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw provider dumps.

Given a tenant reads Trust & Safety after cloud sync, when the connected integrations are listed, then health, last sync, and required read-only provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's cloud integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## Identity Connector API Acceptance

Requirement labels: `PRD-IdentityConnector-Acceptance`, `PRD-MicrosoftEntra-IdentityConnector`, `PRD-Okta-IdentityConnector`, `PRD-GoogleWorkspace-IdentityConnector`, `PRD-Duo-IdentityConnector`, `PRD-OneLogin-IdentityConnector`, `PRD-PingOne-IdentityConnector`, `PRD-Auth0-IdentityConnector`, `PRD-JumpCloud-IdentityConnector`, `PRD-CyberArk-IdentityConnector`, `PRD-ActiveDirectory-IdentityConnector`, `PRD-MarketLeaderIdentity-Connectors`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates any connectable Identity-category integration through `POST /api/v1/integrations`, when the request includes API keys, access keys, bearer tokens, client secrets, private keys, passwords, or generated key-pair identifiers, then the API response redacts secret fields and the persisted integration config stores manifest-declared credential material encrypted rather than plaintext.

Given a tenant administrator syncs connectable Identity-category integrations in explicit fixture/lab mode, when connectors produce read-only identity, MFA, group, privileged-access, device-management, machine-identity, secrets-management, or governance context, then the API persists tenant assets where applicable, normalized signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw provider dumps.

Given a tenant reads Trust & Safety after identity sync, when the connected integrations are listed, then health, last sync, and required read-only provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's identity integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## VM/EAP/ASM/CNAPP Connector API Acceptance

Requirement labels: `PRD-ExposureConnector-Acceptance`, `PRD-TenableVM-Connector`, `PRD-Rapid7InsightVM-Connector`, `PRD-WizCNAPP-Connector`, `PRD-PrismaCloudCNAPP-Connector`, `PRD-LaceworkFortiCNAPP-Connector`, `PRD-OrcaSecurityCNAPP-Connector`, `PRD-QualysVMDR-Connector`, `PRD-RunZero-Connector`, `PRD-AssetnoteASM-Connector`, `PRD-AxoniusCAASM-Connector`, `PRD-Armis-Connector`, `PRD-CortexXpanse-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates Tenable, Rapid7 InsightVM, Wiz, Prisma Cloud, Lacework/FortiCNAPP, Orca Security, Qualys VMDR, runZero, Assetnote, Axonius, Armis, or Cortex Xpanse integrations through `POST /api/v1/integrations`, when the request includes API keys, access keys, passwords, bearer tokens, client secrets, or export tokens, then the API response redacts secret fields and the persisted integration config stores manifest-declared secrets encrypted rather than plaintext.

Given a tenant administrator syncs those VM/EAP/ASM/CNAPP integrations in explicit fixture/lab mode, when connectors produce read-only vulnerability, asset inventory, cloud-resource, external-service, internet-exposure, coverage-gap, or CVE context, then the API persists tenant assets, normalized signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw scanner/provider dumps.

Given a tenant reads Trust & Safety after exposure-source sync, when the connected integrations are listed, then health, last sync, and required read-only provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's exposure-source integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## Code/DevSecOps Connector API Acceptance

Requirement labels: `PRD-CodeDevSecOps-ConnectorAcceptance`, `PRD-GitLab-Connector`, `PRD-Bitbucket-Connector`, `PRD-AzureDevOps-Connector`, `PRD-Buildkite-Connector`, `PRD-CircleCI-Connector`, `PRD-Jenkins-Connector`, `PRD-DockerHub-Connector`, `PRD-GitHubContainerRegistry-Connector`, `PRD-AWSECR-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates GitLab, Bitbucket, Azure DevOps, Buildkite, CircleCI, Jenkins, Docker Hub, GitHub Container Registry, or AWS ECR integrations through `POST /api/v1/integrations`, when the request includes provider tokens, app passwords, API tokens, PATs, or AWS static credentials, then the API response redacts secret fields and the persisted integration config stores manifest-declared secrets encrypted rather than plaintext.

Given a tenant administrator syncs those Code/DevSecOps integrations in explicit fixture/lab mode, when connectors produce read-only repository, branch-protection, CI/CD pipeline, container repository, image tag, image digest, scan-on-push, or tag-mutability context, then the API persists normalized signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw provider dumps.

Given a tenant reads Trust & Safety after Code/DevSecOps sync, when the connected integrations are listed, then health, last sync, and required provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's Code/DevSecOps integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## AI Provider Connector API Acceptance

Requirement labels: `PRD-AIProvider-ConnectorAcceptance`, `PRD-OpenAI-Connector`, `PRD-Anthropic-Connector`, `PRD-AzureOpenAI-Connector`, `PRD-AzureAISearch-Connector`, `PRD-Chroma-Connector`, `PRD-AWSBedrock-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates OpenAI, Anthropic, Azure OpenAI, Azure AI Search, Chroma, or AWS Bedrock integrations through `POST /api/v1/integrations`, when the request includes provider API keys or cloud credentials, then the API response redacts secret fields and the persisted integration config stores manifest-declared secrets encrypted rather than plaintext.

Given a tenant administrator syncs those AI provider and vector/search integrations in explicit fixture/lab mode, when connectors produce read-only model, deployment, foundation-model, search-index, or vector-collection context, then the API persists normalized AI application signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials or raw provider dumps.

Given a tenant reads Trust & Safety after AI provider sync, when the connected integrations are listed, then health, last sync, and provider permissions are visible without raw credential material.

Given another tenant attempts to read or sync the first tenant's AI provider integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## AI Stack Connector API Acceptance

Requirement labels: `PRD-AIStack-ConnectorAcceptance`, `PRD-VertexAI-Connector`, `PRD-Pinecone-Connector`, `PRD-Weaviate-Connector`, `PRD-LangChain-Connector`, `PRD-LlamaIndex-Connector`, `PRD-GuardrailsAI-Connector`, `PRD-LakeraGuard-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates Vertex AI, Pinecone, Weaviate, LangChain, LlamaIndex, Guardrails AI, or Lakera Guard integrations through `POST /api/v1/integrations`, when the request includes provider API tokens or imported framework metadata, then the API response redacts secret fields and the persisted integration config stores manifest-declared secrets encrypted rather than plaintext.

Given a tenant administrator syncs those AI-stack integrations in explicit fixture/lab mode, when connectors produce read-only AI application or guardrail context, then the API persists normalized AI/control signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials.

Given a tenant reads Trust & Safety after AI-stack sync, when the connected integrations are listed, then health, last sync, and provider permissions are visible without raw credential material or raw provider dumps.

Given another tenant attempts to read or sync the first tenant's AI-stack integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## Workflow Destination API Acceptance

Requirement labels: `PRD-Jira-WorkflowAcceptance`, `PRD-MicrosoftTeams-WorkflowAcceptance`, `PRD-Slack-WorkflowAcceptance`, `PRD-Opsgenie-WorkflowAcceptance`, `PRD-PagerDuty-WorkflowAcceptance`, `PRD-Linear-WorkflowAcceptance`, `PRD-GitHubIssues-WorkflowAcceptance`, `PRD-ServiceNow-WorkflowAcceptance`, `PRD-Remediation API`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates a Jira Cloud integration through `POST /api/v1/integrations`, when the request includes an API token, then the API response redacts the token and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a Jira integration in explicit fixture/lab mode, when the connector produces ticket-state context, then the API persists normalized remediation signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a Jira integration ID, then Periscan dispatches through the Jira connector, stores Jira ticket metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the Jira integration or create a ticket for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates a Microsoft Teams integration through `POST /api/v1/integrations`, when the request includes an incoming webhook URL, then the API response redacts the URL and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a Microsoft Teams integration in explicit fixture/lab mode, when the connector produces workflow-destination context, then the API persists normalized audit signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a Microsoft Teams integration is configured in live webhook mode, when the connector syncs integration readiness, then it returns readiness status without emitting fixture workflow-destination signals or leaking the webhook URL.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a Microsoft Teams integration ID, then Periscan dispatches through the Microsoft Teams connector, stores notification delivery metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the Microsoft Teams integration or send a notification for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates a Slack integration through `POST /api/v1/integrations`, when the request includes an incoming webhook URL, then the API response redacts the URL and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a Slack integration in explicit fixture/lab mode, when the connector produces workflow-destination context, then the API persists normalized audit signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a Slack integration is configured in live webhook mode, when the connector syncs integration readiness, then it returns readiness status without emitting fixture workflow-destination signals or leaking the webhook URL.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a Slack integration ID, then Periscan dispatches through the Slack connector, stores notification delivery metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the Slack integration or send a notification for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates an Opsgenie integration through `POST /api/v1/integrations`, when the request includes an API key, then the API response redacts the key and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs an Opsgenie integration in explicit fixture/lab mode, when the connector produces alert-state context, then the API persists normalized remediation signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with an Opsgenie integration ID, then Periscan dispatches through the Opsgenie connector, stores alert metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the Opsgenie integration or route an alert for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates a PagerDuty integration through `POST /api/v1/integrations`, when the request includes an Events API routing key, then the API response redacts the key and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a PagerDuty integration in explicit fixture/lab mode, when the connector produces incident-state context, then the API persists normalized remediation signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a PagerDuty integration ID, then Periscan dispatches through the PagerDuty connector, stores incident metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the PagerDuty integration or route an incident for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates a Linear integration through `POST /api/v1/integrations`, when the request includes an API key, then the API response redacts the key and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a Linear integration in explicit fixture/lab mode, when the connector produces issue-state context, then the API persists normalized remediation signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a Linear integration ID, then Periscan dispatches through the Linear connector, stores Linear issue metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the Linear integration or create an issue for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates a GitHub Issues integration through `POST /api/v1/integrations`, when the request includes a PAT or repository-scoped token, then the API response redacts the token and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a GitHub Issues integration in explicit fixture/lab mode, when the connector produces ticket-state context, then the API persists normalized remediation signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a GitHub Issues integration ID, then Periscan dispatches through the GitHub Issues connector, stores issue metadata on the remediation, returns delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the GitHub Issues integration or create an issue for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

Given a tenant administrator creates a ServiceNow integration through `POST /api/v1/integrations`, when the request includes a password or API credential, then the API response redacts the credential and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a ServiceNow integration in explicit fixture/lab mode, when the connector produces ticket-state context, then the API persists normalized remediation signals, a normalized-evidence artifact, and an `integration_synced` audit event without exposing credentials.

Given a remediation task exists, when an authenticated scope editor calls `POST /api/v1/remediations/:id/create-ticket` with a ServiceNow integration ID, then Periscan dispatches through the ServiceNow connector, stores ServiceNow ticket metadata on the remediation, returns ticket delivery metadata, and writes a remediation audit event without leaking credentials.

Given another tenant attempts to read the ServiceNow integration or create a ticket for the first tenant's remediation, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector or remediation.

## Threat Intelligence Connector API Acceptance

Requirement labels: `PRD-ThreatIntel-ConnectorAcceptance`, `PRD-AlienVaultOTX-Connector`, `PRD-RecordedFuture-Connector`, `PRD-MandiantAdvantage-Connector`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates AlienVault OTX, Recorded Future, or Mandiant Advantage integrations through `POST /api/v1/integrations`, when the request includes provider API keys or secrets, then the API responses redact the secrets and the persisted integration configs store them encrypted rather than plaintext.

Given a tenant administrator syncs those threat-intelligence integrations in explicit fixture/lab mode, when connectors produce read-only enrichment context, then the API persists normalized exposure signals, a normalized-evidence artifact per sync, and an `integration_synced` audit event without exposing credentials.

Given a tenant reads Trust & Safety after threat-intelligence sync, when the connected integrations are listed, then health, last sync, and provider permissions are visible without raw credential material or raw provider dumps.

Given another tenant attempts to read or sync the first tenant's threat-intelligence integrations, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connectors.

## MSSP/RMM Connector API Acceptance

Requirement labels: `PRD-ConnectWiseManage-AcceptanceCoverage`, `PRD-Syncro-AcceptanceCoverage`, `PRD-Autotask-AcceptanceCoverage`, `PRD-HaloPSA-AcceptanceCoverage`, `PRD-NinjaOne-AcceptanceCoverage`, `PRD-NCentral-AcceptanceCoverage`, `PRD-DattoRMM-AcceptanceCoverage`, `PRD-KaseyaVSA-AcceptanceCoverage`, `PRD-ConnectWiseAutomate-AcceptanceCoverage`, `PRD-Integration-Registry`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates a ConnectWise Manage integration through `POST /api/v1/integrations`, when the request includes public and private API keys, then the API response redacts both keys and the persisted integration config stores both encrypted rather than plaintext.

Given a tenant administrator syncs a ConnectWise Manage integration, when fixture-backed read-only PSA telemetry is imported, then the API persists company assets, `ConnectWiseCompanyObserved`, `ConnectWiseTicketObserved`, and `ConnectWiseOpenTicketObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced ConnectWise Manage integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only ConnectWise Manage permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's ConnectWise Manage integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates a Syncro integration through `POST /api/v1/integrations`, when the request includes an API token, then the API response redacts the token and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a Syncro integration, when fixture-backed read-only RMM/PSA telemetry is imported, then the API persists customer and host assets, `SyncroCustomerObserved`, `SyncroAssetObserved`, `SyncroOfflineAssetObserved`, `SyncroTicketObserved`, and `SyncroOpenTicketObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced Syncro integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only Syncro permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's Syncro integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates an Autotask integration through `POST /api/v1/integrations`, when the request includes an API integration code and secret, then the API response redacts both secret values and the persisted integration config stores both encrypted rather than plaintext.

Given a tenant administrator syncs an Autotask integration, when fixture-backed read-only PSA telemetry is imported, then the API persists company assets, `AutotaskCompanyObserved`, `AutotaskTicketObserved`, and `AutotaskOpenTicketObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced Autotask integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only Autotask permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's Autotask integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates a HaloPSA integration through `POST /api/v1/integrations`, when the request includes an OAuth client secret, then the API response redacts the secret and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a HaloPSA integration, when fixture-backed read-only PSA telemetry is imported, then the API persists client assets, `HaloPSAClientObserved`, `HaloPSATicketObserved`, and `HaloPSAOpenTicketObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced HaloPSA integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only HaloPSA permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's HaloPSA integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates a NinjaOne integration through `POST /api/v1/integrations`, when the request includes an access token, then the API response redacts the token and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator syncs a NinjaOne integration, when fixture-backed read-only RMM telemetry is imported, then the API persists organization and device assets, `NinjaOneOrganizationObserved`, `NinjaOneDeviceObserved`, `NinjaOneOfflineDeviceObserved`, `NinjaOneAlertObserved`, and `NinjaOneCriticalOpenAlertObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced NinjaOne integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only NinjaOne permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's NinjaOne integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates an N-able N-central integration through `POST /api/v1/integrations`, when the request includes access and JWT tokens, then the API response redacts both tokens and the persisted integration config stores them encrypted rather than plaintext.

Given a tenant administrator syncs an N-able N-central integration, when fixture-backed read-only RMM telemetry is imported, then the API persists customer and device assets, `NCentralCustomerObserved`, `NCentralDeviceObserved`, `NCentralOfflineDeviceObserved`, and `NCentralActiveIssueObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced N-able N-central integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only N-central permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's N-able N-central integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates a Datto RMM integration through `POST /api/v1/integrations`, when the request includes an API key and API secret, then the API response redacts both secrets and the persisted integration config stores them encrypted rather than plaintext.

Given a tenant administrator syncs a Datto RMM integration, when fixture-backed read-only RMM telemetry is imported, then the API persists site and device assets, `DattoRmmSiteObserved`, `DattoRmmDeviceObserved`, and `DattoRmmOfflineDeviceObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced Datto RMM integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only Datto RMM permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's Datto RMM integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

Given a tenant administrator creates a Kaseya VSA integration through `POST /api/v1/integrations`, when the request includes an access token, then the API response redacts the token and the persisted integration config stores it encrypted rather than plaintext.

Given a tenant administrator refreshes health for a Kaseya VSA integration, when the connector is in explicit fixture/lab mode, then `/api/v1/integrations/:id/health` returns healthy status without exposing the access token.

Given a tenant administrator syncs a Kaseya VSA integration, when fixture-backed read-only RMM telemetry is imported, then the API persists host assets, `KaseyaVsaAssetObserved`, `KaseyaVsaAgentObserved`, and `KaseyaVsaOfflineAgentObserved` signals, a redacted normalized-evidence artifact, and an `integration_synced` audit event.

Given the synced Kaseya VSA integration appears in Trust & Safety, when the tenant reads `/api/v1/tenants/current/trust-safety`, then the integration includes current health, last-sync time, and read-only VSA permissions without exposing secrets.

Given another tenant attempts to read or sync the first tenant's Kaseya VSA integration, when the API evaluates tenancy, then it returns not-found and does not operate on the first tenant's connector.

## Readiness Health

Requirement labels: `PRD-ReadinessRouteCoverage`, `PRD-Production-Readiness`, `PRD-API-First`, `PRD-Operational-Hardening`, `PRD-Observability`.

Given the API readiness route is called, when the service responds, then it includes readiness checks for `database`, `queue`, `evidence_store`, and `validation_sweep`.

Given a non-critical dependency is not configured or has not run yet, when readiness is computed, then the API reports that check as `skipped` or `degraded` rather than silently omitting it.

Given no hard dependency is down, when readiness is returned, then the route returns `status: "ready"`.

## Deployment Readiness Status

Requirement labels: `PRD-DeploymentStatusRouteCoverage`, `PRD-Production-Readiness`, `PRD-API-First`, `PRD-Security-Hardening`, `PRD-Operational-Hardening`.

Given a tenant administrator calls `GET /api/v1/system/deployment-status`, when required production configuration is missing, then the API returns readiness items, `ready: false`, and the missing required keys.

Given a required production setting such as `DATABASE_URL`, `PERISCAN_JWT_SECRET`, `PERISCAN_INTEGRATION_CREDENTIAL_KEY`, `PERISCAN_MODEL_CREDENTIAL_KEY`, `PERISCAN_REPORT_SHARE_SECRET`, or `PERISCAN_EMAIL_TRANSPORT` is configured, when deployment status is returned, then the item shows `configured: true` but does not expose secret values.

Given `PERISCAN_EMAIL_TRANSPORT=smtp`, when `PERISCAN_SMTP_HOST` is missing, then deployment status returns `ready: false` and lists `PERISCAN_SMTP_HOST` as a missing required key.

Given `PERISCAN_EMAIL_TRANSPORT=smtp`, when `PERISCAN_EMAIL_FROM` is missing, then deployment status returns `ready: false` and lists `PERISCAN_EMAIL_FROM` as a missing required key.

Given `PERISCAN_DEPLOYMENT_ENVIRONMENT=production` and `PERISCAN_EMAIL_TRANSPORT=console`, when deployment status is returned or the email transport is constructed, then Periscan refuses to treat the deployment as ready because console transport would log customer mail.

Given `PERISCAN_DEPLOYMENT_ENVIRONMENT=production`, when `PERISCAN_WEB_BASE_URL` is missing, localhost, or non-HTTPS, then deployment status returns `ready: false` and onboarding/recovery link generation fails closed instead of using `http://localhost:3000`.

Given a non-SMTP email transport is selected, when deployment status is returned, then `PERISCAN_SMTP_HOST` remains optional and does not block readiness.

Given all required deployment readiness keys are configured, when the tenant administrator reads deployment status, then the API returns `ready: true` and no required key is missing.

Given a viewer calls deployment status, when the API evaluates RBAC, then it returns forbidden without exposing deployment configuration.

## Public Report Share Secret Isolation

Requirement labels: `PRD-ReportDelivery-WebSurface`, `PRD-Production-Readiness`, `PRD-Security-Hardening`, `PRD-API-First`.

Given production mode is enabled and `PERISCAN_REPORT_SHARE_SECRET` is missing, when Periscan would sign a public report-share token, then the API fails closed and refuses to use `PERISCAN_JWT_SECRET` as a fallback.

Given production mode is enabled and `PERISCAN_REPORT_SHARE_SECRET` is configured, when a report share link is created, then the token is signed with the dedicated report-share secret and the audit event omits the bearer token.

## Due Fix Re-Verification

Requirement labels: `PRD-DueReverificationRouteCoverage`, `PRD-Fix-Verification`, `PRD-Continuous-Validation`, `PRD-API-First`, `PRD-Evidence-Auditable`.

Given a tenant has a fixed, mitigated, or partially fixed remediation with `verificationRequired` and a past `nextVerificationAt`, when a scope editor calls `POST /api/v1/remediations/reverify-due`, then the API invokes the existing fix-verification path and returns that remediation in the result set.

Given due re-verification runs, when the comparison cannot prove the fix is still closed, then the API records an honest verification event such as `Inconclusive` instead of preserving or inventing a fixed state.

Given a due remediation was re-verified and no longer has a settled fixed/mitigated status, when the due sweep is called again immediately, then the API returns no duplicate re-verification for that remediation.

Given another tenant calls the due re-verification route, when the API evaluates the request, then it only considers that tenant's remediations and does not expose or re-verify another tenant's records.

## Continuous Threat Feed Ingestion

Requirement labels: `PRD-ThreatFeedScheduleRouteCoverage`, `PRD-ThreatCenter`, `PRD-API-First`, `PRD-Signal-Fabric`, `PRD-Evidence-Auditable`.

Given a tenant ingests the supported CISA KEV threat feed, when new feed entries are available, then the API creates tenant-scoped advisory, package, evidence, missing-signal, validation-plan, readiness-report, and audit records through the same import path as manual advisories.

Given a tenant ingests the same threat feed entry more than once, when the API evaluates feed provenance, then the second ingestion skips the already-imported item and does not create duplicate advisory records.

Given a tenant sets a recurring threat-feed schedule, when the API reads `/api/v1/threat-feeds/schedule`, then it returns that tenant's persisted frequency and next due time.

Given a scheduled threat-feed ingestion is not yet due, when the tenant runs `/api/v1/threat-feeds/ingest-due`, then the API returns `ingested: false` without creating advisory records.

Given a scheduled threat-feed ingestion is due, when the tenant runs `/api/v1/threat-feeds/ingest-due`, then the API imports new advisory entries, returns `ingested: true`, and advances the next due time.

Given another tenant reads threat-feed schedule state, when no schedule exists for that tenant, then the API returns an unconfigured schedule without exposing another tenant's configuration.

## Mission And Job API Visibility

Requirement labels: `PRD-MissionJobRouteCoverage`, `PRD-API-First`, `PRD-Job-Scheduler`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant starts a policy-approved validation mission, when the API queues a validation run, then `/api/v1/missions/:id/runs/:runId` returns the queued run with the expected mission ID, module ID, run ID, status, and tenant ID.

Given a validation mission queues a run, when the tenant lists `/api/v1/jobs` with mission and status filters, then the API returns the corresponding tenant-owned queue job with queue name, job ID, validation run ID, and payload linkage to mission, run, and tenant IDs.

Given a tenant has a queue job ID, when they read `/api/v1/jobs/:jobId`, then the API returns only that tenant-owned job and preserves its queued status and validation-run linkage.

Given another tenant attempts to read the first tenant's run or job detail, when the API evaluates the request, then it returns not-found without exposing cross-tenant queue activity.

## Account Security

Requirement labels: `PRD-AccountSecurityRouteCoverage`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a user requests a password reset for an existing account, when they confirm with the delivered token, then the password changes, the old password fails, and the token cannot be reused.

Given a password reset is requested for an unknown account, when the API responds, then it returns the same accepted response without creating a reset token.

Given a user verifies email or accepts an invite with a token, when the token is valid, then the related user state changes and the token cannot be reused.

Given a user enables MFA, when they verify a valid TOTP code, then the API marks MFA active, returns one-time recovery codes, and requires a second factor on later password login.

Given a recovery code is used for login, when the same recovery code is reused, then the API rejects it as invalid.

Given a user regenerates recovery codes or disables MFA, when no password or valid TOTP code is supplied, then the API rejects the action with `reauth_required`.

Given a user disables MFA after re-authentication, when they log in again, then a password-only login succeeds and the user no longer has `mfaEnabledAt`.

## Governed Autonomous Engagements

Requirement labels: `PRD-EngagementRouteCoverage`, `PRD-API-First`, `PRD-Safety-Policy`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant owns a verified scope, when a scope editor runs a PlanOnly engagement without an explicit plan, then the API returns a default plan for the scope type, every step is `planned`, no evidence is created, and the engagement is persisted as `Planned`.

Given a tenant owns a verified scope, when a scope editor runs an Execute engagement with an allowed module, then the API returns an executed step with evidence IDs, signal count, run mode, and a persisted engagement status derived from the step outcomes.

Given an engagement plan references an unknown module, when the API evaluates the step, then that step is marked `failed` with a reason instead of executing unregistered code.

Given a tenant user reads or lists engagement history, when persisted engagements exist for the tenant, then the API returns only tenant-owned engagement records and writes read/run audit events.

Given a viewer or another tenant attempts to list or read engagement records, when the API evaluates the request, then it returns forbidden or not-found without exposing another tenant's engagement history.

## Outbound Webhooks

Requirement labels: `PRD-WebhookRouteCoverage`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates a webhook, when the API returns the response, then the signing secret is present only in that create response and the stored webhook contains only tenant, URL, event, enabled, creator, and timestamp metadata.

Given a tenant administrator lists or updates webhooks, when a webhook exists for the tenant, then the API returns the webhook metadata without any signing secret.

Given a tenant administrator sends a webhook test event, when the API accepts the request, then a pending tenant-scoped delivery record is created and its delivery ID is returned.

Given a tenant administrator lists webhook deliveries with a webhook filter, when deliveries exist for that webhook, then the API returns only matching tenant-owned delivery attempts.

Given a webhook delivery is permanently failed, when a tenant administrator lists dead-lettered deliveries, then the API returns that delivery with failure metadata.

Given a viewer or another tenant attempts to list or mutate webhook resources, when the API evaluates the request, then it returns forbidden or not-found without exposing or changing another tenant's webhooks or deliveries.

## API Key Access

Requirement labels: `PRD-ApiKeyRouteCoverage`, `PRD-ApiKeyAuthRouteCoverage`, `PRD-API-First`, `PRD-Tenant-Isolation`, `PRD-Evidence-Auditable`.

Given a tenant administrator creates an API key, when the API returns the response, then the secret is present only in that create response and the stored key contains only prefix, scopes, timestamps, creator, and tenant metadata.

Given a tenant administrator lists API keys, when keys exist for the tenant, then the API returns those keys without any secret values.

Given a tenant administrator rotates an active API key, when the API returns the response, then it returns a new one-time secret, updates the key prefix, clears last-used state, and writes an audit event.

Given a tenant administrator revokes an API key, when they later attempt to rotate it, then the API returns `409 api_key_revoked`.

Given a viewer or another tenant attempts to list or mutate API keys, when the API evaluates the request, then it returns forbidden or not-found without exposing or changing another tenant's API keys.

Given an active API key is sent as `Authorization: Bearer psk_*`, when the caller requests a permitted API route, then the API authenticates the key, derives the role from key scopes, binds the request to the key tenant, and updates `lastUsedAt`.

Given an API-key-authenticated request includes a conflicting tenant header, when the API resolves tenant context, then the key's tenant remains authoritative.

Given an API key has been rotated or revoked, when the old or revoked secret is used as a Bearer token, then the API returns unauthorized and does not grant route access.

Given an API key with non-admin scopes calls API-key management routes, when RBAC is evaluated, then the API returns forbidden without listing or mutating API keys.

## Policy Approval Governance

Requirement labels: `PRD-PolicyApprovalRouteCoverage`, `PRD-Safety-Policy`, `PRD-API-First`, `PRD-Evidence-Auditable`, `PRD-Tenant-Isolation`.

Given a verified tenant scope and a policy preview that returns `RequiresApproval`, when a tenant administrator lists pending approvals, then the API returns that policy decision with `approvalState: Pending`.

Given a policy decision does not require approval, when a tenant administrator attempts to approve it, then the API returns `409 approval_not_required`.

Given a policy decision requires approval, when a tenant administrator approves it, then the API preserves the original `RequiresApproval` outcome, updates `approvalState` to `Approved`, stamps `approvedAt` and `approvedBy`, removes it from the pending list, and writes an audit event.

Given a policy decision requires approval, when a tenant administrator denies it, then the API updates `approvalState` to `Rejected`, leaves approval proof fields empty, and writes an audit event.

Given a viewer or another tenant attempts to list or mutate approvals, when the API evaluates the request, then it returns forbidden or not-found without exposing or changing another tenant's policy decisions.

## Internal Runner

Requirement labels: `PRD-Runner-OutboundOnly`, `PRD-Runner-SignedTasks`, `PRD-Runner-ScopeEnforcement`, `PRD-Safety-VerifiedScope`, `PRD-Evidence-Auditable`, `PRD-API-First`.

Given a tenant admin is authenticated, when they create a runner registration token, then the API returns the token only once and stores only token metadata and hash-backed server state.

Given a runner has a valid registration token and CSR, when it calls `POST /api/v1/runners/register`, then the API creates an active runner and returns outbound long-poll settings, mTLS client certificate plus bearer-token transport auth, tenant CA certificate, runner client certificate, certificate fingerprint, a one-time runner auth token for local API verification, credential-expiry metadata, and task-signing public key material.

Given an active runner has a valid runner auth token and CSR, when it calls `POST /api/v1/runners/:id/credentials/rotate` with matching tenant/runner identity, then the API issues fresh client certificate material and task-signing key material, updates the runner certificate fingerprint, credential expiry, and version metadata, returns no new bearer auth token, and writes a `runner.credentials.rotated` audit event.

Given a runner calls credential rotation with mismatched tenant or runner identity, when the API evaluates the request, then the API rejects it before issuing material and writes a runner rejection audit event.

Given a customer deploys the internal runner container, when the production image is built, then it runs as a non-root user, defaults to long-running outbound polling, supports HTTP CONNECT proxy environment variables, and exposes no inbound service port.

Given the TypeScript runner-agent starts with default configuration, when it builds its local module allowlist, then it includes only passive or active non-invasive runner/recon modules and excludes offensive AgentLocal modules such as credential spraying, Kerberos user enumeration, and Metasploit checks unless the deployment explicitly opts in through local allowlist and safety-level environment variables.

Given runner documentation or deployment validation describes task dispatch, when it lists `/api/v1/runners/:id/tasks/measured` or `/api/v1/runners/:id/tasks/discover`, then it identifies those endpoints as TypeScript runner-agent AgentLocal dispatch surfaces and does not present them as Go runner binary modules.

Given an authenticated tenant user wants to design secure agent connectivity, when they call `GET /api/v1/runners/transport-decisions`, then the API returns all supported runner transport options with rationale and status values indicating allowed, optional, and disallowed channels.

Given a runner is active, when a tenant admin creates a reachability task for verified scope, then the API creates a policy decision, mission, run, tenant-scoped runner task, and signed task envelope.

Given a signed runner task includes an artifact upload URL, when the runner uploads evidence for that task, then the API authenticates the runner, enforces the signed max artifact size, verifies raw SHA-256 and byte length, stores redacted evidence through the evidence service, audits `evidence.created`, and allows the final result manifest to reference the uploaded evidence ID.

Given the release suite runs `pnpm test:runner:lab`, when the local runner lab executes, then loopback TCP/HTTP/TLS fixtures, signed in-scope reachability, DNS resolution, TLS certificate, and HTTP health tasks, artifact upload callbacks, and uploaded evidence manifests are validated without touching external targets.

Given scope is unverified or the target is outside scope constraints, when a tenant admin creates a reachability task, then the API denies the task before it can be polled.

Given a runner polls with its issued credential, when queued tasks exist, then the API returns signed `InternalRunner` envelopes only for that runner and marks them leased.

Given the Go runner receives a signed task envelope, when the envelope runner ID, expiry, digest, nonce, Ed25519 signature, execution environment, module allowlist, and scope constraints all validate, then the runner may execute only allowlisted safe internal modules: `runner.reachability_check`, `runner.dns_resolution_check`, `runner.tls_certificate_check`, or `runner.http_health_check`.

Given the Go runner receives an invalid signature, expired envelope, runner mismatch, non-`InternalRunner` task, unallowlisted module, out-of-scope host, out-of-scope DNS suffix, out-of-scope CIDR, or out-of-scope port, then it rejects the task locally before network execution and returns a failed evidence-backed result.

Given the Go runner receives an in-scope reachability, DNS, TLS certificate, or HTTP health task, when the scoped target can be checked safely, then it emits normalized evidence, a local audit hash, `Completed` status, and an evidence-backed validation state.

Given a runner submits a result for the correct tenant, runner, task, and run, when the result includes an evidence manifest, then the API stores evidence metadata, updates the validation run, updates the runner task, and writes an audit event.

Given a runner submits a result payload with a non-terminal status such as `Queued`, `Running`, `DeniedByPolicy`, `RequiresApproval`, or `Cancelled`, when the public result endpoint validates the request, then the API rejects it before updating the validation run, runner task, mission, evidence, signals, graph, or verification state.

Given a runner submits a `Completed` result with an empty evidence manifest, when the control plane evaluates the result, then the API rejects it with `runner_result_evidence_required`, writes a runner rejection audit event, and leaves validation run, runner task, mission, signal, graph, and verification state unchanged.

Given the TypeScript runner-agent successfully executes a signed task, when it prepares the result callback, then it first uploads a normalized runner-result artifact to the scoped artifact endpoint and includes the returned evidence ID, redaction status, hash, and size in the result manifest.

Given a tenant user marks a remediation ready for verification, when the API changes the remediation status to `VerificationPending`, then it writes a `remediation.ready_for_verification` audit event with prior status, ticket metadata, related path ID, actor, tenant, and remediation ID.

Given a tenant user creates a remediation ticket through a workflow integration, when the API routes the remediation to Jira, GitHub Issues, Linear, ServiceNow, PagerDuty, Opsgenie, Slack, or Microsoft Teams, then it writes a distinct `remediation.ticket.created` audit event with integration ID, ticket system, ticket ID, related path ID, actor, tenant, and remediation ID.

Given a runner submits a mismatched result, when identity fields do not match the task, then the API rejects the result and writes a runner rejection audit event.

## First-Customer Hardening

Requirement labels: `PRD-Core-ProofLoop`, `PRD-API-First`, `PRD-API-Reference`, `PRD-Safety-VerifiedScope`, `PRD-Safety-ExternalValidation`, `PRD-Tenant-Isolation`, `PRD-CI-ReleaseGates`.

Given a new user signs up through the API, when they run a Snapshot before verifying scope, then the API returns a verified-scope error and no Snapshot is created.

Given a tenant creates a Domain or Subdomain scope, when the scope is returned by the API, then it includes a `_periscan.<scope>` DNS TXT verification target and tenant-specific verification token.

Given the tenant publishes the verification token as a DNS TXT record, when they call `POST /api/v1/scopes/:id/verify` without `devModeManual`, then the API resolves DNS, marks the scope verified, and writes a `scope.verified` audit event.

Given the DNS TXT record is absent or does not contain the token, when they call the same verify endpoint, then the API returns `dns_verification_failed` and does not mark the scope verified.

Given the Workspace renders a pending DNS scope, when the user reviews the scope card, then it shows the exact TXT name and token and the Verify button submits `{}` rather than `{ "devModeManual": true }`.

Given the user creates and verifies a domain scope, when they connect authorized GitHub, AWS, and Jira integrations (fixture-backed in explicit test/lab mode) and sync the signal sources, then the API returns normalized signals and evidence-backed attack paths.

Given synced signals produce attack paths, when the user runs a Validation Snapshot, then the API returns top paths, evidence IDs, a ready evidence pack, and an HTML report containing top validated paths.

Given the user creates a remediation for a top path, when they create a Jira ticket, mark the task ready for verification, and call the verification endpoint, then the API creates a verification event, validation run, and linked evidence.

Given the verification endpoint is called for a remediation tied to a known path family, when Periscan creates the verification run, then the response includes a targeted fix-verification profile, selected module IDs, target family, and targeting rationale instead of a generic opaque retest marker.

Given an external validation mission targets `127.0.0.1`, when the user starts the safe Nuclei module from the external point of attack, then the API denies the mission before queueing jobs.

Given a tenant administrator is authenticated, when they call `GET /api/v1/external-validation/profiles`, then the API returns the allowlisted safe Nuclei profiles with display names, template IDs, rate defaults, max request limits, and safety notes.

Given a verified domain scope exists, when the user starts `nuclei.external_exposure_safe` with the `safe-http-headers` profile, then the external validation guard allows the narrowed profile and queues the fixture-backed module run.

Given a user requests an unallowlisted template profile, when the external validation guard evaluates the mission start, then the API denies the request as an unsafe template profile.

Given a second tenant tries to read an evidence artifact from the first tenant, when they call the evidence detail API, then the API returns `404`.

Given a push or pull request targets `main`, when GitHub Actions runs, then CI executes `pnpm verify` with Postgres and Redis services.

Given an API customer wants to automate against Periscan, when they call `GET /api/v1/api-reference`, then the API returns product-specific endpoint groups, method/path pairs, summaries, authentication mode, query-parameter names, request/response schema availability, request content types, response content types, success statuses, total endpoint count, and the linked OpenAPI route.

Given the API reference is generated, when its endpoints are compared to `GET /openapi.json`, then every API reference endpoint maps to an OpenAPI path and method.

Given an API customer inspects non-JSON endpoints, when they call `GET /api/v1/api-reference`, then Prometheus metrics list `text/plain`, shared and Snapshot reports list `text/html`, report exports list `text/html` and `application/pdf`, audit exports list `application/json` and `text/csv`, and no-content endpoints list their 204 status without claiming a response body.

Given query-bearing endpoints publish query controls, when an API customer inspects `GET /openapi.json`, then evidence, report, threat-advisory, signal-trigger activity, audit, policy-decision, job, mission, threat catalog, threat alert, webhook delivery, model-gateway audit, and tenant SSO authorization URL operations expose their supported query parameters with documented defaults, bounds, required flags, or enum values where applicable.

Given API customers inspect the OSS registry endpoints, when they call `GET /openapi.json` or `GET /api/v1/api-reference`, then open-source tool and capability catalog routes expose response schemas plus `phase`, `includeDeferred`, and `includeLegalReview` query metadata.

Given a tenant has more than 50 evidence artifacts, reports, or threat advisories, when an API customer calls `GET /api/v1/evidence`, `GET /api/v1/reports`, or `GET /api/v1/threat-advisories` without a `limit`, then each response returns the default bounded page of 50 items.

Given a tenant has more than one evidence artifact, report, or threat advisory, when an API customer calls those list endpoints with `?limit=1`, then each response returns one item.

## Operational Hardening

Requirement labels: `PRD-Operational-Hardening`, `PRD-Security-Boundary-Tests`, `PRD-Production-Readiness`, `PRD-CI-ReleaseGates`.

Given a tenant has only unverified scope, when they request a Validation Snapshot, then the API denies the request with a verified-scope error.

Given a verified scope receives a `Disallowed` safety-level policy decision, when the mission starts, then the API marks the mission `DeniedByPolicy` and queues zero jobs.

Given a tenant reaches the external-validation tenant rate limit, when they start another safe external validation mission in the same window, then the API denies the mission before adding a queue job.

Given one tenant owns an evidence artifact, when another tenant requests that artifact by ID, then the evidence API returns `404`.

Given a secrets validation module observes a fixture secret, when module evidence and summaries are serialized, then the raw secret value is absent and the evidence is marked redacted.

Given a runner task payload is missing its signature envelope, when it is validated against the shared runner task schema, then validation fails.

Given a release owner runs `pnpm verify`, when all gates execute, then the security-boundary suite runs before the API-first acceptance flow.

Given a release owner runs `pnpm test:e2e`, when the API server starts through Playwright, then the E2E harness signs up a user, verifies scope, connects fixture-backed GitHub/AWS/Jira integrations through the API, runs a Snapshot, creates remediation, verifies the fix, and exports HTML/PDF evidence reports through real HTTP API calls.

Given the API-driven E2E proof loop fails, when `pnpm verify` runs, then the release gate fails before customer onboarding.

Given a human reviewer prepares first-customer onboarding, when they read `PRODUCTION_READINESS.md`, then the checklist shows auth, tenant isolation, evidence protection, validation safety, runner security, OSS tooling, observability, backups, compliance, and release gates.

Given a tenant administrator calls `GET /api/v1/tenants/current/trust-safety`, when production operational settings are configured or left deployment-managed, then the response includes `operationalReadiness` controls for backups, restore testing, object retention, Redis persistence, log aggregation, alert routing, and incident contact with configured/deployment-managed status.

## Evidence Packs and Exports

Requirement labels: `PRD-Evidence-Packs`, `PRD-Reports-HTML-PDF`, `PRD-Evidence-Pack-Templates`, `PRD-No-Raw-Findings`, `PRD-API-First`.

Given a Snapshot report exists, when a customer calls `POST /api/v1/reports/:id/export` without a body or with `{ "format": "html" }`, then the API returns an HTML evidence pack with evidence-backed paths and report metadata.

Given a Snapshot report exists, when a customer calls `POST /api/v1/reports/:id/export` or `POST /api/v1/snapshots/:id/export` with `{ "format": "pdf" }`, then the API returns `application/pdf`, a PDF filename, and a generated PDF document from normalized Snapshot evidence.

Given a PDF export is generated, when evidence artifacts are listed or downloaded, then the PDF is stored as a `ReportExport` artifact and uses a `.pdf` storage URI.

Given an executive evidence pack is exported as PDF, when the document is generated, then it includes executive summary, metrics, top paths, remediation, verification, and safety notes while omitting the detailed evidence appendix.

Given a visitor opens `/demo`, when the page renders, then it clearly labels the content as public sample data and not real customer data.

Given the public demo renders, when the sample report preview is displayed, then it uses the shared Validation Snapshot report generator and includes top validated paths, control observations, AI app risks, remediation, verification, and evidence IDs without raw secrets.

Given a report is rendered for any supported evidence pack type, when the shared report generator runs, then the report includes the correct pack label, audience guidance, primary use, and redaction posture.

Given an audit-support or customer-review pack is rendered, when the report includes compliance support, then it links validation scope, evidence IDs, remediation, and verification planning without claiming certification status.

Given an AI app validation pack or control validation pack is rendered, when the Snapshot contains both AI and control signals, then each focused pack includes only its relevant validation section and omits the unrelated validation section.

Given an MSSP Client QBR is rendered, when the report generator runs, then it includes MSSP client delivery notes and a CTEM program view.

Given a Remediation Closure Pack is rendered, when the report generator runs, then it includes closure evidence counts and keeps items needing proof visible.

## Design Partner Delivery

Requirement labels: `PRD-DesignPartner-Mode`, `PRD-Analyst-Notes`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given a tenant administrator is authenticated, when they call `GET /api/v1/tenants/current/design-partner`, then the API returns tenant-scoped design-partner settings, onboarding checklist items, integration checklist items, latest Snapshot request status, and the latest analyst note if one exists.

Given a tenant administrator wants guided first-customer delivery, when they call `PUT /api/v1/tenants/current/design-partner` with `{ "enabled": true }`, then the API enables design-partner mode for that tenant and the workspace can render the checklist and preview state through API data alone.

Given design-partner mode is enabled and a Snapshot report exists, when a tenant administrator calls `PUT /api/v1/reports/:id/analyst-note`, then the API stores the note, labels it as a Periscan analyst note, regenerates the report artifacts, and writes an audit event.

Given an analyst note is attached to a report, when the latest Snapshot preview or HTML export is requested, then the report contains the note under a clearly labeled `Periscan Analyst Notes` section without altering the evidence-backed path content.

Given design-partner mode is disabled, when a tenant administrator tries to write an analyst note, then the API rejects the request instead of silently accepting a report override.

## Trust And Safety

Requirement labels: `PRD-Trust-Safety-Page`, `PRD-Audit-Log-Completeness`, `PRD-API-First`, `PRD-Production-Readiness`.

Given a tenant administrator is authenticated, when they call `GET /api/v1/tenants/current/trust-safety`, then the API returns connected integration transparency, evidence retention posture, validation safety principles, runner security model details, and an audit-log API path for that tenant.

Given connected integrations exist, when the Trust & Safety page loads, then it shows what Periscan reads, required permissions, supported missions, revoke guidance, and a disconnect action backed by the `DELETE /api/v1/integrations/:id` API.

Given connected integrations exist, when a tenant administrator clicks `Sync now`, then the UI calls `POST /api/v1/integrations/:id/sync` and refreshes Trust & Safety from `GET /api/v1/tenants/current/trust-safety`.

Given connected integrations exist, when a tenant administrator clicks `Refresh health`, then the UI calls `GET /api/v1/integrations/:id/health` and refreshes the connected-system health summary from tenant-scoped API data.

Given a tenant administrator filters `GET /api/v1/audit-events` by event type, date range, and user ID, when matching events exist, then the API returns only tenant-scoped events matching those filters in descending time order.

Given no audit events match the current filters, when the Trust & Safety view reloads audit history, then the UI shows an empty-state message instead of stale records.

## Integration Marketplace

Requirement labels: `PRD-Integration-Marketplace`, `PRD-Signal-Fabric`, `PRD-API-First`.

Given a tenant administrator is authenticated, when they call `GET /api/v1/integrations/catalog`, then the API returns at least 75 connector manifests with marketplace category, availability status, permission summary, supported missions, and connectability metadata.

Given a connector is marked `Planned`, when a tenant administrator calls `POST /api/v1/integrations` with that connector key, then the API rejects the request instead of creating a fake connected integration.

Given implemented beta connectors are in the catalog, when the Integration Marketplace page loads, then the web app renders those manifests from the API and offers mock connect actions only for connectable mock-supported connectors.

Given a tenant administrator connects a mock-supported connector from the Integration Marketplace, when the API returns the created integration, then the web app calls `POST /api/v1/integrations/:id/sync` and refreshes the connected integration list from the API.

Given planned connectors are in the catalog, when the Integration Marketplace page loads, then the web app shows them as planned and not connectable.

Given a tenant administrator uses marketplace search or category/status filters, when the filter changes, then the visible connector list updates from the API manifest data without querying a separate UI-only source.

Given marketplace filters match no connector manifests, when the filter changes, then the web app shows an empty state instead of leaving a blank grid.

Given a GitHub integration is configured with `authType: "pat"`, `mockMode: false`, and authorized repository names, when the connector syncs, then it calls GitHub REST metadata APIs, creates repository assets, emits repository/branch-protection/permission signals, and does not emit secret-scan candidates or raw repository content.

Given a GitLab integration is configured with `authType: "pat"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the access token while preserving group/project selection metadata.

Given a GitLab integration syncs through a PAT, when authorized projects are available, then it calls GitLab REST metadata APIs, creates repository assets, emits repository/branch-protection/permission signals, and does not fetch repository file content or emit secret-scan candidates.

Given an Okta integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving organization URL and inventory-scope toggles.

Given an Okta integration syncs through a read-only API token, when authorized users, groups, applications, and MFA factors are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, privileged-group, and SaaS application signals without mutating Okta configuration or exposing the API token.

Given a Cisco Duo integration is configured with `authType: "adminApi"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the integration key and secret key while preserving hostname and inventory toggles.

Given a Cisco Duo integration syncs through a read-only Admin API integration, when authorized users, groups, phones, and protected applications are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, privileged-group, Duo device, and protected-application signals without changing Duo users, policies, bypass codes, or authentication prompts and without exposing API credentials, phone numbers, or raw user emails.

Given a OneLogin integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the client secret while preserving account URL, client ID, and inventory toggles.

Given a OneLogin integration syncs through read-only OAuth API credentials, when authorized users, roles, and apps are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, privileged-role, and SaaS application signals using only read-only OneLogin endpoints and without creating, updating, deleting, assigning, cloning, or exposing OAuth credentials, access tokens, raw user emails, or app secrets.

Given a PingOne integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the client secret while preserving environment ID, regional API/auth base URLs, client ID, token endpoint auth method, and inventory toggles.

Given a PingOne integration syncs through a read-only Worker application, when authorized users, groups, and applications are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, privileged-group, and SaaS application signals using only token plus read-only users/groups/applications endpoints and without changing PingOne users, groups, apps, passwords, MFA devices, role assignments, application secrets, or policies.

Given an Auth0 integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the client secret while preserving tenant domain, Management API audience, client ID, and inventory toggles.

Given an Auth0 integration syncs through Management API machine-to-machine credentials, when authorized users, roles, and clients are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, privileged-role, and SaaS application signals using only token plus read-only users/roles/clients endpoints and without changing Auth0 users, roles, clients, passwords, role assignments, client secrets, or tenant settings.

Given a JumpCloud integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving base URL, organization ID, and inventory toggles.

Given a JumpCloud integration syncs through a read-only Admin API key, when authorized users, user groups, and SSO applications are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, privileged-group, and SaaS application signals using only read-only system users, user groups, and applications endpoints and without changing JumpCloud users, groups, applications, commands, passwords, MFA state, memberships, or policies.

Given a CyberArk integration is configured with `authType: "bearerToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the bearer token while preserving SCIM base URL and pagination/group toggles.

Given a CyberArk integration syncs through read-only Identity SCIM access, when authorized users and groups are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, and privileged-group signals using only read-only `/scim/v2/Users` and `/scim/v2/Groups` endpoints and without retrieving passwords, checking out privileged accounts, changing safes, mutating users/groups, changing MFA state, or invoking PAM credential workflows.

Given an Active Directory integration is configured with `authType: "ldapBind"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the bind password while preserving LDAP URL, base DN, bind DN, inventory toggles, paging limits, time limits, and TLS verification settings.

Given an Active Directory integration syncs through read-only LDAP/LDAPS access, when authorized users, groups, and computers are available, then Periscan emits normalized identity-store, privileged-identity, MFA-unknown, privileged-group, service-account, and delegated-computer signals using only bind/search/unbind operations and without requesting password/hash/Kerberos attributes, changing memberships, resetting accounts, or running attack tooling.

Given a Microsoft Entra ID integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the client secret while preserving tenant/client IDs and inventory-scope toggles.

Given a Microsoft Entra ID integration syncs through read-only Microsoft Graph credentials, when authorized users, groups, directory roles, and application registrations are available, then Periscan emits normalized identity-store, privileged-identity, privileged-group, directory-role, and SaaS application signals without mutating Entra configuration or exposing OAuth credentials.

Given a Google Workspace integration is configured with `authType: "serviceAccount"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the private key while preserving service-account email, delegated admin, customer ID, and inventory toggles.

Given a Google Workspace integration syncs through read-only Admin Directory credentials, when authorized users and groups are available, then Periscan emits normalized identity-store, privileged-identity, MFA posture, and privileged-group signals without mutating Google Workspace configuration, reading Gmail/Drive content, or exposing OAuth/private-key material.

Given a tenant administrator reviews the AWS connector manifest, when the API catalog is returned, then AWS exposes mock, static read-only credential, and STS AssumeRole auth methods with read-only permissions including `sts:AssumeRole` and `sts:GetCallerIdentity`.

Given an AWS integration is configured with `authType: "assumeRole"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts external IDs, access keys, and secret keys from API responses while leaving non-secret setup metadata visible.

Given an Azure integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the client secret while preserving tenant, client, subscription, and endpoint metadata.

Given an Azure integration syncs through a read-only service principal, when subscriptions, resources, and network security groups are available, then Periscan emits normalized subscription, cloud asset, security group, and public exposure signals without changing Azure configuration or presenting raw ARM payloads as primary output.

Given a Google Cloud integration is configured with `authType: "accessToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the access token while preserving project allowlist and endpoint metadata.

Given a Google Cloud integration syncs through read-only Cloud Resource Manager and Cloud Asset Inventory permissions, when projects, resources, and firewall rules are available, then Periscan emits normalized project, cloud asset, security group, and public exposure signals without changing Google Cloud configuration or presenting raw provider payloads as primary output.

Given a Kubernetes integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the bearer token while preserving API server URL, cluster name, namespace allowlist, and optional node-inventory metadata.

Given a Kubernetes integration syncs through a read-only service-account token, when authorized namespaces, pods, services, deployments, and network policies are available, then Periscan emits normalized cluster, namespace, workload, service, public-exposure, privileged-workload, service-account-token, and network-policy coverage signals without calling Secrets, logs, exec, attach, proxy, port-forward, or mutation endpoints and without presenting raw Kubernetes API payloads as primary output.

Given a DigitalOcean integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving API base URL and inventory toggles.

Given a DigitalOcean integration syncs through a read-only API token, when authorized account, Droplet, Firewall, and Kubernetes cluster metadata is available, then Periscan emits normalized account, Droplet, public-exposure, firewall-coverage, and Kubernetes cluster signals without calling action, create, update, delete, kubeconfig, credential, recycle, upgrade, registry, or other mutation endpoints and without presenting raw provider payloads or raw IP addresses as primary output.

Given a Heroku integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving Platform API base URL and inventory toggles.

Given a Heroku integration syncs through a read-only Platform API token, when authorized account, app, formation, and domain metadata is available, then Periscan emits normalized account, app, formation, public-domain exposure, and maintenance-mode signals without calling config-var, log, build, release, dyno, add-on, action, transfer, OAuth, authorization, or mutation endpoints and without presenting raw domain hostnames, commands, or provider payloads as primary output.

Given a Databricks integration is configured with `authType: "pat"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the personal access token while preserving workspace URL, inventory toggles, and workspace path metadata.

Given a Databricks integration syncs through a read-only workspace personal access token, when authorized cluster, job, SQL warehouse, and workspace object metadata is available, then Periscan emits normalized workspace, cluster, job, SQL warehouse, workspace-object, git-source, and cluster-access-mode signals without exporting notebooks, reading DBFS paths or secrets, executing commands, starting jobs, mutating clusters, running SQL queries, or presenting raw notebook paths, DBFS paths, SQL, task parameters, or provider payloads as primary output.

Given a Snowflake integration is configured with `authType: "accessToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the OAuth access token while preserving account URL, warehouse, database, role, and inventory toggles.

Given a Snowflake integration syncs through the SQL API, when authorized account metadata views are available, then Periscan emits normalized account, warehouse, database, schema, user, MFA-gap, and privileged-grant signals using only generated read-only `SELECT` metadata statements and without executing arbitrary customer SQL, DDL, DML, `COPY`, `PUT`, `GET`, `GRANT`, `REVOKE`, `CALL`, `USE`, table-data reads, or Snowflake object mutations.

Given a Slack integration is configured with `authType: "webhook"`, `mockMode: false`, and an incoming webhook URL, when the integration is created through the API, then Periscan stores it as a connected workflow destination and redacts the webhook URL from API responses.

Given a Microsoft Teams integration is configured with `authType: "webhook"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the webhook URL while preserving channel and card-color metadata.

Given a Microsoft Teams workflow destination receives a policy-gated validation or remediation event, when the connector runs in webhook mode, then it posts a workflow card to the authorized Teams channel and returns delivery metadata without exposing the webhook URL.

Given a Jira integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving Jira site, project key, issue type, and account email metadata.

Given a Jira workflow destination receives a policy-gated validation or remediation event, when the connector runs in API-token mode, then it posts an issue to the authorized Jira Cloud project and returns delivery metadata without exposing the API token.

Given a GitHub Issues integration is configured with `authType: "pat"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the GitHub token while preserving repository and label metadata.

Given a GitHub Issues workflow destination receives a policy-gated validation or remediation event, when the connector runs in PAT mode, then it posts an issue to the authorized repository and returns delivery metadata without exposing the GitHub token.

Given a Linear integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving team, label, and assignee metadata.

Given a Linear workflow destination receives a policy-gated validation or remediation event, when the connector runs in API-key mode, then it posts an issue to the authorized Linear team and returns delivery metadata without exposing the Linear API key.

Given a PagerDuty integration is configured with `authType: "eventsApi"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the routing key while preserving routing metadata.

Given a PagerDuty workflow destination receives a policy-gated validation or remediation event, when the connector runs in Events API mode, then it routes an incident trigger to the authorized PagerDuty service and returns delivery metadata without exposing the routing key.

Given an Opsgenie integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving alert routing metadata.

Given an Opsgenie workflow destination receives a policy-gated validation or remediation event, when the connector runs in API-key mode, then it creates an alert in the authorized Opsgenie account and returns delivery metadata without exposing the API key.

Given a ServiceNow integration is configured with `authType: "basicAuth"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the password while preserving instance URL, username, table, and assignment metadata.

Given a ServiceNow workflow destination receives a policy-gated validation or remediation event, when the connector runs in Table API mode, then it posts a record to the authorized ServiceNow table and returns delivery metadata without exposing the ServiceNow credential.

Given a ConnectWise Manage integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts public/private API keys while preserving API base URL, company ID, client ID, board ID, and default ticket company metadata.

Given a ConnectWise Manage integration syncs through API-key mode, when authorized company and service-ticket metadata is available, then Periscan emits normalized MSSP client, PSA company, ticket-state, and open-ticket signals without reading agreements, invoices, projects, devices, RMM agents, PSA configuration, or raw provider payloads as primary output.

Given a ConnectWise Manage workflow destination receives a policy-gated validation or remediation event, when the connector runs in API-key mode, then it creates an authorized service ticket and returns ticket metadata without exposing API keys or creating tickets outside explicit workflow delivery.

Given a ConnectWise Automate integration is configured with `authType: "basicAuth"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the REST password or bearer token while preserving API base URL, page controls, inventory toggles, and non-secret read-only username metadata.

Given a ConnectWise Automate integration syncs through REST credential mode, when authorized client, computer, and alert metadata is available, then Periscan emits normalized MSSP client, managed-computer, offline-computer, alert, and critical-open-alert signals using only read-only client, computer, and alert endpoints and without running scripts, agent procedures, commands, patch jobs, remote-control sessions, file/log retrieval, ticket mutation, client/computer changes, or system configuration writes.

Given a ConnectWise Automate integration is created through the public API in explicit fixture/lab mode, when a tenant syncs it through `/api/v1/integrations/:id/sync`, then Periscan persists encrypted credentials, redacted API responses, normalized assets, evidence-backed signals, a normalized-evidence artifact, sync audit metadata, Trust & Safety readout, and cross-tenant `404` denial for reads and syncs.

Given a NinjaOne integration is configured with `authType: "accessToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API access token while preserving API base URL, organization allowlist, page size, and inventory toggles.

Given a NinjaOne integration syncs through access-token mode, when authorized organization, device, and device-alert metadata is available, then Periscan emits normalized RMM organization, host/device, offline-device, alert, and critical-open-alert signals without running scripts, automations, actions, patch operations, remote sessions, ticket mutations, policy changes, or raw provider payloads as primary output.

Given a HaloPSA integration is configured with `authType: "clientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the client secret while preserving API base URL, auth base URL, client ID, default client, ticket routing, page size, and inventory toggles.

Given a HaloPSA integration syncs through OAuth client-credential mode, when authorized client and ticket metadata is available, then Periscan emits normalized MSSP client, PSA ticket, and open-ticket signals using only token plus read-only client/ticket endpoints and without mutating clients, sites, users, assets, billing, projects, configuration, or ticket state.

Given a HaloPSA workflow destination receives a policy-gated validation or remediation event, when the connector runs in client-credential mode, then it creates an authorized remediation ticket and returns ticket metadata without exposing OAuth credentials or creating tickets outside explicit workflow delivery.

Given an Autotask integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API integration code and secret while preserving API base URL, API username, default company, ticket routing, page size, and inventory toggles.

Given an Autotask integration syncs through API-user mode, when authorized company and ticket metadata is available, then Periscan emits normalized MSSP company, PSA ticket, and open-ticket signals using only read-only company/ticket query endpoints and without mutating companies, contacts, contracts, configuration items, projects, time entries, billing, users, or existing ticket state.

Given an Autotask workflow destination receives a policy-gated validation or remediation event, when the connector runs in API-user mode, then it creates an authorized remediation ticket and returns ticket metadata without exposing API credentials or creating tickets outside explicit workflow delivery.

Given a Syncro integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving API base URL, customer scoping, default ticket customer, ticket routing, page, and inventory toggles.

Given a Syncro integration syncs through API-token mode, when authorized customer, customer asset, and ticket metadata is available, then Periscan emits normalized MSSP customer, RMM asset, offline-asset, ticket, and open-ticket signals using only read-only customer, customer-asset, and ticket list endpoints and without mutating customers, assets, policies, scripts, invoices, payments, products, timers, line items, attachments, comments, or existing ticket state.

Given a Syncro workflow destination receives a policy-gated validation or remediation event, when the connector runs in API-token mode, then it creates an authorized remediation ticket and returns ticket metadata without exposing the API token or creating tickets outside explicit workflow delivery.

Given a remediation task exists from a policy-approved Validation Snapshot (or direct create), when an authenticated SCOPE_EDITOR calls `POST /api/v1/remediations/:id/create-ticket` with `integrationId` for a connected Syncro (or HaloPSA/Autotask/ConnectWise/NinjaOne etc.) destination, then Periscan resolves any workflow-capable integration (Jira fallback for compat when omitted), invokes the connector's `sendWorkflowEvent` with remediation-derived payload (evidenceIds, remediationId, summary, title, type), sets `ticketSystem` from connector/destination, persists to RemediationTask, returns ticket metadata, writes `remediation.ticket.created` audit, and never leaks secrets; works for mockMode and live (credential-gated); error states (no integration, unavailable workflow, delivery fail) return 4xx/5xx with codes.

Given an N-able N-central integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts access/JWT tokens while preserving API base URL, org-unit scoping, page size, and inventory toggles.

Given an N-able N-central integration syncs through API-token mode, when authorized customer, device, and active issue metadata is available, then Periscan emits normalized MSSP customer, RMM device, offline-device, and active-issue signals using only read-only customer, device, and active issue endpoints and without running scheduled tasks, scripts, patching, reboot, remote-control, credential, user, rule, probe, or agent mutation actions.

Given a Splunk integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving read-only search metadata.

Given a Splunk-backed control source is validated in dry-run mode, when the Splunk observer runs with an API token, then it performs an authorized read-only search for the validation context and returns `Logged` or `NoEvidence` evidence metadata without exposing the token or treating raw logs as the primary product output.

Given an Elastic Security integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving read-only alert-index search metadata.

Given an Elastic Security-backed control source is validated in dry-run mode, when the Elastic observer runs with an API key, then it performs an authorized read-only alert search for the validation context and returns `Alerted` or `NoEvidence` evidence metadata without exposing the key, creating rules, updating alerts, triggering actions, mutating cases, or treating raw alert rows as the primary product output.

Given a Datadog Cloud SIEM integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Datadog API and application keys while preserving non-secret read-only signal-search metadata.

Given a Datadog-backed control source is validated in dry-run mode, when the Datadog observer runs with API/application keys, then it performs an authorized read-only Security Monitoring signal search for the validation context and returns `Alerted` or `NoEvidence` evidence metadata without exposing Datadog credentials, creating monitors, mutating rules, opening incidents, ingesting logs, or treating raw signal rows as the primary product output.

Given a Google SecOps integration is configured with `authType: "accessToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the OAuth access token while preserving non-secret instance, query, time-window, and limit metadata.

Given a Google SecOps-backed control source is validated in dry-run mode, when the Google SecOps observer runs with a read-only OAuth token, then it performs an authorized Chronicle API UDM search for the validation context and returns `Logged` or `NoEvidence` evidence metadata without exposing Google credentials, ingesting logs, creating or mutating rules, changing cases, managing feeds, invoking SOAR actions, exporting raw logs, or treating raw UDM rows as the primary product output.

Given a Sumo Logic integration is configured with `authType: "basicAuth"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Sumo Access ID and Access Key while preserving non-secret Search Job query, time-window, polling, and limit metadata.

Given a Sumo Logic-backed control source is validated in dry-run mode, when the Sumo observer runs with Access ID/Access Key credentials, then it creates an authorized short-lived Search Job, polls readiness, reads matching messages, and returns `Logged` or `NoEvidence` metadata without exposing Sumo credentials, creating monitors, mutating content, changing collectors, managing users/roles, configuring ingest endpoints, or treating raw messages as the primary product output.

Given a Rapid7 InsightIDR integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Insight Platform API key while preserving non-secret Log Search query, time-window, logset, label, and limit metadata.

Given a Rapid7 InsightIDR-backed control source is validated in dry-run mode, when the Rapid7 observer runs with an API key, then it performs an authorized read-only Log Search query for the validation context and returns `Logged` or `NoEvidence` metadata without exposing Rapid7 credentials, creating alerts, investigations, detection rules, saved queries, reports, exports, log sets, collectors, users/roles, ingestion changes, or treating raw events as the primary product output.

Given an IBM QRadar integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the QRadar SEC token while preserving non-secret Ariel AQL query, API version, time-range, polling, and limit metadata.

Given an IBM QRadar-backed control source is validated in dry-run mode, when the QRadar observer runs with a SEC token, then it creates an authorized short-lived Ariel AQL search, polls readiness, reads matching results, and returns `Logged` or `NoEvidence` metadata without exposing QRadar credentials, updating or closing offenses, adding notes, creating rules, mutating analytics, changing configuration, modifying reference data, running scans, managing users, deploying changes, or treating raw Ariel rows as the primary product output.

Given a Microsoft Sentinel integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Entra application client secret while preserving non-secret workspace and query metadata.

Given a Microsoft Sentinel-backed control source is validated in dry-run mode, when the Sentinel observer runs with least-privilege Log Analytics credentials, then it performs an authorized read-only KQL query for the validation context and returns `Logged`, `Alerted`, or `NoEvidence` metadata without exposing Azure credentials or treating raw SIEM rows as the primary product output.

Given a Microsoft Defender XDR integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Entra application client secret while preserving non-secret Advanced Hunting query metadata.

Given a Microsoft Defender XDR-backed control source is validated in dry-run mode, when the Defender XDR observer runs with least-privilege Advanced Hunting credentials, then it performs an authorized read-only Advanced Hunting query for the validation context and returns `Alerted` or `NoEvidence` metadata without exposing Microsoft credentials, changing incidents, isolating devices, running live response, creating indicators, creating custom detections, quarantining content, or treating raw query rows as the primary product output.

Given a SentinelOne integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the SentinelOne API token while preserving non-secret console URL, query, scope, and limit metadata.

Given a SentinelOne-backed control source is validated in dry-run mode, when the SentinelOne observer runs with read-only API-token credentials, then it queries authorized threat evidence and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing SentinelOne credentials, mitigating threats, quarantining files, marking verdicts, adding exclusions, creating restrictions, running remote scripts, isolating endpoints, changing policies, or treating raw threat rows as the primary product output.

Given a Carbon Black integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Carbon Black API secret key while preserving non-secret console URL, org key, API ID, query, severity, and limit metadata.

Given a Carbon Black-backed control source is validated in dry-run mode, when the Carbon Black observer runs with read-only Alerts v7 credentials, then it performs an authorized alerts `_search` lookup and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing Carbon Black credentials, changing alert notes, changing workflow state, updating policies, isolating devices, running live response, triggering remediation, or treating raw alert rows as the primary product output.

Given a Sophos Intercept X integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Sophos Central client secret while preserving non-secret tenant, data-region API host, category, severity, product, and limit metadata.

Given a Sophos-backed control source is validated in dry-run mode, when the Sophos observer runs with Service Principal ReadOnly credentials, then it performs authorized Sophos Central alert search and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing Sophos credentials, acknowledging alerts, changing alert status, isolating devices, running scans, cleaning threats, changing endpoint policy, triggering remediation, or treating raw alert rows as the primary product output.

Given a Trend Vision One integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Trend API token while preserving non-secret API host, filter, time-window, ordering, and limit metadata.

Given a Trend-backed control source is validated in dry-run mode, when the Trend Vision One observer runs with Workbench view/filter/search access, then it performs authorized `GET /v3.0/workbench/alerts` lookup and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing Trend credentials, modifying alert status, assigning owners, adding notes, running response playbooks, isolating endpoints, changing detection models, triggering remediation, or treating raw alert rows as the primary product output.

Given a Palo Alto Cortex XDR integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Cortex XDR API key while preserving non-secret API host, API key ID, search window, status filters, sorting, and limit metadata.

Given a Cortex XDR-backed control source is validated in dry-run mode, when the Cortex XDR observer runs with authorized incident-read access, then it performs an authorized `POST /public_api/v1/incidents/get_incidents` lookup and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing Cortex credentials, updating incidents, isolating endpoints, running scripts, managing blocklists, changing policies, triggering remediation, or treating raw incident rows as the primary product output.

Given a CrowdStrike integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Falcon client secret while preserving non-secret read-only observer metadata.

Given a CrowdStrike-backed control source is validated in dry-run mode, when the Falcon observer runs with read-only OAuth credentials, then it queries authorized detection/prevention evidence and returns `Blocked`, `Detected`, or `Missed` metadata without exposing Falcon credentials or executing BAS actions from the cloud control plane.

Given a Cloudflare integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API token while preserving account, base URL, and allowed zone metadata.

Given a Cloudflare integration syncs through a read-only API token, when zones, DNS records, and WAF/ruleset metadata are available, then Periscan emits normalized zone, DNS, direct-origin exposure, and WAF posture signals without changing Cloudflare configuration or presenting raw API payloads as primary output.

Given a Fastly Next-Gen WAF integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API access token while preserving non-secret API host, API user email, corp, site, time-window, and limit metadata.

Given a Fastly WAF-backed control source is validated in dry-run mode, when the Fastly observer runs with authorized site-event read access, then it performs an authorized `GET /api/v0/corps/{corpName}/sites/{siteName}/events` lookup and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing Fastly credentials, changing rules, lists, redactions, alerts, agent keys, simulator requests, edge deployments, delivery integrations, or treating raw event rows as the primary product output.

Given an Akamai Kona integration is configured with `authType: "edgeGrid"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts EdgeGrid access token, client token, and client secret values while preserving non-secret API host, security configuration ID, polling window, offset, and limit metadata.

Given an Akamai-backed control source is validated in dry-run mode, when the Akamai observer runs with authorized SIEM Integration event-read access, then it performs an authorized `GET /siem/v1/configs/{configId}` lookup and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` metadata without exposing Akamai credentials, changing App & API Protector policies, security configurations, match targets, rules, activations, network lists, rate policies, remediation state, or treating raw event lines as the primary product output.

Given an Imperva Cloud WAF integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts API ID and API key values while preserving non-secret API host and pagination metadata.

Given an Imperva-backed control source is validated in dry-run mode, when the Imperva observer runs with authorized Cloud WAF Sites API list access, then it performs an authorized `POST /api/prov/v1/sites/list` lookup and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` posture metadata without exposing Imperva credentials, changing sites, certificates, custom rules, WAF rules, rate rules, ACLs, caching, DNS, DDoS settings, SIEM delivery configuration, or treating raw site payloads as the primary product output.

Given a Palo Alto Panorama integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the PAN-OS API key while preserving non-secret base URL, log type, query, limit, and polling metadata.

Given a Panorama-backed control source is validated in dry-run mode, when the Panorama observer runs with authorized PAN-OS XML API log access, then it performs authorized `POST /api/` log retrieval using `type=log` and `action=get` only and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` evidence metadata without exposing Panorama credentials, running operational commands, committing changes, changing policy, changing objects, updating User-ID state, updating dynamic objects, importing/exporting content, or treating raw XML log payloads as the primary product output.

Given a Fortinet FortiGate integration is configured with `authType: "apiToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the FortiOS API token while preserving non-secret base URL, VDOM, and policy limit metadata.

Given a FortiGate-backed control source is validated in dry-run mode, when the FortiGate observer runs with authorized FortiOS REST API monitor access, then it performs authorized `GET /api/v2/monitor/firewall/security-policy` queries and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` evidence metadata without exposing FortiGate credentials, calling CMDB mutation APIs, closing sessions, updating address fabric objects, changing policies, modifying objects, importing/exporting configuration, running CLI commands, or treating raw monitor payloads as the primary product output.

Given a Zscaler ZIA integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the OAuth client secret while preserving non-secret API base URL, token URL, client ID, scope, and pagination metadata.

Given a ZIA-backed control source is validated in dry-run mode, when the ZIA observer runs with authorized Cloud Service API firewall policy read access, then it performs authorized `GET /firewallFilteringRules` queries and returns `Blocked`, `Detected`, `Missed`, or `NoEvidence` evidence metadata without exposing Zscaler credentials, creating/updating/deleting firewall filtering rules, activating or exporting policies, submitting sandbox payloads, changing DNS/IPS/NAT/forwarding rules, changing VPN credentials, changing PAC files, or treating raw rule payloads as the primary product output.

Given an AWS WAF integration is configured with `authType: "staticCredentials"` or `authType: "assumeRole"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts AWS credential material while preserving region and WAF scope metadata.

Given an AWS WAF integration syncs through read-only WAFv2 permissions, when web ACLs and protected resources are available, then Periscan emits normalized WAF rule posture and resource coverage signals without changing AWS configuration or presenting raw provider payloads as primary output.

Given an Azure Front Door WAF integration is configured with `authType: "oauth2ClientCredentials"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the Azure client secret while preserving tenant, subscription, and WAF API metadata.

Given an Azure Front Door WAF integration syncs through read-only Azure Network permissions, when WAF policies and protected endpoints are available, then Periscan emits normalized WAF policy, rule posture, and resource coverage signals without changing Azure configuration or presenting raw provider payloads as primary output.

Given an OpenAI integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving organization/project routing metadata.

Given an OpenAI integration syncs through an API key, when model inventory is available, then Periscan emits normalized AI model context signals without executing prompts, sending validation test cases, or presenting raw provider payloads as primary output.

Given an Anthropic integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving base URL and API-version metadata.

Given an Anthropic integration syncs through an API key, when model inventory is available, then Periscan emits normalized AI model context signals without executing prompts, sending validation test cases, or presenting raw provider payloads as primary output.

Given an Azure OpenAI integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving endpoint, API version, and deployment allowlist metadata.

Given an Azure OpenAI integration syncs through an API key, when deployment inventory is available, then Periscan emits normalized AI deployment context signals without executing prompts, sending validation test cases, or presenting raw provider payloads as primary output.

Given a Google Vertex AI integration is configured with `authType: "accessToken"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the access token while preserving project, location, publisher, and query-limit metadata.

Given a Google Vertex AI integration syncs through read-only Vertex AI permissions, when endpoint and Model Garden inventory are available, then Periscan emits normalized AI endpoint and publisher model context signals without invoking models, generating content, deploying models, tuning models, or presenting raw provider payloads as primary output.

Given a Pinecone integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving API base URL and version metadata.

Given a Pinecone integration syncs through read-only control-plane access, when vector index inventory is available, then Periscan emits normalized vector-index context signals without querying vectors, listing records, upserting data, deleting data, embedding, reranking, or presenting raw provider payloads as primary output.

Given a Weaviate integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving the REST endpoint URL.

Given a Weaviate integration syncs through read-only REST access, when schema and metadata are available, then Periscan emits normalized vector-collection and vectorizer context signals without calling GraphQL, object, batch, backup, classification, vector search, tenant mutation, or presenting raw provider payloads as primary output.

Given an Azure AI Search integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving the endpoint and REST API version metadata.

Given an Azure AI Search integration syncs through read-only metadata access, when index definitions and service statistics are available, then Periscan emits normalized search-index, vector-search, semantic-search, CORS, and service-stat context signals without querying documents, running search/suggest/autocomplete, running indexers, changing skillsets/data sources, or presenting raw provider payloads as primary output.

Given a Chroma integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving base URL, tenant, database, and collection-limit metadata.

Given a Chroma integration syncs through read-only metadata access, when collection list and collection count are available, then Periscan emits normalized vector-collection, vector-index, sparse-vector, full-text, and collection-count context signals without reading records, querying/searching embeddings, adding/upserting/deleting data, resetting databases, or presenting raw provider payloads as primary output.

Given a LangChain integration is configured with `authType: "configImport"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts nested secret-like imported metadata while preserving non-secret application/component metadata.

Given a LangChain integration syncs from imported metadata, when chains, agents, tools, retrievers, vector stores, callbacks, or runnables are supplied, then Periscan emits normalized AI application structure and tool/RAG context signals without invoking LangChain runnables, agents, chains, tools, callbacks, retrievers, vector stores, embeddings, or model providers.

Given a LlamaIndex integration is configured with `authType: "configImport"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts nested secret-like imported metadata while preserving non-secret application/component metadata.

Given a LlamaIndex integration syncs from imported metadata, when indexes, query engines, retrievers, agents, tools, data sources, vector stores, or workflows are supplied, then Periscan emits normalized AI application structure, RAG, query-engine, tool, and workflow context signals without invoking LlamaIndex query engines, retrievers, agents, tools, workflows, vector stores, embeddings, or model providers.

Given a Guardrails AI integration is configured with `authType: "configImport"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts nested secret-like imported metadata while preserving non-secret guard, validator, policy, and endpoint metadata.

Given a Guardrails AI integration syncs from imported metadata, when guards, validators, policies, RAIL specs, server endpoints, or telemetry sinks are supplied, then Periscan emits normalized AI guardrail and control-observation context signals without invoking Guardrails guards, validators, RAIL specs, server endpoints, prompts, LLM calls, or model providers.

Given a Lakera Guard integration is configured with `authType: "apiKey"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts the API key while preserving non-secret project IDs, policy IDs, and Platform API URL metadata.

Given a Lakera Guard integration syncs through read-only project and policy metadata access, when configured project or policy IDs are available, then Periscan emits normalized project, policy, project-policy mapping, input-detector, output-detector, prompt-defense, data-leakage, malicious-link, content-moderation, and blocking-policy context signals without calling `/guard`, `/guard/results`, submitting prompts or outputs, fetching screening results, or exposing raw provider payloads as primary output.

Given an AWS Bedrock integration is configured with `authType: "staticCredentials"` or `authType: "assumeRole"` and no explicit `mockMode`, when the integration is created through the API, then Periscan stores it as non-mock by default and redacts AWS secrets while preserving non-secret region and role metadata.

Given an AWS Bedrock integration syncs through read-only AWS permissions, when foundation model inventory is available, then Periscan emits normalized AI foundation model context signals without invoking models, sending prompts, or presenting raw provider payloads as primary output.

Given an integration config contains access keys, access tokens, API keys, external IDs, passwords, client secrets, private keys, webhooks, or session tokens, when the integration is serialized for API responses, then those values are returned as `[redacted]` while non-secret setup metadata remains visible.

## Continuous Validation

Requirement labels: `PRD-Continuous-Validation`, `PRD-API-First`, `PRD-Safety-VerifiedScope`.

Given a tenant has at least one verified scope, when they create a `ValidationSnapshot` or `ContinuousValidation` schedule, then Periscan stores the schedule with frequency, next run time, scoped configuration, and active status.

Given a tenant attempts to create a schedule for an unsupported mission type, when the request is evaluated, then Periscan rejects the request before persisting a schedule.

Given an active schedule is run, when a previous scheduled Snapshot exists, then Periscan returns a current-vs-previous diff including added, removed, reopened, and risk-score delta fields.

Given a previously fixed path appears again in the current scheduled run, when the diff is calculated, then Periscan marks the path and related remediation as reopened.

## Signal-Driven Triggers

Requirement labels: `PRD-SignalDriven-Triggers`, `PRD-Continuous-Validation`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

Given a tenant user is authenticated, when they call `GET /api/v1/signal-triggers`, then the API returns enabled trigger rules for CVE, asset-change, policy-change, and missed-detection workflows with required scopes, integrations, safety levels, recommended mission type, and supported signal categories.

Given a tenant has no verified scope, when they call `POST /api/v1/signal-triggers/evaluate`, then every trigger evaluation returns `RequiresVerifiedScope` and no validation mission is created.

Given a tenant has verified repository scope, a connected GitHub integration, and a dependency advisory signal with evidence IDs, when trigger evaluation runs, then the CVE trigger returns `NeedsApproval`, matched signal IDs, evidence IDs, and recommended passive dependency modules.

Given a tenant has a policy-decision audit event, when trigger evaluation runs, then the policy-change trigger returns `NeedsApproval` with the matched audit event ID and does not queue validation work.

Given a tenant lacks required control telemetry or an internal runner, when missed-detection trigger evaluation runs, then the response returns `RequiresIntegration` or `RequiresInternalRunner` instead of implying control validation is ready.

Given matched trigger evaluations exist, when the user calls `GET /api/v1/signal-triggers/activity`, then the API returns tenant-scoped activity entries with trigger IDs, status, evidence IDs, signal IDs, audit event IDs, and recommended mission type.

Given matched trigger evaluations exist, when the user calls `GET /api/v1/signal-triggers/activity?limit=1`, then the API returns at most one activity entry and does not create validation missions or jobs.

Given a trigger evaluation is `NeedsApproval`, when a tenant admin or security engineer calls `POST /api/v1/signal-triggers/:id/approve`, then the API creates a policy decision and `Draft` validation mission linked to the trigger evidence, and no validation runs or jobs are queued.

Given signal-trigger routing is not configured, when a tenant admin calls `GET /api/v1/signal-triggers/routing`, then the API returns disabled default settings with no workflow destinations.

Given a tenant admin configures routing with a connected Jira, ServiceNow, Slack, or other workflow destination integration, when they call `PUT /api/v1/signal-triggers/routing`, then the settings are persisted and approval responses include routing readiness.

Given a tenant admin configures Slack routing and approves an actionable signal trigger, when the Slack destination supports workflow delivery, then the approval response includes delivery metadata and still creates only a draft validation mission.

Given a tenant admin configures routing with an integration outside the tenant, disconnected integration, or non-workflow integration, when they call `PUT /api/v1/signal-triggers/routing`, then the API rejects the request.

Given a trigger evaluation is `RequiresIntegration`, `RequiresVerifiedScope`, `RequiresInternalRunner`, or `NotConfigured`, when the user attempts approval, then the API rejects the request as not actionable and creates no mission.

Given a tenant has missing-signal records that require verified scope, integrations, internal runner coverage, or unimplemented proof inputs, when `GET /api/v1/findings` returns validated findings, then affected findings include `missingSignalImpact` with missing signal IDs, statuses, confidence adjustment, summary, and recommendation.

Given a tenant has missing-signal records, when `GET /api/v1/tenants/current/executive-trends` is called, then the response includes a `missing_signal_gaps` metric and a recommendation to close missing proof inputs before presenting risk reduction as fully validated.

## Operators and Evidence-Grounded Summaries

Requirement labels: `PRD-Operators`, `PRD-Evidence-Grounded-Summaries`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

Given a tenant has verified scope and evidence-backed attack paths, when they call `GET /api/v1/operator-recommendations`, then the API returns operator recommendations with evidence IDs, uncertainty labels, proposed actions, required integrations, safety level, and mission plan metadata.

Given a recommendation requires controlled validation, when the user approves it through `POST /api/v1/operator-recommendations/:id/approve`, then Periscan creates a policy decision and draft mission but does not start execution or queue jobs.

Given a recommendation has no verified scope, when the user attempts approval, then the API rejects the request as not actionable.

Given evidence IDs are supplied to `POST /api/v1/evidence-summaries`, when the summary is generated, then every claim cites evidence IDs and raw artifact contents are excluded.

Given no tenant-authorized evidence IDs are supplied, when the summary is generated, then the API returns an insufficient-evidence summary instead of inventing claims.

## Periscan Operators Source Coverage

Requirement labels: `SRC-3.8-OPERATORS`, `PRD-OP-001`, `PRD-OP-002`, `PRD-OP-003`, `PRD-OP-004`, `PRD-OP-005`, `PRD-OP-006`, `PRD-OP-007`.

Given PRD section 3.8 lists Red Team, Blue Team, Exposure, Remediation, Evidence, and AI App Security Operators, when source-derived module tests run, then every PRD operator maps to a public `OperatorType`, profile name, purpose, capabilities, and supported mission type.

Given a tenant has normalized evidence for attack paths, missed controls, exposure posture, open remediations, evidence packs, and AI app risks, when `GET /api/v1/operator-recommendations` or the operator package generator is used, then every returned recommendation cites evidence IDs, labels uncertainty, includes proposed actions, declares safety level, and has an approval-gated mission plan.

Given a tenant has only configuration counts with no normalized evidence IDs, when operator recommendations are generated, then no proofless recommendation is returned and no outcome is invented.

Given a user approves an operator recommendation through `POST /api/v1/operator-recommendations/:id/approve`, when the recommendation is actionable, then Periscan previews policy and creates a draft mission, but does not start the mission or queue module execution.

Given normalized control evidence uses descriptive labels such as `Missed credential-use detection`, when recommendations are generated, then the Blue Team Operator treats the signal as a control-validation gap while still citing the underlying evidence ID.

## Safe AI And Control Validation Catalogs

Requirement labels: `PRD-AI-Control-Safe-Catalogs`, `PRD-AI-App-Validation`, `PRD-Control-Validation`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

Given a tenant user is authenticated, when they call `GET /api/v1/ai-apps/validation-suites`, then the API returns safe AI app validation suites for prompt injection, RAG authorization, sensitive data leakage, unsafe tool invocation, and guardrail drift with safety level, evidence types, prohibited behaviors, and supported execution modes.

Given a tenant user calls `POST /api/v1/ai-apps/:id/validate` without an execution mode, when the AI app has verified scope, then Periscan uses the `LiveSafe` mode and records an inconclusive benign endpoint probe rather than a fixture-backed pass/fail outcome.

Given a tenant user includes `fixtureOutcome` without `{ "executionMode": "Fixture" }`, when the validation request is parsed, then the API rejects the request instead of allowing fixture data to influence a live-safe validation.

Given a tenant user explicitly requests `{ "executionMode": "LiveSafe" }` with safe test cases, when the AI app has verified scope and policy allows controlled validation, then Periscan carries bounded harness, timeout, and test-case metadata into the validation run.

Given a live-safe AI endpoint probe receives a successful 2xx response, when Periscan stores the module output, then the probe result remains `Inconclusive`, the run validation state remains `Inconclusive`, and the endpoint-probe signal is not promoted into validated findings or Snapshot AI risk lists unless a real approved Promptfoo/PyRIT/Garak harness result provides evidence.

Given a tenant user is authenticated, when they call `GET /api/v1/control-sources/validation-scenarios`, then the API returns dry-run control validation scenarios with ATT&CK technique IDs, expected control behaviors, prohibited behaviors, evidence types, and dry-run-only defaults.

Given a tenant user calls `POST /api/v1/control-sources/:id/validate` without an execution mode, when the control source has verified tenant scope, then Periscan creates a dry-run validation target and never attempts live Atomic-style execution.

Given a tenant user explicitly requests `{ "executionMode": "LiveRunner" }` or `{ "dryRun": false }` through the control-plane validation endpoint, when the request is evaluated, then Periscan rejects it before creating mission work and explains that live control execution requires an explicitly approved internal-runner workflow.

Given a tenant has a control source but no control-observation signals, when they call `GET /api/v1/control-sources/:id/rule-coverage`, then every ATT&CK-mapped dry-run scenario is returned as `NotTested` with an initial validation recommendation.

Given a tenant runs dry-run control validation and the SIEM observer returns `Logged`, when they call `GET /api/v1/control-sources/rule-coverage`, then the matching technique is marked `LoggedOnly` with signal IDs, evidence IDs, expected behaviors, observed behaviors, and an alert-routing tuning recommendation.

Given a tenant runs dry-run control validation and the observer returns no evidence, when rule coverage is calculated, then the matching technique is marked `NoEvidence` and recommends telemetry ingestion or observer-access review.

Given the latest matching control-observation signal is older than the stale threshold, when rule coverage is calculated, then the matching technique is marked `Stale` instead of covered.

## Unified Validated Findings

Requirement labels: `PRD-Delta-EPIC-1`, `PRD-Delta-EPIC-3`, `PRD-Delta-EPIC-4`, `PRD-Delta-EPIC-5`, `PRD-Delta-EPIC-9`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given a tenant has BAS, attack-path, and exposure-validation evidence, when an authenticated user calls `GET /api/v1/findings`, then the response includes all three source motions in one prioritized queue.

Given a validated finding exists, when an authenticated user calls `GET /api/v1/findings/:id`, then the response includes source, evidence IDs, impact, remediation, exploitability, lifecycle status, priority rationale, and cross-links to related paths or remediation tasks.

Given an API customer filters the findings queue by source motion, asset, severity, exploitability, or status, when they call `GET /api/v1/findings` with supported query parameters, then the response contains only matching tenant-scoped findings.

## OSS Tool Productization

Requirement labels: `PRD-OSS-ProductizedModules`, `PRD-OSS-Policy-GatedExecution`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`, `PRD-No-Raw-Findings`.

Given a tenant user is authenticated, when they call `GET /api/v1/open-source-tools` or `GET /api/v1/open-source-capabilities`, then each tool and capability response includes runtime availability, runtime kind, readiness reason, last checked time, and execution readiness.

Given an API customer wants enabled current OSS catalog views, when they call `GET /api/v1/open-source-tools?phase=Current&includeDeferred=false&includeLegalReview=false` or the same query against `/api/v1/open-source-capabilities`, then the response excludes deferred and legal-review-only items while preserving normalized runtime metadata.

Given a tenant user is authenticated, when they call `GET /api/v1/modules`, then productized OSS modules expose tool IDs, required scope types, required integrations, safety level, approval requirement, fixture support, live support, and evidence output metadata.

Given a verified repository scope and an allowed passive-read-only policy decision exist, when a mission starts `trivy.repo_dependency_scan` and `osv.repo_dependency_scan` in fixture mode, then the API queues jobs for both modules and the worker can normalize their results into evidence-backed signals.

Given a verified internal-network scope and an allowed passive-read-only policy decision exist, when a mission starts `bloodhound.identity_pathing` with approved import graph data, then the API queues the import module and the worker can produce identity-path evidence without executing a collector.

Given a tenant attempts to start `atomic.control_validation_safe` with `dryRun: false`, when the mission start request is evaluated, then Periscan marks the mission `DeniedByPolicy`, queues zero jobs, and writes a policy audit event even if the target carries historical approval metadata.

Given a high-impact module such as `web.sqli_probe`, `identity.cred_spray`, `exploit.metasploit_check`, or `identity.kerberos_userenum` is invoked directly with `dryRun: false`, when the module executes, then it returns an `Inconclusive` disabled-live-execution result with redacted evidence and does not call the underlying OSS tool.

Given a tenant attempts to start `caldera.advanced_adversarial`, when the mission start request is evaluated, then Periscan denies execution before queueing jobs because live advanced-adversarial execution is disabled by default.

Given a tenant attempts BloodHound identity pathing with SharpHound collection enabled, when the mission start request is evaluated, then Periscan denies execution before queueing jobs because SharpHound collection remains blocked for legal review even if the target carries approval metadata.

## OSS License Governance

Requirement labels: `PRD-OSS-License-Governance`, `PRD-OSS-ProductizedModules`, `PRD-CI-ReleaseGates`.

Given dependencies, OSS validation tools, or module manifests change, when a release owner runs `pnpm licenses:write`, then `licenses/THIRD_PARTY_NOTICES.md` is regenerated from package metadata, tool definitions, and module manifests.

Given generated notices are stale, when `pnpm licenses:check` runs, then the command fails and instructs the release owner to regenerate notices.

Given an AGPL, unknown, unlicensed, or enabled GPL-family entry appears, when license policy validation runs, then CI fails closed before release.

Given SharpHound remains GPL and blocked for legal review, when license policy validation runs, then it is reported as legal-review blocked but does not enable execution or fail the release gate.

## Enterprise Foundation

Requirement labels: `PRD-MSSP-Multitenancy`, `PRD-WhiteLabel-Reports`, `PRD-Billing-Metering`, `PRD-API-First`.

Given a user signs up as an MSSP tenant owner, when they create a client tenant, then the client tenant is stored with the MSSP as its parent and the owner receives a direct child-tenant membership.

Given an MSSP owner has a child tenant membership, when they send `x-periscan-tenant-id` for the client tenant, then API routes operate in that client tenant context.

Given a client tenant has white-label branding enabled, when a Snapshot report is generated and exported, then the HTML report includes the configured organization name, footer, support email, and accent color.

Given a tenant administrator calls billing APIs, when usage is read, then the API returns meter definitions and current tenant-scoped counts for assets, identities, control sources, AI apps, missions, runs, runner minutes, evidence packs, client tenants, and audited API usage.

Given an MSSP owner has child client tenants with scopes, integrations, validation runs, reports, and remediation work, when they call `GET /api/v1/tenants/current/client-portfolio`, then the API returns only that MSSP's child client summaries with readiness status, coverage, latest activity, risk counts, branding, and usage meters derived from tenant data.

Given the MSSP portfolio page loads, when it renders client summaries, then it consumes the client portfolio API and does not compute or invent client readiness in UI-only state.

Given a standard Organization tenant, when it attempts to create a client tenant, then the API rejects the request because only MSSP tenants can create client tenants.

Given a standard Organization tenant calls `GET /api/v1/tenants/current/client-portfolio`, then the API rejects the request because only MSSP tenants can view client portfolios.

Given a tenant has validated findings, evidence packs, remediations, verification events, scopes, and integrations, when an authenticated user calls `GET /api/v1/tenants/current/executive-trends`, then the API returns tenant-scoped metrics, proof-delivery status, remediation velocity, and recommendations derived from those records.

Given an MSSP owner switches into a child client tenant with `x-periscan-tenant-id`, when they call `GET /api/v1/tenants/current/executive-trends`, then the API returns only that child tenant's executive trend data and does not aggregate unrelated parent or sibling data.

## Release Completion Reporting

Requirement labels: `PRD-Completion-Report`, `PRD-CI-ReleaseGates`, `PRD-Production-Readiness`.

Given a release owner reviews first-customer readiness, when they open `docs/COMPLETION_REPORT.md`, then the report summarizes PRD coverage, implementation evidence, validation evidence, assumptions, production-readiness state, manual reviewer steps, and remaining limitations.

Given a completion report claims a release gate passed, when a human reviewer follows the manual verification steps, then the commands and API surfaces referenced in the report exist in the repository documentation.

Given a feature is deployment-managed or credential-dependent, when the completion report lists its state, then the report distinguishes that dependency from implemented repository functionality.

## Supabase Deployment Compatibility

Requirement labels: `PRD-Supabase-DeploymentCompatibility`.

Given a deployment sets `SUPABASE_DB_URL` and does not set `DATABASE_URL`, when `getPrismaClient()` is called, then the API initializes Prisma against `SUPABASE_DB_URL`.

Given a deployment sets `SUPABASE_STORAGE_ENDPOINT`, `SUPABASE_STORAGE_BUCKET`, `SUPABASE_STORAGE_ACCESS_KEY_ID`, and `SUPABASE_STORAGE_SECRET_ACCESS_KEY`, when Periscan initializes evidence storage, then it uses S3-compatible bucket storage through those aliases.

Given a deployment sets `SUPABASE_STORAGE_ENDPOINT` on a Supabase URL and omits `SUPABASE_STORAGE_FORCE_PATH_STYLE`, when storage client config is derived, then path-style addressing resolves to virtual-host style by default (`false`) to match Supabase S3 defaults.

Given verification runs through `scripts/verify.sh` with only Supabase aliases set, when the script evaluates database URL resolution, then it uses the Supabase alias values rather than the local compose default.

## Threat Center Manual Advisory Import

Requirement labels: `PRD-ThreatCenter-ManualImport`, `PRD-API-First`, `PRD-Evidence-Auditable`, `PRD-Safety-Policy-Bounded`.

Given a tenant administrator posts a manual advisory with title, source name, summary, and raw content, when `POST /api/v1/threat-advisories` succeeds, then Periscan creates a tenant-scoped advisory, threat package, raw/redacted evidence artifact, impact assessment, missing signals, non-executing validation plan, readiness report, and audit event.

Given advisory raw content and explicit indicator inputs contain overlapping CVEs, IoCs, or MITRE technique IDs, when import completes, then the advisory stores normalized deduplicated values and does not treat them as validation proof.

Given raw advisory text contains URLs, domains, IPv4 addresses, SHA-256 hashes, SHA-1 hashes, MD5 hashes, CVEs, and MITRE technique IDs, when import completes, then Periscan extracts those supported indicators conservatively, normalizes them, and preserves them in the advisory package as context only.

Given an advisory import includes a `sourceUrl`, when indicators are extracted, then Periscan treats the URL as publisher metadata and does not promote the source URL or source domain into IoCs unless they also appear in explicit IoCs or advisory content.

Given a tenant lacks verified scope, integrations, control telemetry, an internal runner, or an AI app scope for AI-related advisories, when import completes, then the readiness report is `MissingSignals` and each missing prerequisite is shown explicitly.

Given a tenant has an AI Stack integration but no verified `AIApplicationEndpoint` scope or AI app registered to one, when an AI/RAG/tooling advisory is imported, then `ai_app_scope` remains a missing signal and readiness does not advance to `RequiresApproval` or `Ready`.

Given a tenant has verified scope, code/cloud/control prerequisites, and an active internal runner but no advisory validation has executed, when import completes, then the readiness report is `RequiresApproval` and no validation mission or job is queued.

Given a tenant has all required prerequisites and completed validation evidence mapped to advisory CVEs, IoCs, or MITRE technique IDs, when import completes, then the readiness report is `Ready`, the advisory conclusions include the matched validation evidence IDs, and if any required signal source is absent, then `MissingSignals` takes precedence and confidence is reduced.

Given tenant A imports an advisory, when tenant B requests that advisory or readiness report by ID, then the API returns `404` and does not disclose tenant A advisory data.

Given imported raw advisory content contains credential-like strings, when the raw evidence artifact is downloaded, then the stored content is redacted and raw secret values are absent.

Given an authenticated tenant opens `/threat-center`, when no advisories have been imported, then the page renders an honest empty state from `GET /api/v1/threat-advisories` rather than fixture data.

Given a tenant imports an advisory from the Threat Center page, when the form is submitted, then the UI calls `POST /api/v1/threat-advisories`, refreshes `GET /api/v1/threat-advisories`, and renders the returned readiness report, missing signals, non-executing validation plan, and evidence IDs.

Given the Threat Center UI displays a selected advisory, when missing prerequisites exist, then it labels `RequiresVerifiedScope`, `RequiresIntegration`, or `RequiresInternalRunner` explicitly and does not imply validation has executed.

Given a selected advisory has a readiness report, when a tenant user requests `POST /api/v1/threat-advisories/:id/readiness-report/export` with `format: "html"` or `format: "pdf"`, then Periscan returns a downloadable report generated from normalized advisory/readiness data and stores a `ReportExport` evidence artifact.

Given an advisory readiness export is generated, when the readiness report is read again, then `evidencePackId` is populated and generic `POST /api/v1/reports/:id/export` can export the same advisory evidence pack.

Given raw advisory content contains credential-like material, when the readiness report is exported, then raw advisory content and secret values are absent from the report body.

## Microsoft Defender Email Connector

Requirement labels: `PRD-EmailSecurity-Connector`, `PRD-Control-Validation`, `PRD-API-First`, `PRD-Safety-Policy-Bounded`.

Given an authenticated tenant creates a Microsoft Defender for Office 365 integration with Graph client credentials, when the API response is returned, then `clientSecret` is redacted and the connector is categorized as `SecurityControl` and `Email Security`.

Given a Defender email connector is synced in fixture or authorized live mode, when sync completes, then Periscan returns normalized `ControlObservation` signals for email-security control posture, incidents, alerts, and MITRE technique observations without storing OAuth secrets or access tokens.

Given a control-validation observer asks the Defender email connector for evidence, when fixture or live read-only lookup finds alerts or incidents, then the observer returns `Alerted`; when no evidence is found, it returns `NoEvidence` rather than claiming prevention or fix status.

Given an authenticated tenant creates a Google Gmail Security integration with an OAuth access token, when the API response is returned, then `accessToken` is redacted and the connector is categorized as `SecurityControl` and `Email Security`.

Given a Gmail Security connector is synced in fixture or authorized live mode, when sync completes, then Periscan performs read-only Google Alert Center `alerts.list` requests, returns normalized `ControlObservation` signals for email-security posture, Gmail alerts, phishing, and malware observations, and does not read Gmail message content, send alert feedback, delete/undelete alerts, mutate rules, or change settings.

Given a control-validation observer asks the Gmail Security connector for evidence, when fixture or live read-only lookup finds Gmail security alerts, then the observer returns `Alerted`; when no evidence is found or lookup fails, it returns `NoEvidence` rather than claiming prevention or fix status.

Given an authenticated tenant creates a Proofpoint TAP integration with SIEM API service credentials, when the API response is returned, then `secret` is redacted and the connector is categorized as `SecurityControl` and `Email Security`.

Given a Proofpoint TAP connector is synced in fixture or authorized live mode, when sync completes, then Periscan performs read-only `GET /v2/siem/*` requests with `format=json` and a bounded `sinceSeconds` window, returns normalized `ControlObservation` signals for email-security posture and TAP threat events, and does not call quarantine, release, delete, remediation, allowlist, blocklist, policy, settings, or user mutation endpoints.

Given a control-validation observer asks the Proofpoint TAP connector for evidence, when blocked TAP SIEM events are returned, then the observer returns `Blocked`; when delivered or issue events are returned, then it returns `Detected`; when no records are returned or lookup fails, then it returns `NoEvidence` rather than claiming prevention or fix status.

Given an authenticated tenant creates a Mimecast integration with SIEM API credentials, when the API response is returned, then `accessKey`, `secretKey`, `applicationKey`, and SIEM continuation `token` are redacted and the connector is categorized as `SecurityControl` and `Email Security`.

Given a Mimecast connector is synced in fixture or authorized live mode, when sync completes, then Periscan performs authorized read-only `POST /api/audit/get-siem-logs` requests for SIEM log retrieval, returns normalized `ControlObservation` signals for email-security posture and MTA events, and does not call release, delete, policy, group, user, remediation, block/permit-list, or message mutation endpoints.

Given a control-validation observer asks the Mimecast connector for evidence, when blocked/held/rejected/quarantined gateway events are returned, then the observer returns `Blocked`; when other matching MTA events are returned, then it returns `Detected`; when no records are returned or lookup fails, then it returns `NoEvidence` rather than claiming prevention or fix status.

Given an authenticated tenant creates an Abnormal Security integration with an API access token, when the API response is returned, then `accessToken` is redacted and the connector is categorized as `SecurityControl` and `Email Security`.

Given an Abnormal Security connector is synced in fixture or authorized live mode, when sync completes, then Periscan performs authorized read-only `GET /v1/threats` requests for threat-log retrieval, returns normalized `ControlObservation` signals for email-security posture and threat events, and does not call threat-status, remediation, abuse-mailbox, mailbox, message-action, move, trash, delete, release, policy, or user mutation endpoints.

Given a control-validation observer asks the Abnormal Security connector for evidence, when auto-remediated or post-remediated threat-log records are returned, then the observer returns `Blocked`; when other matching threat-log records are returned, then it returns `Detected`; when no records are returned or lookup fails, then it returns `NoEvidence` rather than claiming exploitability, prevention, remediation, or fix status.

## Bitbucket Connector

Requirement labels: `PRD-Bitbucket-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Bitbucket Cloud integration with username, workspace, and app password/API token, when the API response is returned, then the secret is redacted and the integration is categorized as `Code`.

Given the Bitbucket connector syncs in fixture or authorized live mode, when repository metadata and branch restrictions are read, then Periscan emits normalized repository assets plus `Repository`, `BranchProtection`/`BranchProtectionMissing`, and `RepoPermission` signals without fetching repository contents.

## Azure DevOps Connector

Requirement labels: `PRD-AzureDevOps-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an Azure DevOps integration with organization and PAT, when the API response is returned, then the PAT is redacted and the integration is categorized as `Code`.

Given the Azure DevOps connector syncs in fixture or authorized live mode, when projects, repositories, and policy configurations are read, then Periscan emits normalized repository assets plus `Repository`, `BranchProtection`/`BranchProtectionMissing`, and `RepoPermission` signals without calling source-file item APIs or cloning repositories.

## Buildkite Connector

Requirement labels: `PRD-Buildkite-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Buildkite integration with organization and API token, when the API response is returned, then the token is redacted and the integration is categorized as `Code`.

Given the Buildkite connector syncs in fixture or authorized live mode, when pipeline metadata is read, then Periscan emits normalized pipeline assets plus repository-link and control-context signals without reading build logs, artifacts, or secrets.

## CircleCI Connector

Requirement labels: `PRD-CircleCI-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a CircleCI integration with project slugs and API token, when the API response is returned, then the token is redacted and the integration is categorized as `Code`.

Given the CircleCI connector syncs in fixture or authorized live mode, when project pipeline metadata is read, then Periscan emits normalized pipeline assets plus repository-link and control-context signals without reading job logs, artifacts, environment variables, or triggering workflows.

## Jenkins Connector

Requirement labels: `PRD-Jenkins-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Jenkins integration with base URL, username, and API token, when the API response is returned, then the API token is redacted and the integration is categorized as `Code`.

Given the Jenkins connector syncs in fixture or authorized live mode, when job and last-build metadata is read, then Periscan emits normalized pipeline assets plus repository-gap, build-status, and control-context signals without triggering builds, reading console logs, downloading artifacts, reading credentials, accessing `config.xml`, or using script console.

## Docker Hub Connector

Requirement labels: `PRD-DockerHub-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Docker Hub integration with namespace, optional repository names, and optional access token, when the API response is returned, then the token is redacted and the integration is categorized as `Code`.

Given the Docker Hub connector syncs in fixture or authorized live mode, when repository and tag metadata is read, then Periscan emits normalized container repository assets, public/private exposure signals, and tag metadata signals without pulling image layers, manifests, or blobs.

## GitHub Container Registry Connector

Requirement labels: `PRD-GitHubContainerRegistry-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a GitHub Container Registry integration with owner, owner type, package names, and a GitHub token, when the API response is returned, then the token is redacted and the integration is categorized as `Code`.

Given the GitHub Container Registry connector syncs in fixture or authorized live mode, when package and version metadata is read, then Periscan emits normalized container package assets, public/private exposure signals, version signals, and tag metadata signals without pulling images, manifests, blobs, or layers.

## AWS ECR Connector

Requirement labels: `PRD-AWSECR-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an AWS ECR integration with static credentials or AssumeRole metadata, when the API response is returned, then AWS access keys, secret keys, session tokens, and external IDs are redacted while non-secret repository and region metadata remains visible.

Given the AWS ECR connector syncs in fixture or authorized live mode, when repository and image metadata is read, then Periscan emits normalized container repository assets, private-repository exposure signals, image digest/tag signals, scan-on-push signals, and tag-mutability posture signals without calling authorization-token, image-pull, manifest, blob, layer, push, or delete APIs.

## Tenable VM Connector

Requirement labels: `PRD-TenableVM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Tenable integration with API keys, when the API response is returned, then Tenable access and secret keys are redacted while non-secret API base URL and limit metadata remains visible.

Given the Tenable connector syncs in fixture or authorized live mode, when workbench asset and vulnerability summaries are read, then Periscan emits normalized host assets plus vulnerability-managed-asset, severity exposure, and CVE signals without starting scans, creating exports, reading raw plugin output, or presenting raw scanner dumps as primary output.

## Rapid7 InsightVM Connector

Requirement labels: `PRD-Rapid7InsightVM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Rapid7 InsightVM integration with read-only basic auth, when the API response is returned, then the password is redacted while non-secret API base URL, username, and limit metadata remains visible.

Given the Rapid7 InsightVM connector syncs in fixture or authorized live mode, when asset and vulnerability summaries are read, then Periscan emits normalized host assets plus vulnerability-managed-asset, severity exposure, and CVE signals without starting scans, creating reports/exports, changing policies, or presenting raw scanner tables as primary output.

## Wiz CNAPP Connector

Requirement labels: `PRD-WizCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Wiz integration with OAuth client credentials, when the API response is returned, then the client secret is redacted while non-secret GraphQL URL, token URL, project IDs, and query limits remain visible.

Given the Wiz connector syncs in fixture or authorized live mode, when cloud-resource and issue summaries are read, then Periscan emits normalized cloud-resource assets plus CNAPP resource, internet-exposure, issue-severity, and CVE signals without mutating Wiz, changing cloud configuration, creating remediations, or presenting raw issue dumps as primary output.

## Prisma Cloud CNAPP Connector

Requirement labels: `PRD-PrismaCloudCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Prisma Cloud integration with an access key ID and secret key, when the API response is returned, then the access key ID and secret key are redacted while non-secret API base URL, alert limit, and relative time-window settings remain visible.

Given the Prisma Cloud connector syncs in fixture or authorized live mode, when alert summaries are read, then Periscan authenticates with `POST /login`, performs read-only `GET /v2/alert` queries using `x-redlock-auth`, emits normalized cloud-resource assets plus CNAPP resource, internet-exposure, issue-severity, and CVE signals, and does not call alert dismissal, snooze, reopen, remediation, access-key, alert-rule, policy, cloud mutation, or resource-scan endpoints.

## Lacework / FortiCNAPP Connector

Requirement labels: `PRD-LaceworkFortiCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Lacework/FortiCNAPP integration with an API token, when the API response is returned, then the API token is redacted while non-secret account URL and vulnerability limit remain visible.

Given the Lacework connector syncs in fixture or authorized live mode, when host vulnerability observations are read, then Periscan performs a read-only `POST /api/v2/VulnerabilityObservations/Hosts/search` query, emits normalized host assets plus host vulnerability severity and CVE signals, and does not call vulnerability scan, vulnerability exception, vulnerability policy, alert close/comment, alert channel, webhook, or server-token endpoints.

## Orca Security CNAPP Connector

Requirement labels: `PRD-OrcaSecurityCNAPP-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an Orca Security integration with an API token, when the API response is returned, then the API token is redacted while non-secret API base URL, alerts path, authorization prefix, and alert limit remain visible.

Given the Orca Security connector syncs in fixture or authorized live mode, when cloud-risk alert summaries are read, then Periscan performs read-only `GET` alert-list queries, emits normalized cloud-resource assets plus CNAPP resource, internet-exposure, issue-severity, and CVE signals, and does not call alert acknowledge, dismiss, close, suppress, remediation, webhook, integration, settings, user, or cloud-account mutation endpoints.

## Qualys VMDR Connector

Requirement labels: `PRD-QualysVMDR-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Qualys VMDR integration with read-only basic auth, when the API response is returned, then the password is redacted while non-secret API base URL, username, and host/detection limit metadata remain visible.

Given the Qualys VMDR connector syncs in fixture or authorized live mode, when host and VM detection summaries are read, then Periscan emits normalized host assets plus vulnerability-managed-asset, severity exposure, and CVE signals without launching scans, creating reports, triggering remediation, changing Qualys configuration, or presenting raw scanner dumps as primary output.

## runZero Connector

Requirement labels: `PRD-RunZero-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a runZero integration with a read-only Export Token, when the API response is returned, then the export token is redacted while non-secret API base URL, asset limit, and search filter metadata remain visible.

Given the runZero connector syncs in fixture or authorized live mode, when organization asset exports are read, then Periscan emits normalized host assets plus asset-inventory, service-observation, and public-exposure signals without launching scans, changing sites/assets/explorers, or presenting raw inventory exports as primary output.

## Assetnote ASM Connector

Requirement labels: `PRD-AssetnoteASM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an Assetnote integration with an API token, when the API response is returned, then the API token is redacted while non-secret API base URL, assets path, authorization prefix, and asset limit remain visible.

Given the Assetnote connector syncs in fixture or authorized live mode, when attack-surface asset summaries are read, then Periscan performs read-only `GET` asset-list queries, emits normalized assets plus service-observation, external-exposure, attack-surface-risk, and CVE signals, and does not call scan, target creation, asset mutation, monitor, configuration, or settings endpoints.

## Axonius CAASM Connector

Requirement labels: `PRD-AxoniusCAASM-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an Axonius integration with API key and secret credentials, when the API response is returned, then both secret values are redacted while non-secret API base URL, assets path, and asset limit remain visible.

Given the Axonius connector syncs in fixture or authorized live mode, when CAASM asset summaries are read, then Periscan performs read-only `GET` asset-list queries, emits normalized assets plus CAASM asset, adapter-coverage, coverage-gap, internet-exposure, risk, and CVE signals, and does not call query creation, enforcement, action, device mutation, adapter, settings, or user endpoints.

## Armis Connector

Requirement labels: `PRD-Armis-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an Armis integration with an API token, when the API response is returned, then the API token is redacted while non-secret API base URL, assets path, authorization prefix, and asset limit remain visible.

Given the Armis connector syncs in fixture or authorized live mode, when device and asset summaries are read, then Periscan performs read-only `GET` asset-list queries, emits normalized assets plus asset-inventory, unmanaged-asset, internet-exposure, coverage-gap, risk, and CVE signals, and does not call enforcement, quarantine, policy, asset/device mutation, remediation, integration, settings, or user endpoints.

## Cortex Xpanse Connector

Requirement labels: `PRD-CortexXpanse-Connector`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Cortex Xpanse integration with an API token, when the API response is returned, then the API token is redacted while non-secret API base URL, assets path, authorization prefix, and asset limit remain visible.

Given the Cortex Xpanse connector syncs in fixture or authorized live mode, when external attack-surface asset summaries are read, then Periscan performs read-only `GET` asset/exposure-list queries, emits normalized assets plus attack-surface asset, external service, external exposure, high-risk, and CVE signals, and does not call scan, asset mutation, exception, remediation, policy, incident, integration, or settings endpoints.

## AbuseIPDB Connector

Requirement labels: `PRD-AbuseIPDB-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an AbuseIPDB integration with an API key, when the API response is returned, then the API key is redacted while non-secret API base URL, IP list, max-age, and query-limit metadata remain visible.

Given the AbuseIPDB connector syncs in fixture or authorized live mode, when configured IP indicators are checked, then Periscan emits normalized threat-intel and suspicious/malicious IP reputation signals without calling report, clear-address, blacklist, bulk-report, or any write-capable endpoint.

## VirusTotal Connector

Requirement labels: `PRD-VirusTotal-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a VirusTotal integration with an API key, when the API response is returned, then the API key is redacted while non-secret API base URL, indicator list, and query limit metadata remain visible.

Given the VirusTotal connector syncs in fixture or authorized live mode, when configured IP/domain/URL/hash indicators are searched, then Periscan emits normalized threat-intel and suspicious/malicious indicator reputation signals without uploading files, submitting URL scans, downloading samples, adding comments, voting, or presenting raw reputation dumps as primary output.

## GreyNoise Connector

Requirement labels: `PRD-GreyNoise-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a GreyNoise integration with an API key, when the API response is returned, then the API key is redacted while non-secret API base URL, IP list, and query limit metadata remain visible.

Given the GreyNoise connector syncs in fixture or authorized live mode, when configured IP indicators are looked up, then Periscan emits normalized threat-intel, malicious-scanner, internet-scanner, and benign-RIOT service signals without calling GNQL, alert, tag, bulk POST, or write-capable endpoints.

## AlienVault OTX Connector

Requirement labels: `PRD-AlienVaultOTX-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates an AlienVault OTX integration with an API key, when the API response is returned, then the API key is redacted while non-secret API base URL, indicator list, and query-limit metadata remain visible.

Given the AlienVault OTX connector syncs in fixture or authorized live mode, when configured IP/domain/URL/hash/CVE indicators are queried, then Periscan emits normalized threat-intel and pulse-association signals using read-only `GET /indicators/{type}/{indicator}/general` calls without creating pulses, subscribing/unsubscribing, exporting indicators, following users, searching users, or presenting raw OTX response dumps as primary output.

## Recorded Future Connector

Requirement labels: `PRD-RecordedFuture-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Recorded Future integration with an API token, when the API response is returned, then the API token is redacted while non-secret API base URL, CVE list, entity-name list, and query-limit metadata remain visible.

Given the Recorded Future connector syncs in fixture or authorized live mode, when configured CVEs or threat entity names are queried, then Periscan emits normalized threat-intel, vulnerability-risk, and entity-match signals using read-only `GET /v2/vulnerability/search` and `POST /entity-match/match` calls without writing lists, creating alerts, subscribing to feeds, exporting bulk intelligence, or presenting raw intelligence dumps as primary output.

## Mandiant Advantage Connector

Requirement labels: `PRD-MandiantAdvantage-Connector`, `PRD-Threat-Center`, `PRD-Signal-Fabric`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given an authenticated tenant creates a Mandiant Advantage integration with Key ID and Secret ID credentials, when the API response is returned, then the Secret ID is redacted while non-secret API base URL, Key ID, indicator list, CVE list, actor-name list, minimum MScore, and query-limit metadata remain visible.

Given the Mandiant Advantage connector syncs in fixture or authorized live mode, when configured IoCs, CVEs, or threat actor names are queried, then Periscan emits normalized threat-intel, MScore, exploitation, association, and actor-context signals using read-only API v4 enrichment lookups without fetching bulk feeds, creating collections, exporting reports, submitting indicators, or presenting raw intelligence dumps as primary output.

## Policy Binding Errors and Target Resolution (P0 Safety; covers all edges, states, roles, persistence)

Requirement labels: `PRD-Safety-Policy`, `SPEC-SEC-01`, `SPEC-API-01`, `PRD-Safety-ExternalValidation`, `PRD-Core-ProofLoop`.

Given a tenant admin (SCOPE_EDITOR role) creates a policy decision for a low-risk PassiveReadOnly mission on scope S, when they call createMission for a Continuous missionType using that decisionId, then the API returns 400 with code "policy_decision_mission_type_mismatch" (and symmetrically "policy_decision_scope_mismatch" or "policy_decision_safety_level_mismatch" for the other binding dimensions) and no mission/run/job is created; the mismatch is audited with decision context. (The exact three codes `policy_decision_scope_mismatch`, `policy_decision_mission_type_mismatch`, `policy_decision_safety_level_mismatch` plus related like `policy_decision_not_found` are defined+thrown in runtime-services.ts createMission ~13151 and startMission rebind ~13397.)

Given a tenant admin creates a mission with a valid policyDecisionId that later drifts (e.g. decision scope mutated in test harness), when startMission is called, then the re-validation in startMission detects the mismatch and returns 400 with the exact code (scope/missionType/safetyLevel) before any tx/queue/enqueue; denied missions never reach worker.

Given a security engineer starts an external validation mission (e.g. nuclei.external_exposure_safe) and omits "target" in the start payload (but the policy decision carried the verified domain target), when the run is created, then the persisted ValidationRun.target equals the decision.target object (full resolution), external guards and module constraints use it, and GET /missions/:id/runs returns the resolved target; empty target never stored for external PoA.

Given a viewer role (no SCOPE_EDITOR) attempts createMission or startMission with/without decision, when evaluated, then 403 or appropriate RBAC deny (not policy code); tenant isolation still holds for cross-tenant decision misuse.

Given a malformed/expired JWT in the session cookie, when any protected route (e.g. GET /me, POST /missions) is called, then the API returns 401 with code "unauthorized" (no 500 leak from verify) via the try/catch in getAuthContext; POST /logout still succeeds with 204 and clears the cookie.

Given a runner registration or poll uses invalid/mismatched token, when processed, then "runner_unauthorized" code is returned and audited; no tasks leaked.

Given any of the above binding/auth/target errors, when the response is inspected, then {code, error} shape is always present per ApiErrorSchema (code stable for clients); no secrets or internal stack in body.

Given the P0 regression suite in app.test and security boundaries, when pnpm test:security + api targeted run, then all mismatch/omit-target/bad-cookie cases assert exact codes, 4xx status, no queue side effects, and run.target persistence.

## UX States, Loading/Empty/Error/Success, Sync/Health, Responsive (P1/P2; covers edges, roles, persist, mobile)

Requirement labels: `PRD-BetterTogetherUX`, `SPEC-UI-01`, `PRD-Trust-Safety-Page`, `PRD-Integration-Marketplace`, `PRD-ThreatCenter-WebSurface`.

Given a returning authenticated user (valid cookie) loads Workspace or Threat Center, when the component mounts, then isLoading=true renders neutral "Restoring your session..." panel (no auth form visible); after /me success, isLoading=false and real workspace/content appears; on 401, transitions to auth gate. Component tests assert no premature auth UI.

Given Integration Marketplace initial load, when catalog fetch pending, then loading state is shown (no flash of empty grid); on filter with zero matches, "No connectors match your filters" empty state renders; fixture connector buttons are hidden unless `NEXT_PUBLIC_PERISCAN_ENABLE_FIXTURE_CONNECTORS=true`; post successful fixture-lab or live connector setup, client calls syncIntegration, and Marketplace plus Trust & Safety immediately reflect current healthStatus + recent lastSyncAt (persisted via real /health or /sync).

Given Integration Marketplace connected cards or Trust & Safety connected list, when "Sync now" clicked for a connector (incl new PSA like Syncro), then button disables (busy), POST /integrations/:id/sync succeeds, and the UI refreshes from tenant-scoped API data with updated healthStatus/lastSyncAt; errors surface as an alert without crashing. Persist verified in DB via integration record.

Given Integration Marketplace connected cards or Trust & Safety connected list, when "Refresh health" clicked for a connector, then GET /integrations/:id/health succeeds, the UI refreshes from tenant-scoped API data, and no signal import or workflow mutation is implied.

Given a tenant with no connected integrations visits Trust & Safety, when loaded, then empty state "No integrations are connected..." shown (real API data); error from backend (e.g. 500) surfaces consistently as error pill with retry path.

Given Snapshot report view (/snapshots/:id) for invalid id or unauth, when navigated, then specific "Report not found or access denied" state (or 404/403 mapped), no raw error, back link works; loading during analyst note save re-fetch.

Given mobile viewport (<720px, portrait), when any primary page (/, /integrations, /threat-center, /trust-safety, /mssp, report) renders, then grids stack (auto-fit degrades), padding reduces, no overflow on 320px; labels readable, buttons tappable. (Globals + component responsive.)

Given error during import in Threat Center (bad payload or 4xx), when triggered, then error-copy or dedicated error panel with code if present, list remains usable; success import adds to real list and detail loads with all sub-states (readiness, missing signals impacted by connectors, plan, export buttons).

Given 401 on protected web surface, when token expires mid-session, then graceful gate with "Sign in" (no crash, state reset).

## PSA/RMM Remediation Ticket Creation (Direct + Workflow; P1-007)

Requirement labels: `SPEC-REM-01`, `PRD-Syncro-MSSPConnector` (and Halo/Autotask/ConnectWise/Ninja peers), `PRD-Remediation API`.

Given a Snapshot has produced a RemediationTask (from policy-approved mission/run/evidence on verified scope), when a tenant admin (SCOPE_EDITOR) with a connected Syncro (or peer PSA) integration calls POST /remediations/:id/create-ticket with {integrationId: syncroId}, then the API resolves the workflow-capable connector, calls sendWorkflowEvent with remediation-derived payload (under policy context), returns {ticketId: "SYNCRO-...", ticketSystem: "Syncro", ...}, sets on RemediationTask, writes audit "remediation.ticket.created", no job queued, no secret leak in response. (Jira compat path remains for integrationId omitted.)

Given the same for HaloPSA/Autotask/ConnectWise (via their integrationId), when create-ticket, then ticketSystem matches the connector (e.g. "HaloPSA"), delivery "Delivered" state in audit/metadata, real or mock per integration config.

Given no connected PSA or unsupported integrationId, when create-ticket called, then 400/404 with clear error (no ticket, no side effects); viewer role gets 403.

Given acceptance + e2e exercising Snapshot -> rem -> Syncro ticket (policy context), when pnpm test:acceptance and test:e2e, then PSA path asserts ticket metadata, system, no-leak, audit, states (success/failed), and real API calls (no fakes in path).

Given signal-trigger routing to PSA (separate journey), when approved, then deliver still uses general sendWorkflowEvent; direct remediation now also covers PSA uniformly.

## Threat Center Full States + Real Signal Impact + Export (P1-001)

Requirement labels: `PRD-ThreatCenter-ManualImport`, `PRD-ThreatCenter-WebSurface`, `PRD-ThreatCenter-ReadinessExport`.

Given no advisories imported, when /threat-center loads (real API), then list empty state "No advisories have been imported yet..." and detail "Select or import an advisory..."; import form present.

Given import of advisory (title, source, summary, CVE/IoC/TECH), when POST succeeds, then list updates with real persisted item; detail loads with readiness (computed from tenant config, no exec queued), missingSignals list (initially populated), plan items with status pills (NeedsApproval etc), evidence chips; real connector signals (e.g. Splunk from control validation) reduce specific missingSignals like "control_telemetry" in impact.

Given readiness computed, when export HTML or PDF via button or API /readiness-report/export or /reports/:id/export, then download succeeds with evidencePackId, redacted content, audit event; report contains evidence IDs, methodology, no raw advisory.

Given error on import (bad data) or detail load (transient), when occurs, then error state shown (copy + code), list remains usable; loading panels during list/detail/export.

Given cross-tenant advisory access attempt, when via API, then 404 (tenant isolation); all states covered in web component tests + api.test threat blocks + acceptance threat journey.

## Internal Runner Deploy and Validation (P1-003)

Requirement labels: `PRD-Runner-ProductionPackaging`, `PRD-Runner-LocalLabE2E`, `PRD-Production-Readiness`.

Given customer follows apps/runner/deploy/README.md (GHCR image, k8s yaml or systemd unit or compose), when runner registers with short token, polls signed reachability task (scope enforced), uploads artifact (hash/size), submits result, then API accepts, stores redacted evidence, updates run/task, audits; non-root + sec opts in manifests.

Given pnpm test:runner + test:runner:lab + docker non-root, when executed in CI or customer env, then loopback reach + artifact upload + result roundtrip validated (real main.go paths).

Given Supabase aliases + runner, when configured per .env + deploy notes, then runner reaches API (outbound) and artifacts land in Supabase S3 compat; deployment-managed disclosures in Trust & Safety and docs.

Given no runner or unapproved, when reachability task requested, then policy denies before signed envelope; all states (registered, heartbeat, revoked, poll empty, result mismatch) audited and rejected gracefully.

All new AC exercised in existing pnpm verify gates + targeted (no new mocks in prod paths).

## First Demo Story Source Coverage

Requirement labels: `SRC-22-DEMO-STORY`, `PRD-DEMO-001`, `PRD-DEMO-002`, `PRD-DEMO-003`, `PRD-DEMO-004`.

Given PRD section 22 lists nine first-demo story steps, when the public demo page renders, then the Demo Story ordered list contains all nine source-mapped steps: redacted fake repository secret, possible cloud role access, production impact, mock SIEM control observation, highest-value path breaker, remediation task with evidence IDs, fix-verification retest, fixed-or-still-exposed verdict, and evidence pack generation.

Given the deterministic public demo Snapshot is generated, when source-derived tests inspect the normalized Snapshot object, then the repo-secret path contains redacted secret evidence, a possible cloud role, a production impact node, missed SIEM control evidence, a path breaker, remediation evidence IDs, verification guidance, and a ready evidence pack without raw secret values.

Given a first customer completes signup, verified scope, mock GitHub/AWS/Jira connection, and Snapshot creation through public APIs, when the proof-loop E2E creates remediation for the named repository-secret path and calls `/remediations/:id/verify`, then Periscan executes fixture-safe Gitleaks and Prowler retests, records a verification event with evidence IDs, and returns `Fixed` or `StillExposed` rather than `Inconclusive`.

Given the first-customer proof loop has verification evidence, when the customer fetches evidence and exports the report, then the API returns tenant-scoped evidence and HTML/PDF report content generated from normalized evidence.

Given a future audit reviews section 22, when `pnpm test:modules -- prd-demo-story-coverage` runs, then broad demo/report/remediation existence is insufficient; the test must fail if any source story beat, terminal verification verdict assertion, repo-secret retest wiring, or evidence-generation route coverage is removed.

## First Sellable MVP Source Coverage

Requirement labels: `SRC-19-FIRST-MVP`, `PRD-MVP-001`, `PRD-MVP-002`, `PRD-MVP-003`, `PRD-MVP-004`.

Given a new tenant signs up through `/api/v1/auth/signup`, when they create and dev-verify a domain scope, then a Snapshot request that was denied before verification can proceed only after the scope is verified.

Given the same first-sellable tenant has the default `ValidationSnapshot` package, when they register an optional AI app through `/api/v1/ai-apps` tied to the verified scope, then the API returns 201 and no `billing_entitlement_denied` audit event is created for `AI app registry`.

Given the tenant connects mock GitHub and AWS integrations and syncs them, when they create a Snapshot with `maxTopItems: 5`, then Periscan runs safe validation modules, correlates top paths, returns evidence IDs, and generates a ready evidence pack/report.

Given the Snapshot contains top attack paths, when the tenant creates remediation, creates a ticket, marks it ready for verification, and calls fix verification, then Periscan records verification evidence and does not mark the risk fixed without a verification event.

Given the public/demo Snapshot report is rendered, when section 19 report bullets are audited, then the report contains executive summary, 3-5 validated paths, control verdicts, AI app validation, remediation priorities, verification plan, evidence appendix, and the MVP success signal copy.

## Pricing and Metering Source Coverage

Requirement labels: `SRC-17-PRICING-METERING`, `PRD-BILLING-001`, `PRD-BILLING-002`, `PRD-BILLING-003`, `PRD-BILLING-004`, `PRD-BILLING-005`.

Given PRD section 17 lists public pricing language, when billing package metadata is returned from `/api/v1/billing/packages`, then each package exposes `Pay for what you validate.`, keeps `paymentProcessorStatus` as `NotConfigured`, and does not expose price, currency, or exact published pricing fields.

Given PRD section 17 lists metering units, when the billing catalog is audited, then validated assets, identities, control sources, AI apps/workflows, internal runners, scenario executions, evidence workflows, MSSP client tenants, retention, and API usage each map to a stable public usage meter.

Given evidence retention is configured with `PERISCAN_EVIDENCE_RETENTION_DAYS`, when `/api/v1/billing/usage` is read, then the `EvidenceRetention` meter reports the configured days; when it is deployment-managed, it reports `0` days rather than fabricating a configured retention period.

Given PRD section 17 lists packages, when the billing package catalog is audited, then Validation Snapshot, Core Validation, Control Validation, AI Security Validation, Evidence Packs, MSSP / Partner, and Enterprise are all present with PRD-facing labels.

Given a replacement UI needs billing state, when it calls `/api/v1/billing/meters`, `/api/v1/billing/packages`, `/api/v1/billing/usage`, and `/api/v1/billing/active-package`, then it can render the same billing and usage surface as the first-party Dashboard without hardcoded package or meter data.

## Build Phases Source Coverage

Requirement labels: `SRC-18-BUILD-PHASES`, `PRD-PHASE-001`, `PRD-PHASE-002`, `PRD-PHASE-003`, `PRD-PHASE-004`, `PRD-PHASE-005`, `PRD-PHASE-006`.

Given PRD section 18 lists phases 0 through 8, when `tests/modules/prd-build-phases-coverage.test.ts` parses the source, then every phase header, build bullet, and exit criterion must match the long-form PRD exactly.

Given Phase 0 Foundation and Phase 1 Validation Snapshot are audited, when implementation evidence is inspected, then monorepo packages, auth/tenant/RBAC/scope/policy/audit APIs, connector/module registries, BullMQ worker execution, evidence storage, evidence graph, reports, safe module evidence, Snapshot routes, GitHub/AWS integration paths, Nuclei/Gitleaks/Prowler/Trivy/OSV modules, attack-path correlation, remediation, verification guidance, and report export are all mapped.

Given Phases 2 through 4 are audited, when AI app, control, and fix-verification source coverage runs, then safe AI validation, redacted evidence, Promptfoo/PyRIT/Garak harness handling, control-source validation, dry-run Atomic, Splunk/CrowdStrike observers, MITRE ATT&CK mapping, Jira workflow, targeted retest, before/after evidence, verification events, and report updates are visible.

Given Phases 5 through 7 are audited, when runner, continuous validation, and operator source coverage runs, then outbound signed-task runner polling, local scope/signature verification, safe reachability checks, evidence upload, recurring schedules, reopened-risk summaries, CTEM view, recommendation-only operators, evidence IDs, and policy approval gates are visible.

Given Phase 8 is audited, when enterprise acceptance and traceability are inspected, then parent/child tenants, white-label reports, client dashboards, SSO/SAML/OIDC, baseline multi-role RBAC, API-first tenant switching, audit exports, and tenant-scoped runner APIs prove the exit criteria that MSSP can manage multiple clients and enterprise can govern multiple business units. Inbound SCIM 2.0 user lifecycle provisioning and custom-role/advanced RBAC remain honest `NotConfigured` / `BaselineRolesOnly` product states (Trust Safety `identityProvisioning`, Admin SCIM panel, and `/api/v1/scim/v2/*` 501 discovery stubs)—they must not be proven by string presence of `"SCIM"` (CyberArk read-only inventory connector) or `"advanced RBAC"` alone.

Given a full-product completion claim is attempted, when the PRD audit gate runs, then Build Phases coverage alone must not hide unresolved source rows or partial atoms if any exist.

## Codex Master Instruction Source Coverage

Requirement labels: `SRC-20-CODEX-MASTER-INSTRUCTION`, `PRD-CODEXMASTER-001`, `PRD-CODEXMASTER-002`, `PRD-CODEXMASTER-003`, `PRD-CODEXMASTER-004`, `PRD-CODEXMASTER-005`, `PRD-CODEXMASTER-006`.

Given PRD section 20 states the product outcome and tagline, when source coverage runs, then README/PRD product copy must preserve the validation-plus-proof outcome and `Find the path. Validate the risk. Prove it's fixed.` tagline.

Given section 20 says OSS tools are internal validation engines and Periscan owns the platform layers, when source coverage runs, then OSS policy, module registry, evidence graph, connectors, reports, policy, and architecture docs must show Periscan-owned control surfaces rather than raw OSS plumbing as the product.

Given section 20 lists safety rules, when source coverage and security tests run, then verified customer-authorized scope, no destructive actions, no real exfiltration, no persistence, no credential theft, no uncontrolled exploit chaining, no unauthorized third-party scanning, read-only/passive defaults, and scoped/policy-approved/logged/auditable/evidence-backed validation are all mapped.

Given section 20 lists engineering rules, when source coverage runs, then tests, pluggable modules, typed Zod/runtime schemas, raw/normalized evidence separation, evidence-linked conclusions, and verification-event-only fixed risk state are mapped to code and tests.

Given section 20 lists the stack, when source coverage runs, then the workspace and manifests prove Next.js web, Fastify TypeScript API, TypeScript worker, Go runner, shared schemas, policy, evidence, connectors, modules, reports, Postgres, Redis/BullMQ, and MinIO/S3.

Given a future agent claims standing instruction compliance, when `pnpm test:modules -- prd-codex-master-instruction-coverage` runs, then AGENTS.md existence or broad green validation is insufficient unless the exact section 20 source bullets remain mapped.

## Codex Implementation Tickets Source Coverage

Requirement labels: `SRC-21-CODEX-TICKETS`, `PRD-TICKET-001`, `PRD-TICKET-002`, `PRD-TICKET-003`, `PRD-TICKET-004`, `PRD-TICKET-005`, `PRD-TICKET-006`.

Given PRD section 21 is audited, when source coverage runs, then all 40 ticket numbers, titles, and acceptance blocks are parsed directly from `docs/PERISCAN_FULL_PRODUCT_PRD.md`.

Given tickets 1 through 12 are audited, when implementation evidence is inspected, then monorepo setup, shared schemas, Prisma models, auth/RBAC, scope verification, policy, Signal Fabric, module registry, BullMQ worker, raw evidence storage, evidence graph, and Validation Snapshot proof are mapped to current code and tests.

Given tickets 13 through 24 are audited, when implementation evidence is inspected, then GitHub, AWS, Gitleaks, Prowler, Nuclei, attack-path correlation, risk scoring, remediation, Jira, fix verification, report generation, and API-backed web UI proof are mapped to current code and tests.

Given tickets 25 through 34 are audited, when implementation evidence is inspected, then AI app registry/validation, control sources, Atomic dry-run control validation, ATT&CK mapping, internal runner skeleton/signing/reachability, continuous validation scheduling, and evidence-pack templates are mapped to current code and tests.

Given tickets 35 through 40 are audited, when implementation evidence is inspected, then MSSP multitenancy, billing/metering, Trust & Safety, audit completeness, demo data, and full MVP E2E proof-loop coverage are mapped to current code and tests.

Given a future agent claims ticket completion, when `pnpm test:modules -- prd-codex-tickets-coverage` runs, then broad traceability labels or historical prompt execution are insufficient unless the exact source ticket inventory and ticket-cluster evidence remain mapped.

## Fix Verification Source Coverage

Requirement labels: `SRC-3.6-FIX-VERIFICATION`, `PRD-FIXVER-001`, `PRD-FIXVER-002`, `PRD-FIXVER-003`, `PRD-FIXVER-004`, `PRD-FIXVER-005`, `PRD-FIXVER-006`, `PRD-FIXVER-007`, `PRD-FIXVER-008`.

Given a remediation has a routed external ticket and verification is required, when ticket sync observes that the ticket was closed before Periscan verification, then the remediation status becomes `ClosedWithoutEvidence`, the API exposes that status, and a `remediation.closed_without_evidence` audit event is written with ticket and previous-status metadata.

Given a remediation is `ClosedWithoutEvidence`, when a user marks it ready for verification or runs `POST /api/v1/remediations/:id/verify`, then Periscan preserves policy-gated verification behavior and does not treat the ticket closure as proof of `Fixed`.

Given a remediation references a secret path, external exposure, AI app risk, control miss, or generic attack path, when verification is requested, then Periscan selects the targeted module family from `buildTargetedFixVerificationPlan` and records selected module IDs in the validation run target and verification event.

Given a verification run executes only compare/no-op logic or lacks measured revalidation, when the prior path disappears, then the outcome remains `Inconclusive` rather than `Fixed`.

Given a measured retest or connector resync proves the prior measured path no longer correlates, when verification completes, then Periscan creates a `VerificationEvent`, updates remediation status, updates attack-path state/evidence/risk response, and includes the verification result in reports/evidence packs with evidence IDs.

## AI App Security Validation Source Coverage

Requirement labels: `SRC-3.5-AI-APP-VALIDATION`, `PRD-AIAPP-001` through `PRD-AIAPP-008`.

Given PRD section 3.5 lists AI validation coverage bullets, when `pnpm test:modules -- prd-ai-app-validation-coverage` runs, then every source bullet maps to a first-class `AIAppValidationCategorySchema` value and safe suite definition for `ai_app.safe_validation`.

Given PRD section 3.5 lists outcomes, when the source coverage test runs, then every source outcome maps to `AIAppValidationOutcomeSchema` and can be emitted as normalized AI application signal evidence.

Given a tenant registers an AI app, when the API contract is validated, then endpoint URL, RAG/tool posture, guardrail context, owner, verified scope, and `testAccountNotes` are supported without storing secrets.

Given an AI app validation is requested, when the module and API contracts are inspected, then execution is `ControlledValidation`, approval-required, scoped to `AIApplicationEndpoint`, redacted, and limited to Promptfoo/PyRIT/Garak safe harness handling or benign `LiveSafe` endpoint probes.

Given Promptfoo, PyRIT, or Garak fixture output contains sensitive-looking content, when module evidence is produced, then raw tokens/secrets/test fixture sensitive values are not present in serialized evidence.

Given an AI App Validation Report is rendered, when normalized AI risk signals and evidence IDs exist, then the report includes the AI App Risks section, evidence IDs, technique tags where applicable, and no raw harness output.

## Evidence Packs Source Coverage

Requirement labels: `SRC-3.7-EVIDENCE-PACKS`, `PRD-EVPACK-001`, `PRD-EVPACK-002`, `PRD-EVPACK-003`, `PRD-EVPACK-004`, `PRD-EVPACK-005`, `PRD-EVPACK-006`, `PRD-EVPACK-007`, `PRD-EVPACK-008`.

Given PRD section 3.7 lists Evidence Pack types, when source-derived module tests run, then each PRD bullet maps to at least one public `EvidencePackType` contract and a rendered report label, including SOC 2 and ISO support and the PRD-facing AI Security Validation Report label.

Given an Evidence Pack is rendered from a Validation Snapshot, when normalized paths, observations, remediations, and evidence IDs exist, then the report shows evidence IDs and does not render raw scanner/tool output, raw payload pointers, or unredacted secret-like sample values in the primary report body.

Given different Evidence Pack audiences are requested, when Executive, Technical Appendix, Control Validation, AI Security Validation, CTEM, MSSP QBR, Customer Review, Cyber Insurance, Compliance Support, and Remediation Closure packs are rendered, then each pack includes or omits audience-specific sections according to the report template contract.

Given a customer or API client requests report export, when `/api/v1/reports/:id/export` or `/api/v1/snapshots/:id/export` is called with HTML or PDF format, then Periscan returns an exported report generated through the shared report generator and linked to the tenant-scoped Evidence Pack record.

Given MSSP white-label branding is enabled, when an Evidence Pack is rendered with persisted tenant report branding, then the report includes the configured organization name, accent color, support email, and report footer while preserving evidence IDs and safety notes.

Given an AI validation run has a previous comparable baseline, when a new validation completes, then Periscan records a redacted baseline comparison status of `Stable`, `Improved`, or `Regressed`; if no previous comparable run exists, then status is `NoBaseline`.

Given PRD section 3.5 changes, when the source coverage and PRD audit gates run, then missing AI categories, outcomes, routes, scope checks, test-account support, redaction behavior, AI evidence-pack rendering, or baseline/drift behavior fail validation before full-product completion can be claimed.

## Attack-Path Validation Source Coverage

Requirement labels: `SRC-3.4-ATTACK-PATH`, `PRD-ATTACK-001` through `PRD-ATTACK-007`.

Given normalized GitHub secret, cloud exposure, external exposure, AI application, control-observation, and approved BloodHound-compatible identity graph evidence exists for a tenant, when attack-path correlation and module import tests run, then Periscan produces or imports evidence-backed path classes for repo-secret/cloud/data, external/internal reachability, AI/RAG risk, missed-control/real-exposure, and identity-admin-gap scenarios without using SharpHound collection or unsupported live adversarial execution.

Given a correlated attack path has ordered nodes, edges, impact score, confidence, evidence basis, path breakers, and remediation verification method, when the API/report/UI renders it, then entry point, intermediate step, impact target, business impact, evidence IDs, and verification guidance are exposed from shared contracts rather than fabricated UI state.

Given a path edge has `MISSED_BY`, `DETECTED_BY`, or `BLOCKED_BY`, when risk is assessed, then the control-response factor is derived from the structured edge relationship before text fallback and changes score direction accordingly.

Given linked control or AI signals include MITRE ATT&CK technique IDs whose evidence overlaps an attack path or references its path ID, when the Validation Snapshot HTML or text/PDF report is generated, then the path card includes ATT&CK mapping tags derived from those normalized signals.

Given a previously fixed path appears again in a later Snapshot or a remediation verification compares previous and current correlated path drafts, when before/after comparison runs, then reopened or verification outcomes are recorded from evidence and do not mark `Fixed` unless a verification event or current fixed validation state proves it.

Given PRD section 3.4 changes, when `pnpm test:modules -- prd-attack-path-coverage` and `pnpm prd:audit` run, then missing example paths, concepts, edge evidence, control response, ATT&CK mapping, or before/after behavior fail validation before any full-product completion claim can be made.

## Third-Party Tool Coverage Audit

Requirement labels: `PRD-3PT-011`, `PRD-AUDIT-001`, `PRD-ThirdPartyToolGovernance`, `PRD-API-First`.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/coverage-audit`, when the reviewed tool catalog and module manifests are compared, then every tool is returned with exactly one disposition: `Executable`, `ContentOrImportOnly`, `Deferred`, `Blocked`, or `NeedsImplementation`.

Given an enabled tool declares a module ID that is not present in current module manifests, when the coverage audit is generated, then that tool is classified as `NeedsImplementation` with the missing module ID in `missingModuleIds`.

Given a legal-review or safety-blocked tool such as SharpHound, when the coverage audit is generated, then it is classified as `Blocked` and remains visible with required actions instead of being hidden or enabled.

Given a deferred or plan/import-only tool such as Caldera safe plan import or OpenCTI content import, when the coverage audit is generated, then it is classified as `Deferred` or `ContentOrImportOnly` and is not represented as live executable validation.

Given the coverage audit endpoint is called, when the response is inspected, then it includes `doesNotEnable`, `doesNotInstall`, `doesNotExecute`, `doesNotQueueMissions`, and `doesNotDispatchRunnerTasks` set to `true`, and no mission, install job, runner task, or tool enablement side effect occurs.

## Third-Party Tool Governance Center

Requirement labels: `PRD-ThirdPartyToolGovernance`, `PRD-OSS-Productization`, `PRD-API-First`, `PRD-Runner-OutboundOnly`.

Given an authenticated tenant user requests `GET /api/v1/third-party-tools`, when the tenant has no overrides, then the API returns every Periscan-managed tool with default governance status, runtime readiness, install status, pinned version/image/ref, license/legal disposition, capabilities, modules, and recent jobs.

Given a tenant Owner/Admin requests check/install/enable/disable on an approved tool, when the request uses only an allowlisted tool ID and runtime kind, then the API persists the resulting policy/job state and writes an audit event.

Given a tenant Owner/Admin attempts to enable a blocked or legal-review tool, when policy is evaluated, then the API returns a stable denial code and the tool remains disabled/non-executable.

Given a tenant disables a tool required by a validation module, when a mission using that module is started, then mission start returns zero queued jobs, marks the mission denied by policy, and writes a tool-governance policy audit event.

Given a platform engineer adds a new tool to the library, when the tool lacks catalog metadata, module manifest, parser/redaction tests, license/safety certification, evidence mapping, and execution-plane review, then it may remain visible as planned/catalog-only but cannot become executable.

Given a tenant Owner/Admin submits a proposed tool manifest to `POST /api/v1/third-party-tools/intake/validate`, when the proposal uses a new tool ID, permissive license, safe behavior, installable runtime metadata, verified-scope contract, and compatible execution plane, then the API returns `AcceptedForCatalogReview` with required files/tests and writes `third_party_tool.intake_validated`.

Given a tenant administrator opens Registry Center, when they submit proposed tool metadata in the Tool Onboarding Intake form, then the UI calls `/api/v1/third-party-tools/intake/validate`, renders the API certification report, and does not create catalog entries, install jobs, missions, or unreviewed executable tools.

Given a tenant Owner/Admin submits a proposed tool manifest to `POST /api/v1/third-party-tools/intake/candidates`, when the proposal is evaluated, then Periscan stores a tenant-scoped candidate containing the manifest, validation report, status, requester, timestamps, and `third_party_tool.intake_submitted` audit event without installing, cataloging, enabling, or executing the tool.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/intake/candidates/readiness-summary`, when the tenant has imported multiple candidates, then the API returns per-candidate readiness reports, readiness counts, review/intake counts, and top required actions without creating catalog entries, install jobs, tenant enablement, missions, runner tasks, or module executions.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/intake/candidates/:candidateId/readiness`, when the candidate is not yet represented by reviewed catalog/module/governance state, then the API returns `NeedsImplementation` with explicit missing checks and required actions without installing, cataloging, enabling, queueing, or executing the candidate.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/intake/candidates/:candidateId/review`, when they mark an accepted intake candidate as `AcceptedForImplementation`, then Periscan persists review status, reviewer, owner, timestamp, and sanitized audit metadata without installing, enabling, queueing, or executing the tool.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/intake/candidates/:candidateId/review`, when they attempt `PromotedToCatalog` before readiness reports all required catalog/module/governance/runtime/runner/legal checks satisfied, then the API returns a stable conflict code and does not change execution state.

Given a tenant Owner/Admin successfully promotes a readiness-satisfied candidate to catalog, when promotion completes, then Periscan creates a tenant-scoped third-party tool promotion package that snapshots reviewed catalog metadata, readiness report, governance policy, runtime installation state, modules, capabilities, required evidence, safety notes, and `third_party_tool.promotion_package_generated` audit metadata without installing, enabling, queueing, dispatching, or executing the tool.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`, when promotion packages exist for that candidate, then the API returns only the current tenant's packages and includes no raw scanner output, credentials, or unreviewed runtime artifacts.

Given tenant A has generated a third-party tool promotion package, when tenant B attempts to list or generate promotion packages for tenant A's candidate, then tenant B receives not found and no cross-tenant package metadata or audit event is created.

Given a tenant administrator opens Registry Center with a promoted tool candidate, when they click `Load promotion packages`, then the UI calls `/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages`, renders the latest backend package status, summary, evidence counts, and safety notes, and does not create another package.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`, when the candidate has been accepted for implementation, then Periscan creates a tenant-scoped implementation work order with tasks, scaffold files, required evidence, readiness/review status, and `third_party_tool.work_order_generated` audit metadata without writing repository files, installing packages, enabling tools, queueing missions, or executing modules.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders`, when work orders exist for that accepted candidate, then the API returns only work orders for the current tenant and candidate.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/intake/candidates/:candidateId/work-orders/:workOrderId/implementation-bundle`, when the work order belongs to that tenant and candidate, then Periscan returns a non-executing implementation bundle with scaffold file content, SHA-256 hashes, validation commands, required actions, safety notes, and `doesNotExecute: true`.

Given an implementation bundle is generated, when the API response and audit event are inspected, then no install job, mission, runner task, module execution, or repository file write is created, and Periscan writes `third_party_tool.implementation_bundle_generated` with sanitized metadata.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/:toolId/upstream-version-checks/check`, when the reviewed tool has trusted upstream metadata and a newer upstream version exists, then Periscan creates a tenant-scoped `CandidateAvailable` report with catalog version, discovered version, source kind, required review actions, and sanitized `third_party_tool.upstream_checked` audit metadata.

Given a tenant Owner/Admin checks a newer upstream version, when the check completes, then Periscan does not update reviewed catalog metadata, tenant pins, install jobs, mission queues, module execution state, or runner tasks until reviewed catalog/module/parser/license/runtime work is completed and a normal reviewed-version recommendation is generated.

Given tenant A has a third-party tool upstream version check, when tenant B lists upstream version checks for the same tool, then tenant B receives only its own tenant-scoped check list and cannot read tenant A's candidate report.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/:toolId/update-recommendations/check`, when the tenant pin differs from the reviewed catalog version, then Periscan creates a tenant-scoped update recommendation with current pin, reviewed version, required actions, status, and sanitized `third_party_tool.update_checked` audit metadata.

Given a tenant Owner/Admin applies an `UpdateAvailable` recommendation, when `queueInstall` is true, then Periscan updates the tenant pin to the reviewed catalog version, creates a queued install job, marks the recommendation `Applied`, and writes sanitized `third_party_tool.update_applied` audit metadata without executing the tool.

Given tenant A has a third-party tool update recommendation, when tenant B lists or applies recommendations for the same tool, then tenant B receives only its own recommendation list and cannot read or apply tenant A's recommendation.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/:toolId/activity`, when the tenant has governance, runtime, validation, update, upstream, candidate, work-order, or audit records for that reviewed tool, then the API returns a tenant-scoped timeline with source, category, status, title, summary, timestamp, entity reference, and non-secret metadata.

Given a tenant Owner/Admin opens Registry Center and loads tool activity, when activity exists for the selected tool, then the UI renders the timeline from `/api/v1/third-party-tools/:toolId/activity` and does not show credentials, raw scanner output, or UI-only placeholder logs.

Given tenant A has third-party tool activity records, when tenant B requests activity for the same tool, then tenant B receives only its own tenant-scoped activity plus any platform-global install job records that are intentionally visible to that tenant.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/:toolId/runner-eligibility`, when the tool has no internal-runner capabilities, then the API returns `ControlPlaneOnly` with capability-level reasons and does not queue missions, create runner tasks, install packages, or execute modules.

Given a tenant Owner/Admin requests `GET /api/v1/third-party-tools/:toolId/runner-eligibility`, when a tool has internal-runner capabilities but lacks an active runner, verified compatible scope, runtime availability, enablement, approval, implementation, or server dispatch allowlist coverage, then the API returns the matching blocked/readiness state and required actions.

Given a tenant has an active runner, verified compatible scope, enabled tool, available runtime, implemented internal-runner capability, and server allowlisted signed-task dispatch route, when runner eligibility is requested, then the API returns `Ready`, `eligible: true`, capability-level dispatch route metadata, and no runner task is created by the read-only eligibility request.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/:toolId/runner-dispatch` for a reviewed capability that is `Ready`, when the request names a tenant-owned active runner, verified compatible scope, and scoped target, then the API creates a signed runner task by delegating to the existing runner task builder and writes a `third_party_tool.runner_dispatched` audit event.

Given a tenant Owner/Admin requests `POST /api/v1/third-party-tools/:toolId/runner-dispatch` for a disabled, legal-review, fixture-only, approval-gated, missing-runtime, missing-runner, missing-scope, or unallowlisted capability, when the request is evaluated, then the API rejects it before runner task creation and writes a `third_party_tool.runner_dispatch_denied` audit event.

Given a tenant administrator opens Registry Center and checks runner eligibility for a governed tool, when the API returns the report, then the UI renders active runner count, verified scope count, runtime availability, server allowlist metadata, capability status, reasons, and required actions from `/api/v1/third-party-tools/:toolId/runner-eligibility`.

Given tenant A has a submitted third-party tool candidate, when tenant B lists or reads intake candidates, then tenant B receives only its own candidate list and cannot read tenant A's candidate detail.

Given tenant A has a submitted third-party tool candidate, when tenant B attempts to review it, then tenant B receives not found and no cross-tenant review metadata or audit event is created.

Given tenant A has generated a third-party tool implementation work order, when tenant B attempts to list or generate work orders for tenant A's candidate, then tenant B receives not found and no cross-tenant work-order metadata or audit event is created.

Given tenant A has generated a third-party tool implementation bundle, when tenant B attempts to download the bundle by candidate/work-order IDs, then tenant B receives not found and no cross-tenant scaffold content, file hashes, or audit metadata is exposed.

Given a proposed tool manifest declares AGPL/unknown legal posture, destructive behavior, target mutation, real data exfiltration, or a conflicting runner execution mode, when intake validation runs, then the API returns `RequiresChanges` or `Rejected` with explicit checks and remediation actions and does not install, enable, catalog, or execute the tool.

Given a tool is marked for customer-network execution, when it is dispatched to the Internal Runner, then the task is signed, scoped, nonce-protected, locally allowlisted, resource-limited, evidence-backed, activity-logged, and auditable; reverse SSH, arbitrary shell, uncontrolled tunnel, destructive testing, persistence, credential theft, and real exfiltration are rejected.

Given a tenant admin requests a governed tool install, when the API accepts the request, then it creates a queued install job and writes an install-requested audit event without executing docker, git, pip, shell, or arbitrary customer-provided commands.

Given the platform tool-install worker is enabled, when it leases a queued install job, then it builds the command only from reviewed tool metadata, executes only if `PERISCAN_THIRD_PARTY_TOOL_INSTALL_EXECUTE=true`, redacts output, updates runtime readiness, and writes installed or failed audit events.

## Alibaba Cloud Read-Only Connector

Requirement labels: `PRD-SignalFabric`, `PRD-IntegrationMarketplace`, `PRD-CloudValidation`, `PRD-API-First`, `PRD-Real-First`.

Given a customer API user reads the integration catalog, when Alibaba Cloud is returned, then it is marked connectable Beta with read-only `ecs:DescribeInstances`, `ecs:DescribeSecurityGroups`, and `ram:ListRoles` permissions, mock support, and cloud validation capabilities.

Given a tenant connects Alibaba Cloud in mock mode, when sync runs, then Periscan returns normalized CloudResource assets and `AlibabaCloudAccountInventory`, `AlibabaEcsInstanceObserved`, `AlibabaEcsPublicExposure`, `AlibabaSecurityGroupObserved`, and `AlibabaRamRoleObserved` signals without queuing validation work.

Given a tenant connects Alibaba Cloud with RAM access-key credentials, when live sync runs, then Periscan signs HTTPS RPC requests and calls only `DescribeInstances`, `DescribeSecurityGroups`, and `ListRoles`; create/update/delete/remote-access actions are denied by connector allowlist before fetch.

Given live Alibaba Cloud responses contain public/private IP addresses or credential material exists in config, when sync results are serialized, then returned assets/signals do not contain the access key secret or raw IP addresses while preserving evidence pointers to resource IDs.

## Oracle Cloud Infrastructure Read-Only Connector

Requirement labels: `PRD-SignalFabric`, `PRD-IntegrationMarketplace`, `PRD-CloudValidation`, `PRD-API-First`, `PRD-Real-First`.

Given a customer API user reads the integration catalog, when Oracle Cloud Infrastructure is returned, then it is marked connectable Beta with read-only compartment inspection permissions, mock support, and cloud validation capabilities.

Given a tenant connects OCI in mock mode, when sync runs, then Periscan returns normalized CloudResource assets and `OracleCloudCompartmentInventory`, `OracleComputeInstanceObserved`, `OracleVcnObserved`, `OracleSecurityListObserved`, and `OracleSecurityListInternetOpenIngress` signals without queuing validation work.

Given a tenant connects OCI with API-signing-key credentials, when live sync runs, then Periscan signs HTTPS GET requests and calls only `/20160918/instances`, `/20160918/vcns`, and `/20160918/securityLists`; mutation, console, command, object-content, and credential API paths are denied before fetch.

Given live OCI responses contain VCN CIDR blocks or the private key exists in config, when sync results are serialized, then returned assets/signals do not contain private key material or raw CIDR blocks while preserving evidence pointers to resource IDs.

## Engagement Fixture Target Guard

Requirement labels: `PRD-RealFirst-EngagementTargetGuard`, `PRD-PeriscanOperators`, `PRD-API-First`, `PRD-Real-First`.

Given API dev mode is disabled and a tenant posts `POST /api/v1/engagements` with any engagement plan target containing `fixture*` or `mockMode` keys, when the request is evaluated, then the API returns `400` with `fixture_mode_disabled`.

Given a production engagement request is denied for fixture target hints, when persistence is inspected, then no `Engagement`, `ValidationRun`, `EvidenceArtifact`, queue job, or module execution is created for that request.

Given API dev mode is enabled for deterministic local/acceptance tests, when an engagement runs, then server-side dev mode may add fixture execution hints internally while production callers still cannot supply synthetic proof hints.

## Full Product Route Coverage

Requirement labels: `PRD-WebRouteCoverage`, `PRD-UX-MainNavigation`, `PRD-API-First`, `PRD-Accessibility`.

Given any route listed in the primary navigation contract, when Playwright loads the route, then the shared shell renders the primary navigation, exposes exactly one active `aria-current="page"` link, renders a breadcrumb with the current page, and includes all primary navigation destinations.

Given a 320px mobile viewport, when Playwright loads every primary navigation route, then the app navigation remains horizontally scrollable within its own container, the document does not overflow, and the active route remains reachable.

Given each static primary navigation route and the dynamic Snapshot report route, when axe WCAG A/AA analysis runs, then the route returns no violations.

## CTEM Program Summary Provenance

Requirement labels: `PRD-CTEM-View`, `PRD-API-First`, `PRD-No-Raw-Findings`.

Given a tenant has no Validation Snapshot, when `GET /api/v1/ctem/program` is called, then the response includes `source: "LiveTenantStateBaseline"`, `snapshotId: null`, and stage statuses derived from current tenant-scoped state without implying a report has been generated.

Given a tenant has a Validation Snapshot, when `GET /api/v1/ctem/program` is called, then the response includes `source: "Snapshot"` and the backing `snapshotId`.

Given Validation Ops renders the CTEM program, when the summary is Snapshot-derived or baseline-derived, then the page explicitly states the source so users can distinguish proof from a live not-started baseline.

## Report List Response Bounding

Requirement labels: `PRD-API-First`, `PRD-Reports`, `PRD-Operational-Hardening`.

Given a tenant has multiple reports, when `GET /api/v1/reports` is called without `limit`, then the API preserves existing behavior and returns all tenant-scoped reports newest-first.

Given the same tenant calls `GET /api/v1/reports?limit=2`, then the API returns only the two newest tenant-scoped reports and does not affect report creation, export, or share-link behavior.

Given an out-of-range report limit is provided, when the API parses the query, then it uses the shared limit clamp rather than returning an internal error.

## Measured Posture in Snapshot and Fix Verification

Requirement labels: `PRD-MeasuredPostureSnapshotFixVerification`, `PRD-ValidationSnapshot`, `PRD-FixVerification`, `PRD-Core-ProofLoop`.

Given a tenant has a verified Domain or Subdomain scope, when a user creates a Validation Snapshot, then the API runs the built-in measured DNS/TLS/HTTP/email posture modules before building the Snapshot payload, persists validation runs/evidence/signals, and updates the scope posture cadence.

Given the same Snapshot path runs in dev mode, when the measured modules execute, then fixture mode is used only for deterministic local/test validation; in production, the same path uses live-safe non-invasive module execution.

Given an external-exposure remediation is verified, when the fix-verification planner evaluates the path/remediation context, then the selected modules are the measured posture modules that support `FixVerification`, each run target includes the verified-scope hostname and a policy decision, and the mission safety level reflects the highest selected module safety.

Given measured validation-module retests execute successfully and the previous measured path no longer re-correlates, when the verification event is written, then the outcome may be `Fixed` and `measuredRevalidation` is true; compare-only retests remain inconclusive and unmeasured.

## Web Shell Breadcrumbs

Requirement labels: `PRD-WebShellBreadcrumbs`, `PRD-UX-MainNavigation`, `PRD-API-First`.

Given a user visits any primary Periscan web route, when the root shell renders, then a `Breadcrumb` navigation region is visible, includes the Workspace root when not on `/`, and marks the current page with `aria-current="page"`.

Given a user visits an exact primary route such as `/trust-safety`, when breadcrumbs render, then the owning navigation section (for example `Govern`) is shown and the current label matches the primary navigation contract rather than page-local copy.

Given a user visits a dynamic Snapshot report route such as `/snapshots/:id`, when breadcrumbs render, then the current label is `Snapshot report`, the section is `Validate`, and opaque snapshot IDs are not exposed as breadcrumb labels.

Given a user visits a dynamic Snapshot report route such as `/snapshots/:id`, when the report toolbar renders, then it includes links to Workspace, Validation Ops, Trust & Safety, and API Reference so the report detail page remains connected to adjacent API-backed workflows.

Given shell-level Playwright gates run, when they iterate primary routes, then primary navigation, active route state, skip link behavior, mobile overflow checks, and breadcrumb current-page state all pass.

Given shell-level Playwright gates run, when they visit a representative dynamic Snapshot report route, then shared navigation, breadcrumb labeling, peer workflow links, and WCAG A/AA axe checks pass without exposing opaque report IDs as breadcrumb labels.

## MSSP Responsive Portfolio

Requirement labels: `PRD-MSSPResponsivePortfolio`, `PRD-MSSP-Multitenancy`, `PRD-UX-Responsive`.

Given an MSSP operator views the client portfolio on a narrow mobile viewport, when metric and client coverage cards render, then they use one-column mobile-first grids and expand to two/four columns only at larger breakpoints.

Given component tests run for the MSSP portfolio, when API-backed portfolio data is rendered, then tests assert the metric and coverage grid breakpoint classes so responsive layout does not regress silently.

## Tenant OIDC/SAML SSO Foundation (Enterprise Access)

Requirement labels: `PRD-EnterpriseAccess-SSOFoundation`, `PRD-API-First`, `PRD-Auditability`.

Given a tenant owner or admin calls `PUT /api/v1/tenants/current/sso` with OIDC issuer, authorization endpoint, client id, optional client secret, scopes, redirect URI, and domain allowlist, when the request succeeds, then Periscan persists a tenant-scoped SSO config, encrypts the client secret, returns only `clientSecretSet`, and writes a `sso_config.updated` audit event.

Given the same tenant calls `GET /api/v1/tenants/current/sso`, when a config exists, then the API returns sanitized configuration without encrypted or plaintext secret material; when none exists, it returns `{ "config": null }`.

Given a configured and enabled OIDC provider, when an admin calls `GET /api/v1/tenants/current/sso/authorization-url` with `state` and `nonce`, then Periscan returns an authorization URL containing `response_type=code`, configured scopes, client id, redirect URI, state, nonce, and optional prompt/login hint.

Given SSO is disabled or not configured, when authorization URL generation is requested, then the API returns a stable `sso_not_enabled` error and does not fabricate a login flow.

Given a tenant owner or admin calls `PUT /api/v1/tenants/current/sso` with SAML issuer, SSO endpoint, SP entity ID, redirect URI, IdP certificate, and domain allowlist, when the request succeeds, then Periscan persists a tenant-scoped SAML config, stores the IdP certificate for response verification, returns only `samlIdpCertificateSet`, clears OIDC-only token/JWKS/client-secret fields, and writes a `sso_config.updated` audit event without raw certificate material.

Given the same SAML tenant calls `GET /api/v1/tenants/current/sso/metadata`, when a SAML config has a redirect URI, then the API returns SAML service-provider metadata XML with the configured entity ID and assertion consumer service URL.

Given an enabled SAML provider, when an admin calls the OIDC-only `/api/v1/tenants/current/sso/authorization-url` helper, then Periscan returns `sso_saml_start_required` because SAML AuthnRequests must be generated through `/api/v1/auth/sso/start` so request correlation can be persisted.

Given a viewer or non-admin calls any tenant SSO management route, when RBAC is evaluated, then the API returns 403 and no SSO config or audit mutation occurs.

Given an enabled tenant OIDC configuration with an email-domain allowlist, when a user calls `POST /api/v1/auth/sso/start` with a matching email, then Periscan stores only hashed state and nonce, returns an authorization URL with generated `state` and `nonce`, writes `sso.login_started`, and does not create a local session yet.

Given the IdP redirects to `GET /api/v1/auth/sso/callback` with code and state, when the token endpoint returns a valid ID token signed by the configured JWKS and matching issuer, audience, nonce, requested email, and allowed domain, then Periscan consumes the state exactly once, finds an active provisioned tenant member, issues the normal HttpOnly session cookie, returns the authenticated context, and writes `sso.login_completed`.

Given a tenant has enabled `enforced` SSO, when that provisioned user attempts password login, then `POST /api/v1/auth/login` returns 403 with `sso_required`, writes `sso.login_failed`, and does not issue a session cookie.

Given a user has a password-authenticated session from another non-enforced tenant and is also a member of an enforced-SSO tenant, when they request that enforced tenant by `x-periscan-tenant-id`, then Periscan returns 401 and does not allow tenant switching unless the session was created by SSO for that same tenant or trusted system context.

Given callback state is replayed, expired, invalid, or the ID token fails JWKS/issuer/audience/nonce/email checks, when callback completion is attempted, then the API returns a stable SSO error code and writes `sso.login_failed` without creating a session.

Given an enabled tenant SAML configuration with an email-domain allowlist, when a user calls `POST /api/v1/auth/sso/start`, then Periscan stores only hashed RelayState and hashed SAML request ID correlation, returns a SAML AuthnRequest URL with `SAMLRequest` and `RelayState`, writes `sso.login_started`, and does not create a local session yet.

Given a SAML IdP posts `SAMLResponse` and `RelayState` to `/api/v1/auth/sso/callback`, when the response signature, issuer, audience, `InResponseTo`, requested email, allowed domain, and provisioned-user membership are valid, then Periscan consumes the state exactly once, issues the normal HttpOnly session cookie, returns the authenticated context, and writes `sso.login_completed`.

Given the SAML response is missing, unsigned/invalid, mismatched, replayed, or the RelayState is invalid, when callback completion is attempted, then the API returns a stable SSO error code such as `sso_saml_response_invalid` or `sso_state_invalid`, writes `sso.login_failed` when state is known, and does not create a session.

## Evidence Tenant Authorization Hardening

Requirement labels: `PRD-EvidencePacks`, `SECURITY-TenantIsolation`, `SECURITY-EvidenceAuthorization`.

Given a tenant owner has generated evidence through a Snapshot, when they request `GET /api/v1/evidence/:id` or `GET /api/v1/evidence/:id/download`, then the API returns only that tenant's evidence artifact and redacted/downloadable content.

Given another tenant requests the same evidence artifact by ID through either evidence route, when tenant context is evaluated, then the API returns 404 and does not reveal that artifact metadata or content.

Given a tenant has evidence-backed attack paths, when the owner requests `GET /api/v1/attack-paths/:id/evidence`, then the API returns only evidence artifacts whose `tenantId` matches the active tenant.

Given another tenant requests the same attack-path evidence route by path ID, when tenant context is evaluated, then the API returns 404 and does not leak path existence or linked evidence IDs.

Given a viewer role (no SCOPE_EDITOR) attempts createMission or startMission with/without decision, when evaluated, then 403 or appropriate RBAC deny (not policy code); tenant isolation still holds for cross-tenant decision misuse.

Given a malformed/expired JWT in the session cookie, when any protected route (e.g. GET /me, POST /missions) is called, then the API returns 401 with code "unauthorized" (no 500 leak from verify) via the try/catch in getAuthContext; POST /logout still succeeds with 204 and clears the cookie.

Given a runner registration or poll uses invalid/mismatched token, when processed, then "runner_unauthorized" code is returned and audited; no tasks leaked.

Given any of the above binding/auth/target errors, when the response is inspected, then {code, error} shape is always present per ApiErrorSchema (code stable for clients); no secrets or internal stack in body.

Given the P0 regression suite in app.test and security boundaries, when pnpm test:security + api targeted run, then all mismatch/omit-target/bad-cookie cases assert exact codes, 4xx status, no queue side effects, and run.target persistence.

## UX States, Loading/Empty/Error/Success, Sync/Health, Responsive (P1/P2; covers edges, roles, persist, mobile)

Requirement labels: `PRD-BetterTogetherUX`, `SPEC-UI-01`, `PRD-Trust-Safety-Page`, `PRD-Integration-Marketplace`, `PRD-ThreatCenter-WebSurface`.

Given a returning authenticated user (valid cookie) loads Workspace or Threat Center, when the component mounts, then isLoading=true renders neutral "Restoring your session..." panel (no auth form visible); after /me success, isLoading=false and real workspace/content appears; on 401, transitions to auth gate. Component tests assert no premature auth UI.

Given Integration Marketplace initial load, when catalog fetch pending, then loading state is shown (no flash of empty grid); on filter with zero matches, "No connectors match your filters" empty state renders; fixture connector buttons are hidden unless `NEXT_PUBLIC_PERISCAN_ENABLE_FIXTURE_CONNECTORS=true`; post successful fixture-lab or live connector setup, client calls syncIntegration, and Marketplace plus Trust & Safety immediately reflect current healthStatus + recent lastSyncAt (persisted via real /health or /sync).

Given Integration Marketplace connected cards or Trust & Safety connected list, when "Sync now" clicked for a connector (incl new PSA like Syncro), then button disables (busy), POST /integrations/:id/sync succeeds, and the UI refreshes from tenant-scoped API data with updated healthStatus/lastSyncAt; errors surface as an alert without crashing. Persist verified in DB via integration record.

Given Integration Marketplace connected cards or Trust & Safety connected list, when "Refresh health" clicked for a connector, then GET /integrations/:id/health succeeds, the UI refreshes from tenant-scoped API data, and no signal import or workflow mutation is implied.

Given a tenant with no connected integrations visits Trust & Safety, when loaded, then empty state "No integrations are connected..." shown (real API data); error from backend (e.g. 500) surfaces consistently as error pill with retry path.

Given Snapshot report view (/snapshots/:id) for invalid id or unauth, when navigated, then specific "Report not found or access denied" state (or 404/403 mapped), no raw error, back link works; loading during analyst note save re-fetch.

Given mobile viewport (<720px, portrait), when any primary page (/, /integrations, /threat-center, /trust-safety, /mssp, report) renders, then grids stack (auto-fit degrades), padding reduces, no overflow on 320px; labels readable, buttons tappable. (Globals + component responsive.)

Given error during import in Threat Center (bad payload or 4xx), when triggered, then error-copy or dedicated error panel with code if present, list remains usable; success import adds to real list and detail loads with all sub-states (readiness, missing signals impacted by connectors, plan, export buttons).

Given 401 on protected web surface, when token expires mid-session, then graceful gate with "Sign in" (no crash, state reset).

## PSA/RMM Remediation Ticket Creation (Direct + Workflow; P1-007)

Requirement labels: `SPEC-REM-01`, `PRD-Syncro-MSSPConnector` (and Halo/Autotask/ConnectWise/Ninja peers), `PRD-Remediation API`.

Given a Snapshot has produced a RemediationTask (from policy-approved mission/run/evidence on verified scope), when a tenant admin (SCOPE_EDITOR) with a connected Syncro (or peer PSA) integration calls POST /remediations/:id/create-ticket with {integrationId: syncroId}, then the API resolves the workflow-capable connector, calls sendWorkflowEvent with remediation-derived payload (under policy context), returns {ticketId: "SYNCRO-...", ticketSystem: "Syncro", ...}, sets on RemediationTask, writes audit "remediation.ticket.created", no job queued, no secret leak in response. (Jira compat path remains for integrationId omitted.)

Given the same for HaloPSA/Autotask/ConnectWise (via their integrationId), when create-ticket, then ticketSystem matches the connector (e.g. "HaloPSA"), delivery "Delivered" state in audit/metadata, real or mock per integration config.

Given no connected PSA or unsupported integrationId, when create-ticket called, then 400/404 with clear error (no ticket, no side effects); viewer role gets 403.

Given acceptance + e2e exercising Snapshot -> rem -> Syncro ticket (policy context), when pnpm test:acceptance and test:e2e, then PSA path asserts ticket metadata, system, no-leak, audit, states (success/failed), and real API calls (no fakes in path).

Given signal-trigger routing to PSA (separate journey), when approved, then deliver still uses general sendWorkflowEvent; direct remediation now also covers PSA uniformly.

## Threat Center Full States + Real Signal Impact + Export (P1-001)

Requirement labels: `PRD-ThreatCenter-ManualImport`, `PRD-ThreatCenter-WebSurface`, `PRD-ThreatCenter-ReadinessExport`.

Given no advisories imported, when /threat-center loads (real API), then list empty state "No advisories have been imported yet..." and detail "Select or import an advisory..."; import form present.

Given import of advisory (title, source, summary, CVE/IoC/TECH), when POST succeeds, then list updates with real persisted item; detail loads with readiness (computed from tenant config, no exec queued), missingSignals list (initially populated), plan items with status pills (NeedsApproval etc), evidence chips; real connector signals (e.g. Splunk from control validation) reduce specific missingSignals like "control_telemetry" in impact.

Given readiness computed, when export HTML or PDF via button or API /readiness-report/export or /reports/:id/export, then download succeeds with evidencePackId, redacted content, audit event; report contains evidence IDs, methodology, no raw advisory.

Given error on import (bad data) or detail load (transient), when occurs, then error state shown (copy + code), list remains usable; loading panels during list/detail/export.

Given cross-tenant advisory access attempt, when via API, then 404 (tenant isolation); all states covered in web component tests + api.test threat blocks + acceptance threat journey.

## Internal Runner Deploy and Validation (P1-003)

Requirement labels: `PRD-Runner-ProductionPackaging`, `PRD-Runner-LocalLabE2E`, `PRD-Production-Readiness`.

Given customer follows apps/runner/deploy/README.md (GHCR image, k8s yaml or systemd unit or compose), when runner registers with short token, polls signed reachability task (scope enforced), uploads artifact (hash/size), submits result, then API accepts, stores redacted evidence, updates run/task, audits; non-root + sec opts in manifests.

Given pnpm test:runner + test:runner:lab + docker non-root, when executed in CI or customer env, then loopback reach + artifact upload + result roundtrip validated (real main.go paths).

Given Supabase aliases + runner, when configured per .env + deploy notes, then runner reaches API (outbound) and artifacts land in Supabase S3 compat; deployment-managed disclosures in Trust & Safety and docs.

Given no runner or unapproved, when reachability task requested, then policy denies before signed envelope; all states (registered, heartbeat, revoked, poll empty, result mismatch) audited and rejected gracefully.

All new AC exercised in existing pnpm verify gates + targeted (no new mocks in prod paths).
