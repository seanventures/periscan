# Panel P10 — Cisco CTO (enterprise network, scale, hybrid)

**Date:** 2026-07-29  
**Persona:** Enterprise network / hybrid-cloud CTO (Cisco-shaped buyer: multi-site campus + DC + OT edge, zero-trust network access, SSE/SASE, identity MFA, segmented runner fleet, air-gapped plants, procurement SKUs)  
**Repo:** `/Volumes/DataSSD1/test/periscan`  
**Contract:** `docs/qa/panel-audit-exhaustive-2026-07-29/PROMPT_CONTRACT.md`  
**Prior panel:** `docs/qa/panel-audit-exhaustive-2026-07-29/PREVIOUS_PANEL_SYNTHESIS.md` (P10 was summarized as **B− enterprise readiness — hybrid runner strong; scale unproven**)  
**Method:** Code-first adversarial read of runner dual-stack, fleet ops, mTLS gate, deploy/IaC, air-gap claims, connector catalog depth, HA/soak honesty, proxy channel, Windows packaging, billing SKUs. Docs-write only.

---

## Verdict (enterprise network / hybrid readiness)

| Dimension | Score (1–5) | Notes |
|-----------|------------:|-------|
| Hybrid execution topology (SaaS + in-network) | **4.0** | Outbound-only signed-task design is enterprise-correct; kill switch + scope re-enforcement are real |
| Fleet ops & multi-site scale | **2.5** | Control room + policy seal exist; no soak, no multi-AZ fleet proof, long-poll only |
| Transport trust (mTLS default, result signing) | **2.5** | Cert issuance is real; **enforcement is opt-in** (`PERISCAN_RUNNER_REQUIRE_MTLS`) |
| Deploy / IaC / packaging | **2.0** | Docker/systemd/K8s *examples* for Go runner; no Helm, no real TF modules, WindowsService enum-only |
| Air-gap / on-prem MCP | **1.5** | PRD language + Ansible/TF *fixture* modules — not a shippable isolated control plane |
| Integrations (Cisco + network stack) | **2.5** | Duo + Umbrella live; Secure Endpoint / Secure Firewall Planned; no ISE / SecureX / Meraki / DNA |
| Packaging SKUs for hybrid | **2.5** | Private runner capability is Enterprise-catalog only; payment processor still `NotConfigured` |
| HA / reliability qualification | **2.0** | Explicit honesty that soak/multi-node is **not** claimed; prod compose is single API replica |
| **Overall (Cisco CTO buy posture)** | **2.6 / 5.0 ≈ B−** | Design-partner hybrid pilot **yes**; platform-of-record for global hybrid fleet **no** |

**5.0 definition (this lens):**  
A global enterprise can enroll hundreds of segment-scoped runners with **mTLS mandatory**, one supported agent image per OS, Windows + Linux GA packaging, documented proxy/egress for Zscaler/Umbrella SWG, production Helm/TF modules with HA Postgres/Redis, a real air-gapped MCP path or an honest “SaaS-only” product boundary, Cisco stack control observation at least on Duo + Umbrella + Secure Endpoint + Secure Firewall (contract-tested), fleet soak numbers published, and SKUs that price hybrid runners without forcing every internal validation deal into opaque Enterprise-only.

**Buy posture:** Paid **hybrid design partner** after mTLS-default and single runner packaging story. **No** multi-year platform-of-record for a 5k-employee network/security program until scale, HA, Windows, and Cisco depth close.

**Agreement with previous panel (P10 row):** Confirmed — hybrid runner architecture is the strongest enterprise asset; scale, mTLS default, deploy/IaC, and Cisco stack depth are still the gaps. Aligns with Wave C item 18 (runner mTLS default-on) and the consensus “do not expand connector catalog without GA depth on top-N.”

---

## Findings

