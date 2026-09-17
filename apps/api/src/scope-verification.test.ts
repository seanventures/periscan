import { describe, expect, it } from "vitest";

import {
  buildDnsTxtVerificationName,
  cloudAccountScopeMatchesIntegration,
  dnsTxtRecordsContainToken,
  isSafeAbsoluteRepositoryPath,
  repositoryAuthorizationFilePath,
  verifyDnsTxtScope,
  verifyRepositoryAuthorizationFile
} from "./scope-verification.js";

describe("scope DNS TXT verification", () => {
  it("builds the _periscan TXT verification hostname", () => {
    expect(buildDnsTxtVerificationName("Example.COM.")).toBe(
      "_periscan.example.com"
    );
  });

  it("matches raw, assigned, and split TXT verification tokens", () => {
    expect(
      dnsTxtRecordsContainToken([["periscan-abc123"]], "periscan-abc123")
    ).toBe(true);
    expect(
      dnsTxtRecordsContainToken(
        [["periscan-verification=periscan-abc123"]],
        "periscan-abc123"
      )
    ).toBe(true);
    expect(
      dnsTxtRecordsContainToken([["periscan-", "abc123"]], "periscan-abc123")
    ).toBe(true);
    expect(dnsTxtRecordsContainToken([["unrelated"]], "periscan-abc123")).toBe(
      false
    );
  });

  it("returns verification metadata without throwing when DNS lookup fails", async () => {
    const result = await verifyDnsTxtScope({
      resolver: async () => {
        throw new Error("ENOTFOUND");
      },
      scopeValue: "app.example.com",
      verificationToken: "periscan-token"
    });

    expect(result).toEqual({
      records: [],
      verificationName: "_periscan.app.example.com",
      verified: false
    });
  });
});

describe("Community non-DNS scope verification", () => {
  it("rejects non-absolute or traversal repository paths", () => {
    expect(isSafeAbsoluteRepositoryPath("/opt/customer/repo")).toBe(true);
    expect(isSafeAbsoluteRepositoryPath("../etc/passwd")).toBe(false);
    expect(isSafeAbsoluteRepositoryPath("/opt/customer/../../etc")).toBe(false);
    expect(isSafeAbsoluteRepositoryPath("https://github.com/acme/repo")).toBe(
      false
    );
    expect(repositoryAuthorizationFilePath("/opt/customer/repo")).toBe(
      "/opt/customer/repo/.periscan-authorization"
    );
  });

  it("verifies a repository token file via injected reader", async () => {
    const ok = await verifyRepositoryAuthorizationFile({
      readFile: async () => "periscan-verification=periscan-token",
      repositoryPath: "/opt/customer/repo",
      verificationToken: "periscan-token"
    });
    expect(ok.verified).toBe(true);

    const missing = await verifyRepositoryAuthorizationFile({
      readFile: async () => {
        throw new Error("ENOENT");
      },
      repositoryPath: "/opt/customer/repo",
      verificationToken: "periscan-token"
    });
    expect(missing.verified).toBe(false);
    expect(missing.message).toContain(".periscan-authorization");
  });

  it("matches CloudAccount scopes to AWS integration config", () => {
    expect(
      cloudAccountScopeMatchesIntegration({
        config: { awsAccountId: "123456789012", region: "us-east-1" },
        scopeValue: "123456789012"
      })
    ).toBe(true);
    expect(
      cloudAccountScopeMatchesIntegration({
        config: { account: "999999999999" },
        scopeValue: "123456789012"
      })
    ).toBe(false);
  });
});
