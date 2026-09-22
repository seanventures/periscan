import { describe, expect, it } from "vitest";

import {
  BAS_CONTROL_PLANE_SCENARIOS,
  StartBasScenarioInputSchema,
  StartBasScenarioResultSchema,
  getBasControlPlaneScenario,
  listBasControlPlaneScenarios,
  liveOffensivePackFromTarget,
  resolveBasScenarioStart
} from "./bas-control-plane";

describe("BAS control-plane scenarios", () => {
  it("catalogues the marker plus three reviewed Atomic argv pins as startable", () => {
    const scenarios = listBasControlPlaneScenarios();
    const startable = scenarios.filter((scenario) => scenario.startable);

    expect(startable.map((scenario) => scenario.scenarioId).sort()).toEqual([
      "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133",
      "atomic:f449c933-0891-407f-821e-7916a21a1a6f",
      "atomic:fcbdd43f-f4ad-42d5-98f3-0218097e2720",
      "control.detection.benign-marker"
    ]);
    expect(
      startable.find(
        (scenario) => scenario.scenarioId === "control.detection.benign-marker"
      )
    ).toMatchObject({
      claimClass: "benign_marker_only",
      livePack: "none"
    });
    expect(getBasControlPlaneScenario("atomic.live")).toMatchObject({
      livePack: "atomic",
      startable: false
    });
    expect(
      liveOffensivePackFromTarget({
        scenarioId: "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133"
      })
    ).toBe("atomic");
    expect(
      scenarios
        .filter((scenario) => scenario.livePack !== "none")
        .map((scenario) => scenario.livePack)
        .sort()
    ).toEqual(["atomic", "atomic", "atomic", "atomic", "caldera", "metasploit"]);
  });

  it("resolves live Atomic as not queueable with a deny reason", () => {
    const resolved = resolveBasScenarioStart({
      scenarioId: "atomic.live",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });

    expect(resolved.queueable).toBe(false);
    expect(resolved.claimClass).toBe("qualification_required");
    expect(resolved.livePack).toBe("atomic");
    expect(resolved.denyReason?.toLowerCase()).toMatch(
      /atomic adapter qualification/
    );
    expect(resolved.denyReason?.toLowerCase()).toMatch(/never queued/);
  });

  it("resolves atomic.control_validation_safe with dryRun false as live Atomic", () => {
    const resolved = resolveBasScenarioStart({
      dryRun: false,
      moduleId: "atomic.control_validation_safe",
      scenarioId: "atomic.control_validation_safe",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });

    expect(resolved.queueable).toBe(false);
    expect(resolved.livePack).toBe("atomic");
  });

  it("resolves Caldera and Metasploit live packs as not queueable", () => {
    expect(
      resolveBasScenarioStart({
        scenarioId: "caldera.live",
        scopeId: "11111111-1111-4111-8111-111111111111"
      }).livePack
    ).toBe("caldera");
    const metasploit = resolveBasScenarioStart({
      scenarioId: "metasploit.live",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });
    expect(metasploit.livePack).toBe("metasploit");
    expect(metasploit.queueable).toBe(false);
    expect(metasploit.denyReason?.toLowerCase()).toMatch(/never queued/);
    expect(
      liveOffensivePackFromTarget({
        moduleId: "caldera.advanced_adversarial"
      })
    ).toBe("caldera");
    expect(
      liveOffensivePackFromTarget({
        moduleId: "exploit.metasploit_check"
      })
    ).toBe("metasploit");
  });

  it("resolves benign_marker_only as the queued ControlValidation path", () => {
    const resolved = resolveBasScenarioStart({
      scenarioId: "control.detection.benign-marker",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });

    expect(resolved.queueable).toBe(true);
    expect(resolved.claimClass).toBe("benign_marker_only");
    expect(resolved.livePack).toBe("none");
    expect(resolved.moduleId).toBe("periscan.detection_marker_emit_observe");
    expect(resolved.denyReason).toBeNull();
  });

  it("live pack signals win over a benign scenario id", () => {
    const resolved = resolveBasScenarioStart({
      dryRun: false,
      moduleId: "atomic.control_validation_safe",
      scenarioId: "control.detection.benign-marker",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });

    expect(resolved.queueable).toBe(false);
    expect(resolved.livePack).toBe("atomic");
  });

  it("parses start input and refuses Denied results that claim a queue", () => {
    const input = StartBasScenarioInputSchema.parse({
      scenarioId: "atomic.live",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });
    expect(input.scenarioId).toBe("atomic.live");

    expect(() =>
      StartBasScenarioResultSchema.parse({
        claimClass: "qualification_required",
        denyReason:
          "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
        jobsQueued: 1,
        mission: null,
        outcome: "Denied",
        policyDecisionId: "11111111-1111-4111-8111-111111111111",
        queued: true,
        rationale:
          "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
        runs: [],
        scenarioId: "atomic.live"
      })
    ).toThrow();

    expect(getBasControlPlaneScenario("atomic.live")?.livePack).toBe("atomic");
    expect(BAS_CONTROL_PLANE_SCENARIOS.length).toBeGreaterThanOrEqual(4);
  });
});