### FINDING | P10-1 | P0 | bug | security | mTLS enforcement is opt-in, not production-default
- **Persona:** Cisco CTO (zero-trust network agent baseline)
- **Evidence:** `apps/api/src/services/runner.ts` — `requireMtls = false` default on `authenticateRunner`; `shouldRequireRunnerMtls()` returns true only when `process.env.PERISCAN_RUNNER_REQUIRE_MTLS === "true"`. `docs/THREAT_MODEL.md` residual risk explicitly: “mTLS is opt-in.” `infra/production/docker-compose.prod.yml` and `.env.production.example` do **not** set `PERISCAN_RUNNER_REQUIRE_MTLS`. Spec only *recommends* the flag (`docs/RUNNER_SPEC.md` §Communication modes).
- **Problem:** Certs are issued and fingerprints stored, but a production API without the env flag accepts bearer-token-over-TLS alone. That is not the mTLS story sold in PRD/runbooks.
- **Impact:** Network/security architecture review fails on “agent identity = client cert” for any Fortune environment that already mandates mTLS for edge agents. Token theft becomes full runner impersonation until rotation.
- **Recommendation:** Default `PERISCAN_RUNNER_REQUIRE_MTLS=true` whenever `PERISCAN_DEPLOYMENT_ENVIRONMENT=production`; fail readiness (`GET /api/v1/system/deployment-status`) if production and flag off; put the flag in prod compose + deploy runbook as required, not optional.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-20

### FINDING | P10-2 | P0 | improvement | runners | Dual runners (Go vs TypeScript) without a single enterprise package
- **Persona:** Cisco CTO (fleet SKU / supportability)
- **Evidence:** Two first-class agents: `apps/runner` (Go — passive checks, full `deploy/` with Compose, K8s, systemd) and `apps/runner-agent` (Node — measured/discover modules, SOCKS handler, **no** `deploy/` tree). `apps/runner/README.md` documents both task families against the same control-plane API but different binaries/modules. Historical PRD even says Go runner “remains minimal or is deprecated” (`docs/PRD_SELF_CONTAINED_RUNNER.md` §6).
- **Problem:** Enterprise ops will not run two agent lineages with different languages, images, allowlists, and deploy artifacts for the same `/runners` identity model.
- **Impact:** Support matrix explodes; security review must certify two codebases; customers pick wrong image and lose measured modules or lose hardened deploy examples.
- **Recommendation:** Publish one **Supported Customer Runner** decision: either (a) collapse to runner-agent + thin native helpers, or (b) Go as production LTS with agent capabilities staged in. Ship one image tag, one deploy guide, one smoke path in `pnpm verify`. Demote the other to “labs/dev”.
- **Effort:** L
- **Zoo-related:** yes
- **Previous-panel-link:** theme hybrid runner strong / packaging

### FINDING | P10-3 | P1 | feature | runners | WindowsService is catalog fiction — no Windows packaging
- **Persona:** Cisco CTO (hybrid enterprise: AD domain join, GPO, Windows plant OT jump boxes)
- **Evidence:** `packages/shared/src/runner.ts` `RunnerDeploymentModeSchema` includes `"WindowsService"`. Demo seed sets `deploymentMode: "WindowsService"` (`scripts/seed-demo.ts`). Coverage test only asserts the enum string (`tests/modules/prd-runner-coverage.test.ts`). **Zero** MSI, WinSW, PowerShell service installer, or Windows Dockerfile. Deploy artifacts are Linux-only (`apps/runner/deploy/systemd`, K8s `runAsUser: 65532`).
- **Problem:** Enum + demo label imply a Windows channel that does not exist for procurement or field install.
- **Impact:** Large enterprises with mixed OS segments cannot place runners where many internal assets live; sales will over-promise “WindowsService mode.”
- **Recommendation:** Either ship a signed Windows service package (WinSW or native) with the same enroll/poll contract and mTLS file paths, **or** remove/relabel `WindowsService` as `Planned` in UI and stop seeding it as a live mode.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P10-4 | P1 | feature | runners | ServiceViaProxy channel is a unit-tested SEAM, not a product
- **Persona:** Cisco CTO (central tool versioning + scoped internal access without inbound ports)
- **Evidence:** `apps/runner-agent/src/proxy.ts` header comment: “SEAM: the wire multiplexing of these channels over the outbound connection needs matching control-plane support.” `docs/PRD_SELF_CONTAINED_RUNNER.md` §3: agent SOCKS5 + egress implemented; **wire multiplex + control-plane logical channel** still Phase-2 follow-up. Egress IPv4-only CIDR (`egress.ts` / `docs/THREAT_MODEL.md`).
- **Problem:** The architecture that lets SaaS run proxyable scanners into private nets without bloating the agent is unfinished. Hybrid design is half-built.
- **Impact:** Every internal check must be AgentLocal on the runner image, increasing agent size, patch surface, and air-gap binary distribution pain — or stays cloud-only and misses internal scope.
- **Recommendation:** Either fund the control-plane multiplex + lease of scoped proxy channels under signed task envelopes (with soak + kill-switch tests), or explicitly mark ServiceViaProxy **not available** in product UI and remove it from readiness claims until shipped.
- **Effort:** XL
- **Zoo-related:** no
- **Previous-panel-link:** U-20 (related residual), theme hybrid

