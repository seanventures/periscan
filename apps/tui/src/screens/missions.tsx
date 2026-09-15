import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

import type { MissionStatus, ValidationMission } from "@periscan/shared";

import { theme } from "../theme.js";

export const MISSION_POLL_INTERVAL_MS = 2_000;

const TERMINAL_STATUSES = new Set<MissionStatus>([
  "Cancelled",
  "Completed",
  "DeniedByPolicy",
  "Failed"
]);

export type MissionsApi = {
  getMission(missionId: string): Promise<ValidationMission>;
  listMissions(): Promise<ValidationMission[]>;
};

export function isMissionPollTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status as MissionStatus);
}

function statusColor(status: string): string {
  switch (status) {
    case "Completed":
      return theme.ok;
    case "DeniedByPolicy":
    case "Failed":
      return theme.danger;
    case "Running":
      return theme.accent;
    case "Queued":
    case "RequiresApproval":
      return theme.warn;
    default:
      return theme.muted;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

export function MissionsScreen(props: {
  api: MissionsApi;
  onStatus: (s: string) => void;
  pollIntervalMs?: number;
}) {
  const { api, onStatus } = props;
  const pollMs = props.pollIntervalMs ?? MISSION_POLL_INTERVAL_MS;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchError, setWatchError] = useState<string | null>(null);
  const [missions, setMissions] = useState<ValidationMission[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [watched, setWatched] = useState<ValidationMission | null>(null);
  const missionsRef = useRef(missions);
  missionsRef.current = missions;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setWatched(null);
    setWatchError(null);

    void api
      .listMissions()
      .then((items) => {
        if (cancelled) {
          return;
        }
        setMissions(items);
        setSelectedIndex(0);
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setMissions([]);
        setError(errorMessage(caught, "Unable to list missions."));
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

  const selected = missions[selectedIndex] ?? null;
  const selectedId = selected?.missionId ?? null;

  useEffect(() => {
    if (!selectedId) {
      setWatched(null);
      return;
    }

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const tick = async (): Promise<boolean> => {
      try {
        const next = await api.getMission(selectedId);
        if (cancelled) {
          return true;
        }
        setWatchError(null);
        setWatched(next);
        setMissions((current) =>
          current.map((item) =>
            item.missionId === next.missionId ? next : item
          )
        );
        return isMissionPollTerminal(next.status);
      } catch (caught: unknown) {
        if (!cancelled) {
          setWatchError(errorMessage(caught, "Unable to read mission."));
        }
        return false;
      }
    };

    void (async () => {
      const terminal = await tick();
      if (cancelled || terminal) {
        return;
      }
      intervalId = setInterval(() => {
        void (async () => {
          if (await tick()) {
            stop();
          }
        })();
      }, pollMs);
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [api, selectedId, pollMs]);

  useEffect(() => {
    if (loading) {
      onStatus("missions · loading");
      return;
    }
    if (error) {
      onStatus(`missions · error · ${error}`);
      return;
    }
    if (missions.length === 0) {
      onStatus("missions · none");
      return;
    }
    const status = watched?.status;
    if (status && isMissionPollTerminal(status)) {
      onStatus(`missions · ${status} · poll stopped`);
      return;
    }
    if (status) {
      onStatus(`missions · watching ${status} · poll 2s`);
      return;
    }
    onStatus(`missions · ${missions.length} listed`);
  }, [error, loading, missions.length, onStatus, watched]);

  useInput((input: string, key: { downArrow?: boolean; upArrow?: boolean }) => {
    const count = missionsRef.current.length;
    if (count === 0) {
      return;
    }
    if (key.downArrow || input === "j") {
      setSelectedIndex((index) => Math.min(index + 1, count - 1));
    } else if (key.upArrow || input === "k") {
      setSelectedIndex((index) => Math.max(index - 1, 0));
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column">
        <Text bold>Missions</Text>
        <Text color={theme.muted}>Loading missions…</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text bold>Missions</Text>
        <Text color={theme.danger}>{error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>Missions</Text>
      <Text color={theme.muted}>
        j/k select · poll 2s · stop at terminal status
      </Text>
      {missions.length === 0 ? (
        <Text color={theme.muted}>No missions. Start one from run (4).</Text>
      ) : (
        missions.map((item, index) => (
          <Text
            key={item.missionId}
            color={index === selectedIndex ? theme.ink : theme.muted}
          >
            {index === selectedIndex ? "▸ " : "  "}
            {item.missionId.slice(0, 8)}  {item.missionType}  {item.status}
          </Text>
        ))
      )}
      {watched ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            status{" "}
            <Text bold color={statusColor(watched.status)}>
              {watched.status}
            </Text>
            {isMissionPollTerminal(watched.status)
              ? " · poll stopped"
              : " · polling"}
          </Text>
          <Text color={theme.muted}>
            {watched.missionType} · {watched.missionId}
          </Text>
        </Box>
      ) : null}
      {watchError ? <Text color={theme.danger}>{watchError}</Text> : null}
    </Box>
  );
}
