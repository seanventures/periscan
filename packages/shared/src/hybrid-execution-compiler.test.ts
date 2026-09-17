import { describe, expect, it } from "vitest";

import {
  assemblePassiveMultiAgentPlan,
  buildConversationalMissionDraft,
  HYBRID_COMPILER_PRODUCT_STATUS,
  isHybridCompilerPassiveModuleId,
  missionDraftToHybridCompileInput,
  selectPassiveModulesForIntent
} from "./hybrid-execution-compiler.js";

const META = [
  {
    moduleId: "periscan.dns_resolution_check",
    name: "DNS resolution",
    safetyLevel: "PassiveReadOnly" as const
  },
  {
    moduleId: "periscan.tls_certificate_check",
    name: "TLS certificate",
    safetyLevel: "ActiveNonInvasive" as const
  },
  {
    moduleId: "periscan.http_health_check",
    name: "HTTP health",
    safetyLevel: "ActiveNonInvasive" as const
  },
  {
    moduleId: "periscan.endpoint_benign_marker_emit",
    name: "Endpoint canary",
    safetyLevel: "ControlledValidation" as const
  }
];

describe("hybrid execution compiler contracts", () => {
  it("keeps product honesty flags non-leading", () => {
    expect(HYBRID_COMPILER_PRODUCT_STATUS.fullyE2EMeasuredSurface).toBe(false);
    expect(HYBRID_COMPILER_PRODUCT_STATUS.liveAptAtomicSupported).toBe(false);
    expect(
      HYBRID_COMPILER_PRODUCT_STATUS.multiAgentOffensiveSwarmSupported
    ).toBe(false);
    expect(HYBRID_COMPILER_PRODUCT_STATUS.status).toBe("Partial");
  });

  it("allowlists only runner measured module ids", () => {
    expect(isHybridCompilerPassiveModuleId("periscan.dns_resolution_check")).toBe(
      true
    );
    expect(isHybridCompilerPassiveModuleId("exploit.metasploit_check")).toBe(
      false
    );
    expect(isHybridCompilerPassiveModuleId("atomic.control_validation_safe")).toBe(
      false
    );
  });

  it("selects passive modules from intent tokens", () => {
    const modules = selectPassiveModulesForIntent("validate dns and tls posture", 3);
    expect(modules).toContain("periscan.dns_resolution_check");
    expect(modules.some((id) => id.startsWith("periscan.tls_"))).toBe(true);
    expect(modules).not.toContain("periscan.endpoint_benign_marker_emit");
  });

  it("includes endpoint canary only when intent asks", () => {
    const withCanary = selectPassiveModulesForIntent(
      "endpoint marker canary emit",
      6
    );
    expect(withCanary).toContain("periscan.endpoint_benign_marker_emit");
  });

  it("assembles passive multi-agent plan with policy preview (not BAS swarm)", () => {
    const assembled = assemblePassiveMultiAgentPlan({
      intent: "dns tls http exposure proof",
      maximumSteps: 4,
      missionId: "33333333-3333-4333-8333-333333333333",
      moduleMeta: META,
      scopeId: "11111111-1111-4111-8111-111111111111",
      targetHost: "internal.example.com"
    });
    expect(assembled.honesty.multiAgentOffensiveSwarmSupported).toBe(false);
    expect(assembled.honesty.draftMissionsOnly).toBe(true);
    expect(assembled.honesty.claimLanguage).toBe(
      "passive_role_assembly_not_bas_swarm"
    );
    expect(assembled.missionId).toBe("33333333-3333-4333-8333-333333333333");
    expect(assembled.missionStatus).toBe("Draft");
    expect(assembled.missionPlan.steps.length).toBeGreaterThan(0);
    expect(assembled.missionPlan.steps[0]?.agentRole).toBeTruthy();
    expect(assembled.policyPreview.requestedAction.destructive).toBe(false);
    expect(assembled.policyPreview.executionEnvironment).toBe("InternalRunner");
  });

  it("builds conversational mission draft that is never executable BAS", () => {
    const draft = buildConversationalMissionDraft({
      createdAt: "2026-08-01T00:00:00.000Z",
      draftId: "22222222-2222-4222-8222-222222222222",
      intent: "AEV proof plan with measured DNS",
      moduleIds: ["periscan.dns_resolution_check"],
      moduleMeta: META,
      source: "AevProofPlanPreset",
      title: "AEV proof draft"
    });
    expect(draft.executable).toBe(false);
    expect(draft.honesty.claimLanguage).toBe("mission_draft_not_executable_bas");
    expect(draft.nextSteps.some((step) => /Hybrid Execution Compiler/i.test(step))).toBe(
      true
    );
  });

  it("converts conversational draft to hybrid compile input without making BAS executable", () => {
    const draft = buildConversationalMissionDraft({
      createdAt: "2026-08-01T00:00:00.000Z",
      draftId: "22222222-2222-4222-8222-222222222222",
      intent: "AEV proof plan with measured DNS",
      moduleIds: [
        "periscan.dns_resolution_check",
        "atomic.control_validation_safe"
      ],
      moduleMeta: META,
      scopeId: "11111111-1111-4111-8111-111111111111",
      source: "AevProofPlanPreset",
      targetHost: "host.internal.example.com",
      title: "AEV proof draft"
    });
    const converted = missionDraftToHybridCompileInput(draft, {
      queueTasks: false,
      runnerId: "44444444-4444-4444-8444-444444444444"
    });
    expect(converted.draftExecutable).toBe(false);
    expect(converted.honesty.basExecutableFromDraft).toBe(false);
    expect(converted.compileInput.moduleIds).toEqual([
      "periscan.dns_resolution_check"
    ]);
    expect(converted.compileInput.queueTasks).toBe(false);
    expect(converted.compileInput.scopeId).toBe(draft.scopeId);
    expect(converted.compileInput.targetHost).toBe(draft.targetHost);
    expect(converted.rejectedModuleIds).toContain(
      "atomic.control_validation_safe"
    );
  });

  it("requires scope and target when converting drafts without bindings", () => {
    const draft = buildConversationalMissionDraft({
      createdAt: "2026-08-01T00:00:00.000Z",
      draftId: "22222222-2222-4222-8222-222222222222",
      intent: "dns",
      moduleIds: ["periscan.dns_resolution_check"],
      moduleMeta: META,
      source: "FreeformIntent"
    });
    expect(() =>
      missionDraftToHybridCompileInput(draft, {
        runnerId: "44444444-4444-4444-8444-444444444444"
      })
    ).toThrow(/scopeId is required/i);
  });
});
