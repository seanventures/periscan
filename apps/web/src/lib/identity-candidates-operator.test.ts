import { describe, expect, it } from "vitest";

import {
  IDENTITY_ABUSE_BLOCKED_NOTE,
  identityCandidateAbuseGate,
  operatorCopyViolations,
  pendingIdentityPromoteCandidates
} from "./continuous-external-operator";

describe("IdP identity candidates in discovery UI", () => {
  it("lists IdP inventory as pending promote-to-scope and blocks identity abuse until verified", () => {
    const pending = pendingIdentityPromoteCandidates([
      {
        autoAddedToScope: false,
        displayName: "Periscan Admin",
        externalId: "00u-admin",
        inVerifiedScope: false,
        kind: "user",
        promotion: "promote-to-scope"
      },
      {
        autoAddedToScope: false,
        displayName: "Promoted app",
        externalId: "0oa-prod",
        inVerifiedScope: true,
        kind: "app",
        promotion: "promote-to-scope"
      }
    ]);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.externalId).toBe("00u-admin");

    const blocked = identityCandidateAbuseGate({
      promoted: false,
      verificationStatus: "Pending"
    });
    expect(blocked.canRunIdentityAbuse).toBe(false);
    expect(blocked.reason).toBe(IDENTITY_ABUSE_BLOCKED_NOTE);

    const verified = identityCandidateAbuseGate({
      promoted: true,
      verificationStatus: "Verified"
    });
    expect(verified.canRunIdentityAbuse).toBe(true);
    expect(verified.reason).toBeNull();
    expect(operatorCopyViolations(IDENTITY_ABUSE_BLOCKED_NOTE)).toEqual([]);
  });
});
