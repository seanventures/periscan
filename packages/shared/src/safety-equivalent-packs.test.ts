import { describe, expect, it } from "vitest";

import {
  SAFETY_EQUIVALENT_PACKS,
  SafetyEquivalentPackSchema,
  buildSafetyEquivalentPacksResponse,
  getSafetyEquivalentPack,
  listForeverRefuseSafetyPacks,
  listPartialEligibleSafetyPacks,
  listPartnerGatedPacks,
  listSafetyEquivalentGatePacks,
  listSafetyEquivalentPacks,
  listSafetyScaffoldCorePacks,
  listScaffoldGatedPacks
} from "./safety-equivalent-packs";

describe("safety-equivalent packs (PERISCAN-13 Phase C + Slice C partner)", () => {
  it("covers scorecard rows 2, 16, 19, 21, 22, 26, 28", () => {
    const ids = listSafetyEquivalentPacks().map((p) => p.scorecardId);
    expect(ids).toEqual([2, 16, 19, 21, 22, 26, 28]);
  });

  it("parses every catalog row", () => {
    for (const pack of SAFETY_EQUIVALENT_PACKS) {
      expect(() => SafetyEquivalentPackSchema.parse(pack)).not.toThrow();
    }
  });

  it("partner-gated rows 2/26/28 stay forever_refuse and non-elevatable", () => {
    const partners = listPartnerGatedPacks();
    expect(partners.map((p) => p.scorecardId)).toEqual([2, 26, 28]);
    for (const pack of partners) {
      expect(pack.gate).toBe("Partner");
      expect(pack.scorecardVerdict).toBe("Scaffold/gated");
      expect(pack.claimClass).toBe("forever_refuse");
      expect(pack.canElevateSubstituteToPartial).toBe(false);
    }
    expect(getSafetyEquivalentPack(2)?.foreverRefuse.join(" ")).toMatch(
      /dark-web/i
    );
    expect(getSafetyEquivalentPack(26)?.safeModules).toContain(
      "ot_ics.protocol_exposure"
    );
    expect(getSafetyEquivalentPack(28)?.foreverRefuse.join(" ")).toMatch(
      /marketplace|crowd/i
    );
  });

  it("row 21 ransomware is forever refuse for impact emulation", () => {
    const ransomware = getSafetyEquivalentPack(21);
    expect(ransomware?.claimClass).toBe("forever_refuse");
    expect(ransomware?.honestSubstituteVerdict).toBe("ForeverRefuse");
    expect(ransomware?.canElevateSubstituteToPartial).toBe(false);
    expect(ransomware?.foreverRefuse.join(" ")).toMatch(/ransomware/i);
    expect(ransomware?.safeModules).not.toContain(
      "exploitation.ransomware_live"
    );
  });

  it("row 16 APT substitute is plan_only Partial, not live APT", () => {
    const apt = getSafetyEquivalentPack(16);
    expect(apt?.claimClass).toBe("plan_only");
    expect(apt?.honestSubstituteVerdict).toBe("Partial");
    expect(apt?.safeModules).toContain("exploitation.killchain.engine");
    expect(apt?.foreverRefuse.join(" ")).toMatch(/APT/i);
  });

  it("row 19 DNS exfil is benign_marker_only with dns canary module", () => {
    const dns = getSafetyEquivalentPack(19);
    expect(dns?.claimClass).toBe("benign_marker_only");
    expect(dns?.safeModules).toEqual(["periscan.dns_exfil_canary"]);
    expect(dns?.foreverRefuse.join(" ")).toMatch(/bulk data exfiltration/i);
  });

  it("row 22 identity is exposure_only Partial with live spray refused", () => {
    const identity = getSafetyEquivalentPack(22);
    expect(identity?.claimClass).toBe("exposure_only");
    expect(identity?.honestSubstituteVerdict).toBe("Partial");
    expect(identity?.safeModules).toContain("gitleaks.repo_secrets");
    expect(identity?.foreverRefuse.join(" ")).toMatch(/spray|harvest|SharpHound/i);
  });

  it("lists partial-eligible vs forever-refuse without inventing live offense", () => {
    const partial = listPartialEligibleSafetyPacks().map((p) => p.scorecardId);
    const forever = listForeverRefuseSafetyPacks().map((p) => p.scorecardId);
    expect(partial).toContain(16);
    expect(partial).toContain(19);
    expect(partial).toContain(22);
    expect(partial).not.toContain(21);
    expect(partial).not.toContain(2);
    expect(forever).toContain(21);
    expect(forever).toContain(2);
    expect(forever).toContain(26);
    expect(forever).toContain(28);
  });

  it("response envelope carries honesty note and partner ids", () => {
    const response = buildSafetyEquivalentPacksResponse();
    expect(response.packs).toHaveLength(7);
    expect(response.partnerGatedScorecardIds).toEqual([2, 26, 28]);
    expect(response.safetyEquivalentScorecardIds).toEqual([16, 19, 21, 22]);
    expect(response.scaffoldCoreScorecardIds).toEqual([16, 21, 22]);
    expect(response.note).toMatch(/never authorize live ransomware/i);
    expect(response.note).toMatch(/Partner rows \(2\/26\/28\)/i);
    expect(response.note).toMatch(/16=plan_only/);
    expect(response.note).toMatch(/21=forever_refuse/);
    expect(response.note).toMatch(/22=exposure_only/);
  });

  it("scaffold core helpers pin 16 plan_only / 21 forever_refuse / 22 exposure_only", () => {
    const core = listSafetyScaffoldCorePacks();
    expect(core.map((p) => p.scorecardId)).toEqual([16, 21, 22]);
    expect(core.find((p) => p.scorecardId === 16)?.claimClass).toBe("plan_only");
    expect(core.find((p) => p.scorecardId === 21)?.claimClass).toBe(
      "forever_refuse"
    );
    expect(core.find((p) => p.scorecardId === 22)?.claimClass).toBe(
      "exposure_only"
    );
    expect(listSafetyEquivalentGatePacks().map((p) => p.scorecardId)).toEqual([
      16, 19, 21, 22
    ]);
    expect(listScaffoldGatedPacks().map((p) => p.scorecardId)).toEqual([
      2, 16, 21, 22, 26, 28
    ]);
  });
});
