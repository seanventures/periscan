import { describe, expect, it } from "vitest";
import { z } from "zod";

import { executeModuleById } from "@periscan/modules";
import {
  DnsExfilCanaryProofInputSchema,
  DnsExfilCanaryProofResultSchema,
  buildSafetyEquivalentPacksResponse
} from "@periscan/shared";

// Mirror apps/api product-path honesty without bootstrapping Prisma.

describe("Phase C DNS exfil canary proof (API contracts + module path)", () => {
  it("accepts only allowlisted marker ids on the request schema", () => {
    expect(
      DnsExfilCanaryProofInputSchema.parse({
        markerId: "periscan-dns-exfil-1",
        hostname: "corp.example.com",
        techniqueId: "T1048"
      }).markerId
    ).toBe("periscan-dns-exfil-1");

    expect(() =>
      DnsExfilCanaryProofInputSchema.parse({
        markerId: "exfil-payload.bin"
      })
    ).toThrow();
  });

  it("result schema pins benign_marker_only and never real exfil", () => {
    // Honesty pins only — full mission/run graph is covered by OpenAPI + API tests.
    const HonestyPins = DnsExfilCanaryProofResultSchema.pick({
      closedLoop: true,
      exfilClaimClass: true,
      realDataExfiltrated: true,
      fullExfilLibrary: true,
      measured: true,
      canaryLabel: true,
      canaryFqdn: true,
      markerId: true,
      outcome: true,
      summary: true
    });

    const parsed = HonestyPins.parse({
      closedLoop: true,
      exfilClaimClass: "benign_marker_only",
      realDataExfiltrated: false,
      fullExfilLibrary: false,
      canaryLabel: "periscan-dns-exfil-1",
      canaryFqdn: "periscan-dns-exfil-1.corp.example.com",
      measured: false,
      markerId: "periscan-dns-exfil-1",
      outcome: "dns_exfil_detected",
      summary: "DNS-exfil detection canary observed (benign marker only)."
    });

    expect(parsed.exfilClaimClass).toBe("benign_marker_only");
    expect(parsed.realDataExfiltrated).toBe(false);
    expect(parsed.fullExfilLibrary).toBe(false);
    expect(parsed.measured).toBe(false);

    expect(() =>
      HonestyPins.parse({
        ...parsed,
        realDataExfiltrated: true
      })
    ).toThrow();
    expect(() =>
      HonestyPins.parse({
        ...parsed,
        exfilClaimClass: "full_exfil"
      })
    ).toThrow();
  });

  it("module path used by control-ai never claims realDataExfiltrated or measured without live emit", async () => {
    const markerId = "periscan-dns-control-ai-1";
    const output = await executeModuleById("periscan.dns_exfil_canary", {
      integrationIds: [],
      inputs: {},
      missionId: "00000000-0000-4000-8000-000000000001",
      policyDecisionId: null,
      runId: "00000000-0000-4000-8000-000000000002",
      runnerId: null,
      safetyLevel: "ActiveNonInvasive",
      scopeId: "00000000-0000-4000-8000-000000000003",
      target: {
        fixtureMode: true,
        hostname: "corp.example.com",
        markerId,
        observedEvents: [
          { alert: `DNS tunneling suspected: ${markerId}.corp.example.com` }
        ]
      },
      tenantId: "00000000-0000-4000-8000-000000000004"
    });

    expect(output.validationState).toBe("Detected");
    expect(output.outcome).toBe("dns_exfil_detected");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: false,
      emitted: false,
      realDataExfiltrated: false
    });
  });

  it("fixtureMode without telemetry stays Inconclusive (no false Missed)", async () => {
    const output = await executeModuleById("periscan.dns_exfil_canary", {
      integrationIds: [],
      inputs: {},
      missionId: "00000000-0000-4000-8000-000000000011",
      policyDecisionId: null,
      runId: "00000000-0000-4000-8000-000000000012",
      runnerId: null,
      safetyLevel: "ActiveNonInvasive",
      scopeId: "00000000-0000-4000-8000-000000000013",
      target: {
        fixtureMode: true,
        hostname: "corp.example.com",
        markerId: "periscan-dns-no-tele"
      },
      tenantId: "00000000-0000-4000-8000-000000000014"
    });

    expect(output.outcome).toBe("dns_exfil_no_telemetry");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.evidence[0]?.attributes).toMatchObject({
      measured: false,
      realDataExfiltrated: false
    });
  });

  it("safety pack inventory documents elevate vs forever refuse", () => {
    const response = buildSafetyEquivalentPacksResponse();
    expect(response.packs.map((p) => p.scorecardId)).toEqual([
      2, 16, 19, 21, 22, 26, 28
    ]);
    expect(response.safetyEquivalentScorecardIds).toEqual([16, 19, 21, 22]);
    expect(response.scaffoldCoreScorecardIds).toEqual([16, 21, 22]);
    const ransomware = response.packs.find((p) => p.scorecardId === 21);
    expect(ransomware?.canElevateSubstituteToPartial).toBe(false);
    expect(ransomware?.claimClass).toBe("forever_refuse");
    const dns = response.packs.find((p) => p.scorecardId === 19);
    expect(dns?.claimClass).toBe("benign_marker_only");
    expect(dns?.safeModules).toContain("periscan.dns_exfil_canary");
    const apt = response.packs.find((p) => p.scorecardId === 16);
    expect(apt?.claimClass).toBe("plan_only");
    const identity = response.packs.find((p) => p.scorecardId === 22);
    expect(identity?.claimClass).toBe("exposure_only");
  });

  it("marker regex refuses non-canary payloads (spray/malware theater)", () => {
    const MarkerOnly = z.object({
      markerId: DnsExfilCanaryProofInputSchema.shape.markerId
    });
    for (const bad of [
      "ransomware-encrypt",
      "cred-spray-list.txt",
      "sharphound.exe",
      "T1486"
    ]) {
      expect(() => MarkerOnly.parse({ markerId: bad })).toThrow();
    }
  });
});
