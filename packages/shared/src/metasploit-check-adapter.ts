import { z } from "zod";

/**
 * PERISCAN-589 Metasploit non-destructive check adapter contracts.
 *
 * A method named `check` is not a safety guarantee. Allowlisted rows record
 * reviewed side effects, typed options and an exact framework pin. This
 * compiler never authorizes unrestricted console, arbitrary payloads, or
 * measured exploitability.
 */

export const METASPLOIT_FRAMEWORK_VERSION_PIN = "6.4.0" as const;
export const METASPLOIT_CHECK_MODULE_ID = "exploit.metasploit_check" as const;

export const MetasploitFrameworkVersionPinSchema = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+$/,
    "Metasploit framework pins must be an exact x.y.z version"
  );

export const MetasploitCheckClaimKindSchema = z.enum([
  "vulnerability_presence",
  "check_supported",
  "measured_exploitability"
]);
export type MetasploitCheckClaimKind = z.infer<
  typeof MetasploitCheckClaimKindSchema
>;

export const MetasploitCheckAllowlistClaimKindSchema = z.enum([
  "vulnerability_presence",
  "check_supported"
]);

export const MetasploitCheckCrashRiskSchema = z.enum([
  "none",
  "possible",
  "likely"
]);

export const MetasploitCheckOptionTypeSchema = z.enum([
  "hostname",
  "port",
  "boolean"
]);

export const METASPLOIT_FORBIDDEN_OPTION_NAMES = [
  "PAYLOAD",
  "payload",
  "Encoder",
  "encoder",
  "LHOST",
  "LPORT",
  "DisablePayloadHandler",
  "AutoRunScript",
  "CMD",
  "EXE",
  "PrependMigrate",
  "ReverseListenerBindAddress"
] as const;

const forbiddenOptionNameSet = new Set<string>(
  METASPLOIT_FORBIDDEN_OPTION_NAMES.map((name) => name.toLowerCase())
);

export const MetasploitCheckTypedOptionSchema = z
  .object({
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    name: z
      .string()
      .min(1)
      .regex(/^[A-Z][A-Z0-9_]*$/),
    required: z.boolean(),
    type: MetasploitCheckOptionTypeSchema
  })
  .refine((option) => !forbiddenOptionNameSet.has(option.name.toLowerCase()), {
    message: "Allowlisted Metasploit checks cannot type payload/console options"
  });
export type MetasploitCheckTypedOption = z.infer<
  typeof MetasploitCheckTypedOptionSchema
>;

export const MetasploitCheckSideEffectsSchema = z.object({
  crashRisk: MetasploitCheckCrashRiskSchema,
  dataExfiltration: z.literal(false),
  networkProbe: z.boolean(),
  notes: z.string().min(1),
  payloadDelivery: z.literal(false),
  sessionOpen: z.literal(false),
  stateMutation: z.boolean()
});
export type MetasploitCheckSideEffects = z.infer<
  typeof MetasploitCheckSideEffectsSchema
>;

export const MetasploitModuleFullnameSchema = z
  .string()
  .min(1)
  .regex(/^(auxiliary|exploit)\/[a-z0-9]+(?:\/[a-z0-9_]+)+$/);

export const MetasploitCheckAllowlistEntrySchema = z
  .object({
    checkCertifiedNonDestructive: z.boolean(),
    checkId: z.string().regex(/^msf\.[a-z0-9_]+$/),
    checkIsNotSafetyGuarantee: z.literal(true),
    claimKind: MetasploitCheckAllowlistClaimKindSchema,
    consoleAllowed: z.literal(false),
    displayName: z.string().min(1),
    executionMode: z.literal("fixture"),
    frameworkVersionPin: MetasploitFrameworkVersionPinSchema,
    hasCheckMethod: z.boolean(),
    liveExecutionDisabled: z.literal(true),
    liveSupported: z.literal(false),
    moduleFullname: MetasploitModuleFullnameSchema,
    moduleId: z.literal(METASPLOIT_CHECK_MODULE_ID),
    payloadInputAllowed: z.literal(false),
    sideEffects: MetasploitCheckSideEffectsSchema,
    spdxLicenseId: z.literal("BSD-3-Clause"),
    techniqueId: z.string().regex(/^T\d{4}(?:\.\d{3})?$/),
    typedOptions: z.array(MetasploitCheckTypedOptionSchema).min(1)
  })
  .refine(
    (entry) => entry.frameworkVersionPin === METASPLOIT_FRAMEWORK_VERSION_PIN,
    {
      message: "Allowlist rows must use the reviewed exact framework pin"
    }
  )
  .refine(
    (entry) =>
      !entry.checkCertifiedNonDestructive ||
      (entry.sideEffects.crashRisk === "none" &&
        entry.sideEffects.stateMutation === false),
    {
      message:
        "Non-destructive certification requires no crash risk and no state mutation"
    }
  );
