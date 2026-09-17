# Periscan Open-Source Project Plan

**Date:** 2026-08-03  
**Status:** plan (not a license change)  
**Audience:** founders / maintainers deciding *how* to open Periscan without eroding safety or product honesty  
**Related today:** root [`LICENSE`](../LICENSE) (proprietary product), [`OPEN_SOURCE_POLICY.md`](../OPEN_SOURCE_POLICY.md) (engines-as-adapters), [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`SECURITY_BOUNDARIES.md`](../SECURITY_BOUNDARIES.md)

---

## 1. Executive summary

Periscan is **not** open source today. The control plane, UI, API, worker, runner agent, and first-party modules are proprietary; open-source tools are used **as internal validation engines** behind Periscan modules, policy, evidence, and UX.

This plan describes how to **build and operate Periscan as an open-source project** over time — either fully OSS, dual-license, or a deliberate **open core** — without:

- shipping destructive or live-adversarial capabilities by default  
- laundering AGPL/SSPL/BSL into the default image  
- inventing market claims (refs, SOC2 Production, ARR) from community activity  
- collapsing the product into “yet another Nuclei wrapper”

**Decision required before any public repo flip:** choose a **release model** (Section 3). Everything else is sequencing.

---

## 2. What already exists (reuse, don’t reinvent)

| Asset | Role in an OSS project |
|-------|------------------------|
| Monorepo (pnpm, Fastify API, Next.js web, Prisma, runner) | Publish as the primary tree *or* split later |
| `packages/modules` + Tool Adapter Framework | Community contribution surface #1 |
| `OPEN_SOURCE_POLICY` + license inventory + `pnpm licenses:*` | Legal CI gates stay |
| `SECURITY_BOUNDARIES` + policy engine + audit events | Non-negotiable product law |
| Lab (`infra/lab`, demo-up, golden path, hybrid plant) | Contributor repro + dogfood |
| Acceptance / Playwright / module certification | PR CI |
| Engine Lab + third-party intake APIs | Governed “bring your own tool” without arbitrary shell |
| Design-partner / claim-deny docs | Keep marketing honest even with community hype |

Today’s mental model:

```text
  Customer / operator UX  ──►  Periscan control plane (policy, evidence, risk, reports)
                                      │
                                      ▼
                              Module manifests + parsers
                                      │
                                      ▼
                         OSS engines (Nuclei, Trivy, …)  [SPDX their own]
```

An open-source project keeps that **control plane identity**. Opening source is not the same as “make raw scanner JSON the product.”

---

## 3. Release models (pick one)

### Option A — Open core (recommended default)

| Layer | License | Rationale |
|-------|---------|-----------|
| Core control plane (API, policy, evidence graph, runner protocol, basic web) | Apache-2.0 or MIT | Max contributor + enterprise legal comfort |
| Lab, modules for passive/safe engines, connector *interfaces* | Same as core | Dogfood + adapters |
| Commercial: multi-tenant SaaS ops, MSSP portfolio, advanced compliance packs, hosted cloud, support SLAs | Proprietary / BUSL-with-grace **or** closed SaaS only | Fund the project without AGPL trap |
| Live offensive packs (Atomic/Caldera/SharpHound live) | **Never default**; separate legal program if ever | Safety |

**Pros:** clear community + commercial path; matches “engines inside, Periscan outside.”  
**Cons:** boundary fights (“is MSSP core?”); needs sharp LICENSE matrix per package.

### Option B — Fully open (single permissive license)

Entire monorepo under Apache-2.0/MIT; revenue from support, cloud, training only.

**Pros:** simplest story for OSS advocates.  
**Cons:** hard to fund; competitors can rebrand SaaS immediately; pressure to add unsafe features for “completeness.”

### Option C — Source-available (BSL / SSPL / proprietary + source)

Publish source with non-compete or no-SaaS clause.

**Pros:** deters hyperscaler free-riding.  
**Cons:** not OSI open source; many orgs cannot contribute; conflicts with “open source project” branding — call it source-available honestly.

### Option D — Dual license

Community edition Apache-2.0; commercial grant for proprietary redistribution / OEM.

**Pros:** classic (MySQL-style) path.  
**Cons:** CLA + dual license ops cost; contributor friction.

**Recommendation:** **Option A (open core)** with Apache-2.0 core, explicit commercial packages, and **safety floor immutable** in CONTRIBUTING + CI. Revisit B only after self-sustaining cloud/support revenue.

---

## 4. What to open first (workstreams)

### WS0 — Preflight (2–4 weeks, private)

