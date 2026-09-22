import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId,
  isCommunityValidationToolId
} from "@periscan/shared";

import {
  VIGOLIUM_AUTHORIZATION_REQUIRED,
  VIGOLIUM_COMMUNITY_DEFAULT_DENIED,
  VIGOLIUM_LICENSE,
  VIGOLIUM_LIVE_ATTACK_PLANNING_DENIED,
  VIGOLIUM_MODULE_ID,
  VIGOLIUM_NOT_STARTABLE,
  VIGOLIUM_PARSER,
  VIGOLIUM_POLICY_NOT_ALLOWED,
  VIGOLIUM_QUALIFICATION_REQUIRED,
  VIGOLIUM_SPDX_LICENSE_ID,
  VIGOLIUM_VERIFIED_SCOPE_REQUIRED,
  evaluateVigoliumStart,
  importVigoliumFindings,
  mapVigoliumFindings,
  queueVigoliumImportStart
} from "./vigolium-audit.js";

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/vigolium/vigolium-fixture.json"
);

describe("Vigolium agentic audit import (AGPL-3.0 Engine Lab)", () => {
  it("records AGPL-3.0, stays out of the Community pack, and is not installable", () => {
    expect(VIGOLIUM_SPDX_LICENSE_ID).toBe("AGPL-3.0");
    expect(VIGOLIUM_SPDX_LICENSE_ID).not.toBe("Apache-2.0");
    expect(VIGOLIUM_MODULE_ID).toBe("vigolium.audit_import");
    expect(VIGOLIUM_PARSER).toBe("periscan.vigolium.v1");
    expect(isCommunityValidationModuleId(VIGOLIUM_MODULE_ID)).toBe(false);
    expect(isCommunityValidationToolId("vigolium")).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain(VIGOLIUM_MODULE_ID);
    expect(
      COMMUNITY_VALIDATION_SUITE.some((entry) =>
        /GPL|LGPL|AGPL/i.test(entry.toolLicense)
      )
    ).toBe(false);

    const started = evaluateVigoliumStart({
      authorized: true,
      qualified: true,
      verifiedScope: true
    });
    expect(started.communityDefaultPack).toBe(false);
    expect(started.communityStart).toBe(false);
    expect(started.installable).toBe(false);
    expect(started.liveAttackPlanning).toBe(false);
    expect(started.liveSupported).toBe(false);
    expect(started.executed).toBe(false);
    expect(started.spdxLicenseId).toBe("AGPL-3.0");
    expect(started.policyStatus).toBe("Blocked");
    expect(VIGOLIUM_LICENSE.disposition).toBe("Blocked");
    expect(VIGOLIUM_LICENSE.redistributableInDefaultPack).toBe(false);
  });

  it("maps the audit fixture to two findings and omits exploit, attack plan, and trap secrets", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    expect(raw).toMatch(/AKIAIOSFODNN7EXAMPLE/);
    expect(raw).toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(raw).toMatch(/attack_plan/);
    expect(raw).toMatch(/poc/);

    const findings = mapVigoliumFindings(JSON.parse(raw));
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      cwe: "CWE-89",
      id: "C1-sqli-login",
      severity: "critical",
      title: "SQL injection in login"
    });
    expect(findings[1]).toMatchObject({
      cwe: "CWE-22",
      id: "H1-path-traversal-export",
      severity: "high",
      title: "Path traversal in export"
    });

    const blob = JSON.stringify(findings);
    expect(blob).not.toMatch(/AKIA/);
    expect(blob).not.toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(blob).not.toMatch(/attack_plan/);
    expect(blob).not.toMatch(/poc_script/);
    expect(blob).not.toMatch(/hashed_secret/);
  });

  it("yields zero findings for empty, malformed, or summary-only JSON", () => {
    expect(mapVigoliumFindings(undefined)).toEqual([]);
    expect(mapVigoliumFindings(null)).toEqual([]);
    expect(mapVigoliumFindings({})).toEqual([]);
    expect(mapVigoliumFindings([])).toEqual([]);
    expect(mapVigoliumFindings("not-json")).toEqual([]);
    expect(mapVigoliumFindings({ finding_count: 99, findings: [] })).toEqual(
      []
    );
    expect(
      mapVigoliumFindings({ summary: { failed: 7 }, results: [] })
    ).toEqual([]);
    expect(importVigoliumFindings({ raw: "" }).findings).toEqual([]);
    expect(importVigoliumFindings({ raw: "{not json" }).findings).toEqual([]);
    expect(
      importVigoliumFindings({ fixtureMode: true, raw: "[]" }).findings
    ).toEqual([]);
  });

  it("replays fixtureMode from the fixture file and does not invent findings", () => {
    const imported = importVigoliumFindings({ fixtureMode: true });
    expect(imported.findings).toHaveLength(2);
    expect(imported.invented).toBe(false);
    expect(imported.liveAttackPlanning).toBe(false);
    expect(imported.liveSupported).toBe(false);
    expect(imported.parser).toBe("periscan.vigolium.v1");
  });

  it("default-denies live attack planning and requires verified authorized scope", () => {
    const planning = evaluateVigoliumStart({
      authorized: true,
      liveAttackPlanning: true,
      verifiedScope: true
    });
    expect(planning.allowed).toBe(false);
    expect(planning.jobsQueued).toBe(0);
    expect(planning.liveAttackPlanning).toBe(false);
    expect(planning.code).toBe("vigolium_live_attack_planning_denied");

    const unverified = evaluateVigoliumStart({
      authorized: true,
      verifiedScope: false
    });
    expect(unverified.allowed).toBe(false);
    expect(unverified.jobsQueued).toBe(0);
    expect(unverified.code).toBe("vigolium_verified_scope_required");

    const unauthorized = evaluateVigoliumStart({
      verifiedScope: true
    });
    expect(unauthorized.allowed).toBe(false);
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.code).toBe("vigolium_authorization_required");

    const importOnly = evaluateVigoliumStart({
      authorized: true,
      qualified: true,
      verifiedScope: true
    });
    expect(importOnly.allowed).toBe(true);
    expect(importOnly.jobsQueued).toBe(1);
    expect(importOnly.liveSupported).toBe(false);
    expect(importOnly.liveAttackPlanning).toBe(false);
    expect(importOnly.executed).toBe(false);
    expect(importOnly.installable).toBe(false);

    const unqualified = evaluateVigoliumStart({
      authorized: true,
      qualified: false,
      verifiedScope: true
    });
    expect(unqualified.allowed).toBe(false);
    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.executed).toBe(false);
    expect(unqualified.code).toBe("vigolium_qualification_required");
  });

  it("does not treat PERISCAN_LIVE_OFFENSIVE=1 as an enablement path", () => {
    const result = evaluateVigoliumStart({
      authorized: true,
      liveAttackPlanning: true,
      liveOffensiveEnv: "1",
      verifiedScope: true
    });
    expect(result.allowed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.liveAttackPlanning).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe("vigolium_live_attack_planning_denied");
  });
});

