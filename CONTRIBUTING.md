# Contributing to Periscan

Public clone, issues, and PRs:
**https://github.com/seanventures/periscan**

Apache-2.0. Community edition is the **validation slice** (authorized scope,
policy, safe OSS engines, evidence). It is not full BAS, automated pentest,
or a CNAPP replacement. See [`COMMUNITY.md`](./COMMUNITY.md),
[`OPEN_CORE.md`](./OPEN_CORE.md), [`GOVERNANCE.md`](./GOVERNANCE.md).

## What to file (20 seconds)

| I have | Open |
| --- | --- |
| Something broke on **authorized** scope | [Bug](https://github.com/seanventures/periscan/issues/new?template=bug.yml) |
| A product idea that respects SETTLED | [Feature](https://github.com/seanventures/periscan/issues/new?template=feature.yml) |
| An OSS tool to wrap as a module | [Engine adapter](https://github.com/seanventures/periscan/issues/new?template=engine-adapter.yml) — **first useful PR** |
| A vulnerability in Periscan | [`SECURITY.md`](./SECURITY.md) — title-only `[SECURITY]` issue, **no PoCs** |

Do not file requests to enable live Atomic / Caldera / SharpHound / sqlmap /
Metasploit. Those issues and PRs are closed.

## Clone

```bash
git clone https://github.com/seanventures/periscan.git
cd periscan
pnpm install
```

First-hour run is in the README. Only test systems you own or are contracted
to test.

## First useful PR: adapter + fixture

Walkthrough: [`docs/ADAPTER_FIRST_PR.md`](./docs/ADAPTER_FIRST_PR.md).
Spec: [`docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`](./docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md) §7.

Safe first engines (catalog holes, permissive SPDX): **cfn-lint**, **tflint**,
**parliament**.

First-time scope: `PassiveReadOnly`, MIT / Apache-2.0 / BSD,
`fixtureSupported: true`. Do not put GPL/LGPL/AGPL on Community start.

GitHub PRs add **in-tree ValidationModules**. Engine Lab intake and the
extension runbook are operator/tenant paths, not clone-and-PR.

Prefer wrapping a catalog hole (`moduleIds: []` in
`packages/modules/src/security-catalog-expansion.ts`). **Do not copy Gitleaks
into `packages/modules/src/index.ts`**. Gitleaks is the *behavior* reference
(fixture + redaction + `tool_unavailable`). Copy a `PopularOssSpec` (Bandit /
Checkov).

1. If the tool id is new, add it to `OpenSourceToolIdSchema` in
   `packages/shared/src/open-source.ts` **first**.
2. Add or extend:
   - `packages/modules/src/community-popular-oss-catalog.ts` (or fill
     `moduleIds` on the expansion row)
   - one `PopularOssSpec` in `packages/modules/src/community-popular-oss.ts`
   - fixture under `packages/modules/fixtures/<tool>/`
3. Wire allowlists only as needed (`COMMUNITY_VALIDATION_SUITE`,
   `RUNNER_OSS_ENGINE_MODULE_IDS`, pack list, `listModuleManifests()` snapshot).
4. Tests: fixture execute; no raw secrets in evidence; `tool_unavailable` when
   runtime is missing. **Do not** emit `validationState: "Fixed"` from empty
   `fixtureMode`.
5. `pnpm licenses:write` then `pnpm modules:certify` and commit notices +
   certification report.
6. Local slice (merge still runs `pnpm verify`):
   - `pnpm --filter @periscan/shared test`
   - `pnpm --filter @periscan/modules test`
   - `pnpm licenses:check`
   - `pnpm modules:certify:check`
   - `pnpm test:modules`

Every commit: `Signed-off-by: Name <email>` (DCO-1.1, [`GOVERNANCE.md`](./GOVERNANCE.md)).

### Not a GitHub adapter PR

- Intake: `POST /api/v1/third-party-tools/intake/validate` (authenticated
  product; work-order is preview text, not a repo scaffold).
- Extensions: [`docs/EXTENSION_DEVELOPER_RUNBOOK.md`](./docs/EXTENSION_DEVELOPER_RUNBOOK.md)
  (signed OCI, `executionAuthorized: false`).

## License and provenance

1. Product code is Apache-2.0 ([`LICENSE`](./LICENSE)) unless a package says
   otherwise. Hosted SaaS / MSSP / marketplace stay commercial product.
2. Third-party engines keep upstream SPDX. Never invent `Proprietary` for a
   module that wraps a third-party tool.
3. Module `license` **must equal** the primary tool SPDX (Gitleaks → `MIT`,
   Trivy → `Apache-2.0`, nmap → `NPSL`, sqlmap → `GPL-2.0`).
4. `licenseRisk` is derived — do not hardcode `Allowed` to launder GPL/LGPL.
5. After tool/module/dep changes: `pnpm licenses:write` then `pnpm licenses:check`.
6. Attribute engine name + SPDX in UX. No raw tool JSON as primary UX.

GPL/LGPL engines are Engine Lab + license accept, not Community start.
AGPL / SSPL / BSL / Commons Clause / PolyForm are blocked.

## Pull requests

- Add tests for schemas, services, routes, modules, policy, and evidence you
  touch.
- **Fixed** still requires a verification event. Denied tasks still never queue.
- Do not enable live Atomic / Caldera / SharpHound / sqlmap / Metasploit.
- Do not rewrite Prisma schema/migrations wholesale or change runner transport
  away from outbound HTTPS signed-task polling.
- Do not rewrite root `LICENSE`.
- Keep product-visible data real or honest-empty. Fixtures only in tests or
  clearly labeled sample/demo.
- Safety floor: [`SECURITY_BOUNDARIES.md`](./SECURITY_BOUNDARIES.md).
  Settled axioms: [`docs/SETTLED.md`](./docs/SETTLED.md).

## Domain enum accretion

`packages/shared/src/domain.ts` holds a closed set of product enums.
**New status / lifecycle enums must not accrete silently.**

Before adding a `z.enum` that represents status or lifecycle:

1. Declare its **partition**: `risk` | `execution` | `platform` | `billing` |
   `identity` | `integrations` | `ai_model` | `threat` | `evidence`
   (`packages/shared/src/domain-partitions.ts`).
2. Declare which **Ontology Law** it serves (`authorization` | `grounding` |
   `weakest_link` | `closure` | `language`), or `law: null` for plumbing.
3. List which existing enums it does **not** duplicate — especially `Fixed`,
   `Validated`, and `Open` ([`docs/ONTOLOGY_LAWS.md`](./docs/ONTOLOGY_LAWS.md)).
4. Prefer `DOMAIN_PARTITION_MODULES`; do not invent a parallel ValidationState.
5. Graph coordinates use **RiskRelatedEntityType** only. Platform entities stay
   off `GraphNode.relatedEntityType`.

Register high-risk status enums in `DOMAIN_STATUS_ENUM_REGISTRY` and keep
`ENUM_ACCRETION_PR_CHECKLIST` green in schema PRs.
