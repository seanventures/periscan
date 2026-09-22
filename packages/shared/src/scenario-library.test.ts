import { describe, expect, it } from "vitest";

import { BAS_INJECT_COPY_FORBIDDEN } from "./bas-inject.js";
import {
  SCENARIO_LIBRARY_COMMUNITY_LICENSES,
  SCENARIO_LIBRARY_DISCLAIMER,
  SCENARIO_LIBRARY_ENGINE_LAB_LICENSES,
  ScenarioLibraryPackSchema,
  compileScenarioLibraryToCampaign,
  importScenarioLibraryPack,
  promoteScenarioLibraryContent,
  startScenarioLibraryCampaign
} from "./scenario-library.js";

const SHA = "ab".repeat(32);
const OTHER_SHA = "cd".repeat(32);

function communityPack(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    attackTechniques: ["T1082"],
    injects: [
      {
        dependsOn: [],
        injectId: "inj-hostname",
        name: "Hostname discovery",
        payloadPinId: "pin-hostname",
        techniqueIds: ["T1082"]
      }
    ],
    name: "Hostname discovery inject",
    payloadPins: [
      {
        contentSha256: SHA,
        kind: "command",
        name: "hostname argv",
        payloadPinId: "pin-hostname"
      }
    ],
    spdxLicenseId: "Apache-2.0",
    version: "1.0.0",
    ...overrides
  };
}

