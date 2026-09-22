import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  listObserverHealthSamplesCoveringWindow,
  recordObserverHealthSample,
  toCorrelationHealthSamples
} from "@periscan/db";
import {
  gateMissedByObserverHealth,
  type ObserverHealthSample
} from "@periscan/shared";

import {
  OBSERVER_HEALTH_SAMPLER_LAW,
  mapObserverHealthProbeToPersistedStatus,
  mapObserverHealthProbeToSampleStatus,
  runObserverHealthSamplerTick,
  type ObserverHealthProbe,
  type ObserverHealthSampleStatus
} from "./observer-health-sampler.js";

type HealthStatus = "Healthy" | "Degraded" | "Unhealthy" | "Unknown";

type SampleRecord = {
  controlSourceId: string;
  healthStatus: HealthStatus;
  observerHealthSampleId: string;
  observedAt: Date;
  receivedAt: Date;
  telemetryStatus: HealthStatus;
  tenantId: string;
};

type ControlSourceRow = {
  controlSourceId: string;
  healthStatus: HealthStatus;
  integration: {
    authType: string;
    config: Record<string, unknown>;
    healthStatus: HealthStatus;
    integrationId: string;
    status: string;
  };
  lastValidatedAt: Date | null;
  telemetryStatus: HealthStatus;
  tenantId: string;
};

function createInMemorySamplerClient(sources: ControlSourceRow[]) {
  const samples: SampleRecord[] = [];
  const controlSourceUpdates: unknown[] = [];
  const detectionWrites: unknown[] = [];

  const client = {
    controlSource: {
      findMany: async ({
        where
      }: {
        include?: unknown;
        where?: { tenantId?: { in: string[] } };
      }) =>
        sources.filter((source) => {
          if (!where?.tenantId?.in) {
            return true;
          }
          return where.tenantId.in.includes(source.tenantId);
        }),
      update: async (args: unknown) => {
        controlSourceUpdates.push(args);
        throw new Error(
          "observer health sampler must not mutate ControlSource from a tick"
        );
      }
    },
    observerHealthSample: {
      create: async ({
        data
      }: {
        data: {
          controlSourceId: string;
          healthStatus: HealthStatus;
          observerHealthSampleId?: string;
          observedAt: Date;
          receivedAt?: Date;
          telemetryStatus?: HealthStatus | null;
          tenantId: string;
        };
      }) => {
        const record: SampleRecord = {
          controlSourceId: data.controlSourceId,
          healthStatus: data.healthStatus,
          observerHealthSampleId: data.observerHealthSampleId ?? randomUUID(),
          observedAt: data.observedAt,
          receivedAt: data.receivedAt ?? new Date(),
          telemetryStatus: data.telemetryStatus ?? data.healthStatus,
          tenantId: data.tenantId
        };
        samples.push(record);
        return record;
      },
      findFirst: async ({
        orderBy,
        where
      }: {
        orderBy: { observedAt: "asc" | "desc" };
        where: {
          controlSourceId: string;
          observedAt?: { gte?: Date; lte?: Date };
          tenantId: string;
        };
      }) => {
        const matched = samples
          .filter((sample) => sample.tenantId === where.tenantId)
          .filter((sample) => sample.controlSourceId === where.controlSourceId)
          .filter((sample) => {
            if (
              where.observedAt?.gte &&
              sample.observedAt < where.observedAt.gte
            ) {
              return false;
            }
            if (
              where.observedAt?.lte &&
              sample.observedAt > where.observedAt.lte
            ) {
              return false;
            }
            return true;
          })
          .sort((left, right) =>
            orderBy.observedAt === "asc"
              ? left.observedAt.getTime() - right.observedAt.getTime()
              : right.observedAt.getTime() - left.observedAt.getTime()
          );
        return matched[0] ?? null;
      },
      findMany: async ({
        orderBy,
        where
      }: {
        orderBy: { observedAt: "asc" | "desc" };
        where: {
          controlSourceId: string;
          observedAt?: { gte?: Date; lte?: Date };
          tenantId: string;
        };
      }) =>
        samples
          .filter((sample) => sample.tenantId === where.tenantId)
          .filter((sample) => sample.controlSourceId === where.controlSourceId)
          .filter((sample) => {
            if (
              where.observedAt?.gte &&
              sample.observedAt < where.observedAt.gte
            ) {
              return false;
            }
            if (
              where.observedAt?.lte &&
              sample.observedAt > where.observedAt.lte
            ) {
              return false;
            }
            return true;
          })
          .sort((left, right) =>
            orderBy.observedAt === "asc"
              ? left.observedAt.getTime() - right.observedAt.getTime()
              : right.observedAt.getTime() - left.observedAt.getTime()
          )
    },
    signalEnvelope: {
      create: async (args: unknown) => {
        detectionWrites.push(args);
        throw new Error("observer health samples must not create detections");
      }
    },
    controlValidationVerdictRecord: {
      create: async (args: unknown) => {
        detectionWrites.push(args);
        throw new Error("observer health samples must not create verdicts");
      },
      upsert: async (args: unknown) => {
        detectionWrites.push(args);
        throw new Error("observer health samples must not upsert verdicts");
      }
    }
  };

  return { client, controlSourceUpdates, detectionWrites, samples };
}