export type MetasploitCheckAllowlistEntry = z.infer<
  typeof MetasploitCheckAllowlistEntrySchema
>;

export const MetasploitCheckCompileCodeSchema = z.enum([
  "accepted_plan",
  "accepted_fixture",
  "unrestricted_console_denied",
  "arbitrary_payload_denied",
  "module_not_allowlisted",
  "untyped_option_denied",
  "invalid_typed_option",
  "version_pin_mismatch",
  "measured_exploitability_unsupported",
  "live_execution_disabled"
]);
export type MetasploitCheckCompileCode = z.infer<
  typeof MetasploitCheckCompileCodeSchema
>;

export const MetasploitCheckCompileResultSchema = z
  .object({
    accepted: z.boolean(),
    checkCertifiedNonDestructive: z.boolean().nullable(),
    checkId: z.string().min(1).nullable(),
    checkMethodIsSafetyGuarantee: z.literal(false),
    claimKind: MetasploitCheckClaimKindSchema,
    code: MetasploitCheckCompileCodeSchema,
    entry: MetasploitCheckAllowlistEntrySchema.nullable(),
    jobsQueued: z.literal(0),
    liveSupported: z.literal(false),
    measuredExploitability: z.literal(false),
    moduleFullname: z.string().min(1).nullable(),
    queueable: z.literal(false),
    rationale: z.string().min(1),
    typedOptions: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()])
    )
  })
  .refine(
    (result) =>
      result.jobsQueued === 0 &&
      result.queueable === false &&
      result.liveSupported === false &&
      result.measuredExploitability === false &&
      result.checkMethodIsSafetyGuarantee === false,
    {
      message:
        "Metasploit check compilation must never queue, enable live, or claim measured exploitability"
    }
  );
export type MetasploitCheckCompileResult = z.infer<
  typeof MetasploitCheckCompileResultSchema
>;

const CONSOLE_REQUEST_KEYS = new Set([
  "console",
  "consolecommand",
  "irb",
  "irbcommand",
  "msfcommand",
  "msfconsoleargs",
  "resourcescript"
]);

const PAYLOAD_REQUEST_KEYS = new Set(
  METASPLOIT_FORBIDDEN_OPTION_NAMES.map((name) => name.toLowerCase())
);

const CONSOLE_VALUE_PATTERN = /\b(msfconsole|msfvenom|msfdb|msf-json-rpc)\b/iu;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function collectKeys(value: unknown, into: string[] = []): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return into;
  }
  for (const [key, nested] of Object.entries(value)) {
    into.push(key);
    collectKeys(nested, into);
  }
  return into;
}

function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    into.push(value);
    return into;
  }
  if (!value || typeof value !== "object") {
    return into;
  }
  const values = Array.isArray(value) ? value : Object.values(value);
  for (const nested of values) {
    collectStrings(nested, into);
  }
  return into;
}

export function isUnrestrictedMetasploitConsoleRequest(raw: unknown): boolean {
  const keys = collectKeys(raw).map((key) => key.toLowerCase());
  if (keys.some((key) => CONSOLE_REQUEST_KEYS.has(key))) {
    return true;
  }
  return collectStrings(raw).some((value) => CONSOLE_VALUE_PATTERN.test(value));
}

export function isArbitraryMetasploitPayloadInput(raw: unknown): boolean {
  const keys = collectKeys(raw).map((key) => key.toLowerCase());
  return keys.some((key) => PAYLOAD_REQUEST_KEYS.has(key));
}

export function classifyMetasploitCheckClaim(input: {
  checkCertifiedNonDestructive: boolean;
  hasCheckMethod: boolean;
  measuredReceipt?: boolean;
}): {
  claimKind: Exclude<MetasploitCheckClaimKind, "measured_exploitability">;
  checkMethodIsSafetyGuarantee: false;
  measuredExploitability: false;
} {
  void input.measuredReceipt;
  void input.hasCheckMethod;
  return {
    claimKind: input.checkCertifiedNonDestructive
      ? "vulnerability_presence"
      : "check_supported",
    checkMethodIsSafetyGuarantee: false,
    measuredExploitability: false
  };
}

