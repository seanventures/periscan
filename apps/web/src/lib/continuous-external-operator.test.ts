import { describe, expect, it } from "vitest";

import { ScheduleFrequencySchema } from "@periscan/shared";

import {
  API_SCHEDULE_FREQUENCIES,
  EXTERNAL_ASSESSMENT_PRIMARY_CTA,
  HOURLY_CADENCE_UNAVAILABLE_NOTE,
  IDENTITY_ABUSE_BLOCKED_NOTE,
  INVASIVE_VALIDATE_BLOCKED_NOTE,
  OPERATOR_COPY_DENY_PHRASES,
  canStartExternalAssessment,
  discoveryCandidateValidateGate,
  honestApiEmpty,
  operatorCopyViolations,
  pendingPromoteCandidates,
  scheduleCadencesForUi,
  scopeTypeForCandidateHostname
} from "./continuous-external-operator";

describe("scheduleCadencesForUi", () => {
  it("shows Hourly/Continuous/Daily/Weekly/Monthly from the live API enum", () => {
    const cadences = scheduleCadencesForUi(API_SCHEDULE_FREQUENCIES);

    expect(API_SCHEDULE_FREQUENCIES).toEqual(
      expect.arrayContaining([
        "Hourly",
        "Continuous",
        "Daily",
        "Weekly",
        "Monthly"
      ])
    );
    expect(ScheduleFrequencySchema.options).toEqual(
      expect.arrayContaining([...API_SCHEDULE_FREQUENCIES])
    );
    expect(cadences.frequencies).toEqual([
      "Hourly",
      "Continuous",
      "Daily",
      "Weekly",
      "Monthly"
    ]);
    expect(cadences.hourlySupported).toBe(true);
    expect(cadences.continuousFrequencySupported).toBe(true);
    expect(cadences.hourlyHonesty).toBeNull();
  });

  it("surfaces Hourly and Continuous frequencies only when the API lists them", () => {
    const cadences = scheduleCadencesForUi([
      "Hourly",
      "Continuous",
      "Daily",
      "Weekly"
    ]);

    expect(cadences.frequencies).toEqual([
      "Hourly",
      "Continuous",
      "Daily",
      "Weekly"
    ]);
    expect(cadences.hourlySupported).toBe(true);
    expect(cadences.continuousFrequencySupported).toBe(true);
    expect(cadences.hourlyHonesty).toBeNull();
  });
});

describe("canStartExternalAssessment", () => {
  it("starts only from a verified Domain", () => {
    expect(
      canStartExternalAssessment({
        scopeType: "Domain",
        verificationStatus: "Verified"
      })
    ).toBe(true);
    expect(
      canStartExternalAssessment({
        scopeType: "Domain",
        verificationStatus: "Pending"
      })
    ).toBe(false);
    expect(
      canStartExternalAssessment({
        scopeType: "Subdomain",
        verificationStatus: "Verified"
      })
    ).toBe(false);
    expect(
      canStartExternalAssessment({
        scopeType: "IPRange",
        verificationStatus: "Verified"
      })
    ).toBe(false);
    expect(canStartExternalAssessment(null)).toBe(false);
  });
});

describe("discovery candidates", () => {
  it("lists unattributed candidates pending promote-to-scope and blocks invasive Validate until verified", () => {
    const pending = pendingPromoteCandidates([
      {
        assetId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        hostnames: ["shadow.example.net"],
        name: "shadow.example.net",
        ownershipStatus: "UnattributedCandidate",
        reviewDisposition: null
      },
      {
        assetId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        hostnames: ["owned.example.com"],
        name: "owned.example.com",
        ownershipStatus: "ExactScope",
        reviewDisposition: null
      },
      {
        assetId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        hostnames: ["noise.test"],
        name: "noise.test",
        ownershipStatus: "UnattributedCandidate",
        reviewDisposition: "Dismissed"
      }
    ]);

    expect(pending).toHaveLength(1);
    expect(pending[0]?.hostnames).toEqual(["shadow.example.net"]);

    const unverified = discoveryCandidateValidateGate({
      verificationStatus: "Pending"
    });
    expect(unverified.canValidateInvasive).toBe(false);
    expect(unverified.reason).toBe(INVASIVE_VALIDATE_BLOCKED_NOTE);

    const unverifiedMissing = discoveryCandidateValidateGate({
      verificationStatus: null
    });
    expect(unverifiedMissing.canValidateInvasive).toBe(false);

    const verified = discoveryCandidateValidateGate({
      verificationStatus: "Verified"
    });
    expect(verified.canValidateInvasive).toBe(true);
    expect(verified.reason).toBeNull();
  });

  it("maps candidate hostnames to pending Domain or Subdomain scope types", () => {
    expect(scopeTypeForCandidateHostname("example.com")).toBe("Domain");
    expect(scopeTypeForCandidateHostname("login.other.test")).toBe("Subdomain");
  });
});

describe("honest API empty + copy deny-list", () => {
  it("treats 404 as honest empty, not theater", () => {
    expect(honestApiEmpty(404)).toBe(true);
    expect(honestApiEmpty(500)).toBe(false);
    expect(honestApiEmpty(null)).toBe(false);
  });

  it("never uses NodeZero, automated pentest, always-on BAS, CTEM %, or invented 5.0", () => {
    expect(operatorCopyViolations("External assessment on a verified Domain.")).toEqual(
      []
    );
    expect(EXTERNAL_ASSESSMENT_PRIMARY_CTA).toBe("Start external assessment");
    expect(operatorCopyViolations(HOURLY_CADENCE_UNAVAILABLE_NOTE)).toEqual([]);
    expect(operatorCopyViolations(INVASIVE_VALIDATE_BLOCKED_NOTE)).toEqual([]);
    expect(operatorCopyViolations(IDENTITY_ABUSE_BLOCKED_NOTE)).toEqual([]);

    for (const phrase of OPERATOR_COPY_DENY_PHRASES) {
      expect(operatorCopyViolations(`Please buy ${phrase} today`)).toContain(
        phrase
      );
    }
    expect(operatorCopyViolations("CTEM 82% exposure")).toContain("CTEM %");
    expect(operatorCopyViolations("honest 5.0 ship gate")).toContain("5.0");
  });
});
