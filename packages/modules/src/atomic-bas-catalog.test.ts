import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  AtomicLabAdapterBindingSchema,
  BasAtomicScenarioCatalogItemSchema,
  BasAtomicScenarioRunInputSchema,
  classifyAtomicActivity,
  denyLiveAtomicCustomerStart,
  resolveBasScenarioStart,
  StartBasScenarioResultSchema
} from "@periscan/shared";

import {
  evaluateModuleStartConstraints,
  executeModuleById,
  getModuleById
} from "./index.js";
import {
  bindAtomicLabAdapterForCampaign,
  getAllowlistedAtomicBasScenario,
  listAllowlistedAtomicBasScenarios,
  listAtomicLabAdapterBindings,
  reviewAtomicLabEligibility
} from "./atomic-bas-catalog.js";

const ATOMIC_FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/atomic"
);

describe("allowlisted Atomic MIT BAS catalog", () => {
  it("loads YAML fixtures, not live Invoke-AtomicRedTeam", async () => {
    const files = (await readdir(ATOMIC_FIXTURE_DIR)).filter((name) =>
      name.endsWith(".yaml")
    );

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((name) => name.endsWith(".yaml"))).toBe(true);
  });

  it("lists catalog rows with technique id, name, dry-run, SPDX MIT, live disabled", async () => {
    const items = await listAllowlistedAtomicBasScenarios();

    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.map((item) => item.techniqueId).sort()).toEqual(
      expect.arrayContaining(["T1087", "T1595"])
    );

    for (const item of items) {
      const parsed = BasAtomicScenarioCatalogItemSchema.parse(item);
      expect(parsed.executionMode).toBe("dry-run");
      expect(parsed.spdxLicenseId).toBe("MIT");
      expect(parsed.liveExecutionDisabled).toBe(true);
      expect(parsed.liveExecutionLabel).toBe("live execution disabled");
      expect(parsed.moduleId).toBe("atomic.control_validation_safe");
      expect(parsed.name.length).toBeGreaterThan(0);
      expect(parsed.techniqueId).toMatch(/^T\d+/);
    }
  });

  it("looks up a scenario by id without enabling live execution", async () => {
    const items = await listAllowlistedAtomicBasScenarios();
    const first = items[0];
    expect(first).toBeDefined();
    const found = await getAllowlistedAtomicBasScenario(first!.scenarioId);
    expect(found).toMatchObject({
      executionMode: "dry-run",
      liveExecutionDisabled: true,
      scenarioId: first!.scenarioId,
      spdxLicenseId: "MIT",
      techniqueId: first!.techniqueId
    });
  });

  it("keeps atomic.control_validation_safe live-disabled (atomic_live_disabled)", () => {
    const atomic = getModuleById("atomic.control_validation_safe");
    expect(atomic).toBeDefined();
    expect(atomic!.manifest.liveSupported).toBe(false);
    expect(atomic!.manifest.license).toBe("MIT");

    const live = evaluateModuleStartConstraints({
      executionEnvironment: "ControlPlane",
      moduleManifests: [atomic!.manifest],
      runnerId: null,
      target: { dryRun: false, techniqueId: "T1595" }
    });

    expect(live).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });
  });

  it("parses a live catalog run request as live, not dry-run", () => {
    expect(
      BasAtomicScenarioRunInputSchema.parse({ executionMode: "live" })
    ).toMatchObject({ executionMode: "live" });
  });

  it("denies live startBasScenario-shaped Atomic requests with jobsQueued=0", () => {
    const resolved = resolveBasScenarioStart({
      scenarioId: "atomic.live",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });
    expect(resolved.queueable).toBe(false);
    expect(resolved.livePack).toBe("atomic");

    const denied = denyLiveAtomicCustomerStart({
      scenarioId: "atomic.live",
      techniqueId: "T1082"
    });
    expect(denied.jobsQueued).toBe(0);
    expect(denied.allowed).toBe(false);
    expect(
      StartBasScenarioResultSchema.safeParse({
        claimClass: "qualification_required",
        denyReason: resolved.denyReason,
        jobsQueued: 0,
        mission: null,
        outcome: "Denied",
        policyDecisionId: "11111111-1111-4111-8111-111111111111",
        queued: false,
        rationale: resolved.denyReason,
        runs: [],
        scenarioId: "atomic.live"
      }).success
    ).toBe(true);
  });

  it("does not count catalog imports as executions", async () => {
    const items = await listAllowlistedAtomicBasScenarios();
    expect(items.every((item) => item.executionMode === "dry-run")).toBe(true);
    expect(classifyAtomicActivity("catalog_import").countedAsExecution).toBe(
      false
    );

    const imported = await executeModuleById("atomic.control_validation_safe", {
      integrationIds: [],
      inputs: {},
      missionId: "11111111-1111-4111-8111-111111111111",
      policyDecisionId: null,
      runId: "22222222-2222-4222-8222-222222222222",
      runnerId: null,
      safetyLevel: "BASLite",
      scopeId: "33333333-3333-4333-8333-333333333333",
      target: {
        controlSourceId: "44444444-4444-4444-8444-444444444444",
        dryRun: true,
        techniqueId: "T1595"
      },
      tenantId: "55555555-5555-4555-8555-555555555555"
    });
    expect(imported.signals[0]?.signalSubcategory).toBe(
      "ValidationScenarioImported"
    );
    expect(imported.evidence[0]?.attributes.measured).toBe(false);
    expect(imported.evidence[0]?.attributes.dryRunImport).toBe(true);
  });
});