### FINDING | P10-5 | P1 | improvement | ops | Fleet scale and HA are honesty-documented but commercially unproven
- **Persona:** Cisco CTO (global fleet of segment agents)
- **Evidence:** `docs/ASYNC_OPERATIONS_RUNBOOK.md`: “does not claim production soak, multi-node failure qualification, or 10,000 concurrent workloads”; UI shows 200 most recent jobs/tasks. Fleet health is heartbeat-derived (`apps/api/src/services/runner-fleet.ts`) with sealed policy thresholds — solid for ops UI, not for capacity. Transport is **LongPollHttps only** issued (`services/runner.ts` registration always `LongPollHttps`; WebSocket is schema `SupportedLater`, ReverseSsh `Disallowed`). `docs/PERF_BASELINE.md` is empty-tenant / single-API floor, not fleet poll load.
- **Problem:** No published concurrent-runner soak, no poll-storm characterization, no multi-region control-plane HA test, no sticky lease behavior under API replica failover.
- **Impact:** Network CTO cannot size API/Redis for N sites × M runners; long-poll fan-out may become the silent limit.
- **Recommendation:** Add a fleet soak suite: N simulated runners (100/500/2000), poll+heartbeat+lease under multi-API replicas, publish p95 lease latency and DB connection budgets; document max runners per tenant as an entitlement.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** theme scale unproven (P10 prior)

### FINDING | P10-6 | P1 | feature | ops | Production deploy/IaC is documentation + single-replica Compose, not enterprise topology
- **Persona:** Cisco CTO (platform engineering buy-in)
- **Evidence:** `infra/terraform/README.md`: “does not encode a vendor-specific production topology.” `infra/terraform/periscan-provider/README.md`: “fixture only… No credentials, no live calls.” `infra/production/docker-compose.prod.yml`: single `api` + `worker`, no web service, no replicas, no LB, no HPA. No Helm chart in repo. Runner K8s is an **example** Deployment `replicas: 1` (`apps/runner/deploy/k8s/runner-deployment.yaml`).
- **Problem:** Enterprise platform teams expect Helm/TF modules with multi-AZ Postgres/Redis, secrets manager, NetworkPolicy, and PDB patterns — not “bring your own managed services” README alone.
- **Impact:** Every design-partner deploy reinvents topology; reviews stall; “production ready” claims stay soft.
- **Recommendation:** Ship a reference Helm chart (API, worker, web) + optional TF modules for AWS/Azure networking secrets only; keep honesty that DB/Redis/S3 are external; add multi-replica readiness probes already present on API health into the chart defaults.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P10-7 | P1 | feature | ops | Air-gap / on-prem MCP is product language over fixture modules
- **Persona:** Cisco CTO (OT plants, classified / air-gapped segments)
- **Evidence:** PRD promises “optional on-prem/air-gapped/Managed Control Plane + hybrid” (`docs/PERISCAN_FULL_PRODUCT_PRD.md`). Implementation status closed G4 with **Ansible/Terraform RemOps sims** (`packages/modules` air-gapped fixture modules; `docs/PRODUCT_COMPLETION_PLAN.md` G4). No offline package mirror, no disconnected control-plane image set, no “bring your own private API” deployment path with licensed modules cache.
- **Problem:** Air-gap buyers will read PRD/completion language as deployable MCP; code is safe dry-run IaC theater.
- **Impact:** Deal risk and trust damage if sold into manufacturing/OT RFPs; violates Real-First spirit for product-visible claims.
- **Recommendation:** Split product boundaries: (1) **Hybrid SaaS + outbound runner** (real, ship), (2) **Air-gapped MCP** as roadmap with no GA claims until private control-plane packaging + offline module/evidence store exist. Relabel G4 modules as “RemOps planning fixtures,” not on-prem deploy.
- **Effort:** XL for real MCP; S for claim hygiene
- **Zoo-related:** yes
- **Previous-panel-link:** Real-First / honesty themes

