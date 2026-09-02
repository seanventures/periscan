# Contributing to Periscan

This repository is **Apache-2.0** with an **open-source engine adapter**
surface. Read this before proposing modules, tools, or UI that touch validation
engines.

## License and provenance rules

1. **Product code** is under root [`LICENSE`](./LICENSE) (**Apache-2.0**) unless a
   package states otherwise.
2. **Third-party engines** keep their upstream SPDX. Never invent `Proprietary`
   for a module that wraps a third-party tool (`toolIds` non-empty).
3. Module `license` **must equal** the primary tool catalog SPDX (examples:
   Gitleaks → `MIT`, Trivy → `Apache-2.0`, nmap → `NPSL`, sqlmap → `GPL-2.0`).
4. `licenseRisk` is **derived** from tool SPDX + `policyStatus` — do not hardcode
   `Allowed` to launder GPL/LGPL/NPSL review-gated engines.
5. Regenerate notices after tool/module/dependency changes:
   `pnpm licenses:write` then `pnpm licenses:check`.
6. Always **attribute** engine name + SPDX in module detail, methodology, and
   Engine Lab — “no raw tool JSON as primary UX” ≠ erase upstream branding.
   See [`docs/OPEN_SOURCE_VALIDATION_ENGINES.md`](./docs/OPEN_SOURCE_VALIDATION_ENGINES.md).

## Adding or changing a validation engine

The product is **Apache-2.0** ([`LICENSE`](./LICENSE)). External PRs are by
invitation unless a contribution grant exists. GitHub PRs add **in-tree ValidationModules**. Engine Lab intake APIs
and the extension runbook are **operator/tenant** paths, not clone-and-PR.

First-time scope: `PassiveReadOnly`, permissive SPDX (MIT / Apache-2.0 / BSD),
`fixtureSupported: true`. Do not enable live Atomic / Caldera / SharpHound /
sqlmap / Metasploit. Do not put GPL/LGPL/AGPL on Community start.

Walkthrough: [`docs/ADAPTER_FIRST_PR.md`](./docs/ADAPTER_FIRST_PR.md). Spec:
[`docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`](./docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md)
§7. Runtime: [`docs/TOOL_RUNTIME_SECURITY.md`](./docs/TOOL_RUNTIME_SECURITY.md).
Issue form: `.github/ISSUE_TEMPLATE/engine-adapter.yml`.

### In-tree path (GitHub PR)

Prefer wrapping a catalog hole (`moduleIds: []` in
`packages/modules/src/security-catalog-expansion.ts`) over inventing a new
engine. **Do not copy Gitleaks into `packages/modules/src/index.ts`** (13k-line
god file; `createModule` is not exported). Gitleaks is the *behavior* reference
(fixture + redaction + `tool_unavailable`). The *file* to copy is a
`PopularOssSpec` (Bandit / Checkov).

1. If the tool id is new, add it to `OpenSourceToolIdSchema` in
   `packages/shared/src/open-source.ts` **first**.
2. Add or extend:
   - `packages/modules/src/community-popular-oss-catalog.ts` (or fill
     `moduleIds` on the expansion row)
   - one `PopularOssSpec` in `packages/modules/src/community-popular-oss.ts`
   - fixture under `packages/modules/fixtures/<tool>/`
3. Wire allowlists only as needed:
   - `COMMUNITY_VALIDATION_SUITE` if it should start from Validate
   - `RUNNER_OSS_ENGINE_MODULE_IDS` only if InternalRunner
   - pack list in `packages/shared/src/security-tool-packs.ts`
   - append the module id to the `listModuleManifests()` snapshot in
     `packages/modules/src/index.test.ts`
4. Tests: fixture execute; no raw secrets in evidence; `tool_unavailable` when
   runtime is missing. **Do not** emit `validationState: "Fixed"` from empty
   `fixtureMode` — that is a measurement-check token, not a reason to skip
   fixtures. Prefer Gitleaks-style fixture findings / Inconclusive over
   popular-OSS `measured()` Fixed-on-zero.
