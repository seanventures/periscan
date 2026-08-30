# Historical PRD — Real, self-contained OSS toolkit + full in-network runner agent

Status: **Historical / superseded safety proposal**. This document is retained as
context for a rejected expansion path. It is **not** an implementation authority for
runner transport or live offensive tooling. Current binding sources are
`AGENTS.md`, `SECURITY_BOUNDARIES.md`, `docs/RUNNER_SPEC.md`, and
`RUNNER_ARCHITECTURE.md`.

Superseding safety addendum:

- The supported customer runner remains outbound HTTPS signed-task polling.
- Reverse SSH, arbitrary shells, unrestricted tunnels, and inbound runner listeners remain disallowed.
- SharpHound collection remains blocked pending legal review and explicit product approval.
- Caldera live execution and Atomic live execution remain disabled by default and are not customer-enabled by this document.
- Any future restricted task-tunnel or live adversarial capability requires a separate approved PRD, legal/security review, policy gates, customer authorization, tests, and release approval.

The historical proposal below uses intentionally stronger language about full toolkit
bundling and enabling SharpHound/Caldera/Atomic-live. Treat that language as superseded
by the addendum above.

Owner: platform. Last updated: 2026-06-13.

## 1. Problem & intent

Periscan's validation modules genuinely shell out to open-source security tools (`execFile`) with a `fixtureMode` CI fallback, and the registry honestly labels tool status — but **no build artifact installs any tool**, so a real deployment runs none of them out of the box. Three high-value tools are hard-denied (Caldera, Atomic-live, SharpHound), a full offensive/autonomous-pentest toolset is absent, and the "internal runner" is a tiny Go binary doing only four passive network checks.

**The product is not complete until** the entire OSS toolkit is installed, wired, and actually working — including the currently hard-denied tools, made real under governance — and the **internal runner is a full in-network execution agent** for the SaaS, shipped as its own image carrying the in-network kit, with a **full autonomous-pentest** capability (recon → web → AD/identity → cloud → adversary-emulation → exploitation) driven by an LLM orchestration loop.

## 2. Product shape: SaaS + thin internal runner (NOT an appliance)

- **Control plane (SaaS cloud):** api + web + worker + autonomous engine. Owns all orchestration, governance (scope verification, policy decisions, approvals, audit), evidence storage, and **server-reachable** tool execution.
- **Internal runner (in the customer network):** a **thin agent** with a minimal local interface — core setup only (control-plane URL, runner identity/keypair enrollment, network/IP scope, kill switch). No local intelligence or UI. It long-polls for **signed task envelopes**, does the SaaS's in-network work (discover / verify / perform), and returns **signed evidence**. It carries the in-network OSS toolkit and enforces scoped egress for approved tasks.

## 3. Execution topology (the "run locally vs proxy" design)

Every module/tool declares a **`runMode`** that decides where it executes:

| runMode             | Runs where                                                             | Why                                                                                                                       | Examples                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ServiceDirect**   | SaaS scan-executor, directly                                           | Target is reachable from the cloud; no in-network access needed                                                           | repo/dependency/secret scans (gitleaks, trivy, osv, semgrep), cloud posture (prowler, scoutsuite), AI validation (promptfoo/pyrit), internet-facing exposure (nuclei against public scope) |
| **ServiceViaProxy** | SaaS scan-executor, through a future restricted signed logical channel | Plain HTTP/TCP client tools that _could_ be proxied in a later approved design; keep tool logic centrally version-managed | nuclei (internal), ZAP, sqlmap, nikto, ffuf/feroxbuster, httpx, testssl, whatweb                                                                                                           |
| **AgentLocal**      | **On the runner agent**                                                | Needs raw sockets / L2 adjacency / multi-protocol auth / long-lived sessions that can't be cleanly proxied                | nmap, masscan, responder, NetExec/impacket, SharpHound collection, BloodHound ingest, Metasploit, Caldera                                                                                  |

**Future restricted logical channel:** the agent would dial outbound to the control plane and service a scoped SOCKS5 + HTTP-CONNECT channel multiplexed over that authenticated connection (preserving the outbound-only invariant — nothing connects _into_ the agent). SaaS-side `ServiceViaProxy` tools would use this channel only for the duration of an authorized task/engagement. The agent would enforce a **per-task egress allowlist** (only authorized-scope hosts/ports) and the **kill switch**; it would forward nothing outside the signed envelope's scope. This capability is not enabled by the current customer runner release and cannot be treated as a reverse SSH or arbitrary remote-access transport.

> **Implementation status (v0.1.173–174):** the agent-side SOCKS5 CONNECT handler (`apps/runner-agent/src/proxy.ts`) and the default-deny egress authorization (`egress.ts`) are implemented and unit-tested over in-memory channels (no inbound port). The handler runs over a duplex channel; the remaining integration is the **wire multiplexing of those channels over the outbound poll connection**, which needs matching control-plane support (a logical-channel layer) — tracked as a Phase-2 follow-up / Phase-5 dependency.

**Design rationale:** bundle on the agent only what truly must run in-network (raw-socket/L2/session tools); run everything proxyable from the SaaS where versions/policies are centrally managed; never expose an inbound port on the agent.

