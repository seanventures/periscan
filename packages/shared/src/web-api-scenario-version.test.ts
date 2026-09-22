import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  communityPolicyPreviewRequest,
  listCommunityValidationStartModules
} from "./community-edition.js";
import {
  NUCLEI_ENGINE_VERSION_PIN,
  NUCLEI_TEMPLATES_VERSION_PIN,
  WEB_API_SAFE_PROFILE_IDS,
  ZAP_ENGINE_VERSION_PIN,
  compileWebApiScenarioVersion,
  digestWebApiTemplatePack
} from "./web-api-scenario-version.js";

const SAFE_BASELINE_TEMPLATES = [
  {
    content: "id: periscan-safe-http-fingerprint\ninfo:\n  name: fingerprint\n",
    filename: "http-fingerprint.yaml"
  },
  {
    content: "id: periscan-safe-http-security-headers\ninfo:\n  name: headers\n",
    filename: "http-security-headers.yaml"
  },
  {
    content: "id: periscan-safe-public-metadata\ninfo:\n  name: metadata\n",
    filename: "public-metadata.yaml"
  }
] as const;

function independentPackDigest(
  files: ReadonlyArray<{ content: string; filename: string }>
): string {
  const hash = createHash("sha256");
  for (const file of [...files].sort((a, b) =>
    a.filename.localeCompare(b.filename)
  )) {
    hash.update(`${file.filename}\n`);
    hash.update(file.content);
    if (!file.content.endsWith("\n")) {
      hash.update("\n");
    }
  }
  return hash.digest("hex");
}

describe("web/API BAS scenario versions (PERISCAN-589/591)", () => {
  it("pins safe-baseline templates to a stable digest and rejects a fuzz profile", () => {
    const v = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline"
    });
    expect(v.ok).toBe(true);
    if (!v.ok) {
      return;
    }
    expect(v.version.pin.nuclei).toBe("v3.8.0");
    expect(v.version.templateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(
      compileWebApiScenarioVersion({ engine: "nuclei", profileId: "fuzzing" }).ok
    ).toBe(false);
  });

  it("allowlists only safe Nuclei/ZAP profiles and marks them executable", () => {
    expect(WEB_API_SAFE_PROFILE_IDS).toEqual([
      "safe-baseline",
      "fingerprint",
      "headers",
      "metadata",
      "zap-baseline"
    ]);
    expect(NUCLEI_ENGINE_VERSION_PIN).toBe("v3.8.0");
    expect(NUCLEI_TEMPLATES_VERSION_PIN).toBe("v10.4.4");
    expect(ZAP_ENGINE_VERSION_PIN).toBe("2.17.0");

    for (const profileId of [
      "safe-baseline",
      "fingerprint",
      "headers",
      "metadata"
    ] as const) {
      const compiled = compileWebApiScenarioVersion({
        engine: "nuclei",
        profileId,
        templateContents: SAFE_BASELINE_TEMPLATES
      });
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) {
        continue;
      }
      expect(compiled.version.engine).toBe("nuclei");
      expect(compiled.version.profileId).toBe(profileId);
      expect(compiled.version.executable).toBe(true);
      expect(compiled.version.pin.nuclei).toBe("v3.8.0");
      expect(compiled.version.pin.nucleiTemplates).toBe("v10.4.4");
      expect(compiled.version.spdxLicenseId).toBe("MIT");
      expect(compiled.version.startsExternalPoa).toBe(false);
      expect(compiled.version.jobsQueued).toBe(0);
    }
  });

  it("fails closed on fuzzing, DoS, and intrusive Nuclei profiles", () => {
    for (const profileId of [
      "fuzzing",
      "dos",
      "intrusive",
      "dast-full",
      "exploit"
    ]) {
      const denied = compileWebApiScenarioVersion({
        engine: "nuclei",
        profileId
      });
      expect(denied.ok).toBe(false);
      if (denied.ok) {
        continue;
      }
      expect(denied.code).toBe("nuclei_profile_not_allowlisted");
      expect(denied.executable).toBe(false);
      expect(denied.jobsQueued).toBe(0);
      expect(denied.startsExternalPoa).toBe(false);
    }
  });

  it("pins ZAP baseline 2.17.0 and refuses attack / spider-ajax as scenario versions", () => {
    const baseline = compileWebApiScenarioVersion({
      engine: "zap",
      profileId: "zap-baseline"
    });
    expect(baseline.ok).toBe(true);
    if (!baseline.ok) {
      return;
    }
    expect(baseline.version.engine).toBe("zap");
    expect(baseline.version.profileId).toBe("zap-baseline");
    expect(baseline.version.pin.zap).toBe("2.17.0");
    expect(baseline.version.executable).toBe(true);
    expect(baseline.version.spdxLicenseId).toBe("Apache-2.0");
    expect(baseline.version.templateDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(baseline.version.startsExternalPoa).toBe(false);

    for (const profileId of ["attack", "spider-ajax", "full-scan"]) {
      const denied = compileWebApiScenarioVersion({
        engine: "zap",
        profileId
      });
      expect(denied.ok).toBe(false);
      if (denied.ok) {
        continue;
      }
      expect(denied.code).toBe("zap_profile_not_allowlisted");
      expect(denied.executable).toBe(false);
    }
  });

  it("changes the digest when a template body changes", () => {
    const original = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline",
      templateContents: SAFE_BASELINE_TEMPLATES
    });
    const mutated = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline",
      templateContents: SAFE_BASELINE_TEMPLATES.map((file, index) =>
        index === 0
          ? { ...file, content: `${file.content}# mutated\n` }
          : file
      )
    });

    expect(original.ok).toBe(true);
    expect(mutated.ok).toBe(true);
    if (!original.ok || !mutated.ok) {
      return;
    }
    expect(original.version.templateDigest).toBe(
      independentPackDigest(SAFE_BASELINE_TEMPLATES)
    );
    expect(digestWebApiTemplatePack(SAFE_BASELINE_TEMPLATES)).toBe(
      original.version.templateDigest
    );
    expect(mutated.version.templateDigest).not.toBe(
      original.version.templateDigest
    );
    expect(mutated.version.templateDigest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not start ExternalPoA from the primary Community Domain path", () => {
    const compiled = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline"
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.version.startsExternalPoa).toBe(false);
    expect(compiled.version.jobsQueued).toBe(0);
    expect(compiled.version.communityPrimaryStart).toBe(false);

    const primary = listCommunityValidationStartModules({
      scopeType: "Domain"
    });
    expect(
      primary.some(
        (entry) => entry.moduleId === "nuclei.external_exposure_safe"
      )
    ).toBe(false);
    expect(
      communityPolicyPreviewRequest({ scopeType: "Domain" })
        .executionEnvironment
    ).toBe("ControlPlane");
  });

  it("never treats ffuf or live Atomic as a web/API scenario version", () => {
    const ffuf = compileWebApiScenarioVersion({
      engine: "ffuf",
      profileId: "safe-baseline"
    });
    expect(ffuf.ok).toBe(false);
    if (!ffuf.ok) {
      expect(ffuf.code).toBe("web_api_engine_not_allowlisted");
      expect(ffuf.jobsQueued).toBe(0);
    }

    const atomic = compileWebApiScenarioVersion({
      engine: "atomic",
      profileId: "safe-baseline"
    });
    expect(atomic.ok).toBe(false);
    if (!atomic.ok) {
      expect(atomic.code).toBe("web_api_engine_not_allowlisted");
      expect(atomic.liveSupported).toBe(false);
    }
  });
});
