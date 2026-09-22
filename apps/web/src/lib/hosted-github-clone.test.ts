import { describe, expect, it } from "vitest";

import {
  HOSTED_GITHUB_CLONE_FOLLOW_UP,
  hostedGitHubCloneCommand,
  hostedGitHubCloneUrl
} from "./hosted-github-clone";

describe("hosted GitHub clone refuse copy", () => {
  it("turns a hosted GitHub paste into git clone of the .git URL", () => {
    expect(
      hostedGitHubCloneCommand("https://github.com/acme/payments-api")
    ).toBe("git clone https://github.com/acme/payments-api.git");
    expect(hostedGitHubCloneUrl("https://github.com/acme/payments-api")).toBe(
      "https://github.com/acme/payments-api.git"
    );
  });

  it("tells the operator to paste the local absolute path after git clone", () => {
    expect(HOSTED_GITHUB_CLONE_FOLLOW_UP).toMatch(/local absolute path/i);
    expect(HOSTED_GITHUB_CLONE_FOLLOW_UP).not.toMatch(/oauth/i);
    expect(HOSTED_GITHUB_CLONE_FOLLOW_UP).not.toMatch(/connect a source/i);
  });

  it("does not invent a clone command for a local path", () => {
    expect(hostedGitHubCloneCommand("/opt/customer/repo")).toBeNull();
    expect(hostedGitHubCloneCommand("github.com/acme")).toBeNull();
  });
});
