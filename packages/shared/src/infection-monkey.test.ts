import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ENGINE_LAB_THEATER_MODULE_IDS,
  ENGINE_LAB_THEATER_TOOL_IDS,
  isCommunityValidationModuleId,
  isCommunityValidationToolId,
  isCopyleftOptInModuleId,
  isCopyleftOptInToolId,
  isEngineLabTheaterModuleId,
  isEngineLabTheaterToolId
} from "./community-edition";
import {
  COPYLEFT_ENGINE_LAB_MODULE_IDS,
  INFECTION_MONKEY_DENIED_PLUGINS,
  INFECTION_MONKEY_DISCOVER_MODULE_ID,
  INFECTION_MONKEY_LICENSE,
  INFECTION_MONKEY_TOOL_ID,
  classifyInfectionMonkeyIslandReport,
  compileInfectionMonkeyDiscoverProfile,
  isCopyleftEngineLabModuleId,
  isInfectionMonkeyCredentialStealPlugin
} from "./infection-monkey";

const VERIFIED_HOSTS = ["lab-web.example.test", "lab-db.example.test"];

function islandReport() {
  return {
    edges: [
      {
        relationship: "scanned",
        source: "lab-web.example.test",
        target: "lab-db.example.test"
      }
    ],
    nodes: [
      { id: "lab-web.example.test", name: "lab-web", type: "Host" },
      { id: "lab-db.example.test", name: "lab-db", type: "Host" }
    ]
  };
}

describe("Infection Monkey Engine Lab copyleft (GPL-3.0)", () => {
  it("is Engine Lab GPL, not Community default pack or live copyleft start", () => {
    expect(INFECTION_MONKEY_DISCOVER_MODULE_ID).toBe("infection-monkey.discover");
    expect(INFECTION_MONKEY_TOOL_ID).toBe("infection-monkey");
    expect(INFECTION_MONKEY_LICENSE).toEqual({
      collectorExecutable: false,
      disposition: "RequiresLegalReview",
      redistributableInDefaultPack: false,
      spdxLicenseId: "GPL-3.0",
      toolId: "infection-monkey"
    });
    expect(isCopyleftOptInModuleId("infection-monkey.discover")).toBe(false);
    expect(isCopyleftOptInToolId("infection-monkey")).toBe(false);
    expect(isCopyleftEngineLabModuleId("infection-monkey.discover")).toBe(true);
    expect(COPYLEFT_ENGINE_LAB_MODULE_IDS).toContain(
      "infection-monkey.discover"
    );
    expect(isCommunityValidationModuleId("infection-monkey.discover")).toBe(
      false
    );
    expect(isCommunityValidationToolId("infection-monkey")).toBe(false);
    expect(isEngineLabTheaterModuleId("infection-monkey.discover")).toBe(true);
    expect(isEngineLabTheaterToolId("infection-monkey")).toBe(true);
    expect(ENGINE_LAB_THEATER_MODULE_IDS).toContain("infection-monkey.discover");
    expect(ENGINE_LAB_THEATER_TOOL_IDS).toContain("infection-monkey");
  });
});