function isSingleHost(value: string): boolean {
  if (
    value.includes("/") ||
    value.includes(",") ||
    value.includes(" ") ||
    value.includes("*") ||
    value === "0.0.0.0" ||
    value === "255.255.255.255"
  ) {
    return false;
  }
  const ipv4 =
    /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/;
  const hostname =
    /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
  return ipv4.test(value) || hostname.test(value);
}

function parsePort(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 1 && value <= 65535 ? value : undefined;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return parsed >= 1 && parsed <= 65535 ? parsed : undefined;
  }
  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function result(input: {
  accepted: boolean;
  checkCertifiedNonDestructive?: boolean | null;
  checkId?: string | null;
  claimKind: MetasploitCheckClaimKind;
  code: MetasploitCheckCompileCode;
  entry?: MetasploitCheckAllowlistEntry | null;
  moduleFullname?: string | null;
  rationale: string;
  typedOptions?: Record<string, string | number | boolean>;
}): MetasploitCheckCompileResult {
  return MetasploitCheckCompileResultSchema.parse({
    accepted: input.accepted,
    checkCertifiedNonDestructive: input.checkCertifiedNonDestructive ?? null,
    checkId: input.checkId ?? null,
    checkMethodIsSafetyGuarantee: false,
    claimKind: input.claimKind,
    code: input.code,
    entry: input.entry ?? null,
    jobsQueued: 0,
    liveSupported: false,
    measuredExploitability: false,
    moduleFullname: input.moduleFullname ?? null,
    queueable: false,
    rationale: input.rationale,
    typedOptions: input.typedOptions ?? {}
  });
}

function findAllowlistEntry(
  allowlist: readonly MetasploitCheckAllowlistEntry[],
  checkId: string | undefined,
  moduleFullname: string | undefined
): MetasploitCheckAllowlistEntry | undefined {
  if (checkId) {
    return allowlist.find((entry) => entry.checkId === checkId);
  }
  if (moduleFullname) {
    return allowlist.find((entry) => entry.moduleFullname === moduleFullname);
  }
  return undefined;
}

function validateTypedOptions(
  entry: MetasploitCheckAllowlistEntry,
  options: Record<string, unknown>,
  targetHost: string | undefined
):
  | { ok: true; typedOptions: Record<string, string | number | boolean> }
  | { ok: false; code: "untyped_option_denied" | "invalid_typed_option" } {
  const allowedNames = new Set(entry.typedOptions.map((option) => option.name));
  for (const name of Object.keys(options)) {
    if (forbiddenOptionNameSet.has(name.toLowerCase())) {
      return { ok: false, code: "untyped_option_denied" };
    }
    if (!allowedNames.has(name)) {
      return { ok: false, code: "untyped_option_denied" };
    }
  }

  const typedOptions: Record<string, string | number | boolean> = {};
  for (const option of entry.typedOptions) {
    const rawValue =
      options[option.name] ??
      (option.name === "RHOSTS" ? targetHost : undefined) ??
      option.defaultValue;
    if (rawValue === undefined) {
      if (option.required) {
        return { ok: false, code: "invalid_typed_option" };
      }
      continue;
    }
    if (option.type === "hostname") {
      const host = readString(rawValue);
      if (!host || !isSingleHost(host)) {
        return { ok: false, code: "invalid_typed_option" };
      }
      typedOptions[option.name] = host;
      continue;
    }
    if (option.type === "port") {
      const port = parsePort(rawValue);
      if (port === undefined) {
        return { ok: false, code: "invalid_typed_option" };
      }
      typedOptions[option.name] = port;
      continue;
    }
    const flag = parseBoolean(rawValue);
    if (flag === undefined) {
      return { ok: false, code: "invalid_typed_option" };
    }
    typedOptions[option.name] = flag;
  }

  const rhosts = readString(typedOptions.RHOSTS);
  if (targetHost && rhosts && targetHost !== rhosts) {
    return { ok: false, code: "invalid_typed_option" };
  }

  return { ok: true, typedOptions };
}

