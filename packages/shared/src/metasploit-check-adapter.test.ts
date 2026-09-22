import { describe, expect, it } from "vitest";

import {
  METASPLOIT_FORBIDDEN_OPTION_NAMES,
  METASPLOIT_FRAMEWORK_VERSION_PIN,
  MetasploitCheckAllowlistEntrySchema,
  MetasploitCheckCompileResultSchema,
  MetasploitFrameworkVersionPinSchema,
  classifyMetasploitCheckClaim,
  compileMetasploitCheckRequest,
  isArbitraryMetasploitPayloadInput,
  isUnrestrictedMetasploitConsoleRequest,
  type MetasploitCheckAllowlistEntry
} from "./metasploit-check-adapter.js";

const presenceCheck: MetasploitCheckAllowlistEntry =
  MetasploitCheckAllowlistEntrySchema.parse({
    checkCertifiedNonDestructive: true,
    checkId: "msf.smb_version",
    checkIsNotSafetyGuarantee: true,
    claimKind: "vulnerability_presence",
    consoleAllowed: false,
    displayName: "SMB version probe",
    executionMode: "fixture",
    frameworkVersionPin: METASPLOIT_FRAMEWORK_VERSION_PIN,
    hasCheckMethod: false,
    liveExecutionDisabled: true,
    liveSupported: false,
    moduleFullname: "auxiliary/scanner/smb/smb_version",
    moduleId: "exploit.metasploit_check",
    payloadInputAllowed: false,
    sideEffects: {
      crashRisk: "none",
      dataExfiltration: false,
      networkProbe: true,
      notes: "SMB negotiate fingerprint only.",
      payloadDelivery: false,
      sessionOpen: false,
      stateMutation: false
    },
    spdxLicenseId: "BSD-3-Clause",
    techniqueId: "T1046",
    typedOptions: [
      { name: "RHOSTS", required: true, type: "hostname" },
      { defaultValue: 445, name: "RPORT", required: false, type: "port" }
    ]
  });

const checkMethodModule: MetasploitCheckAllowlistEntry =
  MetasploitCheckAllowlistEntrySchema.parse({
    checkCertifiedNonDestructive: false,
    checkId: "msf.ms17_010_eternalblue_check",
    checkIsNotSafetyGuarantee: true,
    claimKind: "check_supported",
    consoleAllowed: false,
    displayName: "MS17-010 EternalBlue check() review",
    executionMode: "fixture",
    frameworkVersionPin: METASPLOIT_FRAMEWORK_VERSION_PIN,
    hasCheckMethod: true,
    liveExecutionDisabled: true,
    liveSupported: false,
    moduleFullname: "exploit/windows/smb/ms17_010_eternalblue",
    moduleId: "exploit.metasploit_check",
    payloadInputAllowed: false,
    sideEffects: {
      crashRisk: "possible",
      dataExfiltration: false,
      networkProbe: true,
      notes: "check() exists but is not a safety guarantee.",
      payloadDelivery: false,
      sessionOpen: false,
      stateMutation: false
    },
    spdxLicenseId: "BSD-3-Clause",
    techniqueId: "T1210",
    typedOptions: [
      { name: "RHOSTS", required: true, type: "hostname" },
      { defaultValue: 445, name: "RPORT", required: false, type: "port" }
    ]
  });

const allowlist = [presenceCheck, checkMethodModule];