5. `pnpm licenses:write` then `pnpm modules:certify` and commit notices +
   certification report.
6. Local slice (CI still runs full `pnpm verify`):
   - `pnpm --filter @periscan/shared test`
   - `pnpm --filter @periscan/modules test`
   - `pnpm licenses:check`
   - `pnpm modules:certify:check`
   - `pnpm test:modules`

Safe first engines (catalog holes, permissive SPDX): **cfn-lint**, **tflint**,
**parliament**.

### Not a GitHub adapter PR

- Intake: `POST /api/v1/third-party-tools/intake/validate` (authenticated
  product; work-order is preview text, not a repo scaffold).
- Extensions: [`docs/EXTENSION_DEVELOPER_RUNBOOK.md`](./docs/EXTENSION_DEVELOPER_RUNBOOK.md)
  (signed OCI, `executionAuthorized: false` — not an in-tree engine).

## Engine Lab acceptance model

Tools with `policyStatus: RequiresLegalReview` (GPL/LGPL family, etc.) are
**not** redistributed in the default image. Operators accept license text for a
pinned version before install/enable (`ToolLicenseAcceptance`). Blocked
licenses (AGPL, SSPL, BSL, …) have no install path. See
[`docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md`](./docs/TOOL_PACKAGE_MANAGER_PRODUCT_PLAN.md)
and Engine Lab UI at `/engines`.

## Extension developers

Signed extension lifecycle and developer steps:
[`docs/EXTENSION_DEVELOPER_RUNBOOK.md`](./docs/EXTENSION_DEVELOPER_RUNBOOK.md).

## Product / agent conventions

- [`AGENTS.md`](./AGENTS.md) — monorepo layout, safety rules, real-first rule.
- [`SECURITY_BOUNDARIES.md`](./SECURITY_BOUNDARIES.md) — no destructive or
  exfiltration-oriented capabilities.
- Keep product-visible data real (or honest empty/NotConfigured). Fixtures only
  in tests or clearly labeled sample/demo paths.

## Pull request expectations

- Add or update tests for schemas, services, routes, modules, policy, and
  evidence behavior you touch.
- Do not enable SharpHound/Caldera/Atomic live execution or other
  legally/safety-sensitive capabilities without explicit approval.
- Do not rewrite Prisma schema/migrations wholesale or change runner transport
  away from outbound HTTPS signed-task polling.
- Keep raw scanner output out of primary UX and reports.

## Domain enum accretion (P09-16)

`packages/shared/src/domain.ts` holds a large closed set of product enums.
**New status / lifecycle enums must not accrete silently.**

Before adding a `z.enum` that represents status or lifecycle:

1. Declare its **partition**: `risk` | `execution` | `platform` | `billing` |
   `identity` | `integrations` | `ai_model` | `threat` | `evidence`
   (see `packages/shared/src/domain-partitions.ts`).
2. Declare which **Ontology Law** it serves (`authorization` | `grounding` |
   `weakest_link` | `closure` | `language`), or explicitly `law: null` for pure
   platform/billing plumbing.
3. List which existing enums it does **not** duplicate — especially tokens like
   `Fixed`, `Validated`, and `Open` (see Five Laws in `docs/ONTOLOGY_LAWS.md`).
4. Prefer the destination module under `DOMAIN_PARTITION_MODULES` when
   extracting; do not invent a parallel ValidationState.
5. Graph coordinates use **RiskRelatedEntityType** only
   (`related-entity-partitions.ts` / ontology module). Platform entities
   (webhooks, model gateway, tool promotion) stay off `GraphNode.relatedEntityType`.

Register high-risk status enums in `DOMAIN_STATUS_ENUM_REGISTRY` and keep
`ENUM_ACCRETION_PR_CHECKLIST` green in schema PRs.