1. **License matrix audit** — every package under `apps/` / `packages/` tagged: `core-oss` | `commercial` | `docs` | `lab`.  
2. **Secret / customer scrub** — no `.lab-demo.env`, tokens, partner names, staging URLs in history; use `git filter-repo` if needed before first public push.  
3. **Trademark / name** — confirm “Periscan” mark + GH org ownership.  
4. **CLA or DCO** — Developer Certificate of Origin (lighter) vs CLA (heavier dual-license). Prefer **DCO** for Apache-2.0 core.  
5. **Security contact** — `SECURITY.md` with private disclosure; no public exploit PoCs against third parties.  
6. **Export / authorized-use** — keep [`EXPORT_CONTROL_AND_AUTHORIZED_USE.md`](./EXPORT_CONTROL_AND_AUTHORIZED_USE.md) and scope verification as hard product rules.  
7. **SBOM + notices** — `pnpm licenses:write` in CI; fail on Blocked SPDX.

### WS1 — Public core repo (MVP OSS product)

Publish a **runnable** open core that a contributor can:

```bash
pnpm install
docker compose -f infra/docker-compose/docker-compose.yml up -d
pnpm --filter @periscan/db db:migrate
pnpm lab:up && pnpm lab:dev   # or pnpm dev
pnpm verify   # subset if full suite too heavy for free CI
```

**Include:** API, worker, web (core routes), shared, db schema, policy, evidence, modules (safe set), runner agent, lab, docs (PRD summary, architecture, security boundaries, adapter spec).

**Exclude from first tag (or keep private):** anything that hard-depends on commercial secrets; unfinished marketplace billing if it confuses evaluators; internal scorecard / wartime sales docs (optional public later as “honesty docs”).

**Ship artifacts:**

- Public `README.md` rewritten for OSS onboarding (keep positioning honest — not full BAS).  
- `CODE_OF_CONDUCT.md`, `SECURITY.md`, `GOVERNANCE.md`, issue/PR templates.  
- GitHub Actions: lint, typecheck, unit/module tests, license check; lab-golden on Linux `workflow_dispatch`.  
- Container images for runner + optional scan-executor `runtime` (not `runtime-legal-review` by default).

### WS2 — Community contribution surface

Primary happy path for external PRs:

1. **New module / engine adapter** per [`OPEN_SOURCE_TOOL_ADAPTER_SPEC.md`](./OPEN_SOURCE_TOOL_ADAPTER_SPEC.md)  
2. **Parser + fixtures + redaction**  
3. **License disposition** (Allowed / RequiresLegalReview / Blocked)  
4. **No raw tool UX** as primary  
5. **Safety level ≤ PassiveReadOnly** for first-time contributors without maintainer override  

Secondary:

- Docs, lab scripts, a11y, connector *stubs* with NotConfigured honesty  
- Translations only after string freeze  

Reject by default:

- Live Atomic/Caldera/SharpHound/ransomware  
- SSRF-friendly arbitrary URL fetchers  
- Silent AGPL intake  
- “Make Fixed without verify” shortcuts  

### WS3 — Governance & release engineering

| Role | Responsibility |
|------|----------------|
| Maintainers (2+) | Merge rights, release tags, security triage |
| Committers | Module/area review |
| Community | Issues, discussions, adapters |

Process:

- Semantic versioning on published packages (`@periscan/*` if npm later; initially git tags).  
- Release notes: security / safety changes called out first.  
- Quarterly dependency + license audit.  
- Dogfood weekly ([`DESIGN_PARTNER/LAB_DOGFOOD.md`](./DESIGN_PARTNER/LAB_DOGFOOD.md)) remains **internal quality**, not a substitute for public CI.

### WS4 — Commercial edge (if open core)

Keep **clear package boundaries** so community never wonders what’s free:

| Package / product | License |
|-------------------|---------|
| `@periscan/core` (api+policy+evidence+runner protocol) | Apache-2.0 |
| `@periscan/web-community` | Apache-2.0 |
| `@periscan/modules-safe` | Apache-2.0 |
| Hosted multi-tenant SaaS, SSO/SCIM enterprise polish, MSSP portfolio, premium compliance catalogs | Commercial |
| Support, SLAs, design-partner onboarding | Commercial services |

Document this in `OPEN_CORE.md` at root when the split lands.

### WS5 — Ecosystem (months 6–18)

- **Registry / Engine Lab** public docs for intake  
- Example connectors (Webhook, mock SIEM) as reference implementations  
- “Periscan Compatible Module” badge for certified adapters  
- Optional foundation or CNCF-adjacent conversation **only after** safety + sustainability proven — do not rush

---

## 5. Phased timeline (indicative)

| Phase | Window | Exit criteria |
|-------|--------|---------------|
| **P0** Decision + scrub | Weeks 0–2 | Model A/B/C/D chosen; secret scrub plan; SECURITY.md |
| **P1** Private “oss-main” branch | Weeks 2–6 | CI green; license headers; no customer data; lab smoke documented |
| **P2** Public beta repo | Weeks 6–10 | First external clone → lab:up works; 3 sample adapter PRs (can be internal acting as external) |
| **P3** v0.1 OSS tag | Weeks 10–14 | Tagged release; container images; CONTRIBUTING proven by a non-author PR |
| **P4** Open core split (if A) | Months 4–6 | Commercial packages clearly separated; dual CI |
| **P5** Ecosystem | Months 6–18 | External adapters in catalog; dogfood + security process boringly reliable |

