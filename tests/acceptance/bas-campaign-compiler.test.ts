import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import {
  createPrismaClient,
  runWithTenantRls
} from "../../packages/db/src/client.js";
import {
  BAS_BENIGN_MARKER_MODULE_ID,
  BAS_BENIGN_MARKER_SCENARIO_ID,
  CompileBasCampaignResultSchema,
  StartBasCampaignResultSchema,
  CancelBasCampaignResultSchema,
  BasCampaignPlanSchema,
  BasCampaignListSchema
} from "../../packages/shared/src/index.js";
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";
import * as helpers from "./helpers.js";

const prefix = `bas-campaign-${randomUUID()}`;
const enqueueValidationJob = vi.fn(async () => {});
const enqueueTurn = vi.fn(async () => {});

function calderaContent(path = `abilities/${randomUUID()}.json`) {
  return {
    provider: "Caldera",
    format: "json",
    sourceRevision: "campaign-pin-1",
    sourcePath: path,
    content: JSON.stringify([
      {
        id: randomUUID(),
        name: "OS metadata",
        technique: { attack_id: "T1082" },
        platforms: {
          linux: {
            sh: {
              command: "PRIVATE_COMMAND_BODY",
              cleanup: "PRIVATE_CLEANUP_BODY"
            }
          }
        }
      }
    ])
  };
}

