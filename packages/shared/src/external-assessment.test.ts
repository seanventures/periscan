import { describe, expect, it } from "vitest";

import { CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST } from "./continuous-easm.js";
import {
  NUCLEI_ENGINE_VERSION_PIN,
  NUCLEI_TEMPLATES_VERSION_PIN
} from "./web-api-scenario-version.js";
import {
  EXTERNAL_ASSESSMENT_DENIED_PROFILE_IDS,
  EXTERNAL_ASSESSMENT_PRODUCT_COPY,
  EXTERNAL_ASSESSMENT_PROFILE_IDS,
  EXTERNAL_ASSESSMENT_START_JOBS,
  EXTERNAL_ASSESSMENT_TOOLCHAIN,
  attachExternalAssessmentToSchedule,
  compileExternalAssessment,
  mapExternalAssessmentToolOutput
} from "./external-assessment.js";

describe("internet-facing external assessment contract", () => {
  it("compiles verified-domain toolchain without queuing jobs", () => {
    const compiled = compileExternalAssessment({
      profileId: "internet-facing"
    });

    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }

    expect(compiled.assessment.jobsQueued).toBe(0);
    expect(compiled.assessment.startsJobs).toBe(false);
    expect(compiled.assessment.alwaysOnBas).toBe(false);
    expect(compiled.assessment.liveAtomic).toBe(false);
    expect(compiled.assessment.productCopy).toBe(
      EXTERNAL_ASSESSMENT_PRODUCT_COPY
    );
    expect(EXTERNAL_ASSESSMENT_PRODUCT_COPY).toMatch(
      /Internet-facing assessment/i
    );
    expect(EXTERNAL_ASSESSMENT_PRODUCT_COPY).toMatch(
      /Not a full ASV platform in a box/i
    );
    expect(compiled.assessment.tools.map((tool) => tool.toolId)).toEqual([
      "subfinder",
      "httpx",
      "dnsx",
      "nuclei",
      "tlsx"
    ]);
    expect(compiled.assessment.tools.map((tool) => tool.moduleId)).toEqual([
      "recon.subdomain_enum",
      "recon.http_probe",
      "recon.dns_probe",
      "nuclei.external_exposure_safe",
      "tlsx.tls_probe"
    ]);
    expect(compiled.assessment.nucleiPin).toBe(NUCLEI_ENGINE_VERSION_PIN);
    expect(compiled.assessment.nucleiTemplatesPin).toBe(
      NUCLEI_TEMPLATES_VERSION_PIN
    );
  });

  it("allowlists only safe profiles and maps start jobs to ExternalPoA/ControlPlane", () => {
    expect(EXTERNAL_ASSESSMENT_PROFILE_IDS).toEqual([
      "internet-facing",
      "safe-baseline",
      "fingerprint",
      "headers",
      "metadata"
    ]);
    expect(EXTERNAL_ASSESSMENT_TOOLCHAIN).toHaveLength(5);
    expect(
      EXTERNAL_ASSESSMENT_START_JOBS.every(
        (job) =>
          job.executionEnvironment === "ExternalPoA" ||
          job.executionEnvironment === "ControlPlane"
      )
    ).toBe(true);
    expect(
      EXTERNAL_ASSESSMENT_START_JOBS.some(
        (job) =>
          job.moduleId === "nuclei.external_exposure_safe" &&
          job.executionEnvironment === "ExternalPoA"
      )
    ).toBe(true);
    expect(
      EXTERNAL_ASSESSMENT_START_JOBS.map((job) => job.executionEnvironment)
    ).toEqual(["ExternalPoA", "ControlPlane", "ControlPlane", "ControlPlane"]);

    for (const profileId of EXTERNAL_ASSESSMENT_PROFILE_IDS) {
      const compiled = compileExternalAssessment({ profileId });
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) {
        continue;
      }
      expect(compiled.assessment.executable).toBe(true);
      expect(compiled.assessment.jobsQueued).toBe(0);
      expect(compiled.assessment.profileId).toBe(profileId);
    }
  });

  it("fails closed on fuzzing, DoS, sqlmap, and Nikto with jobsQueued 0", () => {
    expect(EXTERNAL_ASSESSMENT_DENIED_PROFILE_IDS).toEqual(
      expect.arrayContaining(["fuzzing", "dos", "sqlmap", "nikto"])
    );

    for (const profileId of [
      "fuzzing",
      "dos",
      "sqlmap",
      "nikto",
      "intrusive",
      "exploit"
    ]) {
      const denied = compileExternalAssessment({ profileId });
      expect(denied.ok).toBe(false);
      if (denied.ok) {
        continue;
      }
      expect(denied.code).toBe("external_assessment_profile_not_allowlisted");
      expect(denied.jobsQueued).toBe(0);
      expect(denied.startsJobs).toBe(false);
      expect(denied.executable).toBe(false);
    }
  });

  it("maps tool output to Measured redacted findings and empty output to zero findings", () => {
    const empty = mapExternalAssessmentToolOutput({
      moduleId: "nuclei.external_exposure_safe",
      stdout: "   \n",
      toolId: "nuclei"
    });
    expect(empty.findings).toEqual([]);
    expect(empty.findings.length).toBe(0);
    expect(empty.evidenceBasis).toBe("Measured");

    const nuclei = mapExternalAssessmentToolOutput({
      moduleId: "nuclei.external_exposure_safe",
      stdout:
        '{"template-id":"periscan-safe-http-fingerprint","info":{"name":"fingerprint","severity":"info"},"host":"https://example.com","matched-at":"https://example.com/"}\n',
      toolId: "nuclei"
    });
    expect(nuclei.findings).toHaveLength(1);
    expect(nuclei.findings[0]?.evidenceBasis).toBe("Measured");
    expect(nuclei.findings[0]?.redactionStatus).toBe("Redacted");
    expect(nuclei.findings[0]?.title).toMatch(/fingerprint/i);

    const secret = mapExternalAssessmentToolOutput({
      moduleId: "recon.http_probe",
      stdout:
        "https://example.com Authorization: Bearer super-secret-token-value api_key=abcd1234\n",
      toolId: "httpx"
    });
    expect(secret.findings).toHaveLength(1);
    expect(secret.findings[0]?.evidenceBasis).toBe("Measured");
    expect(secret.findings[0]?.redactionStatus).toBe("Redacted");
    expect(secret.findings[0]?.excerpt).not.toMatch(/super-secret-token-value/);
    expect(secret.findings[0]?.excerpt).not.toMatch(/abcd1234/);
    expect(secret.findings[0]?.excerpt).toMatch(/\[REDACTED\]/);
  });

  it("attaches to ContinuousValidation without inventing always-on BAS", () => {
    const attached = attachExternalAssessmentToSchedule({
      profileId: "internet-facing",
      scopeId: "11111111-1111-4111-8111-111111111111"
    });

    expect(attached.ok).toBe(true);
    if (!attached.ok) {
      return;
    }
    expect(attached.schedule.missionType).toBe("ContinuousValidation");
    expect(attached.schedule.alwaysOnBas).toBe(false);
    expect(attached.schedule.jobsQueued).toBe(0);
    expect(
      attached.schedule.config.moduleIds.every((moduleId) =>
        (CONTINUOUS_EASM_SAFE_MODULE_ALLOWLIST as readonly string[]).includes(
          moduleId
        )
      )
    ).toBe(true);
    expect(attached.schedule.config.moduleIds).toContain(
      "nuclei.external_exposure_safe"
    );
    expect(attached.schedule.honesty).toMatch(/not always-on BAS/i);
  });
});
