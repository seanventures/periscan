import { describe, expect, it } from "vitest";

import {
  buildInfrastructureFileSuggestion,
  buildInfrastructurePullRequestIssueComment,
  buildInfrastructureUnifiedDiff,
  findUnsafeInfrastructureContent,
  IAC_SUGGESTION_MAX_LINES
} from "./infrastructure-changes.js";

describe("infrastructure change safety", () => {
  it("builds a bounded exact diff with unchanged context", () => {
    const diff = buildInfrastructureUnifiedDiff({
      after:
        'terraform {\n  required_version = ">= 1.9"\n}\nresource "aws_s3_bucket" "proof" {\n  force_destroy = false\n}\n',
      before:
        'terraform {\n  required_version = ">= 1.9"\n}\nresource "aws_s3_bucket" "proof" {\n  force_destroy = true\n}\n',
      filePath: "infra/main.tf"
    });

    expect(diff).toContain("--- a/infra/main.tf");
    expect(diff).toContain("+++ b/infra/main.tf");
    expect(diff).toContain("-  force_destroy = true");
    expect(diff).toContain("+  force_destroy = false");
    expect(diff).toContain(' resource "aws_s3_bucket" "proof" {');
  });

  it("blocks literal credentials while allowing variable references", () => {
    expect(
      findUnsafeInfrastructureContent(
        'password = "literal-password"\naccess_token: github_pat_abcdefghijklmnopqrstuvwxyz123456'
      )
    ).toEqual(expect.arrayContaining(["literal_password", "github_token"]));
    expect(
      findUnsafeInfrastructureContent(
        "password = var.database_password\nsecret = ${data.vault_secret.current.value}"
      )
    ).toEqual([]);
  });
});

describe("infrastructure PR comment + file suggestion (Slice B / row 70)", () => {
  const before = `terraform {
  required_version = ">= 1.9"
}

resource "aws_s3_bucket" "proof" {
  force_destroy = true
}
`;
  const after = before.replace("force_destroy = true", "force_destroy = false");

  it("builds a real PR issue comment with remediation gates (not export-only hints)", () => {
    const diff = buildInfrastructureUnifiedDiff({
      after,
      before,
      filePath: "infra/main.tf"
    });
    const body = buildInfrastructurePullRequestIssueComment({
      filePath: "infra/main.tf",
      previewHash: "a".repeat(64),
      remediationId: "rem-123",
      unifiedDiff: diff
    });

    expect(body).toContain("rem-123");
    expect(body).toContain("infra/main.tf");
    expect(body).toContain("does not** merge");
    expect(body).toMatch(/does not.*Fixed/i);
    expect(body).toContain("```diff");
    expect(body).toContain("force_destroy = false");
    // Must not read like the export-only Terraform locals template.
    expect(body).not.toContain("periscan_execution_mode");
    expect(body).not.toContain("export-only");
  });

  it("builds an optional GitHub file suggestion for a contiguous line edit", () => {
    const suggestion = buildInfrastructureFileSuggestion({
      after,
      before,
      filePath: "infra/main.tf",
      previewHash: "b".repeat(64),
      remediationId: "rem-456"
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion?.path).toBe("infra/main.tf");
    expect(suggestion?.side).toBe("RIGHT");
    expect(suggestion?.startSide).toBe("RIGHT");
    expect(suggestion?.startLine).toBeLessThanOrEqual(suggestion!.line);
    expect(suggestion?.body).toContain("```suggestion");
    expect(suggestion?.body).toContain("force_destroy = false");
    expect(suggestion?.body).toMatch(/Merge ≠ Fixed|revalidate/i);
  });

  it("skips suggestions when the replacement span exceeds the bounded line cap", () => {
    const bigBefore = Array.from(
      { length: IAC_SUGGESTION_MAX_LINES + 5 },
      (_, i) => `line_${i} = "old"`
    ).join("\n");
    const bigAfter = Array.from(
      { length: IAC_SUGGESTION_MAX_LINES + 5 },
      (_, i) => `line_${i} = "new"`
    ).join("\n");
    expect(
      buildInfrastructureFileSuggestion({
        after: bigAfter,
        before: bigBefore,
        filePath: "infra/big.tf",
        previewHash: "c".repeat(64),
        remediationId: "rem-big"
      })
    ).toBeNull();
  });

  it("skips suggestions when content is identical", () => {
    expect(
      buildInfrastructureFileSuggestion({
        after: before,
        before,
        filePath: "infra/main.tf",
        previewHash: "d".repeat(64),
        remediationId: "rem-noop"
      })
    ).toBeNull();
  });
});
