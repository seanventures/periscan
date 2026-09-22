import { describe, expect, it } from "vitest";

import {
  DANGER_CATALOG,
  HIGH_DANGER_SECTION_COPY,
  HIGH_DANGER_SECTION_TITLE,
  emptyDangerOperatorGate,
  evaluateDangerStart,
  isDangerCatalogModule,
  listDangerCatalog,
  presentDangerCatalogOperatorView
} from "./danger-section";

describe("high-danger catalog", () => {
  it("lists T1486, unscoped spray, credential harvest, and kill-chain impact in High danger", () => {
    const ids = listDangerCatalog().map((entry) => entry.moduleId).sort();
    expect(ids).toEqual([
      "exploit.metasploit_payload",
      "exploitation.impact_t1486",
      "exploitation.killchain.engine",
      "exploitation.persistence",
      "identity.cred_spray",
      "identity.credential_harvest",
      "infection-monkey.mimikatz"
    ]);
    expect(DANGER_CATALOG.every((entry) => entry.section === "High danger")).toBe(
      true
    );
    expect(isDangerCatalogModule("identity.cred_spray")).toBe(true);
    expect(isDangerCatalogModule("gitleaks.repo_secrets")).toBe(false);
  });

  it("does not queue without danger acknowledgement", () => {
    const result = evaluateDangerStart({
      dangerAcknowledged: false,
      policyAllowed: true,
      qualified: true,
      scenarioId: "exploitation.impact_t1486",
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(result.startable).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyReason).toBe("danger_acknowledgement_required");
  });

  it("is startable after qualify, authorize, and danger ack", () => {
    const result = evaluateDangerStart({
      dangerAcknowledged: true,
      dangerAckDigest: "a".repeat(16),
      policyAllowed: true,
      qualified: true,
      scenarioId: "identity.cred_spray",
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(result.startable).toBe(true);
    expect(result.section).toBe("High danger");
    expect(result.dangerClass).toBe("unscoped_spray");
    expect(result.denyReason).toBeNull();
  });

  it("requires high-danger ack for Infection Monkey credential-steal plugins", () => {
    expect(isDangerCatalogModule("infection-monkey.mimikatz")).toBe(true);
    const denied = evaluateDangerStart({
      dangerAcknowledged: false,
      policyAllowed: true,
      qualified: true,
      scenarioId: "infection-monkey.mimikatz",
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(denied.startable).toBe(false);
    expect(denied.jobsQueued).toBe(0);
    expect(denied.dangerClass).toBe("credential_harvest");
    expect(denied.denyReason).toBe("danger_acknowledgement_required");

    const acked = evaluateDangerStart({
      dangerAcknowledged: true,
      dangerAckDigest: "b".repeat(16),
      policyAllowed: true,
      qualified: true,
      scenarioId: "infection-monkey.mimikatz",
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(acked.startable).toBe(true);
    expect(acked.jobsQueued).toBe(0);
    expect(acked.queued).toBe(false);
  });

  it("presents High danger operator copy and keeps Start off until ack plus qualify/authorize", () => {
    const titles = presentDangerCatalogOperatorView({
      dangerAcknowledged: false,
      gate: emptyDangerOperatorGate(),
      policyAllowed: true,
      scopeVerified: true
    });
    expect(titles.section).toBe(HIGH_DANGER_SECTION_TITLE);
    expect(titles.copy).toBe(HIGH_DANGER_SECTION_COPY);
    expect(HIGH_DANGER_SECTION_COPY).toMatch(/Not Community default start/);
    expect(HIGH_DANGER_SECTION_COPY).toMatch(/Denied starts never queue without ack/);
    expect(HIGH_DANGER_SECTION_COPY).toMatch(/Not unmarked Validate/);
    expect(titles.entries.map((entry) => entry.techniqueId)).toEqual([
      "T1486",
      "T1110",
      "T1003",
      "T1486",
      "T1547",
      "T1203",
      "T1003"
    ]);
    expect(titles.entries.map((entry) => entry.title)).toEqual([
      "Ransomware / impact (T1486)",
      "Unscoped credential spray",
      "Credential harvest",
      "Kill-chain impact",
      "Persistence",
      "Metasploit payload",
      "Infection Monkey credential steal (Mimikatz)"
    ]);
    expect(titles.qualifyState).toBe("qualification required");
    expect(titles.authorizeState).toBe("authorization denied");
    expect(titles.startEnabled).toBe(false);
    expect(titles.entries.every((entry) => entry.start.jobsQueued === 0)).toBe(
      true
    );

    const ackOnly = presentDangerCatalogOperatorView({
      dangerAcknowledged: true,
      dangerAckDigest: "a".repeat(16),
      gate: emptyDangerOperatorGate(),
      policyAllowed: true,
      scopeVerified: true
    });
    expect(ackOnly.startEnabled).toBe(false);

    const qualifyAuthorizeOnly = presentDangerCatalogOperatorView({
      dangerAcknowledged: false,
      gate: {
        available: true,
        items: listDangerCatalog(),
        qualified: true,
        tenantAuthorized: true
      },
      policyAllowed: true,
      scopeVerified: true
    });
    expect(qualifyAuthorizeOnly.startEnabled).toBe(false);
    expect(qualifyAuthorizeOnly.qualifyState).toBe("qualified");
    expect(qualifyAuthorizeOnly.authorizeState).toBe("authorized");

    const ready = presentDangerCatalogOperatorView({
      dangerAcknowledged: true,
      dangerAckDigest: "a".repeat(16),
      gate: {
        available: true,
        items: listDangerCatalog(),
        qualified: true,
        tenantAuthorized: true
      },
      policyAllowed: true,
      scopeVerified: true
    });
    expect(ready.startEnabled).toBe(true);
    expect(ready.entries.every((entry) => entry.start.startable)).toBe(true);
    expect(ready.entries.every((entry) => entry.start.jobsQueued === 0)).toBe(
      true
    );
  });
});
