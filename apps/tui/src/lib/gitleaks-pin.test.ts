import { describe, expect, it } from "vitest";

import { COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID } from "@periscan/shared";

import { pinGitleaksRepoSecretsModuleIds } from "./gitleaks-pin.js";

describe("pinGitleaksRepoSecretsModuleIds", () => {
  it("pins gitleaks.repo_secrets like interactive g when the engine is startable", () => {
    expect(
      pinGitleaksRepoSecretsModuleIds([
        "gitleaks.repo_secrets",
        "trivy.repo_dependency_scan",
        "dependency_check.sca"
      ])
    ).toEqual([COMMUNITY_GITLEAKS_REPO_SECRETS_MODULE_ID]);
  });

  it("does not invent a Gitleaks pin when the engine is not startable", () => {
    expect(
      pinGitleaksRepoSecretsModuleIds([
        "periscan.dns_resolution_check",
        "prowler.aws_posture"
      ])
    ).toBeUndefined();
  });
});
