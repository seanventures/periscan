import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  METASPLOIT_FRAMEWORK_VERSION_PIN,
  resolveBasScenarioStart,
  StartBasScenarioResultSchema
} from "@periscan/shared";

import {
  evaluateModuleStartConstraints,
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "./index.js";
import {
  compileAllowlistedMetasploitCheck,
  getAllowlistedMetasploitCheck,
  listAllowlistedMetasploitChecks
} from "./metasploit-check-adapter.js";

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/metasploit/allowlisted-checks.json"
);
const ADAPTER_SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "metasploit-check-adapter.ts"
);
const SCOPE_ID = "11111111-1111-4111-8111-111111111111";

function createContext(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: randomUUID(),
    safetyLevel: "AdvancedAdversarial",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

describe("reviewed Metasploit check allowlist (PERISCAN-589)", () => {
  it("loads fixture allowlist rows with exact pins, typed options, and no console/payload", async () => {
    const raw = JSON.parse(await readFile(FIXTURE_PATH, "utf8")) as unknown;
    const items = listAllowlistedMetasploitChecks();

    expect(Array.isArray(raw)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items.map((item) => item.moduleFullname)).toEqual(
      expect.arrayContaining([
        "auxiliary/scanner/smb/smb_version",
        "auxiliary/scanner/ssh/ssh_version",
        "auxiliary/scanner/smb/smb_ms17_010",
        "exploit/windows/smb/ms17_010_eternalblue",
        "auxiliary/scanner/http/http_version"
      ])
    );

    for (const item of items) {
      expect(item.frameworkVersionPin).toBe(METASPLOIT_FRAMEWORK_VERSION_PIN);
      expect(item.liveSupported).toBe(false);
      expect(item.consoleAllowed).toBe(false);
      expect(item.payloadInputAllowed).toBe(false);
      expect(item.checkIsNotSafetyGuarantee).toBe(true);
      expect(item.executionMode).toBe("fixture");
      expect(item.sideEffects.payloadDelivery).toBe(false);
      expect(item.sideEffects.sessionOpen).toBe(false);
      expect(item.sideEffects.dataExfiltration).toBe(false);
      expect(item.typedOptions.some((option) => option.name === "RHOSTS")).toBe(
        true
      );
    }
  });

  it("wave 2 allowlists HTTP version as a non-destructive presence probe", () => {
    const httpVersion = getAllowlistedMetasploitCheck("msf.http_version");
    expect(httpVersion).toMatchObject({
      checkCertifiedNonDestructive: true,
      checkId: "msf.http_version",
      checkIsNotSafetyGuarantee: true,
      claimKind: "vulnerability_presence",
      consoleAllowed: false,
      executionMode: "fixture",
      frameworkVersionPin: METASPLOIT_FRAMEWORK_VERSION_PIN,
      hasCheckMethod: false,
      liveExecutionDisabled: true,
      liveSupported: false,
      moduleFullname: "auxiliary/scanner/http/http_version",
      payloadInputAllowed: false,
      techniqueId: "T1046"
    });
    expect(httpVersion?.typedOptions).toEqual([
      { name: "RHOSTS", required: true, type: "hostname" },
      { defaultValue: 80, name: "RPORT", required: false, type: "port" }
    ]);
    expect(httpVersion?.sideEffects).toMatchObject({
      crashRisk: "none",
      dataExfiltration: false,
      networkProbe: true,
      payloadDelivery: false,
      sessionOpen: false,
      stateMutation: false
    });
    expect(httpVersion?.claimKind).not.toBe("measured_exploitability");
  });

  it("includes a check() module that is still not safety-certified", () => {
    const eternalblue = getAllowlistedMetasploitCheck(
      "exploit/windows/smb/ms17_010_eternalblue"
    );
    expect(eternalblue).toMatchObject({
      checkCertifiedNonDestructive: false,
      hasCheckMethod: true,
      liveSupported: false,
      claimKind: "check_supported"
    });
    const presence = getAllowlistedMetasploitCheck("msf.smb_version");
    expect(presence).toMatchObject({
      checkCertifiedNonDestructive: true,
      hasCheckMethod: false,
      claimKind: "vulnerability_presence"
    });
  });

  it("adapter source never imports a console, payload generator, or live-offensive env", async () => {
    const source = await readFile(ADAPTER_SOURCE_PATH, "utf8");
    expect(source).not.toMatch(/child_process|msfconsole|msfvenom|spawn\(/);
    expect(source).not.toContain("PERISCAN_LIVE_OFFENSIVE");
  });

  it("keeps exploit.metasploit_check liveSupported false and start-denied", () => {
    const module = getModuleById("exploit.metasploit_check");
    expect(module?.manifest.liveSupported).toBe(false);

    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [module!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedDestructive: true,
          authorizedOffensive: true,
          dryRun: false,
          scopeVerified: true
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "exploit_metasploit_check_live_permanently_disabled"
    });
  });

  it("startBasScenario resolution still denies metasploit.live and never queues", () => {
    const resolved = resolveBasScenarioStart({
      scenarioId: "metasploit.live",
      scopeId: SCOPE_ID
    });
    expect(resolved.queueable).toBe(false);
    expect(resolved.livePack).toBe("metasploit");
    expect(resolved.denyReason?.toLowerCase()).toMatch(/never queued/);

    expect(() =>
      StartBasScenarioResultSchema.parse({
        claimClass: "qualification_required",
        denyReason: resolved.denyReason,
        jobsQueued: 1,
        mission: null,
        outcome: "Denied",
        policyDecisionId: SCOPE_ID,
        queued: true,
        rationale: resolved.denyReason,
        runs: [],
        scenarioId: "metasploit.live"
      })
    ).toThrow();
  });

  it("compiles fixture presence without claiming measured exploitability", () => {
    const compiled = compileAllowlistedMetasploitCheck({
      fixtureMode: true,
      moduleName: "auxiliary/scanner/smb/smb_version",
      targetHost: "10.0.0.5"
    });
    expect(compiled).toMatchObject({
      accepted: true,
      claimKind: "vulnerability_presence",
      code: "accepted_fixture",
      jobsQueued: 0,
      liveSupported: false,
      measuredExploitability: false,
      queueable: false
    });
  });

  it("compiles wave-2 HTTP version with typed RPORT 80 and never queues live", () => {
    const compiled = compileAllowlistedMetasploitCheck({
      fixtureMode: true,
      frameworkVersion: METASPLOIT_FRAMEWORK_VERSION_PIN,
      moduleName: "auxiliary/scanner/http/http_version",
      options: { RPORT: 80 },
      targetHost: "10.0.0.5"
    });
    expect(compiled).toMatchObject({
      accepted: true,
      checkCertifiedNonDestructive: true,
      checkId: "msf.http_version",
      checkMethodIsSafetyGuarantee: false,
      claimKind: "vulnerability_presence",
      code: "accepted_fixture",
      jobsQueued: 0,
      liveSupported: false,
      measuredExploitability: false,
      moduleFullname: "auxiliary/scanner/http/http_version",
      queueable: false,
      typedOptions: { RHOSTS: "10.0.0.5", RPORT: 80 }
    });

    const extraOption = compileAllowlistedMetasploitCheck({
      fixtureMode: true,
      moduleName: "auxiliary/scanner/http/http_version",
      options: { THREADS: 4 },
      targetHost: "10.0.0.5"
    });
    expect(extraOption).toMatchObject({
      accepted: false,
      code: "untyped_option_denied",
      jobsQueued: 0,
      queueable: false
    });

    const live = compileAllowlistedMetasploitCheck({
      dryRun: false,
      moduleName: "auxiliary/scanner/http/http_version",
      targetHost: "10.0.0.5"
    });
    expect(live).toMatchObject({
      accepted: false,
      code: "live_execution_disabled",
      jobsQueued: 0,
      liveSupported: false,
      measuredExploitability: false,
      queueable: false
    });
  });

  it("module execute distinguishes presence vs check support vs disabled live", async () => {
    const presence = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          moduleName: "auxiliary/scanner/smb/smb_version",
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(presence.outcome).toBe("fixture_vulnerability_presence");
    expect(presence.validationState).toBe("Inconclusive");
    expect(presence.signals).toHaveLength(0);
    expect(presence.evidence[0]?.attributes).toMatchObject({
      claimKind: "vulnerability_presence",
      checkMethodIsSafetyGuarantee: false,
      fixture: true,
      measured: false,
      measuredExploitability: false
    });

    const checkSupported = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          moduleName: "exploit/windows/smb/ms17_010_eternalblue",
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(checkSupported.outcome).toBe("fixture_check_supported");
    expect(checkSupported.validationState).toBe("Inconclusive");
    expect(checkSupported.signals).toHaveLength(0);
    expect(checkSupported.evidence[0]?.attributes).toMatchObject({
      claimKind: "check_supported",
      hasCheckMethod: true,
      checkCertifiedNonDestructive: false,
      checkMethodIsSafetyGuarantee: false,
      measuredExploitability: false
    });

    const live = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          dryRun: false,
          moduleName: "auxiliary/scanner/smb/smb_ms17_010",
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(live.outcome).toBe("metasploit_live_execution_disabled");
    expect(live.signals).toHaveLength(0);

    const httpPresence = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          fixtureMode: true,
          fixtureVulnerable: true,
          moduleName: "auxiliary/scanner/http/http_version",
          options: { RPORT: 80 },
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(httpPresence.outcome).toBe("fixture_vulnerability_presence");
    expect(httpPresence.validationState).toBe("Inconclusive");
    expect(httpPresence.signals).toHaveLength(0);
    expect(httpPresence.evidence[0]?.attributes).toMatchObject({
      claimKind: "vulnerability_presence",
      checkCertifiedNonDestructive: true,
      checkId: "msf.http_version",
      checkMethodIsSafetyGuarantee: false,
      fixture: true,
      measured: false,
      measuredExploitability: false,
      typedOptions: { RHOSTS: "10.0.0.5", RPORT: 80 }
    });
    expect(JSON.stringify(httpPresence)).not.toMatch(
      /Exploitable|ConfirmedExploitable|measured_exploitability/
    );
  });

  it("module execute denies console, payload, and unlisted modules without running a tool", async () => {
    const consoleDenied = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          consoleCommand: "msfconsole -q",
          fixtureMode: true,
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(consoleDenied.outcome).toBe(
      "metasploit_unrestricted_console_denied"
    );
    expect(consoleDenied.validationState).toBe("Inconclusive");

    const payloadDenied = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          fixtureMode: true,
          moduleName: "auxiliary/scanner/smb/smb_version",
          options: { PAYLOAD: "windows/meterpreter/reverse_tcp" },
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(payloadDenied.outcome).toBe("metasploit_arbitrary_payload_denied");

    const unsupported = await executeModuleById(
      "exploit.metasploit_check",
      createContext({
        target: {
          fixtureMode: true,
          moduleName: "exploit/multi/handler",
          targetHost: "10.0.0.5"
        }
      })
    );
    expect(unsupported.outcome).toBe("metasploit_check_unsupported");
  });
});
