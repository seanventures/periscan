import { describe, expect, it } from "vitest";

import {
  getProductHelpGuide,
  PRODUCT_HELP_GUIDES,
  PROOF_LOOP_HELP,
  PROOF_LOOP_STAGE_LABELS,
  PROOF_STAGE_LABELS,
  resolveProductHelp
} from "./product-help";

describe("product help content", () => {
  it("exports a single proof-stage vocabulary for chip strips", () => {
    expect(PROOF_STAGE_LABELS).toBe(PROOF_LOOP_STAGE_LABELS);
    expect([...PROOF_STAGE_LABELS]).toEqual([
      "Connect",
      "Authorize",
      "Validate",
      "Understand",
      "Act",
      "Verify",
      "Prove"
    ]);
    expect(PROOF_LOOP_HELP.map((s) => s.label)).toEqual([
      ...PROOF_STAGE_LABELS
    ]);
  });

  it("resolves help for the core workflow and dynamic review routes", () => {
    expect(resolveProductHelp("/dashboard").id).toBe("dashboard");
    expect(
      resolveProductHelp("/dashboard").steps.map((step) => step.title)
    ).toEqual(expect.arrayContaining(["Measure multi-hop when ready"]));
    expect(resolveProductHelp("/continuous").id).toBe("continuous");
    expect(
      resolveProductHelp("/continuous").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Measure multi-hop paths",
        "Schedule continuous EASM on verified scope"
      ])
    );
    expect(resolveProductHelp("/integrations").id).toBe("integrations");
    const integrationsHelp = resolveProductHelp("/integrations");
    expect(integrationsHelp.summary.toLowerCase()).toMatch(
      /planned|live credentials/
    );
    expect(integrationsHelp.terms.map((term) => term.term)).toEqual(
      expect.arrayContaining([
        "Planned / NotConnectable",
        "vCenter (Partial, read-only)",
        "XSIAM vs Cortex XDR"
      ])
    );
    expect(integrationsHelp.caution?.toLowerCase()).toMatch(
      /notconnectable|production/
    );
    expect(resolveProductHelp("/missions/mission-1").id).toBe("missions");
    expect(resolveProductHelp("/external-validation").id).toBe(
      "external-validation"
    );
    const externalHelp = resolveProductHelp("/external-validation");
    expect(externalHelp.steps.map((step) => step.title)).toEqual(
      expect.arrayContaining([
        "Choose verified scope and target",
        "Run the policy preflight",
        "Launch and watch the ledger",
        "Route evidence and re-test"
      ])
    );
    expect(externalHelp.summary.toLowerCase()).toMatch(/not a full asv|pentest/);
    expect(externalHelp.caution?.toLowerCase()).toMatch(/full asv|pentest/);
    expect(resolveProductHelp("/findings").id).toBe("findings");
    expect(resolveProductHelp("/snapshots/snapshot-1").id).toBe("snapshot");
    expect(resolveProductHelp("/snapshots/snapshot-1/report").id).toBe(
      "reports"
    );
    expect(resolveProductHelp("/remediation/remediation-1").id).toBe(
      "remediation"
    );
    expect(resolveProductHelp("/admin").id).toBe("admin");
    expect(
      resolveProductHelp("/admin").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Preview language and timezone",
        "Verify catalog assurance",
        "Activate a reviewed release",
        "Wire webhooks and check reports",
        "Recover by reviewed reactivation"
      ])
    );
    expect(
      resolveProductHelp("/admin").terms.map((term) => term.term)
    ).toEqual(
      expect.arrayContaining(["Webhook event catalog", "OpenAPI auth"])
    );
    const reportsHelp = resolveProductHelp("/reports");
    expect(reportsHelp.terms.map((term) => term.term)).toEqual(
      expect.arrayContaining(["Path claim honesty", "Claim deny-list"])
    );
    expect(reportsHelp.caution?.toLowerCase()).toMatch(
      /hypothesis mode|certification/
    );
    expect(resolveProductHelp("/controls").caution?.toLowerCase()).toMatch(
      /ransomware|kill-chain|not live inject/
    );
    expect(resolveProductHelp("/workflows").id).toBe("workflows");
    expect(
      resolveProductHelp("/workflows").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Verify recorder integrity",
        "Choose two moments",
        "Inspect the exact delta",
        "Reuse only verified history",
        "Qualify with fresh TEE evidence",
        "Respond and escalate"
      ])
    );
    expect(resolveProductHelp("/workflows").summary).toMatch(
      /does not run workloads inside an enclave/i
    );
    expect(
      resolveProductHelp("/workflows").steps.find(
        (step) => step.title === "Qualify with fresh TEE evidence"
      )?.instruction
    ).toMatch(/does not host TDX\/SEV\/H100/i);
    expect(resolveProductHelp("/workflows").caution).toMatch(
      /Never claim Periscan runs customer agents inside a TEE\/enclave/i
    );
    expect(resolveProductHelp("/mcp").id).toBe("mcp");
    expect(resolveProductHelp("/mcp").summary).toMatch(/read-only/i);
    expect(
      resolveProductHelp("/mcp").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Confirm Wave H catalog vs Community tools",
        "Mint a read-scope API key",
        "Use the durable flight recorder for workflow proof"
      ])
    );
    expect(resolveProductHelp("/mcp").caution?.toLowerCase()).toMatch(
      /bas swarm|fail closed|atomic|caldera/
    );
    expect(resolveProductHelp("/compliance").id).toBe("compliance");
    expect(resolveProductHelp("/compliance").summary).toMatch(
      /not certification and not an audit opinion/i
    );
    expect(
      resolveProductHelp("/compliance").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Pick a framework pack",
        "Read Met / Partial / Unmet honestly",
        "Export only as evidence support",
        "Ground claims in a current snapshot"
      ])
    );
    expect(
      resolveProductHelp("/compliance").terms.map((term) => term.term)
    ).toEqual(
      expect.arrayContaining([
        "Evidence-support pack",
        "Not certification / not audit opinion",
        "Representative catalog"
      ])
    );
    expect(resolveProductHelp("/compliance").caution?.toLowerCase()).toMatch(
      /certification|audit opinion|leading compliance/
    );
    expect(resolveProductHelp("/model-gateway").id).toBe("model-gateway");
    expect(resolveProductHelp("/registries").id).toBe("registries");
    expect(resolveProductHelp("/engines").id).toBe("registries");
    expect(resolveProductHelp("/engines").title).toMatch(/Engine Lab/i);
    expect(resolveProductHelp("/engines").summary).toMatch(
      /never baked into the default scan image/i
    );
    expect(
      resolveProductHelp("/registries").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Browse Engine Lab lanes",
        "Accept the upstream license (when required)",
        "Install, check, and enable",
        "Create, build, and sign an extension (optional)"
      ])
    );
    expect(resolveProductHelp("/runners").id).toBe("runners");
    expect(resolveProductHelp("/attack-paths").id).toBe("attack-paths");
    expect(resolveProductHelp("/validation-ops").id).toBe("async-operations");
    expect(resolveProductHelp("/engagements").id).toBe("engagements");
    expect(
      resolveProductHelp("/engagements").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Review the signed graph",
        "Record the next decision",
        "Inspect fresh branch evidence",
        "Stop or recompile deliberately"
      ])
    );
    expect(
      resolveProductHelp("/validation-ops").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Reconcile only stale work",
        "Verify the recovery draft",
        "Check the recovery ledger"
      ])
    );
    expect(resolveProductHelp("/billing").id).toBe("billing");
    expect(resolveProductHelp("/billing").summary).toMatch(
      /NotConfigured|invoice|approval-reference/i
    );
    expect(resolveProductHelp("/scopes").id).toBe("scopes");
    expect(resolveProductHelp("/schedules").id).toBe("schedules");
    expect(resolveProductHelp("/threat-center").id).toBe("threat-center");
    expect(resolveProductHelp("/threats").id).toBe("threat-center");
    expect(resolveProductHelp("/signal-activity").id).toBe("threat-center");
    expect(resolveProductHelp("/threat-feed").id).toBe("threat-feed");
    expect(resolveProductHelp("/labs").id).toBe("labs");
    expect(resolveProductHelp("/labs").title).toMatch(/Labs portal/i);
    expect(resolveProductHelp("/swarm").id).toBe("swarm");
    expect(resolveProductHelp("/swarm").caution?.toLowerCase()).toMatch(
      /not part of the first|labs/
    );
    expect(resolveProductHelp("/attack-paths/path-1").id).toBe("attack-paths");
    expect(
      resolveProductHelp("/billing").steps.map((step) => step.title)
    ).toEqual(
      expect.arrayContaining([
        "Start the direct-agreement ledger",
        "Approve and apply the next term",
        "Handle exceptions without ambiguity"
      ])
    );
    expect(resolveProductHelp("/unknown").id).toBe("generic");
  });

  it("teaches Wave H read catalog plus policy-gated Community MCP start", () => {
    const help = resolveProductHelp("/mcp");
    const body = [
      help.title,
      help.summary,
      ...help.steps.flatMap((step) => [step.title, step.instruction]),
      ...help.terms.flatMap((term) => [term.term, term.definition]),
      help.caution ?? ""
    ].join("\n");

    expect(help.summary).toMatch(/Wave H/i);
    expect(help.summary).toMatch(/read-only posture query/i);
    expect(body).toMatch(/list_community_suite/);
    expect(body).toMatch(/start_community_validation/);
    expect(body).toMatch(/list_findings_for_mission/);
    expect(body).toMatch(/verified scopeId/i);
    expect(body).toMatch(/policyDecisionId/);
    expect(body.toLowerCase()).toMatch(/never queue/);
    expect(body).toMatch(/readOnlyHint/);
    expect(body).toMatch(/Wave H catalog metadata/i);
    expect(body).toMatch(/policy-gated in the tool description and run path/i);
    expect(body).toMatch(/Atomic/);
    expect(body).toMatch(/Caldera/);
    expect(body).toMatch(/SharpHound/);
    expect(body).toMatch(/sqlmap/);
    expect(body).toMatch(/Metasploit/);
    expect(body).not.toMatch(/no MCP path to start missions/i);
    expect(body).not.toMatch(/cannot start missions/i);
    expect(body.toLowerCase()).not.toMatch(
      /fully open source|osi-approved|license flip/
    );
    expect(help.caution?.toLowerCase()).toMatch(/bas swarm|fail closed/);
  });

  it("keeps every guide actionable, concise, and grounded in an actual route", () => {
    const supportedDestinations = new Set([
      "/dashboard",
      "/findings",
      "/integrations",
      "/missions",
      "/remediation",
      "/remediation?status=VerificationPending",
      "/reports",
      // Multi-hop productization (P04-3 residual) + continuous hub
      "/attack-paths",
      "/schedules",
      "/getting-started",
      // Competitive walk (P19-r2/r3): BAS refuse + Wiz co-exist
      "/scopes",
      "/engines",
      "/controls",
      "/continuous",
      // Overnight O6/O8 residuals: MCP keys + flight recorder, compliance export
      "/admin",
      "/workflows",
      "/mcp",
      "/compliance"
    ]);

    for (const stage of PROOF_LOOP_HELP) {
      supportedDestinations.add(stage.href);
    }

    for (const guide of PRODUCT_HELP_GUIDES) {
      expect(guide.summary.length).toBeGreaterThan(30);
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.steps.length).toBeLessThanOrEqual(6);
      expect(guide.terms.length).toBeGreaterThanOrEqual(2);

      for (const step of guide.steps) {
        expect(step.title.length).toBeGreaterThan(4);
        expect(step.instruction.length).toBeGreaterThan(35);
        expect(step.instruction.length).toBeLessThanOrEqual(400);
        if (step.href) {
          expect(step.actionLabel).toBeTruthy();
          expect(supportedDestinations.has(step.href)).toBe(true);
        }
      }
    }
  });

  it("does not sell the Engine Lab catalog as Community validation", () => {
    const help = resolveProductHelp("/engines");
    expect(help.summary).toMatch(/never baked into the default scan image/i);
    expect(help.summary).toMatch(/not Community validation/i);
    expect(help.summary).toMatch(/Legal-review/i);
    expect(help.steps[0]?.instruction).toMatch(/Catalog only/i);
    expect(help.summary.toLowerCase()).not.toMatch(/full bas|live ransomware/);
  });

  it("teaches Validate add-scope for repo, AWS, and CIDR, not only DNS", () => {
    const add = resolveProductHelp("/missions").steps.find(
      (step) => step.title === "Add and verify scope"
    );
    expect(add?.instruction).toMatch(/repository path/i);
    expect(add?.instruction).toMatch(/AWS account/i);
    expect(add?.instruction).toMatch(/CIDR/i);
    expect(add?.instruction).toMatch(/DNS TXT/);
    expect(add?.instruction).toMatch(/Add scope/);
  });

  it("keeps zero public-ref honesty in Validate help, not first-run GTM", () => {
    const help = resolveProductHelp("/missions");
    expect(help.caution).toMatch(/Public customer references remain 0/);
    const visible = `${help.summary}\n${help.steps.map((s) => s.instruction).join("\n")}`;
    expect(visible).not.toMatch(/Path to first design partner/i);
    expect(visible).not.toContain("REFERENCE_FACTORY");
    expect(visible).not.toMatch(/Wave market[- ]presence/i);
  });

  it("states the product's safety and evidence invariants directly", () => {
    const allText = JSON.stringify(PRODUCT_HELP_GUIDES);

    expect(allText).toContain("denied work is never queued");
    expect(allText).toContain("Only a fresh measured re-validation");
    // Wave A / A5: choke honesty — evidence-backed path breakers, never Leading min-cut.
    expect(allText).toMatch(/evidence-backed path breaker/i);
    expect(allText).not.toMatch(/Leading min-cut/i);
    expect(allText).toContain(
      "does not replace your organization’s authorization"
    );
    expect(allText).toContain("does not upgrade inferred");
    expect(allText).toContain("does not apply cross-tenant bulk mutations");
    expect(allText).toContain("Stable claim semantics");
    expect(allText).toContain("Chain verified");
    expect(allText).toContain("denies checkpoint reuse");
    expect(allText).toContain("fail closed before queueing");
    expect(allText).toContain("Entity-resolution confidence is not ownership");
    expect(allText).toContain(
      "A fresh heartbeat proves authenticated liveness, not that any security control worked"
    );
    expect(allText).toContain("not cluster-breakout or exploitability proof");
    expect(allText).toContain("AgentDID trust profile");
    expect(allText).toContain(
      "DID control and a valid signature do not make an issuer trusted"
    );
    expect(allText).toContain("without retaining the raw credential");
    expect(allText).toContain("A feedback loop is not self-modifying autonomy");
    expect(allText).toContain("Every reserved attempt consumes budget");
    expect(allText).toContain("dry-run or fixture mode only");
    expect(allText).toContain("not live inject BAS");
    expect(allText).toContain(
      "dry-run scenario import alone never proves block or detect"
    );
  });

  it("resolves Controls help with Atomic dry-run + DRV marker-loop honesty", () => {
    const controls = resolveProductHelp("/controls");
    expect(controls.id).toBe("controls");
    expect(controls.summary).toContain("dry-run");
    expect(controls.summary).toContain("not live Atomic inject");
    expect(controls.summary).toMatch(/DRV Partial|benign-marker/i);
    expect(JSON.stringify(controls)).toContain("not live inject BAS");

    const stepTitles = controls.steps.map((step) => step.title);
    expect(stepTitles).toEqual(
      expect.arrayContaining([
        "Run Detection marker proof (DRV marker class)",
        "Treat Atomic as import-only"
      ])
    );
    const markerStep = controls.steps.find((step) =>
      step.title.includes("Detection marker proof")
    );
    expect(markerStep?.instruction).toMatch(/periscan-\*/);
    expect(markerStep?.instruction).toMatch(/benign_marker_only/);
    expect(markerStep?.instruction).toMatch(/fullAttackLibrary=false/);
    expect(markerStep?.instruction).toMatch(/Controls CTA|Run detection marker proof/i);
    expect(markerStep?.instruction).not.toMatch(/full ATT&CK BAS library inject/i);
    // O2: product-help deep-links to the Controls marker-proof CTA surface.
    expect(markerStep?.href).toBe("/controls");
    expect(markerStep?.actionLabel).toMatch(/marker proof|Controls/i);

    expect(controls.terms.map((term) => term.term)).toEqual(
      expect.arrayContaining([
        "Detection marker proof",
        "DRV Partial",
        "Dry-run scenario import"
      ])
    );
    const drvPartial = controls.terms.find((term) => term.term === "DRV Partial");
    expect(drvPartial?.definition).toMatch(/Partial/);
    expect(drvPartial?.definition).toMatch(/benign-marker|marker class/i);
    expect(controls.caution).toMatch(/DRV remains Partial/i);
    expect(controls.caution).toMatch(/benign-marker class/);
    expect(controls.caution?.toLowerCase()).toMatch(/not live inject/);
  });

  it("documents continuous EASM honesty on /continuous and /schedules (not living map)", () => {
    const continuous = resolveProductHelp("/continuous");
    expect(continuous.id).toBe("continuous");
    expect(continuous.summary).toMatch(/verified/i);
    expect(continuous.summary).toMatch(/not an autonomous living map|not.*living map/i);
    expect(continuous.steps.map((step) => step.title)).toEqual(
      expect.arrayContaining(["Schedule continuous EASM on verified scope"])
    );
    const easmStep = continuous.steps.find((step) =>
      step.title.toLowerCase().includes("continuous easm")
    );
    expect(easmStep?.instruction).toMatch(/verified/i);
    expect(easmStep?.instruction).toMatch(/allowlisted/i);
    expect(easmStep?.instruction).not.toMatch(/living map/i);
    expect(easmStep?.href).toBe("/schedules");
    expect(continuous.terms.map((term) => term.term)).toEqual(
      expect.arrayContaining(["Continuous EASM", "Continuous schedule"])
    );
    const continuousEasm = continuous.terms.find(
      (term) => term.term === "Continuous EASM"
    );
    expect(continuousEasm?.definition).toMatch(/verified customer scopes/i);
    expect(continuousEasm?.definition).toMatch(/not autonomous/i);
    expect(continuous.caution).toMatch(/not an autonomous living external map/i);

    const schedules = resolveProductHelp("/schedules");
    expect(schedules.id).toBe("schedules");
    expect(schedules.summary).toMatch(/ContinuousValidation|continuous EASM/i);
    expect(schedules.summary).toMatch(/not.*living map|never.*living map/i);
    expect(schedules.steps.map((step) => step.title)).toEqual(
      expect.arrayContaining([
        "Pick verified scope",
        "Define cadence and ContinuousValidation intent"
      ])
    );
    const intentStep = schedules.steps.find((step) =>
      step.title.includes("ContinuousValidation")
    );
    expect(intentStep?.instruction).toMatch(/allowlisted|External PoA|Nuclei/i);
    expect(intentStep?.instruction).toMatch(/not a living/i);
    expect(schedules.terms.map((term) => term.term)).toEqual(
      expect.arrayContaining(["ContinuousValidation EASM", "Policy gate"])
    );
    expect(schedules.caution).toMatch(/not a living map/i);
    expect(schedules.caution).toMatch(/never queued|never bypass policy/i);
  });

  it("does not imply that the dashboard always has immediate work", () => {
    const dashboard = resolveProductHelp("/dashboard");

    expect(dashboard.steps[0]?.instruction).toContain(
      "starting with Now when one is present and then Soon"
    );
  });

  it("catalogues the competitive walk for BAS refuse + Wiz co-exist", () => {
    const walk = getProductHelpGuide("competitive-walk");
    expect(walk).toBeDefined();
    expect(walk?.title).toBe("Competitive walk: BAS refuse + Wiz co-exist");
    expect(walk?.caution?.toLowerCase()).toMatch(
      /no fake demo|no inject|no cnapp/
    );
    const hrefs = (walk?.steps ?? [])
      .map((step) => step.href)
      .filter(Boolean);
    expect(hrefs).toEqual([
      "/scopes",
      "/engines",
      "/controls",
      "/findings",
      "/attack-paths",
      "/continuous"
    ]);
    expect(JSON.stringify(walk)).toMatch(/wiz co-exist|cnapp/i);
    expect(JSON.stringify(walk)).toMatch(/not.*inject bas|refuse full/i);
    // Must not sell full BAS peer or "replace Wiz/CNAPP" as a product claim.
    expect(JSON.stringify(walk)).not.toMatch(/full bas platform/i);
    expect(JSON.stringify(walk)).not.toMatch(/wiz alternative|rip out wiz/i);
  });

  it("documents multi-hop Measure as the attack-paths product help journey (Wave A / A9)", () => {
    const guide = getProductHelpGuide("attack-paths");
    expect(guide).toBeDefined();
    expect(guide?.id).toBe("attack-paths");
    expect(guide?.title).toMatch(/multi-hop/i);
    expect(resolveProductHelp("/attack-paths").id).toBe("attack-paths");
    expect(resolveProductHelp("/attack-paths/path-xyz").id).toBe(
      "attack-paths"
    );

    const stepTitles = (guide?.steps ?? []).map((step) => step.title);
    expect(stepTitles).toEqual(
      expect.arrayContaining([
        "Lead with hop measurement progress",
        "Measure hops safely, then confirm receipts",
        "Choose and revalidate the path breaker"
      ])
    );

    const text = JSON.stringify(guide);
    expect(text).toContain("Measure path hops");
    expect(text).toContain("Measure hop (safe)");
    expect(text).toMatch(/edge receipts/i);
    expect(text).toMatch(/Launch never upgrades/i);
    // Severity / score never upgrades evidence basis.
    expect(text).toMatch(/high score never upgrades evidence basis/i);
    // FullyMeasured only via receipts — never invent from launch.
    expect(text).toMatch(/evidence IDs/i);
    expect(guide?.caution?.toLowerCase()).toMatch(
      /requiresapproval|denied never means measured|never proves a fix/
    );
    // Must not overclaim Fully-E2E multi-hop BAS.
    expect(text.toLowerCase()).not.toMatch(/full bas|live ransomware/);
  });
});
