# Localization operations runbook

## Supported product boundary

Periscan provides reviewed presentation releases for five locales: en-US,
es-ES, fr-FR, de-DE, and ja-JP. A release binds the selected locale, IANA
timezone, built-in catalog version and digest, per-surface coverage, support
owner, review reference, reason, actor, and activation time.

The governed catalog covers product-shell navigation and Validation Snapshot
report chrome. Locale-aware report numbers and currency assumptions use the
same locale contract. Evidence identifiers, stored verdicts, module outcomes,
machine-readable values, and claim semantics remain invariant.

Page bodies, inline help, customer-authored evidence, regulatory language,
tax, legal terms, and procurement text are not automatically translated.
Changing locale or timezone changes presentation only; it does not move tenant
data, change the configured data region, or authorize a cross-border transfer.

## Preview a release

Open **Govern → Tenant & access → Language release desk**.

1. Select one supported language.
2. Enter or choose a valid IANA timezone such as `Europe/Paris` or
   `Asia/Tokyo`.
3. Choose **Preview formatting**.
4. Check the full date/time, decimal grouping, and relative-time examples.
5. Confirm that the previewed locale and timezone match the proposed regional
   operating policy.

Preview is non-mutating. An invalid timezone fails with
`invalid_localization_timezone`; do not substitute an offset or silently fall
back to UTC.

## Verify the catalog

Before activation, inspect **Catalog assurance** for the selected locale:

- **Product shell** covers navigation, route labels, and primary action labels.
- **Snapshot report** covers the governed report-template headings.
- Every scope must show 100% coverage and zero fallback keys.
- Record the catalog version and digest in the review ticket.

The digest is calculated from the exact locale's product-shell and report copy
plus the catalog version. If a future catalog is incomplete, activation fails
closed rather than mixing an unreviewed partial release into the product.

## Activate a reviewed catalog

Only Owner, Admin, MSSPOwner, and ClientAdmin roles can preview or activate a
release.

1. Enter the regional support owner email.
2. Enter the approved translation/release/ticket reference.
3. Record a reason covering catalog review, formatting, fallback boundaries,
   and support ownership.
4. Choose **Activate localization release**.
5. Confirm that navigation updates in place, the HTML language changes, and a
   new activation-ledger row appears.

Activation atomically updates the tenant locale and timezone and appends an
immutable release. It also emits `tenant.localization_activated` with catalog,
review, prior-policy, and semantic-invariant metadata.

## Validate a report

Generate a new Validation Snapshot report after activation.

1. Confirm the HTML `lang` value matches the active locale.
2. Confirm governed report headings use the activated catalog.
3. Confirm dates, number grouping, and USD risk assumptions follow the locale.
4. Compare evidence IDs, verdict values, risk bands, and machine-readable
   values with the source Snapshot; they must not change.

Historical exports are not rewritten. Generate a new report when a newly
activated presentation policy must be represented.

## Roll back or recover

Localization releases are not edited or deleted. To recover:

1. Select the previous language and timezone.
2. Preview the formatting again.
3. Enter a new rollback/change reference and reviewed reason.
4. Activate the prior presentation as a new release.
5. Confirm the new sequence points back to the previous active locale and
   timezone while older releases remain visible.

If activation fails, refresh the workspace before retrying. Never change the
tenant data region as a localization recovery step.

## API operations

| Operation                   | Endpoint                                           |
| --------------------------- | -------------------------------------------------- |
| Read active policy          | GET /api/v1/tenants/current/localization           |
| Read catalogs and ledger    | GET /api/v1/tenants/current/localization/workspace |
| Preview locale and timezone | POST /api/v1/tenants/current/localization/preview  |
| Activate a reviewed release | PUT /api/v1/tenants/current/localization           |

## Qualification

Run the focused real-PostgreSQL proof:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm exec vitest run --dir tests/acceptance \
  -t "previews, reviews, activates" \
  --reporter=verbose --hideSkippedTests --testTimeout=60000
```

The acceptance path proves honest default state, five complete catalogs,
invalid-timezone denial, non-mutating Japanese preview, required review
provenance, Japanese activation, locale/timezone persistence, immutable release
sequence, English/UTC recovery, audit metadata, semantic/residency boundaries,
and tenant isolation.

### Rendered guide qualification — 2026-07-16

The Admin product guide was followed literally against the local
database-backed application:

1. `ja-JP` / `Asia/Tokyo` preview rendered Japanese date and relative-time
   output without changing the active en-US/UTC policy.
2. Catalog assurance showed Product shell 39/39 and Snapshot report 15/15 with
   zero fallback keys and the selected catalog digest.
3. A reviewed Japanese activation changed navigation and HTML `lang` in place
   and created ledger sequence 1.
4. A newly generated Validation Snapshot used Japanese governed headings while
   UUID evidence identifiers and stored verdict values remained unchanged.
5. A reviewed en-US/UTC recovery created ledger sequence 2 while sequence 1 and
   the `us-east-1` data region remained unchanged.

The default desktop viewport and a 390×844 viewport had equal document client
and scroll widths (no horizontal overflow). Browser console errors: zero.

Before release, run the complete gate:

```bash
export DATABASE_URL=postgresql://periscan:periscan@127.0.0.1:5434/periscan
export PERISCAN_TEST_DATABASE_URL="$DATABASE_URL"
pnpm verify
```

The 2026-07-16 release gate passed with 78 web files / 255 tests, 25 API files /
332 tests, 25 shared files / 141 tests, 7 module files / 176 tests, a 53-route
production build, 94 Playwright journeys, 25 security-boundary tests, 134
acceptance files / 173 tests, and all 138 migrations. License, dependency,
enum-drift, PRD, and analyst-score gates also passed.
