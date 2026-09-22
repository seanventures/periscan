import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import {
  PINNED_CALDERA_PLANNER_ID,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
  resolveBasScenarioStart,
  StartBasScenarioResultSchema
} from "@periscan/shared";

import { evaluateModuleStartConstraints, getModuleById } from "./index.js";
import {
  CalderaAdapterError,
  createCalderaOperationsClient
} from "./caldera-operations-adapter.js";

const API_KEY = "test-caldera-key";
const UNREVIEWED_EXFIL_ABILITY_ID = "ea713bc4-63f0-491c-9a6f-0b01d560b87e";

type MockExchange = {
  body: unknown;
  method: string;
  url: string;
};

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

describe("Caldera operations HTTP adapter (PERISCAN-587)", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          })
      )
    );
    delete process.env.PERISCAN_LIVE_OFFENSIVE;
  });

  it("creates, starts, stops, and ingests a reviewed operation against pinned mock HTTP", async () => {
    const exchanges: MockExchange[] = [];
    const operationId = "op-reviewed-1";
    let state = "paused";
    const server = createServer((request, response) => {
      void (async () => {
        const raw = await readBody(request);
        const parsedBody = raw ? JSON.parse(raw) : null;
        exchanges.push({
          body: parsedBody,
          method: request.method ?? "GET",
          url: request.url ?? ""
        });
        if (request.headers.key !== API_KEY) {
          json(response, 401, { error: "missing KEY" });
          return;
        }
        if (
          request.method === "POST" &&
          request.url === "/api/v2/adversaries"
        ) {
          json(response, 200, {
            adversary_id: parsedBody.adversary_id,
            atomic_ordering: parsedBody.atomic_ordering,
            name: parsedBody.name
          });
          return;
        }
        if (request.method === "POST" && request.url === "/api/v2/operations") {
          state = parsedBody.state;
          json(response, 200, {
            adversary: { adversary_id: parsedBody.adversary.adversary_id },
            chain: [],
            id: operationId,
            name: parsedBody.name,
            planner: parsedBody.planner,
            state
          });
          return;
        }
        if (
          request.method === "PATCH" &&
          request.url === `/api/v2/operations/${operationId}`
        ) {
          state = parsedBody.state;
          json(response, 200, { id: operationId, state });
          return;
        }
        if (
          request.method === "GET" &&
          request.url === `/api/v2/operations/${operationId}`
        ) {
          json(response, 200, {
            chain: [
              {
                ability: {
                  ability_id: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
                  name: "PowerShell version",
                  plugin: "stockpile",
                  technique_id: "T1082"
                },
                command: "SECRET_COMMAND",
                id: "link-1",
                output: "SECRET_OUTPUT",
                paw: "paw-1",
                status: 0
              }
            ],
            id: operationId,
            name: "reviewed-discovery",
            planner: { id: PINNED_CALDERA_PLANNER_ID },
            state
          });
          return;
        }
        if (
          request.method === "POST" &&
          request.url === `/api/v2/operations/${operationId}/report`
        ) {
          json(response, 200, {
            name: "reviewed-discovery",
            steps: {}
          });
          return;
        }
        json(response, 404, { error: "unhandled" });
      })();
    });
    servers.push(server);
    const baseUrl = await listen(server);
    const client = createCalderaOperationsClient({
      apiKey: API_KEY,
      baseUrl
    });

    const created = await client.createOperation({
      abilityIds: [PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID],
      name: "reviewed-discovery"
    });
    expect(created.operationId).toBe(operationId);
    expect(created.state).toBe("paused");
    expect(created.jobsQueued).toBe(0);

    const createOp = exchanges.find(
      (exchange) =>
        exchange.method === "POST" && exchange.url === "/api/v2/operations"
    );
    expect(createOp?.body).toMatchObject({
      auto_close: true,
      autonomous: 0,
      obfuscator: "plain-text",
      planner: { id: "atomic" },
      state: "paused"
    });

    const started = await client.startOperation(operationId);
    expect(started.state).toBe("running");

    const stopped = await client.stopOperation(operationId);
    expect(stopped.state).toBe("finished");

    const ingested = await client.ingestOperation(operationId);
    expect(ingested.liveSupported).toBe(false);
    expect(ingested.startable).toBe(false);
    expect(ingested.queued).toBe(false);
    expect(ingested.jobsQueued).toBe(0);
    expect(ingested.evidenceProduced).toBe(false);
    expect(ingested.steps[0]).toMatchObject({
      abilityId: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
      status: "success",
      techniqueId: "T1082"
    });
    expect(JSON.stringify(ingested)).not.toContain("SECRET_");
    expect(
      exchanges.every((exchange) => !exchange.url.includes("/runner"))
    ).toBe(true);
  });

  it("creates and ingests the reviewed T1033 Current User ability against pinned mock HTTP", async () => {
    const exchanges: MockExchange[] = [];
    const operationId = "op-t1033-1";
    const server = createServer((request, response) => {
      void (async () => {
        const raw = await readBody(request);
        const parsedBody = raw ? JSON.parse(raw) : null;
        exchanges.push({
          body: parsedBody,
          method: request.method ?? "GET",
          url: request.url ?? ""
        });
        if (request.headers.key !== API_KEY) {
          json(response, 401, { error: "missing KEY" });
          return;
        }
        if (
          request.method === "POST" &&
          request.url === "/api/v2/adversaries"
        ) {
          json(response, 200, {
            adversary_id: parsedBody.adversary_id,
            atomic_ordering: parsedBody.atomic_ordering,
            name: parsedBody.name
          });
          return;
        }
        if (request.method === "POST" && request.url === "/api/v2/operations") {
          json(response, 200, {
            chain: [],
            id: operationId,
            name: parsedBody.name,
            planner: parsedBody.planner,
            state: parsedBody.state
          });
          return;
        }
        if (
          request.method === "GET" &&
          request.url === `/api/v2/operations/${operationId}`
        ) {
          json(response, 200, {
            chain: [
              {
                ability: {
                  ability_id: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
                  name: "Current User",
                  plugin: "stockpile",
                  technique_id: "T1033"
                },
                command: "whoami",
                id: "link-t1033",
                output: "SECRET_USER",
                paw: "paw-t1033",
                status: 0
              }
            ],
            id: operationId,
            name: "reviewed-t1033",
            planner: { id: PINNED_CALDERA_PLANNER_ID },
            state: "finished"
          });
          return;
        }
        if (
          request.method === "POST" &&
          request.url === `/api/v2/operations/${operationId}/report`
        ) {
          json(response, 200, { name: "reviewed-t1033", steps: {} });
          return;
        }
        json(response, 404, { error: "unhandled" });
      })();
    });
    servers.push(server);
    const client = createCalderaOperationsClient({
      apiKey: API_KEY,
      baseUrl: await listen(server)
    });

    const created = await client.createOperation({
      abilityIds: [PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID],
      name: "reviewed-t1033"
    });
    expect(created.jobsQueued).toBe(0);
    expect(created.state).toBe("paused");

    const adversary = exchanges.find(
      (exchange) =>
        exchange.method === "POST" && exchange.url === "/api/v2/adversaries"
    );
    expect(adversary?.body).toMatchObject({
      atomic_ordering: [PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID]
    });

    const ingested = await client.ingestOperation(operationId);
    expect(ingested.liveSupported).toBe(false);
    expect(ingested.startable).toBe(false);
    expect(ingested.queued).toBe(false);
    expect(ingested.jobsQueued).toBe(0);
    expect(ingested.steps[0]).toMatchObject({
      abilityId: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
      name: "Current User",
      status: "success",
      techniqueId: "T1033"
    });
    expect(JSON.stringify(ingested)).not.toContain("SECRET_USER");
    expect(JSON.stringify(ingested)).not.toMatch(/whoami/i);
  });

  it("does not send HTTP when an unreviewed ability is requested", async () => {
    let hits = 0;
    const server = createServer((_request, response) => {
      hits += 1;
      json(response, 500, { error: "should not be called" });
    });
    servers.push(server);
    const baseUrl = await listen(server);
    const client = createCalderaOperationsClient({
      apiKey: API_KEY,
      baseUrl
    });

    await expect(
      client.createOperation({
        abilityIds: [
          PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
          UNREVIEWED_EXFIL_ABILITY_ID
        ],
        name: "should-fail"
      })
    ).rejects.toMatchObject({
      code: "ability_not_allowlisted",
      name: "CalderaAdapterError"
    });
    expect(hits).toBe(0);
  });

  it("cancels an operation with cleanup and refuses a later start", async () => {
    const states: string[] = [];
    const operationId = "op-cancel-1";
    const server = createServer((request, response) => {
      void (async () => {
        const raw = await readBody(request);
        const parsedBody = raw ? JSON.parse(raw) : null;
        if (request.headers.key !== API_KEY) {
          json(response, 401, { error: "missing KEY" });
          return;
        }
        if (
          request.method === "POST" &&
          request.url === "/api/v2/adversaries"
        ) {
          json(response, 200, {
            adversary_id: parsedBody.adversary_id,
            atomic_ordering: parsedBody.atomic_ordering
          });
          return;
        }
        if (request.method === "POST" && request.url === "/api/v2/operations") {
          json(response, 200, {
            id: operationId,
            name: parsedBody.name,
            state: "paused"
          });
          return;
        }
        if (
          request.method === "PATCH" &&
          request.url === `/api/v2/operations/${operationId}`
        ) {
          states.push(parsedBody.state);
          json(response, 200, { id: operationId, state: parsedBody.state });
          return;
        }
        if (
          request.method === "GET" &&
          request.url === `/api/v2/operations/${operationId}`
        ) {
          json(response, 200, {
            chain: [
              {
                ability: {
                  ability_id: PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
                  name: "Print Working Directory",
                  plugin: "stockpile",
                  technique_id: "T1083"
                },
                id: "link-2",
                paw: "paw-2",
                status: -3
              }
            ],
            id: operationId,
            name: "cancel-me",
            planner: { id: "atomic" },
            state: "cleanup"
          });
          return;
        }
        if (
          request.method === "POST" &&
          request.url === `/api/v2/operations/${operationId}/report`
        ) {
          json(response, 200, { name: "cancel-me", steps: {} });
          return;
        }
        json(response, 404, { error: "unhandled" });
      })();
    });
    servers.push(server);
    const client = createCalderaOperationsClient({
      apiKey: API_KEY,
      baseUrl: await listen(server)
    });

    await client.createOperation({
      abilityIds: [PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID],
      name: "cancel-me"
    });
    const cancelled = await client.cancelOperation(operationId);
    expect(states).toEqual(["cleanup"]);
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.state).toBe("cancelled");
    expect(cancelled.jobsQueued).toBe(0);

    const ingested = await client.ingestOperation(operationId);
    expect(ingested.cancelled).toBe(true);
    expect(ingested.steps[0]?.status).toBe("cancelled");

    await expect(client.startOperation(operationId)).rejects.toMatchObject({
      code: "operation_cancelled"
    });
  });

  it("rejects non-isolated Caldera URLs and missing API keys", () => {
    expect(() =>
      createCalderaOperationsClient({
        apiKey: API_KEY,
        baseUrl: "https://caldera.mitre.org"
      })
    ).toThrow(CalderaAdapterError);
    expect(() =>
      createCalderaOperationsClient({
        apiKey: API_KEY,
        baseUrl: "http://169.254.169.254/"
      })
    ).toThrow(CalderaAdapterError);
    expect(() =>
      createCalderaOperationsClient({
        apiKey: API_KEY,
        baseUrl: "file:///etc/passwd"
      })
    ).toThrow(CalderaAdapterError);
    expect(() =>
      createCalderaOperationsClient({
        apiKey: "",
        baseUrl: "http://127.0.0.1:8888"
      })
    ).toThrow(CalderaAdapterError);
  });

  it("keeps caldera.advanced_adversarial liveSupported false and live starts denied with nothing queued", () => {
    expect(process.env.PERISCAN_LIVE_OFFENSIVE).toBeUndefined();
    const caldera = getModuleById("caldera.advanced_adversarial");
    expect(caldera?.manifest.liveSupported).toBe(false);

    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [caldera!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedOffensive: true,
          dryRun: false,
          scopeVerified: true
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "caldera_live_disabled"
    });

    const resolved = resolveBasScenarioStart({
      scenarioId: "caldera.live",
      scopeId: randomUUID()
    });
    expect(resolved.queueable).toBe(false);
    expect(resolved.denyReason).toMatch(/never queued/i);
    expect(
      StartBasScenarioResultSchema.parse({
        claimClass: "qualification_required",
        denyReason: resolved.denyReason,
        jobsQueued: 0,
        mission: null,
        outcome: "Denied",
        policyDecisionId: randomUUID(),
        queued: false,
        rationale: resolved.denyReason ?? "denied",
        runs: [],
        scenarioId: "caldera.live"
      }).jobsQueued
    ).toBe(0);
  });
});
