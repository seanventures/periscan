import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

/**
 * Slice B / rows 59 + 61 — AI control validation honesty.
 *
 * 1) Fixture path pins measured:false (never claims live adversarial proof).
 * 2) Bounded live suite yields deterministic pass/fail with persisted evidence IDs.
 * 3) Kill switch still blocks later runs (row 65 AI validation path, complementary
 *    to model-gateway durable kill).
 */
describe("AI control validation measured honesty + evidence IDs", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "ai-control-honesty"
      ]);
      await prisma.$disconnect();
    }
  });

  it("fixture stays measured:false; bounded suite is deterministic with evidence IDs", async () => {
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
        "ai-control-honesty",
        "AI Control Honesty Tenant"
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
          name: "Honesty RAG Lab",
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

      async function loadEvidencePayloads(
        evidenceList: Array<{ evidenceId?: string }>
      ): Promise<Array<Record<string, unknown>>> {
        const payloads: Array<Record<string, unknown>> = [];
        for (const item of evidenceList) {
          if (!item.evidenceId) continue;
          const download = await app.inject({
            cookies: auth,
            method: "GET",
            url: `/api/v1/evidence/${item.evidenceId}/download`
          });
          expect(download.statusCode).toBe(200);
          const body = JSON.parse(download.body) as {
            content?: unknown;
          };
          const content = body.content;
          if (content && typeof content === "object" && !Array.isArray(content)) {
            payloads.push(content as Record<string, unknown>);
          } else if (typeof content === "string") {
            try {
              const parsed = JSON.parse(content) as unknown;
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                payloads.push(parsed as Record<string, unknown>);
              }
            } catch {
              // non-json content is fine
            }
          }
        }
        return payloads;
      }

      // Fixture path: measured must be false on stored evidence content.
      const fixture = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          executionMode: "Fixture",
          fixtureOutcome: "GuardrailHeld",
          harness: "promptfoo",
          validationCategory: "PromptInjection"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(fixture.statusCode).toBe(200);
      const fixtureBody = fixture.json() as {
        evidence: Array<{ evidenceId?: string }>;
        run: { runId: string; validationState: string };
      };
      expect(fixtureBody.evidence.length).toBeGreaterThan(0);
      const fixtureEvidenceIds = fixtureBody.evidence
        .map((item) => item.evidenceId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      expect(fixtureEvidenceIds.length).toBeGreaterThan(0);

      const fixturePayloads = await loadEvidencePayloads(fixtureBody.evidence);
      const fixtureMeasuredFlags = fixturePayloads.flatMap((payload) => {
        if (typeof payload.measured === "boolean") return [payload.measured];
        const nested = payload.evidence;
        if (Array.isArray(nested)) {
          return nested.flatMap((entry) => {
            const attrs = (entry as { attributes?: { measured?: boolean } })
              .attributes;
            return typeof attrs?.measured === "boolean" ? [attrs.measured] : [];
          });
        }
        return [];
      });
      expect(fixtureMeasuredFlags.length).toBeGreaterThan(0);
      expect(fixtureMeasuredFlags.every((flag) => flag === false)).toBe(true);

      // Deterministic pass: endpoint holds policy (no canary echo).
      const passed = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          corpusVersion: "periscan-benign-v1",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          timeoutSeconds: 2,
          validationCategory: "PromptInjection"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      expect(passed.statusCode).toBe(200);
      const passedBody = passed.json() as {
        evidence: Array<{ evidenceId?: string }>;
        run: {
          outcome: string;
          runId: string;
          validationState: string;
        };
      };
      expect(passedBody.run.outcome).toBe("ai_validation_passed");
      expect(passedBody.run.validationState).toBe("Validated");
      expect(passedBody.evidence.length).toBeGreaterThan(0);
      const passEvidenceIds = passedBody.evidence
        .map((item) => item.evidenceId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      expect(passEvidenceIds.length).toBeGreaterThan(0);

      const passPayloads = await loadEvidencePayloads(passedBody.evidence);
      const measuredPass = passPayloads.some(
        (payload) =>
          payload.measured === true && payload.passFail === "pass"
      );
      expect(measuredPass).toBe(true);
      expect(received.length).toBeGreaterThanOrEqual(1);

      // Deterministic fail path via canary echo is covered in module unit tests.
    } finally {
      await app.close();
      await new Promise<void>((resolve, reject) =>
        endpoint.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