describe("BAS campaign compiler with real Postgres", () => {
  let prisma: ReturnType<typeof createPrismaClient>;
  let app: FastifyInstance;
  let a: Awaited<ReturnType<typeof helpers.performSignup>>;
  let b: Awaited<ReturnType<typeof helpers.performSignup>>;
  let tenantA: string;
  let tenantB: string;
  let scopeId: string;
  let unverifiedScopeId: string;
  const cookies = (user: typeof a) => helpers.authCookies(user.cookie);
  const compile = (payload: Record<string, unknown>, user = a) =>
    app.inject({
      method: "POST",
      url: "/api/v1/bas/campaigns/compile",
      cookies: cookies(user),
      payload
    });
  const start = (compiledDigest: string, user = a) =>
    app.inject({
      method: "POST",
      url: "/api/v1/bas/campaigns/start",
      cookies: cookies(user),
      payload: { compiledDigest }
    });
  const cancel = (compiledDigest: string, user = a) =>
    app.inject({
      method: "POST",
      url: "/api/v1/bas/campaigns/cancel",
      cookies: cookies(user),
      payload: { compiledDigest }
    });
  const getPlan = (compiledDigest: string, user = a) =>
    app.inject({
      url: `/api/v1/bas/campaigns/${compiledDigest}`,
      cookies: cookies(user)
    });
  const listPlans = (user = a) =>
    app.inject({
      url: "/api/v1/bas/campaigns",
      cookies: cookies(user)
    });

  async function verifyScope(id: string) {
    const verified = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: { devModeManual: true },
      url: `/api/v1/scopes/${id}/verify`
    });
    expect(verified.statusCode).toBe(200);
  }

  async function compileBenign(overrides: Record<string, unknown> = {}) {
    const response = await compile({
      scopeId,
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ],
      ...overrides
    });
    expect(response.statusCode, response.body).toBe(200);
    return CompileBasCampaignResultSchema.parse(response.json());
  }

  beforeAll(async () => {
    prisma = createPrismaClient();
    await helpers.probeDatabaseConnection(prisma);
    const services = createRuntimeServices({
      prisma,
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: { enqueueValidationJob },
      modelGatewayTurnQueue: { enqueueTurn },
      webhookQueue: null
    });
    app = await buildApp({ services, devMode: true });
    a = await helpers.performSignup(app, `${prefix}-a`, `${prefix}-A`);
    b = await helpers.performSignup(app, `${prefix}-b`, `${prefix}-B`);
    tenantA = a.response.json().tenant.tenantId;
    tenantB = b.response.json().tenant.tenantId;

    const scope = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: {
        scopeType: "Domain",
        value: `campaign-${randomUUID()}.example.com`
      },
      url: "/api/v1/scopes"
    });
    expect(scope.statusCode).toBe(201);
    scopeId = scope.json().scopeId as string;
    await verifyScope(scopeId);

    const unverified = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: {
        scopeType: "Domain",
        value: `campaign-unverified-${randomUUID()}.example.com`
      },
      url: "/api/v1/scopes"
    });
    expect(unverified.statusCode).toBe(201);
    unverifiedScopeId = unverified.json().scopeId as string;
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    if (prisma) {
      await helpers.cleanupTestDataByEmailPrefix(prisma, [prefix]);
      await prisma.$disconnect();
    }
  }, 30_000);

  it("compiles a plan without queueing and starts the benign marker idempotently", async () => {
    enqueueValidationJob.mockClear();
    const compiled = await compileBenign();
    expect(compiled.queued).toBe(false);
    expect(compiled.jobsQueued).toBe(0);
    expect(compiled.startable).toBe(true);
    expect(compiled.plan.startable).toBe(true);
    expect(enqueueValidationJob).not.toHaveBeenCalled();
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });

    const first = await start(compiled.plan.compiledDigest);
    expect(first.statusCode, first.body).toBe(200);
    const started = StartBasCampaignResultSchema.parse(first.json());
    expect(started.queued).toBe(true);
    expect(started.jobsQueued).toBeGreaterThan(0);
    expect(started.mission?.missionId).toBeTruthy();
    const jobsAfterFirst = await prisma.job.count({
      where: { tenantId: tenantA }
    });
    expect(jobsAfterFirst).toBeGreaterThan(jobsBefore);

    const second = await start(compiled.plan.compiledDigest);
    expect(second.statusCode, second.body).toBe(200);
    const replay = StartBasCampaignResultSchema.parse(second.json());
    expect(replay.mission?.missionId).toBe(started.mission?.missionId);
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsAfterFirst
    );
  });

  it("returns 404 across tenants and never leaks a foreign compiled digest", async () => {
    const compiled = await compileBenign({
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
          typedInputs: { isolation: "tenant-b" }
        }
      ]
    });
    expect((await getPlan(compiled.plan.compiledDigest, b)).statusCode).toBe(
      404
    );
    const foreignStart = await start(compiled.plan.compiledDigest, b);
    expect(foreignStart.statusCode).toBe(404);
    expect(foreignStart.json().queued ?? false).toBe(false);
    expect(
      await runWithTenantRls(prisma, tenantB, (tx) =>
        tx.basCampaignPlan.findMany({})
      )
    ).toEqual([]);
  });

  it("denies start when approval is stale, inputs changed, or scope is unverified", async () => {
    const compiled = await compileBenign({
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
          typedInputs: { lane: "stale" }
        }
      ]
    });
    await prisma.policyDecision.update({
      where: { policyDecisionId: compiled.plan.policyDecisionId },
      data: { expiresAt: new Date(Date.now() - 60_000) }
    });
    const stale = StartBasCampaignResultSchema.parse(
      (await start(compiled.plan.compiledDigest)).json()
    );
    expect(stale.outcome).toBe("Denied");
    expect(stale.queued).toBe(false);
    expect(stale.jobsQueued).toBe(0);
    expect(stale.mission).toBeNull();

    const mutable = await compileBenign({
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
          typedInputs: { lane: "mutate" }
        }
      ]
    });
    await runWithTenantRls(prisma, tenantA, (tx) =>
      tx.basCampaignPlan.update({
        where: { basCampaignPlanId: mutable.plan.basCampaignPlanId },
        data: {
          scenarioPins: [
            {
              ...mutable.plan.scenarioPins[0],
              typedInputs: { lane: "changed" }
            }
          ]
        }
      })
    );
    const changed = StartBasCampaignResultSchema.parse(
      (await start(mutable.plan.compiledDigest)).json()
    );
    expect(changed.queued).toBe(false);
    expect(changed.jobsQueued).toBe(0);
    expect(changed.outcome).toBe("Denied");

    const unverified = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId: unverifiedScopeId,
          scenarioPins: [
            {
              provider: "ControlPlane",
              upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
            }
          ]
        })
      ).json()
    );
    expect(unverified.startable).toBe(false);
    expect(unverified.queued).toBe(false);
    const unverifiedStart = StartBasCampaignResultSchema.parse(
      (await start(unverified.plan.compiledDigest)).json()
    );
    expect(unverifiedStart.queued).toBe(false);
    expect(unverifiedStart.jobsQueued).toBe(0);
  });

  it("does not start unreviewed content or queue live Atomic", async () => {
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });
    const registered = await app.inject({
      method: "POST",
      url: "/api/v1/bas/content/versions",
      cookies: cookies(a),
      payload: calderaContent()
    });
    expect(registered.statusCode, registered.body).toBe(200);
    const version = registered.json().version;
    const unreviewed = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId,
          contentVersionIds: [version.basContentVersionId],
          scenarioPins: [
            {
              provider: "Caldera",
              contentVersionId: version.basContentVersionId,
              contentSha256: version.contentSha256,
              upstreamId: version.preview.scenarios[0].upstreamId
            }
          ]
        })
      ).json()
    );
    expect(unreviewed.startable).toBe(false);
    const unreviewedStart = StartBasCampaignResultSchema.parse(
      (await start(unreviewed.plan.compiledDigest)).json()
    );
    expect(unreviewedStart.queued).toBe(false);
    expect(unreviewedStart.jobsQueued).toBe(0);
    expect(unreviewedStart.mission).toBeNull();

    const atomic = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId,
          scenarioPins: [
            { provider: "ControlPlane", upstreamId: "atomic.live" }
          ]
        })
      ).json()
    );
    expect(atomic.startable).toBe(false);
    const atomicStart = StartBasCampaignResultSchema.parse(
      (await start(atomic.plan.compiledDigest)).json()
    );
    expect(atomicStart.outcome).toBe("Denied");
    expect(atomicStart.queued).toBe(false);
    expect(atomicStart.jobsQueued).toBe(0);
    expect(atomicStart.denyReason?.toLowerCase()).toMatch(/atomic/);
    expect(atomicStart.denyReason?.toLowerCase()).toMatch(/never queued/);
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsBefore
    );
  });

  it("denies start when the bound runner is lost and records honest delayed cancel", async () => {
    const tokenResponse = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: {
        deploymentMode: "Docker",
        expiresInSeconds: 3600,
        labels: ["campaign-lost"],
        runnerName: "campaign-lost-runner"
      },
      url: "/api/v1/runners/registration-tokens"
    });
    expect(tokenResponse.statusCode).toBe(201);
    const registerResponse = await app.inject({
      method: "POST",
      payload: {
        arch: "amd64",
        capabilities: {
          supportsArtifactUpload: true,
          supportsHttpConnectProxy: true,
          supportsLocalReachability: true,
          supportsLongPoll: true,
          supportsWebSocket: false
        },
        csrPem: VALID_RUNNER_CSR_PEM,
        deploymentMode: "Docker",
        hostname: "campaign-lost-runner",
        labels: ["campaign-lost"],
        networkProfile: {
          additionalEgressNotes: null,
          dnsResolutionRequired: true,
          explicitProxyUrl: null,
          gatewayHostnames: ["runner.periscan.cloud"],
          httpConnectProxySupported: true,
          outboundHttpsPorts: [443]
        },
        os: "linux",
        registrationToken: tokenResponse.json().registrationToken,
        runnerName: "campaign-lost-runner",
        version: "0.1.0"
      },
      url: "/api/v1/runners/register"
    });
    expect(registerResponse.statusCode, registerResponse.body).toBe(201);
    const runnerId = registerResponse.json().credentials.runnerId as string;
    const lostCompile = await compileBenign({
      runnerId,
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
          typedInputs: { lane: "lost-runner" }
        }
      ]
    });
    const revoke = await app.inject({
      cookies: cookies(a),
      method: "POST",
      url: `/api/v1/runners/${runnerId}/revoke`
    });
    expect(revoke.statusCode).toBe(200);
    const lostStart = StartBasCampaignResultSchema.parse(
      (await start(lostCompile.plan.compiledDigest)).json()
    );
    expect(lostStart.queued).toBe(false);
    expect(lostStart.jobsQueued).toBe(0);
    expect(lostStart.outcome).toBe("Denied");

    const started = await compileBenign({
      scenarioPins: [
        {
          provider: "ControlPlane",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
          typedInputs: { lane: "cancel-race" }
        }
      ]
    });
    const firstStart = StartBasCampaignResultSchema.parse(
      (await start(started.plan.compiledDigest)).json()
    );
    expect(firstStart.mission?.missionId).toBeTruthy();
    const run = await prisma.validationRun.findFirstOrThrow({
      where: { missionId: firstStart.mission!.missionId }
    });
    await prisma.runnerTask.create({
      data: {
        envelope: {},
        expiresAt: new Date(Date.now() + 600_000),
        inputs: {},
        issuedAt: new Date(),
        leasedAt: new Date(),
        missionId: firstStart.mission!.missionId,
        moduleId: run.moduleId,
        nonce: randomUUID(),
        runId: run.runId,
        runnerId,
        safetyLevel: run.safetyLevel,
        scopeConstraints: {},
        scopeId,
        status: "Leased",
        target: {},
        tenantId: tenantA
      }
    });

    const [cancelOne, cancelTwo] = await Promise.all([
      cancel(started.plan.compiledDigest),
      cancel(started.plan.compiledDigest)
    ]);
    expect(cancelOne.statusCode).toBe(200);
    expect(cancelTwo.statusCode).toBe(200);
    const cancelled = CancelBasCampaignResultSchema.parse(cancelOne.json());
    expect(cancelled.dispatchPrevented).toBe(true);
    expect(cancelled.cancelRequested).toBe(true);
    expect(cancelled.delayedCancel).toBe(true);
    expect(cancelled.cleanup.some((step) => step.status === "pending")).toBe(
      true
    );
    const afterCancel = StartBasCampaignResultSchema.parse(
      (await start(started.plan.compiledDigest)).json()
    );
    expect(afterCancel.queued).toBe(false);
    expect(afterCancel.jobsQueued).toBe(0);
    expect(
      BasCampaignPlanSchema.parse(
        (await getPlan(started.plan.compiledDigest)).json()
      ).compiledDigest
    ).toBe(started.plan.compiledDigest);
  });

  it("lists tenant campaign previews with digest, policy, typed inputs, and does not leak foreign plans", async () => {
    const empty = BasCampaignListSchema.parse((await listPlans()).json());
    const compiled = await compileBenign({
      scenarioPins: [
        {
          provider: "ControlPlane",
          typedInputs: { lane: "list-preview" },
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ]
    });
    expect(compiled.queued).toBe(false);
    expect(compiled.jobsQueued).toBe(0);

    const listed = BasCampaignListSchema.parse((await listPlans()).json());
    const preview = listed.items.find(
      (item) => item.plan.compiledDigest === compiled.plan.compiledDigest
    );
    expect(preview).toMatchObject({
      jobsQueued: 0,
      plan: {
        compiledDigest: compiled.plan.compiledDigest,
        startable: true
      }
    });
    expect(preview?.plan.scenarioPins[0]?.typedInputs).toEqual({
      lane: "list-preview"
    });
    expect(preview?.policyOutcome).toBeTruthy();
    expect(preview?.cleanup).toEqual([]);

    const foreign = BasCampaignListSchema.parse((await listPlans(b)).json());
    expect(
      foreign.items.some(
        (item) => item.plan.compiledDigest === compiled.plan.compiledDigest
      )
    ).toBe(false);
    expect(empty.items.every((item) => item.plan.tenantId === tenantA)).toBe(
      true
    );
  });

  it("compiles a bounded acyclic DAG, fails closed on cycles, and never queues live packs", async () => {
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });
    const acyclic = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId,
          scenarioPins: [
            {
              provider: "ControlPlane",
              stepKey: "recon",
              typedInputs: { lane: "dag-recon" },
              upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
            },
            {
              dependsOn: ["recon"],
              provider: "ControlPlane",
              stepKey: "marker",
              typedInputs: { lane: "dag-marker" },
              upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
            }
          ]
        })
      ).json()
    );
    expect(acyclic.queued).toBe(false);
    expect(acyclic.jobsQueued).toBe(0);
    expect(acyclic.startable).toBe(true);
    expect(acyclic.plan.dependencyGraph).toEqual({
      edges: [{ from: "marker", to: "recon" }],
      executionOrder: ["recon", "marker"],
      nodes: ["recon", "marker"]
    });

    const cyclic = await compile({
      scopeId,
      scenarioPins: [
        {
          dependsOn: ["b"],
          provider: "ControlPlane",
          stepKey: "a",
          typedInputs: { lane: "dag-cycle" },
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        },
        {
          dependsOn: ["a"],
          provider: "ControlPlane",
          stepKey: "b",
          typedInputs: { lane: "dag-cycle" },
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ]
    });
    expect(cyclic.statusCode).toBe(400);
    expect(cyclic.json().error ?? "").toMatch(/cycle/i);
    expect(
      await runWithTenantRls(prisma, tenantA, (tx) =>
        tx.basCampaignPlan.count({
          where: {
            tenantId: tenantA,
            compiledDigest: cyclic.json().compiledDigest ?? "not-a-digest"
          }
        })
      )
    ).toBe(0);

    const liveDag = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId,
          scenarioPins: [
            {
              provider: "ControlPlane",
              stepKey: "atomic",
              upstreamId: "atomic.live"
            },
            {
              dependsOn: ["atomic"],
              provider: "ControlPlane",
              stepKey: "caldera",
              upstreamId: "caldera.live"
            },
            {
              dependsOn: ["caldera"],
              provider: "ControlPlane",
              stepKey: "metasploit",
              upstreamId: "metasploit.live"
            }
          ]
        })
      ).json()
    );
    expect(liveDag.startable).toBe(false);
    expect(liveDag.queued).toBe(false);
    expect(liveDag.jobsQueued).toBe(0);
    const liveStart = StartBasCampaignResultSchema.parse(
      (await start(liveDag.plan.compiledDigest)).json()
    );
    expect(liveStart.queued).toBe(false);
    expect(liveStart.jobsQueued).toBe(0);
    expect(liveStart.mission).toBeNull();
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsBefore
    );
  });

  it("starts an allowed DAG in topological order and never queues live or unreviewed pins", async () => {
    enqueueValidationJob.mockClear();
    const jobsBefore = await prisma.job.count({ where: { tenantId: tenantA } });
    const compiled = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId,
          scenarioPins: [
            {
              dependsOn: ["recon"],
              provider: "ControlPlane",
              stepKey: "marker",
              typedInputs: { lane: "start-dag-marker" },
              upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
            },
            {
              provider: "ControlPlane",
              stepKey: "recon",
              typedInputs: { lane: "start-dag-recon" },
              upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
            }
          ]
        })
      ).json()
    );
    expect(compiled.startable).toBe(true);
    expect(compiled.plan.dependencyGraph.executionOrder).toEqual([
      "recon",
      "marker"
    ]);

    const started = StartBasCampaignResultSchema.parse(
      (await start(compiled.plan.compiledDigest)).json()
    );
    expect(started.outcome).toBe("Allowed");
    expect(started.queued).toBe(true);
    expect(started.jobsQueued).toBe(2);
    expect(started.runs).toHaveLength(2);
    expect(started.runs.map((run) => run.moduleId)).toEqual([
      BAS_BENIGN_MARKER_MODULE_ID,
      BAS_BENIGN_MARKER_MODULE_ID
    ]);
    expect(
      (started.runs[0]?.target as { executionOrder?: string[] }).executionOrder
    ).toEqual(["recon", "marker"]);
    expect(
      (started.runs[0]?.target as { queuedStepKeys?: string[] }).queuedStepKeys
    ).toEqual(["recon", "marker"]);
    expect(
      await prisma.job.count({
        where: { missionId: started.mission!.missionId, tenantId: tenantA }
      })
    ).toBe(2);
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsBefore + 2
    );

    const replay = StartBasCampaignResultSchema.parse(
      (await start(compiled.plan.compiledDigest)).json()
    );
    expect(replay.mission?.missionId).toBe(started.mission?.missionId);
    expect(replay.jobsQueued).toBe(2);
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsBefore + 2
    );

    const mixedLive = CompileBasCampaignResultSchema.parse(
      (
        await compile({
          scopeId,
          scenarioPins: [
            {
              provider: "ControlPlane",
              stepKey: "marker",
              typedInputs: { lane: "mixed-live-marker" },
              upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
            },
            {
              dependsOn: ["marker"],
              provider: "ControlPlane",
              stepKey: "atomic",
              upstreamId: "atomic.live"
            }
          ]
        })
      ).json()
    );
    expect(mixedLive.startable).toBe(false);
    const mixedStart = StartBasCampaignResultSchema.parse(
      (await start(mixedLive.plan.compiledDigest)).json()
    );
    expect(mixedStart.queued).toBe(false);
    expect(mixedStart.jobsQueued).toBe(0);
    expect(mixedStart.mission).toBeNull();
    expect(mixedStart.denyReason?.toLowerCase()).toMatch(/atomic/);
    expect(await prisma.job.count({ where: { tenantId: tenantA } })).toBe(
      jobsBefore + 2
    );
  });

  it("records pending cleanup until an adapter receipt exists and never claims succeeded without one", async () => {
    const started = await compileBenign({
      scenarioPins: [
        {
          provider: "ControlPlane",
          stepKey: "marker",
          typedInputs: { lane: "cleanup-receipt" },
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }
      ]
    });
    const firstStart = StartBasCampaignResultSchema.parse(
      (await start(started.plan.compiledDigest)).json()
    );
    expect(firstStart.mission?.missionId).toBeTruthy();
    const run = await prisma.validationRun.findFirstOrThrow({
      where: { missionId: firstStart.mission!.missionId }
    });
    const tokenResponse = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: {
        deploymentMode: "Docker",
        expiresInSeconds: 3600,
        labels: ["campaign-cleanup"],
        runnerName: "campaign-cleanup-runner"
      },
      url: "/api/v1/runners/registration-tokens"
    });
    expect(tokenResponse.statusCode).toBe(201);
    const registerResponse = await app.inject({
      method: "POST",
      payload: {
        arch: "amd64",
        capabilities: {
          supportsArtifactUpload: true,
          supportsHttpConnectProxy: true,
          supportsLocalReachability: true,
          supportsLongPoll: true,
          supportsWebSocket: false
        },
        csrPem: VALID_RUNNER_CSR_PEM,
        deploymentMode: "Docker",
        hostname: "campaign-cleanup-runner",
        labels: ["campaign-cleanup"],
        networkProfile: {
          additionalEgressNotes: null,
          dnsResolutionRequired: true,
          explicitProxyUrl: null,
          gatewayHostnames: ["runner.periscan.cloud"],
          httpConnectProxySupported: true,
          outboundHttpsPorts: [443]
        },
        os: "linux",
        registrationToken: tokenResponse.json().registrationToken,
        runnerName: "campaign-cleanup-runner",
        version: "0.1.0"
      },
      url: "/api/v1/runners/register"
    });
    expect(registerResponse.statusCode, registerResponse.body).toBe(201);
    const runnerId = registerResponse.json().credentials.runnerId as string;
    await prisma.runnerTask.create({
      data: {
        envelope: {},
        expiresAt: new Date(Date.now() + 600_000),
        inputs: {},
        issuedAt: new Date(),
        leasedAt: new Date(),
        missionId: firstStart.mission!.missionId,
        moduleId: run.moduleId,
        nonce: randomUUID(),
        runId: run.runId,
        runnerId,
        safetyLevel: run.safetyLevel,
        scopeConstraints: {},
        scopeId,
        status: "Leased",
        target: { scenarioId: BAS_BENIGN_MARKER_SCENARIO_ID },
        tenantId: tenantA
      }
    });

    const pendingCancel = CancelBasCampaignResultSchema.parse(
      (await cancel(started.plan.compiledDigest)).json()
    );
    expect(pendingCancel.dispatchPrevented).toBe(true);
    expect(pendingCancel.delayedCancel).toBe(true);
    expect(pendingCancel.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          receiptSha256: null,
          status: "pending",
          stepKey: "marker"
        })
      ])
    );
    expect(
      pendingCancel.cleanup.every((step) => step.status !== "succeeded")
    ).toBe(true);

    const receiptSha256 = "c".repeat(64);
    const withReceipt = await app.inject({
      cookies: cookies(a),
      method: "POST",
      payload: {
        compiledDigest: started.plan.compiledDigest,
        cleanupReceipts: [
          {
            adapter: "ControlPlane",
            outputHash: "d".repeat(64),
            receiptSha256,
            status: "succeeded",
            stepKey: "marker",
            verifiedAt: "2026-09-17T12:00:00.000Z"
          }
        ]
      },
      url: "/api/v1/bas/campaigns/cancel"
    });
    expect(withReceipt.statusCode, withReceipt.body).toBe(200);
    const verified = CancelBasCampaignResultSchema.parse(withReceipt.json());
    expect(verified.dispatchPrevented).toBe(true);
    expect(verified.cleanup).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          receiptSha256,
          status: "succeeded",
          stepKey: "marker"
        })
      ])
    );

    await expect(
      runWithTenantRls(prisma, tenantA, (tx) =>
        tx.basCampaignStepCleanup.create({
          data: {
            basCampaignPlanId: started.plan.basCampaignPlanId,
            detail: "forged success",
            status: "succeeded",
            stepKey: "forged",
            tenantId: tenantA
          }
        })
      )
    ).rejects.toThrow();
  });
});
