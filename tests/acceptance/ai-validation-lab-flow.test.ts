import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("bounded AI validation lab and kill switch", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "ai-validation-lab"
      ]);
      await prisma.$disconnect();
    }
  });

  it("executes a real local synthetic-canary test and blocks every later run after acknowledgement", async () => {
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
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "ai-validation-lab",
        "AI Validation Lab Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = { [SESSION_COOKIE_NAME]: cookie };
      await prisma.tenant.update({
        data: { billingPackageKey: "AISecurityValidation" },
        where: { tenantId }
      });

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
          dataSourcesDescription: "Disposable synthetic documents only.",
          endpointUrl,
          guardrailsDescription: "Canary disclosure is refused.",
          name: "Authorized Local RAG Lab",
          owner: "AI Security",
          ragEnabled: true,
          scopeId,
          testAccountNotes: "Local disposable test endpoint; no credentials.",
          toolsEnabled: false
        },
        url: "/api/v1/ai-apps"
      });
      expect(created.statusCode).toBe(201);
      const aiAppId = created.json().aiAppId as string;

      const validated = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          corpusVersion: "periscan-benign-v1",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          timeoutSeconds: 2,
          validationCategory: "IndirectPromptInjection"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(validated.statusCode).toBe(200);
      expect(validated.json().run).toMatchObject({
        outcome: "ai_validation_passed",
        target: {
          boundedSuite: true,
          corpusVersion: "periscan-benign-v1",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512
        },
        validationState: "Validated"
      });
      expect(validated.json().evidence.length).toBeGreaterThan(0);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        metadata: {
          corpusVersion: "periscan-benign-v1",
          periscanAuthorizedSyntheticTest: true
        }
      });

      const extractionResistance = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          corpusVersion: "periscan-benign-v1",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 3,
          maxResponseBytes: 512,
          timeoutSeconds: 2,
          validationCategory: "ModelExtractionResistance"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(extractionResistance.statusCode).toBe(200);
      expect(extractionResistance.json().run).toMatchObject({
        outcome: "ai_validation_passed",
        validationState: "Validated"
      });
      expect(received).toHaveLength(4);

      const ragPoisoning = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          corpusVersion: "periscan-benign-v1",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          timeoutSeconds: 2,
          validationCategory: "RAGPoisoningResistance"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(ragPoisoning.statusCode).toBe(200);
      expect(ragPoisoning.json().run.validationState).toBe("Validated");
      expect(received).toHaveLength(5);

      const runsBeforeKill = await prisma.validationRun.count({
        where: { moduleId: "ai_app.safe_validation", tenantId }
      });
      const stopped = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          enabled: true,
          reason: "Scheduled kill-switch proof drill"
        },
        url: `/api/v1/ai-apps/${aiAppId}/kill-switch`
      });
      expect(stopped.statusCode).toBe(200);
      expect(stopped.json().validationKillSwitch).toMatchObject({
        enabled: true,
        reason: "Scheduled kill-switch proof drill"
      });

      const blocked = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionMode: "LiveSuite",
          harness: "periscan",
          validationCategory: "PromptInjection"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(blocked.statusCode).toBe(409);
      expect(blocked.json().code).toBe("ai_validation_kill_switch_active");
      expect(received).toHaveLength(5);
      expect(
        await prisma.validationRun.count({
          where: { moduleId: "ai_app.safe_validation", tenantId }
        })
      ).toBe(runsBeforeKill);

      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: {
          action: "ai_validation_kill_switch_changed",
          entityId: aiAppId,
          tenantId
        }
      });
      expect(audit.metadata).toMatchObject({
        enabled: true,
        lastTaskId: ragPoisoning.json().run.runId,
        reason: "Scheduled kill-switch proof drill",
        tasksAcceptedAfterActivation: 0
      });
    } finally {
      await app.close();
      await new Promise<void>((resolve, reject) =>
        endpoint.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
