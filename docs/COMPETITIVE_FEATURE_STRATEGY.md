# Periscan — Competitive Feature Strategy (the better-feature answer)

Companion to [COMPETITIVE_COVERAGE_MATRIX.md](COMPETITIVE_COVERAGE_MATRIX.md)
(the honest what-we-have audit). This doc is the **what-we-offer answer**: for
every capability the sector leaders (Picus, Pentera, XM Cyber, Cymulate,
RidgeBot, Tenable, Horizon3, SafeBreach) headline, Periscan's differentiated
response — grounded in one wedge.

**GTM category home (do not skip):** AEV/CTEM proof layer — not full BAS.
Durable positioning, battlecards, and SE rules:
[competitive/README.md](competitive/README.md),
[competitive/POSITIONING.md](competitive/POSITIONING.md).

## The wedge: proof, not claims

Every competitor sells "validate your security." Their weakness, uniformly, is
**overclaim**: theoretical "exploitable" verdicts, "false-positive-free" marketing
on heuristic data, autonomous-pentest demos that don't reproduce. Periscan's
single differentiator answers all of them:

> **Every Periscan verdict is provable.** Measured vs heuristic is labeled in the
> data model. "Fixed" flips only on a re-run measurement. Runner results are
> Ed25519-signed and server-verified. Evidence is tamper-evident. Where we
> simulate, we say "simulated" — never a fabricated number.

That is the product's answer to "near false-positive-free": not a claim, an
**architecture**. The strategy below turns each competitor capability into a
Periscan feature expressed through that wedge, and honestly tiers the work.

Tiers: **Have (prove-first)** = real + measured today · **Have (partial)** =
real but heuristic/read-only/narrow · **Build-next** = scaffold to make real ·
**Roadmap** = net-new.

---

## 1. The six validation pillars (CTEM-native unification)

| Pillar | Competitor bar | Periscan answer | Tier |
|---|---|---|---|
| **ASV / EASM** | Continuous external discovery + living asset map | Real recon tools (subfinder/httpx/dnsx) already run via signed runner. **Answer:** add autonomous seed-expansion (cert-transparency, whois, ASN, DNS brute) + a first-class discovery-inventory endpoint with change detection — and every discovered asset carries a **measured** reachability probe, not just a name. Differentiator: discovered *and validated*, not just enumerated. | Build-next |
| **APV** | Attack-path modeling + choke points across hybrid | Real graph + BFS + honest heuristic/measured labels today. **Answer:** ship a real graph-wide **choke-point solver** (betweenness/dominator/min-cut) that collapses N paths to the smallest blocking set, and promote per-edge verdicts to **measured** via the runner-executed probe path (see the measured multi-hop edge work). Differentiator: paths whose edges are *measured-reachable*, and choke points that are *computed*, not labeled. | Have (partial) → Build-next |
| **SCV** | Test controls, prove block/detect | Telemetry pull + technique correlation is real; control-plane inject remains **hard-disabled** (`control_live_execution_disabled`); Atomic is dry-run import only. **Answer (build-next, not claim-today):** close the loop with a **governed safe stimulus** (approved internal-runner mission) so we measure detect/block, not just observe ambient telemetry. Differentiator: the verdict cites the injected stimulus *and* the observed telemetry, both signed. | Partial (observe) / Build-next (inject) |
| **DRV** | SIEM/EDR/XDR rules fire against real threats | Rule inventory + coverage counting + marker **correlation** scaffold; emit is not closed-loop default. **Answer (build-next):** full **inject-and-observe** — emit a benign, uniquely-tagged marker, confirm the specific detection rule fired within SLA, report logged-but-not-alerted/stale/missing. Differentiator: per-rule firing proof with the marker as evidence. | Scaffold / Build-next |
| **CSV** | Cloud + K8s + container validation | Real Prowler/Trivy exec + live cloud-config parsing (measured-from-config exposure). **Answer:** add **kube-bench/CIS K8s**, a measured E2E against a containerized cloud tenant (extend the test range), and keep the DO-style measured fix-verification loop for every cloud provider. Differentiator: cloud exposure that is measured-from-authoritative-config, re-validated on fix. | Have (partial) → Build-next |
| **EXV** | Validation-aware risk + trends + dashboards | **Done and honest** — explainable multi-factor scoring, trend snapshots, dashboards. **Answer:** feed it measured inputs from the pillars above so exploitability is measured, not inferred; surface the measured/heuristic ratio as a first-class trust metric on the dashboard. Differentiator: a risk score that shows *how much of itself is proven*. | Have (prove-first) |

