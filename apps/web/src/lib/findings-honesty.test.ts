import { describe, expect, it } from "vitest";

import {
  FINDINGS_HONESTY_AFTER_FIXED,
  FINDINGS_HONESTY_NEEDS_VERIFY,
  findingsHonestyCopy
} from "./findings-honesty";

describe("findingsHonestyCopy", () => {
  it("requires a verification event before remediations are measured Fixed", () => {
    expect(findingsHonestyCopy([])).toBe(FINDINGS_HONESTY_NEEDS_VERIFY);
    expect(findingsHonestyCopy([{ status: "Open" }])).toBe(
      FINDINGS_HONESTY_NEEDS_VERIFY
    );
    expect(
      findingsHonestyCopy([{ latestVerification: null, status: "Fixed" }])
    ).toBe(FINDINGS_HONESTY_NEEDS_VERIFY);
  });

  it("names measured Fixed and keeps pathless Gitleaks Open", () => {
    expect(
      findingsHonestyCopy([
        {
          latestVerification: { outcome: "Fixed" },
          status: "Fixed"
        }
      ])
    ).toBe(FINDINGS_HONESTY_AFTER_FIXED);
    expect(FINDINGS_HONESTY_AFTER_FIXED).toMatch(/Pathless Gitleaks stay Open/i);
    expect(FINDINGS_HONESTY_AFTER_FIXED).not.toMatch(
      /still requires a verification event/i
    );
  });
});
