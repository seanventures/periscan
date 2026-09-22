import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  compileAllowlistedMetasploitCheck,
  executeModuleById,
  ModuleOutputSchema,
  type ModuleOutput
} from "@periscan/modules";
import {
  denyReasonForLivePack,
  liveOffensivePackFromTarget,
  METASPLOIT_CHECK_MODULE_ID,
  MetasploitCheckClaimKindSchema,
  type MetasploitCheckClaimKind,
  type MetasploitCheckCompileResult
} from "@periscan/shared";

const NIL_SCOPE_ID = "00000000-0000-4000-8000-000000000000";

export const QualifiedMetasploitStartInputSchema = z
  .object({
    action: z.enum(["check", "exploit", "run"]).optional(),
    checkId: z.string().min(1).optional(),
    claimKind: MetasploitCheckClaimKindSchema.optional(),
    consoleCommand: z.string().optional(),
    dryRun: z.boolean().optional(),
    fixtureMode: z.boolean().optional(),
    fixtureVulnerable: z.boolean().optional(),
    frameworkVersion: z.string().min(1).optional(),
    missionId: z.string().uuid().optional(),
    moduleName: z.string().min(1).optional(),
    options: z.record(z.string(), z.unknown()).optional(),
    policyDecisionId: z.string().uuid().nullish(),
    runId: z.string().uuid().optional(),
    runnerId: z.string().min(1).nullish(),
    scenarioId: z.string().min(1).optional(),
    scopeId: z.string().uuid().optional(),
    startable: z.boolean().optional(),
    targetHost: z.string().min(1),
    tenantId: z.string().uuid().optional()
  })
  .passthrough();
export type QualifiedMetasploitStartInput = z.infer<
  typeof QualifiedMetasploitStartInputSchema
>;

export const QualifiedMetasploitStartResultSchema = z
  .object({
    accepted: z.boolean(),
    checkId: z.string().min(1).nullable(),
    checkMethodIsSafetyGuarantee: z.literal(false),
    claimKind: MetasploitCheckClaimKindSchema,
    code: z.string().min(1),
    denyReason: z.string().min(1).nullable(),
    executed: z.boolean(),
    jobsQueued: z.literal(0),
    liveSupported: z.literal(false),
    measuredExploitability: z.literal(false),
    moduleFullname: z.string().min(1).nullable(),
    moduleOutput: ModuleOutputSchema.nullable(),
    outcome: z.string().min(1).nullable(),
    queued: z.literal(false),
    rationale: z.string().min(1),
    startable: z.boolean(),
    typedOptions: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean()])
    ),
    validationState: z.string().nullable()
  })
  .refine(
    (result) =>
      result.jobsQueued === 0 &&
      result.queued === false &&
      result.liveSupported === false &&
      result.measuredExploitability === false &&
      result.checkMethodIsSafetyGuarantee === false,
    {
      message:
        "Qualified Metasploit starts must never queue, enable live, or claim measured exploitability."
    }
  )
  .refine(
    (result) =>
      result.startable ||
      (result.executed === false &&
        result.jobsQueued === 0 &&
        result.queued === false),
    {
      message:
        "A Metasploit pin that is not startable must not execute or queue jobs."
    }
  )
  .refine(
    (result) =>
      result.claimKind !== "measured_exploitability" ||
      result.accepted === false,
    {
      message:
        "measured_exploitability cannot be accepted from a Metasploit check() start."
    }
  )
  .refine((result) => !result.executed || result.startable, {
    message:
      "Fixture/lab Metasploit checks execute only when the start gate is startable."
  });
export type QualifiedMetasploitStartResult = z.infer<
  typeof QualifiedMetasploitStartResultSchema
>;

function deny(input: {
  checkId?: string | null;
  claimKind?: MetasploitCheckClaimKind;
  code: string;
  compiled?: MetasploitCheckCompileResult | null;
  denyReason: string;
  moduleFullname?: string | null;
  typedOptions?: Record<string, string | number | boolean>;
}): QualifiedMetasploitStartResult {
  const compiled = input.compiled;
  return QualifiedMetasploitStartResultSchema.parse({
    accepted: false,
    checkId: input.checkId ?? compiled?.checkId ?? null,
    checkMethodIsSafetyGuarantee: false,
    claimKind: input.claimKind ?? compiled?.claimKind ?? "check_supported",
    code: input.code,
    denyReason: input.denyReason,
    executed: false,
    jobsQueued: 0,
    liveSupported: false,
    measuredExploitability: false,
    moduleFullname: input.moduleFullname ?? compiled?.moduleFullname ?? null,
    moduleOutput: null,
    outcome: null,
    queued: false,
    rationale: input.denyReason,
    startable: false,
    typedOptions: input.typedOptions ?? compiled?.typedOptions ?? {},
    validationState: null
  });
}

