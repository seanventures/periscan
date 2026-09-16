# Periscan Open Source Policy

Periscan uses open-source tools internally as validation engines. The customer-facing product remains Periscan's control plane, evidence model, policy system, and report experience.

## Rules

- Prefer permissive licenses.
- Track licenses for product dependencies and validation tools.
- AGPL, SSPL, BSL/BUSL, Commons Clause, and PolyForm tools are **Blocked, never installable** — replace the dependency or do not ship it. This is not a legal-review gate.
- GPL/LGPL tools may be quarantined as `RequiresLegalReview` (not enabled, not in default images) until legal approval; they are never silently Allowed.
- NPSL (e.g. nmap redistributed in runner-agent) is allowed only with explicit redistribution notice obligations in `licenses/THIRD_PARTY_NOTICES.md` and image docs — not treated as pure-permissive MIT-class.
- Every tool must be wrapped as a Periscan module.
- Every module must declare a manifest, safety level, parser, and test fixtures.
- Every module must output normalized evidence.
- Raw tool output must not become the primary user experience.
- Always attribute engine name + SPDX in module detail, Engine Lab, and notices;
  “no raw output as primary UX” does not mean erase upstream branding.

## Enforcement direction

- Maintain third-party notices.
- Keep module license metadata in module manifests.
- Track validation-engine runtime metadata in the internal OSS toolchain registry.
- Track customer-visible OSS feature interfaces in the API-facing catalog.
- Keep legal-review-blocked tools excluded from default pull/bootstrap commands.
- Do not redistribute RequiresLegalReview GPL-family binaries in the default
  scan-executor image (`runtime` stage). Lab-only stage `runtime-legal-review`
  or future Engine Lab accept→install is the opt-in path
  (`docs/DEPLOY.md`, `docs/OPEN_SOURCE_LICENSE_POLICY.md`).
- Run `pnpm licenses:check` in CI and release validation.
- Regenerate `licenses/THIRD_PARTY_NOTICES.md` with `pnpm licenses:write` when dependencies, validation tools, or module manifests change.
- Fail closed for AGPL/SSPL/BSL/Commons Clause/PolyForm (always Blocked), unknown, unlicensed, or enabled GPL-family entries that are not quarantined as `RequiresLegalReview`.
- Allow simple dual-license `OR` expressions only when Periscan can choose a compatible permissive alternative; do not simplify `AND` expressions.
