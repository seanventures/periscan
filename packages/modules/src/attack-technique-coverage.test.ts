import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ATOMIC_CALDERA_FIXTURE_LIVE_DISABLED_BINDINGS,
  LIVE_DISABLED_EXECUTION_NOTE,
  LIVE_DISABLED_TOOLCHAIN_MODULE_IDS,
  isLiveDisabledToolchainModuleId
} from "@periscan/shared";

import {
  listAttackTechniqueCoverageFromToolchain,
  listLiveDisabledAttackTechniqueBindingsFromFixtures
} from "./attack-technique-coverage.js";
import { getModuleById } from "./index.js";
import { getOpenSourceToolDefinition } from "./toolchain.js";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures"
);

describe("ATT&CK coverage from Atomic/Caldera toolchain", () => {
  it("keeps Atomic and Caldera toolchain module ids live-disabled", () => {
    for (const toolId of [
      "atomic-red-team",
      "invoke-atomicredteam",
      "caldera"
    ] as const) {
      const tool = getOpenSourceToolDefinition(toolId);
      expect(tool).not.toBeNull();
      expect(tool!.moduleIds.length).toBeGreaterThan(0);
      expect(
        tool!.moduleIds.every((moduleId) =>
          isLiveDisabledToolchainModuleId(moduleId)
        )
      ).toBe(true);
    }

    expect([...LIVE_DISABLED_TOOLCHAIN_MODULE_IDS].sort()).toEqual([
      "atomic.control_validation_safe",
      "caldera.advanced_adversarial"
    ]);

    for (const moduleId of LIVE_DISABLED_TOOLCHAIN_MODULE_IDS) {
      const module = getModuleById(moduleId);
      expect(module?.manifest.liveSupported).toBe(false);
    }
  });

  it("aligns fixture technique ids with the live-disabled allowlist", async () => {
    const atomic = JSON.parse(
      await readFile(
        path.join(fixturesDir, "atomic/allowlisted-scenarios.json"),
        "utf8"
      )
    ) as Array<{ techniqueId: string }>;
    const caldera = JSON.parse(
      await readFile(
        path.join(fixturesDir, "caldera/operation-plan-fixture.json"),
        "utf8"
      )
    ) as { abilities: Array<{ techniqueId: string }> };

    const fixtureBindings = [
      ...atomic.map((scenario) => ({
        techniqueId: scenario.techniqueId,
        moduleId: "atomic.control_validation_safe"
      })),
      ...caldera.abilities.map((ability) => ({
        techniqueId: ability.techniqueId,
        moduleId: "caldera.advanced_adversarial"
      }))
    ];

    expect(ATOMIC_CALDERA_FIXTURE_LIVE_DISABLED_BINDINGS).toEqual(
      expect.arrayContaining(fixtureBindings)
    );
    expect(listLiveDisabledAttackTechniqueBindingsFromFixtures()).toEqual(
      expect.arrayContaining(fixtureBindings)
    );
  });

  it("maps fixture techniques to not executed (live disabled) unless a safe module wins", () => {
    const coverage = listAttackTechniqueCoverageFromToolchain();
    const scanning = coverage.find((row) => row.techniqueId === "T1595");
    const accountDiscovery = coverage.find(
      (row) => row.techniqueId === "T1087"
    );

    expect(scanning?.coverageLabel).toBe("Live disabled");
    expect(scanning?.executionNote).toBe(LIVE_DISABLED_EXECUTION_NOTE);
    expect(accountDiscovery?.coverageLabel).toBe("Live disabled");
    expect(accountDiscovery?.safeModuleId).toBeNull();

    expect(
      coverage.some((row) => /100%|bas parity/i.test(row.coverageLabel))
    ).toBe(false);
    expect(coverage.length).toBeLessThan(50);
  });

  it("does not mark Atomic liveSupported", () => {
    expect(
      getModuleById("atomic.control_validation_safe")?.manifest.liveSupported
    ).toBe(false);
  });
});
