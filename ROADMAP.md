# Periscan Roadmap

## Phase 0 - Foundation

- repo docs and monorepo scaffold
- shared schemas and database layer
- auth, tenant isolation, scope verification
- policy engine, signal fabric, module registry
- worker, raw evidence store, basic evidence graph

## Phase 1 - Validation Snapshot

- fixture-first snapshot mission
- GitHub and AWS integrations
- safe external exposure validation
- attack-path correlation
- remediation guidance
- HTML report generation

## Phase 2 - AI App Validation

- AI application registry
- safe AI validation harness
- AI evidence in snapshot reports

## Phase 3 - Control Validation

- control source registry
- safe control validation modules
- ATT&CK mapping
- control evidence in reports

## Phase 4 - Fix Verification

- remediation tickets
- targeted re-test workflow
- verification events

## Phase 5 - Internal Runner

- Go runner skeleton
- outbound HTTPS control channel with mTLS
- signed tasks
- scope-local reachability checks

## Phase 6 - Continuous Validation

- scheduled missions
- diff views
- reopened risk handling

## Phase 7 - MSSP

- parent/child tenants
- white-label reporting
- usage metering

## Phase 8 - Frontier Gateway

- BYO frontier-model providers (OpenAI/Anthropic-compatible) with encrypted credentials
- policy profiles, sessions, and modes (PlanOnly -> HighAssurance)
- context broker with redaction and a code-defined typed tool catalog
- turn orchestrator with a policy enforcement point, approval pause/resume, and kill switch
- read-only/plan tools, then approval-gated validation/remediation/reporting tools via existing mission machinery
- provider-pluggable adapter layer so a future specialized cyber model is a new adapter only
