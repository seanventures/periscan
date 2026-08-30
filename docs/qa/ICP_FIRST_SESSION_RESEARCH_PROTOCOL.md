# Periscan ICP first-session research protocol

Status: ready to run with real design partners
Owner: product + security engineering
Source roadmap: [`UI_RELEASE_ICP_ROADMAP.md`](./UI_RELEASE_ICP_ROADMAP.md)
Wave finding: **P13-8** (TaskSuccess lag vs Trust)

## Purpose

Validate whether the release UI lets a first customer reach and explain
measured evidence without a Periscan operator translating the interface. This
protocol must use authorized customer or controlled-lab data. Internal browser
QA and sample reports do not count as participant evidence.

## Wave success metrics (P13-8)

| Metric | Definition | Pass bar (design partner) |
|--------|------------|---------------------------|
| Time-to-first Measured finding | Clock from login on empty tenant to first finding with Measured path or measured signal | Record median across 5 sessions; target &lt; 45 min moderated |
| Time-to-verified Fixed | Clock from open remediation to Fixed after retest with verification event | Record median; Fixed without retest is a protocol fail |
| Silent write failures | Operator action appears to succeed but API/UI state does not persist | Zero tolerated in study notes |
| Evidence integrity operable | Participant can run Verify chain / integrity on Evidence UI without facilitator | 4/5 sessions |

## Participant minimum

- Five observed first sessions.
- At least two security leaders or security engineers.
- At least two MSSP or vCISO operators.
- At least one participant completes the core flow by keyboard for the primary
  actions.

Do not recruit someone who helped design the tested workflow as an unqualified
participant. Record role and prior Periscan exposure, not personal or customer
secrets.

## Safe test setup

1. Provision an empty tenant and confirm the participant's authorized scope.
2. Use a real read-only source or a clearly named controlled lab. Do not use the
   sample report as a substitute for measured evidence.
3. Keep the effective scope safety ceiling and policy decision visible.
4. Record the session only with consent. Redact hostnames, evidence content,
   credentials, and customer identifiers from research notes.
5. Stop if the participant attempts an unauthorized or destructive target.

## Moderator script

Use think-aloud prompts and avoid explaining product terminology before the
participant acts.

1. “You want defensible proof of the most important reachable risk. Begin from
   this new account.”
2. “Show me what Periscan can read and what it cannot do yet.”
3. “Authorize the smallest scope you would be comfortable validating.”
4. “Before starting, tell me whether this action is measured, heuristic,
   simulated, unconfigured, or pending.”
5. “Run the first valid scenario and explain the result in your own words.”
6. “Identify the smallest path breaker and assign the next action.”
7. “Explain what would be required before calling the risk fixed.”
8. “Prepare proof for a stakeholder and identify its evidence, redaction,
   freshness, integrity, audience, and delivery expiry.”
9. For MSSP participants: “Build a client exception batch and explain what
   remains tenant-bound.”

The moderator may repeat the task but must not name the control to click. Record
every support prompt separately.

## Measurements

Use the timestamps returned by `GET /api/v1/experience/activation` and the
underlying persisted entities. Capture:

- signup → connected source;
- signup → verified scope;
- signup → policy preview;
- signup → first mission;
- signup → first measured result;
- prioritized result → owned remediation clicks and elapsed time;
- remediation → fresh verification;
- proof creation → governed share/export;
- wrong turns, backtracks, support prompts, denied attempts, and out-of-scope
  attempts;
- contextual feedback rating and comment, when voluntarily submitted.

Never infer a completed milestone from a page visit. A milestone is complete
only when its persisted entity or verification event exists.

## Observer scorecard

For each participant, mark pass/fail and attach a short observation:

- Reaches a verified scope without coaching.
- Starts the first valid mission without coaching.
- Distinguishes measured evidence from heuristic, sample, simulated,
  unconfigured, and pending states.
- Identifies the next safe action.
- Finds the path breaker and its evidence in under two minutes.
- Does not mistake a proposed fix for a verified fix.
- Can identify evidence inclusion, redaction, freshness, integrity, audience,
  and expiry in the proof composer.
- For MSSP: understands that batch triage does not perform cross-tenant
  mutations.

## Session record

| Field                                          | Value |
| ---------------------------------------------- | ----- |
| Participant code                               |       |
| Role / organization type                       |       |
| Prior Periscan exposure                        |       |
| Authorized environment                         |       |
| Start / end time                               |       |
| Time to connected source                       |       |
| Time to verified scope                         |       |
| Time to first mission                          |       |
| Time to first measured evidence                |       |
| Clicks: prioritized result → owned remediation |       |
| Path breaker time                              |       |
| Support prompts / wrong turns                  |       |
| Denied or out-of-scope attempts                |       |
| Measured-vs-heuristic explanation              |       |
| Next-safe-action explanation                   |       |
| Proof accuracy review                          |       |
| Top friction and exact language                |       |

## Exit decision

Phase A evidence is satisfied only when:

- median time to verified scope and first mission has been calculated from all
  five session records;
- at least four of five participants can explain measured versus heuristic and
  identify the next safe action without coaching; and
- no participant mistakes sample, simulated, unconfigured, or pending work for
  measured proof.

Phase C evidence additionally requires 100% evidence citation for factual
grounded-analyst claims, zero successful policy/scope escapes, a sub-two-minute
path-breaker result, and human approval of proof traceability, audience fit,
redaction, and claim accuracy.

If a threshold fails, convert the observation into a reproducible product issue
with route, tenant maturity, proof-loop stage, expected behavior, and evidence.
Do not average away a safety or truthfulness failure.
