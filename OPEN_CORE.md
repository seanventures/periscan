# Periscan open-core model

Root [`LICENSE`](./LICENSE) is **Apache-2.0** (founder decision 2026-08-30).
Community edition is the open-core **validation slice**. Hosted SaaS / MSSP /
marketplace stay commercial product. This is not full BAS or live offensive.

Settled axiom: [`docs/SETTLED.md`](./docs/SETTLED.md). Plan (not a flip):
[`docs/OPEN_SOURCE_PROJECT_PLAN.md`](./docs/OPEN_SOURCE_PROJECT_PLAN.md).
Package tags (scaffold): [`docs/OPEN_SOURCE_LICENSE_MATRIX.md`](./docs/OPEN_SOURCE_LICENSE_MATRIX.md).
Offering: [`COMMUNITY.md`](./COMMUNITY.md). Contribution law: [`GOVERNANCE.md`](./GOVERNANCE.md).

---

## Option A — Apache-2.0 core + commercial edge (in effect)

| Layer | License | Status |
| --- | --- | --- |
| Core control plane (API, policy, evidence graph, runner protocol, Community web) | **Apache-2.0** | Root `LICENSE` + `NOTICE` |
| Lab, safe/passive modules, connector *interfaces* | Apache-2.0 | Engines keep **upstream SPDX** |
| Hosted multi-tenant SaaS, SSO/SCIM as a managed product, MSSP portfolio, premium catalogs, support SLAs | Commercial | Product, not a second LICENSE file here |
| Live Atomic / Caldera / SharpHound / sqlmap / Metasploit | **Never default** | Catalog theater; not installable as validation |

---

## What Community edition is TODAY

A **product contract**, encoded in `packages/shared/src/community-edition.ts`:

- Verified customer-authorized scope
- Policy decision on every start (denied work never queues)
- Default engine pack: **permissive SPDX only** (MIT / Apache-2.0 / BSD-3-Clause /
  NPSL) plus first-party checks
- Evidence ledger; findings for a mission are evidence-intersected, not theater
- Remediations from that mission; **Fixed** only after a verification event

That is the open-core *validation* offering. Third-party engines keep their own
SPDX. Node dependencies are inventoried in
[`licenses/THIRD_PARTY_NOTICES.md`](./licenses/THIRD_PARTY_NOTICES.md).

It is **not**:

- Full multi-vector BAS, automated pentest, or a CNAPP/RBVM replacement
- GPL / LGPL / AGPL in the default Validate start (Engine Lab + license accept)
- Live Atomic, Caldera, SharpHound, sqlmap, or Metasploit

---

## What is commercial

Stay commercial (hosted product, not this LICENSE file):

| Surface | Why it is not Community core |
| --- | --- |
| Hosted multi-tenant SaaS operations | Cloud ops, tenancy at scale, support SLAs |
| Enterprise identity polish (SSO/SCIM as a managed product) | Funded edge, not the validation loop |
| MSSP portfolio / multi-client operations | Commercial services |
| Premium / complete compliance catalogs as a product | Evidence support is core; certification theater is refused |
| Payments, AWS Marketplace, Production connector certification | Partner keys and counsel; out of Community GA |
| Design-partner onboarding and support SLAs | Services |

The monorepo still contains commercial-adjacent routes (MSSP, billing meters).
Presence in the tree does **not** make those Apache-licensed or Community-supported.

---

## Explicit grant

| Do | Do not |
| --- | --- |
| Keep root [`LICENSE`](./LICENSE) Apache-2.0 | Re-proprietary the public snapshot without counsel |
| Call this Community / open-core **validation** | Claim full BAS, automated pentest, or CNAPP replacement |
| Attribute upstream engines by name + SPDX | Present Trivy/Nuclei/Gitleaks as Periscan-authored |
| Fail CI on `pnpm licenses:check` | Launder AGPL / SSPL / BSL / Commons Clause / PolyForm into the default image |
| Keep `seanheiney/periscan` **private** | Publish goldeneye compose, HANDOFF, or Plane ops |
| Point strangers at [`COMMUNITY.md`](./COMMUNITY.md) | Equate Engine Lab catalog size with Community start |

When founder + counsel flip the product license, this file and the matrix get a
dated amendment. Until then, every PR that changes `LICENSE` is a **STOP**.
