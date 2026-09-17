import { generateKeyPairSync, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { ExtensionExecutionContract } from "@periscan/shared";

import {
  evaluateExtensionCompatibility,
  generateExtensionScaffold,
  signableExtensionContract
} from "./extension-sdk.js";

describe("extension SDK compatibility contract", () => {
  it("verifies a signed, digest-pinned, bounded OCI contract", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048
    });
    const digest = `sha256:${"a".repeat(64)}`;
    const unsigned: Omit<ExtensionExecutionContract, "signature"> = {
      capabilities: ["ReadEvidence", "NetworkVerifiedScope"],
      contractVersion: "1.0",
      cpuLimitMillis: 500,
      imageDigest: digest,
      imageReference: `registry.example/periscan/safe-check@${digest}`,
      maxOutputBytes: 1_000_000,
      memoryLimitMb: 512,
      networkAllowlist: ["verified-target.example"],
      outputSchema: {
        additionalProperties: false,
        properties: { verdict: { type: "string" } },
        required: ["verdict"],
        type: "object"
      },
      packageName: "safe-check",
      redactionFields: ["rawResponse"],
      signerIdentity: "spiffe://periscan.example/extensions/reviewer",
      signerPublicKeyPem: publicKey.export({
        format: "pem",
        type: "spki"
      }) as string,
      timeoutSeconds: 60
    };
    const contract: ExtensionExecutionContract = {
      ...unsigned,
      signature: sign(
        "sha256",
        signableExtensionContract(unsigned),
        privateKey
      ).toString("base64url")
    };

    expect(
      evaluateExtensionCompatibility(contract, {
        now: new Date("2026-07-15T07:30:00.000Z")
      })
    ).toMatchObject({
      arbitraryPythonUploadAllowed: false,
      compatible: true,
      executionAuthorized: false,
      requiresCatalogAndSecurityReview: true
    });

    expect(
      evaluateExtensionCompatibility({
        ...contract,
        imageDigest: `sha256:${"b".repeat(64)}`
      })
    ).toMatchObject({ compatible: false });
  });

  it("generates a hashed scaffold that keeps signing keys local", () => {
    const scaffold = generateExtensionScaffold(
      {
        activeReleaseId: null,
        createdAt: "2026-07-15T07:30:00.000Z",
        createdBy: "11111111-1111-4111-8111-111111111111",
        description: "Normalize a customer-authorized source into findings.",
        displayName: "Safe source adapter",
        extensionProjectId: "22222222-2222-4222-8222-222222222222",
        licenseSpdx: "Apache-2.0",
        packageName: "safe-source-adapter",
        repositoryUrl: "https://github.com/example/safe-source-adapter",
        status: "Active",
        supportUrl: "https://support.example/extensions/safe-source-adapter",
        tenantId: "33333333-3333-4333-8333-333333333333",
        updatedAt: "2026-07-15T07:30:00.000Z"
      },
      { now: new Date("2026-07-15T08:00:00.000Z") }
    );

    expect(scaffold.doesNotExecute).toBe(true);
    expect(scaffold.files.map((file) => file.path)).toEqual([
      "extension.contract.json",
      "src/index.ts",
      "src/index.test.ts",
      "scripts/sign-contract.mjs",
      "README.md"
    ]);
    expect(
      scaffold.files.every((file) => file.contentSha256.length === 64)
    ).toBe(true);
    expect(
      scaffold.files.find((file) => file.path === "README.md")?.content
    ).toContain("Private signing keys stay outside Periscan");
  });
});