### FINDING | P10-8 | P1 | feature | integrations | Cisco stack depth is thin vs enterprise network reality
- **Persona:** Cisco CTO (own stack as control observers)
- **Evidence:** Live Cisco connectors: `duo` + `cisco-umbrella` only (`packages/connectors/src/index.ts`, `docs/INTEGRATIONS.md`). Contract test exists for Umbrella (`cisco-umbrella.contract.test.ts`); Duo has unit paths in `index.test.ts` but **no** dedicated `duo.contract.test.ts` in the contract-tested set of 29. Planned only: Cisco Secure Endpoint, Cisco Secure Firewall (`docs/INTEGRATIONS.md` EDR/XDR + WAF sections). **No** catalog entries found for ISE, SecureX/XDR platform, Meraki, Catalyst/DNA Center, ThousandEyes, AppDynamics, ACI.
- **Problem:** For a Cisco-heavy enterprise, MFA (Duo) + DNS SSE (Umbrella) is a start; without endpoint EDR and firewall observers, control-validation against the actual enforcement plane is incomplete.
- **Impact:** CTEM proof loop cannot close “did Secure Firewall / Secure Endpoint block what we stimulated?” for the dominant network vendor in many estates.
- **Recommendation:** Prioritize GA depth order: Duo (add contract test) → Umbrella (keep) → Secure Endpoint → Secure Firewall/Firepower logs → then ISE posture as Planned with honest status. Do **not** add Meraki/DNA until top four are contract-tested and live-smoke documented.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** synthesis “expanding connector catalog without GA depth”

### FINDING | P10-9 | P1 | improvement | integrations | Breadth theater: 267 catalog / 126 “live” / 29 contract-tested
- **Persona:** Cisco CTO (integration truth in RFP)
- **Evidence:** `docs/integrations.json` totals: catalog 141 planned layer, connectable 126, contractTested 29, integrations 267. `docs/INTEGRATIONS.md` header matches. Enterprise readiness pack (`apps/api/src/services/enterprise-readiness.ts`) checks Entra, Workspace, Salesforce, Okta, GitHub/GitLab/Jenkins, CrowdStrike/Defender/SentinelOne, K8s — **not** network SSE/firewall/Cisco.
- **Problem:** Marketplace-style breadth without depth fails network enterprise diligence; readiness packs reinforce cloud-identity bias over network control plane.
- **Impact:** Procurement scores “integrations” high; field engineering discovers Beta + untested majority.
- **Recommendation:** Publish a **GA top-N** list (≤15) with contract tests + live-smoke; demote rest in UI sort; extend enterprise readiness with optional “Network enforcement pack” (Umbrella, Secure Firewall when live, Zscaler/PAN already live).
- **Effort:** M
- **Zoo-related:** yes
- **Previous-panel-link:** U-16 zoo / Horowitz freeze surface

### FINDING | P10-10 | P1 | improvement | gtm | Packaging SKUs under-serve hybrid runners; payment still NotConfigured
- **Persona:** Cisco CTO (commercial packaging for hybrid validation)
- **Evidence:** `BILLING_PACKAGE_CATALOG` in `apps/api/src/runtime-services.ts`: LightExternalScan → Enterprise. **“Private runner support”** and `RunnerMinutes` meter appear on **Enterprise** only (`packageKey: "Enterprise"`, `status: "ContactSales"`). Core/Control packages lack runner capability strings. All packages `paymentProcessorStatus: "NotConfigured"`. Runner minutes calculation exists (`calculateRunnerMinutes`) but commercial path is opaque.
- **Problem:** Hybrid validation is the product differentiator, yet SKUs treat private runners as Enterprise-only contact-sales, with no mid-tier “N runners / M segments” packaging.
- **Impact:** Network teams that only need 3–5 segment runners cannot buy a clean SKU; sales falls back to bespoke Enterprise.
- **Recommendation:** Add a **Hybrid Runner** add-on or Core+ package: metered `RunnerMinutes` + max concurrent runners entitlement; keep full multi-tenant governance on Enterprise. Keep payment contact-sales until processor exists, but make entitlement gates real in API for runner registration count.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** Horowitz packaging / Enterprise buyer

