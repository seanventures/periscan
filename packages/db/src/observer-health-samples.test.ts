import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  listObserverHealthSamplesCoveringWindow,
  recordObserverHealthSample,
  toCorrelationHealthSamples
} from "./observer-health-samples.js";

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

function createInMemoryObserverHealthSampleClient() {
  const samples: SampleRecord[] = [];

  return {
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
    }
  };
}

const WINDOW_START = new Date("2026-09-17T14:00:00.000Z");
const WINDOW_END = new Date("2026-09-17T14:10:00.000Z");

describe("observer health sample persistence (PERISCAN-590)", () => {
  it("writes and reads a tenant-scoped covering series for one control source", async () => {
    const prisma = createInMemoryObserverHealthSampleClient() as never;
    const tenantId = randomUUID();
    const controlSourceId = randomUUID();
    const otherTenantId = randomUUID();

    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: WINDOW_START,
      telemetryStatus: "Healthy",
      tenantId
    });
    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: new Date("2026-09-17T14:05:00.000Z"),
      telemetryStatus: "Healthy",
      tenantId
    });
    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: WINDOW_END,
      telemetryStatus: "Healthy",
      tenantId
    });
    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Unhealthy",
      observedAt: WINDOW_START,
      telemetryStatus: "Unhealthy",
      tenantId: otherTenantId
    });

    const covering = await listObserverHealthSamplesCoveringWindow(prisma, {
      controlSourceId,
      tenantId,
      windowEnd: WINDOW_END,
      windowStart: WINDOW_START
    });

    expect(covering).toHaveLength(3);
    expect(covering.every((sample) => sample.tenantId === tenantId)).toBe(true);
    expect(
      covering.every((sample) => sample.controlSourceId === controlSourceId)
    ).toBe(true);
    expect(covering.map((sample) => sample.healthStatus)).toEqual([
      "Healthy",
      "Healthy",
      "Healthy"
    ]);
  });

  it("returns no samples for a missing observer and does not invent detections", async () => {
    const prisma = createInMemoryObserverHealthSampleClient() as never;
    const covering = await listObserverHealthSamplesCoveringWindow(prisma, {
      controlSourceId: randomUUID(),
      tenantId: randomUUID(),
      windowEnd: WINDOW_END,
      windowStart: WINDOW_START
    });

    expect(covering).toEqual([]);
    expect(toCorrelationHealthSamples(covering)).toEqual([]);
  });

  it("maps persisted rows to correlation samples without detection fields", async () => {
    const prisma = createInMemoryObserverHealthSampleClient() as never;
    const tenantId = randomUUID();
    const controlSourceId = randomUUID();

    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Degraded",
      observedAt: new Date("2026-09-17T13:50:00.000Z"),
      telemetryStatus: "Unknown",
      tenantId
    });

    const covering = await listObserverHealthSamplesCoveringWindow(prisma, {
      controlSourceId,
      tenantId,
      windowEnd: WINDOW_END,
      windowStart: WINDOW_START
    });
    const mapped = toCorrelationHealthSamples(covering);

    expect(mapped).toEqual([
      {
        healthStatus: "Degraded",
        observedAt: "2026-09-17T13:50:00.000Z",
        telemetryStatus: "Unknown"
      }
    ]);
    expect(mapped[0]).not.toHaveProperty("marker");
    expect(mapped[0]).not.toHaveProperty("eventId");
    expect(mapped[0]).not.toHaveProperty("outcome");
    expect(mapped[0]).not.toHaveProperty("verdict");
  });

  it("includes bracketing samples outside the observation window", async () => {
    const prisma = createInMemoryObserverHealthSampleClient() as never;
    const tenantId = randomUUID();
    const controlSourceId = randomUUID();

    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: new Date("2026-09-17T13:59:00.000Z"),
      tenantId
    });
    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: new Date("2026-09-17T14:05:00.000Z"),
      tenantId
    });
    await recordObserverHealthSample(prisma, {
      controlSourceId,
      healthStatus: "Healthy",
      observedAt: new Date("2026-09-17T14:11:00.000Z"),
      tenantId
    });

    const covering = await listObserverHealthSamplesCoveringWindow(prisma, {
      controlSourceId,
      tenantId,
      windowEnd: WINDOW_END,
      windowStart: WINDOW_START
    });

    expect(covering.map((sample) => sample.observedAt.toISOString())).toEqual([
      "2026-09-17T13:59:00.000Z",
      "2026-09-17T14:05:00.000Z",
      "2026-09-17T14:11:00.000Z"
    ]);
  });
});
