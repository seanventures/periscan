import type { PrismaClient } from "@prisma/client";
import { getConnectorByKey } from "@periscan/connectors";
import {
  recordObserverHealthSample,
  type ObserverHealthStatusValue
} from "@periscan/db";

import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "../integration-credentials.js";

export const OBSERVER_HEALTH_SAMPLER_LAW =
  "Sample configured ControlSources on an API or runner tick. Persist Healthy, Degraded, or Unreachable (stored as Unhealthy) observer heartbeats. Samples are not detections, markers, or verdicts. Do not copy a Missed verdict into the health series. Stale or unreachable observers stay Inconclusive, never Missed.";

export const DEFAULT_OBSERVER_HEALTH_SAMPLE_INTERVAL_MS = 60_000;
const MAX_CONTROL_SOURCES_PER_TICK = 500;

export type ObserverHealthSampleStatus = "Healthy" | "Degraded" | "Unreachable";

export type ObserverHealthSamplerControlSource = {
  controlSourceId: string;
  integration: {
    authType: string;
    config: unknown;
    healthStatus?: string;
    integrationId: string;
    status?: string;
  };
  lastValidatedAt?: Date | null;
  healthStatus?: string;
  telemetryStatus?: string;
  tenantId: string;
};

export type ObserverHealthProbeResult = {
  status: ObserverHealthSampleStatus;
};

export type ObserverHealthProbe = (
  controlSource: ObserverHealthSamplerControlSource
) => Promise<ObserverHealthProbeResult>;

export type ObserverHealthSamplerSampleResult = {
  controlSourceId: string;
  persistedHealthStatus: ObserverHealthStatusValue;
  sampleStatus: ObserverHealthSampleStatus;
  tenantId: string;
};

export type ObserverHealthSamplerTickResult = {
  degraded: number;
  healthy: number;
  sampled: number;
  samples: ObserverHealthSamplerSampleResult[];
  skipped: number;
  unreachable: number;
};

export type ObserverHealthSamplerTickInput = {
  minIntervalMs?: number;
  now?: Date;
  prisma: ObserverHealthSamplerClient;
  probe?: ObserverHealthProbe;
  tenantIds?: string[];
};

type ObserverHealthSamplerClient = Pick<
  PrismaClient,
  "controlSource" | "observerHealthSample"
>;

export function mapObserverHealthProbeToSampleStatus(
  status: string
): ObserverHealthSampleStatus {
  if (status === "Healthy" || status === "Degraded") {
    return status;
  }
  return "Unreachable";
}

export function mapObserverHealthProbeToPersistedStatus(
  status: ObserverHealthSampleStatus
): ObserverHealthStatusValue {
  if (status === "Unreachable") {
    return "Unhealthy";
  }
  return status;
}

export function resolveObserverHealthSampleIntervalMs(
  env: NodeJS.ProcessEnv = process.env
): number {
  const parsed = Number.parseInt(
    env.PERISCAN_OBSERVER_HEALTH_SAMPLE_INTERVAL_MS ?? "",
    10
  );
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_OBSERVER_HEALTH_SAMPLE_INTERVAL_MS;
}

function connectorKeyFromConfig(config: unknown): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return null;
  }
  const connectorKey = (config as Record<string, unknown>).connectorKey;
  return typeof connectorKey === "string" ? connectorKey : null;
}

function mockModeFromConfig(config: unknown): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }
  return (config as Record<string, unknown>).mockMode === true;
}

export async function probeConfiguredControlSourceHealth(
  controlSource: ObserverHealthSamplerControlSource
): Promise<ObserverHealthProbeResult> {
  try {
    const connectorKey = connectorKeyFromConfig(
      controlSource.integration.config
    );
    const connector = connectorKey ? getConnectorByKey(connectorKey) : null;
    if (!connector) {
      return { status: "Unreachable" };
    }
    const health = await connector.healthCheck({
      authType: controlSource.integration.authType,
      config: decryptIntegrationConfig(
        controlSource.integration.config,
        integrationSecretFieldKeys(
          connector,
          controlSource.integration.authType
        )
      ),
      integrationId: controlSource.integration.integrationId,
      mockMode: mockModeFromConfig(controlSource.integration.config),
      tenantId: controlSource.tenantId
    });
    return {
      status: mapObserverHealthProbeToSampleStatus(health.status)
    };
  } catch {
    return { status: "Unreachable" };
  }
}

function emptyTickResult(): ObserverHealthSamplerTickResult {
  return {
    degraded: 0,
    healthy: 0,
    sampled: 0,
    samples: [],
    skipped: 0,
    unreachable: 0
  };
}

export async function runObserverHealthSamplerTick(
  input: ObserverHealthSamplerTickInput
): Promise<ObserverHealthSamplerTickResult> {
  const now = input.now ?? new Date();
  const minIntervalMs =
    input.minIntervalMs ?? resolveObserverHealthSampleIntervalMs();
  const probe = input.probe ?? probeConfiguredControlSourceHealth;
  const where =
    input.tenantIds && input.tenantIds.length > 0
      ? { tenantId: { in: input.tenantIds } }
      : {};
  const controlSources = await input.prisma.controlSource.findMany({
    include: { integration: true },
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    take: MAX_CONTROL_SOURCES_PER_TICK,
    where
  });

  const result = emptyTickResult();
  for (const controlSource of controlSources) {
    if (minIntervalMs > 0) {
      const latest = await input.prisma.observerHealthSample.findFirst({
        orderBy: { observedAt: "desc" },
        where: {
          controlSourceId: controlSource.controlSourceId,
          tenantId: controlSource.tenantId
        }
      });
      if (
        latest &&
        now.getTime() - latest.observedAt.getTime() < minIntervalMs
      ) {
        result.skipped += 1;
        continue;
      }
    }

    let sampleStatus: ObserverHealthSampleStatus;
    try {
      sampleStatus = (await probe(controlSource)).status;
    } catch {
      sampleStatus = "Unreachable";
    }

    const persistedHealthStatus =
      mapObserverHealthProbeToPersistedStatus(sampleStatus);
    await recordObserverHealthSample(input.prisma, {
      controlSourceId: controlSource.controlSourceId,
      healthStatus: persistedHealthStatus,
      observedAt: now,
      telemetryStatus: persistedHealthStatus,
      tenantId: controlSource.tenantId
    });
    result.sampled += 1;
    result.samples.push({
      controlSourceId: controlSource.controlSourceId,
      persistedHealthStatus,
      sampleStatus,
      tenantId: controlSource.tenantId
    });
    if (sampleStatus === "Healthy") {
      result.healthy += 1;
    } else if (sampleStatus === "Degraded") {
      result.degraded += 1;
    } else {
      result.unreachable += 1;
    }
  }

  return result;
}
