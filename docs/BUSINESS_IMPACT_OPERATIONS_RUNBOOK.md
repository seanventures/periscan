# Business impact governance runbook

## Supported product boundary

Periscan provides a tenant-scoped, FAIR-inspired PERT workflow for planning
business impact. It records low, most-likely, and high loss-event frequency and
magnitude assumptions, calculates an annualized loss exposure (ALE), requires
named source provenance, and activates an estimate only after an administrator
records a review decision.

The result is a customer planning assumption. It is **not** measured loss
history, an actuarial opinion, insurance advice, or a complete FAIR assessment.
Scenario prompts contain no benchmark dollar values. Periscan never invents a
frequency or magnitude range for the tenant.

## Roles and separation of duties

- Scope editors can preview and submit source-backed assumption versions.
- Tenant administrators can approve or reject a pending version.
- Read-only users can inspect the active estimate, limitations, provenance,
  integrity state, and permanent version ledger.

Approval records that the supplied source, range, and scenario boundary were
reviewed. It does not convert the assumption into observed evidence or prove a
security finding, attack path, or remediation.

## Create and preview an assumption

Open **Investigate → Attack Paths → Business impact desk**.

1. Select the discovered asset whose business exposure is being modeled.
2. Choose Availability disruption, Confidentiality loss, Third-party
   interruption, or Custom scenario. Use the prompts to establish the boundary;
   do not treat them as financial defaults.
3. Enter the business service and Low, Likely, and High frequency per year.
4. Enter the Low, Likely, and High loss magnitude in USD.
5. State which costs, affected operations, recovery assumptions, and exclusions
   are included.
6. Add at least one source with type, accountable owner, durable reference,
   as-of date, and the part of the estimate it supports.
7. Explain why this version is being submitted, then choose **Preview
   estimate**.

Preview is non-mutating. The current asset and attack-path exposure do not
change.

Periscan calculates each expected value with:

```text
PERT mean = (low + 4 × most likely + high) / 6
ALE = expected loss-event frequency × expected loss magnitude
```

The displayed low and high boundaries are scenario boundaries, not confidence
intervals or probability guarantees.

## Submit and review a version

After checking the preview, choose **Submit for review**. Periscan creates an
immutable, numbered `PendingReview` version and records its SHA-256 input
digest. The prior approved version, if any, stays active.

An administrator reviews the scenario, sources, ranges, assumption note, and
change reason. Enter a durable review reference and a specific review note,
then choose one decision:

- **Approve & activate** makes the submitted valuation current and supersedes
  the prior approved version without rewriting it.
- **Reject** records the decision and leaves the current approved valuation
  unchanged.

A decided version cannot be decided again. To correct an approved assumption,
submit a new version and review it; never edit history in place.

## Integrity, audit, and recovery

- Every read recomputes the version digest from canonicalized input. If the UI
  reports an integrity mismatch, stop decisions and investigate database and
  audit history.
- A database trigger prevents mutation of the version's asset, sequence,
  scenario, valuation, source provenance, change reason, digest, ALE, author,
  and creation time.
- Submission and review emit separate tenant audit events linked to the
  immutable valuation-version entity.
- Tenant row-level security applies to every version. A caller cannot preview,
  submit, review, or read an asset belonging to another tenant.
- The legacy direct-update endpoint returns `410` and cannot bypass review.
- Recovery is a newly submitted and approved version. Superseded, rejected,
  and pending versions remain visible in the ledger.

## API operations

| Operation                    | Endpoint                                                          |
| ---------------------------- | ----------------------------------------------------------------- |
| Read workspace               | GET /api/v1/business-impact/workspace                             |
| Preview without mutation     | POST /api/v1/assets/:assetId/valuation/preview                    |
| Submit immutable version     | POST /api/v1/assets/:assetId/valuation/versions                   |
| Record approval or rejection | POST /api/v1/assets/:assetId/valuation/versions/:versionId/review |
| Retired direct update        | PATCH /api/v1/assets/:assetId/valuation (returns 410)             |

## Qualification

Run the focused real-PostgreSQL proof:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm exec vitest run --dir tests/acceptance \
  -t "keeps assumptions inactive" \
  --reporter=verbose --hideSkippedTests --testTimeout=60000
```

The acceptance path proves honest empty state, numeric-free scenario templates,
required source provenance, retired direct mutation, non-mutating preview,
inactive submission, database immutability, approval activation, duplicate
decision rejection, digest verification, ordered audit evidence, and tenant
isolation.

The rendered Attack Paths guide was followed literally against the local demo
workspace. It produced a $307,500 preview, preserved the unvalued state while
pending, activated only after the recorded approval, and exposed the source
count, digest, integrity result, and review reference in the ledger. The desk
had no horizontal overflow at 1280px or 390px.

Before release, run the complete gate:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm verify
```

The 2026-07-16 database-backed gate passed with 79 web files / 256 tests, 25 API
files / 332 tests, 26 shared files / 144 tests, 7 module files / 176 tests, a
clean 53-route production build, 94 Playwright journeys, 25 security tests, 135
acceptance files / 174 tests, and all 140 migrations. License,
production-dependency, enum-drift, PRD, and analyst-score gates also passed.

## Remaining qualification for a 5.0 analyst score

The software workflow closes source, UX, integrity, authorization, audit, and
recovery gaps. A 5.0 still requires finance/risk ownership of the methodology,
at least two qualified customer environments, annual source and model review,
calibration against accepted incident or insurance evidence, SLO/support
operation, and independent usability evidence. Those outcomes cannot be
created from repository code alone.
