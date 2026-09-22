import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import {
  CAMPAIGN_DAG_EMPTY_DESCRIPTION,
  CAMPAIGN_DAG_EMPTY_TITLE,
  CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE,
  HIGH_DANGER_ACK_CHECKBOX_LABEL,
  HIGH_DANGER_ACK_DIGEST,
  HIGH_DANGER_SECTION_COPY,
  HIGH_DANGER_SECTION_TITLE,
  emptyDangerOperatorGate,
  isDangerCatalogModule,
  presentCampaignDagView,
  presentDangerCatalogOperatorView,
  type CampaignDagViewPin,
  type DangerCatalogEntry,
  type DangerOperatorGate
} from "@periscan/shared";

import { theme } from "../theme.js";

export const LIVE_SUPPORTED = false as const;
export const DENIED_NEVER_QUEUES = "Denied never queues";
export const START_DISABLED = "Start disabled";
const BENIGN_MARKER_PIN = "control.detection.benign-marker";

export type BasScope = {
  scopeId: string;
  scopeType: string;
  value: string;
  verificationStatus: string;
};

export type BasCompilePin = {
  dependsOn?: string[];
  provider: string;
  stepKey?: string;
  typedInputs?: Record<string, string | number | boolean>;
  upstreamId: string;
};

export type BasCompileResult = {
  denyReason: string | null;
  jobsQueued: number;
  queued: boolean;
  startable: boolean;
  plan: {
    compiledDigest: string;
    dependencyGraph?: {
      edges: Array<{ from: string; to: string }>;
      executionOrder: string[];
      nodes: string[];
    };
    scenarioPins: BasCompilePin[];
    startable: boolean;
  };
};

export type BasStartResult = {
  compiledDigest?: string;
  denyReason: string | null;
  jobsQueued: number;
  outcome: string;
  queued: boolean;
  startable?: boolean;
};

export type BasDangerGate = DangerOperatorGate;

export type BasApi = {
  cancelBasCampaign?: (input: {
    cleanupReceipts: unknown[];
    compiledDigest: string;
  }) => Promise<unknown>;
  compileBasCampaign: (input: {
    scenarioPins: Array<{
      provider: string;
      typedInputs?: Record<string, string | number | boolean>;
      upstreamId: string;
    }>;
    scopeId: string;
  }) => Promise<unknown>;
  getBasDangerOperatorGate: () => Promise<unknown>;
  listScopes: () => Promise<BasScope[]>;
  startBasCampaign: (input: {
    compiledDigest: string;
    dangerAckDigest?: string;
    dangerAcknowledged?: boolean;
  }) => Promise<unknown>;
};

