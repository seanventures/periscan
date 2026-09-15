# Honest measurement badges

These are **static range-receipt marks**, not CI status, not a score, and not
a security guarantee. They answer one question: did an authorized Periscan
Community run **produce evidence**?

They never say the target is Secure, Certified, or Pentested.

| Mark | File |
| --- | --- |
| Measured | [`images/badge-measured.svg`](images/badge-measured.svg) |
| Not measured | [`images/badge-not-measured.svg`](images/badge-not-measured.svg) |

![Measured by Periscan](images/badge-measured.svg)
![Not measured by Periscan](images/badge-not-measured.svg)

Same 200×44 plate so they swap without a layout jump. Dark ink (`#05070f`),
brand azure (`#3c96ff` / `#6fb2ff`), 6px product radius, Periscan radar
mark. Lettering is outlined IBM Plex so GitHub does not need the webfont.

**Default: not-measured.** Use measured only after a completed Community
run with evidence. This repository has no such dogfood run yet — keep
not-measured until one exists.

README fold is owned separately. Link these files later; do not invent a
live badge endpoint to go with them.

---

## Which file to use

| Situation | File |
| --- | --- |
| No Community run on this scope | **not-measured** |
| Run queued / in flight (Watch, not done) | **not-measured** |
| Run finished with **no** evidence | **not-measured** |
| Policy **denied** (denied work is never queued) | **not-measured** |
| Fixture, `pnpm seed:demo`, sample `/demo`, or lab theater | **not-measured** |
| Completed Community mission on **verified authorized scope** with evidence (`MeasuredResult`) | **measured** |

Settled: a queued Community job is not a measured result. Start-only must
not flip the mark. See [`SETTLED.md`](SETTLED.md) (`MeasuredResult` /
PERISCAN-516 / 519) and [`COMMUNITY.md`](../COMMUNITY.md).

Do not draw a third “policy denied” or “failed” badge. Red would read as
insecure; a spinner would read as a run in progress. Idle rings on
not-measured cover those states honestly.

Do not print a finding count on the plate. A static SVG cannot stay true
as the ledger changes.

---

## What the mark is allowed to say

| Say | Do not say |
| --- | --- |
| Measured by Periscan | Secure / security guaranteed |
| Not measured by Periscan | Certified / DORA / NIS2 / PCI / SOC 2 certified |
| Authorized Community run produced evidence | Pentested / automated pentest / full BAS |
| Fixed only after a verification event (docs, not this plate) | Passing / all-green / false-positive-free / `Fixed` as a green badge |

Visible labels on the plates are **MEASURED** / **NOT MEASURED** and
**by Periscan**. Titles and descriptions restated in the SVG are denials
(what the mark is not), not claims.

Contract: `CLAIM_LANGUAGE_CATALOG` in
`packages/shared/src/claim-deny-list.ts`. Copy rules:
[`DESIGN_PARTNER/PRODUCT_COPY_RULES.md`](DESIGN_PARTNER/PRODUCT_COPY_RULES.md).

---

## Never Fixed-green without a verification event

Product mint `#2fe0b0` is the **validated / Fixed** token. These plates
do not use it.

- **Measured** ≠ remediations are Fixed. Measured means the Community run
  produced evidence on authorized scope.
- **Fixed** requires a verification event (measured re-validation). Ticket
  close, PR merge, or owner assertion is `ClosedWithoutEvidence`.
- Do not recolor either SVG to mint, shields `success` green, or any
  “passing” palette to imply Fixed.
- Do not add a third asset named `badge-fixed.svg` unless it is driven by
  a real verification event. This slice has no such file.

Ontology L3: [`ONTOLOGY_LAWS.md`](ONTOLOGY_LAWS.md). Writer gate:
`packages/shared/src/fix-verification.ts`.

---

## There is no live badge API

This slice is two SVGs and this page. There is **no**

- `GET /api/v1/public/badges/:token.svg`
- shields.io endpoint, gist, or `img.shields.io` color=success stand-in
- minted share token that flips measured automatically
- GitHub Action that paints green because `pnpm verify` passed

A future tokenized SVG could exist. Until it ships in OpenAPI with tests,
do not document or link one. Do not point a README at a URL that 404s or
at shields.io labeled “measured” with a fake count.

`pnpm verify` / GitHub Actions billing is not a Community measurement.
A CI badge is a different object and must not reuse this copy.

---

## How to embed (when README is allowed to take the link)

From repo root (README, later):

```markdown
[![Not measured by Periscan](docs/images/badge-not-measured.svg)](docs/BADGES.md)
```

After a real Community run on **this** repo’s authorized scope produces
evidence, swap the file — not the alt text:

```markdown
[![Measured by Periscan](docs/images/badge-measured.svg)](docs/BADGES.md)
```

From this directory:

```markdown
[![Not measured by Periscan](images/badge-not-measured.svg)](BADGES.md)
```

Alt text stays “Measured by Periscan” / “Not measured by Periscan”. Do not
write “secure”, “certified”, or “pentested” into alt, title, or surrounding
copy.

HTML `img` is fine. Do not wrap the mark in a shields-style two-tone pill
or recolor it in CSS.

---

## Design (so the next edit does not become shields.io)

- **Plate, not pill.** 6px radius (`--radius-card`), not 999px.
- **Radar, not a check.** Concentric open rings and pupil from the
  Periscan mark. Measured = azure rings, filled pupil, inner sweep.
  Not-measured = dim idle rings, hollow pupil, no inner sweep. No dashed
  spinner.
- **Azure, not mint.** Brand `#3c96ff` / `#6fb2ff` on void. Status color
  is not pass/fail.
- **Type.** IBM Plex Mono for the status word (measurement), IBM Plex
  Sans for “by Periscan”. Outlined in the SVG.
- **Tokens.** Void `#05070f`, line-strong `#2b477f`, ink `#eaf0fb`,
  muted `#c0d0e8`, inconclusive `#6b82ab` / `#9fb2d6`. Canonical kit:
  `apps/web/app/tailwind.css`.

---

## Related

- Offering: [`COMMUNITY.md`](../COMMUNITY.md)
- Claim deny-list: [`competitive/CLAIM_DENY_LIST.md`](competitive/CLAIM_DENY_LIST.md)
- Positioning: [`competitive/POSITIONING.md`](competitive/POSITIONING.md)
- Safety floor: [`SECURITY_BOUNDARIES.md`](SECURITY_BOUNDARIES.md)
