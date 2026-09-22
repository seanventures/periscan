import type { IntegrationHealthStatus, PrismaClient } from "@prisma/client";

export type ObserverHealthStatusValue = IntegrationHealthStatus;

type ObserverHealthSampleClient = Pick<PrismaClient, "observerHealthSample">;

export type ObserverHealthSampleRecord = {
  controlSourceId: string;
  healthStatus: ObserverHealthStatusValue;
  observerHealthSampleId: string;
  observedAt: Date;
  receivedAt: Date;
  telemetryStatus: ObserverHealthStatusValue;
  tenantId: string;
};

export type RecordObserverHealthSampleInput = {
  controlSourceId: string;
  healthStatus: ObserverHealthStatusValue;
  observerHealthSampleId?: string;
  observedAt: Date;
  receivedAt?: Date;
  telemetryStatus?: ObserverHealthStatusValue | null;
  tenantId: string;
};

export type ListObserverHealthSamplesCoveringWindowInput = {
  controlSourceId: string;
  tenantId: string;
  windowEnd: Date;
  windowStart: Date;
};

export type CorrelationHealthSample = {
  healthStatus: ObserverHealthStatusValue;
  observedAt: string;
  telemetryStatus: ObserverHealthStatusValue;
};

export async function recordObserverHealthSample(
  prisma: ObserverHealthSampleClient,
  input: RecordObserverHealthSampleInput
): Promise<ObserverHealthSampleRecord> {
  return prisma.observerHealthSample.create({
    data: {
      controlSourceId: input.controlSourceId,
      healthStatus: input.healthStatus,
      observedAt: input.observedAt,
      telemetryStatus: input.telemetryStatus ?? input.healthStatus,
      tenantId: input.tenantId,
      ...(input.observerHealthSampleId
        ? { observerHealthSampleId: input.observerHealthSampleId }
        : {}),
      ...(input.receivedAt ? { receivedAt: input.receivedAt } : {})
    }
  });
}

export async function listObserverHealthSamplesCoveringWindow(
  prisma: ObserverHealthSampleClient,
  input: ListObserverHealthSamplesCoveringWindowInput
): Promise<ObserverHealthSampleRecord[]> {
  const [before, inWindow, after] = await Promise.all([
    prisma.observerHealthSample.findFirst({
      orderBy: { observedAt: "desc" },
      where: {
        controlSourceId: input.controlSourceId,
        observedAt: { lte: input.windowStart },
        tenantId: input.tenantId
      }
    }),
    prisma.observerHealthSample.findMany({
      orderBy: { observedAt: "asc" },
      where: {
        controlSourceId: input.controlSourceId,
        observedAt: { gte: input.windowStart, lte: input.windowEnd },
        tenantId: input.tenantId
      }
    }),
    prisma.observerHealthSample.findFirst({
      orderBy: { observedAt: "asc" },
      where: {
        controlSourceId: input.controlSourceId,
        observedAt: { gte: input.windowEnd },
        tenantId: input.tenantId
      }
    })
  ]);

  const byId = new Map<string, ObserverHealthSampleRecord>();
  for (const sample of [before, ...inWindow, after]) {
    if (sample) {
      byId.set(sample.observerHealthSampleId, sample);
    }
  }

  return [...byId.values()].sort(
    (left, right) => left.observedAt.getTime() - right.observedAt.getTime()
  );
}

export function toCorrelationHealthSamples(
  records: readonly Pick<
    ObserverHealthSampleRecord,
    "healthStatus" | "observedAt" | "telemetryStatus"
  >[]
): CorrelationHealthSample[] {
  return records.map((record) => ({
    healthStatus: record.healthStatus,
    observedAt: record.observedAt.toISOString(),
    telemetryStatus: record.telemetryStatus
  }));
}