### FINDING | P10-11 | P1 | improvement | security | Result signing is opt-in; unsigned runners still accepted
- **Persona:** Cisco CTO (non-repudiation of in-network measurements)
- **Evidence:** `packages/shared/src/runner.ts` `resultSigningPublicKeyPem` optional on registration; `apps/runner-agent/src/config.ts` null private key → “legacy unsigned mode”; `docs/THREAT_MODEL.md` residual: “Result signing is opt-in.”
- **Problem:** Transport auth proves the channel; without mandatory result signatures, a compromised process holding a bearer token can submit forged measurements.
- **Impact:** Evidence used for Fixed/Measured claims is weaker than the honesty architecture implies for enterprise auditors.
- **Recommendation:** Reject new registrations without result-signing key; grace-period migrate legacy runners; fleet policy flag `minimumResultSigning: required`.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-20 / proof honesty

### FINDING | P10-12 | P1 | improvement | runners | runner-agent lacks production deploy artifacts the Go runner has
- **Persona:** Cisco CTO (field deployment consistency)
- **Evidence:** `apps/runner/deploy/` — Compose, K8s NetworkPolicy (deny ingress, 443/53 egress), systemd unit, env example, README. `apps/runner-agent/` — Dockerfile + smoke script only; no K8s/systemd/Compose customer deploy package.
- **Problem:** The agent that carries measured/recon modules is the one **without** hardened deploy examples.
- **Impact:** Customers deploy the thin Go runner from polished manifests and never get AgentLocal value; or they freestyle Node deploys without NetworkPolicy baselines.
- **Recommendation:** Mirror deploy tree for runner-agent (or unify image); include non-root, read-only FS, NetworkPolicy, resource limits, secret mounts for mTLS material.
- **Effort:** M
- **Zoo-related:** yes (dual package)
- **Previous-panel-link:** P10-2

### FINDING | P10-13 | P2 | bug | security | Egress allow path is IPv6-blind
- **Persona:** Cisco CTO (dual-stack enterprise nets)
- **Evidence:** `apps/runner-agent/src/egress.ts` IPv4-only CIDR matching; `docs/THREAT_MODEL.md`: “IPv6 targets can never match an allow CIDR (safe as deny, but no IPv6 allow path).”
- **Problem:** Dual-stack campuses and DC fabrics increasingly address internal services as IPv6; scoped validation cannot allowlist them.
- **Impact:** False denials block legitimate internal validation; operators may weaken forbidInternetEgress or broaden hostnames unsafely.
- **Recommendation:** Add IPv6 CIDR parsing and tests; document dual-stack scope verification in scope UX.
- **Effort:** M
- **Zoo-related:** no
- **Previous-panel-link:** U-20 residual

### FINDING | P10-14 | P2 | improvement | ops | Explicit corporate proxy support is uneven across dual agents
- **Persona:** Cisco CTO (mandatory forward proxy / SSL inspection)
- **Evidence:** Go runner: `PERISCAN_RUNNER_PROXY_URL` / `HTTPS_PROXY` (`apps/runner/main.go` `loadConfig`). Deploy secrets include `PERISCAN_RUNNER_PROXY_URL`. Runner-agent `config.ts` shows control-plane URL + auth — **no** first-class proxy field in the config interface (enterprise proxy must be ambient Node env only, if at all documented).
- **Problem:** Large enterprises force all egress via Bluecoat/Zscaler/Umbrella SWG; agent B may not document parity with agent A.
- **Impact:** Segment install fails in locked-down plants; support escalations.
- **Recommendation:** First-class `PERISCAN_RUNNER_PROXY_URL` on runner-agent with tests; document TLS inspection / private CA trust store mount for both agents.
- **Effort:** S
- **Zoo-related:** yes
- **Previous-panel-link:** none

