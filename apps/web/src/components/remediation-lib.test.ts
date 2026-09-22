import { describe, expect, it } from "vitest";

import { remediationRowTitle } from "./remediation-lib";

const generic =
  "Own and remediate this validated finding; re-run the originating module or snapshot to verify.";
const genericSteps = [
  "Confirm ownership and target SLA for this finding fingerprint.",
  "Apply the smallest fix that addresses the measured or correlated cause.",
  "Re-run the originating validation module or Validation Snapshot; do not mark Fixed without a re-test."
] as const;
const fingerprint =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("remediationRowTitle (P3-REMTITLE)", () => {
  it("prefers the finding path · rule locator when the action text is generic", () => {
    expect(
      remediationRowTitle(
        {
          recommendedAction: generic,
          relatedFindingFingerprint: fingerprint,
          technicalSteps: genericSteps
        },
        { location: "leaked.js:2", ruleId: "slack-bot-token" }
      )
    ).toBe("leaked.js:2 · slack-bot-token");
  });

  it("uses the finding file basename so AppSec can grep the leak", () => {
    expect(
      remediationRowTitle(
        {
          recommendedAction: generic,
          relatedFindingFingerprint: fingerprint,
          technicalSteps: genericSteps
        },
        {
          location: "/tmp/customer/repo/leaked.js:2",
          ruleId: "slack-bot-token"
        }
      )
    ).toBe("leaked.js:2 · slack-bot-token");
  });

  it("does not replace a specific recommended action with the finding locator", () => {
    expect(
      remediationRowTitle(
        {
          recommendedAction: "Rotate the exposed Slack bot token.",
          relatedFindingFingerprint: fingerprint,
          technicalSteps: ["Rotate the secret in leaked.js (slack-bot-token)."]
        },
        { location: "leaked.js:2", ruleId: "slack-bot-token" }
      )
    ).toBe("Rotate the exposed Slack bot token.");
  });
});