Do **not** couple public launch to analyst index 95 / MQ / first public ref. Those are orthogonal and claim-gated.

---

## 6. Safety & legal non-negotiables (carry into OSS)

Copied from product law — public community **does not** relax these:

1. Verified customer-authorized scope only.  
2. No destructive actions; no real data exfiltration; no credential theft; no persistence.  
3. Denied tasks never queue.  
4. **Fixed requires verification event.**  
5. Live Atomic / Caldera / SharpHound / ransomware / uncontrolled exploit chaining stay off without separate legal program.  
6. AGPL/SSPL/BSL/Commons Clause/PolyForm **Blocked** in default runtime.  
7. Runner transport remains **outbound HTTPS signed-task polling** (no inbound management plane as default).  
8. Real-first: fixtures only in tests; sample reports labeled; no fake Production connector certs.

Encode as:

- `SECURITY_BOUNDARIES.md` (public)  
- Policy unit tests that fail CI if gates are removed  
- CODEOWNERS on `packages/policy`, runner task signing, Fixed verification paths  

---

## 7. Repository layout options

### 7.1 Single monorepo (start here)

Keep current layout; use package-level LICENSE files:

```text
LICENSE                    # Apache-2.0 for core (after flip)
licenses/COMMERCIAL.md     # what remains paid (open core)
packages/modules/LICENSE
apps/api/LICENSE
...
```

### 7.2 Later split (only if needed)

- `periscan/periscan` — open core  
- `periscan/periscan-enterprise` — private  

Avoid premature split; monorepo velocity matters more than optics in P1–P3.

---

## 8. Community ops checklist

- [ ] Public roadmap (GitHub Projects) mapped to real PRD slices — no fake “done”  
- [ ] Discussion categories: adapters, lab, security, product philosophy  
- [ ] Response SLA for security reports (e.g. 72h ack)  
- [ ] Moderation: reject weaponization requests; point to authorized-use policy  
- [ ] Good first issues: fixture coverage, docs, passive modules only  
- [ ] No bounty for third-party customer scanning  

---

## 9. Messaging (public README outline)

1. What Periscan is: AEV/CTEM **proof layer** — validate exposure, prove fixes.  
2. What it is not: full multi-vector BAS, automated pentest, CNAPP replacement.  
3. Architecture diagram: control plane + modules + engines.  
4. Quickstart: compose + lab.  
5. Safety boundaries (link).  
6. License (core vs commercial if open core).  
7. Contributing adapters.  

Avoid: “better than [BAS vendor] kill chain,” fabricated scores, customer logos without rights.

---

## 10. Success metrics (project health, not MQ)

| Metric | Healthy signal |
|--------|----------------|
| Time-to-lab-green for a new contributor | &lt; 60 minutes on Linux |
| Adapter PRs merged / quarter | Growing, with license CI clean |
| Security issues opened vs silent | Prefer reported |
| Dogfood weekly pass rate | ≥ 3/4 weeks soft-pass+ |
| Safety regression escapes | Zero Fixed-without-verify or live-offensive enablement |
| Commercial sustainability (if A) | Support/cloud covers maintainer time |

**Not success metrics:** GitHub star count alone, invented ARR, analyst MQ, “95 score.”

---

## 11. Immediate next actions (this codebase, pre-decision)

These advance the plan **without** flipping LICENSE yet:

1. Keep lab golden path + hybrid plant reproducible (`docs/DEMO_LAB_SITE.md`, hybrid Partial memo).  
2. Run dogfood weekly (`docs/DESIGN_PARTNER/LAB_DOGFOOD.md`).  
3. Phase 3 cloud scaffold only when modules need it (`infra/lab/PHASE3_CLOUD.md`).  
4. Maintain license inventory CI; expand module adapter docs for external readers.  
5. ~~Draft `SECURITY.md`~~ + ~~`CODE_OF_CONDUCT.md`~~ (landed; publish security contact before public launch).  
6. ~~Package-level LICENSE matrix scaffold~~ → `docs/OPEN_SOURCE_LICENSE_MATRIX.md`.  
7. Founder decision meeting: **Option A vs B vs C** with counsel (blocks LICENSE flip).

---

## 12. Explicit non-goals for the open-source project

- Matching every BAS marketing claim  
- Enabling offensive live packs to attract contributors  
- Public scoreboards that invent 5.0/95  
- Replacing customer authorization with “it’s open source so scan anything”  
- Shipping RequiresLegalReview tools in default images  

---

## 13. Document control

| Version | Date | Note |
|---------|------|------|
| 0.1 | 2026-08-03 | Initial plan; product remains proprietary until explicit license flip |

When LICENSE flips, update this plan’s status to **active**, root README license section, and `CONTRIBUTING.md` in the same PR.
