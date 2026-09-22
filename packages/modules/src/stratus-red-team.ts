import { z } from "zod";

import {
  STRATUS_MODULE_ID,
  STRATUS_SPDX_LICENSE_ID,
  StratusEvalDenialCodeSchema,
  StratusEvalRequestSchema,
  StratusEvalResultSchema,
  StratusTechniqueIdSchema,
  evaluateStratusTechniqueEval,
  listStratusCandidateTechniques,
  type StratusCandidateTechnique,
  type StratusEvalDenialCode
} from "@periscan/shared";

/**
 * Stratus Red Team modules adapter (PERISCAN-591).
 * Compiles disposable-account eval requests and always denies live detonation.
 * Does not spawn `stratus`, read cloud credentials, or destroy resources.
 */

const CLOUD_CREDENTIAL_KEYS = new Set([
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "AZURE_TENANT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "awsAccessKeyId",
  "awsSecretAccessKey",
  "awsSessionToken",
  "azureClientId",
  "azureClientSecret",
  "azureTenantId",
  "googleApplicationCredentials",
  "gcpServiceAccountJson",
  "serviceAccountJson",
  "cloudCredentials",
  "credentials"
]);

const EVAL_REQUEST_KEYS = [
  "accountKind",
  "cleanupVerificationRequired",
  "customerCloudDestructionAllowed",
  "enabled",
  "resourceBudget",
  "techniqueIds"
] as const;

export const StratusModuleCompileResultSchema = z.discriminatedUnion("ok", [
  z.object({
    code: z.null(),
    detonate: z.literal(false),
    liveSupported: z.literal(false),
    moduleId: z.literal(STRATUS_MODULE_ID),
    ok: z.literal(true),
    request: StratusEvalRequestSchema,
    spdxLicenseId: z.literal(STRATUS_SPDX_LICENSE_ID)
  }),
  z.object({
    code: StratusEvalDenialCodeSchema,
    detonate: z.literal(false),
    liveSupported: z.literal(false),
    moduleId: z.literal(STRATUS_MODULE_ID),
    ok: z.literal(false),
    request: z.null(),
    spdxLicenseId: z.literal(STRATUS_SPDX_LICENSE_ID)
  })
]);
export type StratusModuleCompileResult = z.infer<
  typeof StratusModuleCompileResultSchema
>;

export const StratusModuleStartResultSchema = StratusEvalResultSchema.extend({
  compiled: z.boolean(),
  credentialsRead: z.literal(false),
  detonate: z.literal(false),
  moduleId: z.literal(STRATUS_MODULE_ID),
  spdxLicenseId: z.literal(STRATUS_SPDX_LICENSE_ID)
});
export type StratusModuleStartResult = z.infer<
  typeof StratusModuleStartResultSchema
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordHasCloudCredentials(record: Record<string, unknown>): boolean {
  for (const key of CLOUD_CREDENTIAL_KEYS) {
    if (!(key in record)) {
      continue;
    }
    const value = record[key];
    if (
      value !== undefined &&
      value !== null &&
      value !== false &&
      value !== ""
    ) {
      return true;
    }
  }
  return false;
}

function hasCloudCredentials(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }
  if (recordHasCloudCredentials(input)) {
    return true;
  }
  return isRecord(input.env) && recordHasCloudCredentials(input.env);
}

function textRequestsDetonate(value: unknown): boolean {
  return typeof value === "string" && value.toLowerCase().includes("detonate");
}

function requestsStratusDetonate(input: unknown): boolean {
  if (!isRecord(input)) {
    return false;
  }
  if (input.detonate === true) {
    return true;
  }
  if (
    textRequestsDetonate(input.command) ||
    textRequestsDetonate(input.action)
  ) {
    return true;
  }
  return (
    Array.isArray(input.argv) &&
    input.argv.some((item) => textRequestsDetonate(item))
  );
}

function evalPayload(input: unknown): unknown {
  if (!isRecord(input)) {
    return input;
  }
  const payload: Record<string, unknown> = {};
  for (const key of EVAL_REQUEST_KEYS) {
    if (key in input) {
      payload[key] = input[key];
    }
  }
  return payload;
}

function selectedTechniqueIds(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.techniqueIds)) {
    return [];
  }
  return input.techniqueIds.filter(
    (item): item is string => StratusTechniqueIdSchema.safeParse(item).success
  );
}

function requestCompiled(code: StratusEvalDenialCode): boolean {
  return code === "stratus_live_disabled" || code === "stratus_not_enabled";
}

function compileFail(code: StratusEvalDenialCode): StratusModuleCompileResult {
  return StratusModuleCompileResultSchema.parse({
    code,
    detonate: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    ok: false,
    request: null,
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID
  });
}

function moduleDeny(input: {
  code: StratusEvalDenialCode;
  rationale: string;
  selectedTechniqueIds: string[];
}): StratusModuleStartResult {
  return StratusModuleStartResultSchema.parse({
    allowed: false,
    accountKindAccepted: false,
    cleanupVerificationRequired: true,
    code: input.code,
    compiled: false,
    credentialsRead: false,
    customerCloudDestruction: false,
    defaultEnabled: false,
    detonate: false,
    jobsQueued: 0,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    rationale: input.rationale,
    resourceBudgetAccepted: false,
    resourcesDestroyed: 0,
    selectedTechniqueIds: input.selectedTechniqueIds,
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID
  });
}

export function listStratusModuleCandidateTechniques(): StratusCandidateTechnique[] {
  return listStratusCandidateTechniques();
}

export function compileStratusModuleRequest(
  input: unknown
): StratusModuleCompileResult {
  if (hasCloudCredentials(input)) {
    return compileFail("stratus_invalid_request");
  }
  if (requestsStratusDetonate(input)) {
    return compileFail("stratus_customer_destruction_forbidden");
  }

  const payload = evalPayload(input);
  const parsed = StratusEvalRequestSchema.safeParse(payload);
  const evaluation = evaluateStratusTechniqueEval(payload);
  if (!parsed.success || !requestCompiled(evaluation.code)) {
    return compileFail(evaluation.code);
  }

  return StratusModuleCompileResultSchema.parse({
    code: null,
    detonate: false,
    liveSupported: false,
    moduleId: STRATUS_MODULE_ID,
    ok: true,
    request: parsed.data,
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID
  });
}

export function evaluateStratusModuleStart(
  input: unknown
): StratusModuleStartResult {
  if (hasCloudCredentials(input)) {
    return moduleDeny({
      code: "stratus_invalid_request",
      rationale:
        "Stratus evaluation does not accept or read AWS, Azure, or GCP credentials.",
      selectedTechniqueIds: selectedTechniqueIds(input)
    });
  }
  if (requestsStratusDetonate(input)) {
    return moduleDeny({
      code: "stratus_customer_destruction_forbidden",
      rationale:
        "stratus detonate is forbidden. Customer cloud resource destruction is forbidden.",
      selectedTechniqueIds: selectedTechniqueIds(input)
    });
  }

  const evaluation = evaluateStratusTechniqueEval(evalPayload(input));
  return StratusModuleStartResultSchema.parse({
    ...evaluation,
    compiled: requestCompiled(evaluation.code),
    credentialsRead: false,
    detonate: false,
    moduleId: STRATUS_MODULE_ID,
    spdxLicenseId: STRATUS_SPDX_LICENSE_ID
  });
}
