/**
 * Continuous loop Slice C — honesty + product depth for residual Partial/Scaffold rows.
 *
 * Covers:
 *  - #2 / #26 / #28 Partner-gated shells (safety packs + enterprise readiness)
 *  - #47 Execution integrity honesty (verifier role; host TEE refused)
 *  - #64 Model extraction resistance multi-probe suite (never weight theft)
 *  - #98 Marketplace NotConfigured honesty residual
 *
 * Scorecard JSON is not edited by this slice.
 */
import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  buildExecutionIntegrityHonesty,
  buildModelExtractionHonesty,
  listPartnerGatedPacks
} from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("Slice C partials honesty acceptance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "slice-c-partials"
      ]);
      await prisma.$disconnect();
    }
  });

  it("partner packs 2/26/28 stay ExternallyGated + safety inventory exposes partner ids", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "slice-c-partials-partner",
        "Slice C Partner Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      const packs = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/safety-equivalent-packs"
      });
      expect(packs.statusCode).toBe(200);
      const body = packs.json() as {
        partnerGatedScorecardIds: number[];
        packs: Array<{ scorecardId: number; gate: string; claimClass: string }>;
      };
      expect(body.partnerGatedScorecardIds).toEqual([2, 26, 28]);
      expect(listPartnerGatedPacks().map((p) => p.scorecardId)).toEqual([
        2, 26, 28
      ]);
      for (const id of [2, 26, 28]) {
        const pack = body.packs.find((p) => p.scorecardId === id);
        expect(pack?.gate).toBe("Partner");
        expect(pack?.claimClass).toBe("forever_refuse");
      }
      expect(JSON.stringify(body.packs)).toMatch(/dark-web crawl/i);

      const enterprise = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/packs/enterprise-readiness"
      });
      expect(enterprise.statusCode).toBe(200);
      const enterpriseBody = enterprise.json() as {
        packs: Array<{ key: string; state: string; description: string }>;
      };
      for (const key of [
        "ot-ics",
        "credential-exposure",
        "human-validation"
      ]) {
        const pack = enterpriseBody.packs.find((p) => p.key === key);
        expect(pack?.state, key).toBe("ExternallyGated");
      }
      expect(
        enterpriseBody.packs.find((p) => p.key === "credential-exposure")
          ?.description
      ).toMatch(/#2/i);
      expect(
        enterpriseBody.packs.find((p) => p.key === "ot-ics")?.description
      ).toMatch(/#26/i);
      expect(
        enterpriseBody.packs.find((p) => p.key === "human-validation")
          ?.description
      ).toMatch(/#28/i);
    } finally {
      await app.close();
    }
  });

  it("execution integrity honesty refuses host TEE and exposes verifier surfaces", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "slice-c-partials-integrity",
        "Slice C Integrity Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      const response = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/execution-integrity/honesty"
      });
      expect(response.statusCode).toBe(200);
      const honesty = response.json() as ReturnType<
        typeof buildExecutionIntegrityHonesty
      >;
      expect(honesty.scorecardId).toBe(47);
      expect(honesty.productRole).toBe("verifier");
      expect(honesty.hostTeeWorkloads).toBe(false);
      expect(
        honesty.surfaces.find((s) => s.key === "host-tee")?.state
      ).toBe("Refused");
      expect(
        honesty.surfaces.filter((s) => s.state === "Available").length
      ).toBeGreaterThanOrEqual(3);
      expect(honesty.foreverRefuse.join(" ")).toMatch(/TEE|enclave/i);
    } finally {
      await app.close();
    }
  });

  it("model extraction resistance multi-probe suite never attempts weight recovery", async () => {
    const received: Array<Record<string, unknown>> = [];
    const endpoint = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        received.push(JSON.parse(body) as Record<string, unknown>);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ answer: "POLICY_HELD" }));
      });
    });
    await new Promise<void>((resolve) =>
      endpoint.listen(0, "127.0.0.1", resolve)
    );
    const address = endpoint.address();
    if (!address || typeof address === "string") {
      throw new Error("Local AI validation endpoint did not bind a TCP port.");
    }
    const endpointUrl = `http://127.0.0.1:${address.port}/authorized-ai-test`;

    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        "slice-c-partials-weight",
        "Slice C Weight Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const auth = { [SESSION_COOKIE_NAME]: cookie };
      await prisma.tenant.update({
        data: { billingPackageKey: "AISecurityValidation" },
        where: { tenantId }
      });

      const honestyRes = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/model-extraction-resistance/honesty"
      });
      expect(honestyRes.statusCode).toBe(200);
      const honesty = honestyRes.json() as ReturnType<
        typeof buildModelExtractionHonesty
      >;
      expect(honesty.scorecardId).toBe(64);
      expect(honesty.weightExtractionAttempted).toBe(false);
      expect(honesty.modelWeightRecovery).toBe(false);
      expect(honesty.probes.length).toBeGreaterThanOrEqual(5);

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { scopeType: "AIApplicationEndpoint", value: endpointUrl },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verified = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      const created = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          appType: "RAG",
          authMethod: "none",
          dataSourcesDescription: "Synthetic test corpus only",
          endpointUrl,
          guardrailsDescription:
            "Refuse weight/checkpoint/gradient disclosure; POLICY_HELD on canary.",
          name: "Slice C extraction resistance target",
          owner: "slice-c@periscan.test",
          ragEnabled: false,
          scopeId,
          testAccountNotes: "Local disposable test endpoint; no credentials.",
          toolsEnabled: false
        },
        url: "/api/v1/ai-apps"
      });
      expect(created.statusCode).toBe(201);
      const aiAppId = created.json().aiAppId as string;

      const extraction = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          corpusVersion: "periscan-benign-v1",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 5,
          maxResponseBytes: 512,
          timeoutSeconds: 2,
          validationCategory: "ModelExtractionResistance"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(extraction.statusCode).toBe(200);
      expect(received.length).toBe(5);
      // Distinct probe intents across the multi-probe corpus
      const inputs = received.map((item) => String(item.input ?? ""));
      expect(inputs.some((text) => /fingerprint drill/i.test(text))).toBe(true);
      expect(inputs.some((text) => /rate-control/i.test(text))).toBe(true);
      expect(inputs.some((text) => /weights|checkpoints|gradient/i.test(text))).toBe(
        true
      );
      // No request asks the model to *provide* extractable weight material as a success path
      for (const text of inputs) {
        expect(text).toMatch(/Do not|do not|POLICY_HELD|refuse/i);
      }

      const evidenceIds = (
        extraction.json().evidence as Array<{ evidenceId: string }>
      ).map((e) => e.evidenceId);
      expect(evidenceIds.length).toBeGreaterThan(0);
      const download = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/evidence/${evidenceIds[0]}/download`
      });
      expect(download.statusCode).toBe(200);
      const downloadBody = JSON.parse(download.body) as {
        content?: unknown;
      };
      const contentText =
        typeof downloadBody.content === "string"
          ? downloadBody.content
          : JSON.stringify(downloadBody.content ?? downloadBody);
      expect(contentText).toMatch(/weightExtractionAttempted/i);
      expect(contentText).toMatch(/false/);
      expect(contentText).not.toMatch(/modelWeightRecovery"\s*:\s*true/);
    } finally {
      await app.close();
      await new Promise<void>((resolve, reject) =>
        endpoint.close((err) => (err ? reject(err) : resolve()))
      );
    }
  });

  it("marketplace listing stays NotConfigured without inventing Public", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "slice-c-partials-market",
        "Slice C Marketplace Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      const status = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/billing/aws-marketplace"
      });
      expect(status.statusCode).toBe(200);
      const body = status.json() as {
        listingState: string;
        publicMarketplaceAvailabilityProven: boolean;
        configured: boolean;
      };
      expect(body.listingState).toBe("NotConfigured");
      expect(body.publicMarketplaceAvailabilityProven).toBe(false);
      // Never invent Public from bare product code
      expect(body.listingState).not.toBe("Public");
    } finally {
      await app.close();
    }
  });
});
