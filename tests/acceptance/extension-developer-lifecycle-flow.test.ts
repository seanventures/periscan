import { generateKeyPairSync, sign } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { signableExtensionContract } from "../../packages/modules/src/index.js";
import type { ExtensionExecutionContract } from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("extension developer lifecycle", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "extension-lifecycle"
      ]);
      await prisma.$disconnect();
    }
  });

  it("scaffolds, certifies, activates, rolls back, and revokes immutable releases without authorizing execution", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      services: createRuntimeServices({ dataRegion: "us-east-1", prisma })
    });
    const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });

    function signedContract(
      digestCharacter: string,
      overrides: Partial<ExtensionExecutionContract> = {}
    ): ExtensionExecutionContract {
      const digest = "sha256:" + digestCharacter.repeat(64);
      const unsigned: Omit<ExtensionExecutionContract, "signature"> = {
        capabilities: ["ReadEvidence"],
        contractVersion: "1.0",
        cpuLimitMillis: 500,
        imageDigest: digest,
        imageReference: "registry.example/safe-source-adapter@" + digest,
        maxOutputBytes: 1_000_000,
        memoryLimitMb: 512,
        networkAllowlist: [],
        outputSchema: {
          additionalProperties: false,
          properties: {
            findings: { items: { type: "object" }, type: "array" }
          },
          required: ["findings"],
          type: "object"
        },
        packageName: "safe-source-adapter",
        redactionFields: ["rawResponse"],
        signerIdentity: "spiffe://example.test/extensions/reviewer",
        signerPublicKeyPem: keys.publicKey.export({
          format: "pem",
          type: "spki"
        }) as string,
        timeoutSeconds: 60,
        ...Object.fromEntries(
          Object.entries(overrides).filter(([key]) => key !== "signature")
        )
      } as Omit<ExtensionExecutionContract, "signature">;
      return {
        ...unsigned,
        signature:
          overrides.signature ??
          sign(
            "sha256",
            signableExtensionContract(unsigned),
            keys.privateKey
          ).toString("base64url")
      };
    }

    try {
      const owner = await testHelpers.performSignup(
        app,
        "extension-lifecycle-owner",
        "Extension Lifecycle Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;

      const projectResponse = await app.inject({
        cookies,
        method: "POST",
        payload: {
          description:
            "Normalize an approved evidence source into typed findings.",
          displayName: "Safe source adapter",
          licenseSpdx: "Apache-2.0",
          packageName: "safe-source-adapter",
          repositoryUrl: "https://github.com/example/safe-source-adapter",
          supportUrl: "https://support.example.test/safe-source-adapter"
        },
        url: "/api/v1/extensions/projects"
      });
      expect(projectResponse.statusCode).toBe(201);
      const projectId = projectResponse.json().extensionProjectId as string;

      const scaffold = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/extensions/projects/" + projectId + "/scaffold"
      });
      expect(scaffold.statusCode).toBe(200);
      expect(scaffold.json()).toMatchObject({
        doesNotExecute: true,
        packageName: "safe-source-adapter",
        scaffoldVersion: "1.0"
      });
      expect(
        scaffold.json().files.map((file: { path: string }) => file.path)
      ).toContain("scripts/sign-contract.mjs");
      expect(JSON.stringify(scaffold.json())).not.toContain(
        "BEGIN PRIVATE KEY"
      );

      async function submitAndCertify(
        version: string,
        contract: ExtensionExecutionContract
      ) {
        const submitted = await app.inject({
          cookies,
          method: "POST",
          payload: { contract, version },
          url: "/api/v1/extensions/projects/" + projectId + "/releases"
        });
        expect(submitted.statusCode).toBe(201);
        expect(submitted.json()).toMatchObject({
          compatible: true,
          executionAuthorized: false,
          status: "Compatible",
          version
        });
        const releaseId = submitted.json().extensionReleaseId as string;
        const certified = await app.inject({
          cookies,
          method: "POST",
          payload: {
            decision: "Certify",
            reason:
              "Security reviewer accepted the bounded contract and support ownership."
          },
          url: "/api/v1/extensions/releases/" + releaseId + "/review"
        });
        expect(certified.statusCode).toBe(200);
        expect(certified.json()).toMatchObject({
          executionAuthorized: false,
          status: "Certified"
        });
        return releaseId;
      }

      const releaseOneId = await submitAndCertify("1.0.0", signedContract("a"));
      const activatedOne = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "Make the first certified version visible in the review catalog."
        },
        url: "/api/v1/extensions/releases/" + releaseOneId + "/activate"
      });
      expect(activatedOne.statusCode).toBe(200);
      expect(activatedOne.json()).toMatchObject({
        executionAuthorized: false,
        status: "CatalogActive"
      });

      const failedContract = signedContract("c", {
        imageReference:
          "registry.example/safe-source-adapter@sha256:" + "d".repeat(64)
      });
      const failedRelease = await app.inject({
        cookies,
        method: "POST",
        payload: { contract: failedContract, version: "1.1.0" },
        url: "/api/v1/extensions/projects/" + projectId + "/releases"
      });
      expect(failedRelease.statusCode).toBe(201);
      expect(failedRelease.json()).toMatchObject({
        compatible: false,
        executionAuthorized: false,
        status: "CompatibilityFailed"
      });
      const failedReview = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Certify",
          reason: "Attempt to bypass the immutable image mismatch should fail."
        },
        url:
          "/api/v1/extensions/releases/" +
          failedRelease.json().extensionReleaseId +
          "/review"
      });
      expect(failedReview.statusCode).toBe(409);

      const releaseTwoId = await submitAndCertify("2.0.0", signedContract("b"));
      expect(
        (
          await app.inject({
            cookies,
            method: "POST",
            payload: {
              reason:
                "Select the reviewed second release for tenant catalog use."
            },
            url: "/api/v1/extensions/releases/" + releaseTwoId + "/activate"
          })
        ).statusCode
      ).toBe(200);

      const afterUpgrade = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/extensions/workspace"
      });
      expect(afterUpgrade.statusCode).toBe(200);
      expect(afterUpgrade.json().releases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            extensionReleaseId: releaseOneId,
            status: "Superseded"
          }),
          expect.objectContaining({
            extensionReleaseId: releaseTwoId,
            status: "CatalogActive"
          })
        ])
      );
      expect(afterUpgrade.json().summary.runtimeExecutionAuthorized).toBe(0);

      const rolledBack = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "Rollback after a support regression while retaining the audit history.",
          targetReleaseId: releaseOneId
        },
        url: "/api/v1/extensions/projects/" + projectId + "/rollback"
      });
      expect(rolledBack.statusCode).toBe(200);
      expect(rolledBack.json()).toMatchObject({
        extensionReleaseId: releaseOneId,
        executionAuthorized: false,
        status: "CatalogActive"
      });

      const revoked = await app.inject({
        cookies,
        method: "POST",
        payload: {
          reason:
            "Revoke the rollback target after the signing identity was retired."
        },
        url: "/api/v1/extensions/releases/" + releaseOneId + "/revoke"
      });
      expect(revoked.statusCode).toBe(200);
      expect(revoked.json()).toMatchObject({
        executionAuthorized: false,
        status: "Revoked"
      });
      const storedProject = await prisma.extensionProject.findUnique({
        where: { extensionProjectId: projectId }
      });
      expect(storedProject).toMatchObject({
        activeReleaseId: null,
        tenantId
      });
      expect(
        await prisma.extensionRelease.count({
          where: { executionAuthorized: true, tenantId }
        })
      ).toBe(0);

      const auditActions = (
        await prisma.auditEvent.findMany({
          select: { action: true },
          where: { tenantId }
        })
      ).map((event) => event.action);
      expect(auditActions).toEqual(
        expect.arrayContaining([
          "extension_project_created",
          "extension_release_submitted",
          "extension_release_reviewed",
          "extension_release_activated",
          "extension_release_revoked"
        ])
      );

      const outsider = await testHelpers.performSignup(
        app,
        "extension-lifecycle-outsider",
        "Extension Outsider Tenant"
      );
      const outsiderWorkspace = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: outsider.cookie },
        method: "GET",
        url: "/api/v1/extensions/workspace"
      });
      expect(outsiderWorkspace.statusCode).toBe(200);
      expect(outsiderWorkspace.json()).toMatchObject({
        projects: [],
        releases: []
      });
    } finally {
      await app.close();
    }
  });
});
