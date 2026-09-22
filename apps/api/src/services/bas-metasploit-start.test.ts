import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  getAllowlistedMetasploitCheck,
  getModuleById,
  listAllowlistedMetasploitChecks
} from "@periscan/modules";
import {
  METASPLOIT_FRAMEWORK_VERSION_PIN,
  resolveBasScenarioStart
} from "@periscan/shared";

import {
  QualifiedMetasploitStartResultSchema,
  evaluateMetasploitQualifiedStart,
  startQualifiedMetasploitCheck
} from "./bas-metasploit-start.js";

const HELPER_SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "bas-metasploit-start.ts"
);

const SCOPE_ID = "11111111-1111-4111-8111-111111111111";
const LAB_HOST = "10.0.0.5";

function presencePin(overrides: Record<string, unknown> = {}) {
  return {
    checkId: "msf.http_version",
    fixtureMode: true,
    frameworkVersion: METASPLOIT_FRAMEWORK_VERSION_PIN,
    options: { RPORT: 80 },
    startable: true,
    targetHost: LAB_HOST,
    ...overrides
  };
}

describe("qualified Metasploit check start (allowlisted check only)", () => {
  it("keeps liveSupported false on the global module, allowlist, and start helper", () => {
    const module = getModuleById("exploit.metasploit_check");
    expect(module?.manifest.liveSupported).toBe(false);
    expect(
      listAllowlistedMetasploitChecks().every(
        (entry) => entry.liveSupported === false
      )
    ).toBe(true);

    const gate = evaluateMetasploitQualifiedStart(
      presencePin({ startable: true })
    );
    expect(gate.liveSupported).toBe(false);
    expect(gate.jobsQueued).toBe(0);
  });

  it("startable false never queues and does not execute a check plan", async () => {
    const result = await startQualifiedMetasploitCheck(
      presencePin({ startable: false })
    );
    const parsed = QualifiedMetasploitStartResultSchema.parse(result);

    expect(parsed.startable).toBe(false);
    expect(parsed.executed).toBe(false);
    expect(parsed.jobsQueued).toBe(0);
    expect(parsed.queued).toBe(false);
    expect(parsed.accepted).toBe(false);
    expect(parsed.moduleOutput).toBeNull();
    expect(parsed.liveSupported).toBe(false);
    expect(parsed.measuredExploitability).toBe(false);
  });

  it("startable + allowlisted http_version executes a fixture/lab check, not exploitability", async () => {
    const httpVersion = getAllowlistedMetasploitCheck("msf.http_version");
    expect(httpVersion).toMatchObject({
      claimKind: "vulnerability_presence",
      liveSupported: false,
      moduleFullname: "auxiliary/scanner/http/http_version"
    });

    const result = await startQualifiedMetasploitCheck(presencePin());
    const parsed = QualifiedMetasploitStartResultSchema.parse(result);

    expect(parsed.startable).toBe(true);
    expect(parsed.accepted).toBe(true);
    expect(parsed.executed).toBe(true);
    expect(parsed.jobsQueued).toBe(0);
    expect(parsed.queued).toBe(false);
    expect(parsed.liveSupported).toBe(false);
    expect(parsed.claimKind).toBe("vulnerability_presence");
    expect(parsed.claimKind).not.toBe("measured_exploitability");
    expect(parsed.measuredExploitability).toBe(false);
    expect(parsed.checkMethodIsSafetyGuarantee).toBe(false);
    expect(parsed.outcome).toBe("fixture_vulnerability_presence");
    expect(parsed.moduleOutput?.validationState).toBe("Inconclusive");
    expect(parsed.moduleOutput?.signals).toHaveLength(0);
    expect(parsed.moduleOutput?.evidence[0]?.attributes).toMatchObject({
      claimKind: "vulnerability_presence",
      checkId: "msf.http_version",
      measuredExploitability: false,
      typedOptions: { RHOSTS: LAB_HOST, RPORT: 80 }
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /Exploitable|ConfirmedExploitable|measured_exploitability/
    );
  });

  it("startable + ftp_version executes presence when that check is allowlisted", async () => {
    const ftpVersion = getAllowlistedMetasploitCheck("msf.ftp_version");
    if (!ftpVersion) {
      expect(ftpVersion).toBeNull();
      return;
    }

    const result = await startQualifiedMetasploitCheck({
      checkId: "msf.ftp_version",
      fixtureMode: true,
      options: { RPORT: 21 },
      startable: true,
      targetHost: LAB_HOST
    });
    expect(result).toMatchObject({
      accepted: true,
      claimKind: "vulnerability_presence",
      executed: true,
      jobsQueued: 0,
      liveSupported: false,
      measuredExploitability: false,
      moduleFullname: "auxiliary/scanner/ftp/ftp_version",
      outcome: "fixture_vulnerability_presence",
      startable: true
    });
  });

  it("check() support is never measured exploitability from check() alone", async () => {
    const result = await startQualifiedMetasploitCheck({
      fixtureMode: true,
      moduleName: "exploit/windows/smb/ms17_010_eternalblue",
      startable: true,
      targetHost: LAB_HOST
    });

    expect(result.startable).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.claimKind).toBe("check_supported");
    expect(result.claimKind).not.toBe("measured_exploitability");
    expect(result.measuredExploitability).toBe(false);
    expect(result.checkMethodIsSafetyGuarantee).toBe(false);
    expect(result.outcome).toBe("fixture_check_supported");
    expect(result.jobsQueued).toBe(0);
    expect(result.moduleOutput?.evidence[0]?.attributes).toMatchObject({
      claimKind: "check_supported",
      hasCheckMethod: true,
      measuredExploitability: false
    });
  });

  it("denies extra THREADS, unrestricted console, PAYLOAD, and exploit action without queuing", async () => {
    const threads = await startQualifiedMetasploitCheck(
      presencePin({ options: { RPORT: 80, THREADS: 4 } })
    );
    expect(threads).toMatchObject({
      accepted: false,
      code: "untyped_option_denied",
      executed: false,
      jobsQueued: 0,
      queued: false,
      startable: false
    });

    const consoleDenied = await startQualifiedMetasploitCheck(
      presencePin({ consoleCommand: "msfconsole -q" })
    );
    expect(consoleDenied).toMatchObject({
      accepted: false,
      code: "unrestricted_console_denied",
      executed: false,
      jobsQueued: 0,
      startable: false
    });

    const payload = await startQualifiedMetasploitCheck(
      presencePin({
        options: { PAYLOAD: "windows/meterpreter/reverse_tcp" }
      })
    );
    expect(payload).toMatchObject({
      accepted: false,
      code: "arbitrary_payload_denied",
      executed: false,
      jobsQueued: 0,
      startable: false
    });

    const exploit = await startQualifiedMetasploitCheck(
      presencePin({ action: "exploit" })
    );
    expect(exploit).toMatchObject({
      accepted: false,
      code: "exploit_action_denied",
      executed: false,
      jobsQueued: 0,
      startable: false
    });
  });

  it("live pack and live dry-run starts stay not startable with jobsQueued 0", async () => {
    const resolved = resolveBasScenarioStart({
      scenarioId: "metasploit.live",
      scopeId: SCOPE_ID
    });
    expect(resolved.queueable).toBe(false);

    const livePack = await startQualifiedMetasploitCheck({
      scenarioId: "metasploit.live",
      scopeId: SCOPE_ID,
      startable: true,
      targetHost: LAB_HOST
    });
    expect(livePack).toMatchObject({
      executed: false,
      jobsQueued: 0,
      liveSupported: false,
      queued: false,
      startable: false
    });
    expect(livePack.denyReason?.toLowerCase()).toMatch(/never queued/);

    const liveRun = await startQualifiedMetasploitCheck(
      presencePin({ dryRun: false, fixtureMode: false })
    );
    expect(liveRun).toMatchObject({
      accepted: false,
      code: "live_execution_disabled",
      executed: false,
      jobsQueued: 0,
      startable: false
    });
  });

  it("refuses measured_exploitability as a start claim", async () => {
    const result = await startQualifiedMetasploitCheck(
      presencePin({ claimKind: "measured_exploitability" })
    );
    expect(result).toMatchObject({
      accepted: false,
      code: "measured_exploitability_unsupported",
      executed: false,
      jobsQueued: 0,
      measuredExploitability: false,
      startable: false
    });
  });

  it("helper source never enables live offensive, console, or payload generation", async () => {
    const source = await readFile(HELPER_SOURCE_PATH, "utf8");
    expect(source).not.toMatch(/child_process|msfconsole|msfvenom|spawn\(/);
    expect(source).not.toContain("PERISCAN_LIVE_OFFENSIVE");
    expect(source).not.toContain("app.ts");
  });

  it("denied start results cannot claim a queued job", () => {
    expect(() =>
      QualifiedMetasploitStartResultSchema.parse({
        accepted: false,
        checkId: "msf.http_version",
        checkMethodIsSafetyGuarantee: false,
        claimKind: "vulnerability_presence",
        code: "start_gate_denied",
        denyReason: "not startable",
        executed: false,
        jobsQueued: 1,
        liveSupported: false,
        measuredExploitability: false,
        moduleFullname: "auxiliary/scanner/http/http_version",
        moduleOutput: null,
        outcome: null,
        queued: true,
        rationale: "not startable",
        startable: false,
        typedOptions: {},
        validationState: null
      })
    ).toThrow();
  });
});