**Unification claim we can make honestly today:** all pillars already share one
evidence-backed findings + signal-fabric model (`SignalEnvelope` →
`correlateAttackPathsFromSignals` → findings/risk). That single-model CTEM
architecture is real and is the "single pane" answer.

## 2. Threat simulation & attack emulation

| Capability | Periscan answer | Tier |
|---|---|---|
| **AI-powered BAS** | Reframe honestly: we have a **governed LLM gateway with real provider adapters and grounded tools** — the trustworthy substrate competitors lack. **Answer:** wire the gateway to *generate real, executable, safe validation missions* from the existing module registry (not fixtures), each dispatched through the signed-task path and measured. Kill the `Math.random` swarm stub. Differentiator: AI that assembles **real measured missions**, with every step auditable. | Build-next (after stub removal) |
| **Threat library → MITRE** | One real feed (CISA KEV) + scraped techniques today. **Answer:** a curated **technique→executable-scenario** catalog keyed to real modules, multi-feed (KEV + EPSS + vendor advisories), with each scenario carrying its measured-or-simulated flag. Differentiator: a library where "mapped to ATT&CK" means *there is a runnable, measured check*, not a scraped tag. | Build-next |
| **Agent + agentless** | Real Go runner (passive) + agentless control-plane today. **Answer:** keep the safe-by-default posture as the selling point (no arbitrary shell by design), add a governed **agentless web-app attack** tier behind the offensive flip. Differentiator: agentless breadth with a provable safety floor. | Have (partial) → Build-next |
| **Multi-vector (incl. DNS exfil)** | Missing: malware/phishing/DNS-exfil. **Answer:** implement **Data-Exfiltration-over-DNS** as a genuinely measured, safe, uniquely-tagged canary (emit encoded markers to a controlled resolver, measure egress) — a real, non-destructive, *measured* exfil test that beats simulated ones. Add email/identity vectors as governed missions. | Roadmap |
| **Dynamic attack paths** | Advisory next-mission recommendations today. **Answer:** make signal-triggers drive **auto-launched safe re-validation** on asset/CVE/config drift (governed), so paths adapt to live context. Differentiator: adaptation that is evidence-triggered and audited. | Build-next |
| **Automated scheduling** | **Done** — per-tenant sweep, trending. **Answer:** add sub-daily "continuous" cadence + drift-triggered runs. | Have (prove-first) |
| **APT / autonomous pentest** | Governed flip is real; execution is a disabled stub. **Answer:** honest positioning — Periscan does **governed, measured, non-destructive** autonomous validation, with a hard policy floor that never lifts (destructive/exfil/persistence/credential-theft always denied). Build the real multi-hop measured edge (reachability→exploit) as the first true autonomous chain. Differentiator: "autonomous, but every step is authorized, measured, and reversible." | Build-next |

## 3. Agentic AI & virtual SOC

| Capability | Periscan answer | Tier |
|---|---|---|
| **Virtual Security Analyst** | Real governed gateway is the substrate. **Answer:** wire it as an always-available assistant over the *real* triage/plan/report tools, with every answer citing evidence IDs — an analyst that **can't hallucinate a finding** because it only speaks from signed evidence. Differentiator: a copilot bounded by the evidence graph. | Have (partial) → Build-next |
| **Find-Fix-Verify** | **Verify is already measured** (the crown jewel). **Answer:** market the loop as the only one where *verify is a re-measurement*, not a re-scan-of-opinion; automate Find→Fix handoffs while keeping the human-in-the-loop gate as a governance feature, not a limitation. | Have (prove-first, Verify) |

## 4. Remediation operations (RemOps)

| Capability | Periscan answer | Tier |
|---|---|---|
| **Auto-Mitigate** | Today it auto-*revalidates*, not auto-*fixes*. **Answer:** implement real, connector-gated control tuning (WAF rule, firewall, cloud config) behind explicit approval + automatic measured re-validation, so "mitigated" is *proven closed*. Rename the current endpoint honestly until then. | Build-next |
| **Prescriptive Planner** | Real templated planner today. **Answer:** keep deterministic steps as the trustworthy base; add optional LLM refinement (already gated) and **real generated IaC** (Terraform/CFN diffs), not a static hint. | Have (partial) → Build-next |
| **Automated Revalidation** | **Done, measured** — can flip a stale "Fixed" back honestly. Market it: nobody else demotes their own "Fixed." | Have (prove-first) |
| **ITSM/SOAR/IaC** | Real Jira/ServiceNow/GitHub clients. **Answer:** exercise live paths in staging, add **IaC push** (PR-with-diff to the customer repo), and evidence-link every ticket to the signed finding. Differentiator: tickets that carry proof. | Have (partial) → Build-next |

## 5. Business risk & compliance

