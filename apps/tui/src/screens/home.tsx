import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

import { COMMUNITY_FIRST_RUN_START_LABEL } from "@periscan/shared";

import type { ScreenId } from "../nav.js";
import { theme } from "../theme.js";

export type HomeApi = {
  readonly apiUrl: string;
  health(): Promise<{ status: string }>;
  lastMission?: () => Promise<unknown>;
  listMissions?: () => Promise<unknown>;
  listScopes?: () => Promise<unknown>;
};

const AUTHORIZE_LABEL = "Authorize scope";
const RUN_LABEL = COMMUNITY_FIRST_RUN_START_LABEL;

type HomeCta = {
  label: typeof AUTHORIZE_LABEL | typeof RUN_LABEL;
  screen: Extract<ScreenId, "scopes" | "validate">;
};

const AUTHORIZE_CTA: HomeCta = { label: AUTHORIZE_LABEL, screen: "scopes" };
const RUN_CTA: HomeCta = { label: RUN_LABEL, screen: "validate" };

type HealthState =
  | { kind: "probing" }
  | { kind: "ok"; status: string }
  | { kind: "down"; message: string };

type MissionGlance = {
  missionId: string;
  missionType: string;
  status: string;
};

type MissionState =
  | { kind: "idle" }
  | { kind: "absent" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; mission: MissionGlance };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "request failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function missionGlance(value: unknown): MissionGlance | null {
  if (!isRecord(value)) {
    return null;
  }
  const missionId =
    typeof value.missionId === "string"
      ? value.missionId
      : typeof value.id === "string"
        ? value.id
        : "";
  const missionType =
    typeof value.missionType === "string"
      ? value.missionType
      : typeof value.type === "string"
        ? value.type
        : "mission";
  const status = typeof value.status === "string" ? value.status : "unknown";
  if (!missionId) {
    return null;
  }
  return { missionId, missionType, status };
}

function itemsOf(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

function isVerifiedScope(value: unknown): boolean {
  return isRecord(value) && value.verificationStatus === "Verified";
}

async function loadLastMission(api: HomeApi): Promise<MissionState> {
  try {
    if (typeof api.lastMission === "function") {
      const row = missionGlance(await api.lastMission());
      return row ? { kind: "ready", mission: row } : { kind: "empty" };
    }
    if (typeof api.listMissions === "function") {
      const row = missionGlance(itemsOf(await api.listMissions())[0]);
      return row ? { kind: "ready", mission: row } : { kind: "empty" };
    }
  } catch (error: unknown) {
    return { kind: "error", message: errorMessage(error) };
  }
  return { kind: "absent" };
}

async function loadCta(api: HomeApi): Promise<HomeCta> {
  if (typeof api.listScopes !== "function") {
    return AUTHORIZE_CTA;
  }
  try {
    const scopes = itemsOf(await api.listScopes());
    return scopes.some(isVerifiedScope) ? RUN_CTA : AUTHORIZE_CTA;
  } catch {
    return AUTHORIZE_CTA;
  }
}

function healthColor(health: HealthState): string {
  if (health.kind === "ok") {
    return health.status === "ok" ? theme.ok : theme.warn;
  }
  if (health.kind === "down") {
    return theme.danger;
  }
  return theme.warn;
}

function healthLabel(health: HealthState): string {
  if (health.kind === "ok") {
    return health.status;
  }
  if (health.kind === "down") {
    return "unreachable";
  }
  return "probing";
}

function footerLine(
  health: HealthState,
  mission: MissionState,
  cta: HomeCta
): string {
  const apiBit =
    health.kind === "ok"
      ? `API ${health.status}`
      : health.kind === "down"
        ? "API unreachable"
        : "API probing";
  const missionBit =
    mission.kind === "ready"
      ? `last ${mission.mission.missionType} ${mission.mission.status}`
      : mission.kind === "empty"
        ? "no mission yet"
        : mission.kind === "error"
          ? "last mission unavailable"
          : null;
  return [apiBit, missionBit, `enter ${cta.label}`].filter(Boolean).join(" · ");
}

export function HomeScreen(props: {
  api: HomeApi;
  go: (id: ScreenId) => void;
  onStatus: (s: string) => void;
}) {
  const [health, setHealth] = useState<HealthState>({ kind: "probing" });
  const [mission, setMission] = useState<MissionState>({ kind: "idle" });
  const [cta, setCta] = useState<HomeCta>(AUTHORIZE_CTA);
  const ctaRef = useRef(cta);
  ctaRef.current = cta;

  useInput((_input, key) => {
    if (key.return) {
      props.go(ctaRef.current.screen);
    }
  });

  useEffect(() => {
    let cancelled = false;
    let healthState: HealthState = { kind: "probing" };
    let missionState: MissionState = { kind: "idle" };
    let ctaState: HomeCta = AUTHORIZE_CTA;
    props.onStatus(footerLine(healthState, missionState, ctaState));

    const publish = () => {
      if (cancelled) {
        return;
      }
      setHealth(healthState);
      setMission(missionState);
      setCta(ctaState);
      props.onStatus(footerLine(healthState, missionState, ctaState));
    };

    void props.api
      .health()
      .then((payload) => {
        healthState = { kind: "ok", status: payload.status };
        publish();
      })
      .catch((error: unknown) => {
        healthState = { kind: "down", message: errorMessage(error) };
        publish();
      });

    void loadLastMission(props.api).then((result) => {
      missionState = result;
      publish();
    });

    void loadCta(props.api).then((result) => {
      ctaState = result;
      publish();
    });

    return () => {
      cancelled = true;
    };
  }, [props.api, props.onStatus]);

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold color={theme.accent}>
          PROOF OS
        </Text>
        <Text color={theme.muted}> terminal</Text>
      </Box>
      <Text color={theme.ink}>governed validation · authorized scope only</Text>

      <Box marginTop={1} flexDirection="column">
        <Box>
          <Box width={5}>
            <Text color={theme.muted}>API</Text>
          </Box>
          <Text color={healthColor(health)}>{healthLabel(health)}</Text>
          {health.kind === "down" ? (
            <Text color={theme.muted}> {health.message}</Text>
          ) : null}
          <Text color={theme.muted}> {props.api.apiUrl}</Text>
        </Box>
        {mission.kind === "ready" ? (
          <Box>
            <Box width={5}>
              <Text color={theme.muted}>LAST</Text>
            </Box>
            <Text color={theme.ink}>
              {mission.mission.missionType} {mission.mission.status}
            </Text>
            <Text color={theme.muted}> {mission.mission.missionId}</Text>
          </Box>
        ) : null}
        {mission.kind === "empty" ? (
          <Box>
            <Box width={5}>
              <Text color={theme.muted}>LAST</Text>
            </Box>
            <Text color={theme.ink}>no mission yet — authorize then run</Text>
          </Box>
        ) : null}
        {mission.kind === "error" ? (
          <Box>
            <Box width={5}>
              <Text color={theme.muted}>LAST</Text>
            </Box>
            <Text color={theme.danger}>unavailable</Text>
            <Text color={theme.muted}> {mission.message}</Text>
          </Box>
        ) : null}
      </Box>

      <Box
        marginTop={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.accent}
        paddingX={1}
      >
        <Text color={theme.accent} bold>
          authorize then run
        </Text>
        <Text color={theme.ink} bold>
          {cta.label}
        </Text>
        <Text color={theme.muted}>Nothing runs outside verified scope.</Text>
        <Text color={theme.muted}>enter</Text>
      </Box>
    </Box>
  );
}
