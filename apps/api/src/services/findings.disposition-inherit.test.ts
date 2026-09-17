import { describe, expect, it } from "vitest";

import type { FindingDispositionOverride } from "@periscan/shared";

import {
  fingerprintDispositionKey,
  resolveFindingDispositionOverride
} from "./findings.js";

function override(
  partial: Partial<FindingDispositionOverride> & {
    disposition: FindingDispositionOverride["disposition"];
  }
): FindingDispositionOverride {
  return {
    approvedAt: null,
    approvedBy: null,
    approvalState: "NotRequired",
    expiresAt: null,
    note: null,
    ownerId: null,
    updatedAt: "2026-07-29T12:00:00.000Z",
    updatedBy: "11111111-1111-4111-8111-111111111111",
    ...partial
  };
}

describe("P06-17 disposition inheritance", () => {
  it("inherits disposition from absorbed member findingId", () => {
    const memberId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const representativeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const dispositions = new Map<string, FindingDispositionOverride>([
      [
        memberId,
        override({
          disposition: "FalsePositive",
          note: "[ToolNoise]",
          updatedAt: "2026-07-29T10:00:00.000Z"
        })
      ]
    ]);

    const resolved = resolveFindingDispositionOverride(
      {
        findingId: representativeId,
        fingerprint: "fp-deadbeef",
        memberFindingIds: [memberId, representativeId]
      },
      dispositions
    );

    expect(resolved?.disposition).toBe("FalsePositive");
    expect(resolved?.inheritedFromFindingId).toBe(memberId);
  });

  it("prefers fingerprint dual-key when newer", () => {
    const representativeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const fingerprint = "sha256:abc";
    const fpKey = fingerprintDispositionKey(fingerprint);
    const dispositions = new Map<string, FindingDispositionOverride>([
      [
        representativeId,
        override({
          disposition: "Acknowledged",
          updatedAt: "2026-07-29T09:00:00.000Z"
        })
      ],
      [
        fpKey,
        override({
          disposition: "Suppressed",
          note: "[DuplicateObservation]",
          updatedAt: "2026-07-29T11:00:00.000Z"
        })
      ]
    ]);

    const resolved = resolveFindingDispositionOverride(
      {
        findingId: representativeId,
        fingerprint,
        memberFindingIds: [representativeId]
      },
      dispositions
    );

    expect(resolved?.disposition).toBe("Suppressed");
    expect(resolved?.inheritedFromFindingId).toBe(fpKey);
  });
});
