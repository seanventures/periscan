# Open Source License and Supply Chain Policy

This is the detailed policy behind the short summary in
[OPEN_SOURCE_POLICY.md](OPEN_SOURCE_POLICY.md). It is enforced in code by
`scripts/license-inventory.ts` (`evaluateLicensePolicy`) and gated in CI via
`pnpm licenses:check` and `pnpm test:license`.

## 1. Dispositions

Every Node dependency, tool, and module license resolves to one of three dispositions:

| Disposition           | Meaning                                                                                 | CI effect                                                                              |
| --------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Allowed`             | Permissive / compatible with Periscan use.                                              | Pass.                                                                                  |
| `RequiresLegalReview` | Non-permissive but quarantined behind legal review and excluded from default execution. | Pass only if the tool's `policyStatus` is `RequiresLegalReview` and it is not enabled. |
| `Blocked`             | Not usable without replacing the dependency or recording explicit legal approval.       | **CI fails.**                                                                          |

## 2. Classification rules

Implemented in `evaluateLicensePolicy`:

- **Missing / `UNKNOWN` / `UNLICENSED`** → `Blocked`. License metadata is mandatory.
- **Blocked patterns** → `Blocked` (never installable, not a legal-review path):
  AGPL, SSPL, Commons Clause, PolyForm, Business Source License (BSL/BUSL).
- **Simple SPDX `OR` expressions** → choose the most permissive selectable
  alternative if one is already `Allowed` by this policy; for example
  `(BSD-3-Clause OR GPL-2.0)` is permitted under the BSD-3-Clause option.
  Expressions containing `AND` are not simplified and remain fail-closed if any
  non-permissive obligation is present.
- **Review patterns** (GPL, LGPL):
  - If the tool's `policyStatus === "RequiresLegalReview"` and it is not enabled →
    `RequiresLegalReview`.
  - Otherwise → `Blocked`.
- **Obligation patterns** (NPSL / Nmap Public Source License):
  - Permitted for product use only with mandatory redistribution notice obligations
    (listed in `licenses/THIRD_PARTY_NOTICES.md` and runner-agent / image docs).
  - Disposition remains `Allowed` with an explicit obligation reason (not pure MIT-class).
  - Do not bake additional NPSL binaries into default scan-executor without a product decision.
- **Everything else** (MIT, Apache-2.0, BSD, ISC, etc.) → `Allowed`.

## 3. Supply-chain inventory and notices

- `pnpm licenses:write` regenerates `licenses/THIRD_PARTY_NOTICES.md` with tables for
  the validation toolchain, module license metadata, and Node dependencies.
- `pnpm licenses:check` fails CI if any entry is `Blocked` **or** if
  `THIRD_PARTY_NOTICES.md` is stale (drifted from the computed inventory).
- `.github/workflows/sbom.yml` publishes a CycloneDX JSON SBOM artifact (`sbom.json`) on `main` and `workflow_dispatch`. Product LICENSE is Apache-2.0; the SBOM is pnpm Node dependency inventory.
- `pnpm verify` also runs `pnpm audit --prod` and `pnpm audit --audit-level high` as
  fail-closed gates.

## 4. Current dispositions (representative)

| Tool                       | License    | Disposition                                             |
| -------------------------- | ---------- | ------------------------------------------------------- |
| Gitleaks                   | MIT        | Allowed                                                 |
| Trivy                      | Apache-2.0 | Allowed                                                 |
| OSV                        | Apache-2.0 | Allowed                                                 |
| Prowler                    | Apache-2.0 | Allowed                                                 |
| Nuclei (safe profiles)     | MIT        | Allowed                                                 |
| BloodHound CE (import)     | Apache-2.0 | Allowed                                                 |
| Caldera (plan import only) | Apache-2.0 | Allowed                                                 |
| SharpHound collector       | GPL family | RequiresLegalReview (legal-review blocked, not enabled) |
| nmap                       | NPSL       | Allowed with redistribution notice obligations (runner-agent) |
| MISP (if cataloged)        | AGPL       | **Blocked** (never installable) |

The authoritative, generated list is `licenses/THIRD_PARTY_NOTICES.md`.

## 5. Default image redistribution rule

Platform images must not silently convey `RequiresLegalReview` binaries:

| Image | Default stage | May ship | Must not ship by default |
|-------|---------------|----------|---------------------------|
| scan-executor | `runtime` | MIT/Apache engines (gitleaks, nuclei, trivy, osv-scanner, prowler, promptfoo, pyrit, ffuf) | testssl.sh, sqlmap, nikto, whatweb, ScoutSuite (GPL family) |
| scan-executor | `runtime-legal-review` (lab only) | Above + legal-review set | Production GHCR tags |
| runner-agent | default | nmap (NPSL — separate notice obligations), recon MIT tools | Unapproved adversarial collectors |

Opt-in for the legal-review scan-executor stage (lab / future Engine Lab):

```bash
docker build --target runtime-legal-review \
  -f infra/docker/scan-executor.Dockerfile \
  -t periscan-scan-executor:legal-review .
```

Compose profile: `legal-review-tools` on
`infra/docker-compose/docker-compose.scan-executor.yml`. Full operator steps:
`docs/DEPLOY.md` "Legal-review tools (Engine Lab opt-in)". Product direction:
customer accept → install from upstream pins → verify (Engine Lab), not bake into
SaaS `latest`.

## 6. Adding or upgrading a tool

1. Record the exact license string in the tool definition / module manifest.
2. Run `pnpm licenses:check`. If `Blocked`, replace the dependency or obtain documented
   legal approval and set the appropriate `policyStatus`.
3. Run `pnpm licenses:write` and commit the regenerated notices.
4. Pin tool image digests / versions in the catalog for reproducibility.
5. Do not add GPL/LGPL/NPSL binaries to the default scan-executor `runtime` stage
   without an explicit legal and product decision; prefer Engine Lab install.

## 7. Engine Lab integrity metadata (Phase 0)

Catalog tools may declare:

| Field | Purpose |
|-------|---------|
| `upstreamHomepage` | Project homepage (defaults to gitRepo/docsUrl) |
| `upstreamLicenseUrl` | License text URL used in accept ceremony |
| `expectedIntegrity` / `imageDigest` | `sha256:…` pin for digest-verified install |
| `releaseArtifact` | Release asset URL/path template |
| `userLicenseAcceptanceRequired` | Defaults true for `RequiresLegalReview` |

Legal-review tools that offer docker/git install are **not installable** until a catalog integrity pin is present (`integrity_pin_required`). Do not invent digests — pin only verified upstream hashes.