export function compileMetasploitCheckRequest(
  raw: unknown,
  allowlist: readonly MetasploitCheckAllowlistEntry[]
): MetasploitCheckCompileResult {
  const parsedAllowlist = allowlist.map((entry) =>
    MetasploitCheckAllowlistEntrySchema.parse(entry)
  );
  const record = asRecord(raw);

  if (isUnrestrictedMetasploitConsoleRequest(raw)) {
    return result({
      accepted: false,
      claimKind: "check_supported",
      code: "unrestricted_console_denied",
      rationale:
        "Unrestricted Metasploit console, resource scripts, and msfconsole argv are denied."
    });
  }

  if (isArbitraryMetasploitPayloadInput(raw)) {
    return result({
      accepted: false,
      claimKind: "check_supported",
      code: "arbitrary_payload_denied",
      rationale:
        "Arbitrary Metasploit payload, LHOST/LPORT, encoder, or handler input is denied."
    });
  }

  if (record.claimKind === "measured_exploitability") {
    return result({
      accepted: false,
      claimKind: "measured_exploitability",
      code: "measured_exploitability_unsupported",
      rationale:
        "Measured exploitability is unsupported: a check() method and fixture presence are not exploit receipts."
    });
  }

  const checkId = readString(record.checkId);
  const moduleFullname =
    readString(record.moduleFullname) ?? readString(record.moduleName);
  const frameworkVersion = readString(record.frameworkVersion);
  const targetHost = readString(record.targetHost);
  const options = asRecord(record.options);

  if (
    frameworkVersion &&
    MetasploitFrameworkVersionPinSchema.safeParse(frameworkVersion).success ===
      false
  ) {
    return result({
      accepted: false,
      claimKind: "check_supported",
      code: "version_pin_mismatch",
      moduleFullname: moduleFullname ?? null,
      rationale:
        "Metasploit framework version must be the reviewed exact x.y.z pin, not a range or floating tag."
    });
  }

  if (
    frameworkVersion &&
    frameworkVersion !== METASPLOIT_FRAMEWORK_VERSION_PIN
  ) {
    return result({
      accepted: false,
      claimKind: "check_supported",
      code: "version_pin_mismatch",
      moduleFullname: moduleFullname ?? null,
      rationale: `Metasploit framework version ${frameworkVersion} is not the reviewed pin ${METASPLOIT_FRAMEWORK_VERSION_PIN}.`
    });
  }

  if (!checkId && !moduleFullname) {
    if (record.dryRun === false && record.fixtureMode !== true) {
      return result({
        accepted: false,
        claimKind: "check_supported",
        code: "live_execution_disabled",
        rationale:
          "Live Metasploit execution is disabled. Denied tasks are never queued."
      });
    }
    return result({
      accepted: true,
      claimKind: "vulnerability_presence",
      code: record.fixtureMode === true ? "accepted_fixture" : "accepted_plan",
      rationale:
        "Generic Metasploit check plan without an allowlisted module is fixture/dry-run only and is not measured exploitability."
    });
  }

  const entry = findAllowlistEntry(parsedAllowlist, checkId, moduleFullname);
  if (!entry) {
    return result({
      accepted: false,
      claimKind: "check_supported",
      checkId,
      code: "module_not_allowlisted",
      moduleFullname: moduleFullname ?? null,
      rationale:
        "Metasploit module is not on the reviewed check allowlist. Unsupported."
    });
  }

  const optionResult = validateTypedOptions(entry, options, targetHost);
  if (!optionResult.ok) {
    return result({
      accepted: false,
      checkCertifiedNonDestructive: entry.checkCertifiedNonDestructive,
      checkId: entry.checkId,
      claimKind: classifyMetasploitCheckClaim(entry).claimKind,
      code: optionResult.code,
      entry,
      moduleFullname: entry.moduleFullname,
      rationale:
        optionResult.code === "untyped_option_denied"
          ? "Option is not on the reviewed typed allowlist for this Metasploit check."
          : "Typed Metasploit option failed host/port/boolean validation."
    });
  }

  const claim = classifyMetasploitCheckClaim(entry);
  if (record.dryRun === false && record.fixtureMode !== true) {
    return result({
      accepted: false,
      checkCertifiedNonDestructive: entry.checkCertifiedNonDestructive,
      checkId: entry.checkId,
      claimKind: claim.claimKind,
      code: "live_execution_disabled",
      entry,
      moduleFullname: entry.moduleFullname,
      rationale:
        "Live Metasploit execution is disabled. A check() method is not a safety guarantee. Denied tasks are never queued.",
      typedOptions: optionResult.typedOptions
    });
  }

  return result({
    accepted: true,
    checkCertifiedNonDestructive: entry.checkCertifiedNonDestructive,
    checkId: entry.checkId,
    claimKind: claim.claimKind,
    code: record.fixtureMode === true ? "accepted_fixture" : "accepted_plan",
    entry,
    moduleFullname: entry.moduleFullname,
    rationale: entry.checkCertifiedNonDestructive
      ? "Allowlisted fixture/plan records vulnerability presence only; not measured exploitability."
      : "Allowlisted module exposes check support, but check() is not a safety guarantee and is not measured exploitability.",
    typedOptions: optionResult.typedOptions
  });
}
