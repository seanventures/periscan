# Design-partner analyst evidence metrics (P12-20)

Status: **instrumented in product API** — real customer outcomes still zero until
partners run the loop.

## One onboarding rail

Operators use:

1. Dashboard Get Started / Getting Started (single proof-loop vocabulary)  
2. Design-partner workspace: `GET /api/v1/tenants/current/design-partner`

Do not maintain a third parallel checklist.

## Checklist completion metrics

Workspace response now includes `metrics`:

| Field | Meaning |
|-------|---------|
| `onboardingCompletionPct` | Onboarding checklist complete / total |
| `integrationCompletionPct` | Integration checklist complete / total |
| `overallCompletionPct` | Combined |
| `allRequiredComplete` | Boolean gate for “design-partner ready” |

## Anonymized proof-loop KPIs (analyst briefings)

`proofLoopKpis` is export-safe (no customer names/domains/secrets):

| Field | Meaning |
|-------|---------|
| `verifiedScopeCount` | Count of Verified scopes |
| `connectedCoreSystemsCount` / `Required` | Core signal sources for first Snapshot |
| `snapshotReady` | Validation Snapshot pack exists |
| `analystNoteAttached` | Founder/operator note on latest pack |
| `designPartnerModeEnabled` | Tenant flag |
| `proofLoopReadinessPct` | Equal-weight composite of the five gates |

Use these for MQ / Wave briefing decks as **anonymized completion rates**, never
as invented customer quotes.

## Session learning (SESSION_LEARNING_LOG / P08-8)

Workspace response includes `sessionLearning` (honest empty until real sessions):

| Field | Meaning |
|-------|---------|
| `sessionCount` | Internal notes logged (starts at **0**) |
| `sessionsRequired` | Always `5` |
| `sessions` | Internal note list (not public refs) |
| `sessionsGateMet` | `sessionCount >= 5` only |
| `waveMarketPresenceReady` | Always `false` in product |
| `message` | Operator-facing gate copy (“Need 5 sessions before Wave”) |

`POST /api/v1/tenants/current/design-partner/session-notes` appends internal notes
only (`isPublicReference: false`). Does not claim Wave/MQ market presence.

## Remaining open

| Gate | Status |
|------|--------|
| Three production design-partner references | **Zero** until real consent |
| Five ICP first sessions | **0 / 5** until real sessions |
| Weekly proof-loop outcome quotes | Blank until sessions run |

See [`REFERENCE_PACK_CHECKLIST.md`](./REFERENCE_PACK_CHECKLIST.md).