function source(overrides?: Partial<ControlSourceRow>): ControlSourceRow {
  const tenantId = overrides?.tenantId ?? randomUUID();
  const integrationId = overrides?.integration?.integrationId ?? randomUUID();
  return {
    controlSourceId: overrides?.controlSourceId ?? randomUUID(),
    healthStatus: overrides?.healthStatus ?? "Unknown",
    integration: {
      authType: "mock",
      config: { connectorKey: "splunk", mockMode: true },
      healthStatus: "Unknown",
      integrationId,
      status: "Connected",
      ...overrides?.integration
    },
    lastValidatedAt: overrides?.lastValidatedAt ?? null,
    telemetryStatus: overrides?.telemetryStatus ?? "Unknown",
    tenantId
  };
}

function fixedProbe(status: ObserverHealthSampleStatus): ObserverHealthProbe {
  return async () => ({ status });
}

const WINDOW_START = new Date("2026-09-17T14:00:00.000Z");
const WINDOW_END = new Date("2026-09-17T14:10:00.000Z");

describe("observer health sampler tick (PERISCAN-590)", () => {
  it("documents that samples are observer heartbeats, never detections", () => {
    expect(OBSERVER_HEALTH_SAMPLER_LAW).toMatch(/not detections/i);
    expect(OBSERVER_HEALTH_SAMPLER_LAW).toMatch(/Inconclusive, never Missed/i);
    expect(OBSERVER_HEALTH_SAMPLER_LAW).not.toMatch(/Missed→Degraded/u);
  });

  it("maps connector health onto Healthy, Degraded, or Unreachable", () => {
    expect(mapObserverHealthProbeToSampleStatus("Healthy")).toBe("Healthy");
    expect(mapObserverHealthProbeToSampleStatus("Degraded")).toBe("Degraded");
    expect(mapObserverHealthProbeToSampleStatus("Unhealthy")).toBe(
      "Unreachable"
    );
    expect(mapObserverHealthProbeToSampleStatus("Unknown")).toBe("Unreachable");
    expect(mapObserverHealthProbeToSampleStatus("Unreachable")).toBe(
      "Unreachable"
    );
    expect(mapObserverHealthProbeToPersistedStatus("Unreachable")).toBe(
      "Unhealthy"
    );
    expect(mapObserverHealthProbeToPersistedStatus("Healthy")).toBe("Healthy");
    expect(mapObserverHealthProbeToPersistedStatus("Degraded")).toBe(
      "Degraded"
    );
  });

  it("records Healthy, Degraded, and Unreachable samples for configured ControlSources", async () => {
    const healthy = source({ healthStatus: "Unknown" });
    const degraded = source({ healthStatus: "Unknown" });
    const unreachable = source({ healthStatus: "Unknown" });
    const { client, detectionWrites, samples } = createInMemorySamplerClient([
      healthy,
      degraded,
      unreachable
    ]);
    const now = new Date("2026-09-17T14:05:00.000Z");
    const probe: ObserverHealthProbe = async (controlSource) => {
      if (controlSource.controlSourceId === healthy.controlSourceId) {
        return { status: "Healthy" };
      }
      if (controlSource.controlSourceId === degraded.controlSourceId) {
        return { status: "Degraded" };
      }
      return { status: "Unreachable" };
    };

    const result = await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now,
      prisma: client as never,
      probe
    });

    expect(result.sampled).toBe(3);
    expect(result.healthy).toBe(1);
    expect(result.degraded).toBe(1);
    expect(result.unreachable).toBe(1);
    expect(samples.map((sample) => sample.healthStatus).sort()).toEqual([
      "Degraded",
      "Healthy",
      "Unhealthy"
    ]);
    expect(
      result.samples.find(
        (sample) => sample.controlSourceId === unreachable.controlSourceId
      )
    ).toMatchObject({
      persistedHealthStatus: "Unhealthy",
      sampleStatus: "Unreachable"
    });
    expect(detectionWrites).toEqual([]);
    for (const sample of samples) {
      expect(sample).not.toHaveProperty("marker");
      expect(sample).not.toHaveProperty("eventId");
      expect(sample).not.toHaveProperty("outcome");
      expect(sample).not.toHaveProperty("verdict");
    }
  });

  it("does not copy Missed→Degraded ControlSource health into a sample", async () => {
    const controlSource = source({
      healthStatus: "Degraded",
      lastValidatedAt: new Date("2026-09-17T14:04:00.000Z"),
      telemetryStatus: "Degraded"
    });
    const { client, controlSourceUpdates, samples } =
      createInMemorySamplerClient([controlSource]);

    const result = await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now: new Date("2026-09-17T14:05:00.000Z"),
      prisma: client as never,
      probe: fixedProbe("Healthy")
    });

    expect(result.healthy).toBe(1);
    expect(samples).toHaveLength(1);
    expect(samples[0]?.healthStatus).toBe("Healthy");
    expect(samples[0]?.healthStatus).not.toBe("Degraded");
    expect(controlSourceUpdates).toEqual([]);
  });

  it("does not invent detections when no ControlSources are configured", async () => {
    const { client, detectionWrites, samples } = createInMemorySamplerClient(
      []
    );

    const result = await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now: WINDOW_START,
      prisma: client as never,
      probe: fixedProbe("Healthy")
    });

    expect(result).toMatchObject({
      degraded: 0,
      healthy: 0,
      sampled: 0,
      skipped: 0,
      unreachable: 0
    });
    expect(samples).toEqual([]);
    expect(detectionWrites).toEqual([]);
    expect(toCorrelationHealthSamples(samples)).toEqual([]);
  });

  it("keeps stale sampled series Inconclusive, never Missed", async () => {
    const controlSource = source();
    const { client } = createInMemorySamplerClient([controlSource]);
    const staleAt = new Date("2026-09-17T12:00:00.000Z");

    await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now: staleAt,
      prisma: client as never,
      probe: fixedProbe("Healthy")
    });

    const covering = await listObserverHealthSamplesCoveringWindow(
      client as never,
      {
        controlSourceId: controlSource.controlSourceId,
        tenantId: controlSource.tenantId,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      }
    );
    const healthSamples: ObserverHealthSample[] =
      toCorrelationHealthSamples(covering);

    expect(
      gateMissedByObserverHealth("Missed", {
        healthSamples,
        healthStatus: "Healthy",
        lastValidatedAt: staleAt.toISOString(),
        telemetryStatus: "Healthy",
        windowEnd: WINDOW_END.toISOString(),
        windowStart: WINDOW_START.toISOString()
      })
    ).toBe("Inconclusive");
  });

  it("lets a Healthy covering tick series remain Missed-eligible", async () => {
    const controlSource = source();
    const { client } = createInMemorySamplerClient([controlSource]);

    for (const now of [
      new Date("2026-09-17T13:59:00.000Z"),
      new Date("2026-09-17T14:05:00.000Z"),
      new Date("2026-09-17T14:11:00.000Z")
    ]) {
      await runObserverHealthSamplerTick({
        minIntervalMs: 0,
        now,
        prisma: client as never,
        probe: fixedProbe("Healthy")
      });
    }

    const covering = await listObserverHealthSamplesCoveringWindow(
      client as never,
      {
        controlSourceId: controlSource.controlSourceId,
        tenantId: controlSource.tenantId,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      }
    );

    expect(
      gateMissedByObserverHealth("Missed", {
        healthSamples: toCorrelationHealthSamples(covering),
        healthStatus: "Healthy",
        lastValidatedAt: WINDOW_END.toISOString(),
        telemetryStatus: "Healthy",
        windowEnd: WINDOW_END.toISOString(),
        windowStart: WINDOW_START.toISOString()
      })
    ).toBe("Missed");
  });

  it("treats an in-window Unreachable sample as Inconclusive, never Missed", async () => {
    const controlSource = source({ healthStatus: "Healthy" });
    const { client } = createInMemorySamplerClient([controlSource]);

    await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now: new Date("2026-09-17T13:59:00.000Z"),
      prisma: client as never,
      probe: fixedProbe("Healthy")
    });
    await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now: new Date("2026-09-17T14:05:00.000Z"),
      prisma: client as never,
      probe: fixedProbe("Unreachable")
    });
    await runObserverHealthSamplerTick({
      minIntervalMs: 0,
      now: new Date("2026-09-17T14:11:00.000Z"),
      prisma: client as never,
      probe: fixedProbe("Healthy")
    });

    const covering = await listObserverHealthSamplesCoveringWindow(
      client as never,
      {
        controlSourceId: controlSource.controlSourceId,
        tenantId: controlSource.tenantId,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      }
    );

    expect(
      gateMissedByObserverHealth("Missed", {
        healthSamples: toCorrelationHealthSamples(covering),
        healthStatus: "Healthy",
        lastValidatedAt: WINDOW_END.toISOString(),
        telemetryStatus: "Healthy",
        windowEnd: WINDOW_END.toISOString(),
        windowStart: WINDOW_START.toISOString()
      })
    ).toBe("Inconclusive");
  });

  it("is wired from the API validation sweep and runner heartbeat tick", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const scheduler = readFileSync(
      resolve(here, "../system-scheduler.ts"),
      "utf8"
    );
    const runner = readFileSync(resolve(here, "./runner.ts"), "utf8");

    expect(scheduler).toContain("runObserverHealthSamplerTick");
    expect(runner).toContain("runObserverHealthSamplerTick");
  });
});

describe("recordObserverHealthSample still refuses verdict copies", () => {
  it("can persist a Healthy sample even when a prior helper wrote Degraded", async () => {
    const { client } = createInMemorySamplerClient([]);
    const tenantId = randomUUID();
    const controlSourceId = randomUUID();

    await recordObserverHealthSample(client as never, {
      controlSourceId,
      healthStatus: "Degraded",
      observedAt: WINDOW_START,
      tenantId
    });
    await recordObserverHealthSample(client as never, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: new Date("2026-09-17T14:05:00.000Z"),
      tenantId
    });

    const covering = await listObserverHealthSamplesCoveringWindow(
      client as never,
      {
        controlSourceId,
        tenantId,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      }
    );
    expect(covering.map((sample) => sample.healthStatus)).toEqual([
      "Degraded",
      "Healthy"
    ]);
  });
});