### FINDING | P10-15 | P2 | improvement | runners | Fleet policy is strong ops UX but lacks multi-site routing semantics
- **Persona:** Cisco CTO (site/segment affinity)
- **Evidence:** Fleet policy (`runner-fleet.ts` DEFAULT_POLICY): attention/offline seconds, cert warning days, min version, queue depth, support owner — **no** region, site, VRF, or capability-based task routing beyond labels on the runner record. Labels exist on registration schema but task lease selection is not a documented multi-runner scheduler with affinity.
- **Problem:** At multi-site scale, “any healthy runner” is wrong; tasks must pin to the segment that can reach the target.
- **Impact:** Wrong-segment execution or queue pile-up on the wrong agent; operators hand-pick runners forever.
- **Recommendation:** First-class `siteId` / `networkSegment` on runners; lease filter by scope CIDR intersection or explicit runner assignment on missions; surface in `/runners` fleet map.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P10-16 | P2 | request | integrations | Network enforcement missing from enterprise breadth readiness
- **Persona:** Cisco CTO (readiness packs must match network programs)
- **Evidence:** `buildEnterpriseBreadthReadiness` packs SSPM (Entra/Workspace/Salesforce/Okta), SSCS (GitHub/GitLab/Jenkins), endpoint EDR (CrowdStrike/Defender/S1), K8s — no Umbrella/Zscaler/Panorama/FortiGate/Cisco checks despite live connectors existing for several.
- **Problem:** “Enterprise ready” score can go green without any network-layer observer.
- **Impact:** Misaligned readiness for network-centric CTEM programs.
- **Recommendation:** Add pack “Network / SSE enforcement” with Umbrella, Zscaler, Panorama, FortiGate, Cloudflare as optional satisfied-if-connected checks.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** none

### FINDING | P10-17 | P2 | innovation | runners | Segment-aware runner SKU + appliance profile (not full BAS appliance)
- **Persona:** Cisco CTO (procurement + architecture innovation)
- **Evidence:** Topology is correctly non-appliance (`docs/DEPLOY.md`, outbound-only). Packaging still lacks a **field-installable profile** (small Linux image, OT passive allowlist, certificate lifecycle, proxy, one-line enroll) comparable to how network vendors ship agents.
- **Problem:** Honesty about not being a reverse-shell appliance is good; field packaging still feels like a cloud eng project.
- **Impact:** Slower hybrid adoption vs vendors who ship “drop this OVA/systemd unit.”
- **Recommendation:** Ship **Periscan Segment Runner** profiles: `campus-passive`, `dc-measured`, `ot-safe-baseline` as baked allowlists + resource limits + mTLS-required; meter by segment not by vague Enterprise contact-sales.
- **Effort:** L
- **Zoo-related:** no
- **Previous-panel-link:** Jobs/Horowitz wedge — hybrid is the wedge

### FINDING | P10-18 | P3 | improvement | api | Control channel schema advertises futures that confuse security review
- **Persona:** Cisco CTO (architecture review board)
- **Evidence:** `RunnerControlChannelSchema` includes `ReverseSsh`; `IssuedRunnerControlChannelSchema` excludes it; transport decision statuses mark ReverseSsh disallowed (tests in `app.test.ts`). WebSocketHttps is SupportedLater but never issued.
- **Problem:** Reviewers reading shared schemas see ReverseSsh and ask for threat models of a channel you correctly refuse.
- **Impact:** Extra review cycles; risk of a future engineer enabling a disallowed enum path.
- **Recommendation:** Keep disallowed enum only in a clearly named `HistoricalDisallowedChannel` type or docs table; ensure OpenAPI customer docs never list ReverseSsh as a capability.
- **Effort:** S
- **Zoo-related:** no
- **Previous-panel-link:** safety floor (protect)

---

## Top 5 moves to reach 5.0 (this lens)

1. **mTLS default-on in production** + deployment-status fail-closed (P10-1); mandate result signing for new runners (P10-11).  
2. **One customer runner package** (P10-2, P10-12) with mirrored deploy artifacts and corporate proxy parity (P10-14).  
3. **Fleet soak + multi-replica lease qualification** and published tenant runner limits (P10-5); segment affinity (P10-15).  
4. **Cisco/network GA depth:** Duo contract test, Secure Endpoint + Secure Firewall clients, network pack on enterprise readiness (P10-8, P10-9, P10-16).  
5. **Honest packaging:** Hybrid Runner SKU with RunnerMinutes (P10-10); Windows plan or demote (P10-3); air-gap claim hygiene (P10-7); Helm reference (P10-6).

