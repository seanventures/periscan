import React, { useEffect, useMemo, useState } from "react";
import { Box, Text } from "ink";
import { z } from "zod";

import { ExploitabilityStateSchema } from "@periscan/shared";

import { PeriscanApiError, type PeriscanApi } from "../lib/api.js";
import {
  FINDINGS_SARIF_PATH,
  SARIF_EXPORT_HONESTY
} from "../lib/sarif-export.js";
import { theme } from "../theme.js";

const FindingRowSchema = z.object({
  evidenceIds: z.array(z.string()),
  exploitability: ExploitabilityStateSchema,
  findingId: z.string().optional(),
  title: z.string().min(1)
});

export type FindingListRow = z.infer<typeof FindingRowSchema>;

type FindingsClient = {
  listFindings?: (query?: { missionId?: string }) => Promise<unknown>;
  requestJson?: (path: string, init?: RequestInit) => Promise<unknown>;
};

function findingsListPath(missionId?: string): string {
  if (!missionId) {
    return "/api/v1/findings";
  }
  return `/api/v1/findings?missionId=${encodeURIComponent(missionId)}`;
}

function unwrapFindingsItems(raw: unknown): unknown {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (
    raw &&
    typeof raw === "object" &&
    "items" in raw &&
    Array.isArray((raw as { items: unknown }).items)
  ) {
    return (raw as { items: unknown[] }).items;
  }
  throw new Error("Unable to read findings (invalid list)");
}

function sarifHintPath(missionId?: string): string {
  if (!missionId) {
    return FINDINGS_SARIF_PATH;
  }
  return `${FINDINGS_SARIF_PATH}?missionId=${missionId}`;
}

function resolveMissionId(explicit?: string): string | undefined {
  const value = explicit?.trim() || process.env.PERISCAN_MISSION_ID?.trim();
  return value ? value : undefined;
}

function exploitabilityColor(
  exploitability: FindingListRow["exploitability"]
): string {
  switch (exploitability) {
    case "Exploitable":
    case "Reachable":
      return theme.danger;
    case "Validated":
      return theme.warn;
    case "Blocked":
    case "NotReachable":
      return theme.ok;
    default:
      return theme.muted;
  }
}

function findingsError(error: unknown): string {
  if (error instanceof PeriscanApiError) {
    return `Unable to read findings (${error.status})`;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Unable to read findings";
}

export async function readFindings(
  api: PeriscanApi,
  query: { missionId?: string } = {}
): Promise<FindingListRow[]> {
  const client = api as PeriscanApi & FindingsClient;
  let raw: unknown;
  if (typeof client.listFindings === "function") {
    raw = await client.listFindings(
      query.missionId ? { missionId: query.missionId } : {}
    );
  } else if (typeof client.requestJson === "function") {
    raw = await client.requestJson(findingsListPath(query.missionId), {
      method: "GET"
    });
  } else {
    throw new Error("Unable to read findings (client missing listFindings)");
  }

  const parsed = z.array(FindingRowSchema).safeParse(unwrapFindingsItems(raw));
  if (!parsed.success) {
    throw new Error("Unable to read findings (invalid list)");
  }
  return parsed.data;
}

type FindingsView =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; items: FindingListRow[] };

export function FindingsScreen(props: {
  api: PeriscanApi;
  missionId?: string;
  onStatus: (s: string) => void;
}) {
  const missionId = resolveMissionId(props.missionId);
  const [view, setView] = useState<FindingsView>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    props.onStatus("loading findings");
    setView({ kind: "loading" });

    void readFindings(props.api, { missionId })
      .then((items) => {
        if (cancelled) {
          return;
        }
        setView({ kind: "ready", items });
        props.onStatus(
          items.length === 0
            ? "no findings · not a clean bill of health"
            : `${items.length} finding${items.length === 1 ? "" : "s"}`
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const message = findingsError(error);
        setView({ kind: "error", message });
        props.onStatus(message);
      });

    return () => {
      cancelled = true;
    };
  }, [missionId, props.api, props.onStatus]);

  const sarifPath = useMemo(() => sarifHintPath(missionId), [missionId]);

  return (
    <Box flexDirection="column">
      <Text bold>Findings</Text>
      {missionId ? (
        <Text color={theme.muted}>{`mission ${missionId}`}</Text>
      ) : null}

      {view.kind === "loading" ? (
        <Text color={theme.muted}>Loading findings…</Text>
      ) : null}

      {view.kind === "error" ? (
        <Text color={theme.danger}>{view.message}</Text>
      ) : null}

      {view.kind === "ready" && view.items.length === 0 ? (
        <Box flexDirection="column">
          <Text>No findings.</Text>
          <Text color={theme.muted}>
            Empty is not a clean bill of health.
          </Text>
          <Text color={theme.muted}>
            4 run to start Gitleaks-class on verified scope.
          </Text>
        </Box>
      ) : null}

      {view.kind === "ready"
        ? view.items.map((finding, index) => (
            <Box
              key={finding.findingId ?? `${finding.title}:${index}`}
              flexDirection="column"
            >
              <Text>{finding.title}</Text>
              <Text color={theme.muted}>
                {`evidence ${finding.evidenceIds.length} · `}
                <Text color={exploitabilityColor(finding.exploitability)}>
                  {finding.exploitability}
                </Text>
              </Text>
            </Box>
          ))
        : null}

      <Box marginTop={1} flexDirection="column">
        <Text color={theme.muted}>Export SARIF (evidence-backed)</Text>
        <Text color={theme.muted}>{`GET ${sarifPath}`}</Text>
        <Text color={theme.muted}>{SARIF_EXPORT_HONESTY}</Text>
      </Box>
    </Box>
  );
}