describe("OpenAEV scenario-library import (versioned packs → campaigns)", () => {
  it("requires name, ATT&CK techniques, injects, and payload pins on the pack schema", () => {
    const parsed = ScenarioLibraryPackSchema.parse(communityPack());
    expect(parsed.name).toBe("Hostname discovery inject");
    expect(parsed.attackTechniques).toEqual(["T1082"]);
    expect(parsed.injects).toHaveLength(1);
    expect(parsed.payloadPins).toHaveLength(1);
    expect(parsed.payloadPins[0]?.contentSha256).toBe(SHA);

    for (const broken of [
      communityPack({ name: "" }),
      communityPack({ attackTechniques: [] }),
      communityPack({ injects: [] }),
      communityPack({ payloadPins: [] }),
      communityPack({ attackTechniques: ["not-a-technique"] })
    ]) {
      expect(ScenarioLibraryPackSchema.safeParse(broken).success).toBe(false);
    }
  });

  it("imports as Unreviewed BasContentVersion-style content that is not executable", () => {
    const result = importScenarioLibraryPack(communityPack());
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.content.reviewStatus).toBe("Unreviewed");
    expect(result.content.executable).toBe(false);
    expect(result.content.executedCoverage).toBe(false);
    expect(result.content.evidenceProduced).toBe(false);
    expect(result.content.provenance).toBe("UserSuppliedUnverified");
    expect(result.jobsQueued).toBe(0);
    expect(result.executed).toBe(false);
    expect(result.pack.version).toBe("1.0.0");
  });

  it("rejects packs that claim executed coverage from import", () => {
    for (const boast of [
      communityPack({ executedCoverage: true }),
      communityPack({ executed: true }),
      communityPack({ executable: true }),
      communityPack({
        claims: { executedCoverage: true, coveragePercent: 100 }
      })
    ]) {
      const result = importScenarioLibraryPack(boast);
      expect(result.ok).toBe(false);
      if (result.ok) {
        continue;
      }
      expect(result.code).toBe("scenario_library_executed_coverage_forbidden");
      expect(result.executedCoverage).toBe(false);
      expect(result.jobsQueued).toBe(0);
      expect(result.executable).toBe(false);
    }
  });

  it("compiles injects to campaign pins without executing or queueing", () => {
    const imported = importScenarioLibraryPack(
      communityPack({
        injects: [
          {
            dependsOn: [],
            injectId: "inj-recon",
            name: "Recon",
            payloadPinId: "pin-hostname",
            techniqueIds: ["T1082"]
          },
          {
            dependsOn: ["inj-recon"],
            injectId: "inj-marker",
            name: "Marker",
            payloadPinId: "pin-hostname",
            techniqueIds: ["T1059"]
          }
        ],
        attackTechniques: ["T1082", "T1059"]
      })
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      return;
    }

    const compiled = compileScenarioLibraryToCampaign(imported);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.queued).toBe(false);
    expect(compiled.jobsQueued).toBe(0);
    expect(compiled.executed).toBe(false);
    expect(compiled.startable).toBe(false);
    expect(compiled.executable).toBe(false);
    expect(compiled.scenarioPins.map((pin) => pin.stepKey)).toEqual([
      "inj-recon",
      "inj-marker"
    ]);
    expect(compiled.scenarioPins[1]?.dependsOn).toEqual(["inj-recon"]);
    expect(compiled.scenarioPins[0]?.provider).toBe("OpenAev");
    expect(compiled.scenarioPins[0]?.contentSha256).toBe(SHA);
    expect(compiled.dependencyGraph.executionOrder).toEqual([
      "inj-recon",
      "inj-marker"
    ]);
  });

  it("routes Apache/MIT packs to Community and GPL/AGPL packs to Engine Lab", () => {
    expect([...SCENARIO_LIBRARY_COMMUNITY_LICENSES].sort()).toEqual([
      "Apache-2.0",
      "MIT"
    ]);
    expect([...SCENARIO_LIBRARY_ENGINE_LAB_LICENSES].sort()).toEqual([
      "AGPL-3.0",
      "GPL-2.0",
      "GPL-3.0"
    ]);

    const apache = importScenarioLibraryPack(communityPack());
    expect(apache.ok).toBe(true);
    if (apache.ok) {
      expect(apache.content.edition).toBe("Community");
      expect(apache.pack.spdxLicenseId).toBe("Apache-2.0");
    }

    const mit = importScenarioLibraryPack(
      communityPack({ spdxLicenseId: "MIT" })
    );
    expect(mit.ok).toBe(true);
    if (mit.ok) {
      expect(mit.content.edition).toBe("Community");
    }

    for (const spdxLicenseId of ["GPL-3.0", "GPL-2.0", "AGPL-3.0"] as const) {
      const copyleft = importScenarioLibraryPack(
        communityPack({ spdxLicenseId })
      );
      expect(copyleft.ok).toBe(true);
      if (!copyleft.ok) {
        continue;
      }
      expect(copyleft.content.edition).toBe("EngineLab");
      expect(copyleft.content.executable).toBe(false);
      expect(copyleft.content.reviewStatus).toBe("Unreviewed");
    }

    const blocked = importScenarioLibraryPack(
      communityPack({ spdxLicenseId: "SSPL-1.0" })
    );
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.code).toBe("scenario_library_license_blocked");
      expect(blocked.jobsQueued).toBe(0);
    }
  });

  it("keeps executable false after review and does not execute until start", () => {
    const imported = importScenarioLibraryPack(communityPack());
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      return;
    }

    const promoted = promoteScenarioLibraryContent(imported, {
      reviewStatus: "Reviewed"
    });
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) {
      return;
    }
    expect(promoted.content.reviewStatus).toBe("Reviewed");
    expect(promoted.content.executable).toBe(false);
    expect(promoted.executed).toBe(false);
    expect(promoted.jobsQueued).toBe(0);

    const compiled = compileScenarioLibraryToCampaign(promoted);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.executed).toBe(false);
    expect(compiled.jobsQueued).toBe(0);
    expect(compiled.queued).toBe(false);

    const startedUnreviewed = startScenarioLibraryCampaign({
      imported,
      compiledDigest: compiled.compiledDigest
    });
    expect(startedUnreviewed.queued).toBe(false);
    expect(startedUnreviewed.jobsQueued).toBe(0);
    expect(startedUnreviewed.executed).toBe(false);
    expect(startedUnreviewed.outcome).toBe("Denied");

    const startedReviewed = startScenarioLibraryCampaign({
      imported: promoted,
      compiledDigest: compiled.compiledDigest
    });
    expect(startedReviewed.jobsQueued).toBe(0);
    expect(startedReviewed.queued).toBe(false);
    expect(startedReviewed.executed).toBe(false);

    for (const forbidden of BAS_INJECT_COPY_FORBIDDEN) {
      expect(SCENARIO_LIBRARY_DISCLAIMER).not.toMatch(
        new RegExp(forbidden, "i")
      );
      expect(startedReviewed.denyReason).not.toMatch(
        new RegExp(forbidden, "i")
      );
      expect(startedUnreviewed.denyReason).not.toMatch(
        new RegExp(forbidden, "i")
      );
    }
  });

  it("accepts OpenAEV export JSON (scenario_information + scenario_injects) as a versioned pack", () => {
    const result = importScenarioLibraryPack({
      scenario_information: {
        scenario_id: "b45aead4-a2dc-4bc8-a330-835c199bc3a5",
        scenario_name: "Hostname discovery"
      },
      scenario_injects: [
        {
          inject_depends_on: [],
          inject_id: "13637929-f886-446f-968e-0c69c0926150",
          inject_injector_contract: {
            injector_contract_payload: {
              payload_attack_patterns: [
                { attack_pattern_external_id: "T1082" }
              ],
              payload_id: "ecf2b5c1-ac0a-4503-9a38-a322f0cd6bae",
              payload_name: "hostname argv",
              payload_type: "Command"
            }
          },
          inject_title: "Hostname discovery"
        }
      ],
      spdxLicenseId: "Apache-2.0",
      version: "1.0.0"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.pack.name).toBe("Hostname discovery");
    expect(result.pack.attackTechniques).toEqual(["T1082"]);
    expect(result.pack.injects[0]?.injectId).toBe(
      "13637929-f886-446f-968e-0c69c0926150"
    );
    expect(result.pack.payloadPins[0]?.payloadPinId).toBe(
      "ecf2b5c1-ac0a-4503-9a38-a322f0cd6bae"
    );
    expect(result.content.reviewStatus).toBe("Unreviewed");
    expect(result.content.executable).toBe(false);
    expect(result.content.executedCoverage).toBe(false);
    expect(result.content.edition).toBe("Community");
  });

  it("does not treat a different payload pin digest as the same compiled campaign", () => {
    const first = importScenarioLibraryPack(communityPack());
    const second = importScenarioLibraryPack(
      communityPack({
        payloadPins: [
          {
            contentSha256: OTHER_SHA,
            kind: "command",
            name: "hostname argv",
            payloadPinId: "pin-hostname"
          }
        ]
      })
    );
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    const compiledFirst = compileScenarioLibraryToCampaign(first);
    const compiledSecond = compileScenarioLibraryToCampaign(second);
    expect(compiledFirst.ok && compiledSecond.ok).toBe(true);
    if (!compiledFirst.ok || !compiledSecond.ok) {
      return;
    }
    expect(compiledFirst.compiledDigest).not.toBe(
      compiledSecond.compiledDigest
    );
    expect(compiledFirst.jobsQueued).toBe(0);
    expect(compiledSecond.jobsQueued).toBe(0);
  });
});