describe("Atomic lab adapter campaign binding", () => {
  it("exposes reviewed Linux-safe bindings a compiler can pin", () => {
    const bindings = listAtomicLabAdapterBindings();
    expect(bindings.map((item) => item.guid).sort()).toEqual([
      "486e88ea-4f56-470f-9b57-3f4d73f39133",
      "f449c933-0891-407f-821e-7916a21a1a6f",
      "fcbdd43f-f4ad-42d5-98f3-0218097e2720"
    ]);
    for (const binding of bindings) {
      const parsed = AtomicLabAdapterBindingSchema.parse(binding);
      expect(parsed.os).toBe("linux");
      expect(parsed.queueable).toBe(false);
      expect(parsed.customerLiveSupported).toBe(false);
      expect(parsed.argv[0]?.startsWith("/bin/")).toBe(true);
      expect(parsed.expectedTelemetry.detection).toBe("NotMeasured");
    }
  });

  it("fails closed for catalog dry-run and non-argv Linux fixtures", () => {
    expect(
      reviewAtomicLabEligibility("8d0d1e2b-5e3f-4c22-8d1b-000000001087")
    ).toMatchObject({
      eligible: false,
      failClosed: true
    });
    expect(
      reviewAtomicLabEligibility("034fe21c-3186-49dd-8d5d-128b35f181c7")
    ).toMatchObject({
      eligible: false,
      failClosed: true,
      reason: expect.stringMatching(/argv-allowlisted|shell script|never eval/i)
    });
    expect(
      reviewAtomicLabEligibility("20aba24b-e61f-4b26-b4ce-4784f763ca20")
    ).toMatchObject({
      eligible: false,
      failClosed: true
    });
  });

  it("queues customer-live campaign steps for reviewed Linux argv pins", () => {
    const live = bindAtomicLabAdapterForCampaign({
      guid: "486e88ea-4f56-470f-9b57-3f4d73f39133",
      live: true,
      os: "linux"
    });
    expect(live).toMatchObject({
      bound: true,
      customerQueueable: true
    });
    if (live.bound) {
      expect(live.binding.argv).toEqual(["/bin/hostname"]);
      expect(live.binding.customerLiveSupported).toBe(true);
      expect(live.binding.queueable).toBe(true);
      expect(live.binding.labOnly).toBe(false);
    }
    const dateLive = bindAtomicLabAdapterForCampaign({
      guid: "f449c933-0891-407f-821e-7916a21a1a6f",
      live: true,
      os: "linux"
    });
    expect(dateLive).toMatchObject({
      bound: true,
      customerQueueable: true
    });
    if (dateLive.bound) {
      expect(dateLive.binding.argv).toEqual(["/bin/date"]);
      expect(dateLive.binding.customerLiveSupported).toBe(true);
    }
    const yamlLive = bindAtomicLabAdapterForCampaign({
      guid: "034fe21c-3186-49dd-8d5d-128b35f181c7",
      live: true,
      os: "linux"
    });
    expect(yamlLive).toMatchObject({
      bound: false,
      jobsQueued: 0,
      liveSupported: false,
      queued: false
    });
    const lab = bindAtomicLabAdapterForCampaign({
      guid: "486e88ea-4f56-470f-9b57-3f4d73f39133",
      os: "linux"
    });
    expect(lab).toMatchObject({
      bound: true,
      customerQueueable: false
    });
    if (lab.bound) {
      expect(lab.binding.argv).toEqual(["/bin/hostname"]);
    }
    const dateLab = bindAtomicLabAdapterForCampaign({
      guid: "f449c933-0891-407f-821e-7916a21a1a6f",
      os: "linux"
    });
    expect(dateLab).toMatchObject({
      bound: true,
      customerQueueable: false
    });
    if (dateLab.bound) {
      expect(dateLab.binding.argv).toEqual(["/bin/date"]);
      expect(dateLab.binding.customerLiveSupported).toBe(false);
    }
  });
});