describe("Infection Monkey discover profile", () => {
  it("compiles verified-scope crawl as promote-to-scope candidates", () => {
    const compiled = compileInfectionMonkeyDiscoverProfile({
      plugins: ["ping_scanner", "tcp_scanner"],
      verifiedScopeHosts: VERIFIED_HOSTS
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.profile.liveSupported).toBe(false);
    expect(compiled.profile.executable).toBe(false);
    expect(compiled.profile.propagation).toBe(false);
    expect(compiled.profile.communityDefaultPack).toBe(false);
    expect(compiled.profile.candidates).toEqual([
      {
        autoAddedToScope: false,
        host: "lab-web.example.test",
        inVerifiedScope: true,
        promotion: "promote-to-scope"
      },
      {
        autoAddedToScope: false,
        host: "lab-db.example.test",
        inVerifiedScope: true,
        promotion: "promote-to-scope"
      }
    ]);
    expect(compiled.profile.plugins).toEqual(["ping_scanner", "tcp_scanner"]);
  });

  it("default-denies Mimikatz, Zerologon, and ransomware payloads", () => {
    for (const plugin of [
      "mimikatz",
      "MimikatzCollector",
      "zerologon",
      "ZerologonExploiter",
      "ransomware"
    ]) {
      const compiled = compileInfectionMonkeyDiscoverProfile({
        plugins: ["ping_scanner", plugin],
        verifiedScopeHosts: VERIFIED_HOSTS
      });
      expect(compiled.ok).toBe(false);
      if (compiled.ok) {
        continue;
      }
      expect(compiled.code).toMatch(
        /exploiter_denied|credential_steal_denied|ransomware_denied/
      );
    }
    expect(INFECTION_MONKEY_DENIED_PLUGINS).toEqual(
      expect.arrayContaining([
        "mimikatz",
        "zerologon",
        "ransomware",
        "log4shell",
        "smb_exploiter",
        "wmi_exploiter",
        "rdp_exploiter",
        "ssh_exploiter"
      ])
    );
    expect(isInfectionMonkeyCredentialStealPlugin("mimikatz")).toBe(true);
    expect(isInfectionMonkeyCredentialStealPlugin("ping_scanner")).toBe(false);
  });

  it("fails closed on unscoped or empty crawl targets", () => {
    expect(
      compileInfectionMonkeyDiscoverProfile({
        plugins: ["ping_scanner"],
        verifiedScopeHosts: ["*"]
      })
    ).toMatchObject({ ok: false, code: "infection_monkey_targets_unscoped" });
    expect(
      compileInfectionMonkeyDiscoverProfile({
        plugins: ["ping_scanner"],
        verifiedScopeHosts: []
      })
    ).toMatchObject({ ok: false, code: "infection_monkey_scope_required" });
  });
});

describe("Island C2 report honesty", () => {
  it("imports Island C2 reports as graph hypotheses until independent hop receipts", () => {
    const withoutReceipts = classifyInfectionMonkeyIslandReport({
      report: islandReport(),
      requestedValidationState: "Validated"
    });

    expect(withoutReceipts.importedGraphIsHypothesis).toBe(true);
    expect(withoutReceipts.islandC2IsNotMeasuredHops).toBe(true);
    expect(withoutReceipts.claim.canClaimValidated).toBe(false);
    expect(withoutReceipts.claim.canClaimExploitable).toBe(false);
    expect(withoutReceipts.claimSafeValidationState).toBe("Discovered");
    expect(withoutReceipts.edges[0]?.hypothesis).toBe(true);
    expect(withoutReceipts.edges[0]?.independentlyMeasured).toBe(false);

    const islandSelfReceipt = classifyInfectionMonkeyIslandReport({
      hopReceipts: [
        {
          evidenceIds: [randomUUID()],
          measurementMethod: "island c2",
          moduleId: "infection-monkey.discover",
          relationship: "scanned",
          source: "lab-web.example.test",
          sourceKind: "SafeProbe",
          target: "lab-db.example.test",
          validationState: "Validated"
        }
      ],
      report: islandReport()
    });
    expect(islandSelfReceipt.importedGraphIsHypothesis).toBe(true);
    expect(islandSelfReceipt.edges[0]?.independentlyMeasured).toBe(false);

    const independent = classifyInfectionMonkeyIslandReport({
      hopReceipts: [
        {
          evidenceIds: [randomUUID()],
          measurementMethod: "tcp reachability",
          moduleId: "periscan.tcp_reachability",
          relationship: "scanned",
          source: "lab-web.example.test",
          sourceKind: "SafeProbe",
          target: "lab-db.example.test",
          validationState: "Validated"
        }
      ],
      report: islandReport()
    });
    expect(independent.edges[0]?.independentlyMeasured).toBe(true);
    expect(independent.edges[0]?.hypothesis).toBe(false);
    expect(independent.islandC2IsNotMeasuredHops).toBe(true);
  });
});
