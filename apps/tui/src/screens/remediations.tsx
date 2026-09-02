import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";

import type { PeriscanApi } from "../lib/api.js";
import { theme } from "../theme.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export const CREATE_IS_NOT_FIXED =
  "Create is not Fixed. Fixed only after a verification event.";

type ScreenMode = "mission" | "list";
type BusyKind = "create" | "verify" | null;

type RemediationRow = {
  remediationId: string;
  status: string;
  verification: {
    measuredRevalidation: boolean;
    outcome: string;
  } | null;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : fallback;
}

function openedNote(createdCount: number): string {
  if (createdCount === 0) {
    return "No Community findings with fingerprints yet — remediations stay empty until evidence exists. Create is not Fixed.";
  }
  const noun = createdCount === 1 ? "remediation" : "remediations";
  return `Opened ${createdCount} ${noun}. Create is not Fixed.`;
}

function verificationLabel(row: RemediationRow): string {
  if (!row.verification) {
    return "no verification event";
  }
  const measured = row.verification.measuredRevalidation ? " (measured)" : "";
  return `verification event · ${row.verification.outcome}${measured}`;
}

function statusColor(status: string): string {
  if (status === "Fixed" || status === "Mitigated") {
    return theme.ok;
  }
  if (
    status === "StillExposed" ||
    status === "Reopened" ||
    status === "Inconclusive"
  ) {
    return theme.danger;
  }
  return theme.warn;
}

export function RemediationsScreen(props: {
  api: PeriscanApi;
  missionId?: string;
  onStatus: (s: string) => void;
}) {
  const { api, onStatus } = props;
  const [mode, setMode] = useState<ScreenMode>("mission");
  const [missionId, setMissionId] = useState(props.missionId ?? "");
  const [rows, setRows] = useState<RemediationRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState<BusyKind>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modeRef = useRef(mode);
  const missionIdRef = useRef(missionId);
  const rowsRef = useRef(rows);
  const selectedRef = useRef(selectedIndex);
  const busyRef = useRef(busy);

  modeRef.current = mode;
  missionIdRef.current = missionId;
  rowsRef.current = rows;
  selectedRef.current = selectedIndex;
  busyRef.current = busy;

  useEffect(() => {
    if (busy === "create") {
      onStatus("creating remediations…");
      return;
    }
    if (busy === "verify") {
      onStatus("verifying… Fixed only after a verification event");
      return;
    }
    if (error) {
      onStatus(error);
      return;
    }
    if (note) {
      onStatus(note);
      return;
    }
    onStatus("enter create remediations · create is not Fixed");
  }, [busy, error, note, onStatus]);

  async function createRemediations(): Promise<void> {
    if (busyRef.current) {
      return;
    }
    const id = missionIdRef.current.trim();
    if (!id) {
      setError("Mission ID is required.");
      setNote(null);
      return;
    }
    if (!UUID_RE.test(id)) {
      setError("Mission ID must be a UUID.");
      setNote(null);
      return;
    }

    busyRef.current = "create";
    setBusy("create");
    setError(null);
    setNote(null);

    try {
      const result = await api.createCommunityRemediations(id);
      const nextRows: RemediationRow[] = result.remediationIds.map(
        (remediationId) => ({
          remediationId,
          status: "Open",
          verification: null
        })
      );
      rowsRef.current = nextRows;
      selectedRef.current = 0;
      setRows(nextRows);
      setSelectedIndex(0);
      setNote(openedNote(result.createdCount));
      if (nextRows.length > 0) {
        modeRef.current = "list";
        setMode("list");
      }
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          "Unable to create remediations from this Community mission."
        )
      );
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }

  async function verifySelected(): Promise<void> {
    if (busyRef.current) {
      return;
    }
    const row = rowsRef.current[selectedRef.current];
    if (!row) {
      return;
    }

    busyRef.current = "verify";
    setBusy("verify");
    setError(null);

    try {
      const result = await api.verifyRemediation(row.remediationId);
      const nextRows = rowsRef.current.map((item) =>
        item.remediationId === row.remediationId
          ? {
              remediationId: result.remediation.remediationId,
              status: result.remediation.status,
              verification: result.verificationEvent
            }
          : item
      );
      rowsRef.current = nextRows;
      setRows(nextRows);
      const measured = result.verificationEvent.measuredRevalidation
        ? " (measured)"
        : "";
      setNote(
        `verification event · ${result.verificationEvent.outcome}${measured}`
      );
    } catch (caught) {
      setError(errorMessage(caught, "Unable to verify remediation."));
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }

  useInput((input, key) => {
    if (busyRef.current) {
      return;
    }

    if (modeRef.current === "list") {
      if (input === "m") {
        modeRef.current = "mission";
        setMode("mission");
        return;
      }
      if (input === "j" || key.downArrow) {
        const next = Math.min(
          selectedRef.current + 1,
          Math.max(rowsRef.current.length - 1, 0)
        );
        selectedRef.current = next;
        setSelectedIndex(next);
        return;
      }
      if (input === "k" || key.upArrow) {
        const next = Math.max(selectedRef.current - 1, 0);
        selectedRef.current = next;
        setSelectedIndex(next);
        return;
      }
      if (input === "v" || key.return) {
        void verifySelected();
      }
      return;
    }

    if (key.return) {
      void createRemediations();
      return;
    }
    if (key.backspace || key.delete) {
      const next = missionIdRef.current.slice(0, -1);
      missionIdRef.current = next;
      setMissionId(next);
      return;
    }
    if (key.ctrl || key.meta) {
      return;
    }
    const chunk = input.replace(/[^0-9a-fA-F-]/gu, "");
    if (!chunk) {
      return;
    }
    const next = `${missionIdRef.current}${chunk}`;
    missionIdRef.current = next;
    setMissionId(next);
  });

  return (
    <Box flexDirection="column">
      <Text bold color={theme.accent}>
        Fix · Community remediations
      </Text>
      <Text color={theme.warn}>{CREATE_IS_NOT_FIXED}</Text>
      <Box marginTop={1}>
        <Box width={12}>
          <Text color={mode === "mission" ? theme.accent : theme.muted}>
            Mission ID
          </Text>
        </Box>
        <Text>{missionId || " "}</Text>
      </Box>
      <Text color={theme.muted}>
        {mode === "list"
          ? "v verify · j/k select · m mission · create is not Fixed"
          : "enter create remediations · create is not Fixed"}
      </Text>
      {note ? (
        <Text color={theme.ink} wrap="wrap">
          {note}
        </Text>
      ) : null}
      {error ? <Text color={theme.danger}>{error}</Text> : null}
      {rows.length > 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.muted}>id status verification</Text>
          {rows.map((row, index) => (
            <Box key={row.remediationId}>
              <Text
                color={index === selectedIndex ? theme.accent : theme.muted}
              >
                {index === selectedIndex ? "> " : "  "}
              </Text>
              <Text>{row.remediationId} </Text>
              <Text color={statusColor(row.status)}>{row.status} </Text>
              <Text color={theme.muted}>{verificationLabel(row)}</Text>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
