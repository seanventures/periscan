import { describe, expect, it } from "vitest";

import {
  COMMUNITY_DEFAULT_START_AFTER_FINDING_HEADLINE,
  COMMUNITY_DEFAULT_START_AFTER_FINDING_SENTENCE,
  COMMUNITY_DEFAULT_START_HEADLINE,
  COMMUNITY_DEFAULT_START_SENTENCE
} from "./aev-bas-copy";

describe("always-on Community board copy", () => {
  it("does not sell a first-hour demo as the product", () => {
    const blob = [
      COMMUNITY_DEFAULT_START_HEADLINE,
      COMMUNITY_DEFAULT_START_SENTENCE,
      COMMUNITY_DEFAULT_START_AFTER_FINDING_HEADLINE,
      COMMUNITY_DEFAULT_START_AFTER_FINDING_SENTENCE
    ].join("\n");
    expect(blob).not.toMatch(/first[- ]hour/i);
    expect(blob).toMatch(/keep proving/i);
  });

  it("keeps Gitleaks as the default start and Fixed after retest", () => {
    expect(COMMUNITY_DEFAULT_START_HEADLINE).toMatch(/Gitleaks/i);
    expect(COMMUNITY_DEFAULT_START_HEADLINE).toMatch(/keep proving/i);
    expect(COMMUNITY_DEFAULT_START_SENTENCE).toMatch(/Gitleaks/i);
    expect(COMMUNITY_DEFAULT_START_SENTENCE).toMatch(/keep/i);
    expect(COMMUNITY_DEFAULT_START_AFTER_FINDING_HEADLINE).toMatch(/Keep proving/i);
    expect(COMMUNITY_DEFAULT_START_AFTER_FINDING_SENTENCE).toMatch(/retest/i);
  });
});