| Capability | Periscan answer | Tier |
|---|---|---|
| **Compliance attestations** | 8 framework pack *types* exist; renderer is generic. **Answer:** build a real **control catalog + mapping matrix** (DORA articles, NIS2 measures, PCI reqs, ISO Annex-A, SEC, GDPR) that maps each control to the *measured* validations that evidence it — an attestation whose every claim links to signed evidence. Differentiator: audit-ready packs backed by measurement, not a posture summary. | Build-next |
| **Business-impact scoring** | Math exists, inputs dormant. **Answer:** populate financial/regulatory/operational impact from asset criticality + crown-jewel tagging + connector context; surface `$`-at-risk on the dashboard. Differentiator: impact tied to *validated* exposure, so the dollar figure is defensible. | Build-next |
| **AI control validation** | Real AI-app validation subsystem (safe). **Answer:** add a governed offensive AI test tier (injection/jailbreak corpus behind the flip) and a real **EU AI Act / ISO 42001 control mapping**. Strong existing base to extend. | Have (partial) → Build-next |

## 6. Unified data fabric & ecosystem

| Capability | Periscan answer | Tier |
|---|---|---|
| **Unified data fabric** | Real correlation engine + real Tenable/Wiz API ingestion. **Answer:** add **scan-file importers** (`.nessus`, CSV, SARIF) so customers drop in existing scans, all normalized to the same signal fabric and correlated. Differentiator: correlation with a real-first guard against fabricated assets. | Have (partial) → Build-next |
| **Deep native integrations** | **~106 real clients** — genuine breadth advantage. **Answer:** deepen the read-only pulls into bidirectional control where safe; fill named gaps (**VMware vCenter**, XSIAM branding); convert `market-leaders.ts` mock scaffolds to live. Market the breadth honestly (real vs mock counts published). | Have (prove-first, breadth) → Build-next |

## 7. Emerging / edge (roadmap to outpace)

| Capability | Periscan answer | Tier |
|---|---|---|
| **SSPM/SaaS** | Ingest-only today. **Answer:** native M365/Workspace/Okta config posture modules feeding the measured fix-verification loop. | Roadmap |
| **Identity-centric** | Simulated, live-off. **Answer:** governed, measured lateral-movement/credential validation against the range behind the offensive flip + hard floor. | Build-next |
| **SSCS** | Deps/SAST real; CI/CD absent. **Answer:** add pipeline-config auditing (GH Actions/GitLab/Jenkins) + build provenance/SLSA. | Roadmap |
| **OT/ICS** | v0.1 placeholder. **Answer:** real non-disruptive Modbus/DNP3 passive posture packs — safety-first is the differentiator in OT. | Roadmap |
| **MSSP multi-tenancy** | **Done** — real hierarchy + isolation + metered packs. **Answer:** wire live billing; market short-term assessment packs. Add the **Postgres RLS backstop** (defense-in-depth) as a trust proof point. | Have (prove-first) → Build-next |
| **Choke-point / hybrid modeling** | Descriptive today. **Answer:** the real graph-algorithm choke-point solver + a first-class hybrid topology/trust-zone model. | Build-next |
| **Exploitability / near-FP-free** | **The core strength** — honest measured/heuristic architecture. **Answer:** drive the measured share up (real probes feeding the Exploitable verdict) and publish the measured ratio. This is the claim to lead every deal with. | Have (prove-first) |

---

## Sequenced build plan (turns scaffold → real, honesty-first)

1. **Honesty cleanup (blocking):** remove/quarantine the `Math.random` swarm +
   kill-chain fabricated metrics. Nothing user-facing emits invented numbers.
2. **Prove the core wider:** measured multi-hop attack edge (reachability→exploit
   against the range) → promotes APV per-edge verdicts to measured, and is the
   first real autonomous chain. Add the RLS + evidence-chain trust backstops.
3. **Close the loop competitors fake:** governed safe stimulus for SCV, and the
   inject-and-observe DRV loop — the two "validation" claims we currently only
   scaffold.
4. **Compliance that means something:** real framework control-mapping matrix
   backed by measured evidence (DORA/NIS2/PCI/ISO/SEC/GDPR/EU-AI-Act).
5. **Fabric + fix reach:** scan-file importers; real Auto-Mitigate control tuning
   + IaC push; deepen the top integrations; fill vCenter.
6. **Roadmap breadth:** DNS-exfil canary, native SSPM, CI/CD SSCS, OT/ICS packs,
   graph choke-point solver, autonomous-but-governed identity validation.

Every item above is expressed as: *the same capability the leaders sell, but
Periscan's version is measured, signed, and honestly labeled.* That is the
"better-feature answer" — not more claims, more proof.
