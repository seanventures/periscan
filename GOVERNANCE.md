# Periscan governance

This repository is **Apache-2.0** with an **open-source engine adapter**
surface. Community edition is the validation slice
([`COMMUNITY.md`](./COMMUNITY.md), [`OPEN_CORE.md`](./OPEN_CORE.md)).

Conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
How to contribute: [`CONTRIBUTING.md`](./CONTRIBUTING.md).
Safety: [`SECURITY_BOUNDARIES.md`](./SECURITY_BOUNDARIES.md), [`SECURITY.md`](./SECURITY.md).
Settled axioms: [`docs/SETTLED.md`](./docs/SETTLED.md).

---

## Maintainers

| Role | Who | Powers |
| --- | --- | --- |
| Maintainers | Founder + designated committers with merge rights | Merge, tags, security triage, SETTLED exceptions (almost never) |
| Committers | Area reviewers (modules, policy, runner, web) | Review adapters and product PRs in their area |
| Community | Issues, discussions, adapter PRs | Propose; do not merge; do not waive safety |

Required review for policy, Fixed-verification, claim deny-list, security
boundaries, `LICENSE`, runner, and Prisma schema:
[`.github/CODEOWNERS`](./.github/CODEOWNERS) (`@seanheiney`). Public-tree
exclude list: [`docs/PUBLIC_TREE.md`](./docs/PUBLIC_TREE.md). Neither is a
LICENSE rewrite.

Do not file security or Code of Conduct reports as public issues. Process:
[`SECURITY.md`](./SECURITY.md). No `security@` domain is published.

---

## DCO preference (not a CLA today)

Periscan uses the [Developer Certificate of Origin](https://developercertificate.org/)
(DCO-1.1): every commit `Signed-off-by: Name <email>`.

External patches, if accepted, are contributed under root [`LICENSE`](./LICENSE)
(**Apache-2.0**) unless a separate written agreement says otherwise.

Hosted SaaS / MSSP / marketplace remain commercial product, not a second
LICENSE file in this repository.

Do not add a fake CLA bot or a contributor license that contradicts `LICENSE`.

---

## How adapters get in

Primary contribution surface: a Periscan **Validation Module** wrapping one
capability of one or more upstream tools. Spec:
[`docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`](./docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md)
§7. Runtime:
[`docs/TOOL_RUNTIME_SECURITY.md`](./docs/TOOL_RUNTIME_SECURITY.md).

Minimum path:

1. Add or update `OpenSourceToolDefinition` in `packages/modules/src/toolchain.ts`
   (upstream SPDX, runtimes, pin, `policyStatus`, docs URL).
2. Implement a conformant module in `packages/modules` (manifest, parser,
   redaction, fixtures). `manifest.license` **must equal** the primary tool SPDX.
   Do not invent `Proprietary` for a third-party-backed module. Do not hardcode
   `licenseRisk: Allowed` to launder GPL/LGPL.
3. Fixture-first certification. Live execution only when policy allows.
4. Run:
   - `pnpm --filter @periscan/modules test`
   - `pnpm licenses:write` then `pnpm licenses:check`
   - `pnpm modules:certify` (or `modules:certify:check` in CI)
   - `pnpm test:modules` as needed
5. Prefer intake APIs for design-partner proposals:
   - `POST /api/v1/third-party-tools/intake/validate`
   - Candidate backlog under Registry / Engine Lab — do not ship unreviewed
     binaries in the default scan-executor `runtime` stage.
6. Attribute engine name + SPDX in module detail, methodology, and Engine Lab.
   “No raw tool JSON as primary UX” is not permission to erase upstream branding.

**License disposition**

| SPDX / family | Path |
| --- | --- |
| MIT / Apache-2.0 / BSD-3-Clause / NPSL (NPSL with notices) | Eligible for Community start after certification |
| GPL / LGPL | Engine Lab + license accept. Not default Community start. |
| AGPL / SSPL / BSL / Commons Clause / PolyForm | **Blocked.** No install path. |

Community start membership is `COMMUNITY_VALIDATION_SUITE` in
`packages/shared/src/community-edition.ts`, not “it compiled.”

---

## What is rejected (by default)

PRs and issues that do any of the following are closed without merging:

| Reject | Why |
| --- | --- |
| Enable live Atomic / Caldera / SharpHound / sqlmap / Metasploit / ffuf as Community validation | Safety floor; catalog theater only |
| Silent AGPL / SSPL / BSL / Commons Clause / PolyForm intake | License policy; fail closed |
| Mark **Fixed** without a verification event | Ontology: closure law |
| Rewrite root `LICENSE` or claim “we are open source now” | Not a LICENSE flip |
| Queue work after a policy deny | Denied tasks never queue |
| Raw scanner JSON as primary UX or customer report | Product is proof, not a dump |
| `ReadyForCredentials` on StandardizedCatalog stubs | Planned / NotConnectable until live |
| Inbound runner management plane / reverse SSH as default | Outbound HTTPS signed-task polling |
| Fixture theater as product-visible data | Real-first rule |
| Live ransomware, credential theft, persistence, uncontrolled exploit chaining | `SECURITY_BOUNDARIES.md` |
| Invented customer refs, ARR, or Production connector certification | Zero public refs |

Safety-sensitive capabilities require a separate legal SOW and dual runtime
gates — not a drive-by PR. See [`docs/SETTLED.md`](./docs/SETTLED.md) TELLs.

---

## Releases

- Git tags on the product; `@periscan/*` npm publish is not assumed.
- Release notes call out **security and safety** changes first.
- `pnpm licenses:check` stays CI-mandatory regardless of product LICENSE.
- Quarterly license + dependency audit is maintainer work, not a community veto.

---

## Decisions that are already settled

Do not re-derive Five Laws, claim deny-list, Community pack SPDX, or Fixed-only-
via-verify in a governance thread. Read [`docs/SETTLED.md`](./docs/SETTLED.md)
and stop. New status enums belong in `packages/shared` with a partition and an
ontology law — see `CONTRIBUTING.md` (domain enum accretion).
