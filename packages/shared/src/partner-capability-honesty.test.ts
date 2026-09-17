import { describe, expect, it } from "vitest";

import { buildPartnerCapabilityHonesty } from "./partner-capability-honesty.js";

describe("partner capability honesty (Slice D)", () => {
  it("covers scorecard rows 2/26/28/38/51 without inventing partners", () => {
    const honesty = buildPartnerCapabilityHonesty();
    expect(honesty.scorecardIds).toEqual([2, 26, 28, 38, 51]);
    expect(honesty.partnerGatedScorecardIds).toEqual([2, 26, 28]);
    expect(honesty.honestyNote).toMatch(/never invent/i);
    expect(honesty.honestyNote).toMatch(/dark-web|OT|HITL|A2A|AgentDID/i);

    for (const id of [2, 26, 28]) {
      const row = honesty.rows.find((r) => r.scorecardId === id);
      expect(row?.gate).toBe("Partner");
      expect(row?.state).toBe("ExternallyGated");
      expect(row?.foreverRefuse.length).toBeGreaterThan(0);
    }

    const a2a = honesty.rows.find((r) => r.scorecardId === 38);
    expect(a2a?.state).toBe("AvailableWithHonesty");
    expect(a2a?.productSurfaces.join(" ")).toMatch(/A2A/i);
    expect(a2a?.foreverRefuse.join(" ")).toMatch(/Leading/i);

    const agentDid = honesty.rows.find((r) => r.scorecardId === 51);
    expect(agentDid?.state).toBe("AvailableWithHonesty");
    expect(agentDid?.productSurfaces.join(" ")).toMatch(/AgentDID|VC/i);
    expect(agentDid?.detail).toMatch(/did:web|receipt/i);
  });
});
