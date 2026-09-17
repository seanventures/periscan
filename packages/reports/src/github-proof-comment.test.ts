import { describe, expect, it } from "vitest";

import {
  renderGithubProofComment,
  type GithubProofCommentInput
} from "./github-proof-comment.js";

const missionUrl = "https://app.periscan.example/missions/m1";

function input(
  overrides: Partial<GithubProofCommentInput> = {}
): GithubProofCommentInput {
  return {
    engines: ["gitleaks", "trivy"],
    findings: [],
    jobsQueued: 2,
    missionUrl,
    policyVerdict: "Allowed",
    ...overrides
  };
}

describe("renderGithubProofComment", () => {
  it("on deny names the verdict and that denied tasks are never queued", () => {
    const markdown = renderGithubProofComment(
      input({
        engines: ["gitleaks"],
        findings: [],
        jobsQueued: 99,
        policyVerdict: "Denied"
      })
    );

    expect(markdown).toMatch(/Denied/);
    expect(markdown.toLowerCase()).toContain("never queued");
    expect(markdown).not.toMatch(/99/);
    expect(markdown).toContain(missionUrl);
  });

  it("never uses the refuse phrase automated pentest", () => {
    const samples = [
      renderGithubProofComment(input()),
      renderGithubProofComment(
        input({
          engines: [],
          findings: [],
          jobsQueued: 0,
          policyVerdict: "Denied"
        })
      ),
      renderGithubProofComment(
        input({
          findings: [
            {
              evidenceCount: 2,
              title: "Repository secret",
              validationState: "Open"
            }
          ]
        })
      )
    ];

    for (const markdown of samples) {
      expect(markdown.toLowerCase()).not.toContain("automated pentest");
    }
  });

  it("does not say Fixed unless a verification flag is true", () => {
    const unverified = renderGithubProofComment(
      input({
        findings: [
          {
            evidenceCount: 1,
            title: "IAM wildcard",
            validationState: "Fixed",
            verified: false
          }
        ]
      })
    );
    expect(unverified).not.toMatch(/\bFixed\b/);
    expect(unverified).toContain("IAM wildcard");

    const omittedFlag = renderGithubProofComment(
      input({
        findings: [
          {
            evidenceCount: 1,
            title: "IAM wildcard",
            validationState: "Fixed"
          }
        ]
      })
    );
    expect(omittedFlag).not.toMatch(/\bFixed\b/);

    const verified = renderGithubProofComment(
      input({
        findings: [
          {
            evidenceCount: 1,
            title: "IAM wildcard",
            validationState: "Fixed",
            verified: true
          }
        ]
      })
    );
    expect(verified).toMatch(/\bFixed\b/);
    expect(verified).toContain("IAM wildcard");
  });

  it("empty findings says empty list, not theater", () => {
    const markdown = renderGithubProofComment(input({ findings: [] }));

    expect(markdown.toLowerCase()).toMatch(/empty list,\s*not theater/);
    expect(markdown.toLowerCase()).not.toContain("no issues found");
    expect(markdown.toLowerCase()).not.toContain("all clear");
  });

  it("on allow lists engines, queued jobs, measured findings, and the mission url", () => {
    const markdown = renderGithubProofComment(
      input({
        engines: ["gitleaks", "osv-scanner"],
        findings: [
          {
            evidenceCount: 3,
            title: "Repository secret",
            validationState: "Open"
          }
        ],
        jobsQueued: 2,
        policyVerdict: "Allowed"
      })
    );

    expect(markdown).toMatch(/Allowed/);
    expect(markdown).toContain("gitleaks");
    expect(markdown).toContain("osv-scanner");
    expect(markdown).toContain("Repository secret");
    expect(markdown).toContain("3");
    expect(markdown).toContain(missionUrl);
    expect(markdown).toMatch(/2/);
    expect(markdown.toLowerCase()).toContain("proof card");
  });
});