export function evaluateMetasploitQualifiedStart(
  raw: unknown
): QualifiedMetasploitStartResult {
  const parsed = QualifiedMetasploitStartInputSchema.parse(raw);

  // Live offensive packs stay qualification-required even if a caller stamps startable.
  const livePack = liveOffensivePackFromTarget({
    moduleId: parsed.scenarioId,
    scenarioId: parsed.scenarioId
  });
  if (livePack) {
    return deny({
      code: "live_pack_denied",
      denyReason: denyReasonForLivePack(livePack)
    });
  }

  if (parsed.action != null && parsed.action !== "check") {
    return deny({
      checkId: parsed.checkId ?? null,
      code: "exploit_action_denied",
      denyReason:
        "Qualified Metasploit start runs an allowlisted check only. Exploit/run/PAYLOAD actions are denied and never queued.",
      moduleFullname: parsed.moduleName ?? null
    });
  }

  const compiled = compileAllowlistedMetasploitCheck(raw);
  if (!compiled.accepted) {
    return deny({
      claimKind: compiled.claimKind,
      code: compiled.code,
      compiled,
      denyReason: compiled.rationale
    });
  }

  if (parsed.startable === false) {
    return deny({
      checkId: compiled.checkId,
      claimKind: compiled.claimKind,
      code: "start_gate_denied",
      compiled,
      denyReason:
        "Metasploit pin is not startable. Denied tasks are never queued.",
      moduleFullname: compiled.moduleFullname
    });
  }

  const claimKind =
    compiled.claimKind === "measured_exploitability"
      ? "check_supported"
      : compiled.claimKind;

  return QualifiedMetasploitStartResultSchema.parse({
    accepted: true,
    checkId: compiled.checkId,
    checkMethodIsSafetyGuarantee: false,
    claimKind,
    code: compiled.code,
    denyReason: null,
    executed: false,
    jobsQueued: 0,
    liveSupported: false,
    measuredExploitability: false,
    moduleFullname: compiled.moduleFullname,
    moduleOutput: null,
    outcome: null,
    queued: false,
    rationale: compiled.rationale,
    startable: true,
    typedOptions: compiled.typedOptions,
    validationState: null
  });
}

export async function startQualifiedMetasploitCheck(
  raw: unknown
): Promise<QualifiedMetasploitStartResult> {
  const gate = evaluateMetasploitQualifiedStart(raw);
  if (!gate.startable) {
    return gate;
  }

  const parsed = QualifiedMetasploitStartInputSchema.parse(raw);
  const output: ModuleOutput = await executeModuleById(
    METASPLOIT_CHECK_MODULE_ID,
    {
      integrationIds: [],
      inputs: {},
      missionId: parsed.missionId ?? randomUUID(),
      policyDecisionId: parsed.policyDecisionId ?? null,
      runId: parsed.runId ?? randomUUID(),
      runnerId: parsed.runnerId ?? null,
      safetyLevel: "AdvancedAdversarial",
      scopeId: parsed.scopeId ?? NIL_SCOPE_ID,
      target: {
        checkId: gate.checkId ?? parsed.checkId,
        fixtureMode: true,
        fixtureVulnerable: parsed.fixtureVulnerable ?? true,
        frameworkVersion: parsed.frameworkVersion,
        moduleName: gate.moduleFullname ?? parsed.moduleName,
        options: gate.typedOptions,
        targetHost: parsed.targetHost
      },
      tenantId: parsed.tenantId ?? randomUUID()
    }
  );

  const claimKind =
    gate.claimKind === "vulnerability_presence" ||
    gate.claimKind === "check_supported"
      ? gate.claimKind
      : "check_supported";

  return QualifiedMetasploitStartResultSchema.parse({
    accepted: true,
    checkId: gate.checkId,
    checkMethodIsSafetyGuarantee: false,
    claimKind,
    code: gate.code,
    denyReason: null,
    executed: true,
    jobsQueued: 0,
    liveSupported: false,
    measuredExploitability: false,
    moduleFullname: gate.moduleFullname,
    moduleOutput: output,
    outcome: output.outcome,
    queued: false,
    rationale: gate.rationale,
    startable: true,
    typedOptions: gate.typedOptions,
    validationState: output.validationState ?? null
  });
}