Defer until after the above: full air-gapped MCP, ServiceViaProxy multiplex (or kill the claim), WebSocket channel, Meraki/DNA catalog expansion.

---

## Feature-zoo / IA notes (network CTO cut list)

| Action | Item | Why |
|--------|------|-----|
| **Merge** | Go `apps/runner` + TS `apps/runner-agent` into one supported product image/story | Dual agents are ops poison |
| **Demote** | Air-gapped Ansible/Terraform “G4 finished” language | Fixture ≠ MCP |
| **Demote** | Terraform provider scaffold as “integration” | Fixture-only TF |
| **Demote** | ReverseSsh / WebSocket in customer-facing capability lists | Confuses security review |
| **Hide / Labs** | Autonomous/swarm/MCP UI before fleet is boring | Prior panel U-16; network buyers buy hybrid proof first |
| **Rename** | “WindowsService” → “Windows (Planned)” until MSI exists | Enum honesty |
| **Keep primary** | `/runners` fleet control room, kill switch, sealed policy, outbound-only story | Core enterprise value |
| **Keep primary** | Verified scope + signed tasks + denied-never-queued | Non-negotiable safety floor |
| **Add rail weight** | Runners + Integrations + Schedules over Swarm | Hybrid Monday path |

---

## What is already excellent (do not break)

1. **Outbound-only hybrid topology** — no inbound management plane on the customer agent; signed, expiring tasks; local re-enforcement of scope/module/safety (`docs/RUNNER_SPEC.md`, `apps/runner*`, policy gates).  
2. **Three-layer trust design intent** — mTLS cert issuance from CSR without private key leaving the host, bearer token, Ed25519 task envelopes (`issueRunnerCredentials`, runner register flow).  
3. **Kill switch dual enforcement** — server fail-closed lease + agent local halt; revoke is permanent identity death (`runner-fleet` runbook).  
4. **Fleet operating policy + heartbeat samples** — attention/offline derived from **server receipt**, not host-claimed time; demo runners labeled demo.  
5. **Hardened Go runner deploy examples** — non-root, read-only root FS, NetworkPolicy deny-ingress, resource limits (`apps/runner/deploy/k8s`).  
6. **Connector honesty after Slice 1** — Planned ≠ connectable; Umbrella contract test is the right depth pattern.  
7. **Explicit non-claims on soak** — better than fake 99.99% SLAs (`ASYNC_OPERATIONS_RUNBOOK`).  
8. **Safety floor** — no reverse SSH in issued credentials; offensive live paths gated (Agents.md / SECURITY_BOUNDARIES).  

These are the assets a Cisco-shaped enterprise actually buys around. Do not trade them for catalog breadth or AI surfaces.

---

## Mapping to previous panel synthesis

| Prior theme / ID | This persona |
|------------------|--------------|
| P10 B− hybrid strong / scale unproven | **Confirmed** with code detail (P10-5) |
| U-20 mTLS optional | **Elevated to P0** for production default (P10-1) |
| Expand connectors without GA depth | **Agreed** — Cisco plan is depth-first (P10-8/9) |
| Wave C #18 runner mTLS default-on | **Must be Wave A for hybrid deals** |
| Feature zoo / freeze surface | Dual runners + air-gap theater are **infra zoo** analogs |
| Protect proof + safety floor | **Strong agree** — outbound signed runner is the enterprise wedge |

---

## Ship / no-ship (Cisco CTO gates)

| Gate | Needed for |
|------|------------|
| `PERISCAN_RUNNER_REQUIRE_MTLS=true` enforced in production | Any hybrid pilot |
| Single supported runner image + deploy guide | Field install |
| Corporate proxy + private CA documented | Locked-down egress |
| Duo + Umbrella contract-tested + live-smoke | Cisco-heavy pilot |
| Published fleet soak numbers (even modest N) | Capacity planning |
| Hybrid Runner entitlement (not only opaque Enterprise) | Clean commercial path |
| Air-gap MCP **not** sold as GA | Trust / Real-First |
| Windows path decided (ship or Planned) | Mixed-OS estates |

---

*End of exhaustive panel P10 — Cisco CTO. Output only: `docs/qa/panel-audit-exhaustive-2026-07-29/personas/10-cisco-cto.md`.*
