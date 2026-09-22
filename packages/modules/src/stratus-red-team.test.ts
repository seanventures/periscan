import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  STRATUS_CANDIDATE_TECHNIQUE_LIMIT,
  STRATUS_MODULE_ID,
  STRATUS_SPDX_LICENSE_ID
} from "@periscan/shared";

import {
  compileStratusModuleRequest,
  evaluateStratusModuleStart,
  listStratusModuleCandidateTechniques
} from "./stratus-red-team.js";

const ADAPTER_SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "stratus-red-team.ts"
);

const COMPLETE_DISPOSABLE_REQUEST = {
  accountKind: "disposable_authorized" as const,
  cleanupVerificationRequired: true,
  enabled: true,
  resourceBudget: {
    maxDurationMinutes: 15,
    maxResources: 2,
    maxUsd: 5
  },
  techniqueIds: ["aws.credential-access.ec2-steal-instance-credentials"]
};

const CLOUD_CREDENTIAL_ENV_KEYS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET",
  "AZURE_TENANT_ID",
  "GOOGLE_APPLICATION_CREDENTIALS"
] as const;

afterEach(() => {
  for (const key of CLOUD_CREDENTIAL_ENV_KEYS) {
    delete process.env[key];
  }
});

describe("Stratus modules adapter (PERISCAN-591)", () => {
  it("complete disposable-account request still queues zero jobs", () => {
    const result = evaluateStratusModuleStart(COMPLETE_DISPOSABLE_REQUEST);

    expect(result.allowed).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.liveSupported).toBe(false);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.customerCloudDestruction).toBe(false);
    expect(result.defaultEnabled).toBe(false);
    expect(result.detonate).toBe(false);
    expect(result.credentialsRead).toBe(false);
    expect(result.compiled).toBe(true);
    expect(result.moduleId).toBe(STRATUS_MODULE_ID);
    expect(result.spdxLicenseId).toBe(STRATUS_SPDX_LICENSE_ID);
    expect(result.code).toBe("stratus_live_disabled");
    expect(result.selectedTechniqueIds).toEqual([
      "aws.credential-access.ec2-steal-instance-credentials"
    ]);
  });

  it("compiles disposable-account budgets and selected techniques without live support", () => {
    const compiled = compileStratusModuleRequest(COMPLETE_DISPOSABLE_REQUEST);

    expect(compiled.ok).toBe(true);
    expect(compiled.liveSupported).toBe(false);
    expect(compiled.detonate).toBe(false);
    expect(compiled.moduleId).toBe("stratus.cloud_technique_eval");
    expect(compiled.spdxLicenseId).toBe("Apache-2.0");
    expect(compiled.request).toMatchObject({
      accountKind: "disposable_authorized",
      cleanupVerificationRequired: true,
      resourceBudget: {
        maxDurationMinutes: 15,
        maxResources: 2,
        maxUsd: 5
      },
      techniqueIds: ["aws.credential-access.ec2-steal-instance-credentials"]
    });
  });

  it("fails closed on wildcards, customer_production, missing cleanup, and missing budget", () => {
    expect(
      evaluateStratusModuleStart({
        ...COMPLETE_DISPOSABLE_REQUEST,
        techniqueIds: ["*"]
      }).code
    ).toBe("stratus_techniques_required");
    expect(
      evaluateStratusModuleStart({
        ...COMPLETE_DISPOSABLE_REQUEST,
        techniqueIds: ["all"]
      }).code
    ).toBe("stratus_techniques_required");
    expect(
      evaluateStratusModuleStart({
        ...COMPLETE_DISPOSABLE_REQUEST,
        accountKind: "customer_production"
      }).code
    ).toBe("stratus_customer_account_forbidden");
    expect(
      evaluateStratusModuleStart({
        ...COMPLETE_DISPOSABLE_REQUEST,
        cleanupVerificationRequired: false
      }).code
    ).toBe("stratus_cleanup_verification_required");

    const { resourceBudget: _budget, ...withoutBudget } =
      COMPLETE_DISPOSABLE_REQUEST;
    const missingBudget = evaluateStratusModuleStart(withoutBudget);
    expect(missingBudget.code).toBe("stratus_budget_required");
    expect(missingBudget.allowed).toBe(false);
    expect(missingBudget.jobsQueued).toBe(0);
    expect(missingBudget.compiled).toBe(false);

    expect(
      compileStratusModuleRequest({
        ...COMPLETE_DISPOSABLE_REQUEST,
        accountKind: "customer_production"
      }).ok
    ).toBe(false);
  });

  it("refuses stratus detonate and never destroys resources", () => {
    const result = evaluateStratusModuleStart({
      ...COMPLETE_DISPOSABLE_REQUEST,
      command: "stratus detonate"
    });

    expect(result.allowed).toBe(false);
    expect(result.detonate).toBe(false);
    expect(result.jobsQueued).toBe(0);
    expect(result.resourcesDestroyed).toBe(0);
    expect(result.customerCloudDestruction).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.compiled).toBe(false);
    expect(result.code).toBe("stratus_customer_destruction_forbidden");
  });

  it("does not read AWS, Azure, or GCP credentials from the request or environment", () => {
    process.env.AWS_ACCESS_KEY_ID = "AKIAFAKEEXAMPLE";
    process.env.AWS_SECRET_ACCESS_KEY = "secret";
    process.env.AZURE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/sa.json";

    const envPresent = evaluateStratusModuleStart(COMPLETE_DISPOSABLE_REQUEST);
    expect(envPresent.credentialsRead).toBe(false);
    expect(envPresent.allowed).toBe(false);
    expect(envPresent.jobsQueued).toBe(0);
    expect(envPresent.compiled).toBe(true);

    const withKeys = evaluateStratusModuleStart({
      ...COMPLETE_DISPOSABLE_REQUEST,
      AWS_ACCESS_KEY_ID: "AKIAFAKEEXAMPLE",
      AWS_SECRET_ACCESS_KEY: "secret"
    });
    expect(withKeys.allowed).toBe(false);
    expect(withKeys.credentialsRead).toBe(false);
    expect(withKeys.jobsQueued).toBe(0);
    expect(withKeys.compiled).toBe(false);
    expect(withKeys.code).toBe("stratus_invalid_request");
  });

  it("keeps the candidate subset at most 8, Apache-2.0, and default-disabled", () => {
    const candidates = listStratusModuleCandidateTechniques();
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.length).toBeLessThanOrEqual(
      STRATUS_CANDIDATE_TECHNIQUE_LIMIT
    );
    expect(STRATUS_CANDIDATE_TECHNIQUE_LIMIT).toBe(8);

    for (const item of candidates) {
      expect(item.enabled).toBe(false);
      expect(item.defaultEnabled).toBe(false);
      expect(item.liveSupported).toBe(false);
      expect(item.accountKind).toBe("disposable_authorized");
      expect(item.cleanupVerificationRequired).toBe(true);
      expect(item.moduleId).toBe("stratus.cloud_technique_eval");
      expect(item.spdxLicenseId).toBe("Apache-2.0");
      expect(item.source).toBe("stratus-red-team");
    }
  });

  it("does not claim MQ, 95, Wave, or executed Stratus coverage", () => {
    const candidates = listStratusModuleCandidateTechniques();
    const blob = [
      ...candidates.map(
        (item) => `${item.techniqueId} ${item.name} ${item.description}`
      ),
      evaluateStratusModuleStart(COMPLETE_DISPOSABLE_REQUEST).rationale
    ]
      .join(" ")
      .toLowerCase();

    expect(blob).not.toMatch(/magic quadrant/);
    expect(blob).not.toMatch(/forrester wave/);
    expect(blob).not.toMatch(/\b95\b/);
    expect(blob).not.toMatch(/100% att[&c]ck/);
    expect(blob).not.toMatch(/executed coverage/);
  });

  it("never spawns stratus or reads cloud credential environment keys", async () => {
    const source = await readFile(ADAPTER_SOURCE_PATH, "utf8");
    expect(source).not.toMatch(/\b(?:execFile|execSync|spawn|exec)\s*\(/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/child_process/);
  });
});