describe("Metasploit check adapter contracts (PERISCAN-589)", () => {
  it("requires an exact x.y.z framework pin and rejects ranges", () => {
    expect(MetasploitFrameworkVersionPinSchema.parse("6.4.0")).toBe("6.4.0");
    expect(METASPLOIT_FRAMEWORK_VERSION_PIN).toBe("6.4.0");
    for (const pin of ["6.4", ">=6.4.0", "latest", "6.4.0-dev", "*"]) {
      expect(MetasploitFrameworkVersionPinSchema.safeParse(pin).success).toBe(
        false
      );
    }
  });

  it("rejects unrestricted console and arbitrary payload input", () => {
    expect(
      isUnrestrictedMetasploitConsoleRequest({
        consoleCommand: "msfconsole -q -x use exploit/multi/handler"
      })
    ).toBe(true);
    expect(
      isUnrestrictedMetasploitConsoleRequest({
        msfconsoleArgs: ["-r", "attack.rc"]
      })
    ).toBe(true);
    expect(
      isArbitraryMetasploitPayloadInput({
        options: { PAYLOAD: "windows/x64/meterpreter/reverse_tcp" }
      })
    ).toBe(true);
    expect(
      isArbitraryMetasploitPayloadInput({
        LHOST: "10.0.0.1",
        LPORT: 4444
      })
    ).toBe(true);
    expect(
      METASPLOIT_FORBIDDEN_OPTION_NAMES.map((name) => name.toUpperCase())
    ).toEqual(expect.arrayContaining(["PAYLOAD", "LHOST", "LPORT"]));
  });

  it("does not treat a check() method as a safety guarantee or measured exploitability", () => {
    const classified = classifyMetasploitCheckClaim({
      checkCertifiedNonDestructive: false,
      hasCheckMethod: true,
      measuredReceipt: true
    });
    expect(classified.checkMethodIsSafetyGuarantee).toBe(false);
    expect(classified.measuredExploitability).toBe(false);
    expect(classified.claimKind).toBe("check_supported");
    expect(classified.claimKind).not.toBe("measured_exploitability");
  });

  it("classifies certified probes as vulnerability presence, not exploitability", () => {
    expect(
      classifyMetasploitCheckClaim({
        checkCertifiedNonDestructive: true,
        hasCheckMethod: false
      }).claimKind
    ).toBe("vulnerability_presence");
  });

  it("compiles an allowlisted presence check with typed options only", () => {
    const compiled = compileMetasploitCheckRequest(
      {
        fixtureMode: true,
        moduleName: "auxiliary/scanner/smb/smb_version",
        options: { RPORT: 445 },
        targetHost: "10.0.0.5"
      },
      allowlist
    );
    const parsed = MetasploitCheckCompileResultSchema.parse(compiled);
    expect(parsed).toMatchObject({
      accepted: true,
      claimKind: "vulnerability_presence",
      code: "accepted_fixture",
      jobsQueued: 0,
      liveSupported: false,
      measuredExploitability: false,
      queueable: false,
      typedOptions: { RHOSTS: "10.0.0.5", RPORT: 445 }
    });
  });

  it("denies unrestricted console, payloads, unknown modules, and version ranges", () => {
    expect(
      compileMetasploitCheckRequest(
        { consoleCommand: "msfconsole", targetHost: "10.0.0.5" },
        allowlist
      ).code
    ).toBe("unrestricted_console_denied");
    expect(
      compileMetasploitCheckRequest(
        {
          moduleName: "auxiliary/scanner/smb/smb_version",
          options: { PAYLOAD: "windows/meterpreter/reverse_tcp" },
          targetHost: "10.0.0.5"
        },
        allowlist
      ).code
    ).toBe("arbitrary_payload_denied");
    expect(
      compileMetasploitCheckRequest(
        {
          moduleName: "exploit/multi/handler",
          targetHost: "10.0.0.5"
        },
        allowlist
      ).code
    ).toBe("module_not_allowlisted");
    expect(
      compileMetasploitCheckRequest(
        {
          frameworkVersion: ">=6.4.0",
          moduleName: "auxiliary/scanner/smb/smb_version",
          targetHost: "10.0.0.5"
        },
        allowlist
      ).code
    ).toBe("version_pin_mismatch");
    expect(
      compileMetasploitCheckRequest(
        {
          moduleName: "auxiliary/scanner/smb/smb_version",
          options: { VERBOSE: true },
          targetHost: "10.0.0.5"
        },
        allowlist
      ).code
    ).toBe("untyped_option_denied");
  });

  it("never queues live Metasploit and never returns measured exploitability", () => {
    const live = compileMetasploitCheckRequest(
      {
        dryRun: false,
        moduleName: "exploit/windows/smb/ms17_010_eternalblue",
        targetHost: "10.0.0.5"
      },
      allowlist
    );
    expect(live).toMatchObject({
      accepted: false,
      checkMethodIsSafetyGuarantee: false,
      code: "live_execution_disabled",
      jobsQueued: 0,
      liveSupported: false,
      measuredExploitability: false,
      queueable: false
    });
    expect(
      compileMetasploitCheckRequest(
        { claimKind: "measured_exploitability", targetHost: "10.0.0.5" },
        allowlist
      ).code
    ).toBe("measured_exploitability_unsupported");
  });

  it("rejects CIDR/list hosts and allowlist rows that enable console or payloads", () => {
    expect(
      compileMetasploitCheckRequest(
        {
          moduleName: "auxiliary/scanner/smb/smb_version",
          targetHost: "10.0.0.0/8"
        },
        allowlist
      ).code
    ).toBe("invalid_typed_option");

    expect(
      MetasploitCheckAllowlistEntrySchema.safeParse({
        ...presenceCheck,
        consoleAllowed: true
      }).success
    ).toBe(false);
    expect(
      MetasploitCheckAllowlistEntrySchema.safeParse({
        ...presenceCheck,
        liveSupported: true
      }).success
    ).toBe(false);
    expect(
      MetasploitCheckAllowlistEntrySchema.safeParse({
        ...presenceCheck,
        typedOptions: [{ name: "PAYLOAD", required: true, type: "hostname" }]
      }).success
    ).toBe(false);
  });
});