function qualifiedImportInput(overrides: Record<string, unknown> = {}) {
  return {
    authorized: true,
    fixtureMode: true,
    policyOutcome: "Allowed",
    qualified: true,
    startable: true,
    verifiedScope: true,
    ...overrides
  };
}

describe("Vigolium qualified import-only audit queue", () => {
  it("queues an import-only audit plan when qualified, authorized, and verified", () => {
    const result = queueVigoliumImportStart(qualifiedImportInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recorded).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.code).toBeNull();
    expect(result.executed).toBe(false);
    expect(result.importOnly).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.liveAttackPlanning).toBe(false);
    expect(result.installable).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.policyStatus).toBe("Blocked");
    expect(result.spdxLicenseId).toBe("AGPL-3.0");
    expect(result.license).toEqual(VIGOLIUM_LICENSE);
    expect(result.license.disposition).toBe("Blocked");
    expect(result.license.redistributableInDefaultPack).toBe(false);
    expect(result.findings).toHaveLength(2);
    expect(result.auditPlan).toMatchObject({
      executed: false,
      importOnly: true,
      kind: "import-only-audit",
      liveAttackPlanning: false,
      liveSupported: false,
      moduleId: VIGOLIUM_MODULE_ID,
      parser: VIGOLIUM_PARSER
    });
    expect(result.auditPlan?.findingIds).toEqual([
      "C1-sqli-login",
      "H1-path-traversal-export"
    ]);
    const blob = JSON.stringify(result);
    expect(blob).not.toMatch(/AKIA/);
    expect(blob).not.toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(blob).not.toMatch(/attack_plan/);
    expect(blob).not.toMatch(/poc_script/);
  });

  it("queues nothing when the start gate is not startable", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ startable: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recorded).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.auditPlan).toBeNull();
    expect(result.code).toBe(VIGOLIUM_NOT_STARTABLE);
  });

  it("queues nothing when the Engine Lab adapter is unqualified", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ qualified: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.code).toBe(VIGOLIUM_QUALIFICATION_REQUIRED);
  });

  it("queues nothing without tenant authorization", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ authorized: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.code).toBe(VIGOLIUM_AUTHORIZATION_REQUIRED);
  });

  it("queues nothing without verified scope", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ verifiedScope: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.code).toBe(VIGOLIUM_VERIFIED_SCOPE_REQUIRED);
  });

  it("queues nothing when policy is not Allowed", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ policyOutcome: "Denied" })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.auditPlan).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(VIGOLIUM_POLICY_NOT_ALLOWED);
  });

  it("queues nothing when requested as Community default pack", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ communityDefaultPack: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.installable).toBe(false);
    expect(result.code).toBe(VIGOLIUM_COMMUNITY_DEFAULT_DENIED);
  });

  it("queues nothing for live attack planning even when the other gates are open", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({ liveAttackPlanning: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.liveAttackPlanning).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(VIGOLIUM_LIVE_ATTACK_PLANNING_DENIED);
  });

  it("still queues nothing for live attack planning when PERISCAN_LIVE_OFFENSIVE=1", () => {
    const result = queueVigoliumImportStart(
      qualifiedImportInput({
        liveAttackPlanning: true,
        liveOffensiveEnv: "1"
      })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.executed).toBe(false);
    expect(result.liveAttackPlanning).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(VIGOLIUM_LIVE_ATTACK_PLANNING_DENIED);
  });

  it("does not treat import as executed coverage", () => {
    const result = queueVigoliumImportStart(qualifiedImportInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.executed).toBe(false);
    expect(result.importOnly).toBe(true);
    expect(result.auditPlan?.executed).toBe(false);
    expect(result.liveSupported).toBe(false);
  });
});