export function isVerifiedScope(scope: BasScope): boolean {
  return scope.verificationStatus === "Verified";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readDangerGate(payload: unknown): DangerOperatorGate {
  if (!isRecord(payload)) {
    return emptyDangerOperatorGate();
  }
  return {
    available: payload.available === true,
    items: Array.isArray(payload.items)
      ? (payload.items as DangerCatalogEntry[])
      : emptyDangerOperatorGate().items,
    qualified: payload.qualified === true,
    tenantAuthorized: payload.tenantAuthorized === true
  };
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readPin(value: unknown): BasCompilePin | null {
  if (!isRecord(value) || typeof value.provider !== "string") {
    return null;
  }
  const upstreamId = readString(value.upstreamId);
  if (!upstreamId) {
    return null;
  }
  return {
    dependsOn: Array.isArray(value.dependsOn)
      ? value.dependsOn.filter((item): item is string => typeof item === "string")
      : [],
    provider: value.provider,
    stepKey: readString(value.stepKey),
    typedInputs: isRecord(value.typedInputs)
      ? (value.typedInputs as Record<string, string | number | boolean>)
      : {},
    upstreamId
  };
}

function readCompileResult(payload: unknown): BasCompileResult | null {
  if (!isRecord(payload) || !isRecord(payload.plan)) {
    return null;
  }
  const compiledDigest = readString(payload.plan.compiledDigest);
  if (!compiledDigest) {
    return null;
  }
  const pins = Array.isArray(payload.plan.scenarioPins)
    ? payload.plan.scenarioPins.flatMap((pin) => {
        const parsed = readPin(pin);
        return parsed ? [parsed] : [];
      })
    : [];
  const graph = isRecord(payload.plan.dependencyGraph)
    ? {
        edges: Array.isArray(payload.plan.dependencyGraph.edges)
          ? payload.plan.dependencyGraph.edges.flatMap((edge) => {
              if (!isRecord(edge)) {
                return [];
              }
              const from = readString(edge.from);
              const to = readString(edge.to);
              return from && to ? [{ from, to }] : [];
            })
          : [],
        executionOrder: Array.isArray(payload.plan.dependencyGraph.executionOrder)
          ? payload.plan.dependencyGraph.executionOrder.filter(
              (item): item is string => typeof item === "string"
            )
          : [],
        nodes: Array.isArray(payload.plan.dependencyGraph.nodes)
          ? payload.plan.dependencyGraph.nodes.filter(
              (item): item is string => typeof item === "string"
            )
          : []
      }
    : undefined;
  return {
    denyReason:
      typeof payload.denyReason === "string" ? payload.denyReason : null,
    jobsQueued: typeof payload.jobsQueued === "number" ? payload.jobsQueued : 0,
    queued: payload.queued === true,
    startable: payload.startable === true,
    plan: {
      compiledDigest,
      dependencyGraph: graph,
      scenarioPins: pins,
      startable: payload.plan.startable === true
    }
  };
}

function readStartResult(payload: unknown): BasStartResult {
  if (!isRecord(payload)) {
    return {
      denyReason: DENIED_NEVER_QUEUES,
      jobsQueued: 0,
      outcome: "Denied",
      queued: false,
      startable: false
    };
  }
  return {
    compiledDigest: readString(payload.compiledDigest),
    denyReason: typeof payload.denyReason === "string" ? payload.denyReason : null,
    jobsQueued: typeof payload.jobsQueued === "number" ? payload.jobsQueued : 0,
    outcome: readString(payload.outcome) ?? "Denied",
    queued: payload.queued === true,
    startable: payload.startable === true
  };
}

function dagPins(compiled: BasCompileResult | null): CampaignDagViewPin[] {
  if (!compiled) {
    return [];
  }
  return compiled.plan.scenarioPins.map((pin) => ({
    dependsOn: pin.dependsOn,
    provider: pin.provider,
    stepKey: pin.stepKey,
    typedInputs: pin.typedInputs,
    upstreamId: pin.upstreamId
  }));
}

function compiledIsDanger(compiled: BasCompileResult | null): boolean {
  return (
    compiled?.plan.scenarioPins.some((pin) =>
      isDangerCatalogModule(pin.upstreamId)
    ) === true
  );
}

export function canStartCompiledCampaign(compiled: BasCompileResult | null): boolean {
  if (!compiled) {
    return false;
  }
  if (compiledIsDanger(compiled)) {
    return false;
  }
  return compiled.startable === true && compiled.plan.startable === true;
}

export function BasScreen(props: {
  api: BasApi;
  onStatus: (s: string) => void;
}) {
  const { api, onStatus } = props;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopes, setScopes] = useState<BasScope[]>([]);
  const [gate, setGate] = useState<DangerOperatorGate>(emptyDangerOperatorGate());
  const [compiled, setCompiled] = useState<BasCompileResult | null>(null);
  const [started, setStarted] = useState<BasStartResult | null>(null);
  const [dangerAcknowledged, setDangerAcknowledged] = useState(false);
  const [catalogIndex, setCatalogIndex] = useState(0);
  const [busy, setBusy] = useState<"compile" | "start" | "cancel" | null>(null);

  const verified = useMemo(() => scopes.filter(isVerifiedScope), [scopes]);
  const selectedScope = verified[0] ?? null;

  const catalogView = presentDangerCatalogOperatorView({
    dangerAcknowledged,
    dangerAckDigest: dangerAcknowledged ? HIGH_DANGER_ACK_DIGEST : undefined,
    gate,
    policyAllowed: selectedScope != null,
    scopeVerified: selectedScope != null
  });
  const selectedEntry =
    catalogView.entries[catalogIndex] ?? catalogView.entries[0] ?? null;
  const dag = presentCampaignDagView({
    graph: compiled?.plan.dependencyGraph,
    pins: dagPins(compiled),
    startable: compiled?.plan.startable === true && compiled.startable === true
  });
  const compiledStartable = canStartCompiledCampaign(compiled);
  const startEnabled = catalogView.startEnabled || compiledStartable;
  const jobsQueued = started?.jobsQueued ?? compiled?.jobsQueued ?? null;
  const actionRef = useRef({
    busy,
    compiledStartable,
    highDangerStartEnabled: catalogView.startEnabled,
    loading,
    selectedEntry,
    selectedScope
  });
  actionRef.current = {
    busy,
    compiledStartable,
    highDangerStartEnabled: catalogView.startEnabled,
    loading,
    selectedEntry,
    selectedScope
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void Promise.all([api.listScopes(), api.getBasDangerOperatorGate()])
      .then(([nextScopes, nextGate]) => {
        if (cancelled) {
          return;
        }
        setScopes(nextScopes);
        setGate(readDangerGate(nextGate));
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setError(
          caught instanceof Error ? caught.message : "Unable to load BAS operator gate"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (loading) {
      onStatus("loading BAS operator gate");
      return;
    }
    onStatus(
      startEnabled
        ? "c compile · a High-danger ack · s start · x cancel · b BAS · 1–9 · ? · q"
        : `c compile · a High-danger ack · ${START_DISABLED} until qualify+authorize+ack · 1–9 · ? · q`
    );
  }, [loading, onStatus, startEnabled]);

  async function compile(upstreamId: string) {
    const action = actionRef.current;
    if (!action.selectedScope || action.busy) {
      return;
    }
    setBusy("compile");
    setError(null);
    setStarted(null);
    try {
      const result = readCompileResult(
        await api.compileBasCampaign({
          scopeId: action.selectedScope.scopeId,
          scenarioPins: [
            {
              provider: "ControlPlane",
              typedInputs: {},
              upstreamId
            }
          ]
        })
      );
      if (!result) {
        setCompiled(null);
        setError("Unable to compile the BAS campaign");
        return;
      }
      setCompiled(result);
    } catch (caught) {
      setCompiled(null);
      setError(
        caught instanceof Error ? caught.message : "Unable to compile the BAS campaign"
      );
    } finally {
      setBusy(null);
    }
  }

  async function startCompiled() {
    if (!compiled || actionRef.current.busy || !actionRef.current.compiledStartable) {
      return;
    }
    setBusy("start");
    setError(null);
    try {
      const result = readStartResult(
        await api.startBasCampaign({
          compiledDigest: compiled.plan.compiledDigest
        })
      );
      setStarted(result);
      if (result.outcome !== "Allowed" || result.jobsQueued === 0) {
        setError(
          `${result.denyReason ?? DENIED_NEVER_QUEUES} · jobsQueued ${result.jobsQueued}`
        );
      }
    } catch (caught) {
      setStarted(null);
      setError(
        caught instanceof Error ? caught.message : "Unable to start the BAS campaign"
      );
    } finally {
      setBusy(null);
    }
  }

  async function startHighDanger() {
    const action = actionRef.current;
    if (
      !action.selectedScope ||
      !action.selectedEntry ||
      !action.highDangerStartEnabled ||
      action.busy
    ) {
      return;
    }
    setBusy("start");
    setError(null);
    try {
      const compiledDanger = readCompileResult(
        await api.compileBasCampaign({
          scopeId: action.selectedScope.scopeId,
          scenarioPins: [
            {
              provider: "ControlPlane",
              typedInputs: {},
              upstreamId: action.selectedEntry.moduleId
            }
          ]
        })
      );
      if (!compiledDanger) {
        setError("Unable to compile the BAS campaign");
        return;
      }
      setCompiled(compiledDanger);
      const result = readStartResult(
        await api.startBasCampaign({
          compiledDigest: compiledDanger.plan.compiledDigest,
          dangerAckDigest: HIGH_DANGER_ACK_DIGEST,
          dangerAcknowledged: true
        })
      );
      setStarted(result);
      if (result.outcome !== "Allowed") {
        setError(
          `${result.denyReason ?? DENIED_NEVER_QUEUES} · jobsQueued ${result.jobsQueued}`
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : DENIED_NEVER_QUEUES
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!compiled || !api.cancelBasCampaign || busy) {
      return;
    }
    setBusy("cancel");
    setError(null);
    try {
      await api.cancelBasCampaign({
        compiledDigest: compiled.plan.compiledDigest,
        cleanupReceipts: []
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to cancel the BAS campaign"
      );
    } finally {
      setBusy(null);
    }
  }

  useInput((input) => {
    const action = actionRef.current;
    if (action.busy || action.loading) {
      return;
    }
    if ((input === "k" || input === "j") && catalogView.entries.length > 0) {
      setCatalogIndex((index) => {
        if (input === "k") {
          return Math.max(0, index - 1);
        }
        return Math.min(catalogView.entries.length - 1, index + 1);
      });
      return;
    }
    if (input === "a") {
      setDangerAcknowledged((current) => !current);
      return;
    }
    if (input === "c") {
      void compile(BENIGN_MARKER_PIN);
      return;
    }
    if (input === "x") {
      void cancel();
      return;
    }
    if (input === "s") {
      if (action.highDangerStartEnabled) {
        void startHighDanger();
        return;
      }
      if (action.compiledStartable) {
        void startCompiled();
      }
    }
  });

  const failClosed =
    compiled != null && !compiledStartable && !catalogView.startEnabled;

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        BAS
      </Text>
      <Text color={theme.muted}>
        operator campaign · {CAMPAIGN_DAG_NOT_EXECUTED_COVERAGE}
      </Text>
      <Text color={theme.warn}>liveSupported {String(LIVE_SUPPORTED)}</Text>

      {loading ? (
        <Text color={theme.muted}>Loading BAS operator gate…</Text>
      ) : null}
      {error ? <Text color={theme.danger}>{error}</Text> : null}
      {selectedScope ? (
        <Text color={theme.ink}>
          scope {selectedScope.value} {selectedScope.scopeType}
        </Text>
      ) : (
        <Text color={theme.warn}>verify a scope before BAS can compile</Text>
      )}

      <Box flexDirection="column" marginTop={1}>
        <Text bold>COMPILED DAG</Text>
        <Text color={theme.muted}>{dag.honesty}</Text>
        {dag.empty ? (
          <>
            <Text color={theme.warn}>{CAMPAIGN_DAG_EMPTY_TITLE}</Text>
            <Text color={theme.muted}>{CAMPAIGN_DAG_EMPTY_DESCRIPTION}</Text>
          </>
        ) : (
          <>
            {dag.steps.map((step) => (
              <Text key={step.stepKey} color={theme.ink}>
                {String(step.index).padStart(2, "0")} {step.stepKey} {step.label}
                {step.dependsOn.length > 0
                  ? ` · depends on ${step.dependsOn.join(", ")}`
                  : ""}
              </Text>
            ))}
            {dag.edges.map((edge) => (
              <Text key={`${edge.from}->${edge.to}`} color={theme.muted}>
                {edge.label}
              </Text>
            ))}
          </>
        )}
        {jobsQueued != null ? (
          <Text color={failClosed ? theme.warn : theme.ink}>
            jobsQueued {jobsQueued}
          </Text>
        ) : null}
        {compiled?.denyReason ? (
          <Text color={theme.danger}>{compiled.denyReason}</Text>
        ) : null}
        {failClosed ? (
          <Text color={theme.danger}>{DENIED_NEVER_QUEUES}</Text>
        ) : null}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color={theme.danger}>
          {HIGH_DANGER_SECTION_TITLE}
        </Text>
        <Text color={theme.muted}>{HIGH_DANGER_SECTION_COPY}</Text>
        <Text color={catalogView.qualifyState === "qualified" ? theme.ok : theme.warn}>
          {catalogView.qualifyState}
        </Text>
        <Text
          color={
            catalogView.authorizeState === "authorized" ? theme.ok : theme.warn
          }
        >
          {catalogView.authorizeState}
        </Text>
        <Text color={theme.ink}>
          {dangerAcknowledged ? "[x]" : "[ ]"} {HIGH_DANGER_ACK_CHECKBOX_LABEL}
        </Text>
        {catalogView.entries.map((entry, index) => (
          <Text
            key={entry.moduleId}
            color={index === catalogIndex ? theme.ink : theme.muted}
          >
            {index === catalogIndex ? ">" : " "} {entry.techniqueId} {entry.title}
          </Text>
        ))}
      </Box>

      <Text color={startEnabled ? theme.ok : theme.warn} bold>
        {startEnabled ? "s start" : START_DISABLED}
      </Text>
      <Text color={theme.muted}>
        c compile · a High-danger ack · s start · x cancel
      </Text>
    </Box>
  );
}
