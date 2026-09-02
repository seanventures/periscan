/**
 * Continuous loop Slice D — safety scaffolds 16/21/22 + AI ops floors 59/61/64.
 *
 * Safety:
 *  - Inventory API documents APT plan_only, ransomware forever_refuse,
 *    identity exposure_only
 *  - Module catalog pins kill-chain liveSupported:false and identity spray
 *    liveSupported:false
 *
 * AI ops floors (safe canaries only):
 *  - #59 AI Control Validation — fixture measured:false + bounded live pass
 *  - #61 Prompt Injection — benign corpus only; external jailbreak denied via suite path
 *  - #64 Model extraction resistance — honesty API + multi-probe never weight theft
 *
 * Scorecard JSON is not edited by this slice.
 */
import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  buildModelExtractionHonesty,
  listSafetyScaffoldCorePacks
} from "../../packages/shared/src/index.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("Slice D safety scaffolds + AI ops floors", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "slice-d-safety",
        "slice-d-ai-ops"
      ]);
      await prisma.$disconnect();
    }
  });

  it("inventory API + module catalog pin 16 plan_only / 21 forever_refuse / 22 exposure_only", async () => {
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
        "slice-d-safety-packs",
        "Slice D Safety Tenant"
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
        safetyEquivalentScorecardIds: number[];
        scaffoldCoreScorecardIds: number[];
        packs: Array<{
          scorecardId: number;
          claimClass: string;
          honestSubstituteVerdict: string;
          canElevateSubstituteToPartial: boolean;
          foreverRefuse: string[];
          safeModules: string[];
        }>;
        note: string;
      };

      expect(body.scaffoldCoreScorecardIds).toEqual([16, 21, 22]);
      expect(body.safetyEquivalentScorecardIds).toEqual([16, 19, 21, 22]);
      expect(listSafetyScaffoldCorePacks().map((p) => p.scorecardId)).toEqual([
        16, 21, 22
      ]);

      const apt = body.packs.find((p) => p.scorecardId === 16);
      expect(apt?.claimClass).toBe("plan_only");
      expect(apt?.honestSubstituteVerdict).toBe("Partial");
      expect(apt?.canElevateSubstituteToPartial).toBe(true);
      expect(apt?.safeModules).toContain("exploitation.killchain.engine");
      expect(apt?.foreverRefuse.join(" ")).toMatch(/APT|exploit chain/i);

      const ransomware = body.packs.find((p) => p.scorecardId === 21);
      expect(ransomware?.claimClass).toBe("forever_refuse");
      expect(ransomware?.honestSubstituteVerdict).toBe("ForeverRefuse");
      expect(ransomware?.canElevateSubstituteToPartial).toBe(false);
      expect(ransomware?.foreverRefuse.join(" ")).toMatch(/ransomware/i);
      expect(ransomware?.safeModules.join(" ")).not.toMatch(
        /ransomware_live|encrypt/i
      );

      const identity = body.packs.find((p) => p.scorecardId === 22);
      expect(identity?.claimClass).toBe("exposure_only");
      expect(identity?.honestSubstituteVerdict).toBe("Partial");
      expect(identity?.canElevateSubstituteToPartial).toBe(true);
      expect(identity?.safeModules).toContain("gitleaks.repo_secrets");
      expect(identity?.foreverRefuse.join(" ")).toMatch(
        /spray|harvest|SharpHound/i
      );

      expect(body.note).toMatch(/16=plan_only/);
      expect(body.note).toMatch(/21=forever_refuse/);
      expect(body.note).toMatch(/22=exposure_only/);
      expect(JSON.stringify(body)).not.toMatch(
        /live ransomware encryption as product feature/i
      );

      const modules = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/modules"
      });
      expect(modules.statusCode).toBe(200);
      const catalog = modules.json() as {
        items: Array<{
          moduleId: string;
          liveSupported?: boolean;
          customerVisibleDescription?: string;
        }>;
      };
      const moduleIds = catalog.items.map((m) => m.moduleId);

      // Kill-chain is catalog-only / plan-only — never in the executable registry
      // (P05-12). Product truth: no live APT execution path via modules API.
      expect(moduleIds).not.toContain("exploitation.killchain.engine");

      const spray = catalog.items.find(
        (m) => m.moduleId === "identity.cred_spray"
      );
      expect(spray, "identity spray module present").toBeTruthy();
      expect(spray?.liveSupported).toBe(false);
      expect(spray?.customerVisibleDescription ?? "").toMatch(
        /disabled|dry-run|plan/i
      );

      // Adjacent high-impact modules that remain in catalog stay non-live
      const caldera = catalog.items.find(
        (m) => m.moduleId === "caldera.advanced_adversarial"
      );
      if (caldera) {
        expect(caldera.liveSupported).toBe(false);
      }

      // Exposure substitute modules stay available without live harvest
      expect(moduleIds).toContain("gitleaks.repo_secrets");
    } finally {
      await app.close();
    }
  });

  it("AI ops floors 59/61/64 stay safe-canary only (control + prompt injection + model extraction)", async () => {
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
        "slice-d-ai-ops",
        "Slice D AI Ops Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const auth = { [SESSION_COOKIE_NAME]: cookie };
      await prisma.tenant.update({
        data: { billingPackageKey: "AISecurityValidation" },
        where: { tenantId }
      });

      // #64 honesty surface (ops floor — no weight recovery)
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
          dataSourcesDescription: "Disposable synthetic documents only.",
          endpointUrl,
          guardrailsDescription:
            "Canary disclosure and weight/checkpoint recovery are refused.",
          name: "Slice D AI Ops Lab",
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

      async function loadMeasuredFlags(
        evidenceList: Array<{ evidenceId?: string }>
      ): Promise<boolean[]> {
        const flags: boolean[] = [];
        for (const item of evidenceList) {
          if (!item.evidenceId) continue;
          const download = await app.inject({
            cookies: auth,
            method: "GET",
            url: `/api/v1/evidence/${item.evidenceId}/download`
          });
          expect(download.statusCode).toBe(200);
          const body = JSON.parse(download.body) as { content?: unknown };
          const content = body.content;
          const text =
            typeof content === "string"
              ? content
              : JSON.stringify(content ?? body);
          try {
            const parsed = (
              typeof content === "string"
                ? JSON.parse(content)
                : content
            ) as Record<string, unknown>;
            if (typeof parsed.measured === "boolean") {
              flags.push(parsed.measured);
            }
            if (typeof parsed.passFail === "string") {
              // keep for assertions via text
              void parsed.passFail;
            }
            void text;
          } catch {
            // non-json ok
          }
        }
        return flags;
      }

      // #59 / #61 fixture path: measured must stay false
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
      };
      const fixtureMeasured = await loadMeasuredFlags(fixtureBody.evidence);
      expect(fixtureMeasured.length).toBeGreaterThan(0);
      expect(fixtureMeasured.every((flag) => flag === false)).toBe(true);

      // #61 Prompt injection bounded live suite — safe canary only
      const promptInjection = await app.inject({
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
      expect(promptInjection.statusCode).toBe(200);
      const piBody = promptInjection.json() as {
        run: { outcome: string; validationState: string };
        evidence: Array<{ evidenceId?: string }>;
      };
      expect(piBody.run.outcome).toBe("ai_validation_passed");
      expect(piBody.run.validationState).toBe("Validated");
      expect(piBody.evidence.length).toBeGreaterThan(0);

      // External jailbreak corpus must not be runnable as a product path
      const jailbreak = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          corpusVersion: "external-jailbreak-corpus-v9",
          executionMode: "LiveSuite",
          harness: "periscan",
          maxRequests: 1,
          maxResponseBytes: 512,
          timeoutSeconds: 2,
          validationCategory: "PromptInjection",
          // If API accepts free-form notes, still must not claim jailbreak bank
          fixtureNotes: "externalJailbreakCorpus=true"
        },
        url: `/api/v1/ai-apps/${aiAppId}/validate`
      });
      // Either denied (4xx) or completed only via safe path without elevating corpus
      if (jailbreak.statusCode === 200) {
        const jailBody = jailbreak.json() as {
          run?: { outcome?: string };
          evidence?: Array<{ evidenceId?: string }>;
        };
        // Must not invent a successful full jailbreak corpus claim
        const outcome = String(jailBody.run?.outcome ?? "");
        expect(outcome).not.toMatch(/jailbreak_corpus_full|live_jailbreak/i);
      } else {
        expect(jailbreak.statusCode).toBeGreaterThanOrEqual(400);
      }

      // #64 multi-probe extraction resistance
      received.length = 0;
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
      const inputs = received.map((item) => String(item.input ?? ""));
      expect(inputs.some((text) => /weights|checkpoints|gradient/i.test(text))).toBe(
        true
      );
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
      const downloadBody = JSON.parse(download.body) as { content?: unknown };
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
        endpoint.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