## 4. Governance (authorization rails kept; capability made real)

This historical epic described a future path for tools such as SharpHound, Caldera live execution, Atomic live execution, and other offensive kit. Current product policy does **not** enable those live paths. Authorization always lives in the SaaS; the agent only executes signed, pre-authorized envelopes.

- **`impactTier`** per module: `Passive` | `Active` | `Offensive` | `Exploitation`.
- An `Offensive`/`Exploitation` plan/import action is **allowed only** when the target carries: (a) a **verified-scope** reference (`scope.verificationStatus === "Verified"`), (b) an explicit **authorization** (`authorizedOffensive: true` + an operator **approval** record / `approvalId`), and (c) **`dryRun` defaults true**. Current production policy denies live/non-dry-run execution for high-impact modules before dispatch. Otherwise the action is **denied and audited**.
- Every queued/denied action writes an **AuditEvent**; denied actions are never dispatched to the agent. The autonomous engine routes **every** action through this governed path (`executeInlineValidation`/policy) — it never invokes a tool directly.
- The agent locally enforces only the **envelope scope + kill switch**; it makes no authorization decisions.

Historical proposal note, **not current product policy**: this section previously argued
for superseding the standing constraint on SharpHound/Caldera/Atomic live execution.
Current policy keeps SharpHound legal-review blocked and Caldera/Atomic live execution
disabled by default unless a separate approved PRD, legal/security review, policy gate,
customer authorization, and release gate explicitly enable a scoped capability.

## 5. Toolkit (full offensive kit)

- **Already declared (make turnkey):** gitleaks, nuclei (+templates), trivy, osv-scanner, prowler, promptfoo, pyrit, atomic-red-team (+invoke), bloodhound-ce, sharphound, caldera.
- **New — recon:** nmap, masscan, subfinder, httpx, dnsx, naabu. **Web:** ZAP, sqlmap, nikto, ffuf/feroxbuster, testssl.sh, whatweb. **AD/identity:** NetExec, impacket, kerbrute, responder. **Cloud:** ScoutSuite, pacu. **Exploitation/adversary:** Metasploit Framework, Caldera, and Atomic content remain dry-run/import or legal-review-gated only in the current product.
- **Autonomous orchestration:** the model-gateway engine plans and sequences these within scope+policy.

## 6. Packaging

- **Two tool-bearing images** (no single appliance image):
  - **SaaS scan-executor** (worker/engine): `ServiceDirect` + `ServiceViaProxy` tool binaries.
  - **Internal runner agent** (`apps/runner-agent`): Node agent embedding `packages/modules` + all `AgentLocal` tooling + the egress tunnel. Minimal local config; outbound-only.
- The existing tiny Go runner remains a minimal passive-only option (or is deprecated).
- Stateful deps (Postgres/Redis/MinIO) remain managed/compose sidecars, per standard SaaS practice.

## 7. Licensing & compliance (bundle-all posture)

Restricted-license tools ship inside the relevant image with obligations documented:

- **SharpHound — GPL-3.0:** conveyance obligations (offer of source / corresponding source pointer) in `THIRD_PARTY_NOTICES.md`.
- **nmap — NPSL** (modified GPL): redistribution notice.
- **Metasploit Framework** — BSD-style core; ship its license + an **export-control & authorized-use** notice.
- A `THIRD_PARTY_NOTICES.md` / `LICENSES/` manifest is generated from the registry `license` field and is a release gate.

## 8. Phased delivery

0. **PRD + governed execution** (this doc) + convert `evaluateModuleStartConstraints` to governed-allow; add `impactTier`/`runMode`; offensive audit actions + migration; tests.
1. **Server-side toolkit** bundled + wired into the scan-executor image; readiness real; THIRD_PARTY_NOTICES started.
2. **Full internal runner agent** (own image) + signed-task discover/verify/perform + restricted logical-channel research + `runMode` routing.
3. **Recon + web** modules/tools.
4. **AD/identity + cloud + adversary + exploitation** — hard-denied made real, governed.
5. **Autonomous engagement** loop (LLM orchestration over the governed dispatch path) + API + web.
6. **Compliance + image CI + GA** hardening + runbooks.

## 9. Invariants (must not regress)

Outbound-only signed-task transport (no inbound to the agent); auth/session model unchanged; additive Prisma migrations only (hand-authored); CI **never** runs live offensive tools (fixtureMode); a risk can't be Fixed without a verification event; denied actions never dispatched + always audited; the agent never makes authorization decisions.

## 10. Acceptance (definition of done per area)

- Each tool: fixtureMode unit + a contract test pinning the exact CLI invocation + normalized output; resolves `Ready` in the correct image's smoke test.
- Governance: offensive module plan/import denied without verified-scope/approval (+audit), allowed with it; live/non-dry-run high-impact execution denied in the current product.
- Runner agent: enroll → poll → signed discover task → signed evidence; any future restricted proxy channel reaches only allowlisted scope; kill switch halts execution.
- Autonomous engagement: produces evidence + attack paths with every action policy-gated and audited.
- Registry remains honest: no tool reads `Ready` unless bundled + resolvable in its image.
